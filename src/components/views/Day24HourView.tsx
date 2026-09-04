import React, { useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Task, PriorityLevel, TaskStatus, BufferStatusNote } from '../../types';
import { 
  parse12HourToMinutes, 
  formatMinutesTo12Hour, 
  isTaskScheduledForDate, 
  isTaskInRunningSlot,
  toISODateString,
  addMinutesToTime,
  isTaskInSleepWindow,
  getTimePeriodForTime,
  getTaskIntervalForDate,
  taskCrossesMidnight,
  getBangladeshNow,
  isNoTimeTask
} from '../../utils/timeUtils';
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  Timer, 
  Zap, 
  Calendar,
  Sparkles,
  Lock,
  Coffee,
  Smile,
  Activity,
  Moon
} from 'lucide-react';

interface Day24HourViewProps {
  selectedDate: string;
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
}

export const Day24HourView: React.FC<Day24HourViewProps> = ({
  selectedDate,
  onOpenTaskModal
}) => {
  const { 
    tasks, 
    bufferNotes,
    bufferCategories,
    openBufferNoteModal,
    capacitySettings, 
    prioritySettings,
    timePeriodSettings,
    startTask, 
    pauseTask, 
    completeTask, 
    updateTask, 
    deleteTask,
    requestDeleteTask
  } = useApp();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const now = getBangladeshNow();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isSelectedDateToday = selectedDate === toISODateString(now);

  // Day's logged buffer notes
  const dayBufferNotes = useMemo(() => {
    return bufferNotes.filter(n => n.date === selectedDate);
  }, [bufferNotes, selectedDate]);

  // Height per hour in pixels
  const HOUR_HEIGHT = 64; // 64px per hour = ~1536px total 24h height

  // Filter tasks for selected date with multi-date continuity support
  const dayTasks = useMemo(() => {
    return tasks.filter(t => isTaskScheduledForDate(t, selectedDate) && t.status !== 'Terminated')
      .sort((a, b) => {
        const intA = getTaskIntervalForDate(a, selectedDate);
        const intB = getTaskIntervalForDate(b, selectedDate);
        return parse12HourToMinutes(intA.startTime) - parse12HourToMinutes(intB.startTime);
      });
  }, [tasks, selectedDate]);

  // Timed tasks rendered strictly on the 24-hour vertical timeline
  const timedDayTasks = useMemo(() => {
    return dayTasks.filter(t => !isNoTimeTask(t));
  }, [dayTasks]);

  // Floating / Anytime / Free Time tasks (P5 Noise) rendered at the bottom
  const anytimeDayTasks = useMemo(() => {
    return dayTasks.filter(t => isNoTimeTask(t));
  }, [dayTasks]);

  // Capacity boundaries in minutes
  const startCapMin = parse12HourToMinutes(capacitySettings.dayStartTime || '06:00 AM');
  const endCapMin = parse12HourToMinutes(capacitySettings.dayEndTime || '11:00 PM');

  // Auto scroll to current time or work start time on initial render
  useEffect(() => {
    if (scrollContainerRef.current) {
      const targetMin = isSelectedDateToday ? currentMinutes : startCapMin;
      const scrollY = Math.max(0, (targetMin / 60) * HOUR_HEIGHT - 120);
      scrollContainerRef.current.scrollTop = scrollY;
    }
  }, [selectedDate]);

  // 24 hours list (0 to 23)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-theme-card-hover/40 p-4 rounded-2xl border border-theme-border">
        <div>
          <h3 className="text-sm font-black text-theme-text flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span>24-Hour Continuous Hourly Planner</span>
          </h3>
          <p className="text-xs text-theme-muted mt-0.5">
            Full 24-hour visual schedule grid. Click any empty hour row to instantly book a time-box.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-theme-muted px-2.5 py-1 rounded-xl bg-theme-card border border-theme-border">
            Active Window: {capacitySettings.dayStartTime} - {capacitySettings.dayEndTime}
          </span>
          <button
            onClick={() => onOpenTaskModal(undefined, selectedDate, capacitySettings.dayStartTime)}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Schedule Task</span>
          </button>
        </div>
      </div>

      {/* Real-time What Are You Doing Now Bar (if viewing today) */}
      {isSelectedDateToday && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-purple-500/10 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-sm animate-pulse">
              ⏱
            </div>
            <div>
              <div className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                <span>24H Live Activity Tracker:</span>
                <span className="font-mono text-amber-600 dark:text-amber-400 font-black">
                  {formatMinutesTo12Hour(currentMinutes)}
                </span>
              </div>
              <p className="text-[11px] text-theme-muted">
                Continuous 24-hour log. Click a quick preset to record what you are doing during free time or breaks:
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {['Coffee / Tea', 'Walk / Exercise', 'Meal / Snack', 'Break / Rest', 'Reading / Learning'].map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  const start12h = formatMinutesTo12Hour(Math.max(0, currentMinutes - 15));
                  const end12h = formatMinutesTo12Hour(currentMinutes);
                  openBufferNoteModal({
                    date: selectedDate,
                    startTime: start12h,
                    endTime: end12h,
                    durationMinutes: 15,
                    activityTag: tag
                  });
                }}
                className="px-2.5 py-1 rounded-xl bg-theme-card border border-theme-border hover:border-amber-400 text-[10px] font-bold text-theme-text hover:text-amber-600 dark:hover:text-amber-400 shadow-2xs transition-colors"
              >
                {tag.split('/')[0].trim()}
              </button>
            ))}
            <button
              onClick={() => {
                const start12h = formatMinutesTo12Hour(Math.max(0, currentMinutes - 15));
                const end12h = formatMinutesTo12Hour(currentMinutes);
                openBufferNoteModal({
                  date: selectedDate,
                  startTime: start12h,
                  endTime: end12h,
                  durationMinutes: 15
                });
              }}
              className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black shadow-sm transition-colors"
            >
              + Log Custom
            </button>
          </div>
        </div>
      )}

      {/* 24-Hour Visual Planner Scroll Area */}
      <div 
        ref={scrollContainerRef}
        className="glass-panel rounded-3xl border border-theme-border overflow-y-auto max-h-[72vh] relative select-none"
      >
        <div className="relative min-w-[600px]" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          
          {/* Working Capacity Highlight Background */}
          <div
            className="absolute left-16 right-0 bg-blue-500/[0.03] dark:bg-blue-500/[0.05] border-y border-blue-500/20 pointer-events-none"
            style={{
              top: `${(startCapMin / 60) * HOUR_HEIGHT}px`,
              height: `${((endCapMin - startCapMin) / 60) * HOUR_HEIGHT}px`
            }}
          >
            <span className="absolute right-4 top-2 text-[10px] font-mono font-bold text-blue-500/60 uppercase tracking-widest">
              Standard Work Budget Zone ({capacitySettings.maxWorkHours}h)
            </span>
          </div>

          {/* 24 Hour Rows & Grid Lines */}
          {hours.map((hour) => {
            const timeLabel = formatMinutesTo12Hour(hour * 60);
            const isWorkHour = hour * 60 >= startCapMin && hour * 60 < endCapMin;

            return (
              <div
                key={hour}
                onClick={() => onOpenTaskModal(undefined, selectedDate, timeLabel)}
                className={`absolute left-0 right-0 border-t flex cursor-pointer transition-colors group ${
                  isWorkHour 
                    ? 'border-theme-border/70 hover:bg-blue-500/5' 
                    : 'border-theme-border/40 bg-theme-card-hover/20 hover:bg-theme-card-hover/40'
                }`}
                style={{ top: `${hour * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                title={`Click to schedule a task at ${timeLabel}`}
              >
                {/* Left Hour Label Column */}
                <div className="w-16 shrink-0 pr-3 text-right text-[11px] font-mono font-bold text-theme-muted -mt-2.5 group-hover:text-blue-500 transition-colors">
                  {timeLabel}
                </div>

                {/* Main Row Content Area with Half-Hour Guide Line */}
                <div className="flex-1 relative border-l border-theme-border/60">
                  <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-theme-border/30 pointer-events-none" />
                </div>
              </div>
            );
          })}

          {/* Current Real-Time Indicator Line (if viewing Today) */}
          {isSelectedDateToday && (
            <div
              className="absolute left-14 right-0 z-20 flex items-center pointer-events-none"
              style={{ top: `${(currentMinutes / 60) * HOUR_HEIGHT}px` }}
            >
              <div className="w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-500/30 shadow-md shadow-red-500/50 -ml-1.5" />
              <div className="flex-1 h-0.5 bg-red-500 shadow-sm" />
              <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded-full bg-red-600 text-white shadow mr-4">
                Now: {formatMinutesTo12Hour(currentMinutes)}
              </span>
            </div>
          )}

          {/* Logged Buffer Notes Rendered on 24H Timeline */}
          {dayBufferNotes.map((note) => {
            const startM = parse12HourToMinutes(note.startTime);
            const endM = parse12HourToMinutes(note.endTime);
            const durationM = Math.max(10, note.durationMinutes || (endM - startM));
            const topPx = (startM / 60) * HOUR_HEIGHT;
            const heightPx = Math.max(24, (durationM / 60) * HOUR_HEIGHT - 2);

            return (
              <div
                key={note.id}
                onClick={() => openBufferNoteModal({
                  existingNote: note,
                  id: note.id,
                  date: note.date,
                  startTime: note.startTime,
                  endTime: note.endTime,
                  durationMinutes: note.durationMinutes,
                  activityTag: note.activityTag,
                  notes: note.notes,
                  energyLevel: note.energyLevel
                })}
                style={{
                  top: `${topPx}px`,
                  height: `${heightPx}px`,
                  left: '72px',
                  right: '16px'
                }}
                className="absolute rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-100/70 dark:bg-amber-950/40 p-2 shadow-2xs z-10 cursor-pointer hover:border-amber-500 transition-all flex items-center justify-between group overflow-hidden"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs">☕</span>
                  <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 truncate">
                    {note.activityTag} {note.notes ? `• ${note.notes}` : ''}
                  </span>
                  <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 font-semibold shrink-0">
                    ({note.startTime} - {note.endTime} • {note.durationMinutes}m)
                  </span>
                </div>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  Edit Note
                </span>
              </div>
            );
          })}

          {/* Post-Task Break Buffer Intervals Rendered on 24H Timeline */}
          {dayTasks.map((task) => {
            const crosses = taskCrossesMidnight(task.startTime, task.endTime);
            const interval = getTaskIntervalForDate(task, selectedDate);
            // If task crosses midnight, its post-task buffer belongs on completion day (Day 2), not Day 1!
            if (crosses && !interval.isContinuation) return null;

            const endM = parse12HourToMinutes(task.endTime);
            const bufMin = task.bufferMinutes !== undefined ? task.bufferMinutes : (capacitySettings.defaultBufferMinutes ?? 0);
            if (bufMin <= 0) return null;
            const topPx = (endM / 60) * HOUR_HEIGHT;
            const heightPx = Math.max(16, (bufMin / 60) * HOUR_HEIGHT - 2);
            const bufEnd12h = addMinutesToTime(task.endTime, bufMin);

            // Check if user already logged a buffer note during this window
            const existingBufferNote = dayBufferNotes.find(n => 
              n.relatedTaskId === task.id || 
              (parse12HourToMinutes(n.startTime) < endM + bufMin && parse12HourToMinutes(n.endTime) > endM)
            );

            // If already logged, don't show an overlapping blank break buffer box
            if (existingBufferNote) return null;

            return (
              <div
                key={`buf-${task.id}`}
                onClick={() => openBufferNoteModal({
                  date: selectedDate,
                  startTime: task.endTime,
                  endTime: bufEnd12h,
                  durationMinutes: bufMin,
                  relatedTaskId: task.id,
                  relatedTaskTitle: task.title
                })}
                style={{
                  top: `${topPx}px`,
                  height: `${heightPx}px`,
                  left: '72px',
                  right: '16px'
                }}
                className="absolute rounded-lg border border-dashed border-purple-300 dark:border-purple-800/60 bg-purple-50/40 dark:bg-purple-950/20 px-2 py-0.5 z-5 cursor-pointer hover:bg-purple-100/60 transition-all flex items-center justify-between text-[10px] text-purple-700 dark:text-purple-300 font-mono font-medium overflow-hidden"
              >
                <span>🟣 {bufMin}m Break Buffer ({task.endTime} → {bufEnd12h})</span>
                <span className="text-[9px] text-purple-500 underline font-sans">Log Free Time</span>
              </div>
            );
          })}

          {/* Scheduled Tasks Rendered Accurately as Time Blocks */}
          {timedDayTasks.map((task) => {
            const crosses = taskCrossesMidnight(task.startTime, task.endTime);
            const interval = getTaskIntervalForDate(task, selectedDate);
            const startM = parse12HourToMinutes(interval.startTime);
            const durationM = Math.max(15, interval.durationMinutes);
            
            const topPx = (startM / 60) * HOUR_HEIGHT;
            const heightPx = Math.max(28, (durationM / 60) * HOUR_HEIGHT - 2);

            const isWorking = task.status === 'Working';
            const isDone = task.status === 'Done';
            const isInSlot = isTaskInRunningSlot(task.taskDate, task.startTime, task.endTime);
            const isInSleep = isTaskInSleepWindow(task, capacitySettings);
            const pMeta = prioritySettings[task.priority];

            return (
              <div
                key={task.id}
                style={{
                  top: `${topPx}px`,
                  height: `${heightPx}px`,
                  left: '72px',
                  right: '16px'
                }}
                className={`absolute rounded-xl border p-2.5 transition-all shadow-sm z-10 overflow-hidden flex flex-col justify-between group ${
                  isDone
                    ? 'bg-emerald-500/15 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 opacity-80'
                    : isWorking
                    ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/50 animate-pulse'
                    : isInSleep
                    ? 'bg-slate-900/95 text-slate-100 dark:bg-slate-950 dark:text-slate-100 border-indigo-900/90 ring-1 ring-indigo-500/40 shadow-md hover:border-indigo-400'
                    : task.priority === 'P1'
                    ? 'bg-red-50/90 dark:bg-red-950/40 border-red-300 dark:border-red-800'
                    : task.priority === 'P2'
                    ? 'bg-orange-50/90 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800'
                    : 'bg-theme-card border-theme-border hover:border-blue-400'
                }`}
              >
                {/* Top Row: Priority, Time, Title, Controls */}
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded font-mono shrink-0 ${
                      isWorking ? 'bg-white/20 text-white' :
                      task.priority === 'P1' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                      task.priority === 'P2' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    }`}>
                      {task.priority}
                    </span>

                    {task.isMandatorySchedule && (
                      <span title="Mandatory Fixed Schedule" className="inline-flex">
                        <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                      </span>
                    )}

                    {isInSleep && (
                      <span title="Scheduled on Sleep / Recovery Window" className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/60 text-[9px] font-bold">
                        <Moon className="w-2.5 h-2.5 text-indigo-400" />
                        <span>SLEEP</span>
                      </span>
                    )}

                    {timePeriodSettings?.isEnabled && (() => {
                      const period = getTimePeriodForTime(task.startTime, timePeriodSettings);
                      if (!period) return null;
                      return (
                        <span 
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border flex items-center gap-0.5 shrink-0 ${
                            isWorking 
                              ? 'bg-white/20 border-white/40 text-white' 
                              : 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                          }`}
                          title={`Day Zone: ${period.name} (${period.startTime} - ${period.endTime})`}
                        >
                          <span>{period.emoji || '⏰'}</span>
                          <span>{period.name}</span>
                        </span>
                      );
                    })()}

                    {crosses && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border flex items-center gap-0.5 shrink-0 ${
                        interval.isContinuation
                          ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                          : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                      }`}>
                        <Moon className="w-2.5 h-2.5" />
                        <span>{interval.isContinuation ? `Continuation from ${task.startTime}` : `Spans into Tomorrow (ends ${task.endTime})`}</span>
                      </span>
                    )}

                    <span className={`text-[11px] font-bold truncate ${
                      isWorking ? 'text-white' :
                      isDone ? 'line-through text-theme-muted' : 
                      isInSleep ? 'text-white font-black drop-shadow-sm' : 'text-theme-text'
                    }`}>
                      {task.title}
                    </span>

                    <span className={`text-[10px] font-mono font-bold shrink-0 ${isWorking ? 'text-white/80' : 'text-theme-muted'}`}>
                      • {crosses 
                          ? (interval.isContinuation 
                              ? `${interval.startTime} - ${interval.endTime} (from ${task.startTime})`
                              : `${interval.startTime} - Midnight (total ${task.appointedMinutes}m)`)
                          : `${task.startTime} - ${task.endTime} (${task.appointedMinutes}m)`}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {!isDone && (
                      isWorking ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); pauseTask(task.id); }}
                          className="p-1 bg-white/20 hover:bg-white/30 text-white rounded-md"
                          title="Pause Timer"
                        >
                          <Pause className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); startTask(task.id); }}
                          className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md"
                          title="Start Timer"
                        >
                          <Play className="w-3 h-3" />
                        </button>
                      )
                    )}

                    {!isDone ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); completeTask(task.id); }}
                        className="p-1 bg-theme-card-hover hover:text-emerald-600 border border-theme-border rounded-md text-theme-muted"
                        title="Mark Done"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); updateTask({ ...task, status: 'Pending' }); }}
                        className="p-1 text-emerald-500 rounded-md"
                        title="Reopen"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenTaskModal(task); }}
                      className="p-1 bg-theme-card-hover border border-theme-border rounded-md text-theme-muted hover:text-theme-text"
                      title="Edit"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); requestDeleteTask(task, selectedDate); }}
                      className="p-1 bg-theme-card-hover hover:text-rose-600 border border-theme-border rounded-md text-theme-muted"
                      title="Delete Task / Occurrence"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Bottom Row if block is tall enough */}
                {heightPx >= 48 && (
                  <div className="flex items-center justify-between text-[10px] text-theme-muted pt-1 border-t border-theme-border/40 mt-1">
                    <span className={isWorking ? 'text-white/80' : ''}>
                      {task.category} {task.subCategory ? `• ${task.subCategory}` : ''}
                    </span>
                    <span className={`font-bold ${isWorking ? 'text-white' : ''}`}>
                      {task.totalActualMinutes > 0 ? `Spent: ${task.totalActualMinutes}m` : `${task.status}`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

        </div>
      </div>

      {/* Anytime & Free Time Noise Queue (P5 Free Time Floating Tasks) */}
      {anytimeDayTasks.length > 0 && (
        <div className="p-4 rounded-2xl bg-theme-card border border-amber-500/30 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                ⚡
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-theme-text font-display">
                Anytime & Free Time Queue ({anytimeDayTasks.length})
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                P5 Noise • Simultaneous
              </span>
            </div>
            <span className="text-[10px] text-theme-muted font-mono hidden sm:inline">
              Runs in parallel • No fixed slot
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {anytimeDayTasks.map(t => {
              const isDone = t.status === 'Done';
              const isWorking = t.status === 'Working';

              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-xl border bg-theme-card-hover/60 transition-all flex items-center justify-between gap-2.5 ${
                    isWorking
                      ? 'border-blue-500 shadow-md ring-1 ring-blue-500/30'
                      : isDone
                        ? 'opacity-60 border-theme-border'
                        : 'border-theme-border hover:border-amber-400/60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                        {t.priority}
                      </span>
                      <span className="text-[10px] font-mono text-theme-muted truncate">
                        {t.projectCode}
                      </span>
                    </div>
                    <div className={`text-xs font-bold truncate ${isDone ? 'line-through text-theme-muted' : 'text-theme-text'}`}>
                      {t.title}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!isDone ? (
                      isWorking ? (
                        <button
                          onClick={() => pauseTask(t.id)}
                          className="p-1.5 rounded-lg bg-amber-500 text-white shadow-xs cursor-pointer"
                          title="Pause"
                        >
                          <Pause className="w-3.5 h-3.5 fill-white" />
                        </button>
                      ) : (
                        <button
                          onClick={() => startTask(t.id)}
                          className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs cursor-pointer"
                          title="Start"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                        </button>
                      )
                    ) : null}

                    <button
                      onClick={() => completeTask(t.id)}
                      className={`p-1.5 rounded-lg border cursor-pointer ${
                        isDone ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-theme-card text-theme-muted hover:text-emerald-500 border-theme-border'
                      }`}
                      title={isDone ? 'Completed' : 'Mark Done'}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onOpenTaskModal(t)}
                      className="p-1.5 rounded-lg bg-theme-card text-theme-muted hover:text-theme-text border border-theme-border cursor-pointer"
                      title="Edit"
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

    </div>
  );
};
