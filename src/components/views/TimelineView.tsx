import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Task, PriorityLevel, TaskStatus, BufferStatusNote } from '../../types';
import { 
  parse12HourToMinutes, 
  formatMinutesTo12Hour, 
  isTaskScheduledForDate, 
  isTaskInRunningSlot,
  findScheduleGaps,
  TimeGap,
  toISODateString,
  getTaskTitleClasses,
  isTaskInSleepWindow,
  getBufferActivityEmoji,
  addMinutesToTime
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
  Lock,
  Moon,
  Coffee,
  Sparkles
} from 'lucide-react';

interface TimelineViewProps {
  selectedDate: string;
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
  onOpenRescheduleModal?: (task: Task) => void;
}

type TimelineItem = 
  | { kind: 'task'; task: Task; startMin: number; endMin: number }
  | { kind: 'buffer_note'; note: BufferStatusNote; startMin: number; endMin: number };

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
    bufferNotes,
    openBufferNoteModal,
    deleteBufferNote
  } = useApp();

  const now = new Date();
  const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  const isSelectedDateToday = selectedDate === toISODateString(now);

  // Filter tasks for selected date
  const dayTasks = useMemo(() => {
    return tasks.filter(t => isTaskScheduledForDate(t, selectedDate) && t.status !== 'Terminated')
      .sort((a, b) => parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime));
  }, [tasks, selectedDate]);

  // Filter buffer notes for selected date
  const dayBufferNotes = useMemo(() => {
    return bufferNotes.filter(n => n.date === selectedDate)
      .sort((a, b) => parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime));
  }, [bufferNotes, selectedDate]);

  // Combined Chronological Items (Tasks & Buffer Notes)
  const timelineItems = useMemo((): TimelineItem[] => {
    const taskItems: TimelineItem[] = dayTasks.map(t => {
      const sMin = parse12HourToMinutes(t.startTime);
      let eMin = parse12HourToMinutes(t.endTime);
      if (t.status === 'Done') {
        if (t.actualEndTime) {
          const aEnd = parse12HourToMinutes(t.actualEndTime);
          if (aEnd > sMin && aEnd < eMin) {
            eMin = aEnd;
          }
        } else if (t.totalActualMinutes && t.totalActualMinutes > 0 && t.totalActualMinutes < (eMin - sMin)) {
          eMin = sMin + t.totalActualMinutes;
        }
      }
      return {
        kind: 'task',
        task: t,
        startMin: sMin,
        endMin: eMin
      };
    });

    const bufferItems: TimelineItem[] = dayBufferNotes.map(n => ({
      kind: 'buffer_note',
      note: n,
      startMin: parse12HourToMinutes(n.startTime),
      endMin: parse12HourToMinutes(n.endTime)
    }));

    return [...taskItems, ...bufferItems].sort((a, b) => {
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      if (a.kind !== b.kind) return a.kind === 'task' ? -1 : 1;
      return a.endMin - b.endMin;
    });
  }, [dayTasks, dayBufferNotes]);

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
      dayBufferNotes,
      capacitySettings.defaultBufferMinutes ?? 0
    );
  }, [dayTasks, capacitySettings, dayBufferNotes]);

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
            Visual progression of scheduled blocks, logged buffer notes, active timers & open schedule gaps for {selectedDate}.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => openBufferNoteModal({ date: selectedDate })}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Log Buffer Note</span>
          </button>

          <button
            onClick={() => onOpenTaskModal(undefined, selectedDate)}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Add Task to Timeline</span>
          </button>
        </div>
      </div>

      {/* Main Timeline Board */}
      <div className="glass-panel p-4 sm:p-6 rounded-3xl border border-theme-border space-y-6 overflow-hidden">
        
        {/* Horizontal Mini Ruler Bar (Overview) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-theme-muted uppercase tracking-wider">
            <span>Day Overview ({capacitySettings.dayStartTime} → {capacitySettings.dayEndTime})</span>
            <span>{dayTasks.length} Tasks • {dayBufferNotes.length} Buffer Logs</span>
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

            {/* Buffer Note blocks on mini ruler */}
            {dayBufferNotes.map((b) => {
              const startM = parse12HourToMinutes(b.startTime);
              const endM = parse12HourToMinutes(b.endTime);
              const left = Math.max(0, Math.min(100, ((startM - startDayMin) / totalDaySpan) * 100));
              const width = Math.max(1, Math.min(100 - left, ((endM - startM) / totalDaySpan) * 100));

              return (
                <div
                  key={b.id}
                  onClick={() => openBufferNoteModal({ existingNote: b })}
                  title={`☕ ${b.activityTag}: ${b.notes || 'Buffer Time'} (${b.startTime} - ${b.endTime})`}
                  className="absolute top-1 bottom-1 rounded-lg cursor-pointer transition-all border border-amber-400 bg-amber-400/90 hover:bg-amber-300 text-amber-950 shadow-sm flex items-center justify-center font-bold text-[9px] overflow-hidden"
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span>☕</span>
                </div>
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
          
          {timelineItems.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-theme-card-hover/40 border border-dashed border-theme-border space-y-3">
              <Clock className="w-8 h-8 text-theme-muted mx-auto opacity-40" />
              <h5 className="text-sm font-bold text-theme-text">No Tasks or Buffer Logs for {selectedDate}</h5>
              <p className="text-xs text-theme-muted max-w-sm mx-auto">
                Your timeline is completely open. Schedule a task or log a free-time buffer to account for your day.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => openBufferNoteModal({ date: selectedDate })}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Log Buffer Note</span>
                </button>
                <button
                  onClick={() => onOpenTaskModal(undefined, selectedDate, capacitySettings.dayStartTime)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Schedule Task</span>
                </button>
              </div>
            </div>
          ) : (
            timelineItems.map((item, idx) => {
              // Preceding gap check
              const prevItem = timelineItems[idx - 1];
              let gapBeforeMin = 0;
              let gapStartTime = '';
              if (prevItem) {
                if (item.startMin > prevItem.endMin) {
                  gapBeforeMin = item.startMin - prevItem.endMin;
                  gapStartTime = formatMinutesTo12Hour(prevItem.endMin);
                }
              }

              // RENDER BUFFER NOTE
              if (item.kind === 'buffer_note') {
                const note = item.note;
                return (
                  <React.Fragment key={`buf-item-${note.id}`}>
                    {/* Gap indicator */}
                    {gapBeforeMin >= 15 && (
                      <div className="relative flex items-center gap-2 py-1 -ml-4 pl-4 text-xs font-mono text-theme-muted">
                        <div className="w-2 h-2 rounded-full bg-theme-border -ml-1 shrink-0" />
                        <div className="flex-1 border-b border-dashed border-theme-border flex items-center justify-between pr-2">
                          <span className="text-[10px] text-theme-muted font-bold">
                            ⏳ Open Schedule Gap: {gapBeforeMin} mins ({gapStartTime} → {note.startTime})
                          </span>
                          <button
                            onClick={() => openBufferNoteModal({ date: selectedDate, startTime: gapStartTime, durationMinutes: gapBeforeMin })}
                            className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Coffee className="w-3 h-3" /> Log Buffer Note
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Buffer Note Timeline Item */}
                    <div className="relative group">
                      {/* Node Dot on Timeline */}
                      <div className="absolute -left-[27px] sm:-left-[35px] top-4 w-4 h-4 rounded-full border-2 border-amber-300 dark:border-amber-700 bg-amber-500 shadow-sm shadow-amber-500/40 flex items-center justify-center text-[8px] text-white">
                        ☕
                      </div>

                      <div className="p-4 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/30 hover:border-amber-400 transition-all shadow-sm space-y-2">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded font-mono bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 flex items-center gap-1">
                              <span>{getBufferActivityEmoji(note.activityTag)}</span>
                              <span>{note.activityTag}</span>
                            </span>

                            <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>{note.startTime} - {note.endTime} ({note.durationMinutes}m)</span>
                            </span>

                            {note.energyLevel !== undefined && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-theme-card border border-theme-border text-theme-muted">
                                ⚡ Energy: {note.energyLevel}/5
                              </span>
                            )}

                            {note.signalNoise && (
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                                note.signalNoise === 'signal'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}>
                                {note.signalNoise.toUpperCase()}
                              </span>
                            )}

                            {note.relatedTaskTitle && (
                              <span className="text-[10px] text-theme-muted font-medium italic">
                                Post-Task Buffer: {note.relatedTaskTitle}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openBufferNoteModal({ existingNote: note })}
                              className="p-1.5 rounded-lg hover:bg-theme-card-hover text-theme-muted hover:text-amber-600 transition-colors cursor-pointer"
                              title="Edit Buffer Note"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteBufferNote(note.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors cursor-pointer"
                              title="Delete Buffer Note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {note.notes ? (
                          <p className="text-xs text-theme-text font-medium bg-theme-card/70 p-2.5 rounded-xl border border-theme-border/60">
                            "{note.notes}"
                          </p>
                        ) : (
                          <p className="text-xs text-theme-muted italic">
                            Buffer / free-time block logged without additional journal details.
                          </p>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              // RENDER TASK ITEM
              const task = item.task;
              const isWorking = task.status === 'Working';
              const isDone = task.status === 'Done';
              const isInSlot = isTaskInRunningSlot(task.taskDate, task.startTime, task.endTime);
              const isInSleep = isTaskInSleepWindow(task, capacitySettings);
              const pMeta = prioritySettings[task.priority];

              // Check if post-task buffer has been logged as a user buffer note
              const taskEndM = parse12HourToMinutes(task.endTime);
              const taskBufMin = task.bufferMinutes !== undefined ? task.bufferMinutes : (capacitySettings.defaultBufferMinutes ?? 0);
              const matchingBufferNote = dayBufferNotes.find(n => 
                n.relatedTaskId === task.id ||
                (parse12HourToMinutes(n.startTime) < taskEndM + taskBufMin && parse12HourToMinutes(n.endTime) > taskEndM)
              );

              return (
                <React.Fragment key={`task-item-${task.id}`}>
                  {/* Gap Alert & Quick Fill Pill */}
                  {gapBeforeMin >= 15 && (
                    <div className="relative flex items-center gap-2 py-1 -ml-4 pl-4 text-xs font-mono text-theme-muted">
                      <div className="w-2 h-2 rounded-full bg-theme-border -ml-1 shrink-0" />
                      <div className="flex-1 border-b border-dashed border-theme-border flex items-center justify-between pr-2">
                        <span className="text-[10px] text-theme-muted font-bold">
                          ⏳ Open Schedule Gap: {gapBeforeMin} mins ({gapStartTime} → {task.startTime})
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openBufferNoteModal({ date: selectedDate, startTime: gapStartTime, durationMinutes: gapBeforeMin })}
                            className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Coffee className="w-3 h-3" /> Log Buffer Note
                          </button>
                          <button
                            onClick={() => onOpenTaskModal(undefined, selectedDate, gapStartTime)}
                            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Fill Task
                          </button>
                        </div>
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
                        : isInSleep
                        ? 'bg-indigo-950 border-indigo-400 ring-2 ring-indigo-500/50 shadow-md'
                        : isInSlot
                        ? 'bg-amber-500 border-white ring-2 ring-amber-500/30'
                        : 'bg-theme-card border-theme-border group-hover:border-blue-500'
                    }`} />

                    <div className={`p-4 rounded-2xl border transition-all ${
                      isDone
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 opacity-85'
                        : isWorking
                        ? isInSleep
                          ? 'bg-slate-900 text-slate-100 dark:bg-slate-950 dark:text-slate-100 border-blue-500 shadow-md ring-2 ring-blue-500/80'
                          : 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 shadow-md ring-2 ring-blue-500/20'
                        : isInSleep
                        ? 'bg-slate-900/95 text-slate-100 dark:bg-slate-950 dark:text-slate-100 border-indigo-900/90 shadow-md ring-1 ring-indigo-500/40 hover:border-indigo-400'
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
                            <span>
                              {task.status === 'Done' && task.actualEndTime && task.actualEndTime !== task.endTime
                                ? `${task.startTime} - ${task.actualEndTime} (Done early • planned ${task.appointedMinutes}m)`
                                : `${task.startTime} - ${task.endTime} (${task.appointedMinutes}m)`}
                            </span>
                          </span>

                          {task.status === 'Done' && task.completedBeforeTimeOccurred && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                              <span>✨</span>
                              <span>DONE IN ADVANCE • SLOT FREED UP</span>
                            </span>
                          )}

                          {task.status === 'Done' && !task.completedBeforeTimeOccurred && task.savedFreeMinutes && task.savedFreeMinutes > 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                              <span>⚡</span>
                              <span>FINISHED EARLY (+{task.savedFreeMinutes}m FREE TIME)</span>
                            </span>
                          )}

                          <span className="text-[10px] font-mono text-theme-muted font-bold px-2 py-0.5 rounded bg-theme-card-hover border border-theme-border">
                            {task.projectCode}
                          </span>

                          <span className="text-xs text-theme-muted font-medium">
                            {task.category} {task.subCategory ? `• ${task.subCategory}` : ''}
                          </span>

                          {isInSleep && (
                            <span 
                              className="text-[10px] font-black px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-700/80 rounded-full flex items-center gap-1 shadow-sm"
                              title="Scheduled on Sleep / Recovery Window"
                            >
                              <Moon className="w-2.5 h-2.5 text-indigo-400" />
                              <span>🌙 SLEEP TIME</span>
                            </span>
                          )}
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
                        <h4 
                          onClick={() => onOpenTaskModal(task)}
                          className={`${getTaskTitleClasses(task.title, isDone, isInSleep)} cursor-pointer hover:text-blue-600 transition-colors`}
                        >
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className={`text-xs line-clamp-2 leading-relaxed ${isInSleep ? 'text-slate-300' : 'text-theme-muted'}`}>
                            {task.description}
                          </p>
                        )}
                      </div>

                      {/* Post-task Buffer Section */}
                      {taskBufMin > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-dashed border-theme-border flex items-center justify-between text-xs flex-wrap gap-2">
                          <div className="flex items-center gap-2 text-theme-muted">
                            <span className="font-mono font-bold text-[11px] text-purple-600 dark:text-purple-400">
                              🟣 {taskBufMin}m Buffer Margin ({task.endTime} → {addMinutesToTime(task.endTime, taskBufMin)})
                            </span>
                          </div>

                          {matchingBufferNote ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1 font-medium">
                                <span>☕ Logged:</span>
                                <strong>{matchingBufferNote.activityTag}</strong>
                                {matchingBufferNote.notes && <span className="truncate max-w-[120px]">("{matchingBufferNote.notes}")</span>}
                              </span>
                              <button
                                onClick={() => openBufferNoteModal({ existingNote: matchingBufferNote })}
                                className="text-[11px] font-bold text-amber-600 hover:underline cursor-pointer"
                              >
                                Edit Note
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openBufferNoteModal({
                                date: selectedDate,
                                startTime: task.endTime,
                                endTime: addMinutesToTime(task.endTime, taskBufMin),
                                durationMinutes: taskBufMin,
                                relatedTaskId: task.id,
                                relatedTaskTitle: task.title
                              })}
                              className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Coffee className="w-3.5 h-3.5" />
                              <span>+ Log Buffer Note</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Bottom Action Line & Metrics */}
                      <div className="mt-3 pt-2.5 border-t border-theme-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                        
                        <div className="flex items-center gap-3 text-[11px] text-theme-muted">
                          {task.totalActualMinutes > 0 && (
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              Logged Time: {task.totalActualMinutes}m
                            </span>
                          )}
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
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-sm cursor-pointer"
                              >
                                <Pause className="w-3 h-3" />
                                <span>Pause</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => startTask(task.id)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-sm cursor-pointer"
                              >
                                <Play className="w-3 h-3" />
                                <span>Start</span>
                              </button>
                            )
                          )}

                          {!isDone ? (
                            <button
                              onClick={() => completeTask(task.id)}
                              className="p-1.5 rounded-lg border border-theme-border hover:bg-emerald-50 hover:text-emerald-600 text-theme-muted transition-colors cursor-pointer"
                              title="Mark Done"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => updateTask({ ...task, status: 'Pending' })}
                              className="p-1.5 rounded-lg text-emerald-600 bg-emerald-100 dark:bg-emerald-950 hover:bg-emerald-200 cursor-pointer"
                              title="Reopen"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onOpenTaskModal(task)}
                            className="p-1.5 rounded-lg border border-theme-border hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => requestDeleteTask(task, selectedDate)}
                            className="p-1.5 rounded-lg border border-theme-border hover:bg-rose-50 hover:text-rose-600 text-theme-muted transition-colors cursor-pointer"
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
