
import React, { useState } from 'react';
import { Team, User } from '../types';

interface TeamSettingsProps {
    team: Team;
    currentUser: User;
    allUsers: User[]; // In real app, this might be fetched or just members
    onUpdate: (team: Team) => void;
    onClose: () => void;
}

const TeamSettings: React.FC<TeamSettingsProps> = ({ team, currentUser, allUsers, onUpdate, onClose }) => {
    const isAdmin = team.adminIds?.includes(currentUser.id);
    const [name, setName] = useState(team.name);
    const [description, setDescription] = useState(team.description);

    // Resolve member objects from IDs for display
    // In this local mock/hybrid setup, we might only have the current user or a list of users
    // For now, we'll try to find them in allUsers, fallback to just ID if not found
    const members = team.members.map(mid =>
        allUsers.find(u => u.id === mid) || { id: mid, name: 'Unknown User', email: '', avatar: '' } as User
    );

    const handleSaveDetails = () => {
        onUpdate({ ...team, name, description });
    };

    const regenerateCode = () => {
        const newCode = Math.random().toString(36).substr(2, 6).toUpperCase();
        onUpdate({ ...team, joinCode: newCode, joinCodeUsage: 0 });
    };

    const toggleAdmin = (userId: string) => {
        const newAdminIds = team.adminIds.includes(userId)
            ? team.adminIds.filter(id => id !== userId)
            : [...team.adminIds, userId];

        onUpdate({
            ...team,
            adminIds: newAdminIds
        });
    };

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-2xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 flex flex-col max-h-[90vh]">

                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Team Details</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Manage {team.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
                    {/* 1. Basic Details */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">General Info</h3>
                            {isAdmin && (setName !== team.name || setDescription !== team.description) ? (
                                <button onClick={handleSaveDetails} className="text-xs font-bold text-orange-600 hover:text-orange-700">Save Changes</button>
                            ) : null}
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Name</label>
                                <input
                                    disabled={!isAdmin}
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-orange-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Description</label>
                                <textarea
                                    disabled={!isAdmin}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={3}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-orange-500 disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                                />
                            </div>
                        </div>
                    </section>

                    {/* 2. Joining Code */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Access Code</h3>
                        <div className="bg-slate-100 dark:bg-slate-950 p-6 rounded-2xl flex items-center justify-between border border-dashed border-slate-300 dark:border-slate-700">
                            <div>
                                <p className="text-xs text-slate-500 font-medium mb-1">Share this code to invite members:</p>
                                <p className="text-3xl font-black text-slate-800 dark:text-white tracking-[0.2em]">{team.joinCode || '----'}</p>
                                <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${(team.joinCodeUsage || 0) >= 3 ? 'text-red-500' : 'text-slate-400'}`}>
                                    Usage: {team.joinCodeUsage || 0}/3 uses
                                </p>
                            </div>
                            {isAdmin && (
                                <button
                                    onClick={regenerateCode}
                                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-sm hover:border-orange-500 transition-all active:scale-95"
                                >
                                    Regenerate
                                </button>
                            )}
                        </div>
                    </section>

                    {/* 3. Members */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Team Members ({members.length})</h3>
                        <div className="space-y-2">
                            {members.map(member => (
                                <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={member.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.id}`}
                                            onError={(e) => {
                                                e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.id}`;
                                                e.currentTarget.onerror = null; // Prevent infinite loop
                                            }}
                                            className="w-8 h-8 rounded-lg bg-white object-cover"
                                            alt={member.name}
                                        />
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                {member.name}
                                                {member.name === 'Unknown User' && <span className="text-[10px] text-red-500 font-mono">({member.id})</span>}
                                                {team.creatorId === member.id && (
                                                    <span className="text-[9px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-tighter">Owner</span>
                                                )}
                                                {team.adminIds.includes(member.id) && team.creatorId !== member.id && (
                                                    <span className="text-[9px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full uppercase tracking-tighter">Admin</span>
                                                )}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-medium">{member.email}</p>
                                        </div>
                                    </div>
                                    {isAdmin && member.id !== currentUser.id && member.id !== team.creatorId && (
                                        <button
                                            onClick={() => toggleAdmin(member.id)}
                                            className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition-colors ${team.adminIds.includes(member.id)
                                                ? 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10'
                                                : 'text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10'
                                                }`}
                                        >
                                            {team.adminIds.includes(member.id) ? 'Remove Admin' : 'Make Admin'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors">Close Details</button>
                </div>

            </div>
        </div>
    );
};

export default TeamSettings;
