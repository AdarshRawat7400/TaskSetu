
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED'
}

export enum ReminderType {
  PERSONAL = 'PERSONAL',
  GROUP = 'GROUP'
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  phoneNumber?: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  members: string[];
  joinCode?: string;
  joinCodeUsage?: number;
  adminIds: string[];
  creatorId: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  details?: string;
}

export interface Comment {
  id: string;
  userId: string;
  content: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  creatorId: string;
  teamId: string;
  status: TaskStatus;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  attachments?: Attachment[];
  logs?: ActivityLog[];
  comments?: Comment[];
  reminderConfig?: {
    enabled: boolean;
    type: ReminderType;
    durationMinutes: number;
    whatsappBotEnabled: boolean;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
