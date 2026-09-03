import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PlanProjectFolder, PlanProjectType, Task, PriorityLevel, TaskStatus } from '../types';
import { 
  toISODateString, 
  parse12HourToMinutes, 
  formatMinutesTo12Hour, 
  diffTimeInMinutes,
  getDayOfWeekFromDate,
  getTaskTitleClasses,
  isTaskInRunningSlot,
  isTaskPastDue,
  findSimultaneousTasks,
  formatDisplayDate
} from '../utils/timeUtils';
import { PlanProjectModal } from '../components/PlanProjectModal';
import { RescheduleModal } from '../components/RescheduleModal';
import { 
  Target, 
  Briefcase, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Hourglass, 
  Sparkles, 
  Layers, 
  Folder, 
  Edit2, 
  Trash2, 
  Play, 
  Pause, 
  ArrowRight, 
  TrendingUp, 
  X, 
  ChevronRight, 
  Zap, 
  Check, 
  Lock,
  Flame,
  BarChart3,
  CalendarDays,
  FolderPlus
} from 'lucide-react';

interface PlansProjectsViewProps {
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string, projectCode?: string, category?: string, planProjectId?: string) => void;
}

export const PlansProjectsView: React.FC<PlansProjectsViewProps> = ({ onOpenTaskModal }) => {
  const { 
    planProjects, 
    tasks, 
    deletePlanProject, 
    startTask, 
    pauseTask, 
    completeTask, 
    updateTask, 
    assignTaskToPlanProject,
    prioritySettings,
    categories,
    capacitySettings,
    rescheduleTask
  } = useApp();

  // Active Bar Tab: 'plan' | 'project'
  const [activeType, setActiveType] = useState<PlanProjectType>('plan');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'on_hold'>('all');
  
  // Folder Modal state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<PlanProjectFolder | null>(null);

  // Selected Folder for Deep-Dive Drawer
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [assignExistingModalOpen, setAssignExistingModalOpen] = useState(false);
  const [nowTime, setNowTime] = useState<Date>(new Date());
  const [reschedulingTask, setReschedulingTask] = useState<Task | null>(null);

  const todayStr = toISODateString(new Date());

  const handleConfirmReschedule = (taskToReschedule: Task, newDate: string, newStartTime: string, newEndTime: string, scope: 'single' | 'series' = 'single') => {
    if (taskToReschedule.recurrence && taskToReschedule.recurrence !== 'None' && scope === 'single') {
      rescheduleTask(taskToReschedule.id, newDate, newStartTime);
    } else {
      updateTask({
        ...taskToReschedule,
        taskDate: newDate,
        dayOfWeek: getDayOfWeekFromDate(newDate),
        startTime: newStartTime,
        endTime: newEndTime,
        status: 'Pending'
      });
    }
    setReschedulingTask(null);
  };

  // Filter folders by active bar (PLANS vs PROJECTS) and search/status
  const currentFolders = useMemo(() => {
    return planProjects.filter(folder => {
      if (folder.type !== activeType) return false;
      if (statusFilter !== 'all' && folder.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = folder.title.toLowerCase().includes(q);
        const matchCode = folder.code.toLowerCase().includes(q);
        const matchDesc = folder.description.toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchDesc) return false;
      }
      return true;
    }).sort((a, b) => a.endDate.localeCompare(b.endDate));
  }, [planProjects, activeType, statusFilter, searchQuery]);

  // Selected Folder Object
  const selectedFolder = useMemo(() => {
    return planProjects.find(p => p.id === selectedFolderId) || null;
  }, [planProjects, selectedFolderId]);

  // Tasks belonging to selected folder
  const folderTasks = useMemo(() => {
    if (!selectedFolderId) return [];
    return tasks.filter(t => t.planProjectId === selectedFolderId)
      .sort((a, b) => {
        if (a.taskDate !== b.taskDate) return a.taskDate.localeCompare(b.taskDate);
        return parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime);
      });
  }, [tasks, selectedFolderId]);

  // Available unassigned tasks that can be pulled into selected folder
  const unassignedTasks = useMemo(() => {
    if (!selectedFolderId) return [];
    return tasks.filter(t => !t.planProjectId && t.status !== 'Terminated');
  }, [tasks, selectedFolderId]);

  // Folder Metrics Calculation Helper
  const getFolderMetrics = (folder: PlanProjectFolder) => {
    const fTasks = tasks.filter(t => t.planProjectId === folder.id);
    const totalTasks = fTasks.length;
    const completedTasks = fTasks.filter(t => t.status === 'Done').length;
    const workingTasks = fTasks.filter(t => t.status === 'Working').length;
    const pendingTasks = fTasks.filter(t => t.status === 'Pending').length;
    const incompleteTasks = fTasks.filter(t => t.status === 'Incomplete').length;
    const remainingTasks = totalTasks - completedTasks;

    const totalAppointedMins = fTasks.reduce((sum, t) => sum + (t.appointedMinutes || 0), 0);
    const totalActualLoggedMins = fTasks.reduce((sum, t) => sum + (t.totalActualMinutes || 0), 0);
    const targetMins = folder.targetMinutes || (totalAppointedMins > 0 ? totalAppointedMins : 1800);

    const taskProgressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const timeProgressPercent = targetMins > 0 ? Math.min(100, Math.round((totalActualLoggedMins / targetMins) * 100)) : 0;

    // Deadline analysis
    const today = new Date();
    const endParts = folder.endDate.split('-').map(Number);
    const deadlineDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);
    const diffMs = deadlineDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isOverdue = daysRemaining < 0 && folder.status !== 'completed';
    const isDueSoon = daysRemaining >= 0 && daysRemaining <= 3 && folder.status !== 'completed';

    // Projected finish estimation:
    // If average daily throughput is estimated at remaining tasks / days
    const remainingMins = Math.max(0, totalAppointedMins - totalActualLoggedMins);
    let projectedFinishText = 'On schedule';
    if (completedTasks === totalTasks && totalTasks > 0) {
      projectedFinishText = 'Completed ✓';
    } else if (isOverdue) {
      projectedFinishText = `Overdue by ${Math.abs(daysRemaining)}d`;
    } else if (daysRemaining > 0) {
      const hoursLeft = Math.ceil(remainingMins / 60);
      projectedFinishText = `${daysRemaining}d left (${hoursLeft}h work remaining)`;
    }

    return {
      totalTasks,
      completedTasks,
      workingTasks,
      pendingTasks,
      incompleteTasks,
      remainingTasks,
      totalAppointedMins,
      totalActualLoggedMins,
      targetMins,
      taskProgressPercent,
      timeProgressPercent,
      daysRemaining,
      isOverdue,
      isDueSoon,
      projectedFinishText
    };
  };

  // Global Aggregate Metrics for the active bar (Plans or Projects)
  const barMetrics = useMemo(() => {
    const allBarFolders = planProjects.filter(p => p.type === activeType);
    const activeCount = allBarFolders.filter(p => p.status === 'active').length;
    const completedCount = allBarFolders.filter(p => p.status === 'completed').length;
    
    const allBarTasks = tasks.filter(t => allBarFolders.some(f => f.id === t.planProjectId));
    const totalTasks = allBarTasks.length;
    const completedTasks = allBarTasks.filter(t => t.status === 'Done').length;
    const totalPlannedMins = allBarTasks.reduce((acc, t) => acc + (t.appointedMinutes || 0), 0);
    const totalLoggedMins = allBarTasks.reduce((acc, t) => acc + (t.totalActualMinutes || 0), 0);

    return {
      totalFolders: allBarFolders.length,
      activeCount,
      completedCount,
      totalTasks,
      completedTasks,
      totalPlannedHours: Math.round(totalPlannedMins / 60),
      totalLoggedHours: Math.round(totalLoggedMins / 60),
      overallProgress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };
  }, [planProjects, activeType, tasks]);

  const handleOpenNewFolder = (typeToCreate: PlanProjectType) => {
    setEditingFolder(null);
    setIsFolderModalOpen(true);
  };

  const handleEditFolder = (folder: PlanProjectFolder, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingFolder(folder);
    setIsFolderModalOpen(true);
  };

  const handleDeleteFolder = (folder: PlanProjectFolder, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm(`Are you sure you want to delete "${folder.title}"? Associated tasks will remain in the system as unlinked.`)) {
      deletePlanProject(folder.id, false);
      if (selectedFolderId === folder.id) {
        setSelectedFolderId(null);
      }
    }
  };

  const handleCreateTaskForFolder = (folder: PlanProjectFolder) => {
    onOpenTaskModal(undefined, folder.startDate || todayStr, undefined, folder.code, folder.category, folder.id);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* Top Header Protocol & Dual-Bar Switcher */}
      <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-theme-border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Left Title & Subtitle */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-theme-text font-display flex items-center gap-2">
                <span>Planning & Projects Hub</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  Task Groups
                </span>
              </h2>
              <p className="text-xs text-theme-muted">
                Deadline-driven containers with strict start-to-end milestone tracking and live minute budgets.
              </p>
            </div>
          </div>
        </div>

        {/* Right Primary Action & Add Button */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => handleOpenNewFolder(activeType)}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-2xl shadow-md shadow-blue-500/20 transition-all transform active:scale-95"
          >
            <FolderPlus className="w-4 h-4" />
            <span>New {activeType === 'plan' ? 'Plan Folder' : 'Project Folder'}</span>
          </button>
        </div>

      </div>

      {/* DUAL BAR NAVIGATION: PLANS | PROJECTS */}
      <div className="grid grid-cols-2 gap-3 p-1.5 bg-theme-card-hover rounded-2xl border border-theme-border shadow-inner">
        <button
          type="button"
          onClick={() => {
            setActiveType('plan');
            setSelectedFolderId(null);
          }}
          className={`py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2.5 ${
            activeType === 'plan'
              ? 'bg-theme-card text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-blue-500/30'
              : 'text-theme-muted hover:text-theme-text hover:bg-theme-card/40'
          }`}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            activeType === 'plan' ? 'bg-blue-600 text-white' : 'bg-theme-card text-theme-muted'
          }`}>
            <Target className="w-4 h-4" />
          </div>
          <div className="text-left">
            <div className="font-display">PLANS BAR</div>
            <div className="text-[10px] text-theme-muted font-normal font-sans hidden sm:block">
              Strategic Roadmaps, Habits, Goals & Sprints
            </div>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 ml-auto">
            {planProjects.filter(p => p.type === 'plan').length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveType('project');
            setSelectedFolderId(null);
          }}
          className={`py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2.5 ${
            activeType === 'project'
              ? 'bg-theme-card text-purple-600 dark:text-purple-400 shadow-md ring-1 ring-purple-500/30'
              : 'text-theme-muted hover:text-theme-text hover:bg-theme-card/40'
          }`}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            activeType === 'project' ? 'bg-purple-600 text-white' : 'bg-theme-card text-theme-muted'
          }`}>
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="text-left">
            <div className="font-display">PROJECTS BAR</div>
            <div className="text-[10px] text-theme-muted font-normal font-sans hidden sm:block">
              Deliverables, Software Builds & Milestones
            </div>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 ml-auto">
            {planProjects.filter(p => p.type === 'project').length}
          </span>
        </button>
      </div>

      {/* Aggregate Bar Metrics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-panel p-3.5 rounded-2xl border border-theme-border space-y-1">
          <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block">
            {activeType === 'plan' ? 'Active Plans' : 'Active Projects'}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-theme-text font-display">
              {barMetrics.activeCount}
            </span>
            <span className="text-xs text-theme-muted font-mono">
              / {barMetrics.totalFolders} total
            </span>
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl border border-theme-border space-y-1">
          <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block">
            Tasks Grouped
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-display">
              {barMetrics.totalTasks}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
              ({barMetrics.completedTasks} Done)
            </span>
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl border border-theme-border space-y-1">
          <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block">
            Logged vs Planned
          </span>
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">
              {barMetrics.totalLoggedHours}h
            </span>
            <span className="text-xs text-theme-muted font-bold">
              / {barMetrics.totalPlannedHours}h planned
            </span>
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl border border-theme-border space-y-1">
          <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block">
            Overall Completion
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display">
              {barMetrics.overallProgress}%
            </span>
            <div className="w-16 bg-theme-card-hover h-2 rounded-full overflow-hidden self-center border border-theme-border">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${barMetrics.overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-theme-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={`Search ${activeType === 'plan' ? 'plans' : 'projects'} by name, code...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
          {(['all', 'active', 'on_hold', 'completed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-all border shrink-0 ${
                statusFilter === st
                  ? 'bg-theme-card text-theme-text border-blue-500 shadow-sm'
                  : 'bg-theme-card-hover text-theme-muted border-theme-border hover:text-theme-text'
              }`}
            >
              {st === 'all' ? 'All Statuses' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Folders List & Deep-Dive Drawer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns: Folder Cards Grid */}
        <div className={`${selectedFolder ? 'lg:col-span-1' : 'lg:col-span-3'} space-y-4`}>
          {currentFolders.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 mx-auto flex items-center justify-center">
                {activeType === 'plan' ? <Target className="w-6 h-6" /> : <Briefcase className="w-6 h-6" />}
              </div>
              <h4 className="text-base font-black text-theme-text font-display">
                No {activeType === 'plan' ? 'Plan' : 'Project'} Folders Found
              </h4>
              <p className="text-xs text-theme-muted max-w-sm mx-auto">
                Create a folder container to group related tasks under a strict start-to-end deadline with minute-level time tracking.
              </p>
              <button
                onClick={() => handleOpenNewFolder(activeType)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition-all"
              >
                + Create First {activeType === 'plan' ? 'Plan' : 'Project'} Folder
              </button>
            </div>
          ) : (
            <div className={`grid gap-4 ${selectedFolder ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
              {currentFolders.map((folder) => {
                const metrics = getFolderMetrics(folder);
                const isSelected = selectedFolderId === folder.id;

                return (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`glass-panel p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between gap-4 relative group ${
                      isSelected
                        ? 'border-blue-500 shadow-xl shadow-blue-500/15 ring-2 ring-blue-500/50 bg-blue-50/10 dark:bg-blue-950/20'
                        : 'border-theme-border hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg'
                    }`}
                  >
                    {/* Header Bar: Type, Code, Category, Actions */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0"
                            style={{ backgroundColor: folder.color || '#3B82F6' }}
                          >
                            {folder.type === 'plan' ? <Target className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                              {folder.code}
                            </span>
                            <span className="text-[10px] text-theme-muted font-medium ml-1.5">
                              {folder.category}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge & Actions */}
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize font-mono ${
                            folder.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                              : folder.status === 'on_hold'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300'
                          }`}>
                            {folder.status.replace('_', ' ')}
                          </span>

                          <button
                            onClick={(e) => handleEditFolder(folder, e)}
                            className="p-1 rounded-lg hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
                            title="Edit Folder"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteFolder(folder, e)}
                            className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors"
                            title="Delete Folder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Folder Title & Description */}
                      <div>
                        <h3 className="text-base font-black text-theme-text font-display group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {folder.title}
                        </h3>
                        {folder.description && (
                          <p className="text-xs text-theme-muted line-clamp-2 mt-0.5">
                            {folder.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Timeline & Strict Deadline Countdown Section */}
                    <div className="p-3 rounded-2xl bg-theme-card-hover border border-theme-border/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-theme-muted flex items-center gap-1 font-mono font-medium">
                          <Calendar className="w-3.5 h-3.5 text-blue-500" />
                          <span>{folder.startDate} → {folder.endDate}</span>
                        </span>
                        
                        <span className={`font-mono font-bold px-2 py-0.5 rounded-full text-[10px] ${
                          metrics.isOverdue
                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 animate-pulse'
                            : metrics.isDueSoon
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {metrics.isOverdue ? `🚨 ${Math.abs(metrics.daysRemaining)}d Overdue` : `⏳ ${metrics.daysRemaining}d left`}
                        </span>
                      </div>

                      {/* Progress Bar by Task & Minutes */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-theme-text font-bold">
                            Progress: {metrics.completedTasks}/{metrics.totalTasks} Tasks ({metrics.taskProgressPercent}%)
                          </span>
                          <span className="text-blue-600 dark:text-blue-400 font-bold">
                            {Math.round(metrics.totalActualLoggedMins / 60)}h logged / {Math.round(metrics.targetMins / 60)}h budget
                          </span>
                        </div>
                        <div className="w-full bg-theme-card h-2 rounded-full overflow-hidden border border-theme-border">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all"
                            style={{ width: `${metrics.taskProgressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Status Metrics & Folder Open CTA */}
                    <div className="flex items-center justify-between pt-1 border-t border-theme-border/60 text-xs">
                      <div className="text-[10px] text-theme-muted font-medium">
                        Forecast: <strong className="text-theme-text">{metrics.projectedFinishText}</strong>
                      </div>

                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-xs">
                        <span>Open Folder</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 2 Columns: Folder Deep-Dive Drawer & Task Manager */}
        {selectedFolder && (
          <div className="lg:col-span-2 glass-panel p-5 sm:p-6 rounded-3xl border-2 border-blue-500/50 shadow-2xl space-y-4 animate-slide-up flex flex-col max-h-[85vh]">
            
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-theme-border pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                  style={{ backgroundColor: selectedFolder.color || '#3B82F6' }}
                >
                  {selectedFolder.type === 'plan' ? <Target className="w-6 h-6" /> : <Briefcase className="w-6 h-6" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                      {selectedFolder.code}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      {selectedFolder.type.toUpperCase()} FOLDER
                    </span>
                    <span className="text-xs text-theme-muted font-semibold">
                      {selectedFolder.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-theme-text font-display truncate">
                    {selectedFolder.title}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setSelectedFolderId(null)}
                className="p-1.5 rounded-xl hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
                title="Close Folder Drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Folder Time-Box & Workload Tracker Box */}
            {(() => {
              const metrics = getFolderMetrics(selectedFolder);
              return (
                <div className="p-4 rounded-2xl bg-theme-card-hover border border-theme-border space-y-2 shrink-0">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-theme-text flex items-center gap-1.5">
                      <Hourglass className="w-4 h-4 text-blue-500" />
                      <span>Workload & Burn-Down Tracker</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                      {metrics.remainingTasks} tasks remaining
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center pt-1 font-mono text-xs">
                    <div className="p-2 rounded-xl bg-theme-card border border-theme-border">
                      <div className="text-[10px] text-theme-muted uppercase font-sans font-bold">Total Tasks</div>
                      <div className="font-black text-sm text-theme-text">{metrics.totalTasks}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-theme-card border border-theme-border">
                      <div className="text-[10px] text-theme-muted uppercase font-sans font-bold">Completed</div>
                      <div className="font-black text-sm text-emerald-600">{metrics.completedTasks}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-theme-card border border-theme-border">
                      <div className="text-[10px] text-theme-muted uppercase font-sans font-bold">Time Spent</div>
                      <div className="font-black text-sm text-blue-600">{Math.round(metrics.totalActualLoggedMins / 60)}h</div>
                    </div>
                    <div className="p-2 rounded-xl bg-theme-card border border-theme-border">
                      <div className="text-[10px] text-theme-muted uppercase font-sans font-bold">Target Budget</div>
                      <div className="font-black text-sm text-purple-600">{Math.round(metrics.targetMins / 60)}h</div>
                    </div>
                  </div>

                  <div className="text-xs text-theme-muted pt-1 flex items-center justify-between font-medium">
                    <span>Deadline Range: <strong className="text-theme-text">{selectedFolder.startDate} → {selectedFolder.endDate}</strong></span>
                    <span className={metrics.isOverdue ? 'text-red-500 font-bold' : 'text-emerald-600 font-bold'}>
                      {metrics.projectedFinishText}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Action Bar for Folder Tasks */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleCreateTaskForFolder(selectedFolder)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add Task to {selectedFolder.title}</span>
              </button>

              <button
                onClick={() => setAssignExistingModalOpen(true)}
                className="px-4 py-2.5 bg-theme-card-hover hover:bg-theme-border border border-theme-border text-theme-text rounded-xl text-xs font-bold transition-colors shadow-xs"
                title="Pull existing tasks into this folder"
              >
                Link Tasks
              </button>
            </div>

            {/* Task List Inside Folder - Aligned Chronologically from Recent to Far Bottom */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="text-xs font-bold text-theme-muted uppercase tracking-wider flex items-center justify-between border-b border-theme-border pb-2">
                <span>Tasks in this Folder ({folderTasks.length}) • Chronologically Ordered</span>
                <span className="font-mono text-xs text-theme-text font-bold">
                  {folderTasks.filter(t => t.status === 'Done').length}/{folderTasks.length} Completed
                </span>
              </div>

              {folderTasks.length === 0 ? (
                <div className="p-12 text-center rounded-3xl border border-dashed border-theme-border text-theme-muted space-y-3 my-4">
                  <Folder className="w-10 h-10 mx-auto opacity-40 text-blue-500" />
                  <p className="text-sm font-bold text-theme-text">No Tasks in this folder yet</p>
                  <p className="text-xs">Click "+ Add Task" or link existing tasks above to group them under this {selectedFolder.type}.</p>
                  <button
                    onClick={() => handleCreateTaskForFolder(selectedFolder)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Create First Task for this {selectedFolder.type === 'plan' ? 'Plan' : 'Project'}</span>
                  </button>
                </div>
              ) : (
                folderTasks.map((task) => {
                  const priorityMeta = prioritySettings[task.priority];
                  const isDone = task.status === 'Done';
                  const isWorking = task.status === 'Working';
                  const isRunning = isTaskInRunningSlot(task.taskDate, task.startTime, task.endTime);
                  const isDue = isTaskPastDue(task.taskDate, task.startTime, task.endTime, nowTime);
                  const simultaneousList = findSimultaneousTasks(task, tasks);
                  const isSimultaneous = simultaneousList.length > 0;

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-2xl border transition-all duration-200 ${
                        isDue
                          ? 'bg-red-50/30 dark:bg-red-950/20 border-red-300 dark:border-red-900/60 shadow-sm'
                          : isRunning
                            ? 'bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-theme-card dark:from-blue-950/60 dark:via-sky-950/30 dark:to-theme-card border-blue-500 shadow-xl shadow-blue-500/20 ring-2 ring-blue-500/60'
                            : isSimultaneous
                              ? 'bg-purple-50/20 dark:bg-purple-950/10 border-purple-300 dark:border-purple-800 hover:shadow-md'
                              : 'bg-theme-card border-theme-border hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        
                        {/* Left: Priority + Time + Title */}
                        <div className="flex items-start gap-3 flex-1">
                          
                          {/* Priority Badge */}
                          <div
                            className={`px-2.5 py-1.5 rounded-xl text-center font-black text-xs sm:text-sm min-w-[48px] shrink-0 flex items-center justify-center transition-all ${
                              task.priority === 'P1'
                                ? 'bg-gradient-to-tr from-rose-600 via-red-500 to-amber-400 text-white shadow-lg shadow-red-500/50 ring-2 ring-red-400/80 border border-red-300 dark:border-red-400 animate-pulse font-display'
                                : 'font-mono'
                            }`}
                            style={task.priority === 'P1' ? undefined : { backgroundColor: priorityMeta?.bgColor, color: priorityMeta?.color }}
                          >
                            {task.priority === 'P1' ? (
                              <span className="flex items-center gap-0.5 tracking-tight font-black">
                                <Sparkles className="w-3 h-3 text-yellow-200 fill-yellow-200" />
                                <span>P1</span>
                              </span>
                            ) : (
                              <span>{task.priority}</span>
                            )}
                          </div>

                          <div className="space-y-1 flex-1 min-w-0">
                            
                            {/* Tags & Time */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-theme-muted flex items-center gap-1 font-mono font-semibold text-xs">
                                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                {formatDisplayDate(task.taskDate)} ({getDayOfWeekFromDate(task.taskDate).slice(0, 3)})
                              </span>

                              <span className="font-mono text-xs font-bold text-theme-text bg-theme-card-hover px-2 py-0.5 rounded border border-theme-border">
                                {task.startTime} - {task.endTime}
                              </span>
                              
                              <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold">
                                {task.projectCode}
                              </span>

                              <span className="text-[11px] font-semibold text-theme-muted">
                                {task.category}
                                {task.subCategory ? ` / ${task.subCategory}` : ''}
                              </span>

                              {/* Mandatory / Fixed Schedule Badge */}
                              {task.isMandatorySchedule && (
                                <span 
                                  className="text-[10px] font-black px-2 py-0.5 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 rounded-full flex items-center gap-1 shadow-sm"
                                  title="Mandatory Fixed Schedule: Cannot be rescheduled, auto-shifted, or displaced"
                                >
                                  <Lock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                  <span>MANDATORY FIXED</span>
                                </span>
                              )}

                              {/* Simultaneous / Overlapped Signal Badge */}
                              {isSimultaneous && (
                                <span 
                                  className="text-[10px] font-black px-2 py-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full flex items-center gap-1 shadow-sm shadow-purple-500/20"
                                  title={`Co-running simultaneously with: ${simultaneousList.map(s => `${s.projectCode} (${s.title})`).join(', ')}`}
                                >
                                  <Zap className="w-2.5 h-2.5 text-yellow-300" />
                                  <span>🔀 SIMULTANEOUS ({simultaneousList.length})</span>
                                </span>
                              )}

                              {/* Running Time Blue Lighting Badge */}
                              {isRunning && !isDue && (
                                <span className="text-[10px] font-black px-2 py-0.5 bg-blue-600 text-white rounded-full flex items-center gap-1.5 shadow-md shadow-blue-500/40">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-200 opacity-90"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                  </span>
                                  <span>{isWorking ? '⚡ RUNNING NOW' : '⚡ RUNNING TIME'}</span>
                                </span>
                              )}

                              {/* Due Red Sign */}
                              {isDue && (
                                <span className="text-[10px] font-black px-2 py-0.5 bg-red-600 text-white rounded-full flex items-center gap-1.5 shadow-sm animate-pulse">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                  </span>
                                  <span>{isWorking ? '⚡ OVERTIME DUE' : '🚨 DUE NOW'}</span>
                                </span>
                              )}
                            </div>

                            {/* Task Title + Appointed Duration Inline */}
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <h4 className={getTaskTitleClasses(task.title, task.status === 'Done')}>
                                {task.title}
                              </h4>
                              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/60 shadow-2xs">
                                ~{task.appointedMinutes}m
                              </span>
                            </div>

                            {/* Subtask Summary if any */}
                            {task.subtasks && task.subtasks.length > 0 && (
                              <div className="flex items-center gap-1 text-[10px] text-theme-muted pt-0.5">
                                <Layers className="w-3 h-3 text-blue-500" />
                                <span>{task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length} subtasks finished</span>
                              </div>
                            )}

                          </div>
                        </div>

                        {/* Right: Actions & Status Control */}
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-theme-border shrink-0">
                          
                          {/* Status Dropdown */}
                          <select
                            value={task.status}
                            onChange={(e) => {
                              const newSt = e.target.value as TaskStatus;
                              if (newSt === 'Reschedule') {
                                if (task.isMandatorySchedule) {
                                  alert(`🔒 Mandatory Schedule: "${task.title}" is a locked fixed event and cannot be rescheduled.`);
                                  return;
                                }
                                setReschedulingTask(task);
                                return;
                              }
                              if (newSt === 'Done') completeTask(task.id);
                              else if (newSt === 'Working') startTask(task.id);
                              else if (newSt === 'Hold') pauseTask(task.id);
                              else updateTask({ ...task, status: newSt });
                            }}
                            className={`text-[10px] font-bold px-2 py-1 rounded-full border cursor-pointer focus:outline-none transition-colors ${
                              task.status === 'Done' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' :
                              task.status === 'Terminated' ? 'bg-red-600 text-white border-red-600 shadow-sm' :
                              task.status === 'Working' ? 'bg-blue-600 text-white border-blue-600 shadow-sm animate-pulse' :
                              task.status === 'Hold' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200' :
                              task.status === 'Incomplete' ? 'bg-red-600 text-white border-red-600 shadow-sm' :
                              task.status === 'Reschedule' ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-200' :
                              'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            <option value="Pending">● Pending</option>
                            <option value="Working">⚡ Working</option>
                            <option value="Hold">⏸ Hold</option>
                            <option value="Done">✓ Done</option>
                            <option value="Incomplete">⚠️ Incomplete</option>
                            <option value="Reschedule">↻ Reschedule</option>
                            <option value="Terminated">✕ Terminated</option>
                          </select>

                          {/* Quick Execution Play / Pause */}
                          {!isDone && (
                            isWorking ? (
                              <button
                                onClick={() => pauseTask(task.id)}
                                className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all"
                                title="Pause Timer"
                              >
                                <Pause className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => startTask(task.id)}
                                className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
                                title="Start Working"
                              >
                                <Play className="w-3.5 h-3.5 fill-white" />
                              </button>
                            )
                          )}

                          {/* Complete Action */}
                          {!isDone ? (
                            <button
                              onClick={() => completeTask(task.id)}
                              className="p-2 rounded-xl bg-theme-card-hover hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-theme-border text-theme-muted transition-all"
                              title="Mark Done"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          ) : (
                            <button
                              onClick={() => updateTask({ ...task, status: 'Pending' })}
                              className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 transition-all"
                              title="Reopen Task"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit Modal */}
                          <button
                            onClick={() => onOpenTaskModal(task)}
                            className="p-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-muted hover:text-theme-text transition-all"
                            title="Edit Task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Unlink from folder */}
                          <button
                            onClick={() => assignTaskToPlanProject(task.id, undefined)}
                            className="p-2 rounded-xl bg-theme-card-hover hover:bg-red-50 dark:hover:bg-red-950/40 border border-theme-border text-theme-muted hover:text-red-500 transition-all"
                            title="Unlink from this folder"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>

                        </div>

                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

      </div>

      {/* Plan / Project Folder Creation & Edit Modal */}
      {isFolderModalOpen && (
        <PlanProjectModal
          folderToEdit={editingFolder}
          initialType={activeType}
          onClose={() => setIsFolderModalOpen(false)}
        />
      )}

      {/* Link Existing Tasks Modal */}
      {assignExistingModalOpen && selectedFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-theme-card border border-theme-border rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-slide-up max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-theme-border pb-3">
              <div>
                <h3 className="text-base font-bold text-theme-text font-display">
                  Link Existing Tasks to "{selectedFolder.title}"
                </h3>
                <p className="text-xs text-theme-muted">
                  Click any unlinked task to assign it to this {selectedFolder.type}.
                </p>
              </div>
              <button
                onClick={() => setAssignExistingModalOpen(false)}
                className="p-1 rounded-lg hover:bg-theme-card-hover text-theme-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {unassignedTasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-theme-muted">
                  No unassigned tasks found. All active tasks already belong to a plan/project or create a new one!
                </div>
              ) : (
                unassignedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border border-theme-border hover:border-blue-400 bg-theme-card flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-theme-text truncate">
                        {t.title}
                      </div>
                      <div className="text-[10px] font-mono text-theme-muted">
                        [{t.projectCode}] • {formatDisplayDate(t.taskDate)} • {t.startTime} ({t.appointedMinutes}m)
                      </div>
                    </div>

                    <button
                      onClick={() => assignTaskToPlanProject(t.id, selectedFolder.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3 stroke-[3]" />
                      <span>Link</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-theme-border">
              <button
                onClick={() => setAssignExistingModalOpen(false)}
                className="px-4 py-2 bg-theme-card-hover hover:bg-theme-border text-xs font-bold text-theme-text rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intelligent Reschedule Modal */}
      {reschedulingTask && (
        <RescheduleModal
          task={reschedulingTask}
          allTasks={tasks}
          capacitySettings={capacitySettings}
          onConfirmReschedule={handleConfirmReschedule}
          onClose={() => setReschedulingTask(null)}
        />
      )}

    </div>
  );
};
