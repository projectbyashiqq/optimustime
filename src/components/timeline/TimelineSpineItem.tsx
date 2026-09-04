import React, { useState } from 'react';
import { Task, DaySlice24, BufferStatusNote } from '../../types';
import { useApp } from '../../context/AppContext';
import { getBufferActivityEmoji } from '../../utils/timeUtils';
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Check, 
  Edit2, 
  Trash2, 
  Coffee, 
  Sparkles, 
  AlertCircle, 
  Zap, 
  BatteryCharging, 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  ExternalLink, 
  Plus, 
  Moon, 
  ShieldCheck,
  Award
} from 'lucide-react';

interface TimelineSpineItemProps {
  slice: DaySlice24;
  selectedDate: string;
  isCurrentSlice: boolean;
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
  nextSlice?: DaySlice24;
}

export const TimelineSpineItem: React.FC<TimelineSpineItemProps> = ({
  slice,
  selectedDate,
  isCurrentSlice,
  onOpenTaskModal,
  nextSlice
}) => {
  const { 
    prioritySettings,
    startTask, 
    pauseTask, 
    completeTask, 
    deleteTask,
    toggleSubTask,
    openBufferNoteModal, 
    deleteBufferNote, 
    toggleSliceSignalNoise 
  } = useApp();

  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  const isTask = slice.type.startsWith('work_');
  const task = slice.task;
  const isBufferNote = slice.type === 'buffer_note';
  const bufferNote = slice.bufferNote;
  const isGap = slice.type === 'unaccounted_gap';
  const isSleep = slice.type === 'sleep';
  const isTaskBuffer = slice.type === 'task_buffer';
  const isSignal = slice.signalNoise === 'signal';

  // Priority details
  const priorityInfo = task?.priority && prioritySettings[task.priority] 
    ? prioritySettings[task.priority] 
    : { label: task?.priority || 'P3', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.1)' };

  // Subtask calculation
  const totalSubtasks = task?.subtasks?.length || 0;
  const completedSubtasks = task?.subtasks?.filter(st => st.isCompleted).length || 0;
  const subtaskProgress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // Render Mindful Buffer Bridge (transition buffer between tasks)
  if (isTaskBuffer) {
    return (
      <div className="relative pl-8 sm:pl-12 py-2 group">
        {/* Spine Connector Dot */}
        <div className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-purple-400 border-2 border-theme-bg shadow-sm z-10 flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/20 transition-all">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">
              🟣
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-theme-text">
                  Mindful Transition Buffer
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold">
                  {slice.durationMinutes} mins
                </span>
                <span className="text-[10px] font-mono text-theme-muted hidden sm:inline">
                  {slice.startTime} – {slice.endTime}
                </span>
              </div>
              <p className="text-[11px] text-theme-muted">
                Restorative buffer to decompress and switch focus.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openBufferNoteModal({
              date: selectedDate,
              startTime: slice.startTime,
              endTime: slice.endTime,
              durationMinutes: slice.durationMinutes,
              relatedTaskId: task?.id,
              relatedTaskTitle: task?.title
            })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold shadow-xs transition-all active:scale-95"
          >
            <Coffee className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Log What You Did</span>
            <span className="sm:hidden">Log</span>
          </button>
        </div>
      </div>
    );
  }

  // Render Sleep Block
  if (isSleep) {
    return (
      <div className="relative pl-8 sm:pl-12 py-2 group">
        {/* Spine Connector Dot */}
        <div className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-indigo-600 border-2 border-theme-bg shadow-sm z-10 flex items-center justify-center">
          <Moon className="w-2.5 h-2.5 text-white" />
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/20 via-theme-card to-blue-950/20 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-theme-text uppercase tracking-wider">
                  Circadian Sleep & Recovery Window
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold">
                  {Math.floor(slice.durationMinutes / 60)}h {slice.durationMinutes % 60}m
                </span>
                <span className="text-[11px] font-mono text-theme-muted">
                  {slice.startTime} – {slice.endTime}
                </span>
              </div>
              <p className="text-[11px] text-theme-muted">
                Essential biological neuro-restoration and memory consolidation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Restorative Signal
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Render Unaccounted Free-Time Void / Gap
  if (isGap) {
    return (
      <div className="relative pl-8 sm:pl-12 py-2 group">
        {/* Spine Connector Dot */}
        <div className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-amber-400/80 border-2 border-theme-bg shadow-sm z-10" />

        <div className="p-3.5 rounded-2xl bg-amber-500/5 hover:bg-amber-500/10 border border-dashed border-amber-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-sm shrink-0">
              ⏳
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Unaccounted Time Void
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200">
                  {slice.durationMinutes} mins free time
                </span>
                <span className="text-[11px] font-mono text-theme-muted">
                  {slice.startTime} – {slice.endTime}
                </span>
              </div>
              <p className="text-[11px] text-theme-muted">
                What did you do during this window? Account for it in your daily life ledger.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => openBufferNoteModal({
                date: selectedDate,
                startTime: slice.startTime,
                endTime: slice.endTime,
                durationMinutes: slice.durationMinutes
              })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[11px] font-black shadow-xs transition-all active:scale-95"
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Turn into Diary Log</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenTaskModal(undefined, selectedDate, slice.startTime)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-theme-card hover:bg-theme-card-hover border border-theme-border text-theme-text text-[11px] font-bold transition-all"
              title="Schedule a task in this slot"
            >
              <Plus className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Schedule Task</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Logged Life Diary / Buffer Note
  if (isBufferNote && bufferNote) {
    const activityEmoji = getBufferActivityEmoji(bufferNote.activityTag);

    return (
      <div className="relative pl-8 sm:pl-12 py-2.5 group">
        {/* Spine Connector Dot */}
        <div className={`absolute left-2.5 sm:left-4 top-5 w-4 h-4 rounded-full border-2 border-theme-bg shadow-sm z-10 flex items-center justify-center ${
          isSignal ? 'bg-emerald-500' : 'bg-rose-500'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>

        <div className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-xs ${
          isSignal 
            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60' 
            : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/60'
        }`}>
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 border-b border-theme-border/40 pb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg shrink-0">
                {activityEmoji}
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-theme-text font-display">
                {bufferNote.activityTag}
              </span>

              <span className="font-mono text-xs font-bold text-theme-text bg-theme-card px-2.5 py-0.5 rounded-lg border border-theme-border shadow-2xs">
                {slice.startTime} – {slice.endTime}
              </span>

              <span className="font-mono text-[11px] font-bold text-theme-muted">
                ({slice.durationMinutes}m)
              </span>

              {/* 1-Click Flip Signal vs Noise */}
              <button
                type="button"
                onClick={() => toggleSliceSignalNoise(slice)}
                className={`text-[10px] font-black px-2 py-0.5 rounded-lg transition-all shadow-2xs ${
                  isSignal
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600'
                    : 'bg-rose-500 text-white shadow-rose-500/20 hover:bg-rose-600'
                }`}
                title="Click to flip Signal vs Noise"
              >
                {isSignal ? '🎯 SIGNAL' : '⚠️ NOISE'}
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => openBufferNoteModal({ existingNote: bufferNote })}
                className="p-1.5 rounded-lg hover:bg-theme-card text-theme-muted hover:text-theme-text transition-colors"
                title="Edit entry"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => deleteBufferNote(bufferNote.id)}
                className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-theme-muted hover:text-rose-500 transition-colors"
                title="Delete entry"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body Note Content */}
          <div className="pt-3 space-y-2">
            {bufferNote.notes ? (
              <div className="p-3 rounded-xl bg-theme-card/90 border border-theme-border/60 text-xs sm:text-sm text-theme-text font-medium leading-relaxed shadow-inner">
                "{bufferNote.notes}"
              </div>
            ) : (
              <p className="text-xs text-theme-muted italic">
                Logged free time activity: {bufferNote.activityTag}
              </p>
            )}

            {/* Energy and reflection metadata */}
            <div className="flex items-center gap-3 pt-1 text-[11px] text-theme-muted flex-wrap">
              {bufferNote.energyLevel && (
                <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                  <BatteryCharging className="w-3.5 h-3.5" />
                  <span>Energy Level: {bufferNote.energyLevel}/5</span>
                </span>
              )}

              {bufferNote.reflectionNotes && (
                <span className="text-theme-muted italic text-[11px]">
                  Reflection: {bufferNote.reflectionNotes}
                </span>
              )}

              {slice.snReason && (
                <span className="font-mono text-[10px] text-theme-muted/80">
                  [{slice.snReason}]
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Full Task Card (Active, Completed, Pending, Hold)
  if (isTask && task) {
    const isWorking = task.status === 'Working';
    const isDone = task.status === 'Done';
    const isHold = task.status === 'Hold';

    return (
      <div className="relative pl-8 sm:pl-12 py-3 group">
        {/* Spine Connector Dot */}
        <div 
          className={`absolute left-2.5 sm:left-4 top-6 w-4 h-4 rounded-full border-2 border-theme-bg shadow-sm z-10 flex items-center justify-center transition-transform ${
            isWorking 
              ? 'bg-blue-600 ring-4 ring-blue-500/30 animate-pulse scale-110' 
              : isDone 
              ? 'bg-emerald-500' 
              : 'bg-slate-400 dark:bg-slate-600'
          }`}
        >
          {isDone ? (
            <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
          ) : isWorking ? (
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
          )}
        </div>

        <div className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden shadow-xs ${
          isWorking
            ? 'card-working-ambient bg-blue-50/80 dark:bg-blue-950/30 border-blue-400 ring-2 ring-blue-500/20'
            : isDone
            ? 'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-800/40'
            : isHold
            ? 'bg-amber-50/40 dark:bg-amber-950/15 border-amber-300 dark:border-amber-800/40'
            : 'bg-theme-card hover:bg-theme-card-hover/80 border-theme-border'
        }`}>
          {isWorking && <div className="glow-accent-bar" />}

          {/* Top Bar: Time, Priority, Status, Project Code */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 border-b border-theme-border/40 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Scheduled Time Span */}
              <span className="font-mono text-xs font-bold text-theme-text bg-theme-card px-2.5 py-1 rounded-xl border border-theme-border shadow-2xs flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-theme-muted" />
                <span>{task.startTime} – {task.endTime}</span>
              </span>

              {/* Duration badge */}
              <span className="font-mono text-[11px] font-bold text-theme-muted">
                ({task.appointedMinutes}m)
              </span>

              {/* Priority Pill */}
              <span 
                className="text-[10px] font-black px-2.5 py-0.5 rounded-full font-mono uppercase"
                style={{ backgroundColor: priorityInfo.bgColor, color: priorityInfo.color }}
              >
                {priorityInfo.label}
              </span>

              {/* Category Badge */}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-theme-card-hover text-theme-muted border border-theme-border">
                {task.category}
              </span>

              {/* Project Code */}
              <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                {task.projectCode}
              </span>

              {/* Status Badge */}
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                isDone 
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : isWorking
                  ? 'bg-blue-600 text-white animate-pulse'
                  : isHold
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}>
                {task.status}
              </span>

              {/* 1-Click Signal vs Noise flip */}
              <button
                type="button"
                onClick={() => toggleSliceSignalNoise(slice)}
                className={`text-[10px] font-black px-2 py-0.5 rounded-lg transition-all shadow-2xs ${
                  isSignal
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600'
                    : 'bg-rose-500 text-white shadow-rose-500/20 hover:bg-rose-600'
                }`}
                title="Click to toggle Signal vs Noise"
              >
                {isSignal ? '🎯 SIGNAL' : '⚠️ NOISE'}
              </button>
            </div>

            {/* Task Controls: Start / Pause / Complete / Edit / Delete */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              {!isDone && (
                <>
                  {isWorking ? (
                    <button
                      type="button"
                      onClick={() => pauseTask(task.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
                      title="Pause Working"
                    >
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startTask(task.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
                      title="Start Working Now"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => completeTask(task.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
                    title="Mark Done"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => onOpenTaskModal(task)}
                className="p-1.5 rounded-xl hover:bg-theme-card text-theme-muted hover:text-theme-text transition-colors"
                title="Edit Task"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => deleteTask(task.id)}
                className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-theme-muted hover:text-rose-500 transition-colors"
                title="Delete Task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Title & Description */}
          <div className="pt-3 space-y-2">
            <h4 className={`text-base font-bold text-theme-text leading-snug ${isDone ? 'line-through opacity-85' : ''}`}>
              {task.title}
            </h4>

            {task.description && (
              <p className="text-xs sm:text-sm text-theme-muted leading-relaxed">
                {task.description}
              </p>
            )}

            {/* Discrepancy Badges (Late Start, Early Start, Saved Minutes) */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {task.savedFreeMinutes && task.savedFreeMinutes > 0 && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-500" />
                  <span>Finished early! Saved {task.savedFreeMinutes}m free time gained</span>
                </span>
              )}

              {task.startDiscrepancyMinutes !== undefined && task.startDiscrepancyMinutes !== 0 && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg ${
                  task.startDiscrepancyMinutes > 0
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                    : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                }`}>
                  {task.startDiscrepancyMinutes > 0 ? `Late start: +${task.startDiscrepancyMinutes}m` : `Early start: ${task.startDiscrepancyMinutes}m`}
                </span>
              )}

              {task.actualStartTime && (
                <span className="text-[10px] font-mono text-theme-muted">
                  Actual: {task.actualStartTime} {task.actualEndTime ? `– ${task.actualEndTime}` : ''}
                </span>
              )}
            </div>

            {/* Interactive Subtasks Section */}
            {totalSubtasks > 0 && (
              <div className="pt-2 border-t border-theme-border/40 space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsSubtasksExpanded(!isSubtasksExpanded)}
                    className="flex items-center gap-1.5 text-xs font-bold text-theme-muted hover:text-theme-text transition-colors"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSubtasksExpanded ? 'rotate-180' : ''}`} />
                    <span>Subtasks ({completedSubtasks}/{totalSubtasks})</span>
                  </button>

                  <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                    {subtaskProgress}% Complete
                  </span>
                </div>

                {/* Subtask Progress Bar */}
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${subtaskProgress}%` }}
                  />
                </div>

                {/* Collapsible Subtask Checklist */}
                {isSubtasksExpanded && (
                  <div className="space-y-1.5 pt-1 pl-2">
                    {task.subtasks.map((st) => (
                      <div 
                        key={st.id}
                        onClick={() => toggleSubTask(task.id, st.id)}
                        className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg hover:bg-theme-card/60 cursor-pointer group transition-colors"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          st.isCompleted 
                            ? 'bg-blue-600 border-blue-600 text-white' 
                            : 'border-theme-border bg-theme-card group-hover:border-blue-500'
                        }`}>
                          {st.isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className={`text-theme-text font-medium ${st.isCompleted ? 'line-through text-theme-muted' : ''}`}>
                          {st.title}
                        </span>
                        {st.assignedTimeMin && (
                          <span className="text-[10px] font-mono text-theme-muted ml-auto">
                            {st.assignedTimeMin}m
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes & Links toggle */}
            {(task.notes || (task.links && task.links.length > 0)) && (
              <div className="pt-2 border-t border-theme-border/40">
                <button
                  type="button"
                  onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                  className="text-xs font-bold text-theme-muted hover:text-theme-text flex items-center gap-1 transition-colors"
                >
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isNotesExpanded ? 'rotate-90' : ''}`} />
                  <span>{isNotesExpanded ? 'Hide Details & Links' : 'Show Details & Links'}</span>
                </button>

                {isNotesExpanded && (
                  <div className="pt-2 space-y-2 text-xs">
                    {task.notes && (
                      <div className="p-3 rounded-xl bg-theme-card/80 border border-theme-border/60 text-theme-text leading-relaxed">
                        {task.notes}
                      </div>
                    )}

                    {task.links && task.links.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.links.map(link => (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-theme-card hover:bg-theme-card-hover border border-theme-border text-[11px] font-bold text-blue-600 dark:text-blue-400 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>{link.title || link.url}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }

  return null;
};
