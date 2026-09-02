import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Task, PriorityLevel, TaskStatus } from '../types';
import { 
  findScheduleGaps, 
  toISODateString, 
  getDayOfWeekFromDate, 
  parse12HourToMinutes, 
  formatMinutesTo12Hour,
  addMinutesToTime, 
  isTaskScheduledForDate, 
  TimeGap, 
  isTaskInRunningSlot, 
  isTaskPastDue, 
  findSimultaneousTasks, 
  getTaskTitleClasses,
  getBufferActivityEmoji,
  getBufferActivityColor,
  isTaskInSleepWindow
} from '../utils/timeUtils';
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Layers, 
  Calendar, 
  Flame, 
  Sparkles, 
  ArrowRight, 
  ExternalLink, 
  Edit2, 
  Trash2, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Timer, 
  Hourglass, 
  Activity, 
  X, 
  Bell, 
  StickyNote,
  RotateCcw, 
  Zap,
  Coffee,
  Repeat,
  ShieldAlert,
  Lock,
  Moon
} from 'lucide-react';
import { RescheduleModal } from '../components/RescheduleModal';
import { RecurringManagerModal } from '../components/RecurringManagerModal';
import { ListTodo, CalendarDays, Grid3X3, Table as TableIcon } from 'lucide-react';

interface DashboardViewProps {
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
}

export type DashboardMode = 'time' | 'priority';

export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenTaskModal }) => {
  const { 
    tasks, 
    categories, 
    prioritySettings, 
    capacitySettings, 
    startTask, 
    pauseTask, 
    completeTask, 
    updateTask,
    extendTaskDuration,
    deleteTask,
    requestDeleteTask,
    detectConflicts,
    searchQuery,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    dailyScheduledMinutes,
    isCapacityRedLineExceeded,
    bufferNotes,
    openBufferNoteModal,
    deleteBufferNote,
    activeBufferPrompt,
    setActiveBufferPrompt,
    openEmergencyModal,
    setActiveTab
  } = useApp();

  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('time');
  const [selectedDate, setSelectedDate] = useState<string>(toISODateString(new Date()));
  const [showPriorityBacklog, setShowPriorityBacklog] = useState(false);
  const [showCompletedSection, setShowCompletedSection] = useState(true);
  const [reschedulingTask, setReschedulingTask] = useState<Task | null>(null);
  const [isRecurringHubOpen, setIsRecurringHubOpen] = useState(false);
  const [nowTime, setNowTime] = useState<Date>(new Date());

  // Status Change Handler with Smart Reschedule interceptor
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

  // Confirm Reschedule to new calculated slot
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

  // Safe non-overlapping Move to Date handler (strictly places after existing work & break time)
  const handleSafeMoveTaskToDate = (taskToMove: Task, targetDate: string) => {
    const conflicts = detectConflicts(targetDate, taskToMove.startTime, taskToMove.endTime, taskToMove.id);
    if (conflicts.length === 0) {
      updateTask({
        ...taskToMove,
        taskDate: targetDate,
        dayOfWeek: getDayOfWeekFromDate(targetDate)
      });
      return;
    }

    // Overlap prevented: automatically place after the latest conflicting task's end time + break time
    const existingOnDate = tasks.filter(t => t.taskDate === targetDate && t.id !== taskToMove.id && t.status !== 'Terminated');
    const sortedOnDate = [...existingOnDate].sort((a, b) => parse12HourToMinutes(b.endTime) - parse12HourToMinutes(a.endTime));
    const latestTask = sortedOnDate[0];
    const bufferMin = latestTask?.bufferMinutes ?? (capacitySettings.defaultBufferMinutes || 15);
    const safeStart = latestTask ? addMinutesToTime(latestTask.endTime, bufferMin) : '09:00 AM';
    const safeEnd = addMinutesToTime(safeStart, taskToMove.appointedMinutes);

    updateTask({
      ...taskToMove,
      taskDate: targetDate,
      dayOfWeek: getDayOfWeekFromDate(targetDate),
      startTime: safeStart,
      endTime: safeEnd
    });
  };

  // Live timer tick every second for accurate countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dayOfWeek = getDayOfWeekFromDate(selectedDate);
  const isRedLine = isCapacityRedLineExceeded(selectedDate);
  const scheduledMinutes = dailyScheduledMinutes(selectedDate);

  // Priority Queue: Strictly Incomplete and Hold tasks across system sorted by Priority
  const priorityBacklogTasks = tasks.filter(t => 
    t.status === 'Incomplete' || t.status === 'Hold'
  ).sort((a, b) => {
    const pWeight: Record<PriorityLevel, number> = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };
    if (pWeight[a.priority] !== pWeight[b.priority]) {
      return pWeight[a.priority] - pWeight[b.priority];
    }
    return a.taskDate.localeCompare(b.taskDate);
  });

  // Filter tasks for selected date (including Daily, Selected Days, Weekly, Monthly, Yearly recurrence)
  const dateTasks = tasks.filter(t => {
    if (!isTaskScheduledForDate(t, selectedDate)) return false;
    if (selectedCategoryFilter && t.category !== selectedCategoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchCode = t.projectCode.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchCode && !matchDesc) return false;
    }
    return true;
  }).sort((a, b) => {
    const aIncomplete = a.status === 'Incomplete';
    const bIncomplete = b.status === 'Incomplete';

    // 1. Incompleted tasks automatically sink down to the bottom
    if (aIncomplete !== bIncomplete) {
      return aIncomplete ? 1 : -1;
    }

    // 2. Priority-Based Mode: Strictly order by Priority (P1 -> P2 -> P3 -> P4 -> P5), then by time
    if (dashboardMode === 'priority') {
      const pWeight: Record<PriorityLevel, number> = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };
      if (pWeight[a.priority] !== pWeight[b.priority]) {
        return pWeight[a.priority] - pWeight[b.priority];
      }
      return parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime);
    }

    // 3. Time-Based Mode (Default): Strictly order chronologically by startTime
    return parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime);
  });

  // Find Gaps in today's schedule (automatically adjusted when buffer notes & post-task buffers are present)
  const gaps: TimeGap[] = findScheduleGaps(
    tasks.filter(t => isTaskScheduledForDate(t, selectedDate)),
    capacitySettings.dayStartTime,
    capacitySettings.dayEndTime,
    bufferNotes.filter(n => n.date === selectedDate),
    capacitySettings.defaultBufferMinutes || 15
  );

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* Sleek Compact Top Bar: Responsive & Multi-Device Optimized */}
      <div className="glass-panel p-2.5 sm:px-3 sm:py-2 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 border border-theme-border shadow-sm">
        
        {/* Left Side: Date Selector, Quick Chips & Action */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          <div className="flex items-center gap-1.5 bg-theme-card-hover px-2 py-1 rounded-xl border border-theme-border shrink-0">
            <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="font-bold text-xs text-theme-text bg-transparent focus:outline-none cursor-pointer"
            />
            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-theme-card text-theme-muted border border-theme-border font-mono">
              {dayOfWeek.slice(0, 3)}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                const d = new Date();
                setSelectedDate(toISODateString(d));
              }}
              className={`px-2 py-1 rounded-xl text-xs font-bold transition-all ${
                selectedDate === toISODateString(new Date())
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text border border-theme-border'
              }`}
            >
              Today
            </button>

            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                setSelectedDate(toISODateString(d));
              }}
              className="px-2 py-1 rounded-xl text-xs font-semibold bg-theme-card-hover text-theme-muted hover:text-theme-text border border-theme-border transition-colors"
            >
              Tomorrow
            </button>
          </div>

          {/* Priority Backlog Toggle Button */}
          <button
            onClick={() => setShowPriorityBacklog(!showPriorityBacklog)}
            className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold transition-all shadow-sm ${
              showPriorityBacklog
                ? 'bg-gradient-to-r from-red-500 to-amber-500 text-white ring-1 ring-red-400/40'
                : 'bg-theme-card-hover text-theme-text hover:bg-theme-border border border-theme-border'
            }`}
            title="Toggle Priority Queue"
          >
            <Flame className={`w-3.5 h-3.5 ${showPriorityBacklog ? 'text-white' : 'text-red-500'}`} />
            <span className="hidden md:inline">Priority Queue</span>
            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
              showPriorityBacklog ? 'bg-white/25 text-white' : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
            }`}>
              {priorityBacklogTasks.length}
            </span>
          </button>

          {/* Recurring Hub Button */}
          <button
            onClick={() => setIsRecurringHubOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold bg-theme-card-hover text-theme-muted hover:text-theme-text border border-theme-border transition-colors"
            title="Manage All Recurring Tasks & Schedules"
          >
            <Repeat className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden md:inline">Recurring Hub</span>
            <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              {tasks.filter(t => t.recurrence && t.recurrence !== 'None').length}
            </span>
          </button>

          {/* + Buffer Note Button */}
          <button
            onClick={() => openBufferNoteModal({ date: selectedDate })}
            className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl shadow-sm transition-all transform active:scale-95 shrink-0"
            title="Log Buffer Note / Free Time"
          >
            <Plus className="w-3 h-3 stroke-[3]" />
            <Coffee className="w-3.5 h-3.5" />
          </button>

          {/* + Emergency Sign Button */}
          <button
            onClick={() => openEmergencyModal({ date: selectedDate })}
            className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl shadow-sm shadow-red-500/25 transition-all transform active:scale-95 shrink-0"
            title="🚨 Emergency BUFFER (Loadshedding, Illness, Crisis) & Reschedule Day"
          >
            <Plus className="w-3 h-3 stroke-[3]" />
            <ShieldAlert className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>

        {/* Right Side: Mode Switcher & Primary Schedule CTA */}
        <div className="flex items-center justify-between md:justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-theme-border/50">
          <div className="flex items-center gap-0.5 p-0.5 bg-theme-card-hover rounded-xl border border-theme-border shadow-inner">
            <button
              onClick={() => setDashboardMode('time')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                dashboardMode === 'time'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'text-theme-muted hover:text-theme-text hover:bg-theme-card/50'
              }`}
              title="Time-Based Chronological Sequence (Default)"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Time based</span>
            </button>

            <button
              onClick={() => setDashboardMode('priority')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                dashboardMode === 'priority'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'text-theme-muted hover:text-theme-text hover:bg-theme-card/50'
              }`}
              title="Priority-Based Ordering (P1 Must-Do to P5 Noise)"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Priority Based</span>
            </button>
          </div>

          <button
            onClick={() => onOpenTaskModal(undefined, selectedDate)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all transform active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Schedule</span>
          </button>
        </div>

      </div>

      {/* Active Post-Task Buffer Prompt Banner */}
      {activeBufferPrompt && (
        <div className="glass-panel p-4 rounded-2xl border-2 border-amber-400 dark:border-amber-600 bg-amber-50/90 dark:bg-amber-950/50 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-lg shadow-md shadow-amber-500/25 shrink-0">
              ☕
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-amber-950 dark:text-amber-100 font-display">
                  ⚡ Free-Time Buffer Active ({activeBufferPrompt.startTime} - {activeBufferPrompt.endTime} • {activeBufferPrompt.durationMinutes}m)
                </h4>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 animate-pulse">
                  24H Tracker
                </span>
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 font-medium">
                What did you do during this free buffer time? Log notes to keep your 24 hours 100% on track.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => {
                openBufferNoteModal({
                  date: activeBufferPrompt.date,
                  startTime: activeBufferPrompt.startTime,
                  endTime: activeBufferPrompt.endTime,
                  durationMinutes: activeBufferPrompt.durationMinutes,
                  relatedTaskId: activeBufferPrompt.relatedTaskId,
                  relatedTaskTitle: activeBufferPrompt.relatedTaskTitle
                });
                setActiveBufferPrompt(null);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/25 transition-all transform active:scale-95"
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Log Buffer Note</span>
            </button>
            <button
              onClick={() => setActiveBufferPrompt(null)}
              className="p-2 rounded-xl hover:bg-amber-200/50 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-xs font-bold"
              title="Dismiss Prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Priority-Based Backlog & Queue Panel */}
      {showPriorityBacklog && (
        <div className="glass-panel p-5 rounded-2xl border-2 border-red-400/50 dark:border-red-700 shadow-xl space-y-4 animate-slide-up bg-red-50/15 dark:bg-red-950/10">
          <div className="flex items-center justify-between border-b border-theme-border pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/25">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-theme-text font-display flex items-center gap-2">
                  <span>Priority Queue: Incomplete & Hold Tasks</span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300">
                    {priorityBacklogTasks.length} Incomplete / Hold
                  </span>
                </h3>
                <p className="text-xs text-theme-muted">
                  Strictly prioritized (P1 Must-Do to P5 Noise) for immediate attention.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPriorityBacklog(false)}
              className="p-1.5 rounded-lg hover:bg-theme-card text-theme-muted hover:text-theme-text transition-colors"
              title="Close Priority Queue"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grouped by Priority P1 to P5 */}
          {priorityBacklogTasks.length === 0 ? (
            <div className="p-8 text-center text-xs text-theme-muted">
              🎉 No incomplete or hold tasks found! All schedules are fully up to date.
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {(['P1', 'P2', 'P3', 'P4', 'P5'] as PriorityLevel[]).map((p) => {
                const groupTasks = priorityBacklogTasks.filter(t => t.priority === p);
                if (groupTasks.length === 0) return null;
                const meta = prioritySettings[p];

                return (
                  <div key={p} className="space-y-2">
                    {/* Priority Header */}
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
                      <span 
                        className="px-2 py-0.5 rounded font-black text-xs" 
                        style={{ backgroundColor: meta.bgColor, color: meta.color }}
                      >
                        {p}
                      </span>
                      <span className="text-theme-text">{meta.label}</span>
                      <span className="text-theme-muted font-mono text-[11px]">
                        ({groupTasks.length} {groupTasks.length === 1 ? 'task' : 'tasks'} • Auto {meta.defaultMinutes}m)
                      </span>
                    </div>

                    {/* Task Cards in this Priority */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groupTasks.map((t) => {
                        const isIncomplete = t.status === 'Incomplete';
                        const isHold = t.status === 'Hold';

                        return (
                          <div
                            key={t.id}
                            className={`p-3.5 rounded-xl border bg-theme-card transition-all hover:shadow-md space-y-2.5 ${
                              isIncomplete
                                ? 'border-red-400 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20'
                                : isHold
                                  ? 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20'
                                  : 'border-theme-border'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                                  {t.projectCode}
                                </span>
                                <span className="text-[11px] font-semibold text-theme-muted">
                                  {t.category}
                                </span>
                              </div>

                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isIncomplete ? 'bg-red-600 text-white' :
                                isHold ? 'bg-amber-500 text-white' :
                                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}>
                                {t.status}
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-theme-text font-openSans line-clamp-1">
                              {t.title}
                            </h4>

                            <div className="flex items-center justify-between pt-1 border-t border-theme-border text-xs">
                              <span className="font-mono text-theme-muted font-semibold text-[11px]">
                                {t.taskDate} • {t.appointedMinutes}m
                              </span>

                              <div className="flex items-center gap-1.5">
                                {/* Safe non-overlapping move to selected date if different */}
                                {t.taskDate !== selectedDate && (
                                  <button
                                    onClick={() => handleSafeMoveTaskToDate(t, selectedDate)}
                                    className="px-2 py-1 rounded-lg bg-theme-card-hover hover:bg-theme-border text-[11px] font-bold text-blue-600 dark:text-blue-400 transition-colors"
                                    title={`Move to ${selectedDate} (automatically scheduled after work & break)`}
                                  >
                                    Move to Today
                                  </button>
                                )}

                                <button
                                  onClick={() => startTask(t.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-sm transition-all"
                                >
                                  <Play className="w-3 h-3 fill-white" />
                                  <span>Start</span>
                                </button>

                                <button
                                  onClick={() => onOpenTaskModal(t)}
                                  className="p-1 rounded hover:bg-theme-card-hover text-theme-muted hover:text-theme-text"
                                  title="Edit Task"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Tasks Timeline & Gap Finder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Scheduled Tasks List (2 Columns on large screens) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* 1. URGENT REMINDERS & P1 ALERTS (Distinct Urgent Red-Amber Card) */}
          {dateTasks.filter(t => t.category === 'Reminder' || (t.category === 'Notes' && t.priority === 'P1')).length > 0 && (
            <div className="p-4 rounded-2xl border-2 border-red-400/70 dark:border-red-800/80 bg-red-50/40 dark:bg-red-950/20 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-red-800 dark:text-red-300 uppercase tracking-wider flex items-center gap-1.5 font-display">
                  <Bell className="w-4 h-4 text-red-500 animate-pulse" />
                  <span>🔔 Reminders & Urgent P1 Alerts ({dateTasks.filter(t => t.category === 'Reminder' || (t.category === 'Notes' && t.priority === 'P1')).length})</span>
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 flex items-center gap-1">
                  <Flame className="w-2.5 h-2.5 fill-red-500" />
                  <span>P1 High Urgency</span>
                </span>
              </div>

              <div className="space-y-2">
                {dateTasks.filter(t => t.category === 'Reminder' || (t.category === 'Notes' && t.priority === 'P1')).map((rem) => {
                  const isDone = rem.status === 'Done';
                  return (
                    <div
                      key={rem.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        isDone 
                          ? 'bg-theme-card/60 border-theme-border opacity-70' 
                          : 'bg-theme-card border-red-200 dark:border-red-900/60 shadow-2xs hover:border-red-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <button
                          onClick={() => isDone ? updateTask({ ...rem, status: 'Pending' }) : completeTask(rem.id)}
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                            isDone 
                              ? 'bg-emerald-500 border-emerald-600 text-white' 
                              : 'border-red-400 hover:border-emerald-500'
                          }`}
                        >
                          {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-mono">
                              REMINDER
                            </span>
                            <span className={`text-sm font-bold text-theme-text font-openSans truncate ${isDone ? 'line-through text-theme-muted' : ''}`}>
                              {rem.title}
                            </span>
                          </div>
                          {rem.subCategory && (
                            <span className="text-[10px] text-theme-muted font-medium">
                              {rem.subCategory}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => onOpenTaskModal(rem)}
                          className="px-2 py-1 rounded-lg bg-theme-card-hover border border-theme-border text-theme-muted hover:text-theme-text text-[10px] font-bold flex items-center gap-1"
                          title="Edit Reminder"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. QUICK NOTES & THOUGHTS (Distinct Amber Sticky-Note Card) */}
          {dateTasks.filter(t => t.category === 'Notes' && t.priority !== 'P1').length > 0 && (
            <div className="p-4 rounded-2xl border-2 border-amber-300/80 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5 font-display">
                  <StickyNote className="w-4 h-4 text-amber-500" />
                  <span>📝 Daily Notes & Context ({dateTasks.filter(t => t.category === 'Notes' && t.priority !== 'P1').length})</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-mono">
                  Auto P5 Background
                </span>
              </div>

              <div className="space-y-2">
                {dateTasks.filter(t => t.category === 'Notes' && t.priority !== 'P1').map((note) => {
                  const isDone = note.status === 'Done';
                  return (
                    <div
                      key={note.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        isDone 
                          ? 'bg-theme-card/60 border-theme-border opacity-70' 
                          : 'bg-theme-card border-amber-200 dark:border-amber-900/60 shadow-2xs hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <button
                          onClick={() => isDone ? updateTask({ ...note, status: 'Pending' }) : completeTask(note.id)}
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                            isDone 
                              ? 'bg-emerald-500 border-emerald-600 text-white' 
                              : 'border-amber-400 hover:border-emerald-500'
                          }`}
                        >
                          {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono">
                              NOTE
                            </span>
                            <span className={`text-sm font-bold text-theme-text font-openSans truncate ${isDone ? 'line-through text-theme-muted' : ''}`}>
                              {note.title}
                            </span>
                          </div>
                          {(note.description || note.notes) && (
                            <p className="text-[11px] text-theme-muted line-clamp-1 mt-0.5">
                              {note.description || note.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => onOpenTaskModal(note)}
                          className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Schedule into calendar slot"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Schedule</span>
                        </button>
                        <button
                          onClick={() => onOpenTaskModal(note)}
                          className="p-1 rounded hover:bg-theme-card-hover text-theme-muted hover:text-theme-text"
                          title="Edit Note"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline Header & Count */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <span>Day Schedule Timeline</span>
              <span className="text-xs font-normal text-theme-muted">
                ({dateTasks.filter(t => t.category !== 'Reminder' && t.category !== 'Notes' && t.status !== 'Done' && t.status !== 'Terminated').length} active • {dateTasks.filter(t => t.category !== 'Reminder' && t.category !== 'Notes' && (t.status === 'Done' || t.status === 'Terminated')).length} completed)
              </span>
            </h3>
          </div>

          {/* Active Tasks Section */}
          {dateTasks.filter(t => t.category !== 'Reminder' && t.category !== 'Notes').length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 mx-auto flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-theme-text">No Timed Tasks Scheduled For This Day</h4>
              <p className="text-xs text-theme-muted max-w-sm mx-auto">
                Take advantage of scientific time-boxing. Fill an empty slot to optimize daily ROI.
              </p>
              <button
                onClick={() => onOpenTaskModal(undefined, selectedDate)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors"
              >
                + Schedule First Task
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Active / In-Progress Tasks List */}
              {dateTasks.filter(t => t.category !== 'Reminder' && t.status !== 'Done' && t.status !== 'Terminated').length === 0 ? (
                <div className="p-6 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 text-center space-y-1">
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 font-display flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>All Scheduled Tasks For Today Are Completed! 🎉</span>
                  </div>
                  <p className="text-xs text-theme-muted">
                    Check completed tasks in the finished archive below or schedule new high-ROI work.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dateTasks
                    .filter(t => t.category !== 'Reminder' && t.status !== 'Done' && t.status !== 'Terminated')
                    .map((task, idx, arr) => {
                      const priorityMeta = prioritySettings[task.priority];
                      const currentMins = nowTime.getHours() * 60 + nowTime.getMinutes();
                      const todayStrVal = toISODateString(nowTime);
                      const isWorking = task.status === 'Working';
                      const isIncomplete = task.status === 'Incomplete';
                      
                      const isCurrentRunningSlot = isTaskInRunningSlot(task.taskDate, task.startTime, task.endTime, nowTime);
                      const isRunning = isWorking || (task.status === 'Pending' && isCurrentRunningSlot);

                      const isDue = isIncomplete || 
                        (task.status === 'Pending' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, nowTime)) ||
                        (task.status === 'Working' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, nowTime));

                      const simultaneousList = findSimultaneousTasks(task, dateTasks);
                      const isSimultaneous = simultaneousList.length > 0;
                      const isInSleep = isTaskInSleepWindow(task, capacitySettings);

                      const isFirstIncomplete = isIncomplete && (idx === 0 || arr[idx - 1].status !== 'Incomplete');

                      return (
                        <React.Fragment key={task.id}>
                          {isFirstIncomplete && (
                            <div className="pt-4 pb-1.5 flex items-center gap-2">
                              <div className="h-px bg-red-300/60 dark:bg-red-900/60 flex-1" />
                              <span className="text-[11px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 font-display flex items-center gap-1.5 px-3.5 py-1 bg-red-100/60 dark:bg-red-950/60 rounded-full border border-red-200 dark:border-red-900/60 shadow-sm">
                                <AlertTriangle className="w-3.5 h-3.5" /> Incomplete Queue (Priority-Ordered: P1 → P5)
                              </span>
                              <div className="h-px bg-red-300/60 dark:bg-red-900/60 flex-1" />
                            </div>
                          )}
                          <div
                            className={`p-4 rounded-2xl border transition-all duration-200 ${
                            isDue
                              ? 'bg-red-50/30 dark:bg-red-950/20 border-red-300 dark:border-red-900/60 shadow-sm'
                              : isRunning
                                ? 'bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-theme-card dark:from-blue-950/60 dark:via-sky-950/30 dark:to-theme-card border-blue-500 shadow-xl shadow-blue-500/20 ring-2 ring-blue-500/60'
                                : isInSleep
                                  ? 'bg-slate-900/95 text-slate-100 dark:bg-slate-950 dark:text-slate-100 border-indigo-900/90 shadow-md ring-1 ring-indigo-500/40 hover:border-indigo-400'
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

                              <div className="space-y-1 flex-1">
                                
                                {/* Tags & Time */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                                    isInSleep 
                                      ? 'bg-slate-800 text-indigo-200 border-indigo-700/60' 
                                      : 'text-theme-text bg-theme-card-hover border-theme-border'
                                  }`}>
                                    {task.startTime} - {task.endTime}
                                  </span>
                                  
                                  <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold">
                                    {task.projectCode}
                                  </span>

                                  <span className={`text-[11px] font-semibold ${isInSleep ? 'text-slate-400' : 'text-theme-muted'}`}>
                                     {task.category}
                                     {task.subCategory ? ` / ${task.subCategory}` : ''}
                                   </span>

                                   {/* Sleep / Night Window Badge */}
                                   {isInSleep && (
                                     <span 
                                       className="text-[10px] font-black px-2 py-0.5 bg-indigo-950/90 text-indigo-300 border border-indigo-700/80 rounded-full flex items-center gap-1 shadow-sm"
                                       title={`Task scheduled on Sleep / Recovery Window (${capacitySettings?.sleepStartTime || '11:00 PM'} - ${capacitySettings?.sleepEndTime || '06:00 AM'})`}
                                     >
                                       <Moon className="w-2.5 h-2.5 text-indigo-400" />
                                       <span>🌙 SLEEP TIME</span>
                                     </span>
                                   )}

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
                                  <p className="text-xs sm:text-sm text-theme-muted line-clamp-1 font-normal">
                                    {task.description}
                                  </p>
                                )}

                                {task.subtasks.length > 0 && (
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
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-theme-border">
                              {isWorking ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => pauseTask(task.id)}
                                    className="p-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
                                    title="Pause"
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
                                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all transform active:scale-95"
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
                                onClick={() => requestDeleteTask(task, selectedDate)}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors"
                                title="Delete Task / Occurrence"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                          </div>
                        </div>
                      </React.Fragment>
                      );
                    })}
                </div>
              )}

              {/* Completed & Terminated Section (Separated Automatically at the Bottom) */}
              {dateTasks.filter(t => t.category !== 'Reminder' && (t.status === 'Done' || t.status === 'Terminated')).length > 0 && (
                <div className="pt-6 border-t border-theme-border space-y-3">
                  <div 
                    onClick={() => setShowCompletedSection(!showCompletedSection)}
                    className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-theme-card-hover/60 hover:bg-theme-card-hover text-theme-muted transition-colors border border-theme-border/60"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-black uppercase tracking-wider text-theme-text font-display">
                        Completed & Finished Tasks ({dateTasks.filter(t => t.category !== 'Reminder' && (t.status === 'Done' || t.status === 'Terminated')).length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold">
                      <span>{showCompletedSection ? 'Collapse' : 'Expand'}</span>
                      {showCompletedSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {showCompletedSection && (
                    <div className="space-y-3 opacity-80">
                      {dateTasks
                        .filter(t => t.category !== 'Reminder' && (t.status === 'Done' || t.status === 'Terminated'))
                        .map((task) => {
                          const priorityMeta = prioritySettings[task.priority];
                          const isDone = task.status === 'Done';
                          const isTerminated = task.status === 'Terminated';

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
                                    className={`px-2.5 py-1.5 rounded-xl text-center font-black text-xs sm:text-sm min-w-[48px] shrink-0 flex items-center justify-center transition-all ${
                                      task.priority === 'P1'
                                        ? 'bg-gradient-to-tr from-rose-600 via-red-500 to-amber-400 text-white shadow-md shadow-red-500/40 ring-1 ring-red-400/60 font-display'
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
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-xs font-bold text-theme-muted bg-theme-card-hover px-2 py-0.5 rounded border border-theme-border">
                                        {task.startTime} - {task.endTime}
                                      </span>
                                      <span className="text-[11px] font-mono text-theme-muted font-bold">
                                        {task.projectCode}
                                      </span>
                                      <span className="text-[11px] font-semibold text-theme-muted">
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

                                    <div className="flex items-baseline gap-2 flex-wrap">
                                      <h4 className="text-base font-bold text-theme-muted line-through font-openSans leading-snug">
                                        {task.title}
                                      </h4>
                                      <span className="font-mono text-xs font-semibold text-theme-muted bg-theme-card-hover px-2 py-0.5 rounded border border-theme-border">
                                        ~{task.appointedMinutes}m
                                      </span>
                                    </div>

                                    {isDone ? (
                                      <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                                        <span>Execution Completed & Done • {task.totalActualMinutes || task.appointedMinutes}m (+{task.bufferMinutes ?? (capacitySettings.defaultBufferMinutes || 15)}m buffer applied)</span>
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
                                    onClick={() => requestDeleteTask(task, selectedDate)}
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

        {/* Dynamic Gap Finder & Time Matrix Column */}
        <div className="space-y-4">
          
          {/* Dynamic Gap Finder Card */}
          {(() => {
            const isSelectedToday = selectedDate === toISODateString(nowTime);
            const currentMinutesFromMidnight = nowTime.getHours() * 60 + nowTime.getMinutes();
            
            // Detect unstarted pending tasks scheduled for past or current time on Today
            const unstartedCurrentTasks = isSelectedToday
              ? dateTasks.filter(t => {
                  if (t.status !== 'Pending') return false;
                  const sMin = parse12HourToMinutes(t.startTime);
                  return sMin <= currentMinutesFromMidnight;
                })
              : [];

            return (
              <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5 font-display">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Dynamic Gap Finder
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-full">
                    {gaps.length} Free Slots
                  </span>
                </div>
                
                <p className="text-xs text-theme-muted leading-relaxed">
                  Real-time slot analysis. Before current time: suggests buffer notes. Unstarted tasks: suggests shift or buffer. After current time: suggests scheduling tasks.
                </p>

                {/* Unstarted Task Alert in Current Slot */}
                {isSelectedToday && unstartedCurrentTasks.length > 0 && (
                  <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 space-y-2.5 animate-slide-up shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-1.5 font-display">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                        <span>Current Slot Task Not Started</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
                        {unstartedCurrentTasks.length} {unstartedCurrentTasks.length === 1 ? 'Task' : 'Tasks'}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900/80 dark:text-amber-300/90 leading-tight">
                      Scheduled time has arrived but timer is not running. Start now, log elapsed idle as buffer, or shift schedule:
                    </p>

                    <div className="space-y-2">
                      {unstartedCurrentTasks.map(t => {
                        const sMin = parse12HourToMinutes(t.startTime);
                        const delayMins = Math.max(0, currentMinutesFromMidnight - sMin);
                        const nowFormatted = formatMinutesTo12Hour(currentMinutesFromMidnight);

                        return (
                          <div key={t.id} className="p-2.5 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-amber-200 dark:border-amber-900/60 space-y-2 shadow-2xs">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{t.projectCode}</span>
                                  <span className="text-xs font-bold text-theme-text truncate">{t.title}</span>
                                </div>
                                <div className="text-[10px] font-mono text-amber-800 dark:text-amber-300 font-semibold mt-0.5">
                                  Slot: {t.startTime} - {t.endTime} ({t.appointedMinutes}m) • <span className="font-bold">Overdue by {delayMins}m</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-amber-100 dark:border-amber-900/40">
                              <button
                                onClick={() => startTask(t.id)}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                                title="Start task timer right now"
                              >
                                <Play className="w-3 h-3 fill-white" />
                                <span>Start Now</span>
                              </button>

                              <button
                                onClick={() => openBufferNoteModal({
                                  date: selectedDate,
                                  startTime: t.startTime,
                                  endTime: nowFormatted,
                                  durationMinutes: Math.max(5, delayMins),
                                  relatedTaskId: t.id,
                                  relatedTaskTitle: t.title,
                                  activityTag: 'Break / Rest',
                                  notes: `Idle delay before starting ${t.title}`
                                })}
                                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                                title="Log elapsed unstarted time as a Buffer Note"
                              >
                                <Coffee className="w-3 h-3" />
                                <span>Log Buffer ({delayMins}m)</span>
                              </button>

                              <button
                                onClick={() => setReschedulingTask(t)}
                                className="px-2 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-800 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="Shift / Reschedule task"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reschedule</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {gaps.length === 0 ? (
                  <div className="p-4 rounded-xl bg-theme-card-hover border border-theme-border text-center text-xs text-theme-muted">
                    Schedule is 100% time-boxed with no remaining gaps!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {gaps.map((gap, idx) => {
                      const gStartMin = parse12HourToMinutes(gap.startTime);
                      let gEndMin = parse12HourToMinutes(gap.endTime);
                      if (gEndMin < gStartMin) gEndMin += 1440;

                      const isPastGap = isSelectedToday ? (gEndMin <= currentMinutesFromMidnight) : (selectedDate < toISODateString(nowTime));
                      const isCurrentGap = isSelectedToday && (gStartMin <= currentMinutesFromMidnight && currentMinutesFromMidnight < gEndMin);
                      const isFutureGap = isSelectedToday ? (gStartMin >= currentMinutesFromMidnight) : (selectedDate > toISODateString(nowTime));

                      return (
                        <div
                          key={idx}
                          className={`w-full p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                            isCurrentGap
                              ? 'border-emerald-400 dark:border-emerald-600 bg-gradient-to-r from-emerald-50/70 via-sky-50/50 to-blue-50/70 dark:from-emerald-950/40 dark:via-sky-950/30 dark:to-blue-950/40 ring-2 ring-emerald-400/40 shadow-sm'
                              : isPastGap
                              ? 'border-dashed border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20'
                              : 'border-dashed border-blue-300 dark:border-blue-800/80 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-100/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-mono text-xs font-bold flex items-center gap-1 ${
                                  isCurrentGap ? 'text-emerald-700 dark:text-emerald-300' :
                                  isPastGap ? 'text-amber-800 dark:text-amber-300' :
                                  'text-blue-700 dark:text-blue-300'
                                }`}>
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{gap.startTime} - {gap.endTime}</span>
                                </span>

                                {isCurrentGap && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs animate-pulse">
                                    ⚡ Free Right Now
                                  </span>
                                )}

                                {isPastGap && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                    ⏳ Past Free Window
                                  </span>
                                )}

                                {isFutureGap && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    ✨ Upcoming Slot
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-theme-muted mt-0.5">
                                Available: <strong>{gap.durationMinutes} min</strong> • {
                                  isCurrentGap
                                    ? 'Active window right now. Suggestion: Start a task now or log current break.'
                                    : isPastGap
                                    ? 'Past time without tasks. Suggestion: Add buffer note to account for your day.'
                                    : 'Future free opening. Suggestion: Schedule a high-ROI task into this slot.'
                                }
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons based on temporal state */}
                          <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-theme-border/40 flex-wrap">
                            {isPastGap ? (
                              <>
                                <button
                                  onClick={() => openBufferNoteModal({
                                    date: selectedDate,
                                    startTime: gap.startTime,
                                    endTime: gap.endTime,
                                    durationMinutes: gap.durationMinutes
                                  })}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                  title="Log what you did during this past free window"
                                >
                                  <Coffee className="w-3.5 h-3.5" />
                                  <span>Add Buffer Note</span>
                                </button>

                                <button
                                  onClick={() => onOpenTaskModal(undefined, selectedDate, gap.startTime)}
                                  className="p-1.5 rounded-xl bg-theme-card hover:bg-theme-card-hover border border-theme-border text-theme-muted hover:text-theme-text text-xs transition-colors cursor-pointer"
                                  title="Add retroactively scheduled task"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : isCurrentGap ? (
                              <>
                                <button
                                  onClick={() => onOpenTaskModal(undefined, selectedDate, formatMinutesTo12Hour(currentMinutesFromMidnight))}
                                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                  title="Schedule and start task now"
                                >
                                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Start Task Now</span>
                                </button>

                                <button
                                  onClick={() => openBufferNoteModal({
                                    date: selectedDate,
                                    startTime: gap.startTime,
                                    endTime: gap.endTime,
                                    durationMinutes: gap.durationMinutes
                                  })}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                  title="Log current break activity"
                                >
                                  <Coffee className="w-3.5 h-3.5" />
                                  <span>Log Break Note</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => onOpenTaskModal(undefined, selectedDate, gap.startTime)}
                                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                  title="Fill gap with new scheduled task"
                                >
                                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Schedule Task</span>
                                </button>

                                <button
                                  onClick={() => openBufferNoteModal({
                                    date: selectedDate,
                                    startTime: gap.startTime,
                                    endTime: gap.endTime,
                                    durationMinutes: gap.durationMinutes
                                  })}
                                  className="p-1.5 rounded-xl bg-theme-card hover:bg-theme-card-hover border border-theme-border text-theme-muted hover:text-amber-500 text-xs transition-colors cursor-pointer"
                                  title="Pre-log planned buffer note"
                                >
                                  <Coffee className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Buffer & Free-Time Notes Card for Selected Date */}
          <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <Coffee className="w-4 h-4 text-amber-500" />
                Buffer Status Notes
              </h3>
              <button
                onClick={() => openBufferNoteModal({ date: selectedDate })}
                className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
              >
                + Add Note
              </button>
            </div>

            {bufferNotes.filter(n => n.date === selectedDate).length === 0 ? (
              <div className="p-3 rounded-xl bg-theme-card-hover border border-theme-border text-center text-xs text-theme-muted">
                No buffer notes logged for this date yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {bufferNotes
                  .filter(n => n.date === selectedDate)
                  .map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-theme-text flex items-center gap-1">
                          <span>{getBufferActivityEmoji(n.activityTag)}</span>
                          <span>{n.startTime} - {n.endTime}</span>
                          <span className="text-theme-muted font-normal">({n.durationMinutes}m)</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openBufferNoteModal({ existingNote: n })}
                            className="p-1 rounded hover:bg-theme-card text-theme-muted hover:text-theme-text"
                            title="Edit"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteBufferNote(n.id)}
                            className="p-1 rounded hover:bg-red-50 text-theme-muted hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-theme-text font-medium text-[11px] line-clamp-2">
                        {n.notes || n.activityTag}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Scientific Priority Matrix Summary Card */}
          <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-3">
            <h3 className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-blue-500" />
              P1-P5 Protocol Distribution
            </h3>
            
            <div className="space-y-2">
              {(['P1', 'P2', 'P3', 'P4', 'P5'] as PriorityLevel[]).map((p) => {
                const meta = prioritySettings[p];
                const count = dateTasks.filter(t => t.priority === p).length;
                const totalMins = dateTasks
                  .filter(t => t.priority === p)
                  .reduce((acc, t) => acc + t.appointedMinutes, 0);

                return (
                  <div key={p} className="flex items-center justify-between text-xs p-2 rounded-xl bg-theme-card-hover border border-theme-border">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="font-bold text-theme-text">{p} ({meta.label})</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-theme-muted">
                      <span>{count} tasks</span>
                      <span>•</span>
                      <strong className="text-theme-text">{totalMins}m</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

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
