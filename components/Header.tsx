
import React, { useState } from 'react';
import { User, TaskStatus } from '../types.ts';
import { MOCK_USERS } from '../constants.tsx';

interface HeaderProps {
  activeTeamName: string;
  user: User;
  onOpenBot: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  filterStatus: string;
  onFilterStatusChange: (val: string) => void;
  filterAssignee: string;
  onFilterAssigneeChange: (val: string) => void;
  filterDate: string;
  onFilterDateChange: (val: string) => void;
  users: User[];
  onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({
  activeTeamName,
  user,
  onOpenBot,
  isDarkMode,
  onToggleTheme,
  searchTerm,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterAssignee,
  onFilterAssigneeChange,
  filterDate,
  onFilterDateChange,
  users,
  onToggleSidebar
}) => {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = filterStatus !== '' || filterAssignee !== '' || filterDate !== '';

  return (
    <header className="h-24 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 md:px-10 shrink-0 z-40 sticky top-0 transition-colors">
      <div className="flex items-center gap-6">
        <button onClick={onToggleSidebar} className="md:hidden text-slate-600 dark:text-slate-400 p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-orange-600 font-black text-xl">#</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {activeTeamName}
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.1em]">Namaste, Workspace Active</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden lg:flex relative">
          <div className="flex items-center bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus-within:border-orange-500 rounded-2xl transition-all shadow-sm">
            <span className="pl-4 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search tasks, members, status..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-3 pr-4 py-3 bg-transparent text-sm font-medium w-64 lg:w-80 outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 mr-2 rounded-xl transition-all relative ${showFilters ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {hasActiveFilters && !showFilters && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-600 border-2 border-white dark:border-slate-900 rounded-full"></span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="absolute top-full right-0 mt-3 w-72 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-5 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Advanced Filters</h4>
                <button
                  onClick={() => {
                    onFilterStatusChange('');
                    onFilterAssigneeChange('');
                    onFilterDateChange('');
                  }}
                  className="text-[9px] font-black text-orange-600 uppercase hover:underline"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1 italic">Filter by Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => onFilterStatusChange(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 p-2 rounded-xl outline-none text-slate-900 dark:text-slate-100"
                  >
                    <option value="">All Statuses</option>
                    {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1 italic">Filter by Assignee</label>
                  <select
                    value={filterAssignee}
                    onChange={(e) => onFilterAssigneeChange(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 p-2 rounded-xl outline-none text-slate-900 dark:text-slate-100"
                  >
                    <option value="">All Members</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1 italic">Due On or Before</label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => onFilterDateChange(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 p-2 rounded-xl outline-none text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 mx-2"></div>

        <button
          onClick={onToggleTheme}
          className="p-3 text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-xl transition-all"
        >
          {isDarkMode ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        <button
          onClick={onOpenBot}
          className="flex items-center gap-3 px-5 py-3 bg-teal-900 text-white rounded-2xl hover:shadow-lg transition-all active:scale-95 font-bold text-sm"
        >
          <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
          <span className="hidden sm:inline">Ask Saathi</span>
        </button>

        <div className="hidden sm:flex items-center gap-4 ml-2 cursor-pointer group">
          <img src={user.avatar} className="w-10 h-10 rounded-2xl border-2 border-slate-100 dark:border-slate-700 shadow-sm group-hover:border-orange-500 transition-all" alt={user.name} />
        </div>
      </div>
    </header>
  );
};

export default Header;
