import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Task, PriorityLevel, TaskStatus } from '../../types';
import { 
  parse12HourToMinutes, 
  formatMinutesTo12Hour, 
  isTaskScheduledForDate, 
  isTaskInRunningSlot,
  findScheduleGaps,
  TimeGap,
  toISODateString,
  getTaskTitleClasses
} from '../../utils/timeUtils';
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  Timer, 
  Zap, 
  Calendar,
  Hourglass,
  Layers,
  ArrowRight,
  Lock
} from 'lucide-react';

interface TimelineViewProps {
  selectedDate: string;
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
  onOpenRescheduleModal?: (task: Task) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  selectedDate,
  onOpenTaskModal,
  onOpenRescheduleModal
}) => {
  const { 
    tasks, 
    capacitySettings, 
    prioritySettings,
    startTask, 
    pauseTask, 
    completeTask, 
    updateTask, 
    deleteTask,
    requestDeleteTask,
    bufferNotes
  } = useApp();

  const now = new Date();
  const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  const isSelectedDateToday = selectedDate === toISODateString(now);

  // Filter tasks for selected date
  const dayTasks = useMemo(() => {
    return tasks.filter(t => isTaskScheduledForDate(t, selectedDate) && t.status !== 'Terminated')
      .sort((a, b) => parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime));
  }, [tasks, selectedDate]);

  // Capacity boundaries
  const startDayMin = parse12HourToMinutes(capacitySettings.dayStartTime || '06:00 AM');
  const endDayMin = parse12HourToMinutes(capacitySettings.dayEndTime || '11:00 PM');
  const totalDaySpan = Math.max(60, endDayMin - startDayMin);

  // Find Gaps in schedule (automatically adjusted when buffer notes are present)
  const gaps: TimeGap[] = useMemo(() => {
    return findScheduleGaps(
      dayTasks, 
      capacitySettings.dayStartTime, 
      capacitySettings.dayEndTime,
      bufferNotes.filter(n => n.date === selectedDate)
    );
  }, [dayTasks, capacitySettings, bufferNotes, selectedDate]);

  // Generate hourly time ticks from startDay to endDay
  const timeTicks = useMemo(() => {
    const ticks: { minutes: number; label: string }[] = [];
    const startHour = Math.floor(startDayMin / 60);
    const endHour = Math.ceil(endDayMin / 60);
    for (let h = startHour; h <= endHour; h++) {
      const mins = h * 60;
      ticks.push({
        minutes: mins,
        label: formatMinutesTo12Hour(mins)
      });
    }
    return ticks;
  }, [startDayMin, endDayMin]);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Timeline Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-theme-card-hover/40 p-4 rounded-2xl border border-theme-border">
        <div>
          <h3 className="text-sm font-black text-theme-text flex items-center gap-2">
            <Timer className="w-4 h-4 text-blue-500" />
            <span>Interactive Chronological Timeline Track</span>
          </h3>
          <p className="text-xs text-theme-muted mt-0.5">
            Visual progression of scheduled blocks, buffer margins, active timers & open schedule gaps for {selectedDate}.
          </p>
        </div>

        <button
          onClick={() => onOpenTaskModal(undefined, selectedDate)}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Add Task to Timeline</span>
        </button>
      </div>

      {/* Main Timeline Board */}
      <div className="glass-panel p-4 sm:p-6 rounded-3xl border border-theme-border space-y-6 overflow-hidden">
        
        {/* Horizontal Mini Ruler Bar (Overview) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-theme-muted uppercase tracking-wider">
            <span>Day Overview ({capacitySettings.dayStartTime} → {capacitySettings.dayEndTime})</span>
            <span>{dayTasks.length} Scheduled Blocks</span>
          </div>

          <div className="relative h-10 w-full bg-theme-card-hover rounded-xl border border-theme-border/80 overflow-hidden">
            {/* Background grid lines */}
            {timeTicks.map((tick, idx) => {
              const leftPercent = Math.max(0, Math.min(100, ((tick.minutes - startDayMin) / totalDaySpan) * 100));
              return (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 border-l border-theme-border/40"
                  style={{ left: `${leftPercent}%` }}
                />
              );
            })}

            {/* Task blocks on mini ruler */}
            {dayTasks.map((t) => {
              const startM = parse12HourToMinutes(t.startTime);
              const endM = parse12HourToMinutes(t.endTime);
              const left = Math.max(0, Math.min(100, ((startM - startDayMin) / totalDaySpan) * 100));
              const width = Math.max(1, Math.min(100 - left, ((endM - startM) / totalDaySpan) * 100));
              const isWorking = t.status === 'Working';
              const isDone = t.status === 'Done';

              return (
                <div
                  key={t.id}
                  onClick={() => onOpenTaskModal(t)}
                  title={`${t.title} (${t.startTime} - ${t.endTime})`}
                  className={`absolute top-1 bottom-1 rounded-lg cursor-pointer transition-all border shadow-sm ${
                    isDone
                      ? 'bg-emerald-500/80 border-emerald-400 opacity-70'
                      : isWorking
                      ? 'bg-blue-600 border-blue-400 animate-pulse ring-2 ring-blue-400/40'
                      : t.priority === 'P1'
                      ? 'bg-red-500/80 border-red-400'
                      : t.priority === 'P2'
                      ? 'bg-orange-500/80 border-orange-400'
                      : 'bg-indigo-500/80 border-indigo-400'
                  }`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              );
            })}

            {/* Current Time Indicator on Mini Ruler */}
            {isSelectedDateToday && currentMinutesFromMidnight >= startDayMin && currentMinutesFromMidnight <= endDayMin && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-red-500 z-10 shadow-lg shadow-red-500/50"
                style={{ left: `${((currentMinutesFromMidnight - startDayMin) / totalDaySpan) * 100}%` }}
              >
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-[3px] -mt-1 ring-2 ring-white shadow" />
              </div>
            )}
          </div>
        </div>

        {/* Detailed Vertical Chronological Timeline Track */}
        <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-theme-border">
          
          {dayTasks.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-theme-card-hover/40 border border-dashed border-theme-border space-y-3">
              <Clock className="w-8 h-8 text-theme-muted mx-auto opacity-40" />
              <h5 className="text-sm font-bold text-theme-text">No Tasks Scheduled for {selectedDate}</h5>
              <p className="text-xs text-theme-muted max-w-sm mx-auto">
                Your timeline is completely open. Click "Schedule Task" to add your first time-box for today.
              </p>
              <button
                onClick={() => onOpenTaskModal(undefined, selectedDate, capacitySettings.dayStartTime)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Schedule First Block</span>
              </button>
            </div>
          ) : (
            dayTasks.map((task, idx) => {
              const isWorking = task.status === 'Working';
              const isDone = task.status === 'Done';
              const isInSlot = isTaskInRunningSlot(task.taskDate, task.startTime, task.endTime);
              const pMeta = prioritySettings[task.priority];

              // Check if there is an empty gap preceding this task
              const prevTask = dayTasks[idx - 1];
              let gapBeforeMin = 0;
              let gapStartTime = '';
              if (prevTask) {
                const prevEnd = parse12HourToMinutes(prevTask.endTime);
                const currStart = parse12HourToMinutes(task.startTime);
                if (currStart > prevEnd) {
                  gapBeforeMin = currStart - prevEnd;
                  gapStartTime = prevTask.endTime;
                }
              }

              return (
                <React.Fragment key={task.id}>
                  
                  {/* Schedule Gap Alert & Quick Fill Pill */}
                  {gapBeforeMin >= 15 && (
                    <div className="relative flex items-center gap-2 py-1 -ml-4 pl-4 text-xs font-mono text-theme-muted">
                      <div className="w-2 h-2 rounded-full bg-theme-border -ml-1 shrink-0" />
                      <div className="flex-1 border-b border-dashed border-theme-border flex items-center justify-between pr-2">
                        <span className="text-[10px] text-theme-muted font-bold">
                          ⏳ Open Schedule Gap: {gapBeforeMin} mins ({gapStartTime} → {task.startTime})
                        </span>
                        <button
                          onClick={() => onOpenTaskModal(undefined, selectedDate, gapStartTime)}
                          className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Fill Gap
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Task Timeline Card */}
                  <div className="relative group">
                    {/* Node Dot on Timeline */}
                    <div className={`absolute -left-[27px] sm:-left-[35px] top-4 w-4 h-4 rounded-full border-2 transition-all ${
                      isDone
                        ? 'bg-emerald-500 border-emerald-300 shadow-sm shadow-emerald-500/40'
                        : isWorking
                        ? 'bg-blue-600 border-white ring-4 ring-blue-500/30 animate-pulse'
                        : isInSlot
                        ? 'bg-amber-500 border-white ring-2 ring-amber-500/30'
                        : 'bg-theme-card border-theme-border group-hover:border-blue-500'
                    }`} />

                    <div className={`p-4 rounded-2xl border transition-all ${
                      isDone
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 opacity-85'
                        : isWorking
                        ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 shadow-md ring-2 ring-blue-500/20'
                        : 'bg-theme-card border-theme-border hover:bg-theme-card-hover hover:border-blue-400/60 shadow-sm'
                    }`}>
                      
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        
                        {/* Time & Priority Header */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded font-mono ${
                            task.priority === 'P1' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                            task.priority === 'P2' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          }`}>
                            {task.priority} • {pMeta?.label}
                          </span>

                          <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{task.startTime} - {task.endTime} ({task.appointedMinutes}m)</span>
                          </span>

                          <span className="text-[10px] font-mono text-theme-muted font-bold px-2 py-0.5 rounded bg-theme-card-hover border border-theme-border">
                            {task.projectCode}
                          </span>

                          <span className="text-xs text-theme-muted font-medium">
                            {task.category} {task.subCategory ? `• ${task.subCategory}` : ''}
                          </span>

                          {task.isMandatorySchedule && (
                            <span 
                              className="text-[10px] font-black px-2 py-0.5 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 rounded-full flex items-center gap-1 shadow-sm"
                              title="Mandatory Fixed Schedule: Cannot be rescheduled, auto-shifted, or displaced"
                            >
                              <Lock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                              <span>MANDATORY FIXED</span>
                            </span>
                          )}
                        </div>

                        {/* Status Tag */}
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            isDone ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                            isWorking ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 animate-pulse' :
                            'bg-theme-card-hover text-theme-muted'
                          }`}>
                            {task.status}
                          </span>
                        </div>

                      </div>

                      {/* Title & Description */}
                      <div className="mt-2 space-y-1">
                        <h4 className={getTaskTitleClasses(task.title, isDone)}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-xs text-theme-muted line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                      </div>

                      {/* Bottom Action Line & Metrics */}
                      <div className="mt-3 pt-2.5 border-t border-theme-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                        
                        <div className="flex items-center gap-3 text-[11px] text-theme-muted">
                          {task.totalActualMinutes > 0 && (
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              Logged Time: {task.totalActualMinutes}m
                            </span>
                          )}
                          <span>Buffer: {task.bufferMinutes}m</span>
                          {(task.subtasks || []).length > 0 && (
                            <span>{task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length} Subtasks</span>
                          )}
                        </div>

                        {/* Action Controls */}
                        <div className="flex items-center gap-1.5">
                          {!isDone && (
                            isWorking ? (
                              <button
                                onClick={() => pauseTask(task.id)}
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-sm"
                              >
                                <Pause className="w-3 h-3" />
                                <span>Pause</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => startTask(task.id)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-sm"
                              >
                                <Play className="w-3 h-3" />
                                <span>Start</span>
                              </button>
                            )
                          )}

                          {!isDone ? (
                            <button
                              onClick={() => completeTask(task.id)}
                              className="p-1.5 rounded-lg border border-theme-border hover:bg-emerald-50 hover:text-emerald-600 text-theme-muted transition-colors"
                              title="Mark Done"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => updateTask({ ...task, status: 'Pending' })}
                              className="p-1.5 rounded-lg text-emerald-600 bg-emerald-100 dark:bg-emerald-950 hover:bg-emerald-200"
                              title="Reopen"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onOpenTaskModal(task)}
                            className="p-1.5 rounded-lg border border-theme-border hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => requestDeleteTask(task, selectedDate)}
                            className="p-1.5 rounded-lg border border-theme-border hover:bg-rose-50 hover:text-rose-600 text-theme-muted transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                      </div>

                    </div>
                  </div>

                </React.Fragment>
              );
            })
          )}

        </div>

      </div>

    </div>
  );
};
