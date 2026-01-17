
import React, { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable
} from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, TaskStatus, User, ReminderType, Attachment } from '../types.ts';
import { firebaseService } from '../services/firebaseService.ts';
import TicketChatModal from './TicketChatModal';
import TaskDetailView from './TaskDetailView.tsx';

interface DashboardProps {
  tasks: Task[];
  teamId: string;
  users: User[];
  currentUser: User;
  onUpdateTask: (id: string, status: TaskStatus) => void;
  onAddTask: (task: Task) => void;
  onTaskModified: (task: Task) => void;
  isArchivedView: boolean;
}

const TaskCard = ({ task, users, onClick, onArchive, onQuickUpdate, onChat, isPreview = false }: any) => {
  const [showMenu, setShowMenu] = useState(false);
  const assignee = users.find((u: any) => u.id === task.assigneeId);
  const formattedDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'No date';
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuAction = (e: React.MouseEvent, action: string, targetStatus?: TaskStatus) => {
    e.stopPropagation();
    setShowMenu(false);
    if (action === 'move' && targetStatus) onQuickUpdate(task.id, targetStatus);
    if (action === 'comment') onClick(task, 'comments');
  };

  const statusLabels: Record<TaskStatus, { label: string, color: string }> = {
    [TaskStatus.TODO]: { label: 'Pending', color: 'text-slate-500' },
    [TaskStatus.IN_PROGRESS]: { label: 'In Action', color: 'text-orange-500' },
    [TaskStatus.BLOCKED]: { label: 'Blocked', color: 'text-rose-500' },
    [TaskStatus.COMPLETED]: { label: 'Resolved', color: 'text-emerald-500' },
    [TaskStatus.ARCHIVED]: { label: 'Archived', color: 'text-slate-400' }
  };

  const availableStatuses = Object.values(TaskStatus).filter(s => s !== task.status);

  return (
    <div
      className={`bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 transition-all ${!isPreview ? 'hover:border-orange-200 dark:hover:border-orange-500/50 cursor-pointer group relative overflow-visible' : 'opacity-100 scale-100 ring-4 ring-orange-500/10'}`}
      onClick={() => !isPreview && onClick(task)}
    >
      {!isPreview && (
        <div className="absolute top-2 right-2 flex gap-1 z-20">
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-1 text-slate-400 hover:text-orange-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-50 animate-in zoom-in-95">
                <button onClick={(e) => handleMenuAction(e, 'comment')} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  Add Comment
                </button>

                <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>

                <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); onChat(task); }} className="w-full text-left px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 rounded-lg flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 flex items-center justify-center rounded bg-indigo-100 text-indigo-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  Summarize & Chat
                </button>

                <div className="px-3 pb-2 pt-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Move To</p>
                  <div className="space-y-1">
                    {availableStatuses.map(status => (
                      <button
                        key={status}
                        onClick={(e) => handleMenuAction(e, 'move', status)}
                        className={`w-full text-left py-1.5 px-2 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors ${statusLabels[status].color}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60"></span>
                        {statusLabels[status].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        {task.priority === 'high' && <span className="px-2 py-1 rounded-lg bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">🚨 CRITICAL</span>}
        {task.priority === 'medium' && <span className="px-2 py-1 rounded-lg bg-orange-100 text-orange-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">⚡ IMPORTANT</span>}
        {task.dueDate && (
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              {formattedDate}
            </span>
            {/* Quick Chat Icon */}
            {!isPreview && (
              <button
                onClick={(e) => { e.stopPropagation(); onChat(task); }}
                className="p-1 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                title="Summarize & Chat"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </button>
            )}
          </div>
        )}
      </div>
      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1 leading-tight group-hover:text-orange-600 transition-colors truncate">
        {task.title || "Untitled Ticket"}
      </h4>
      <p className="text-slate-500 dark:text-slate-400 text-xs line-clamp-2 mb-3 font-medium leading-relaxed min-h-[32px]">
        {task.description || "No description provided..."}
      </p>

      {/* Attachments Preview - Mini */}
      {task.attachments && task.attachments.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar">
          {task.attachments.map((att: any) => (
            att.type.startsWith('image') ? (
              <img key={att.id} src={att.url} className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700" title={att.name} />
            ) : (
              <div key={att.id} className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-500" title={att.name}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 2 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
            )
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-slate-50 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <img src={assignee?.avatar} className="w-6 h-6 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm object-cover" alt={assignee?.name} />
          <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter truncate max-w-[100px]">
            {assignee?.name || "Unassigned"}
          </span>
        </div>
        {task.reminderConfig?.whatsappBotEnabled && (
          <div className="text-emerald-500" title="WhatsApp Bot Sync Active">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.896 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.453-8.413z" /></svg>
          </div>
        )}
      </div>
    </div>
  );
};

const SortableTask = ({ task, users, onClick, onArchive, onQuickUpdate, onChat }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: false });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 0
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} users={users} onClick={onClick} onArchive={onArchive} onQuickUpdate={onQuickUpdate} onChat={onChat} />
    </div>
  );
};

interface DroppableColumnProps {
  title: string;
  status: TaskStatus;
  color: string;
  accent: string;
  tasks: Task[];
  users: User[];
  onCardClick: (t: Task, tab?: string) => void;
  onArchive: (id: string) => void;
  onQuickUpdate: (id: string, status: TaskStatus) => void;
  onChat: (task: Task) => void; // Added onChat prop
}

const DroppableColumn = ({ title, status, color, accent, tasks, users, onCardClick, onArchive, onQuickUpdate, onChat }: DroppableColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className="font-black text-slate-800 dark:text-slate-200 text-lg uppercase tracking-widest flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${color}`}></span>
          {title}
          <span className="text-slate-400 dark:text-slate-500 text-sm font-bold bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-full ml-1">
            {tasks.length}
          </span>
        </h3>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 rounded-[2rem] p-5 space-y-5 border-2 transition-all overflow-y-auto overflow-x-hidden custom-scrollbar ${isOver ? 'border-orange-500 bg-orange-500/10' : `border-dashed ${accent}`} bg-white/40 dark:bg-slate-800/20 backdrop-blur-sm`}
      >
        <SortableContext items={tasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task: any) => (
            <SortableTask key={task.id} task={task} users={users} onClick={onCardClick} onArchive={onArchive} onQuickUpdate={onQuickUpdate} onChat={onChat} />
          ))}
          {tasks.length === 0 && (
            <div className="h-full w-full min-h-[150px] flex items-center justify-center text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest pointer-events-none text-center p-10">
              Drag tasks here to change status
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ tasks, users, currentUser, onUpdateTask, onAddTask, teamId, onTaskModified, isArchivedView }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newAttachments, setNewAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [chatTask, setChatTask] = useState<Task | null>(null); // Added chatTask state
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '', description: '', status: TaskStatus.TODO, priority: 'medium', assigneeId: currentUser.id,
    dueDate: new Date().toISOString().split('T')[0],
    reminderConfig: { enabled: true, type: ReminderType.PERSONAL, durationMinutes: 30, whatsappBotEnabled: true }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = active.id;
    const overId = over.id;

    // Resolve which column we are dropping into
    const columnStatuses = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.COMPLETED, TaskStatus.ARCHIVED];

    let targetStatus: TaskStatus | null = null;

    if (columnStatuses.includes(overId as TaskStatus)) {
      // 1. Dropped directly over a column droppable
      targetStatus = overId as TaskStatus;
    } else {
      // 2. Dropped over another task, find its status
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status;
      }
    }

    if (targetStatus) {
      const activeTask = tasks.find(t => t.id === activeTaskId);
      if (activeTask && activeTask.status !== targetStatus) {
        onUpdateTask(activeTaskId as string, targetStatus);
      }
    }
  };

  const columns = [
    { title: 'Pending', status: TaskStatus.TODO, color: 'bg-slate-400', accent: 'border-slate-300 dark:border-slate-800' },
    { title: 'In Action', status: TaskStatus.IN_PROGRESS, color: 'bg-orange-500', accent: 'border-orange-200 dark:border-orange-800' },
    { title: 'Blocked', status: TaskStatus.BLOCKED, color: 'bg-rose-500', accent: 'border-rose-200 dark:border-rose-800' },
    { title: 'Resolved', status: TaskStatus.COMPLETED, color: 'bg-emerald-500', accent: 'border-emerald-200 dark:border-emerald-800' },
    { title: 'Archived', status: TaskStatus.ARCHIVED, color: 'bg-slate-200', accent: 'border-slate-200 dark:border-slate-700' }
  ];

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;

    setIsUploading(true);
    const uploadedAttachments: Attachment[] = [];

    // Upload files if any
    if (newAttachments.length > 0) {
      for (const file of newAttachments) {
        try {
          const url = await firebaseService.uploadFile(file);
          uploadedAttachments.push({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            url: url,
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("Upload failed", err);
          alert(`Failed to upload ${file.name}`);
        }
      }
    }

    onAddTask({
      ...newTask as Task,
      id: Math.random().toString(36).substr(2, 9),
      creatorId: currentUser.id,
      teamId,
      dueDate: newTask.dueDate || new Date().toISOString(),
      attachments: uploadedAttachments
    });

    setIsUploading(false);
    setNewAttachments([]);
    setNewTask({
      title: '', description: '', status: TaskStatus.TODO, priority: 'medium', assigneeId: currentUser.id,
      dueDate: new Date().toISOString().split('T')[0],
      reminderConfig: { enabled: true, type: ReminderType.PERSONAL, durationMinutes: 30, whatsappBotEnabled: true }
    });
    setIsModalOpen(false);
  };

  const handleArchive = (taskId: string) => {
    onUpdateTask(taskId, TaskStatus.ARCHIVED);
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel);
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 flex-none">
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Namaste, {currentUser.name.split(' ')[0]}</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">Manage your team and collaborate efficiently.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-orange-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-orange-700 transition-all shadow-xl shadow-orange-600/30 flex items-center justify-center gap-3 active:scale-95">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            Add New Task
          </button>
        </div>

        <div ref={scrollContainerRef} className="flex gap-6 overflow-x-auto pb-6 flex-1 min-h-0 snap-x custom-scrollbar">
          {columns.map(col => (
            <div key={col.status} className="min-w-[85vw] md:min-w-[350px] xl:min-w-[400px] flex-shrink-0 snap-center h-full">
              <DroppableColumn
                {...col}
                tasks={tasks.filter(t => t.status === col.status)}
                users={users}
                onCardClick={(t, tab) => {
                  setSelectedTask(t);
                  // If tab passed 'comments', we could handle that in TaskDetailView props, or just open modal
                }}
                onArchive={handleArchive}
                onQuickUpdate={onUpdateTask}
                onChat={setChatTask}
              />
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row">
            <div className="flex-1 p-8 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 overflow-y-auto max-h-[90vh]">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Create New Ticket</h2>
              <form onSubmit={handleCreateTask} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">Heading</label>
                  <input required type="text" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none text-slate-900 dark:text-white font-bold transition-all" placeholder="What needs to be done?" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                  <textarea value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} rows={3} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none text-slate-900 dark:text-white transition-all" placeholder="Provide more details..." />
                </div>

                {/* Attachments Upload */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Attachments</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center justify-center px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors gap-2 group">
                      <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200">Choose Files</span>
                      <input type="file" multiple className="hidden" onChange={e => e.target.files && setNewAttachments([...newAttachments, ...Array.from(e.target.files)])} />
                    </label>
                    <div className="flex gap-2 overflow-x-auto p-1">
                      {newAttachments.map((file, idx) => (
                        <div key={idx} className="relative group">
                          <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-[9px] font-black text-orange-600 truncate px-1">
                            {file.name.split('.').pop()}
                          </div>
                          <button type="button" onClick={() => setNewAttachments(newAttachments.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assignee</label>
                    <select value={newTask.assigneeId} onChange={e => setNewTask({ ...newTask, assigneeId: e.target.value })} className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl font-bold text-slate-900 dark:text-white outline-none cursor-pointer text-sm">
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Priority</label>
                    <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })} className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl font-bold text-slate-900 dark:text-white outline-none cursor-pointer text-sm">
                      <option value="low">🌱 Normal</option>
                      <option value="medium">⚡ Important</option>
                      <option value="high">🚨 Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Due Date</label>
                    <input
                      required
                      type="date"
                      value={newTask.dueDate}
                      onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-950 rounded-2xl font-bold text-slate-900 dark:text-white outline-none cursor-pointer text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black transition-all hover:bg-slate-200">Cancel</button>
                  <button type="submit" disabled={isUploading} className="flex-1 py-4 bg-orange-600 text-white rounded-2xl font-black shadow-lg shadow-orange-600/20 transition-all hover:bg-orange-700 disabled:opacity-70 disabled:cursor-wait">
                    {isUploading ? 'Uploading...' : 'Confirm Ticket'}
                  </button>
                </div>
              </form>
            </div>
            <div className="hidden md:flex flex-col w-[350px] bg-slate-50 dark:bg-slate-950 p-8 justify-center border-l border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black text-slate-400 mb-6 uppercase tracking-widest">Live Preview</h3>
              <TaskCard task={newTask} users={users} isPreview={true} />
              <p className="mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-tighter leading-relaxed text-center italic">
                Your team will see this ticket exactly as it appears above once confirmed.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <TaskDetailView
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          users={users}
          onUpdate={(t) => {
            onTaskModified(t);
            setSelectedTask(t);
          }}
        />
      )}
      <TicketChatModal
        isOpen={!!chatTask}
        onClose={() => setChatTask(null)}
        task={chatTask}
        user={currentUser}
        onUpdateTask={onTaskModified}
      />
    </DndContext>
  );
};

export default Dashboard;
