
import React, { useState } from 'react';
import { Team, User } from '../types.ts';
import TeamSettings from './TeamSettings.tsx';

interface SidebarProps {
  teams: Team[];
  activeTeamId: string | null;
  setActiveTeamId: (id: string) => void;
  user: User;
  allUsers: User[];
  onLogout: () => void;
  onAddTeam: (team: Team) => void;
  onJoinTeam: (code: string) => void;
  onUpdateTeam: (team: Team) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ teams, activeTeamId, setActiveTeamId, user, allUsers, onLogout, onAddTeam, onJoinTeam, onUpdateTeam, isOpen = false, onClose }) => {
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([user.id]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const team: Team = {
      id: Math.random().toString(36).substr(2, 9),
      name: newTeamName,
      description: newTeamDesc || 'No description provided.',
      members: selectedMembers,
      adminIds: [user.id],
      creatorId: user.id,
      joinCode: Math.random().toString(36).substr(2, 6).toUpperCase(), // Generate 6-char code
      joinCodeUsage: 0
    };

    onAddTeam(team);
    resetForm();
    setIsTeamModalOpen(false);
  };

  const resetForm = () => {
    setNewTeamName('');
    setNewTeamDesc('');
    setSelectedMembers([user.id]);
  };

  const toggleMember = (userId: string) => {
    if (userId === user.id) return; // Cannot remove self
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed md:relative z-50 h-full
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        flex flex-col 
        ${isCollapsed ? 'w-20' : 'w-64'} 
        bg-slate-900 dark:bg-slate-950 text-slate-400 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out shadow-2xl md:shadow-none
      `}>
        <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} h-24`}>
          <div
            className={`flex items-center gap-3 ${isCollapsed ? 'cursor-pointer' : ''}`}
            onClick={() => isCollapsed && setIsCollapsed(false)}
            title={isCollapsed ? "Click to expand" : ""}
          >
            <div className="bg-orange-600 p-2 rounded-xl shadow-lg shadow-orange-900/20 shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </div>
            {!isCollapsed && (
              <span className="text-2xl font-black text-white tracking-tighter whitespace-nowrap overflow-hidden">TaskSetu</span>
            )}
          </div>
          {!isCollapsed && (
            <button onClick={() => setIsCollapsed(true)} className="p-1 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            </button>
          )}
        </div>



        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!isCollapsed ? (
            <div className="flex items-center justify-between px-3 mb-4">
              <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.2em] truncate">Active Teams</h3>
              <div className="flex gap-2">
                <button onClick={() => setIsTeamModalOpen(true)} className="text-slate-500 hover:text-orange-500 transition-colors" title="Create Team">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                </button>
                <button onClick={() => setIsJoinModalOpen(true)} className="text-slate-500 hover:text-emerald-500 transition-colors" title="Join a Team">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 items-center mb-4">
              <div className="h-px w-8 bg-slate-800"></div>
              <button onClick={() => setIsTeamModalOpen(true)} className="text-slate-500 hover:text-orange-500 transition-colors" title="Create Team">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          )}

          <nav className="space-y-1">
            {teams.map(team => (
              <div key={team.id} className="group relative">
                <button
                  onClick={() => setActiveTeamId(team.id)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 text-sm font-bold rounded-xl transition-all ${activeTeamId === team.id ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'hover:bg-white/5 hover:text-slate-200'
                    }`}
                  title={isCollapsed ? team.name : ""}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeTeamId === team.id ? 'bg-white' : 'bg-orange-600'}`}></div>

                  {!isCollapsed && (
                    <>
                      <div className="flex flex-col items-start min-w-0 flex-1">
                        <span className="truncate w-full text-left">{team.name}</span>
                        {team.joinCode && (
                          <span className={`text-[9px] font-mono tracking-wider ${activeTeamId === team.id ? 'text-white/80' : 'text-slate-500'}`}>
                            Code: {team.joinCode}
                          </span>
                        )}
                      </div>
                      <div
                        onClick={(e) => { e.stopPropagation(); setEditingTeam(team); }}
                        className="p-2 text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                        title="Team Settings"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                    </>
                  )}
                </button>
              </div>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/20">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer group`}>
            <div className="relative shrink-0">
              <img src={user.avatar} className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-800 group-hover:ring-orange-500 transition-all" alt={user.name} />
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{user.name}</p>
                  <p className="text-[10px] font-medium text-slate-500 truncate uppercase tracking-tighter">Enterprise</p>
                </div>
                <button onClick={onLogout} title="Logout" className="text-slate-600 hover:text-red-400 transition-colors p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals outside of sidebar container */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-2xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Create Team</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Srujan: Build your circle</p>
              </div>
              <button onClick={() => { setIsTeamModalOpen(false); resetForm(); }} className="text-slate-400 hover:text-orange-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2">Team Name</label>
                  <input
                    autoFocus
                    required
                    type="text"
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    placeholder="e.g. Pune Operations"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none text-slate-900 dark:text-white font-bold transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                  <textarea
                    value={newTeamDesc}
                    onChange={e => setNewTeamDesc(e.target.value)}
                    rows={4}
                    placeholder="What is this team's focus?"
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none text-slate-900 dark:text-white font-medium transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Members</label>
                <div className="flex-1 px-3 py-2 overflow-y-auto space-y-8 custom-scrollbar overflow-x-hidden bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {allUsers.map(u => (
                    <div
                      key={u.id}
                      onClick={() => toggleMember(u.id)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${selectedMembers.includes(u.id)
                        ? 'bg-white dark:bg-slate-700 border-orange-200 dark:border-orange-900 shadow-sm'
                        : 'border-transparent hover:bg-white dark:hover:bg-slate-700'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <img src={u.avatar} className="w-8 h-8 rounded-lg" alt={u.name} />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{u.name}</p>
                          <p className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">{u.email.split('@')[0]}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedMembers.includes(u.id) ? 'bg-orange-600 border-orange-600' : 'border-slate-300 dark:border-slate-600'
                        }`}>
                        {selectedMembers.includes(u.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 flex gap-4 pt-4">
                <button type="button" onClick={() => { setIsTeamModalOpen(false); resetForm(); }} className="flex-1 py-4 text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/30">Confirm & Launch Team</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isJoinModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95">
            <div className="text-center mb-6">
              <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Join a Team</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Enter code to sync</p>
            </div>

            <div className="space-y-6">
              <input
                autoFocus
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. X7Z9A2"
                className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none text-slate-900 dark:text-white font-black text-center text-2xl tracking-[0.5em] transition-all uppercase"
                maxLength={6}
              />

              <div className="flex gap-4">
                <button onClick={() => { setIsJoinModalOpen(false); setJoinCode(''); }} className="flex-1 py-4 text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">Cancel</button>
                <button
                  onClick={() => { onJoinTeam(joinCode); setIsJoinModalOpen(false); setJoinCode(''); }}
                  disabled={joinCode.length < 3}
                  className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingTeam && (
        <TeamSettings
          team={editingTeam}
          currentUser={user}
          allUsers={allUsers}
          onUpdate={(updated) => { onUpdateTeam(updated); setEditingTeam(updated); }}
          onClose={() => setEditingTeam(null)}
        />
      )}
    </>
  );
};

export default Sidebar;
