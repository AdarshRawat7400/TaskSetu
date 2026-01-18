import React, { useEffect, useState, useRef } from 'react';
import { User, Task } from '../types';
import { liveAudioService } from '../services/liveAudioService';
import { geminiLiveClient } from '../services/geminiLiveClient';
import { firebaseService } from '../services/firebaseService';

interface VoiceChatOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
}

const VoiceChatOverlay: React.FC<VoiceChatOverlayProps> = ({ isOpen, onClose, currentUser }) => {
    const [status, setStatus] = useState<'connecting' | 'active' | 'error'>('connecting');
    const [isMuted, setIsMuted] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Use ref to track mute state inside the audio callback without re-binding
    const isMutedRef = useRef(isMuted);

    useEffect(() => {
        isMutedRef.current = isMuted;
    }, [isMuted]);

    useEffect(() => {
        if (!isOpen) return;

        const startSession = async () => {
            let connectionFailed = false; // Local flag to prevent race condition
            try {
                setStatus('connecting');
                const tasks = await firebaseService.getAllUserTasks(currentUser.id);
                console.log("Voice Chat: Synced", tasks.length, "tasks for context.");

                await geminiLiveClient.connect(tasks, (errorMsg) => {
                    console.log("Voice Chat Error Callback:", errorMsg);
                    connectionFailed = true;
                    setStatus('error');
                    setErrorMsg(errorMsg);
                    liveAudioService.stop();
                });

                await liveAudioService.start((base64Data) => {
                    if (!isMutedRef.current) {
                        geminiLiveClient.sendAudioChunk(base64Data);
                    }
                });

                // Only set active if we haven't failed yet
                if (!connectionFailed) {
                    setStatus('active');
                    setErrorMsg('');
                }
            } catch (e: any) {
                console.error("Failed to start voice session:", e);
                // If we already handled a specific connection error, don't overwrite generic
                if (!connectionFailed) {
                    setStatus('error');
                    setErrorMsg(e.message || "Connection failed");
                }
            }
        };

        startSession();

        return () => {
            liveAudioService.stop();
            geminiLiveClient.disconnect();
        };
    }, [isOpen, currentUser]); // Removed isMuted dependency

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in">
            <div className="flex flex-col items-center justify-center w-full max-w-md p-8 text-center space-y-8">

                {/* Status Indicator */}
                <div className="relative">
                    {status === 'active' && !isMuted && (
                        <div className="absolute inset-0 bg-blue-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                    )}
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center border-4 transition-all duration-500
            ${status === 'active' ? (isMuted ? 'border-orange-500' : 'border-blue-500 scale-110 shadow-[0_0_50px_rgba(59,130,246,0.5)]') : 'border-slate-700'}
            ${status === 'error' ? 'border-red-500' : ''}
          `}>
                        {status === 'connecting' && <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>}
                        {status === 'active' && (
                            isMuted ? (
                                <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" /></svg>
                            ) : (
                                <div className="space-y-1 flex gap-1 items-end h-12">
                                    <div className="w-1.5 bg-blue-400 h-4 animate-[bounce_1s_infinite_100ms]"></div>
                                    <div className="w-1.5 bg-blue-400 h-8 animate-[bounce_1s_infinite_200ms]"></div>
                                    <div className="w-1.5 bg-blue-400 h-6 animate-[bounce_1s_infinite_300ms]"></div>
                                    <div className="w-1.5 bg-blue-400 h-10 animate-[bounce_1s_infinite_400ms]"></div>
                                    <div className="w-1.5 bg-blue-400 h-5 animate-[bounce_1s_infinite_500ms]"></div>
                                </div>
                            )
                        )}
                        {status === 'error' && <span className="text-red-500 text-4xl">!</span>}
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                        {status === 'connecting' && "Connecting to Saathi..."}
                        {status === 'active' && (isMuted ? "Mic Muted" : "Listening...")}
                        {status === 'error' && "Connection Failed"}
                    </h2>
                    {status === 'active' && <p className="text-slate-400 text-sm">Speak naturally. I know about all your tasks.</p>}
                    {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${isMuted ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                        title="Toggle Mute"
                    >
                        {isMuted ? (
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" /></svg>
                        ) : (
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        )}
                    </button>
                    <button
                        onClick={() => onClose()}
                        className="w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95"
                        title="End Call"
                    >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <p className="text-xs text-slate-600 pt-8">Powered by Gemini Multimodal Live API</p>
            </div>
        </div>
    );
};

export default VoiceChatOverlay;
