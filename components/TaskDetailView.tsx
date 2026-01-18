
import React, { useState, useEffect, useRef } from 'react';
import { Task, User, TaskStatus, Attachment, ReminderType, ActivityLog, Comment } from '../types.ts';
import { firebaseService } from '../services/firebaseService.ts';
import { geminiService } from '../services/geminiService.ts';
import { gasUploadService } from '../services/gasUploadService.ts';

interface TaskDetailViewProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
}


const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95">
        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center mb-6 mx-auto">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </div>
        <h3 className="text-xl font-black text-center text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-center text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed mb-8">
          {message}
        </p>
        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20">
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const formatMessage = (content: string) => {
  const lines = content.split('\n');
  return lines.map((line, idx) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const formattedLine = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      return <div key={idx} className="flex gap-2 ml-2 my-1"><span className="text-orange-500">•</span><p className="flex-1">{formattedLine.slice(1)}</p></div>;
    }

    if (line.trim().startsWith('### ')) {
      return <h3 key={idx} className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide mt-4 mb-2">{line.replace('### ', '')}</h3>;
    }

    return line.trim() === '' ? <div key={idx} className="h-2"></div> : <p key={idx} className="mb-1 last:mb-0">{formattedLine}</p>;
  });
};

const renderCommentContent = (content: string) => {
  if (content.startsWith('[AI_SESSION]')) {
    try {
      const jsonContent = content.replace('[AI_SESSION]', '');
      const sessionData = JSON.parse(jsonContent);
      const messages = sessionData.messages || [];

      return (
        <div className="mt-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="bg-slate-100 dark:bg-slate-800/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-orange-600 rounded-lg flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AI Chat Session</span>
            </div>

          </div>
          <div className="p-4 space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
            {messages.map((msg: any, idx: number) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] p-3 rounded-2xl text-xs font-medium leading-relaxed ${msg.role === 'user'
                  ? 'bg-orange-600 text-white rounded-tr-none'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-none'
                  }`}>
                  {msg.role === 'assistant' ? formatMessage(msg.content) : msg.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    } catch (e) {
      return <p className="text-xs text-red-500 italic">Error parsing AI session data.</p>;
    }
  }

  return <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">{content}</p>;
};

const TaskDetailView: React.FC<TaskDetailViewProps> = ({ task, isOpen, onClose, users, onUpdate, onDelete }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Task>(task);
  const [fileToDelete, setFileToDelete] = useState<Attachment | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'comments'>('info');
  const assignee = users.find(u => u.id === task.assigneeId);

  const scrollRef = useRef<HTMLDivElement>(null);

  // AI Autofill State
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const handleScanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanError(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = (reader.result as string).split(',')[1];
        const extracted = await geminiService.analyzeDocument(base64String, file.type);

        if (extracted) {
          setEditedTask(prev => ({
            ...prev,
            title: extracted.title || prev.title,
            description: extracted.description || prev.description,
            priority: extracted.priority || prev.priority,
            dueDate: extracted.dueDate || prev.dueDate
          }));
        }
      } catch (err: any) {
        console.error("Scan failed", err);
        const msg = err.message || "Failed to scan document.";
        setScanError(msg === "Not available at the moment" ? msg : "Failed to scan document.");
      } finally {
        setIsScanning(false);
        if (scanInputRef.current) scanInputRef.current.value = '';
      }
    };
    try {
      reader.readAsDataURL(file);
    } catch (e) {
      setIsScanning(false);
      setScanError("Failed to read file");
    }
  };

  useEffect(() => {
    const initialDate = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
    setEditedTask({
      ...task,
      dueDate: initialDate,
      reminderConfig: task.reminderConfig || {
        enabled: false,
        type: ReminderType.PERSONAL,
        durationMinutes: 30,
        whatsappBotEnabled: false
      }
    });
    setIsEditing(false);
    setAiInsight(null);
  }, [task]);

  const handleSaveEdit = () => {
    // Generate an activity log for the edit
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      userId: task.creatorId,
      action: 'Updated task details',
      timestamp: new Date().toISOString(),
      details: 'Modified description, priority, or reminders'
    };
    onUpdate({ ...editedTask, logs: [...(task.logs || []), newLog] });
    setIsEditing(false);
  };

  const addComment = () => {
    if (!commentInput.trim()) return;
    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      userId: task.creatorId, // Assuming creator is current user for demo
      content: commentInput,
      timestamp: new Date().toISOString()
    };
    onUpdate({ ...task, comments: [...(task.comments || []), newComment] });
    setCommentInput('');
  };

  const askSaathi = async () => {
    setAiInsight("Saathi is thinking...");
    const insight = await geminiService.analyzeTasks([task], assignee?.name || "User");
    setAiInsight(insight);
  };

  if (!isOpen) return null;

  const formattedDueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No due date set';

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 transition-colors">

        {/* Header Section */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
          <div className="flex-1 mr-4">
            {isEditing ? (
              <input
                type="text"
                value={editedTask.title}
                onChange={e => setEditedTask({ ...editedTask, title: e.target.value })}
                className="text-2xl font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 p-3 rounded-xl w-full border-2 border-orange-500 outline-none"
              />
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${task.status === TaskStatus.BLOCKED ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-red-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                    {task.status}
                  </span>
                  <span className="text-slate-400 dark:text-slate-600 font-bold text-[10px]"># {task.id.toUpperCase()}</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">{task.title}</h2>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end">
                  <button
                    onClick={() => scanInputRef.current?.click()}
                    disabled={isScanning}
                    className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 font-medium text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                    title="Upload image/PDF to autofill details"
                  >
                    <svg className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    {isScanning ? 'Analyzing...' : 'AI Autofill'}
                  </button>
                  <input
                    type="file"
                    ref={scanInputRef}
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={handleScanFile}
                  />
                  {scanError && <p className="text-red-500 text-[10px] text-right mt-1 font-medium">{scanError}</p>}
                </div>
                <button onClick={handleSaveEdit} className="px-4 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-lg">Save</button>
              </div>
            ) : (
              <button onClick={() => setIsEditing(true)} className="p-3 text-slate-400 hover:text-orange-600 rounded-2xl transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
            )}
            <button onClick={onClose} className="p-3 text-slate-400 hover:text-orange-600 rounded-2xl transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          {(['info', 'history', 'comments'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-6 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-400'}`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={onClose}
            className="py-4 px-6 text-[10px] font-black uppercase tracking-widest border-b-2 border-transparent text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all ml-auto"
          >
            CLOSE
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

          {activeTab === 'info' && (
            <div className="space-y-10">
              <section>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Description</h3>
                {isEditing ? (
                  <textarea
                    rows={4}
                    value={editedTask.description}
                    onChange={e => setEditedTask({ ...editedTask, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-slate-900 dark:text-white border-2 border-transparent focus:border-orange-500 outline-none font-medium"
                  />
                ) : (
                  <div onClick={() => setIsEditing(true)} className="group cursor-pointer relative rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 -m-2 p-2 transition-all">
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">{task.description || "No description provided."}</p>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </div>
                  </div>
                )}
              </section>

              {/* Attachments Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attachments</h3>
                  <div className="relative">
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      id="attachment-upload"
                      onChange={async (e) => {
                        if (!e.target.files?.length) return;
                        setIsUploading(true);
                        const newFiles = Array.from(e.target.files);
                        const uploadedAttachments: Attachment[] = [];

                        for (const file of newFiles) {
                          try {
                            const fileObj = file as File;
                            // Use GAS Upload Service instead of Firebase
                            // const url = await firebaseService.uploadFile(fileObj);
                            const url = await gasUploadService.uploadFile(fileObj);
                            uploadedAttachments.push({
                              id: Math.random().toString(36).substr(2, 9),
                              name: fileObj.name,
                              url: url,
                              type: fileObj.type,
                              size: fileObj.size,
                              uploadedAt: new Date().toISOString()
                            });
                          } catch (err) {
                            console.error("Upload failed", err);
                            // Ideally notify user, but console error for now to avoid blocking others
                          }
                        }
                        const updatedTask = {
                          ...task,
                          attachments: [...(task.attachments || []), ...uploadedAttachments]
                        };
                        onUpdate(updatedTask);
                        setEditedTask(updatedTask); // Keep edit state in sync
                        setIsUploading(false);
                      }}
                    />
                    <label
                      htmlFor="attachment-upload"
                      className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/10 dark:hover:bg-orange-900/20 cursor-pointer transition-colors ${isUploading ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      {isUploading ? 'Uploading...' : '+ Add File'}
                    </label>
                  </div>
                </div>

                {task.attachments && task.attachments.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {task.attachments.map((att) => (
                      <div key={att.id} className="group relative bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden hover:border-orange-200 dark:hover:border-orange-500/50 transition-colors">
                        <a href={att.url} target="_blank" rel="noreferrer" className="block p-3">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shrink-0 text-slate-400">
                              {att.type.includes('image') ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={att.name}>{att.name}</p>
                              <p className="text-[10px] font-medium text-slate-400 uppercase">{(att.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          {att.type.includes('image') && (
                            <div className="aspect-video rounded-xl bg-slate-200 dark:bg-slate-900 overflow-hidden mt-1">
                              {(() => {
                                const getDirectUrl = (url: string) => {
                                  if (!url) return '';
                                  // Check for Google Drive URL
                                  if (url.includes('drive.google.com') || url.includes('script.google.com')) {
                                    // Extract ID
                                    let id = '';
                                    if (url.includes('/d/')) {
                                      id = url.split('/d/')[1].split('/')[0];
                                    } else if (url.includes('id=')) {
                                      id = url.split('id=')[1].split('&')[0];
                                    }

                                    if (id) {
                                      // Use thumbnail endpoint which is more robust for embedding than download link
                                      // sz=w1000 requests a large thumbnail (width 1000px)
                                      return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
                                    }
                                  }
                                  return url;
                                };
                                return <img src={getDirectUrl(att.url)} referrerPolicy="no-referrer" className="w-full h-full object-cover" />;
                              })()}
                            </div>
                          )}
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFileToDelete(att);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem]">
                    <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest text-center">No files attached yet<br />Upload designs, docs, or screenshots</p>
                  </div>
                )}
              </section>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Assignee</h3>
                  {isEditing ? (
                    <div className="relative">
                      <select
                        value={editedTask.assigneeId}
                        onChange={e => setEditedTask({ ...editedTask, assigneeId: e.target.value })}
                        className="w-full pl-3 pr-10 py-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-orange-200 dark:border-slate-700 outline-none appearance-none font-bold text-xs"
                      >
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => setIsEditing(true)} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-orange-200 transition-all group relative">
                      <img src={assignee?.avatar} className="w-8 h-8 rounded-lg object-cover" />
                      <p className="font-bold text-slate-900 dark:text-white text-xs">{assignee?.name}</p>
                      <div className="absolute right-3 opacity-0 group-hover:opacity-100 text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Target Date</h3>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedTask.dueDate}
                      onChange={e => setEditedTask({ ...editedTask, dueDate: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-orange-200 dark:border-slate-700 outline-none font-bold text-xs"
                    />
                  ) : (
                    <div onClick={() => setIsEditing(true)} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-xs font-black uppercase text-slate-600 dark:text-slate-300 cursor-pointer hover:border-orange-200 transition-all group relative">
                      📅 {formattedDueDate}
                      <div className="absolute right-3 opacity-0 group-hover:opacity-100 text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Priority & Reminder Section */}
              <section className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Priority</label>
                    {isEditing ? (
                      <select
                        value={editedTask.priority}
                        onChange={e => setEditedTask({ ...editedTask, priority: e.target.value as any })}
                        className="w-full p-3 rounded-xl text-xs font-bold outline-none border bg-white dark:bg-slate-900 border-orange-200"
                      >
                        <option value="low">🌱 Normal</option>
                        <option value="medium">⚡ Important</option>
                        <option value="high">🚨 Critical</option>
                      </select>
                    ) : (
                      <div onClick={() => setIsEditing(true)} className="w-full p-3 rounded-xl text-xs font-bold border border-transparent bg-slate-100 dark:bg-slate-700/50 cursor-pointer hover:border-orange-200 transition-all flex items-center justify-between group">
                        <span>
                          {editedTask.priority === 'high' ? '🚨 Critical' : editedTask.priority === 'medium' ? '⚡ Important' : '🌱 Normal'}
                        </span>
                        <svg className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Advance Duration</label>
                    {isEditing ? (
                      <select
                        value={editedTask.reminderConfig?.durationMinutes}
                        onChange={e => setEditedTask({ ...editedTask, reminderConfig: { ...editedTask.reminderConfig!, durationMinutes: Number(e.target.value) } })}
                        className="w-full bg-white dark:bg-slate-900 p-3 rounded-xl text-xs font-bold outline-none border border-slate-100 dark:border-slate-800"
                      >
                        <option value={30}>30 Minutes Before</option>
                        <option value={60}>1 Hour Before</option>
                        <option value={1440}>1 Day Before</option>
                      </select>
                    ) : (
                      <div onClick={() => setIsEditing(true)} className="w-full bg-slate-100 dark:bg-slate-700/50 p-3 rounded-xl text-xs font-bold border border-transparent cursor-pointer hover:border-orange-200 transition-all flex items-center justify-between group">
                        <span>
                          {editedTask.reminderConfig?.durationMinutes === 1440 ? '1 Day Before' : editedTask.reminderConfig?.durationMinutes === 60 ? '1 Hour Before' : '30 Minutes Before'}
                        </span>
                        <svg className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Archive Section */}
              {/* Archive / Save Section */}
              <section className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-4">
                {isEditing && (
                  <button
                    onClick={handleSaveEdit}
                    className="w-full py-4 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-2xl uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    Save Changes
                  </button>
                )}

                {!isEditing && (
                  <button
                    onClick={() => {
                      onUpdate({ ...task, status: TaskStatus.ARCHIVED });
                      onClose();
                    }}
                    className="w-full py-4 text-xs font-black text-red-500 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-2xl uppercase tracking-widest transition-colors flex items-center justify-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Archive Ticket
                  </button>
                )}

                {!isEditing && (
                  <button
                    onClick={() => onDelete(task.id)}
                    className="w-full mt-3 py-4 text-xs font-black text-slate-400 hover:text-red-500 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-red-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Delete Ticket
                  </button>
                )}
              </section>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Audit Trail & Timeline</h3>
              <div className="relative pl-8 space-y-8 before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                {(task.logs || []).slice().reverse().map((log, idx) => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[28px] top-1 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-2 border-orange-500 z-10"></div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{log.action}</p>
                      {log.details && <p className="text-xs text-slate-500 mt-1">{log.details}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] font-black uppercase text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-md">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(log.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {(task.logs?.length === 0) && <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">No historical activity recorded yet.</p>}
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="flex flex-col h-full max-h-[500px]">
              <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 custom-scrollbar">
                {(task.comments || []).map(comment => {
                  const commentUser = users.find(u => u.id === comment.userId);
                  return (
                    <div key={comment.id} className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                      <img src={commentUser?.avatar} className="w-8 h-8 rounded-lg shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[11px] font-black text-slate-900 dark:text-white">{commentUser?.name}</p>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {renderCommentContent(comment.content)}
                      </div>
                    </div>
                  );
                })}
                {(task.comments?.length === 0) && (
                  <div className="h-40 flex flex-col items-center justify-center text-center p-8 bg-slate-50 dark:bg-slate-800/30 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">No comments yet<br />Be the first to say Namaste!</p>
                  </div>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addComment()}
                  className="w-full bg-slate-50 dark:bg-slate-800 px-6 py-4 rounded-2xl outline-none border-2 border-transparent focus:border-orange-500 text-sm font-medium transition-all"
                />
                <button
                  onClick={addComment}
                  className="absolute right-3 top-2.5 p-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all active:scale-90"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
      {/* File Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        title="Delete File?"
        message="Are you sure you want to delete this file? This action cannot be undone and will remove it from Google Drive."
        onConfirm={async () => {
          if (fileToDelete) {
            // Delete from GDrive
            await gasUploadService.deleteFile(fileToDelete.url);
            // Remove from Task
            const newAttachments = task.attachments?.filter(a => a.id !== fileToDelete.id) || [];
            onUpdate({ ...task, attachments: newAttachments });
            setFileToDelete(null);
          }
        }}
      />
    </div>
  );
};

export default TaskDetailView;
