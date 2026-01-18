import { Task } from '../types';
import { liveAudioService } from './liveAudioService';

export class GeminiLiveClient {
    private ws: WebSocket | null = null;
    private isConnected: boolean = false;
    private tasks: Task[] = [];

    async connect(tasks: Task[], onError?: (msg: string) => void) {
        this.tasks = tasks;
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key missing");

        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

        return new Promise<void>((resolve, reject) => {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.isConnected = true;
                console.log("Gemini Live: Connected");
                this.sendSetup();
                resolve();
            };

            this.ws.onmessage = this.handleMessage.bind(this);

            this.ws.onerror = (ev) => {
                console.error("Gemini Live: WebSocket Error", ev);
                if (!this.isConnected) reject(ev);
            };

            this.ws.onclose = (ev) => {
                console.log(`Gemini Live: Disconnected. Code: ${ev.code}, Reason: ${ev.reason}`);

                const reasonStr = (ev.reason || "").toLowerCase();
                const isQuotaError = ev.code === 1011 && (reasonStr.includes("quota") || reasonStr.includes("resource exhausted"));

                if (isQuotaError && onError) {
                    onError("Not available at the moment");
                }

                this.isConnected = false;
            };
        });
    }

    private sendSetup() {
        if (!this.ws) return;

        // Create context string
        const taskContext = JSON.stringify(this.tasks.map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            teamId: t.teamId,
            assignee: t.assigneeId,
            dueDate: t.dueDate
        })));

        // Minimized Setup to debug
        const setupMsg = {
            setup: {
                model: "models/gemini-2.0-flash-exp",
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    // Remove specific voice config to rule out invalid voice names
                },
                systemInstruction: {
                    parts: [
                        {
                            text: `You are Saathi, an intelligent AI task assistant for the app 'TaskSetu'. 
You have access to the user's tasks across all their teams. 
Here is the current Task Database: ${taskContext}.
User Name: Adarsh (or derive from context).
Instructions:
1. Answer queries about tasks efficiently.
2. Be friendly, professional, and concise.
3. If asked to 'create' or 'update' a task, acknowledge that you currently only have read access but can guide them (as we haven't implemented tool use for write ops yet in this live demo).
4. Use the specific Team IDs to differentiate context if needed. personal_ prefix implies Personal Workspace.
`
                        }
                    ]
                }
            }
        };

        console.log("Gemini Live: Sending Setup...", JSON.stringify(setupMsg));
        this.ws.send(JSON.stringify(setupMsg));
    }

    sendAudioChunk(base64: string) {
        if (!this.ws || !this.isConnected) return;

        const msg = {
            realtimeInput: {
                mediaChunks: [
                    {
                        mimeType: "audio/pcm;rate=16000",
                        data: base64
                    }
                ]
            }
        };

        // Check WebSocket state before sending
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    private handleMessage(event: MessageEvent) {
        // Check if event.data is a Blob (binary) or String
        let data = event.data;
        console.log("Gemini Live Raw Msg:", data); // Debug log
        if (data instanceof Blob) {
            // Did not expect binary here usually, unless configured. The API usually sends JSON text frames.
            // But if it is blob, read it.
            const reader = new FileReader();
            reader.onload = () => {
                const text = reader.result as string;
                this.processJson(text);
            };
            reader.readAsText(data);
        } else {
            this.processJson(data);
        }
    }

    private processJson(jsonStr: string) {
        try {
            const response = JSON.parse(jsonStr);

            // Debug server logs
            // console.log("Gemini Live Msg:", response);

            if (response.serverContent) {
                const { modelTurn } = response.serverContent;
                if (modelTurn && modelTurn.parts) {
                    for (const part of modelTurn.parts) {
                        if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
                            // Play Audio
                            liveAudioService.playAudio(part.inlineData.data);
                        }
                        if (part.text) {
                            // Optional: Show transcript in UI
                            console.log("Gemini Live Text:", part.text);
                        }
                    }
                }
                if (response.serverContent.turnComplete) {
                    // Turn done
                }
            }
        } catch (e) {
            console.error("Error parsing Gemini message", e);
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
}

export const geminiLiveClient = new GeminiLiveClient();
