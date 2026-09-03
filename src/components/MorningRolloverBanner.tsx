import React, { useState } from 'react';
import { Task, PrioritySettings, PriorityLevel } from '../types';
import { 
  Sunrise, 
  Calendar, 
  CheckCircle2, 
  X, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Repeat, 
  AlertCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { getDayOfWeekFromDate, toISODateString, getTimePeriodForTime } from '../utils/timeUtils';
import { useApp } from '../context/AppContext';

interface MorningRolloverBannerProps {
  tasks: Task[];
  prioritySettings: PrioritySettings;
  onRescheduleTask: (task: Task) => void;
  onMoveToToday: (task: Task) => void;
  onMarkDone: (task: Task) => void;
  onKeepIncomplete: (task: Task) => void;
  onDismissReview: () => void;
}

export const MorningRolloverBanner: React.FC<MorningRolloverBannerProps> = ({
  tasks,
  prioritySettings,
  onRescheduleTask,
  onMoveToToday,
  onMarkDone,
  onKeepIncomplete,
  onDismissReview
}) => {
  const { timePeriodSettings } = useApp();
  const [isExpanded, setIsExpanded] = useState(true);

  if (!tasks || tasks.length === 0) return null;

  const todayStr = toISODateString(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = toISODateString(yesterdayDate);

  const yesterdayCount = tasks.filter(t => t.taskDate === yesterdayStr).length;
  const olderCount = tasks.length - yesterdayCount;

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
                <Sparkles className="w-3 h-3" /> Manual Control
              </span>
            </div>
            <p className="text-xs text-amber-900/80 dark:text-amber-300/90 font-medium">
              {yesterdayCount > 0 && `${yesterdayCount} from yesterday`}
              {yesterdayCount > 0 && olderCount > 0 && ' • '}
              {olderCount > 0 && `${olderCount} earlier overdue`}. Review each task individually: reschedule to an open slot, carry over to today, mark done, or leave incomplete.
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-100/80 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold transition-all"
            title={isExpanded ? 'Collapse list' : 'Expand list'}
          >
            <span className="hidden sm:inline">{isExpanded ? 'Minimize' : 'Show Tasks'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            onClick={onDismissReview}
            className="p-1.5 sm:p-2 rounded-xl bg-amber-100/80 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-200 transition-colors"
            title="Review Later (Minimize banner)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable Task List */}
      {isExpanded && (
        <div className="p-3 sm:p-4 space-y-2.5 max-h-[460px] overflow-y-auto pr-1 sm:pr-2">
          {tasks.map((task) => {
            const isSnapshot = task.id.startsWith('snap-');
            const isYesterday = task.taskDate === yesterdayStr;
            const meta = prioritySettings[task.priority] || {
              label: task.priority,
              color: '#3b82f6',
              bgColor: '#eff6ff'
            };

            const dateLabel = isYesterday ? 'Yesterday' : task.taskDate;

            return (
              <div
                key={task.id}
                className="group flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-200/80 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-600 shadow-sm hover:shadow-md transition-all"
              >
                {/* Left: Task Info */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Priority Badge */}
                    <span
                      className="px-2 py-0.5 rounded font-black text-[11px] uppercase tracking-wider"
                      style={{ backgroundColor: meta.bgColor, color: meta.color }}
                    >
                      {task.priority}
                    </span>

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

                    {/* Scheduled Origin */}
                    <span className="flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 font-mono font-semibold flex-wrap">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span>{dateLabel} • {task.startTime} ({task.appointedMinutes}m)</span>
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
                    </span>
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

                {/* Right: Granular Manual Action Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap self-end lg:self-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-theme-border/40">
                  {/* Action 1: Reschedule (Open intelligent Conflict-Free Reschedule Modal) */}
                  <button
                    onClick={() => onRescheduleTask(task)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-500/20 transition-all active:scale-95"
                    title="Open Conflict-Free Slot Finder to pick specific time"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Reschedule</span>
                  </button>

                  {/* Action 2: Add to Today (Auto find open slot on today) */}
                  <button
                    onClick={() => onMoveToToday(task)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 transition-all active:scale-95"
                    title="Automatically place in the next conflict-free gap today"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Add to Today</span>
                  </button>

                  {/* Action 3: Mark Done (If completed offline yesterday) */}
                  <button
                    onClick={() => onMarkDone(task)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-theme-card-hover hover:bg-emerald-500 hover:text-white text-theme-text text-xs font-bold border border-theme-border transition-all active:scale-95"
                    title="Mark as completed yesterday"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 group-hover:text-white" />
                    <span className="hidden sm:inline">Done</span>
                  </button>

                  {/* Action 4: Keep Incomplete (Acknowledge & keep in history as Incomplete) */}
                  <button
                    onClick={() => onKeepIncomplete(task)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-theme-card-hover hover:bg-red-500 hover:text-white text-theme-muted hover:text-white text-xs font-semibold border border-theme-border transition-all active:scale-95"
                    title="Leave as Incomplete in past history and dismiss from today's review"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Keep Incomplete</span>
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
