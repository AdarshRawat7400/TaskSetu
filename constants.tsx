
import React from 'react';
import { User, Team, Task, TaskStatus, ReminderType } from './types';

export const MOCK_USERS: User[] = [];

export const MOCK_TEAMS: Team[] = [
  { id: 't1', name: 'General', description: 'General tasks', members: [] },
];

export const MOCK_TASKS: Task[] = [];

export const APP_THEME = {
  primary: 'orange-600', // Saffron touch
  secondary: 'teal-900', // Deep stability
  accent: 'yellow-500',  // Golden touch
  text: 'slate-900',
  muted: 'slate-500'
};
