
import React, { useState, useRef, useEffect } from 'react';
import { Task, User, Message } from '../types.ts';
import { geminiService } from '../services/geminiService.ts';

interface ChatBotProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  user: User;
}

const ChatBot: React.FC<ChatBotProps> = ({ isOpen, onClose, tasks, user }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Namaste ${user.name.split(' ')[0]}! I'm Saathi, your TaskSetu assistant. I can help you summarize your tasks, draft WhatsApp reminders, or give you a productivity score. How can I assist you today?`,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    const response = await geminiService.chatWithBot(inputValue, { tasks, user: user.name });

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response || "I'm sorry, I'm having a bit of trouble connecting to the server.",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);
  };

  const handleQuickAction = async (action: string) => {
    setIsTyping(true);
    let prompt = '';
    if (action === 'summary') prompt = "Give me a quick summary of my current workload.";
    if (action === 'whatsapp') prompt = "Draft a polite WhatsApp reminder for my team about pending tasks.";

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date()
    }]);

    const response = await geminiService.analyzeTasks(tasks, user.name);
    setMessages(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response || "I couldn't analyze the tasks at this moment.",
      timestamp: new Date()
    }]);
    setIsTyping(false);
  };

  const formatMessage = (content: string) => {
    // Split by newlines to handle paragraphs and lists
    const lines = content.split('\n');

    return lines.map((line, idx) => {
      // Handle bolding **text**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      // Handle simple list items
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        return <div key={idx} className="flex gap-2 ml-2 my-1"><span className="text-orange-500">•</span><p className="flex-1">{formattedLine.slice(1)}</p></div>;
      }

      // Handle headers ###
      if (line.trim().startsWith('### ')) {
        return <h3 key={idx} className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide mt-4 mb-2">{line.replace('### ', '')}</h3>;
      }

      // Default paragraph, preserve empty lines
      return line.trim() === '' ? <div key={idx} className="h-2"></div> : <p key={idx} className="mb-1 last:mb-0">{formattedLine}</p>;
    });
  };

  const [width, setWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const stopResizing = () => setIsResizing(false);

    const resize = (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - mouseMoveEvent.clientX;
        if (newWidth > 300 && newWidth < 800) {
          setWidth(newWidth);
        }
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);

  return (
    <div
      style={{ width: isOpen ? `${width}px` : '0px' }}
      className={`fixed inset-y-0 right-0 bg-white dark:bg-slate-900 shadow-[-20px_0_50px_rgba(0,0,0,0.1)] dark:shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-[150] transition-all duration-300 ease-out border-l border-slate-100 dark:border-slate-800 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={startResizing}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-orange-500/50 transition-colors z-[160]"
      ></div>

      <div className="p-6 bg-teal-900 dark:bg-slate-950 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-800 dark:bg-slate-800 rounded-full -mr-16 -mt-16 opacity-50"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-900/40">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight text-white">Saathi <span className="text-orange-400">AI</span></h3>
            <p className="text-[9px] text-teal-400 uppercase tracking-[0.2em] font-black">Intelligent Companion</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all relative z-10">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] p-5 rounded-3xl text-sm font-medium leading-relaxed shadow-sm ${msg.role === 'user'
              ? 'bg-orange-600 text-white rounded-tr-none shadow-orange-600/10'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-tl-none'
              }`}>
              {msg.role === 'assistant' ? formatMessage(msg.content) : msg.content}
              <div className={`text-[9px] mt-2 flex items-center gap-1 ${msg.role === 'user' ? 'text-orange-200' : 'text-slate-400 dark:text-slate-500'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 px-5 py-4 rounded-3xl rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm flex gap-1.5 items-center">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold ml-2 uppercase tracking-widest">Saathi is thinking</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => handleQuickAction('summary')}
            className="text-[10px] font-black text-teal-800 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-4 py-2 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-all border border-teal-100 dark:border-teal-800 active:scale-95"
          >
            📋 Workload Summary
          </button>
          <button
            disabled
            className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800 opacity-50 cursor-not-allowed"
          >
            💬 Team Reminder (Coming Soon)
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSend()}
            placeholder="Type your question..."
            className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-transparent rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-700 focus:border-teal-900 dark:focus:border-orange-500 transition-all outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="w-14 h-14 flex items-center justify-center bg-orange-600 text-white rounded-2xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/30 disabled:opacity-50 disabled:shadow-none active:scale-90"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
