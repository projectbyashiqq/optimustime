import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Task, PriorityLevel, TaskStatus } from '../types';
import { 
  findScheduleGaps, 
  toISODateString, 
  getDayOfWeekFromDate, 
  parse12HourToMinutes,
  addMinutesToTime,
  isTaskScheduledForDate,
  TimeGap
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
  RotateCcw
} from 'lucide-react';
import { RescheduleModal } from '../components/RescheduleModal';

interface DashboardViewProps {
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
}

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
    deleteTask,
    detectConflicts,
    searchQuery,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    dailyScheduledMinutes,
    isCapacityRedLineExceeded
  } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(toISODateString(new Date()));
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [showPriorityBacklog, setShowPriorityBacklog] = useState(false);
  const [showCompletedSection, setShowCompletedSection] = useState(true);
  const [reschedulingTask, setReschedulingTask] = useState<Task | null>(null);
  const [nowTime, setNowTime] = useState<Date>(new Date());

  // Status Change Handler with Smart Reschedule interceptor
  const handleStatusChange = (task: Task, newStatus: TaskStatus) => {
    if (newStatus === 'Reschedule') {
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
    const bufferMin = latestTask?.bufferMinutes ?? 15;
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
    if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (selectedCategoryFilter && t.category !== selectedCategoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchCode = t.projectCode.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchCode && !matchDesc) return false;
    }
    return true;
  }).sort((a, b) => parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime));

  // Find Gaps in today's schedule
  const gaps: TimeGap[] = findScheduleGaps(
    tasks.filter(t => isTaskScheduledForDate(t, selectedDate)),
    capacitySettings.dayStartTime,
    capacitySettings.dayEndTime
  );

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Date Bar & High-Level Metrics */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Date Selector */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="font-bold text-sm sm:text-base text-theme-text bg-transparent focus:outline-none cursor-pointer"
              />
              <span className="text-xs px-2 py-0.5 rounded-full bg-theme-card-hover font-semibold text-theme-muted border border-theme-border">
                {dayOfWeek}
              </span>
            </div>
            <p className="text-xs text-theme-muted">
              {dateTasks.length} Scheduled Tasks • {Math.floor(scheduledMinutes / 60)}h {scheduledMinutes % 60}m Allocated
            </p>
          </div>
        </div>

        {/* Action & Toggle Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Priority Backlog Toggle Button */}
          <button
            onClick={() => setShowPriorityBacklog(!showPriorityBacklog)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
              showPriorityBacklog
                ? 'bg-gradient-to-r from-red-500 to-amber-500 text-white ring-2 ring-red-400/40'
                : 'bg-theme-card-hover text-theme-text hover:bg-theme-border border border-theme-border'
            }`}
            title="Toggle Priority-Based Incomplete / Hold Tasks"
          >
            <Flame className={`w-4 h-4 ${showPriorityBacklog ? 'text-white' : 'text-red-500'}`} />
            <span>Priority Queue (Incomplete / Hold)</span>
            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
              showPriorityBacklog ? 'bg-white/25 text-white' : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
            }`}>
              {priorityBacklogTasks.length}
            </span>
          </button>

          <button
            onClick={() => {
              const d = new Date();
              setSelectedDate(toISODateString(d));
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedDate === toISODateString(new Date())
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-theme-card-hover text-theme-muted hover:bg-theme-border border border-theme-border'
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
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-theme-card-hover text-theme-muted hover:bg-theme-border border border-theme-border transition-colors"
          >
            Tomorrow
          </button>

          <button
            onClick={() => onOpenTaskModal(undefined, selectedDate)}
            className="flex items-center gap-1 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Task</span>
          </button>
        </div>

      </div>

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

      {/* Priority & Category Filtering Bar */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 no-scrollbar">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-theme-muted uppercase tracking-wider mr-1">
            Priority:
          </span>
          <button
            onClick={() => setPriorityFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
              priorityFilter === 'ALL'
                ? 'bg-theme-text text-theme-bg shadow-sm'
                : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
            }`}
          >
            All
          </button>
          {(['P1', 'P2', 'P3', 'P4', 'P5'] as PriorityLevel[]).map((p) => {
            const meta = prioritySettings[p];
            const isSel = priorityFilter === p;
            return (
              <button
                key={p}
                onClick={() => setPriorityFilter(isSel ? 'ALL' : p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                  isSel
                    ? 'shadow-sm'
                    : 'border-theme-border bg-theme-card text-theme-muted hover:bg-theme-card-hover'
                }`}
                style={{
                  backgroundColor: isSel ? meta.bgColor : undefined,
                  borderColor: isSel ? meta.color : undefined,
                  color: isSel ? meta.color : undefined
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-theme-muted uppercase tracking-wider mr-1">
            Status:
          </span>
          {(['ALL', 'Pending', 'Working', 'Done', 'Incomplete'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === st
                  ? 'bg-blue-600 text-white'
                  : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Tasks Timeline & Gap Finder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Scheduled Tasks List (2 Columns on large screens) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Full-Day P1 Reminders for Selected Date */}
          {dateTasks.filter(t => t.category === 'Reminder').length > 0 && (
            <div className="p-4 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5 font-display">
                  <Bell className="w-4 h-4 text-amber-500" />
                  Full-Day P1 Reminders ({dateTasks.filter(t => t.category === 'Reminder').length})
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                  P1 Priority (No Time Conflict)
                </span>
              </div>

              <div className="space-y-2">
                {dateTasks.filter(t => t.category === 'Reminder').map((rem) => {
                  const isDone = rem.status === 'Done';
                  return (
                    <div
                      key={rem.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        isDone 
                          ? 'bg-theme-card/60 border-theme-border opacity-70' 
                          : 'bg-theme-card border-amber-200 dark:border-amber-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <button
                          onClick={() => isDone ? updateTask({ ...rem, status: 'Pending' }) : completeTask(rem.id)}
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                            isDone 
                              ? 'bg-emerald-500 border-emerald-600 text-white' 
                              : 'border-amber-400 hover:border-emerald-500'
                          }`}
                        >
                          {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                        <div className="min-w-0">
                          <span className={`text-sm font-bold text-theme-text font-openSans truncate block ${isDone ? 'line-through text-theme-muted' : ''}`}>
                            {rem.title}
                          </span>
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
                          className="p-1 rounded hover:bg-theme-card-hover text-theme-muted hover:text-theme-text"
                          title="Edit Reminder"
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
                ({dateTasks.filter(t => t.category !== 'Reminder' && t.status !== 'Done' && t.status !== 'Terminated').length} active • {dateTasks.filter(t => t.category !== 'Reminder' && (t.status === 'Done' || t.status === 'Terminated')).length} completed)
              </span>
            </h3>
          </div>

          {/* Active Tasks Section */}
          {dateTasks.filter(t => t.category !== 'Reminder').length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 mx-auto flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-theme-text">No Timed Tasks Scheduled For This Day</h4>
              <p className="text-xs text-theme-muted max-w-sm mx-auto">
                Take advantage of scientific time-boxing. Fill an empty slot to optimize daily ROI.
              </p>
              <button
                onClick={() => onOpenTaskModal(undefined, selectedDate, '09:00 AM')}
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
                    .map((task) => {
                      const priorityMeta = prioritySettings[task.priority];
                      const isWorking = task.status === 'Working';
                      const isIncomplete = task.status === 'Incomplete';

                      return (
                        <div
                          key={task.id}
                          className={`p-4 rounded-2xl border transition-all duration-200 ${
                            isIncomplete
                              ? 'bg-red-50/70 dark:bg-red-950/30 border-red-400 dark:border-red-800 shadow-md ring-1 ring-red-400/40'
                              : isWorking
                                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 shadow-md ring-1 ring-blue-500/30'
                                : 'bg-theme-card border-theme-border hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            
                            {/* Left: Priority + Time + Title */}
                            <div className="flex items-start gap-3 flex-1">
                              
                              {/* Priority Badge */}
                              <div
                                className="px-2 py-1 rounded-lg text-center font-black text-xs min-w-[42px] shrink-0"
                                style={{ backgroundColor: priorityMeta?.bgColor, color: priorityMeta?.color }}
                              >
                                {task.priority}
                              </div>

                              <div className="space-y-1 flex-1">
                                
                                {/* Tags & Time */}
                                <div className="flex items-center gap-2 flex-wrap">
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

                                  {task.isProject && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5" /> Project
                                    </span>
                                  )}

                                  {isIncomplete && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded flex items-center gap-1">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Incomplete / Overdue
                                    </span>
                                  )}
                                </div>

                                {/* Task Title (Google Open Sans Bold) */}
                                <h4 className="text-base sm:text-lg font-bold tracking-tight text-theme-text font-openSans leading-snug">
                                  {task.title}
                                </h4>

                                {/* Live Status Badge + Countdown Pill */}
                                <div className="flex items-center gap-2 flex-wrap py-0.5">
                                  <select
                                    value={task.status}
                                    onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none transition-colors ${
                                      task.status === 'Done' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' :
                                      task.status === 'Working' ? 'bg-blue-600 text-white border-blue-600 shadow-sm animate-pulse' :
                                      task.status === 'Hold' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950' :
                                      task.status === 'Incomplete' ? 'bg-red-600 text-white border-red-600' :
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

                              <button
                                onClick={() => setReschedulingTask(task)}
                                className="p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/40 text-theme-muted hover:text-purple-600 transition-colors"
                                title="Reschedule Task / Find Slot"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => onOpenTaskModal(task)}
                                className="p-1.5 rounded-lg hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
                                title="Edit Task"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => deleteTask(task.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors"
                                title="Delete Task"
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

                          return (
                            <div
                              key={task.id}
                              className="p-4 rounded-2xl border bg-theme-card/60 border-theme-border transition-all"
                            >
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1">
                                  <div
                                    className="px-2 py-1 rounded-lg text-center font-black text-xs min-w-[42px] shrink-0 opacity-70"
                                    style={{ backgroundColor: priorityMeta?.bgColor, color: priorityMeta?.color }}
                                  >
                                    {task.priority}
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
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        isDone ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                      }`}>
                                        {task.status}
                                      </span>
                                    </div>

                                    <h4 className="text-base font-bold text-theme-muted line-through font-openSans leading-snug">
                                      {task.title}
                                    </h4>

                                    <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span>Execution Completed • {task.totalActualMinutes || task.appointedMinutes}m (+{task.bufferMinutes}m buffer applied)</span>
                                    </div>
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
                                    onClick={() => deleteTask(task.id)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500"
                                    title="Delete Task"
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
          <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Dynamic Gap Finder
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-full">
                {gaps.length} Free Slots
              </span>
            </div>
            
            <p className="text-xs text-theme-muted leading-relaxed">
              Scientific empty time slot analysis. Click on any slot to instantly schedule a high-ROI task into the gap.
            </p>

            {gaps.length === 0 ? (
              <div className="p-4 rounded-xl bg-theme-card-hover border border-theme-border text-center text-xs text-theme-muted">
                Schedule is 100% time-boxed with no remaining gaps!
              </div>
            ) : (
              <div className="space-y-2">
                {gaps.map((gap, idx) => (
                  <button
                    key={idx}
                    onClick={() => onOpenTaskModal(undefined, selectedDate, gap.startTime)}
                    className="w-full p-3 rounded-xl border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-100/60 dark:hover:bg-blue-900/30 transition-all text-left group flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{gap.startTime} - {gap.endTime}</span>
                      </div>
                      <span className="text-[11px] text-theme-muted">
                        Available Duration: <strong>{gap.durationMinutes} min</strong>
                      </span>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Plus className="w-4 h-4" />
                    </div>
                  </button>
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

    </div>
  );
};
