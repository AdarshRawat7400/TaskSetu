import React, { useState, useEffect, useRef } from 'react';
import { Task, User, Message } from '../types.ts';
import { geminiService } from '../services/geminiService.ts';

interface TicketChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: Task | null;
    user: User;
    onUpdateTask: (task: Task) => void;
}

const TicketChatModal: React.FC<TicketChatModalProps> = ({ isOpen, onClose, task, user, onUpdateTask }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [logToComments, setLogToComments] = useState(false);

    // Track the ID of the comment that holds this session's log
    const activeSessionCommentId = useRef<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && task) {
            setMessages([{
                id: 'init',
                role: 'assistant',
                content: `Analyzing ticket **${task.title}**...`,
                timestamp: new Date()
            }]);
            activeSessionCommentId.current = null;
            initializeChat();
        } else {
            setMessages([]);
            setLogToComments(false);
            activeSessionCommentId.current = null;
        }
    }, [isOpen, task]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const initializeChat = async () => {
        if (!task) return;
        setIsTyping(true);
        const summary = await geminiService.analyzeTasks([task], user.name);

        // Replace init message
        setMessages([{
            id: Date.now().toString(),
            role: 'assistant',
            content: summary || "I couldn't generate a summary right now, but I'm ready to chat about this ticket!",
            timestamp: new Date()
        }]);
        setIsTyping(false);
    };

    const handleToggleLogging = (enabled: boolean) => {
        setLogToComments(enabled);
        if (enabled) {
            // Immediately sync current session when enabled
            syncSessionToComment(messages);
        }
    };

    const syncSessionToComment = (currentMessages: Message[]) => {
        if (!task) return;

        // Filter out init message, only keep user/assistant exchange
        const validMessages = currentMessages.filter(m => m.id !== 'init');
        if (validMessages.length === 0) return;

        const sessionData = {
            messages: validMessages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }))
        };

        const contentString = `[AI_SESSION]${JSON.stringify(sessionData)}`;
        const timestamp = new Date().toISOString();

        let newComments = [...(task.comments || [])];

        if (activeSessionCommentId.current) {
            // Update existing comment
            const idx = newComments.findIndex(c => c.id === activeSessionCommentId.current);
            if (idx !== -1) {
                newComments[idx] = { ...newComments[idx], content: contentString };
            } else {
                // Comment lost? Re-create
                const newId = Math.random().toString(36).substr(2, 9);
                activeSessionCommentId.current = newId;
                newComments.push({
                    id: newId,
                    userId: 'saathi-ai',
                    content: contentString,
                    timestamp: timestamp
                });
            }
        } else {
            // Create new session comment
            const newId = Math.random().toString(36).substr(2, 9);
            activeSessionCommentId.current = newId;
            newComments.push({
                id: newId,
                userId: 'saathi-ai',
                content: contentString,
                timestamp: timestamp
            });
        }

        onUpdateTask({ ...task, comments: newComments });
    };

    const handleSend = async () => {
        if (!inputValue.trim() || !task) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            timestamp: new Date()
        };

        // Optimistic update
        const updatedMessagesInitial = [...messages, userMsg];
        setMessages(updatedMessagesInitial);
        setInputValue('');
        setIsTyping(true);

        // If logging enabled, sync immediately with user message
        if (logToComments) {
            syncSessionToComment(updatedMessagesInitial);
        }

        const response = await geminiService.chatWithBot(inputValue, { tasks: [task], user: user.name });

        const botMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: response || "I'm having trouble connecting.",
            timestamp: new Date()
        };

        const updatedMessagesFinal = [...updatedMessagesInitial, botMsg];
        setMessages(updatedMessagesFinal);
        setIsTyping(false);

        if (logToComments) {
            syncSessionToComment(updatedMessagesFinal);
        }
    };

    const formatMessage = (content: string) => {
        const lines = content.split('\n');
        return lines.map((line, idx) => {
            const parts = line.split(/(\*\*.*?\*\*)/g);
            const formattedLine = parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
                return part;
            });
            if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
                return <div key={idx} className="flex gap-2 ml-2 my-1"><span className="text-orange-500">•</span><p className="flex-1">{formattedLine.slice(1)}</p></div>;
            }
            return line.trim() === '' ? <div key={idx} className="h-2"></div> : <p key={idx} className="mb-1 last:mb-0">{formattedLine}</p>;
        });
    };

    if (!isOpen || !task) return null;

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">

                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 rounded-t-3xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">Ticket Intelligence</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[200px]">{task.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Chat Area */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[90%] p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-600/10'
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-tl-none'
                                }`}>
                                {msg.role === 'assistant' ? formatMessage(msg.content) : msg.content}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 rounded-b-3xl">

                    <div className="flex items-center justify-between mb-4 px-1">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${logToComments ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${logToComments ? 'translate-x-4' : 'translate-x-0'}`}></div>
                            </div>
                            <input type="checkbox" checked={logToComments} onChange={e => handleToggleLogging(e.target.checked)} className="hidden" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 group-hover:text-indigo-600 transition-colors">Log Chat to Comments</span>
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && handleSend()}
                            placeholder="Ask about this ticket..."
                            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none transition-all"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-90 shadow-lg shadow-indigo-600/20"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TicketChatModal;
