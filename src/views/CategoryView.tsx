import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Task, Category, PriorityLevel, TaskStatus } from '../types';
import { 
  FolderKanban, 
  Tag, 
  CheckCircle2, 
  Clock, 
  Play, 
  Pause,
  Plus, 
  Layers, 
  Sparkles,
  Zap,
  User,
  Cpu,
  Globe,
  Briefcase,
  BookOpen,
  Bell,
  FileText,
  HelpCircle,
  Edit2,
  Trash2,
  RotateCcw,
  Lock,
  Moon,
  Hourglass,
  Timer,
  Check,
  Calendar,
  Search,
  SlidersHorizontal,
  Filter,
  LayoutList,
  LayoutGrid,
  Folder,
  CalendarDays,
  X
} from 'lucide-react';
import { 
  toISODateString, 
  parse12HourToMinutes, 
  isTaskInRunningSlot,
  isTaskPastDue,
  findSimultaneousTasks,
  getDayOfWeekFromDate,
  getTaskTitleClasses,
  isTaskInSleepWindow,
  formatDisplayDate
} from '../utils/timeUtils';
import { RescheduleModal } from '../components/RescheduleModal';

type TimeRangeFilter = 'ALL' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'NEXT_WEEK';
type DensityMode = 'compact' | 'expanded';

interface CategoryViewProps {
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string, projectCode?: string, category?: string) => void;
}

const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'Zap': return Zap;
    case 'User': return User;
    case 'Cpu': return Cpu;
    case 'Globe': return Globe;
    case 'Briefcase': return Briefcase;
    case 'BookOpen': return BookOpen;
    case 'Bell': return Bell;
    case 'FileText': return FileText;
    default: return FolderKanban;
  }
};

export const CategoryView: React.FC<CategoryViewProps> = ({ onOpenTaskModal }) => {
  const { 
    categories, 
    tasks, 
    capacitySettings,
    prioritySettings, 
    startTask, 
    pauseTask,
    completeTask, 
    updateTask,
    rescheduleTask,
    requestDeleteTask 
  } = useApp();

  const [selectedCatId, setSelectedCatId] = useState<string>(categories[0]?.id || '');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('ALL');
  
  // Filter & Search Controls (Matching AllTasksView)
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [densityMode, setDensityMode] = useState<DensityMode>('compact');
  const [reschedulingTask, setReschedulingTask] = useState<Task | null>(null);
  const [nowTime, setNowTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentCategory = categories.find(c => c.id === selectedCatId) || categories[0];

  const handleStatusChange = (task: Task, newStatus: TaskStatus) => {
    if (newStatus === 'Reschedule') {
      if (task.isMandatorySchedule) {
        alert(`🔒 Mandatory Schedule: "${task.title}" is a locked fixed event and cannot be rescheduled.`);
        return;
      }
      setReschedulingTask(task);
      return;
    }
    updateTask({ ...task, status: newStatus });
  };

  const handleConfirmReschedule = (taskToReschedule: Task, newDate: string, newStartTime: string, newEndTime: string, scope: 'single' | 'series' = 'single') => {
    if (taskToReschedule.recurrence && taskToReschedule.recurrence !== 'None') {
      rescheduleTask(taskToReschedule.id, newDate, newStartTime, taskToReschedule.taskDate, scope);
    } else {
      updateTask({
        ...taskToReschedule,
        taskDate: newDate,
        dayOfWeek: getDayOfWeekFromDate(newDate),
        startTime: newStartTime,
        endTime: newEndTime,
        status: 'Pending',
        isSimultaneous: false,
        simultaneousWithIds: [],
        rescheduleCount: (taskToReschedule.rescheduleCount || 0) + 1,
        lastRescheduledAt: new Date().toISOString(),
        originalScheduledDate: newDate,
        originalScheduledStartTime: newStartTime,
        originalScheduledEndTime: newEndTime,
        startDiscrepancyMinutes: 0
      });
    }
    setReschedulingTask(null);
  };

  const filterByTimeRange = (task: Task, range: TimeRangeFilter): boolean => {
    if (range === 'ALL') return true;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayIso = toISODateString(today);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = toISODateString(tomorrow);

    const dayOfWeek = today.getDay();
    const daysUntilEndOfWeek = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + daysUntilEndOfWeek);
    const endOfWeekIso = toISODateString(endOfWeek);

    const nextWeekStart = new Date(endOfWeek);
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);
    const nextWeekStartIso = toISODateString(nextWeekStart);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
    const nextWeekEndIso = toISODateString(nextWeekEnd);

    if (range === 'TODAY') return task.taskDate === todayIso;
    if (range === 'TOMORROW') return task.taskDate === tomorrowIso;
    if (range === 'THIS_WEEK') return task.taskDate >= todayIso && task.taskDate <= endOfWeekIso;
    if (range === 'NEXT_WEEK') return task.taskDate >= nextWeekStartIso && task.taskDate <= nextWeekEndIso;
    return true;
  };

  if (!currentCategory) {
    return <div className="p-8 text-center text-theme-muted font-bold">No categories found.</div>;
  }

  // All tasks in this category
  const allCategoryTasks = useMemo(() => {
    return tasks.filter(t => t.category === currentCategory.name);
  }, [tasks, currentCategory.name]);

  // Filtered tasks for display
  const filteredCategoryTasks = useMemo(() => {
    return allCategoryTasks.filter(t => {
      // Subcategory
      if (selectedSubCat !== 'ALL' && t.subCategory !== selectedSubCat) return false;
      // Status
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
      // Priority
      if (selectedPriority !== 'ALL' && t.priority !== selectedPriority) return false;
      // Time Horizon
      if (!filterByTimeRange(t, timeRange)) return false;
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchCode = t.projectCode?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchSub = t.subCategory?.toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchDesc && !matchSub) return false;
      }
      return true;
    }).sort((a, b) => {
      // Chronological sort: Date first, then time
      if (a.taskDate !== b.taskDate) return a.taskDate.localeCompare(b.taskDate);
      return parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime);
    });
  }, [allCategoryTasks, selectedSubCat, selectedStatus, selectedPriority, timeRange, searchQuery]);

  // Metrics
  const totalTasksCount = allCategoryTasks.length;
  const completedCount = allCategoryTasks.filter(t => t.status === 'Done').length;
  const workingCount = allCategoryTasks.filter(t => t.status === 'Working').length;
  const pendingCount = allCategoryTasks.filter(t => t.status === 'Pending').length;
  const remainingCount = totalTasksCount - completedCount;
  const totalMinutes = allCategoryTasks.reduce((acc, t) => acc + (t.appointedMinutes || 0), 0);
  const totalLoggedMinutes = allCategoryTasks.reduce((acc, t) => acc + (t.totalActualMinutes || 0), 0);
  const taskProgressPercent = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;
  const IconComponent = getCategoryIcon(currentCategory.iconName);

  // Compact Row Renderer (Identical to AllTasksView)
  const renderCompactTaskRow = (task: Task) => {
    const priorityMeta = prioritySettings[task.priority];
    const isWorking = task.status === 'Working';
    const isIncomplete = task.status === 'Incomplete';
    const isCurrentRunningSlot = isTaskInRunningSlot(task.taskDate, task.startTime, task.endTime, nowTime);
    const isRunning = isWorking || (task.status === 'Pending' && isCurrentRunningSlot);
    const isDue = isIncomplete || 
      (task.status === 'Pending' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, nowTime)) ||
      (task.status === 'Working' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, nowTime));
    const isSimultaneous = Boolean(task.isSimultaneous);
    const simultaneousList = isSimultaneous ? findSimultaneousTasks(task, tasks) : [];
    const isInSleep = isTaskInSleepWindow(task, capacitySettings);

    return (
      <div
        key={task.id}
        className={`px-3 py-2 rounded-2xl border transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-2 group ${
          isDue
            ? 'bg-red-50/40 dark:bg-red-950/30 border-red-300 dark:border-red-900/60 shadow-2xs hover:border-red-400'
            : isRunning
              ? isInSleep
                ? 'bg-slate-900 text-slate-100 dark:bg-slate-950 border-blue-500 shadow-md ring-1 ring-blue-500/80'
                : 'bg-gradient-to-r from-blue-50/90 via-sky-50/60 to-theme-card dark:from-blue-950/70 dark:via-sky-950/40 dark:to-theme-card border-blue-500 shadow-md ring-1 ring-blue-500/50'
              : isInSleep
              ? 'bg-slate-900/95 text-slate-100 dark:bg-slate-950 border-indigo-900/90 shadow-2xs'
              : isSimultaneous
                ? 'bg-purple-50/20 dark:bg-purple-950/10 border-purple-300 dark:border-purple-800/80 shadow-2xs'
                : 'bg-theme-card hover:bg-theme-card-hover border-theme-border shadow-2xs'
        }`}
      >
        {/* Left Core Data: Priority + Code + Title + Time + Badges */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap">
          {/* Status & Priority Badge */}
          <span 
            className="text-[11px] font-black px-2 py-0.5 rounded-lg shrink-0 font-mono shadow-2xs flex items-center gap-1"
            style={{ backgroundColor: priorityMeta.bgColor, color: priorityMeta.color }}
          >
            {task.priority === 'P1' && <Sparkles className="w-2.5 h-2.5 text-yellow-300 fill-yellow-300" />}
            <span>{task.priority}</span>
          </span>

          <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400 shrink-0">
            {task.projectCode}
          </span>

          <span className="font-mono text-xs font-semibold text-theme-muted bg-theme-card-hover px-1.5 py-0.5 rounded border border-theme-border shrink-0">
            {task.startTime} – {task.endTime}
          </span>

          <span className="text-xs font-bold text-theme-text truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {task.title}
          </span>

          {/* Sub-Category Badge */}
          {task.subCategory && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-theme-card-hover text-theme-muted border border-theme-border shrink-0">
              {task.subCategory}
            </span>
          )}

          {/* Signal / Flags Badges */}
          {task.isMandatorySchedule && (
            <span className="text-[9px] font-black px-1.5 py-0.2 bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded border border-amber-500/30 shrink-0 flex items-center gap-0.5" title="Mandatory Fixed Schedule">
              <Lock className="w-2.5 h-2.5 text-amber-500" /> FIXED
            </span>
          )}

          {isInSleep && (
            <span className="text-[9px] font-black px-1.5 py-0.2 bg-indigo-950 text-indigo-300 rounded border border-indigo-700 shrink-0" title="Scheduled in Sleep Window">
              🌙 SLEEP
            </span>
          )}

          {isSimultaneous && (
            <span className="text-[9px] font-black px-1.5 py-0.2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded shrink-0 shadow-2xs" title={simultaneousList.length > 0 ? `Simultaneous with ${simultaneousList.map(s => s.projectCode).join(', ')}` : 'Marked to run simultaneously in parallel'}>
              🔀 SIMUL{simultaneousList.length > 0 ? ` (${simultaneousList.length})` : ''}
            </span>
          )}

          {isRunning && !isDue && (
            <span className="text-[9px] font-black px-1.5 py-0.2 bg-blue-600 text-white rounded-full flex items-center gap-1 shrink-0 animate-pulse shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              <span>{isWorking ? 'RUNNING' : 'TIME NOW'}</span>
            </span>
          )}

          {isDue && (
            <span className="text-[9px] font-black px-1.5 py-0.2 bg-red-600 text-white rounded-full flex items-center gap-1 shrink-0 animate-pulse shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              <span>{isIncomplete ? 'INCOMPLETE' : 'DUE'}</span>
            </span>
          )}
        </div>

        {/* Right Actions: Status Dropdown + Live Timer + Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
          {/* Working Countdown Pill */}
          {isWorking && (() => {
            const lastLog = task.executionLogs?.[task.executionLogs.length - 1];
            const startMs = lastLog ? new Date(lastLog.startedAt).getTime() : nowTime.getTime();
            const elapsedSec = Math.max(0, Math.floor((nowTime.getTime() - startMs) / 1000));
            const totalAppointedSec = task.appointedMinutes * 60;
            const remainingSec = totalAppointedSec - elapsedSec;
            const isOvertime = remainingSec < 0;
            const absSec = Math.abs(remainingSec);
            const m = Math.floor(absSec / 60);
            const s = absSec % 60;
            const timeFormatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            return (
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs ${
                isOvertime ? 'bg-amber-400 text-amber-950 animate-pulse font-black' : 'bg-blue-600 text-white'
              }`}>
                <Hourglass className="w-2.5 h-2.5 animate-spin" />
                <span>{isOvertime ? `+${timeFormatted}` : timeFormatted}</span>
              </span>
            );
          })()}

          {/* Status Dropdown */}
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
            className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none transition-colors ${
              task.status === 'Done' ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' :
              task.status === 'Terminated' ? 'bg-red-600 text-white border-red-600 shadow-2xs' :
              task.status === 'Working' ? 'bg-blue-600 text-white border-blue-600 animate-pulse shadow-2xs' :
              task.status === 'Hold' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300' :
              task.status === 'Incomplete' ? 'bg-red-600 text-white border-red-600 shadow-2xs' :
              task.status === 'Reschedule' ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300' :
              'bg-theme-card text-theme-text border-theme-border'
            }`}
          >
            <option value="Pending">● Pending</option>
            <option value="Working">⚡ Working</option>
            <option value="Done">✓ Done</option>
            <option value="Hold">⏸ Hold</option>
            <option value="Incomplete">⚠️ Incomplete</option>
            <option value="Reschedule">↻ Reschedule</option>
            <option value="Terminated">✕ Terminated</option>
          </select>

          {/* Play / Pause / Done Button */}
          {isWorking ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => pauseTask(task.id)}
                className="p-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-2xs cursor-pointer"
                title="Pause Task"
              >
                <Pause className="w-3 h-3" />
              </button>
              <button
                onClick={() => completeTask(task.id)}
                className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-bold transition-colors shadow-2xs cursor-pointer"
                title="Mark as Done"
              >
                <Check className="w-3 h-3" />
                <span className="hidden sm:inline">Done</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => startTask(task.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-2xs transition-all cursor-pointer"
              title="Start Task Now"
            >
              <Play className="w-2.5 h-2.5 fill-white" />
              <span>Start</span>
            </button>
          )}

          {/* Reschedule Button */}
          {!task.isMandatorySchedule && (
            <button
              onClick={() => handleStatusChange(task, 'Reschedule')}
              className="p-1 rounded-lg hover:bg-theme-card-hover text-theme-muted hover:text-purple-600 transition-colors cursor-pointer"
              title="Smart Reschedule"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Edit Button */}
          <button
            onClick={() => onOpenTaskModal(task)}
            className="p-1 rounded-lg hover:bg-theme-card-hover text-theme-muted hover:text-blue-600 transition-colors cursor-pointer"
            title="Edit Task"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {/* Delete Button */}
          <button
            onClick={() => requestDeleteTask(task, task.taskDate)}
            className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors cursor-pointer"
            title="Delete Task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Expanded Card Renderer (Identical to AllTasksView)
  const renderTaskExpanded = (task: Task) => {
    const priorityMeta = prioritySettings[task.priority];
    const isWorking = task.status === 'Working';
    const isIncomplete = task.status === 'Incomplete';
    const isCurrentRunningSlot = isTaskInRunningSlot(task.taskDate, task.startTime, task.endTime, nowTime);
    const isRunning = isWorking || (task.status === 'Pending' && isCurrentRunningSlot);
    const isDue = isIncomplete || 
      (task.status === 'Pending' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, nowTime)) ||
      (task.status === 'Working' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, nowTime));
    const isSimultaneous = Boolean(task.isSimultaneous);
    const simultaneousList = isSimultaneous ? findSimultaneousTasks(task, tasks) : [];
    const isInSleep = isTaskInSleepWindow(task, capacitySettings);

    return (
      <div
        key={task.id}
        className={`p-4 rounded-3xl border transition-all duration-200 ${
          isDue
            ? 'bg-red-50/30 dark:bg-red-950/20 border-red-300 dark:border-red-900/60 shadow-sm'
            : isRunning
              ? isInSleep
                ? 'bg-slate-900 text-slate-100 dark:bg-slate-950 dark:text-slate-100 border-blue-500 shadow-xl shadow-blue-500/30 ring-2 ring-blue-500/80'
                : 'bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-theme-card dark:from-blue-950/60 dark:via-sky-950/30 dark:to-theme-card border-blue-500 shadow-xl shadow-blue-500/20 ring-2 ring-blue-500/60'
              : isInSleep
              ? 'bg-slate-900/95 text-slate-100 dark:bg-slate-950 dark:text-slate-100 border-indigo-900/90 shadow-md ring-1 ring-indigo-500/40 hover:border-indigo-400'
              : isSimultaneous
                ? 'bg-purple-50/20 dark:bg-purple-950/10 border-purple-300 dark:border-purple-800 hover:shadow-md'
                : 'bg-theme-card border-theme-border hover:border-blue-400/50 hover:shadow-md'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          
          {/* Left Metadata & Details */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={`px-2.5 py-1.5 rounded-2xl text-center font-black text-xs sm:text-sm min-w-[48px] shrink-0 flex items-center justify-center transition-all ${
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

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-theme-card-hover px-2 py-0.5 rounded-lg border border-theme-border">
                  {task.projectCode}
                </span>

                <span className="text-theme-muted flex items-center gap-1 font-mono font-semibold bg-theme-card-hover px-2 py-0.5 rounded-lg border border-theme-border">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  {formatDisplayDate(task.taskDate)} ({getDayOfWeekFromDate(task.taskDate).slice(0, 3)})
                </span>

                <span className="font-mono text-theme-text font-bold bg-theme-card-hover px-2 py-0.5 rounded-lg border border-theme-border">
                  {task.startTime} - {task.endTime} ({task.appointedMinutes}m)
                </span>

                {task.subCategory && (
                  <span className="font-semibold text-theme-muted bg-theme-card-hover px-2 py-0.5 rounded-lg border border-theme-border">
                    {task.subCategory}
                  </span>
                )}

                {/* Mandatory Fixed Schedule Badge */}
                {task.isMandatorySchedule && (
                  <span 
                    className="text-[10px] font-black px-2 py-0.5 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 rounded-full flex items-center gap-1 shadow-sm"
                    title="Mandatory Fixed Schedule"
                  >
                    <Lock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                    <span>MANDATORY FIXED</span>
                  </span>
                )}

                {isInSleep && (
                  <span 
                    className="text-[10px] font-black px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-700/80 rounded-full flex items-center gap-1 shadow-sm"
                    title="Scheduled on Sleep / Recovery Window"
                  >
                    <Moon className="w-2.5 h-2.5 text-indigo-400" />
                    <span>🌙 SLEEP TIME</span>
                  </span>
                )}

                {task.recurrence !== 'None' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    ↻ {task.recurrence}
                  </span>
                )}

                {isSimultaneous && (
                  <span 
                    className="text-[10px] font-black px-2 py-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full flex items-center gap-1 shadow-sm shadow-purple-500/20"
                    title={simultaneousList.length > 0 ? `Co-running simultaneously with: ${simultaneousList.map(s => `${s.projectCode} (${s.title})`).join(', ')}` : 'Marked to run simultaneously (Free on Gap Finder)'}
                  >
                    <Zap className="w-2.5 h-2.5 text-yellow-300" />
                    <span>🔀 SIMULTANEOUS{simultaneousList.length > 0 ? ` (${simultaneousList.length})` : ''}</span>
                  </span>
                )}

                {isRunning && !isDue && (
                  <span className="text-[10px] font-black px-2 py-0.5 bg-blue-600 text-white rounded-full flex items-center gap-1.5 shadow-md shadow-blue-500/40">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-200 opacity-90"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    <span>{isWorking ? '⚡ RUNNING NOW' : '⚡ RUNNING TIME'}</span>
                  </span>
                )}

                {isDue && (
                  <span className="text-[10px] font-black px-2 py-0.5 bg-red-600 text-white rounded-full flex items-center gap-1.5 shadow-sm animate-pulse">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    <span>{isIncomplete ? '⚠️ INCOMPLETE' : isWorking ? '⚡ OVERTIME DUE' : '🚨 DUE NOW'}</span>
                  </span>
                )}
              </div>

              {/* Task Title (Clickable) */}
              <div className="flex items-baseline gap-2 flex-wrap">
                <h4 
                  onClick={() => onOpenTaskModal(task)}
                  className={`${getTaskTitleClasses(task.title, task.status === 'Done', isInSleep && !isDue)} cursor-pointer hover:text-blue-600 transition-colors`}
                >
                  {task.title}
                </h4>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/60 shadow-2xs">
                  ~{task.appointedMinutes}m
                </span>
              </div>

              {/* Live Status Badge + Countdown Pill */}
              <div className="flex items-center gap-2 flex-wrap py-0.5">
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none transition-colors ${
                    task.status === 'Done' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' :
                    task.status === 'Terminated' ? 'bg-red-600 text-white border-red-600 shadow-sm' :
                    task.status === 'Working' ? 'bg-blue-600 text-white border-blue-600 shadow-sm animate-pulse' :
                    task.status === 'Hold' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950' :
                    task.status === 'Incomplete' ? 'bg-red-600 text-white border-red-600 shadow-sm' :
                    task.status === 'Reschedule' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                    'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <option value="Pending">● Pending</option>
                  <option value="Working">⚡ Working</option>
                  <option value="Done">✓ Done</option>
                  <option value="Hold">⏸ Hold</option>
                  <option value="Incomplete">⚠️ Incomplete</option>
                  <option value="Reschedule">↻ Reschedule</option>
                  <option value="Terminated">✕ Terminated</option>
                </select>

                {/* Live Countdown */}
                {(() => {
                  if (isWorking) {
                    const lastLog = task.executionLogs?.[task.executionLogs.length - 1];
                    const startMs = lastLog ? new Date(lastLog.startedAt).getTime() : nowTime.getTime();
                    const elapsedSec = Math.max(0, Math.floor((nowTime.getTime() - startMs) / 1000));
                    const totalAppointedSec = task.appointedMinutes * 60;
                    const remainingSec = totalAppointedSec - elapsedSec;
                    const isOvertime = remainingSec < 0;
                    const absSec = Math.abs(remainingSec);
                    const m = Math.floor(absSec / 60);
                    const s = absSec % 60;
                    const timeFormatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

                    return (
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm ${
                        isOvertime
                          ? 'bg-amber-400 text-amber-950 animate-pulse font-black'
                          : 'bg-blue-600 text-white'
                      }`}>
                        <Hourglass className="w-3 h-3 animate-spin" />
                        <span>{isOvertime ? `Overtime: +${timeFormatted}` : `Countdown: ${timeFormatted} left`}</span>
                      </span>
                    );
                  }

                  if (task.status === 'Pending' && task.taskDate === toISODateString(nowTime)) {
                    const startMin = parse12HourToMinutes(task.startTime);
                    const curMin = nowTime.getHours() * 60 + nowTime.getMinutes();
                    const diffMin = startMin - curMin;

                    if (diffMin > 0) {
                      const h = Math.floor(diffMin / 60);
                      const m = diffMin % 60;
                      return (
                        <span className="text-[11px] font-mono font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                          <Timer className="w-3 h-3 text-blue-500" />
                          <span>Starts in {h > 0 ? `${h}h ` : ''}{m}m</span>
                        </span>
                      );
                    }
                  }

                  return null;
                })()}
              </div>

              {task.description && (
                <p className="text-xs sm:text-sm text-theme-muted line-clamp-2 pt-0.5">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-theme-border">
            {isWorking ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => pauseTask(task.id)}
                  className="p-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                </button>
                <button
                  onClick={() => completeTask(task.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Done</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => startTask(task.id)}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start</span>
              </button>
            )}

            {task.isMandatorySchedule ? (
              <button
                disabled
                className="p-2 rounded-xl opacity-40 text-theme-muted cursor-not-allowed"
                title="🔒 Mandatory Schedule: Locked & Non-Reschedulable"
              >
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </button>
            ) : (
              <button
                onClick={() => setReschedulingTask(task)}
                className="p-2 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/40 text-theme-muted hover:text-purple-600 transition-colors cursor-pointer"
                title="Reschedule Task / Find Slot"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => onOpenTaskModal(task)}
              className="p-2 rounded-xl hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors cursor-pointer"
              title="Edit Task"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => requestDeleteTask(task, task.taskDate)}
              className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors cursor-pointer"
              title="Delete Task / Occurrence"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* Category Pills Bar (Top Level Navigation) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => {
          const Icon = getCategoryIcon(cat.iconName);
          const isSelected = cat.id === selectedCatId;
          const count = tasks.filter(t => t.category === cat.name).length;

          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCatId(cat.id);
                setSelectedSubCat('ALL');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-102'
                  : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                isSelected ? 'bg-white/20 text-white' : 'bg-theme-card-hover text-theme-muted'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Category Header Banner (Glassmorphism & Rich KPIs) */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-theme-border shadow-sm space-y-4 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          
          <div className="flex items-center gap-4">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"
              style={{ backgroundColor: currentCategory.color }}
            >
              <IconComponent className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-theme-text tracking-tight font-display">
                  {currentCategory.name}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 font-mono font-bold">
                  {totalTasksCount} Total Tasks
                </span>
                {completedCount > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold">
                    ✓ {completedCount} Done
                  </span>
                )}
              </div>
              <p className="text-xs text-theme-muted mt-1">
                Dedicated Work Budget: <strong className="text-theme-text font-mono">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong> • Actual Logged: <strong className="text-blue-600 dark:text-blue-400 font-mono">{Math.floor(totalLoggedMinutes / 60)}h {totalLoggedMinutes % 60}m</strong> • Progress: <strong className="text-emerald-600 font-bold">{taskProgressPercent}%</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => onOpenTaskModal(undefined, toISODateString(new Date()), undefined, undefined, currentCategory.name)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Schedule in {currentCategory.name}</span>
          </button>

        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-theme-card-hover h-2.5 rounded-full overflow-hidden border border-theme-border">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${taskProgressPercent}%` }}
            title={`Completed ${completedCount} of ${totalTasksCount} tasks (${taskProgressPercent}%)`}
          />
        </div>
      </div>

      {/* Subcategory / Sub-Entities Filter Tabs */}
      {currentCategory.subCategories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-bold text-theme-muted uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span>Sub-Entities:</span>
          </span>
          <button
            onClick={() => setSelectedSubCat('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              selectedSubCat === 'ALL'
                ? 'bg-theme-text text-theme-bg shadow-sm'
                : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
            }`}
          >
            All Sub-entities ({allCategoryTasks.length})
          </button>
          {currentCategory.subCategories.map((sub, idx) => {
            const subCount = allCategoryTasks.filter(t => t.subCategory === sub).length;
            const isSubSelected = selectedSubCat === sub;
            return (
              <button
                key={idx}
                onClick={() => setSelectedSubCat(sub)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isSubSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
                }`}
              >
                <span>{sub}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSubSelected ? 'bg-white/20 text-white' : 'bg-theme-card-hover text-theme-muted'
                }`}>
                  {subCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Full Control Bar (Search, Time Horizons, Status, Priority, Density Mode) */}
      <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-theme-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 flex-wrap">
        
        {/* Left: Search + Horizon Tabs */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {/* Live Search */}
          <div className="relative flex-1 sm:max-w-xs min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-theme-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Search ${currentCategory.name} tasks...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-theme-card border border-theme-border text-xs text-theme-text font-semibold placeholder:text-theme-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-theme-muted hover:text-theme-text"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Time Horizon Pills */}
          <div className="flex items-center gap-1 p-1 bg-theme-card-hover rounded-xl border border-theme-border overflow-x-auto no-scrollbar">
            {[
              { id: 'ALL', label: 'All Dates' },
              { id: 'TODAY', label: 'Today' },
              { id: 'TOMORROW', label: 'Tomorrow' },
              { id: 'THIS_WEEK', label: 'This Week' },
              { id: 'NEXT_WEEK', label: 'Next Week' }
            ].map((hz) => (
              <button
                key={hz.id}
                onClick={() => setTimeRange(hz.id as TimeRangeFilter)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  timeRange === hz.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                {hz.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Status Filter + Priority Filter + Density Switcher */}
        <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as TaskStatus | 'ALL')}
            className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Working">Working</option>
            <option value="Done">Done</option>
            <option value="Hold">Hold</option>
            <option value="Incomplete">Incomplete</option>
            <option value="Reschedule">Reschedule</option>
            <option value="Terminated">Terminated</option>
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as PriorityLevel | 'ALL')}
            className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="P1">P1 (Must Do)</option>
            <option value="P2">P2 (Should Do)</option>
            <option value="P3">P3 (Medium)</option>
            <option value="P4">P4 (Low)</option>
            <option value="P5">P5 (Optional)</option>
          </select>

          {/* Density Toggle (Compact List vs Comfortable Cards) */}
          <div className="flex items-center bg-theme-card-hover p-0.5 rounded-xl border border-theme-border">
            <button
              onClick={() => setDensityMode('compact')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                densityMode === 'compact'
                  ? 'bg-theme-card text-blue-600 shadow-xs'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
              title="Compact Row List View"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDensityMode('expanded')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                densityMode === 'expanded'
                  ? 'bg-theme-card text-blue-600 shadow-xs'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
              title="Comfortable Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Task Counter / Summary Banner */}
      <div className="flex items-center justify-between text-xs font-bold text-theme-muted px-1">
        <span>
          Showing <strong className="text-theme-text">{filteredCategoryTasks.length}</strong> of {allCategoryTasks.length} tasks in {currentCategory.name}
        </span>
        {(selectedStatus !== 'ALL' || selectedPriority !== 'ALL' || timeRange !== 'ALL' || selectedSubCat !== 'ALL' || searchQuery) && (
          <button
            onClick={() => {
              setSelectedStatus('ALL');
              setSelectedPriority('ALL');
              setTimeRange('ALL');
              setSelectedSubCat('ALL');
              setSearchQuery('');
            }}
            className="text-blue-600 hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Tasks List / Grid Area */}
      {filteredCategoryTasks.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center space-y-3 border border-dashed border-theme-border">
          <div 
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-white shadow-md"
            style={{ backgroundColor: currentCategory.color }}
          >
            <IconComponent className="w-6 h-6" />
          </div>
          <h4 className="text-base font-black text-theme-text font-display">
            No Tasks Found in {currentCategory.name}
          </h4>
          <p className="text-xs text-theme-muted max-w-sm mx-auto">
            {searchQuery || selectedStatus !== 'ALL' || selectedPriority !== 'ALL' || selectedSubCat !== 'ALL'
              ? 'No tasks matched your active filter criteria. Try clearing search or resetting filters.'
              : `No scheduled tasks registered under "${currentCategory.name}" yet. Click the button below to time-box your first task.`}
          </p>
          <button
            onClick={() => onOpenTaskModal(undefined, toISODateString(new Date()), undefined, undefined, currentCategory.name)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 inline-flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Schedule Task in {currentCategory.name}</span>
          </button>
        </div>
      ) : (
        <div className={densityMode === 'compact' ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
          {filteredCategoryTasks.map((task) => 
            densityMode === 'compact' 
              ? renderCompactTaskRow(task) 
              : renderTaskExpanded(task)
          )}
        </div>
      )}

      {/* Smart Reschedule Engine Modal */}
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
