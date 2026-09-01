import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Task, PriorityLevel, TaskStatus } from '../types';
import { 
  toISODateString, 
  parse12HourToMinutes, 
  isTaskScheduledForDate,
  isTaskInRunningSlot,
  isTaskPastDue
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
  X
} from 'lucide-react';
import { RescheduleModal } from '../components/RescheduleModal';
import { getDayOfWeekFromDate } from '../utils/timeUtils';

type TimeRangeFilter = 'ALL' | 'TODAY' | 'TOMORROW' | 'NEXT_WEEK' | 'NEXT_MONTH' | 'NEXT_YEAR';

interface AllTasksViewProps {
  onOpenTaskModal: (task?: Task) => void;
}

export const AllTasksView: React.FC<AllTasksViewProps> = ({ onOpenTaskModal }) => {
  const { 
    tasks, 
    categories, 
    capacitySettings,
    prioritySettings, 
    startTask, 
    pauseTask, 
    completeTask, 
    updateTask,
    deleteTask,
    searchQuery,
    setSearchQuery 
  } = useApp();

  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showCompletedArchive, setShowCompletedArchive] = useState(true);
  const [reschedulingTask, setReschedulingTask] = useState<Task | null>(null);
  const [nowTime, setNowTime] = useState<Date>(new Date());

  const handleStatusChange = (task: Task, newStatus: TaskStatus) => {
    if (newStatus === 'Reschedule') {
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

    if (range === 'TODAY') {
      return isTaskScheduledForDate(task, todayIso);
    }
    if (range === 'TOMORROW') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return isTaskScheduledForDate(task, toISODateString(tomorrow));
    }
    if (range === 'NEXT_WEEK') {
      // Check if task occurs on any of the next 7 days
      for (let i = 0; i <= 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        if (isTaskScheduledForDate(task, toISODateString(d))) return true;
      }
      return false;
    }
    if (range === 'NEXT_MONTH') {
      // Check if task occurs in the next 30 days
      for (let i = 0; i <= 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        if (isTaskScheduledForDate(task, toISODateString(d))) return true;
      }
      return false;
    }
    if (range === 'NEXT_YEAR') {
      // Recurring tasks or tasks scheduled within next year
      if (task.recurrence && task.recurrence !== 'None') return true;
      const nextYearEnd = new Date(today);
      nextYearEnd.setFullYear(nextYearEnd.getFullYear() + 1);
      const taskD = new Date(task.taskDate);
      return taskD >= today && taskD <= nextYearEnd;
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
    { id: 'NEXT_WEEK', label: 'Next Week', badgeColor: 'bg-purple-100 dark:bg-purple-950 text-purple-600' },
    { id: 'NEXT_MONTH', label: 'Next Month', badgeColor: 'bg-amber-100 dark:bg-amber-950 text-amber-600' },
    { id: 'NEXT_YEAR', label: 'Next Year', badgeColor: 'bg-rose-100 dark:bg-rose-950 text-rose-600' },
  ];

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

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-theme-muted">
            {filteredTasks.length} tasks match filter
          </span>
          <button
            onClick={() => onOpenTaskModal()}
            className="flex items-center gap-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

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
            
            {/* Active Tasks List */}
            {filteredTasks.filter(t => t.status !== 'Done' && t.status !== 'Terminated').length === 0 ? (
              <div className="p-6 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 text-center space-y-1">
                <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 font-display flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>All Tasks In This View Are Completed! 🎉</span>
                </div>
                <p className="text-xs text-theme-muted">
                  Check completed records in the archive section below.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks
                  .filter(t => t.status !== 'Done' && t.status !== 'Terminated')
                  .map((task) => {
                    const priorityMeta = prioritySettings[task.priority];
                    const isWorking = task.status === 'Working';
                    const isIncomplete = task.status === 'Incomplete';
                    
                    const now = new Date();
                    
                    const isCurrentRunningSlot = isTaskInRunningSlot(task.taskDate, task.startTime, task.endTime, now);
                    const isRunning = isWorking || (task.status === 'Pending' && isCurrentRunningSlot);

                    const isDue = isIncomplete || 
                      (task.status === 'Pending' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, now)) ||
                      (task.status === 'Working' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, now));

                    return (
                      <div
                        key={task.id}
                        className={`p-4 rounded-2xl border transition-all duration-200 ${
                          isDue
                            ? 'bg-red-50/30 dark:bg-red-950/20 border-red-300 dark:border-red-900/60 shadow-sm'
                            : isRunning
                              ? 'bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-theme-card dark:from-blue-950/60 dark:via-sky-950/30 dark:to-theme-card border-blue-500 shadow-xl shadow-blue-500/20 ring-2 ring-blue-500/60'
                              : 'bg-theme-card border-theme-border hover:shadow-md'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          
                          {/* Left Metadata & Details */}
                          <div className="flex items-start gap-3 flex-1">
                            <div
                              className="px-2 py-1 rounded-lg text-center font-black text-xs min-w-[42px] shrink-0"
                              style={{ backgroundColor: priorityMeta?.bgColor, color: priorityMeta?.color }}
                            >
                              {task.priority}
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

                                {task.recurrence !== 'None' && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                    ↻ {task.recurrence}
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
                  <div className="space-y-3 opacity-80">
                    {filteredTasks
                      .filter(t => t.status === 'Done' || t.status === 'Terminated')
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
