
import React, { useState, useEffect, useMemo } from 'react';
import { User, Team, Task, TaskStatus, ActivityLog } from './types.ts';
import { MOCK_USERS, MOCK_TEAMS } from './constants.tsx';
import { firebaseService } from './services/firebaseService.ts';
import Sidebar from './components/Sidebar.tsx';
import Header from './components/Header.tsx';
import Dashboard from './components/Dashboard.tsx';
import AuthView from './components/AuthView.tsx';
import ChatBot from './components/ChatBot.tsx';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [knownUsers, setKnownUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>(MOCK_TEAMS);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(MOCK_TEAMS[0].id);
  const [isBotOpen, setIsBotOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');


  // 1. Initialize Auth Listener (Run Once)
  useEffect(() => {
    const unsubscribeAuth = firebaseService.onAuthChange((authUser) => {
      // Only set user if ID changed to avoid unnecessary re-renders
      setUser(prev => prev?.id === authUser?.id ? prev : authUser);

      if (authUser) {
        localStorage.setItem('tasksync_user', JSON.stringify(authUser));
      } else {
        localStorage.removeItem('tasksync_user');
      }
      setIsLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // 2. Initialize Theme (Run Once)
  useEffect(() => {
    const savedTheme = localStorage.getItem('tasksync_theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // 3. Fetch Data (Run when User Changes)
  useEffect(() => {
    if (!user) return;

    const fetchInitialData = async () => {
      // Force sync profile to ensure DB has record
      try {
        await firebaseService.syncUserProfile(user);
      } catch (e) {
        console.error("Profile sync failed", e);
      }

      // Teams
      try {
        const remoteTeams = await firebaseService.getTeams(user.id);

        // Always provide a Personal Workspace
        const localTeamId = `personal_${user.id}`;
        const personalTeam: Team = {
          id: localTeamId,
          name: 'Personal Workspace',
          description: 'My private tasks',
          members: [user.id],
          adminIds: [user.id],
          joinCode: '',
          creatorId: user.id
        };

        const allTeams = [personalTeam, ...remoteTeams];

        // Remove duplicates if any (though IDs should differ)
        const uniqueTeams = Array.from(new Map(allTeams.map(t => [t.id, t])).values());

        setTeams(uniqueTeams);

        // Auto-select: If previous active ID exists, keep it. Else default to Personal.
        setActiveTeamId(prev => {
          const exists = uniqueTeams.find(t => t.id === prev);
          return exists ? prev : localTeamId;
        });

      } catch (e) {
        console.error("Failed to load teams", e);
      }
    };

    fetchInitialData();
  }, [user]);

  // Fetch Tasks when Active Team Changes
  useEffect(() => {
    if (!activeTeamId) return;

    const fetchTeamTasks = async () => {
      try {
        setIsLoading(true); // Optional: show loading state between switches? Might be annoying. Maybe just keep old tasks until new ones load?
        // Actually, better to clear or show loading to avoid showing wrong team tasks momentarily if filteredTasks logic fails/lags (though filter logic is sync).
        // Since filteredTasks filters by ID, showing old tasks shouldn't happen if ID changed.

        const teamTasks = await firebaseService.getTasks(activeTeamId);
        setTasks(teamTasks);
      } catch (e) {
        console.error("Failed to load team tasks", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeamTasks();
  }, [activeTeamId]);

  // 4. Fetch Missing User Profiles
  useEffect(() => {
    if (!user || teams.length === 0) return;

    const fetchprofiles = async () => {
      // 1. Collect all unique member IDs from all teams
      const allMemberIds = new Set<string>();
      allMemberIds.add(user.id);
      teams.forEach(t => t.members.forEach(m => allMemberIds.add(m)));

      // 2. Filter out IDs we already know
      const existingIds = new Set(knownUsers.map(u => u.id));
      const missingIds = Array.from(allMemberIds).filter(id => !existingIds.has(id));

      if (missingIds.length === 0) return;

      // 3. Fetch missing profiles
      try {
        console.log('DEBUG: Fetching missing users...', missingIds);
        const fetchedUsers = await firebaseService.getUsersByIds(missingIds);
        console.log('DEBUG: Fetched users result:', fetchedUsers);

        if (fetchedUsers.length > 0) {
          setKnownUsers(prev => {
            const combined = [...prev, ...fetchedUsers];
            // Deduplicate just in case
            return Array.from(new Map(combined.map(u => [u.id, u])).values());
          });
        }
      } catch (e) {
        console.error("Failed to fetch user profiles", e);
      }
    };

    fetchprofiles();
  }, [user, teams]); // Intentionally verify only when teams or user changes. (knownUsers omitted to avoid loops if we get partials)

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        localStorage.setItem('tasksync_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem('tasksync_theme', 'light');
      }
      return next;
    });
  };

  const handleLogout = async () => {
    await firebaseService.signOutUser();
    setUser(null);
    setTeams(MOCK_TEAMS);
  };

  const addTask = async (task: Task) => {
    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user?.id || 'unknown',
      action: 'Created task',
      timestamp: new Date().toISOString(),
      details: `Initial status: ${task.status}`
    };
    const taskWithLog = { ...task, logs: [log] };
    const updated = [taskWithLog, ...tasks];
    setTasks(updated);
    await firebaseService.saveTask(taskWithLog);
  };

  const addTeam = async (team: Team) => {
    // Optimistic UI update
    setTeams(prev => [...prev, team]);
    setActiveTeamId(team.id);
    await firebaseService.saveTeam(team);
  };

  const handleJoinTeam = async (code: string) => {
    if (!user) return;
    try {
      const team = await firebaseService.joinTeamByCode(code, user.id);
      setTeams(prev => {
        // Update if exists (refresh), otherwise append
        const exists = prev.find(t => t.id === team.id);
        if (exists) {
          return prev.map(t => t.id === team.id ? team : t);
        }
        return [...prev, team];
      });
      setActiveTeamId(team.id);
      // alert(`Successfully joined team: ${team.name}`); // Removed as per request
    } catch (error: any) {
      alert(error.message || "Failed to join team");
    }
  };

  const handleUpdateTeam = async (updatedTeam: Team) => {
    setTeams(prev => prev.map(t => t.id === updatedTeam.id ? updatedTeam : t));
    await firebaseService.saveTeam(updatedTeam);
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user?.id || 'unknown',
      action: `Changed status from ${taskToUpdate.status} to ${status}`,
      timestamp: new Date().toISOString()
    };

    const updated = tasks.map(t => t.id === taskId ? { ...t, status, logs: [...(t.logs || []), log] } : t);
    setTasks(updated);
    const modified = updated.find(t => t.id === taskId);
    if (modified) await firebaseService.saveTask(modified);
  };

  const handleTaskModified = async (task: Task) => {
    const updated = tasks.map(t => t.id === task.id ? task : t);
    setTasks(updated);
    await firebaseService.saveTask(task);
  };

  const handleDeleteTask = async (taskId: string) => {
    // 1. Optimistic Update
    setTasks(prev => prev.filter(t => t.id !== taskId));
    // 2. Call API
    try {
      await firebaseService.deleteTask(taskId);
    } catch (e) {
      console.error("Failed to delete task", e);
      // Optional: Rollback state here if needed
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 1. Team Filter
      const matchesTeam = task.teamId === activeTeamId;
      if (!matchesTeam) return false;

      // 2. Search Filter (Enhanced)
      let matchesSearch = true;
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        // Resolve Assignee Name
        const assignee = knownUsers.find(u => u.id === task.assigneeId);
        const assigneeName = assignee ? assignee.name.toLowerCase() : '';

        matchesSearch =
          task.title.toLowerCase().includes(lowerTerm) ||
          task.description.toLowerCase().includes(lowerTerm) ||
          assigneeName.includes(lowerTerm) ||
          task.status.toLowerCase().includes(lowerTerm) ||
          task.priority.toLowerCase().includes(lowerTerm);
      }

      // 3. Advanced Filters
      const matchesStatus = filterStatus === '' || task.status === filterStatus;
      const matchesAssignee = filterAssignee === '' || task.assigneeId === filterAssignee;
      const matchesDate = filterDate === '' || (task.dueDate && task.dueDate <= filterDate);

      return matchesSearch && matchesStatus && matchesAssignee && matchesDate;
    });
  }, [tasks, activeTeamId, searchTerm, filterStatus, filterAssignee, filterDate, knownUsers]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Checking Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden transition-colors">
      <Sidebar
        teams={teams}
        activeTeamId={activeTeamId}
        setActiveTeamId={setActiveTeamId}
        user={user}
        allUsers={knownUsers.length > 0 ? knownUsers : [user]}
        onLogout={handleLogout}
        onAddTeam={addTeam}
        onJoinTeam={handleJoinTeam}
        onUpdateTeam={handleUpdateTeam}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          activeTeamName={teams.find(t => t.id === activeTeamId)?.name || 'General'}
          user={user}
          onOpenBot={() => setIsBotOpen(true)}
          isDarkMode={isDarkMode}
          onToggleTheme={toggleTheme}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          filterAssignee={filterAssignee}
          onFilterAssigneeChange={setFilterAssignee}
          filterDate={filterDate}
          onFilterDateChange={setFilterDate}
          users={knownUsers.length > 0 ? knownUsers : (user ? [user] : [])}
        />

        <main className="flex-1 overflow-hidden p-4 md:p-8 relative z-10 flex flex-col">
          <Dashboard
            tasks={filteredTasks}
            teamId={activeTeamId!}
            users={knownUsers.length > 0 ? knownUsers : (user ? [user] : [])}
            currentUser={user}
            onUpdateTask={updateTaskStatus}
            onAddTask={addTask}
            onTaskModified={handleTaskModified}
            onDeleteTask={handleDeleteTask}
          />
        </main>
      </div>

      <ChatBot isOpen={isBotOpen} onClose={() => setIsBotOpen(false)} tasks={filteredTasks} user={user} />
    </div>
  );
};

export default App;
