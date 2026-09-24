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
  isTaskInSleepWindow,
  formatDisplayDate
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
import { TableView } from '../components/views/TableView';
import { TimelineView } from '../components/views/TimelineView';
import { Day24HourView } from '../components/views/Day24HourView';
import { WeeklyCalendarView } from '../components/views/WeeklyCalendarView';
import { MonthlyCalendarView } from '../components/views/MonthlyCalendarView';
import { ListTodo, Table as TableIcon, CalendarDays, Grid3X3, Repeat, Bell, StickyNote } from 'lucide-react';
import { NotesView } from './NotesView';
import { QuickPrioritySelector } from '../components/QuickPrioritySelector';
import { QuickTimeSelector } from '../components/QuickTimeSelector';
import { QuickTaskEntryBar } from '../components/QuickTaskEntryBar';
import { CategoryBadge, RecurrenceBadge } from '../components/TaskCategoryBadge';

type TimeRangeFilter = 'ALL' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'NEXT_WEEK' | 'NEXT_MONTH' | 'NEXT_YEAR';
export type AllTasksViewMode = 'list' | 'table' | 'timeline' | '24hours' | 'weekly' | 'monthly' | 'notes_reminders';

interface AllTasksViewProps {
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
  onOpenBatchTaskModal?: () => void;
}

export const AllTasksView: React.FC<AllTasksViewProps> = ({ onOpenTaskModal, onOpenBatchTaskModal }) => {
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
    rescheduleTask,
    deleteTask,
    requestDeleteTask,
    searchQuery,
    setSearchQuery,
    openRecurringHub
  } = useApp();

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('ALL');
  const [densityMode, setDensityMode] = useState<'compact' | 'expanded'>('expanded');
  const [collapsedHorizons, setCollapsedHorizons] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<AllTasksViewMode>('list');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(toISODateString(new Date()));
  const [showCompletedArchive, setShowCompletedArchive] = useState(true);
  const [reschedulingTask, setReschedulingTask] = useState<Task | null>(null);
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
    if (newStatus === 'Working') {
      startTask(task.id);
      return;
    }
    if (newStatus === 'Done') {
      completeTask(task.id);
      return;
    }
    if (newStatus === 'Hold') {
      pauseTask(task.id);
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
    const isSimultaneous = Boolean(task.isSimultaneous);
    const simultaneousList = isSimultaneous ? findSimultaneousTasks(task, tasks) : [];
    const isInSleep = isTaskInSleepWindow(task, capacitySettings);

    return (
      <div
        key={task.id}
        className={`px-3 py-1.5 sm:py-2 rounded-xl border transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-2 group ${
          isDue
            ? 'bg-red-50/40 dark:bg-red-950/30 border-red-300 dark:border-red-900/60 shadow-2xs hover:border-red-400'
            : isRunning
              ? isInSleep
                ? 'bg-gradient-to-br from-[#060e22] via-[#0b1736] to-[#171238] text-slate-100 border-cyan-400/90 shadow-[0_0_25px_rgba(6,182,212,0.3)] ring-2 ring-cyan-500/50'
                : 'bg-gradient-to-r from-blue-50/90 via-sky-50/60 to-theme-card dark:from-blue-950/70 dark:via-sky-950/40 dark:to-theme-card border-blue-500 shadow-md ring-1 ring-blue-500/50'
              : isInSleep
              ? 'bg-gradient-to-br from-[#080c18]/98 via-[#0e1428]/98 to-[#181332]/98 text-slate-100 border-indigo-500/35 shadow-sm'
              : isSimultaneous
                ? 'bg-purple-50/20 dark:bg-purple-950/10 border-purple-300 dark:border-purple-800/80 shadow-2xs'
                : 'bg-theme-card hover:bg-theme-card-hover border-theme-border shadow-2xs'
        }`}
      >
        {/* Left Core Data: Priority + Code + Title + Time + Badges */}
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
          {/* Priority Badge */}
          <QuickPrioritySelector task={task} size="sm" />

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
          <QuickTimeSelector task={task} />

          {/* Date (if not today) */}
          {task.taskDate !== toISODateString(nowTime) && (
            <span className="font-mono text-[10px] text-theme-muted hidden xl:inline-flex items-center gap-0.5 shrink-0">
              <Calendar className="w-2.5 h-2.5 text-theme-muted" />
              <span>{task.taskDate.slice(5)}</span>
            </span>
          )}

          {/* Category Badge */}
          <CategoryBadge 
            categoryName={task.category} 
            subCategory={task.subCategory} 
            categories={categories} 
            size="sm" 
            onClick={() => setSelectedCategory(task.category === selectedCategory ? 'ALL' : task.category)}
            className="hidden sm:inline-flex"
          />

          {/* Routine Recurrence Badge */}
          <RecurrenceBadge 
            recurrence={task.recurrence} 
            selectedDays={task.selectedDays} 
            size="sm" 
          />

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
            <span 
              className="text-[9px] font-black px-1.5 py-0.2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded shrink-0 shadow-2xs" 
              title={simultaneousList.length > 0 ? `Simultaneous with ${simultaneousList.map(s => s.projectCode).join(', ')}` : 'Marked to run simultaneously (Free on Gap Finder)'}
            >
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
                className="btn-pro btn-pro-warning p-1 rounded-lg shadow-2xs"
                title="Pause Task"
              >
                <Pause className="w-3 h-3" />
              </button>
              <button
                onClick={() => completeTask(task.id)}
                className="btn-pro btn-pro-success flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-2xs"
                title="Mark as Done"
              >
                <Check className="w-3 h-3" />
                <span className="hidden sm:inline">Done</span>
              </button>
            </div>
          ) : task.status !== 'Done' && (
            <button
              onClick={() => completeTask(task.id)}
              className="btn-pro btn-pro-success flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold shadow-2xs cursor-pointer"
              title="Mark as Done"
            >
              <Check className="w-2.5 h-2.5 stroke-[2.5]" />
              <span>Done</span>
            </button>
          )}

          {/* Reschedule Button */}
          {!task.isMandatorySchedule && (
            <button
              onClick={() => handleStatusChange(task, 'Reschedule')}
              className="btn-pro-icon p-1 rounded-lg hover:text-purple-600"
              title="Smart Reschedule"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Edit Button */}
          <button
            onClick={() => onOpenTaskModal(task)}
            className="btn-pro-icon p-1 rounded-lg"
            title="Edit Task"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {/* Delete Button */}
          <button
            onClick={() => requestDeleteTask(task, selectedCalendarDate || task.taskDate)}
            className="btn-pro-icon p-1 rounded-lg hover:text-red-500 hover:border-red-300 dark:hover:border-red-800"
            title="Delete Task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Comfortable View Task Card (Dashboard-matching compact & sleek design)
  const renderTaskExpanded = (task: Task) => {
    const priorityMeta = prioritySettings[task.priority];
    const isWorking = task.status === 'Working';
    const isIncomplete = task.status === 'Incomplete';
    const now = nowTime;
    const isCurrentRunningSlot = isTaskInRunningSlot(task.taskDate, task.startTime, task.endTime, now);
    const isRunning = isWorking || (task.status === 'Pending' && isCurrentRunningSlot);
    const isDue = isIncomplete || 
      (task.status === 'Pending' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, now)) ||
      (task.status === 'Working' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, now));
    const isSimultaneous = Boolean(task.isSimultaneous);
    const simultaneousList = isSimultaneous ? findSimultaneousTasks(task, tasks) : [];
    const isInSleep = isTaskInSleepWindow(task, capacitySettings);

    return (
      <div
        key={task.id}
        className={`px-3.5 py-2 sm:py-2.5 rounded-xl border transition-all duration-200 relative overflow-hidden ${
          isInSleep
            ? isDue
              ? 'card-night-due'
              : isWorking
                ? 'card-night-working'
                : isRunning
                  ? 'card-night-working'
                  : 'card-night-cosmic'
            : isDue
              ? 'bg-red-50/30 dark:bg-red-950/20 border-red-300 dark:border-red-900/60 shadow-sm'
              : isWorking
                ? 'bg-theme-card border-blue-500/80 shadow-lg shadow-blue-500/15 ring-1 ring-blue-500/40 card-working-ambient'
                : isRunning
                  ? 'bg-theme-card border-blue-400/60 shadow-md ring-1 ring-blue-400/30'
                  : isSimultaneous
                    ? 'bg-theme-card border-purple-300 dark:border-purple-800 hover:shadow-md'
                    : 'bg-theme-card border-theme-border hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
        }`}
      >
        {/* Seamless Card Border State: Pulsing Left Accent Bar when Working */}
        {isWorking && (
          <div className={`glow-accent-bar animate-pulse ${
            isInSleep 
              ? 'bg-gradient-to-b from-cyan-400 via-sky-400 to-indigo-500 shadow-[0_0_12px_rgba(6,182,212,0.8)]' 
              : ''
          }`} />
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 relative z-10">
          
          {/* Left: Priority + Time + Title */}
          <div className="flex items-start gap-2 sm:gap-2.5 flex-1 min-w-0">
            <QuickPrioritySelector task={task} size="sm" />

            <div className="space-y-1 flex-1 min-w-0">
              
              {/* Task Title + Duration */}
              <div className="flex items-center gap-2 flex-wrap">
                <h4 
                  onClick={() => onOpenTaskModal(task)}
                  className={`cursor-pointer hover:text-blue-600 transition-colors ${
                    isInSleep
                      ? isWorking
                        ? 'card-night-working-title text-base sm:text-lg font-bold font-display leading-tight truncate'
                        : 'card-night-title text-base sm:text-lg font-bold font-display leading-tight truncate'
                      : task.status === 'Done'
                        ? 'text-base sm:text-lg font-bold line-through text-theme-muted opacity-75 truncate'
                        : isWorking
                          ? 'text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 font-display leading-tight truncate'
                          : 'text-base sm:text-lg font-bold text-theme-text font-display leading-tight truncate'
                  }`}
                  title={task.title}
                >
                  {task.title}
                </h4>
                <span className={`font-mono text-[10px] sm:text-[11px] font-semibold px-1.5 py-0.2 rounded border shadow-2xs ${
                  isInSleep
                    ? 'night-time-pill'
                    : 'text-theme-muted bg-theme-card-hover/80 border-theme-border'
                }`}>
                  ~{task.appointedMinutes}m
                </span>
              </div>

              {/* Context row: Time, Date, Project Code, Category, Badges */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <QuickTimeSelector task={task} isInSleep={isInSleep} />

                {/* Date with day of week */}
                <span className="font-mono text-[11px] text-theme-muted flex items-center gap-1 font-semibold">
                  <Calendar className="w-3 h-3 text-blue-500" />
                  <span>{formatDisplayDate(task.taskDate)} ({task.dayOfWeek.slice(0, 3)})</span>
                </span>

                {/* Project Code */}
                <span className={`text-[11px] font-mono font-bold transition-colors ${
                  isInSleep
                    ? 'text-cyan-300 bg-white/10 px-1.5 py-0.5 rounded border border-cyan-400/20 hover:text-cyan-200'
                    : 'text-theme-muted hover:text-blue-500'
                }`}>
                  {task.projectCode}
                </span>

                {/* Category Badge */}
                <CategoryBadge 
                  categoryName={task.category} 
                  subCategory={task.subCategory} 
                  categories={categories}
                  onClick={() => setSelectedCategory(task.category === selectedCategory ? 'ALL' : task.category)}
                />

                {/* Rescheduled Tracker Badge */}
                {Boolean(task.rescheduleCount && task.rescheduleCount > 0) && (
                  <span 
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${
                      isInSleep
                        ? 'border-purple-400/40 bg-purple-500/20 text-purple-200'
                        : 'border-purple-300 dark:border-purple-800 bg-purple-50/80 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                    }`}
                    title={`Rescheduled ${task.rescheduleCount}x`}
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Rescheduled {task.rescheduleCount}x</span>
                  </span>
                )}

                {/* Mandatory Fixed Schedule Badge */}
                {task.isMandatorySchedule && (
                  <span 
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${
                      isInSleep
                        ? 'border-white/15 bg-white/10 text-slate-300'
                        : 'border-theme-border/70 bg-theme-card-hover/40 text-theme-muted'
                    }`}
                    title="Mandatory Fixed Schedule"
                  >
                    <Lock className="w-2.5 h-2.5 text-theme-muted" />
                    <span>Fixed</span>
                  </span>
                )}

                {/* Sleep Window Badge */}
                {isInSleep && (
                  <span 
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-indigo-400/50 bg-indigo-900/60 text-indigo-200 flex items-center gap-1 shrink-0 shadow-2xs"
                    title="Scheduled in Sleep Window"
                  >
                    <Moon className="w-2.5 h-2.5 text-indigo-300" />
                    <span>Sleep Zone</span>
                  </span>
                )}

                {/* Routine Recurrence Badge */}
                <RecurrenceBadge 
                  recurrence={task.recurrence} 
                  selectedDays={task.selectedDays} 
                />

                {/* Simultaneous Badge */}
                {isSimultaneous && (
                  <span 
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${
                      isInSleep
                        ? 'border-purple-400/50 bg-purple-900/60 text-purple-200'
                        : 'border-purple-200/80 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300'
                    }`}
                    title={simultaneousList.length > 0 ? `Co-running simultaneously with: ${simultaneousList.map(s => `${s.projectCode} (${s.title})`).join(', ')}` : 'Marked to run simultaneously'}
                  >
                    <Zap className="w-2.5 h-2.5 text-purple-400" />
                    <span>{simultaneousList.length > 0 ? `Simultaneous (${simultaneousList.length})` : 'Simultaneous'}</span>
                  </span>
                )}

                {/* Primary High-Saturation Signal */}
                {isDue ? (
                  <span className="text-[11px] font-black tracking-wider px-2.5 py-0.5 bg-red-600 text-white rounded-full flex items-center gap-1.5 shadow-sm animate-pulse">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    <span>{isIncomplete ? '⚠️ INCOMPLETE' : isWorking ? '⚡ OVERTIME DUE' : '🚨 DUE NOW'}</span>
                  </span>
                ) : isRunning ? (
                  <span className={`text-[11px] font-black tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-md ${
                    isInSleep
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-500/40 ring-1 ring-white/30'
                      : 'bg-blue-600 text-white shadow-blue-500/40'
                  }`}>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-200 opacity-90"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    <span>{isWorking ? (isInSleep ? '⚡ NIGHT WORKING' : '⚡ WORKING NOW') : '⚡ RUNNING TIME'}</span>
                  </span>
                ) : null}

                {/* Live Status Badge + Countdown Pill (inline in metadata row) */}
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                  className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-lg border cursor-pointer focus:outline-none transition-colors ${
                    task.status === 'Done' ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' :
                    task.status === 'Terminated' ? 'bg-red-600 text-white border-red-600 shadow-xs' :
                    task.status === 'Working' ? (
                      isInSleep 
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400 shadow-xs animate-pulse'
                        : 'bg-blue-600 text-white border-blue-600 shadow-xs animate-pulse'
                    ) :
                    task.status === 'Hold' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950' :
                    task.status === 'Incomplete' ? 'bg-red-600 text-white border-red-600 shadow-xs' :
                    task.status === 'Reschedule' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                    isInSleep
                      ? 'bg-slate-900 text-white border-slate-700'
                      : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <option value="Pending" className="bg-slate-900 text-white">● Pending</option>
                  <option value="Working" className="bg-slate-900 text-white">⚡ Working</option>
                  <option value="Done" className="bg-slate-900 text-white">✓ Done</option>
                  <option value="Hold" className="bg-slate-900 text-white">⏸ Hold</option>
                  <option value="Incomplete" className="bg-slate-900 text-white">⚠️ Incomplete</option>
                  <option value="Reschedule" className="bg-slate-900 text-white">↻ Reschedule</option>
                  <option value="Terminated" className="bg-slate-900 text-white">✕ Terminated</option>
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
                      <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-sm ${
                        isOvertime
                          ? 'bg-amber-400 text-amber-950 animate-pulse font-black'
                          : isInSleep
                          ? 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/50 font-black shadow-cyan-500/20'
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
                        <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                          isInSleep
                            ? 'night-time-pill'
                            : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800'
                        }`}>
                          <Timer className="w-3 h-3 text-blue-500" />
                          <span>Starts in {h > 0 ? `${h}h ` : ''}{m}m</span>
                        </span>
                      );
                    }
                  }

                  if (task.status === 'Done') {
                    const workMins = task.totalActualMinutes || task.appointedMinutes;
                    return (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1 shadow-2xs">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Work Time: {workMins}m</span>
                        {task.actualEndTime && (
                          <span className="text-theme-muted font-normal text-[11px]">({task.startTime} - {task.actualEndTime})</span>
                        )}
                      </span>
                    );
                  }

                  return null;
                })()}
              </div>

              {/* Simultaneous Co-Running Twin Details */}
              {isSimultaneous && simultaneousList.length > 0 && (
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

              {task.description && (
                <p className={`text-xs sm:text-sm line-clamp-1 font-normal ${
                  isInSleep ? 'text-slate-300' : 'text-theme-muted'
                }`}>
                  {task.description}
                </p>
              )}

              {task.subtasks && task.subtasks.length > 0 && (
                <div className="flex items-center gap-2 pt-1 text-[11px] text-theme-muted font-medium">
                  <Layers className="w-3 h-3 text-purple-500" />
                  <span>
                    {task.subtasks.filter(s => s.isCompleted).length} / {task.subtasks.length} Sub-tasks Completed
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className={`flex items-center gap-1.5 w-full sm:w-auto justify-end pt-1.5 sm:pt-0 border-t sm:border-t-0 relative z-10 ${
            isInSleep ? 'border-white/10' : 'border-theme-border'
          }`}>
            {isWorking ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => pauseTask(task.id)}
                  className="btn-pro btn-pro-warning p-1.5 rounded-lg shadow-2xs"
                  title="Pause Task"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => completeTask(task.id)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs transition-all active:scale-95 ${
                    isInSleep
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/30 ring-1 ring-white/20'
                      : 'btn-pro btn-pro-success'
                  }`}
                  title="Mark Task as Done"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Done</span>
                </button>
              </div>
            ) : task.status !== 'Done' && (
              <button
                onClick={() => completeTask(task.id)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs active:scale-95 transition-all cursor-pointer ${
                  isInSleep
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/30 ring-1 ring-white/20'
                    : 'btn-pro btn-pro-success'
                }`}
                title="Mark Task as Done"
              >
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Done</span>
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
                className={
                  isInSleep 
                    ? 'night-btn-icon p-1.5 rounded-lg'
                    : 'btn-pro-icon p-1.5 rounded-lg hover:text-purple-600 hover:border-purple-300 dark:hover:border-purple-800'
                }
                title="Reschedule Task / Find Slot"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => onOpenTaskModal(task)}
              className={
                isInSleep 
                  ? 'night-btn-icon p-1.5 rounded-lg'
                  : 'btn-pro-icon p-1.5 rounded-lg'
              }
              title="Edit Task"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => requestDeleteTask(task, selectedCalendarDate || task.taskDate)}
              className={
                isInSleep
                  ? 'night-btn-icon p-1.5 rounded-lg hover:text-red-400'
                  : 'btn-pro-icon p-1.5 rounded-lg hover:text-red-500 hover:border-red-300 dark:hover:border-red-800'
              }
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
      
      {/* View Switcher Box & Actions Toolbar */}
      <div className="glass-panel p-3 sm:p-4 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
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

            <button
              onClick={() => setViewMode('notes_reminders')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                viewMode === 'notes_reminders'
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-sm'
                  : 'text-theme-muted hover:text-theme-text hover:bg-theme-card'
              }`}
              title="Split View: Note | Reminder Dual Matrix"
            >
              <div className="flex items-center -space-x-1">
                <StickyNote className="w-3.5 h-3.5" />
                <Bell className="w-3.5 h-3.5" />
              </div>
              <span>Note | Reminder</span>
            </button>
          </div>

          {/* Density Mode Switcher (Dashboard Cards vs Compact List) */}
          {viewMode === 'list' && (
            <div className="flex items-center gap-1 p-1 bg-theme-card-hover rounded-xl border border-theme-border shadow-inner shrink-0">
              <button
                type="button"
                onClick={() => setDensityMode('expanded')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  densityMode === 'expanded'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
                title="Dashboard Cards: Full sleek task cards matching Dashboard view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Dashboard Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setDensityMode('compact')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  densityMode === 'compact'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
                title="Compact List: Dense 1-line list"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Compact List</span>
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
            onClick={openRecurringHub}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-all shadow-sm"
            title="Manage All Recurring Tasks"
          >
            <Repeat className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Recurring Hub ({tasks.filter(t => t.recurrence && t.recurrence !== 'None').length})</span>
          </button>

          {onOpenBatchTaskModal && (
            <button
              onClick={onOpenBatchTaskModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Batch Add / Import Tasks (Text, Excel, CSV)"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Batch Add</span>
            </button>
          )}

          <button
            onClick={() => onOpenTaskModal(undefined, selectedCalendarDate)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Task</span>
          </button>
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

      {viewMode === 'notes_reminders' && (
        <div className="pt-2">
          <NotesView onOpenTaskModal={onOpenTaskModal} />
        </div>
      )}

      {viewMode === 'list' && (
        <>
          {/* Quick Fast-Entry Task System */}
          <QuickTaskEntryBar
            selectedDate={selectedCalendarDate}
            onDateChange={setSelectedCalendarDate}
          />

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
                                  {formatDisplayDate(task.taskDate)} • {task.startTime}-{task.endTime} ({task.appointedMinutes}m)
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
                            className={`px-3.5 py-2.5 rounded-xl border transition-all ${
                              isDone 
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 shadow-2xs'
                                : 'bg-red-50/40 dark:bg-red-950/20 border-red-300 dark:border-red-800/80 shadow-2xs'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                <QuickPrioritySelector task={task} size="sm" />

                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap text-xs">
                                    <span className="font-mono font-bold text-theme-muted bg-theme-card-hover px-1.5 py-0.5 rounded border border-theme-border text-[11px]">
                                      {task.projectCode}
                                    </span>
                                    <span className="text-theme-muted flex items-center gap-1 font-mono font-semibold text-[11px]">
                                      <Calendar className="w-3 h-3 text-theme-muted" />
                                      {formatDisplayDate(task.taskDate)}
                                    </span>
                                    <span className="font-mono text-theme-muted font-bold text-[11px]">
                                      {task.startTime} - {task.endTime}
                                    </span>
                                    <CategoryBadge 
                                      categoryName={task.category} 
                                      subCategory={task.subCategory} 
                                      categories={categories} 
                                      size="sm" 
                                    />
                                    <RecurrenceBadge 
                                      recurrence={task.recurrence} 
                                      selectedDays={task.selectedDays} 
                                      size="sm" 
                                    />
                                    <span className={`text-[10px] font-black px-2 py-0.2 rounded-full flex items-center gap-1 shadow-2xs ${
                                      isDone 
                                        ? 'bg-emerald-600 text-white' 
                                        : 'bg-red-600 text-white'
                                    }`}>
                                      {isDone ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <X className="w-2.5 h-2.5 stroke-[3]" />}
                                      <span>{isDone ? 'Done' : 'Terminated'}</span>
                                    </span>
                                  </div>

                                  <h4 className="text-sm font-bold text-theme-muted line-through font-display leading-tight truncate">
                                    {task.title}
                                  </h4>

                                  {isDone ? (
                                    <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span>Execution Completed & Done • {task.totalActualMinutes || task.appointedMinutes}m</span>
                                    </div>
                                  ) : (
                                    <div className="text-[11px] font-mono text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                                      <X className="w-3 h-3 text-red-500" />
                                      <span>Terminated & Closed • {task.totalActualMinutes || task.appointedMinutes}m</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end pt-1.5 sm:pt-0 border-t sm:border-t-0 border-theme-border">
                                <button
                                  onClick={() => updateTask({ ...task, status: 'Pending' })}
                                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-theme-card-hover hover:bg-theme-border text-theme-text transition-colors"
                                  title="Reopen Task"
                                >
                                  Reopen
                                </button>
                                <button
                                  onClick={() => onOpenTaskModal(task)}
                                  className="btn-pro-icon p-1.5 rounded-lg"
                                  title="Edit Task"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => requestDeleteTask(task, selectedCalendarDate || task.taskDate)}
                                  className="btn-pro-icon p-1.5 rounded-lg hover:text-red-500 hover:border-red-300 dark:hover:border-red-800"
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

    </div>
  );
};
