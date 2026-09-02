import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Task, PriorityLevel, TaskStatus } from '../types';
import { 
  toISODateString, 
  parse12HourToMinutes, 
  isTaskScheduledForDate,
  isTaskInRunningSlot,
  isTaskPastDue,
  findSimultaneousTasks,
  getDayOfWeekFromDate,
  getTaskTitleClasses,
  isTaskInSleepWindow
} from '../utils/timeUtils';
import { 
  Calendar, 
  Filter, 
  Search, 
  Tag, 
  CheckCircle2, 
  Clock, 
  Play, 
  Pause, 
  Edit2, 
  Trash2, 
  Layers, 
  AlertTriangle,
  Folder,
  SlidersHorizontal,
  Plus,
  Timer,
  Hourglass,
  Check,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  X,
  Zap,
  Lock,
  Moon,
  Sparkles,
  Download,
  FileSpreadsheet,
  Database,
  LayoutList,
  LayoutGrid
} from 'lucide-react';
import { exportTasksToExcelWorkbook, exportTasksToDetailedCSV } from '../utils/excelExporter';
import { RescheduleModal } from '../components/RescheduleModal';
import { RecurringManagerModal } from '../components/RecurringManagerModal';
import { TableView } from '../components/views/TableView';
import { TimelineView } from '../components/views/TimelineView';
import { Day24HourView } from '../components/views/Day24HourView';
import { WeeklyCalendarView } from '../components/views/WeeklyCalendarView';
import { MonthlyCalendarView } from '../components/views/MonthlyCalendarView';
import { ListTodo, Table as TableIcon, CalendarDays, Grid3X3, Repeat } from 'lucide-react';

type TimeRangeFilter = 'ALL' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'NEXT_WEEK' | 'NEXT_MONTH' | 'NEXT_YEAR';
export type AllTasksViewMode = 'list' | 'table' | 'timeline' | '24hours' | 'weekly' | 'monthly';

interface AllTasksViewProps {
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
}

export const AllTasksView: React.FC<AllTasksViewProps> = ({ onOpenTaskModal }) => {
  const { 
    tasks, 
    categories, 
    capacitySettings,
    prioritySettings, 
    planProjects,
    openBackupModal,
    startTask, 
    pauseTask, 
    completeTask, 
    updateTask, 
    deleteTask,
    requestDeleteTask,
    searchQuery,
    setSearchQuery 
  } = useApp();

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('ALL');
  const [densityMode, setDensityMode] = useState<'compact' | 'expanded'>('compact');
  const [collapsedHorizons, setCollapsedHorizons] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<AllTasksViewMode>('list');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(toISODateString(new Date()));
  const [showCompletedArchive, setShowCompletedArchive] = useState(true);
  const [reschedulingTask, setReschedulingTask] = useState<Task | null>(null);
  const [isRecurringHubOpen, setIsRecurringHubOpen] = useState(false);
  const [nowTime, setNowTime] = useState<Date>(new Date());

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

  const handleConfirmReschedule = (taskToReschedule: Task, newDate: string, newStartTime: string, newEndTime: string) => {
    updateTask({
      ...taskToReschedule,
      taskDate: newDate,
      dayOfWeek: getDayOfWeekFromDate(newDate),
      startTime: newStartTime,
      endTime: newEndTime,
      status: 'Pending'
    });
    setReschedulingTask(null);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Date Range Filter Logic (respects Daily, Selected Days, Weekly, Monthly, Yearly)
  const filterByTimeRange = (task: Task, range: TimeRangeFilter): boolean => {
    if (range === 'ALL') return true;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayIso = toISODateString(today);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = toISODateString(tomorrow);

    // Current week end (Sunday)
    const dayOfWeek = today.getDay();
    const daysUntilEndOfWeek = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + daysUntilEndOfWeek);
    const endOfWeekIso = toISODateString(endOfWeek);

    // Next week boundaries
    const nextWeekStart = new Date(endOfWeek);
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);
    const nextWeekStartIso = toISODateString(nextWeekStart);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
    const nextWeekEndIso = toISODateString(nextWeekEnd);

    const currentYearEndIso = `${today.getFullYear()}-12-31`;

    if (range === 'TODAY') {
      return isTaskScheduledForDate(task, todayIso);
    }
    if (range === 'TOMORROW') {
      return isTaskScheduledForDate(task, tomorrowIso);
    }
    if (range === 'THIS_WEEK') {
      let cur = new Date(tomorrow);
      cur.setDate(cur.getDate() + 1);
      while (cur <= endOfWeek) {
        if (isTaskScheduledForDate(task, toISODateString(cur))) return true;
        cur.setDate(cur.getDate() + 1);
      }
      return task.taskDate > tomorrowIso && task.taskDate <= endOfWeekIso;
    }
    if (range === 'NEXT_WEEK') {
      let cur = new Date(nextWeekStart);
      while (cur <= nextWeekEnd) {
        if (isTaskScheduledForDate(task, toISODateString(cur))) return true;
        cur.setDate(cur.getDate() + 1);
      }
      return task.taskDate >= nextWeekStartIso && task.taskDate <= nextWeekEndIso;
    }
    if (range === 'NEXT_MONTH') {
      return task.taskDate > nextWeekEndIso && task.taskDate <= currentYearEndIso;
    }
    if (range === 'NEXT_YEAR') {
      if (task.recurrence && task.recurrence !== 'None') return true;
      return task.taskDate > currentYearEndIso;
    }
    return true;
  };

  // Filter Tasks
  const filteredTasks = tasks.filter(task => {
    if (!filterByTimeRange(task, timeRange)) return false;
    if (selectedCategory !== 'ALL' && task.category !== selectedCategory) return false;
    if (selectedPriority !== 'ALL' && task.priority !== selectedPriority) return false;
    if (selectedStatus !== 'ALL' && task.status !== selectedStatus) return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchCode = task.projectCode.toLowerCase().includes(q);
      const matchCategory = task.category.toLowerCase().includes(q);
      if (!matchTitle && !matchCode && !matchCategory) return false;
    }
    return true;
  }).sort((a, b) => {
    if (a.taskDate !== b.taskDate) return a.taskDate.localeCompare(b.taskDate);
    
    const aIncomplete = a.status === 'Incomplete';
    const bIncomplete = b.status === 'Incomplete';

    // 1. Incompleted tasks sink down to bottom
    if (aIncomplete !== bIncomplete) {
      return aIncomplete ? 1 : -1;
    }

    // 2. Priority based sorting for incompleted tasks (P1 -> P2 -> P3 -> P4 -> P5)
    if (aIncomplete && bIncomplete) {
      const pWeight: Record<PriorityLevel, number> = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };
      if (pWeight[a.priority] !== pWeight[b.priority]) {
        return pWeight[a.priority] - pWeight[b.priority];
      }
      return parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime);
    }

    // 3. Naturally time-wise by startTime
    return parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime);
  });

  const timeRangeTabs: { id: TimeRangeFilter; label: string; badgeColor: string }[] = [
    { id: 'ALL', label: 'All Horizons', badgeColor: 'bg-slate-100 dark:bg-slate-800' },
    { id: 'TODAY', label: 'Today', badgeColor: 'bg-blue-100 dark:bg-blue-950 text-blue-600' },
    { id: 'TOMORROW', label: 'Tomorrow', badgeColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' },
    { id: 'THIS_WEEK', label: 'This Week', badgeColor: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600' },
    { id: 'NEXT_WEEK', label: 'Next Week', badgeColor: 'bg-purple-100 dark:bg-purple-950 text-purple-600' },
    { id: 'NEXT_MONTH', label: 'Next Month', badgeColor: 'bg-amber-100 dark:bg-amber-950 text-amber-600' },
    { id: 'NEXT_YEAR', label: 'Next Year', badgeColor: 'bg-rose-100 dark:bg-rose-950 text-rose-600' },
  ];

  // Dynamically group tasks into temporal horizon sections
  const horizonGroups = useMemo(() => {
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

    const currentYearEndIso = `${today.getFullYear()}-12-31`;

    const activeTasks = filteredTasks.filter(t => t.status !== 'Done' && t.status !== 'Terminated');

    const overdue: Task[] = [];
    const todayTasks: Task[] = [];
    const tomorrowTasks: Task[] = [];
    const thisWeekTasks: Task[] = [];
    const nextWeekTasks: Task[] = [];
    const nextMonthTasks: Task[] = [];
    const nextYearTasks: Task[] = [];

    activeTasks.forEach(task => {
      if (task.taskDate < todayIso) {
        overdue.push(task);
      } else if (isTaskScheduledForDate(task, todayIso)) {
        todayTasks.push(task);
      } else if (isTaskScheduledForDate(task, tomorrowIso)) {
        tomorrowTasks.push(task);
      } else if (task.taskDate > tomorrowIso && task.taskDate <= endOfWeekIso) {
        thisWeekTasks.push(task);
      } else if (task.taskDate >= nextWeekStartIso && task.taskDate <= nextWeekEndIso) {
        nextWeekTasks.push(task);
      } else if (task.taskDate > nextWeekEndIso && task.taskDate <= currentYearEndIso) {
        nextMonthTasks.push(task);
      } else {
        nextYearTasks.push(task);
      }
    });

    const allGroups = [
      {
        id: 'OVERDUE' as const,
        label: 'Overdue & Needs Reschedule',
        rangeText: `Scheduled before ${todayIso}`,
        icon: '⚠️',
        colorClass: 'border-red-400/80 bg-red-500/10 text-red-700 dark:text-red-400',
        badgeColor: 'bg-red-600 text-white',
        tasks: overdue,
        defaultDate: todayIso,
        showAlways: false
      },
      {
        id: 'TODAY' as const,
        label: 'Today',
        rangeText: `${todayIso} (${getDayOfWeekFromDate(todayIso)})`,
        icon: '⚡',
        colorClass: 'border-blue-400/80 bg-blue-500/10 text-blue-700 dark:text-blue-400',
        badgeColor: 'bg-blue-600 text-white',
        tasks: todayTasks,
        defaultDate: todayIso,
        showAlways: true
      },
      {
        id: 'TOMORROW' as const,
        label: 'Tomorrow',
        rangeText: `${tomorrowIso} (${getDayOfWeekFromDate(tomorrowIso)})`,
        icon: '🌅',
        colorClass: 'border-emerald-400/80 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        badgeColor: 'bg-emerald-600 text-white',
        tasks: tomorrowTasks,
        defaultDate: tomorrowIso,
        showAlways: true
      },
      {
        id: 'THIS_WEEK' as const,
        label: 'This Week',
        rangeText: `Remaining days up to ${endOfWeekIso}`,
        icon: '📅',
        colorClass: 'border-indigo-400/80 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
        badgeColor: 'bg-indigo-600 text-white',
        tasks: thisWeekTasks,
        defaultDate: endOfWeekIso,
        showAlways: false
      },
      {
        id: 'NEXT_WEEK' as const,
        label: 'Next Week',
        rangeText: `${nextWeekStartIso} to ${nextWeekEndIso}`,
        icon: '🗓️',
        colorClass: 'border-purple-400/80 bg-purple-500/10 text-purple-700 dark:text-purple-400',
        badgeColor: 'bg-purple-600 text-white',
        tasks: nextWeekTasks,
        defaultDate: nextWeekStartIso,
        showAlways: false
      },
      {
        id: 'NEXT_MONTH' as const,
        label: 'Next Month & Later This Year',
        rangeText: `Upcoming in ${today.getFullYear()}`,
        icon: '🌕',
        colorClass: 'border-amber-400/80 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        badgeColor: 'bg-amber-600 text-white',
        tasks: nextMonthTasks,
        defaultDate: nextWeekEndIso,
        showAlways: false
      },
      {
        id: 'NEXT_YEAR' as const,
        label: 'Next Year & Beyond',
        rangeText: `${today.getFullYear() + 1} and beyond`,
        icon: '🚀',
        colorClass: 'border-rose-400/80 bg-rose-500/10 text-rose-700 dark:text-rose-400',
        badgeColor: 'bg-rose-600 text-white',
        tasks: nextYearTasks,
        defaultDate: `${today.getFullYear() + 1}-01-01`,
        showAlways: false
      }
    ];

    if (timeRange === 'ALL') {
      return allGroups.filter(g => g.tasks.length > 0 || g.showAlways);
    }
    return allGroups.filter(g => g.id === timeRange);
  }, [filteredTasks, timeRange]);

  // Compact View Task Item (Ultra-Dense for viewing many tasks simultaneously)
  const renderTaskCompact = (task: Task) => {
    const priorityMeta = prioritySettings[task.priority];
    const isWorking = task.status === 'Working';
    const isIncomplete = task.status === 'Incomplete';
    const now = new Date();
    const isCurrentRunningSlot = isTaskInRunningSlot(task.taskDate, task.startTime, task.endTime, now);
    const isRunning = isWorking || (task.status === 'Pending' && isCurrentRunningSlot);
    const isDue = isIncomplete || 
      (task.status === 'Pending' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, now)) ||
      (task.status === 'Working' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, now));
    const simultaneousList = findSimultaneousTasks(task, tasks);
    const isSimultaneous = simultaneousList.length > 0;
    const isInSleep = isTaskInSleepWindow(task, capacitySettings);

    return (
      <div
        key={task.id}
        className={`px-3 py-1.5 sm:py-2 rounded-xl border transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-2 group ${
          isDue
            ? 'bg-red-50/40 dark:bg-red-950/30 border-red-300 dark:border-red-900/60 shadow-2xs hover:border-red-400'
            : isRunning
              ? 'bg-gradient-to-r from-blue-50/90 via-sky-50/60 to-theme-card dark:from-blue-950/70 dark:via-sky-950/40 dark:to-theme-card border-blue-500 shadow-md ring-1 ring-blue-500/50'
              : isInSleep
              ? 'bg-slate-900/95 text-slate-100 dark:bg-slate-950 border-indigo-900/90 shadow-2xs'
              : isSimultaneous
                ? 'bg-purple-50/20 dark:bg-purple-950/10 border-purple-300 dark:border-purple-800/80 shadow-2xs'
                : 'bg-theme-card hover:bg-theme-card-hover border-theme-border shadow-2xs'
        }`}
      >
        {/* Left Core Data: Priority + Code + Title + Time + Badges */}
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
          {/* Priority Badge */}
          <div
            className={`px-2 py-0.5 rounded-lg text-center font-black text-xs min-w-[36px] shrink-0 font-mono shadow-2xs ${
              task.priority === 'P1'
                ? 'bg-gradient-to-tr from-rose-600 via-red-500 to-amber-400 text-white shadow-sm shadow-red-500/40 animate-pulse'
                : ''
            }`}
            style={task.priority === 'P1' ? undefined : { backgroundColor: priorityMeta?.bgColor, color: priorityMeta?.color }}
          >
            {task.priority}
          </div>

          {/* Project Code */}
          <span className="font-mono font-bold text-[11px] text-blue-600 dark:text-blue-400 bg-theme-card-hover px-1.5 py-0.5 rounded border border-theme-border shrink-0">
            {task.projectCode}
          </span>

          {/* Title */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span
              onClick={() => onOpenTaskModal(task)}
              title={task.title}
              className={`font-bold text-xs truncate cursor-pointer hover:text-blue-600 transition-colors ${
                task.status === 'Done'
                  ? 'line-through text-theme-muted'
                  : isInSleep
                  ? 'text-white'
                  : 'text-theme-text'
              }`}
            >
              {task.title}
            </span>
            <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-900/60 shadow-2xs shrink-0">
              ~{task.appointedMinutes}m
            </span>
          </div>

          {/* Scheduled Time Window */}
          <div className="flex items-center gap-1 text-[11px] font-mono font-semibold text-theme-muted bg-theme-card-hover px-1.5 py-0.5 rounded border border-theme-border shrink-0 whitespace-nowrap">
            <Clock className="w-3 h-3 text-blue-500 shrink-0" />
            <span>{task.startTime} - {task.endTime}</span>
          </div>

          {/* Date (if not today) */}
          {task.taskDate !== toISODateString(nowTime) && (
            <span className="font-mono text-[10px] text-theme-muted hidden xl:inline-flex items-center gap-0.5 shrink-0">
              <Calendar className="w-2.5 h-2.5 text-theme-muted" />
              <span>{task.taskDate.slice(5)}</span>
            </span>
          )}

          {/* Category Pill */}
          <span className="text-[10px] font-semibold text-theme-muted px-1.5 py-0.2 rounded bg-theme-card border border-theme-border shrink-0 hidden lg:inline-flex">
            {task.category}
          </span>

          {/* Status Indicators */}
          {task.isMandatorySchedule && (
            <span className="text-[9px] font-black px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 rounded border border-amber-300 dark:border-amber-700/80 shrink-0" title="Mandatory Fixed Schedule">
              LOCK
            </span>
          )}

          {isInSleep && (
            <span className="text-[9px] font-black px-1.5 py-0.2 bg-indigo-950 text-indigo-300 rounded border border-indigo-700 shrink-0" title="Scheduled in Sleep Window">
              🌙 SLEEP
            </span>
          )}

          {isSimultaneous && (
            <span className="text-[9px] font-black px-1.5 py-0.2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded shrink-0 shadow-2xs" title={`Simultaneous with ${simultaneousList.map(s => s.projectCode).join(', ')}`}>
              🔀 SIMUL ({simultaneousList.length})
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
          {/* Working Countdown / Starts in Pill */}
          {isWorking && (() => {
            const lastLog = task.executionLogs[task.executionLogs.length - 1];
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
                className="p-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-2xs"
                title="Pause Task"
              >
                <Pause className="w-3 h-3" />
              </button>
              <button
                onClick={() => completeTask(task.id)}
                className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-bold transition-colors shadow-2xs"
                title="Mark as Done"
              >
                <Check className="w-3 h-3" />
                <span className="hidden sm:inline">Done</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => startTask(task.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-2xs transition-all"
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
              className="p-1 rounded-lg hover:bg-theme-card-hover text-theme-muted hover:text-purple-600 transition-colors"
              title="Smart Reschedule"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Edit Button */}
          <button
            onClick={() => onOpenTaskModal(task)}
            className="p-1 rounded-lg hover:bg-theme-card-hover text-theme-muted hover:text-blue-600 transition-colors"
            title="Edit Task"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {/* Delete Button */}
          <button
            onClick={() => requestDeleteTask(task, selectedCalendarDate || task.taskDate)}
            className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors"
            title="Delete Task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Comfortable View Task Card (Expanded with full details)
  const renderTaskExpanded = (task: Task) => {
    const priorityMeta = prioritySettings[task.priority];
    const isWorking = task.status === 'Working';
    const isIncomplete = task.status === 'Incomplete';
    const now = new Date();
    const isCurrentRunningSlot = isTaskInRunningSlot(task.taskDate, task.startTime, task.endTime, now);
    const isRunning = isWorking || (task.status === 'Pending' && isCurrentRunningSlot);
    const isDue = isIncomplete || 
      (task.status === 'Pending' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, now)) ||
      (task.status === 'Working' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, now));
    const simultaneousList = findSimultaneousTasks(task, tasks);
    const isSimultaneous = simultaneousList.length > 0;
    const isInSleep = isTaskInSleepWindow(task, capacitySettings);

    return (
      <div
        key={task.id}
        className={`p-4 rounded-2xl border transition-all duration-200 ${
          isDue
            ? 'bg-red-50/30 dark:bg-red-950/20 border-red-300 dark:border-red-900/60 shadow-sm'
            : isRunning
              ? 'bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-theme-card dark:from-blue-950/60 dark:via-sky-950/30 dark:to-theme-card border-blue-500 shadow-xl shadow-blue-500/20 ring-2 ring-blue-500/60'
              : isInSleep
              ? 'bg-slate-900/95 text-slate-100 dark:bg-slate-950 dark:text-slate-100 border-indigo-900/90 shadow-md ring-1 ring-indigo-500/40 hover:border-indigo-400'
              : isSimultaneous
                ? 'bg-purple-50/20 dark:bg-purple-950/10 border-purple-300 dark:border-purple-800 hover:shadow-md'
                : 'bg-theme-card border-theme-border hover:shadow-md'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          
          {/* Left Metadata & Details */}
          <div className="flex items-start gap-3 flex-1">
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

            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-theme-card-hover px-2 py-0.5 rounded border border-theme-border">
                  {task.projectCode}
                </span>

                <span className="text-theme-muted flex items-center gap-1 font-mono font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  {task.taskDate} ({task.dayOfWeek.slice(0, 3)})
                </span>

                <span className="font-mono text-theme-text font-bold bg-theme-card-hover px-2 py-0.5 rounded border border-theme-border">
                  {task.startTime} - {task.endTime} ({task.appointedMinutes}m)
                </span>

                <span className="font-semibold text-theme-muted">
                  {task.category}
                </span>

                {/* Mandatory Fixed Schedule Badge */}
                {task.isMandatorySchedule && (
                  <span 
                    className="text-[10px] font-black px-2 py-0.5 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 rounded-full flex items-center gap-1 shadow-sm"
                    title="Mandatory Fixed Schedule: Cannot be rescheduled, auto-shifted, or displaced"
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

              {/* Task Title (Auto-scaled dynamic typography) + Appointed Duration */}
              <div className="flex items-baseline gap-2 flex-wrap">
                <h4 className={getTaskTitleClasses(task.title, task.status === 'Done', isInSleep)}>
                  {task.title}
                </h4>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/60 shadow-2xs">
                  ~{task.appointedMinutes}m
                </span>
              </div>

              {/* Simultaneous Co-Running Twin Details */}
              {isSimultaneous && (
                <div className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50/80 dark:bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-200/80 dark:border-purple-800/80 flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold flex items-center gap-1">
                    <Zap className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                    Co-Running Twin:
                  </span>
                  {simultaneousList.map(st => (
                    <span key={st.id} className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {st.projectCode}: {st.title} ({st.startTime}-{st.endTime})
                    </span>
                  ))}
                </div>
              )}

              {/* Live Status Badge + Countdown Pill */}
              <div className="flex items-center gap-2 flex-wrap py-0.5">
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none transition-colors ${
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
                    const lastLog = task.executionLogs[task.executionLogs.length - 1];
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
                <p className="text-xs sm:text-sm text-theme-muted line-clamp-1">
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
                  className="p-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
                >
                  <Pause className="w-4 h-4" />
                </button>
                <button
                  onClick={() => completeTask(task.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-bold transition-colors shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Done</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => startTask(task.id)}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start</span>
              </button>
            )}

            {task.isMandatorySchedule ? (
              <button
                disabled
                className="p-1.5 rounded-lg opacity-40 text-theme-muted cursor-not-allowed"
                title="🔒 Mandatory Schedule: Locked & Non-Reschedulable"
              >
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </button>
            ) : (
              <button
                onClick={() => setReschedulingTask(task)}
                className="p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/40 text-theme-muted hover:text-purple-600 transition-colors"
                title="Reschedule Task / Find Slot"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => onOpenTaskModal(task)}
              className="p-1.5 rounded-lg hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
              title="Edit Task"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => requestDeleteTask(task, selectedCalendarDate || task.taskDate)}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors"
              title="Delete Task / Occurrence"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Time Horizon Navigation Banner */}
      <div className="glass-panel p-4 rounded-2xl flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {timeRangeTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTimeRange(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                timeRange === tab.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text border border-theme-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: View Switcher Box & Actions */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-between lg:justify-end">
          <div className="flex items-center gap-1 p-1 bg-theme-card-hover rounded-xl border border-theme-border shadow-inner max-w-full overflow-x-auto no-scrollbar">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>List</span>
            </button>

            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>

            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                viewMode === 'timeline'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>

            <button
              onClick={() => setViewMode('24hours')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                viewMode === '24hours'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>24h</span>
            </button>

            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                viewMode === 'weekly'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Week</span>
            </button>

            <button
              onClick={() => setViewMode('monthly')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                viewMode === 'monthly'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>Month</span>
            </button>
          </div>

          {/* Density Mode Switcher (Compact View vs Comfortable View) */}
          {viewMode === 'list' && (
            <div className="flex items-center gap-1 p-1 bg-theme-card-hover rounded-xl border border-theme-border shadow-inner shrink-0">
              <button
                type="button"
                onClick={() => setDensityMode('compact')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  densityMode === 'compact'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
                title="Compact View: Ultra-dense layout to see many tasks at a time"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Compact View</span>
              </button>
              <button
                type="button"
                onClick={() => setDensityMode('expanded')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  densityMode === 'expanded'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
                title="Comfortable View: Detailed task cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Comfortable</span>
              </button>
            </div>
          )}

          {/* Action button */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          
          {/* Complete 100% Export & Backup Hub Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Export complete tasks and data"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-theme-card border border-theme-border shadow-2xl p-2 z-30 animate-scale-in space-y-1">
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    exportTasksToExcelWorkbook(tasks, planProjects, prioritySettings);
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-theme-card-hover text-left flex items-start gap-2.5 transition-colors group"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-black text-theme-text group-hover:text-emerald-500 transition-colors">
                      Excel Workbook (.xlsx)
                    </div>
                    <div className="text-[10px] text-theme-muted">
                      4 sheets • 28 columns • full details
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    exportTasksToDetailedCSV(tasks, planProjects, prioritySettings);
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-theme-card-hover text-left flex items-start gap-2.5 transition-colors group"
                >
                  <Download className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-black text-theme-text group-hover:text-amber-500 transition-colors">
                      Detailed Tasks CSV (.csv)
                    </div>
                    <div className="text-[10px] text-theme-muted">
                      Universal UTF-8 BOM spreadsheet
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    openBackupModal('export');
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-theme-card-hover text-left flex items-start gap-2.5 transition-colors group border-t border-theme-border/60 pt-2"
                >
                  <Database className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-black text-theme-text group-hover:text-blue-500 transition-colors">
                      100% Full Backup (JSON)
                    </div>
                    <div className="text-[10px] text-theme-muted">
                      Full database + settings backup
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsRecurringHubOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-all shadow-sm"
            title="Manage All Recurring Tasks"
          >
            <Repeat className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Recurring Hub ({tasks.filter(t => t.recurrence && t.recurrence !== 'None').length})</span>
          </button>

          <button
            onClick={() => onOpenTaskModal(undefined, selectedCalendarDate)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Task</span>
          </button>
        </div>
        </div>
      </div>

      {/* Render Selected View Mode */}
      {viewMode === 'table' && (
        <TableView 
          onOpenTaskModal={onOpenTaskModal} 
          onOpenRescheduleModal={setReschedulingTask} 
        />
      )}

      {viewMode === 'timeline' && (
        <TimelineView 
          selectedDate={selectedCalendarDate} 
          onOpenTaskModal={onOpenTaskModal} 
          onOpenRescheduleModal={setReschedulingTask} 
        />
      )}

      {viewMode === '24hours' && (
        <Day24HourView 
          selectedDate={selectedCalendarDate} 
          onOpenTaskModal={onOpenTaskModal} 
        />
      )}

      {viewMode === 'weekly' && (
        <WeeklyCalendarView 
          selectedDate={selectedCalendarDate} 
          onSelectDate={setSelectedCalendarDate} 
          onOpenTaskModal={onOpenTaskModal} 
        />
      )}

      {viewMode === 'monthly' && (
        <MonthlyCalendarView 
          selectedDate={selectedCalendarDate} 
          onSelectDate={setSelectedCalendarDate} 
          onOpenTaskModal={onOpenTaskModal} 
        />
      )}

      {viewMode === 'list' && (
        <>
      {/* Multi-Dimensional Filter Bar */}
      <div className="p-4 rounded-2xl bg-theme-card border border-theme-border shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-theme-muted uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
            Multi-Dimensional Filtering Matrix
          </span>
          {(selectedCategory !== 'ALL' || selectedPriority !== 'ALL' || selectedStatus !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedCategory('ALL');
                setSelectedPriority('ALL');
                setSelectedStatus('ALL');
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline capitalize"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Category Filter */}
          <div>
            <label className="text-[11px] font-semibold text-theme-muted block mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="text-[11px] font-semibold text-theme-muted block mb-1">
              Priority Level
            </label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as PriorityLevel | 'ALL')}
              className="w-full text-xs px-3 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Priorities (P1-P5)</option>
              {(['P1', 'P2', 'P3', 'P4', 'P5'] as PriorityLevel[]).map(p => (
                <option key={p} value={p}>{p} - {prioritySettings[p]?.label}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[11px] font-semibold text-theme-muted block mb-1">
              Status State
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as TaskStatus | 'ALL')}
              className="w-full text-xs px-3 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All States</option>
              <option value="Pending">Pending</option>
              <option value="Working">Working</option>
              <option value="Done">Done</option>
              <option value="Hold">Hold</option>
              <option value="Incomplete">Incomplete / Overdue</option>
              <option value="Reschedule">Reschedule</option>
              <option value="Terminated">Terminated</option>
            </select>
          </div>

        </div>
      </div>

      {/* Task List / Cards */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-theme-text">No Tasks Match the Active Criteria</h4>
            <p className="text-xs text-theme-muted max-w-sm mx-auto">
              Try adjusting your time horizon or filter selections to view tasks.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Active Tasks Grouped by Temporal Horizons */}
            {horizonGroups.every(g => g.tasks.length === 0) ? (
              <div className="p-8 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 text-center space-y-2">
                <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 font-display flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>All Tasks in Selected Horizon Are Completed! 🎉</span>
                </div>
                <p className="text-xs text-theme-muted">
                  Check completed records in the archive section below or create a new task.
                </p>
                <button
                  onClick={() => onOpenTaskModal()}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Task</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {horizonGroups.map((group) => {
                  const isCollapsed = collapsedHorizons[group.id];
                  const totalMinutes = group.tasks.reduce((sum, t) => sum + (t.appointedMinutes || 0), 0);
                  const hours = Math.floor(totalMinutes / 60);
                  const mins = totalMinutes % 60;
                  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

                  return (
                    <div key={group.id} className="space-y-2.5">
                      {/* Horizon Section Header Banner */}
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-theme-card-hover/90 border border-theme-border shadow-xs flex-wrap gap-2 sticky top-2 z-10 backdrop-blur-md">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{group.icon}</span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-xs sm:text-sm font-black text-theme-text uppercase tracking-wider font-display">
                                {group.label}
                              </h3>
                              <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full shadow-2xs ${group.badgeColor}`}>
                                {group.tasks.length} {group.tasks.length === 1 ? 'Task' : 'Tasks'}
                              </span>
                              {group.tasks.length > 0 && (
                                <span className="text-[10px] font-mono font-semibold text-theme-muted">
                                  • {durationStr} allocated
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-theme-muted font-mono">
                              {group.rangeText}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenTaskModal(undefined, group.defaultDate)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-300/40 dark:border-blue-800/40 transition-colors shadow-2xs"
                            title={`Add task for ${group.label}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Add Task</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCollapsedHorizons(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                            className="p-1 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-card transition-colors"
                            title={isCollapsed ? 'Expand Section' : 'Collapse Section'}
                          >
                            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Horizon Tasks */}
                      {!isCollapsed && (
                        <>
                          {group.tasks.length === 0 ? (
                            <div className="p-3 rounded-xl border border-dashed border-theme-border/80 text-center text-xs text-theme-muted bg-theme-card/30">
                              <span>No active tasks in {group.label}. </span>
                              <button
                                onClick={() => onOpenTaskModal(undefined, group.defaultDate)}
                                className="text-blue-600 dark:text-blue-400 font-bold hover:underline ml-1"
                              >
                                + Schedule One Now
                              </button>
                            </div>
                          ) : densityMode === 'compact' ? (
                            <div className="space-y-1.5">
                              {group.tasks.map(task => renderTaskCompact(task))}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {group.tasks.map(task => renderTaskExpanded(task))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Completed & Terminated Archive at Bottom */}
            {filteredTasks.filter(t => t.status === 'Done' || t.status === 'Terminated').length > 0 && (
              <div className="pt-6 border-t border-theme-border space-y-3">
                <div 
                  onClick={() => setShowCompletedArchive(!showCompletedArchive)}
                  className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-theme-card-hover/60 hover:bg-theme-card-hover text-theme-muted transition-colors border border-theme-border/60"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-black uppercase tracking-wider text-theme-text font-display">
                      Completed & Finished Archive ({filteredTasks.filter(t => t.status === 'Done' || t.status === 'Terminated').length})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold">
                    <span>{showCompletedArchive ? 'Collapse' : 'Expand'}</span>
                    {showCompletedArchive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {showCompletedArchive && (
                  <div className={densityMode === 'compact' ? 'space-y-1.5 opacity-85' : 'space-y-3 opacity-80'}>
                    {filteredTasks
                      .filter(t => t.status === 'Done' || t.status === 'Terminated')
                      .map((task) => {
                        const priorityMeta = prioritySettings[task.priority];
                        const isDone = task.status === 'Done';
                        const isTerminated = task.status === 'Terminated';

                        if (densityMode === 'compact') {
                          return (
                            <div
                              key={task.id}
                              className={`px-3 py-1.5 rounded-xl border transition-all flex items-center justify-between gap-2 shadow-2xs ${
                                isDone
                                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
                                  : 'bg-red-50/40 dark:bg-red-950/20 border-red-300 dark:border-red-800/60'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                                <span
                                  className="px-1.5 py-0.2 rounded font-mono font-black text-[10px] shrink-0"
                                  style={{ backgroundColor: priorityMeta?.bgColor, color: priorityMeta?.color }}
                                >
                                  {task.priority}
                                </span>
                                <span className="font-mono text-[10px] text-theme-muted shrink-0">{task.projectCode}</span>
                                <span className="font-bold text-xs line-through text-theme-muted truncate">{task.title}</span>
                                <span className="text-[10px] font-mono text-theme-muted hidden sm:inline shrink-0">
                                  {task.taskDate} • {task.startTime}-{task.endTime} ({task.appointedMinutes}m)
                                </span>
                                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full text-white shrink-0 ${isDone ? 'bg-emerald-600' : 'bg-red-600'}`}>
                                  {isDone ? '✓ Done' : '✕ Terminated'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => updateTask({ ...task, status: 'Pending' })}
                                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-theme-card-hover text-theme-text hover:bg-theme-border"
                                >
                                  Reopen
                                </button>
                                <button
                                  onClick={() => onOpenTaskModal(task)}
                                  className="p-1 hover:text-blue-500 text-theme-muted"
                                  title="Edit Task"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => requestDeleteTask(task, selectedCalendarDate || task.taskDate)}
                                  className="p-1 hover:text-red-500 text-theme-muted"
                                  title="Delete Task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={task.id}
                            className={`p-4 rounded-2xl border transition-all ${
                              isDone 
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-800/80 shadow-sm'
                                : 'bg-red-50/50 dark:bg-red-950/25 border-red-300 dark:border-red-800/80 shadow-sm'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1">
                                <div
                                  className="px-2 py-1 rounded-lg text-center font-black text-xs min-w-[42px] shrink-0"
                                  style={{ backgroundColor: priorityMeta?.bgColor, color: priorityMeta?.color }}
                                >
                                  {task.priority}
                                </div>

                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap text-xs">
                                    <span className="font-mono font-bold text-theme-muted bg-theme-card-hover px-2 py-0.5 rounded border border-theme-border">
                                      {task.projectCode}
                                    </span>
                                    <span className="text-theme-muted flex items-center gap-1 font-mono font-semibold">
                                      <Calendar className="w-3.5 h-3.5 text-theme-muted" />
                                      {task.taskDate}
                                    </span>
                                    <span className="font-mono text-theme-muted font-bold">
                                      {task.startTime} - {task.endTime}
                                    </span>
                                    <span className="text-theme-muted font-semibold">
                                      {task.category}
                                    </span>
                                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm ${
                                      isDone 
                                        ? 'bg-emerald-600 text-white' 
                                        : 'bg-red-600 text-white'
                                    }`}>
                                      {isDone ? <Check className="w-3 h-3 stroke-[3]" /> : <X className="w-3 h-3 stroke-[3]" />}
                                      <span>{isDone ? 'Done' : 'Terminated'}</span>
                                    </span>
                                  </div>

                                  <h4 className="text-base font-bold text-theme-muted line-through font-openSans leading-snug">
                                    {task.title}
                                  </h4>

                                  {isDone ? (
                                    <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                                      <span>Execution Completed & Done • {task.totalActualMinutes || task.appointedMinutes}m (+{task.bufferMinutes}m buffer applied)</span>
                                    </div>
                                  ) : (
                                    <div className="text-[11px] font-mono text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                                      <X className="w-3.5 h-3.5 text-red-500" />
                                      <span>Terminated & Closed • {task.totalActualMinutes || task.appointedMinutes}m</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-theme-border">
                                <button
                                  onClick={() => updateTask({ ...task, status: 'Pending' })}
                                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-theme-card-hover hover:bg-theme-border text-theme-text transition-colors"
                                  title="Reopen Task"
                                >
                                  Reopen
                                </button>
                                <button
                                  onClick={() => onOpenTaskModal(task)}
                                  className="p-1.5 rounded-lg hover:bg-theme-card-hover text-theme-muted hover:text-theme-text"
                                  title="Edit Task"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => requestDeleteTask(task, selectedCalendarDate || task.taskDate)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500"
                                  title="Delete Task / Occurrence"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
      </>
      )}

      {/* Intelligent Reschedule & Slot Finder Modal */}
      {reschedulingTask && (
        <RescheduleModal
          task={reschedulingTask}
          allTasks={tasks}
          capacitySettings={capacitySettings}
          onConfirmReschedule={handleConfirmReschedule}
          onClose={() => setReschedulingTask(null)}
        />
      )}

      {/* Recurring Tasks & Schedules Hub Modal */}
      {isRecurringHubOpen && (
        <RecurringManagerModal
          isOpen={isRecurringHubOpen}
          onClose={() => setIsRecurringHubOpen(false)}
          onOpenTaskModal={onOpenTaskModal}
        />
      )}

    </div>
  );
};
