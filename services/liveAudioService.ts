/**
 * Service to handle real-time audio input and output for Gemini Live API.
 * Uses AudioContext and AudioWorklet for low-latency PCM processing.
 */

const PCM_WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      // Send the first channel's data to the main thread
      this.port.postMessage(input[0]);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

export class LiveAudioService {
    private audioContext: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private mediaStream: MediaStream | null = null;
    private onAudioData: ((base64: string) => void) | null = null;
    private isRecording: boolean = false;
    private nextPlayTime: number = 0;

    async start(onData: (base64: string) => void) {
        this.onAudioData = onData;
        // Remove fixed sampleRate to avoid "different sample-rate" error.
        // We will handle resampling manually.
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.error("Failed to create AudioContext", e);
            throw e;
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        // Check if stopped while resuming
        if (!this.audioContext) return;

        const inputSampleRate = this.audioContext.sampleRate;

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Check if stopped while getting media
            if (!this.audioContext) {
                this.mediaStream.getTracks().forEach(t => t.stop());
                return;
            }

            // Load Worklet
            const blob = new Blob([PCM_WORKLET_CODE], { type: 'application/javascript' });
            const workletUrl = URL.createObjectURL(blob);

            try {
                await this.audioContext.audioWorklet.addModule(workletUrl);
            } catch (e) {
                console.error("AudioWorklet addModule failed", e);
                // If addModule failed, maybe context is closed or other issue.
                throw e;
            }

            // Check again after async addModule
            if (!this.audioContext) {
                this.mediaStream.getTracks().forEach(t => t.stop());
                return;
            }

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');

            this.workletNode.port.onmessage = (event) => {
                if (!this.isRecording) return;

                // Float32Array from worklet (Reference to buffer at native rate)
                const float32Data = event.data;

                // Downsample from native rate (e.g. 48000) to 16000
                const downsampled = this.downsampleBuffer(float32Data, inputSampleRate, 16000);

                // Convert to Int16 PCM
                const int16Data = this.float32ToInt16(downsampled);

                // Convert to Base64
                const base64 = this.arrayBufferToBase64(int16Data.buffer);

                if (this.onAudioData) {
                    this.onAudioData(base64);
                }
            };

            source.connect(this.workletNode);
            // Connect to destination to keep graph alive, but disconnect if feedback occurs. 
            // Usually needed for 'process' to fire in some browsers. But we don't want to hear ourselves.
            // If we connect to destination, we must ensure it doesn't loop back to mic.
            // Easiest is to create a GainNode(0) and connect to that, then destination.
            const muteNode = this.audioContext.createGain();
            muteNode.gain.value = 0;
            this.workletNode.connect(muteNode);
            muteNode.connect(this.audioContext.destination);

            this.isRecording = true;
            console.log(`Audio started. Input Rate: ${inputSampleRate}Hz. Downsampling to 16000Hz.`);

        } catch (e) {
            console.error("Error starting audio:", e);
            throw e;
        }
    }

    stop() {
        this.isRecording = false;
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    playAudio(base64Data: string) {
        if (!this.audioContext) return;
        if (this.audioContext.state === 'suspended') this.audioContext.resume();

        const audioData = this.base64ToArrayBuffer(base64Data);
        const int16Array = new Int16Array(audioData);
        const float32Array = new Float32Array(int16Array.length);

        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768;
        }

        // Playback at 24kHz (Standard Gemini Output)
        // Web Audio API handles resampling automatically if Context is different.
        const buffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
        buffer.copyToChannel(float32Array, 0);

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);

        const now = this.audioContext.currentTime;
        // Scheduler to ensure smooth playback
        const startTime = Math.max(now, this.nextPlayTime);
        source.start(startTime);
        this.nextPlayTime = startTime + buffer.duration;
    }

    /**
     * Simple Linear Interpolation Downsampler
     */
    private downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
        if (outputRate === inputRate) {
            return buffer;
        }
        const sampleRateRatio = inputRate / outputRate;
        const newLength = Math.round(buffer.length / sampleRateRatio);
        const result = new Float32Array(newLength);

        for (let i = 0; i < newLength; i++) {
            const nextSrcIndex = i * sampleRateRatio;
            const srcIndex = Math.floor(nextSrcIndex);
            const ratio = nextSrcIndex - srcIndex;

            const nextValue = buffer[srcIndex + 1] !== undefined ? buffer[srcIndex + 1] : buffer[srcIndex];
            const currValue = buffer[srcIndex];

            // Interpolate
            result[i] = currValue + (nextValue - currValue) * ratio;
        }
        return result;
    }

    private float32ToInt16(float32Array: Float32Array): Int16Array {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return int16Array;
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

export const liveAudioService = new LiveAudioService();
