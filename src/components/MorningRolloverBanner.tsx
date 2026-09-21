import React, { useState } from 'react';
import { Task, PrioritySettings, PriorityLevel, TaskStatus } from '../types';
import { 
  Sunrise, 
  Calendar, 
  X, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Repeat, 
  Sparkles
} from 'lucide-react';
import { getDayOfWeekFromDate, toISODateString, getTimePeriodForTime, formatDisplayDate } from '../utils/timeUtils';
import { useApp } from '../context/AppContext';
import { QuickPrioritySelector } from './QuickPrioritySelector';
import { QuickTimeSelector } from './QuickTimeSelector';

interface MorningRolloverBannerProps {
  tasks: Task[];
  prioritySettings: PrioritySettings;
  onRescheduleTask: (task: Task) => void;
  onMoveToToday: (task: Task) => void;
  onStatusChange?: (task: Task, status: TaskStatus) => void;
  onDismissReview: () => void;
  onMarkDone?: (task: Task) => void;
  onKeepIncomplete?: (task: Task) => void;
}

export const MorningRolloverBanner: React.FC<MorningRolloverBannerProps> = ({
  tasks,
  prioritySettings,
  onRescheduleTask,
  onMoveToToday,
  onStatusChange,
  onDismissReview
}) => {
  const { timePeriodSettings, updateTask, completeTask, startTask, pauseTask, terminateTask } = useApp();
  const [isExpanded, setIsExpanded] = useState(true);

  if (!tasks || tasks.length === 0) return null;

  const todayStr = toISODateString(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = toISODateString(yesterdayDate);

  const yesterdayCount = tasks.filter(t => t.taskDate === yesterdayStr).length;
  const olderCount = tasks.length - yesterdayCount;

  const handleStatusSelect = (task: Task, newStatus: TaskStatus) => {
    if (onStatusChange) {
      onStatusChange(task, newStatus);
      return;
    }
    if (newStatus === 'Reschedule') {
      onRescheduleTask(task);
      return;
    }
    if (newStatus === 'Done') {
      completeTask(task.id);
      return;
    }
    if (newStatus === 'Working') {
      startTask(task.id);
      return;
    }
    if (newStatus === 'Hold') {
      pauseTask(task.id);
      return;
    }
    if (newStatus === 'Terminated') {
      terminateTask(task.id);
      return;
    }
    updateTask({ ...task, status: newStatus });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/60 dark:border-amber-600/50 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-600/10 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/40 backdrop-blur-md shadow-xl animate-slide-up transition-all mb-4">
      {/* Top Banner Header */}
      <div className="p-4 sm:p-4.5 flex items-center justify-between gap-3 border-b border-amber-300/30 dark:border-amber-700/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
            <Sunrise className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-amber-950 dark:text-amber-100 font-display flex items-center gap-2">
                <span>Morning Rollover Review</span>
                <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                  {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} waiting
                </span>
              </h3>
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                <Sparkles className="w-3 h-3" /> Full Task Control
              </span>
            </div>
            <p className="text-xs text-amber-900/80 dark:text-amber-300/90 font-medium">
              {yesterdayCount > 0 && `${yesterdayCount} from yesterday`}
              {yesterdayCount > 0 && olderCount > 0 && ' • '}
              {olderCount > 0 && `${olderCount} earlier overdue`}. Change status to Pending, Done, Terminated, Hold, or Reschedule and carry over to today.
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-100/80 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold transition-all cursor-pointer"
            title={isExpanded ? 'Collapse list' : 'Expand list'}
          >
            <span className="hidden sm:inline">{isExpanded ? 'Minimize' : 'Show Tasks'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            onClick={onDismissReview}
            className="p-1.5 sm:p-2 rounded-xl bg-amber-100/80 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-200 transition-colors cursor-pointer"
            title="Review Later (Minimize banner)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable Task List */}
      {isExpanded && (
        <div className="p-3 sm:p-4 space-y-2.5 max-h-[480px] overflow-y-auto pr-1 sm:pr-2">
          {tasks.map((task) => {
            const isSnapshot = task.id.startsWith('snap-');
            const isYesterday = task.taskDate === yesterdayStr;
            const dateLabel = isYesterday ? `Yesterday (${formatDisplayDate(task.taskDate)})` : formatDisplayDate(task.taskDate);

            return (
              <div
                key={task.id}
                className="group flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-200/80 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-600 shadow-sm hover:shadow-md transition-all"
              >
                {/* Left: Task Info & Settings */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    
                    {/* Interactive Priority Selector directly on task */}
                    <QuickPrioritySelector task={task} size="sm" />

                    {/* Project Code */}
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {task.projectCode}
                    </span>

                    {/* Category */}
                    <span className="text-[11px] font-semibold text-theme-muted bg-theme-card-hover px-2 py-0.5 rounded-md border border-theme-border/60">
                      {task.category}
                    </span>

                    {/* Nature: Single vs Missed Recurring Routine */}
                    {isSnapshot ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        <Repeat className="w-2.5 h-2.5" /> Missed Routine
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Single Task
                      </span>
                    )}

                    {/* Scheduled Origin & Quick Time Selector */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-amber-800 dark:text-amber-300 font-mono font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" />
                        <span>{dateLabel}:</span>
                      </span>
                      <QuickTimeSelector task={task} />
                    </div>

                    {/* Day Zone */}
                    {(() => {
                      const period = getTimePeriodForTime(task.startTime, timePeriodSettings);
                      if (!period) return null;
                      return (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 flex items-center gap-0.5">
                          <span>{period.emoji}</span>
                          <span>{period.name}</span>
                        </span>
                      );
                    })()}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h4 className="text-sm font-bold text-theme-text font-openSans line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-xs text-theme-muted line-clamp-1">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Full Status Settings & Action Controls */}
                <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-theme-border/40">
                  
                  {/* Status Dropdown with All Task Status Settings: Pending, Working, Done, Hold, Terminated, Incomplete, Reschedule */}
                  <div className="flex items-center gap-1">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusSelect(task, e.target.value as TaskStatus)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border cursor-pointer focus:outline-none transition-all shadow-xs ${
                        task.status === 'Done'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20'
                          : task.status === 'Terminated'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-rose-500/20'
                          : task.status === 'Incomplete'
                          ? 'bg-red-600 text-white border-red-600'
                          : task.status === 'Working'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : task.status === 'Hold'
                          ? 'bg-amber-500 text-white border-amber-600'
                          : task.status === 'Reschedule'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white dark:bg-slate-800 text-theme-text border-theme-border'
                      }`}
                      title="Change task status (Pending, Done, Terminated, Hold, Incomplete, Reschedule)"
                    >
                      <option value="Pending" className="bg-slate-900 text-white">● Pending</option>
                      <option value="Working" className="bg-slate-900 text-white">⚡ Working</option>
                      <option value="Done" className="bg-slate-900 text-white">✓ Done</option>
                      <option value="Hold" className="bg-slate-900 text-white">⏸ Hold</option>
                      <option value="Terminated" className="bg-slate-900 text-white">✕ Terminated</option>
                      <option value="Incomplete" className="bg-slate-900 text-white">⚠️ Incomplete</option>
                      <option value="Reschedule" className="bg-slate-900 text-white">↻ Reschedule</option>
                    </select>
                  </div>

                  {/* Action 1: Reschedule (Open intelligent Conflict-Free Reschedule Modal) */}
                  <button
                    onClick={() => onRescheduleTask(task)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
                    title="Open Conflict-Free Slot Finder to pick specific time"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Reschedule</span>
                  </button>

                  {/* Action 2: Add to Today (Auto find open slot on today) */}
                  <button
                    onClick={() => onMoveToToday(task)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
                    title="Automatically place in the next conflict-free gap today"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Add to Today</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
