import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task, PriorityLevel, RecurrenceType } from '../types';
import { 
  Repeat, 
  Clock, 
  Calendar, 
  Pause, 
  Play, 
  Trash2, 
  Edit2, 
  Plus, 
  X, 
  CheckCircle2, 
  AlertCircle,
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface RecurringManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTaskModal: (task?: Task) => void;
}

export const RecurringManagerModal: React.FC<RecurringManagerModalProps> = ({
  isOpen,
  onClose,
  onOpenTaskModal
}) => {
  const { 
    tasks, 
    prioritySettings, 
    pauseRecurringSeries, 
    resumeRecurringSeries, 
    deleteRecurringSeries,
    updateTask,
    requestDeleteTask
  } = useApp();

  const [filterRecurrence, setFilterRecurrence] = useState<string>('ALL');

  if (!isOpen) return null;

  const recurringTasks = tasks.filter(t => t.recurrence && t.recurrence !== 'None');

  const filteredTasks = recurringTasks.filter(t => {
    if (filterRecurrence !== 'ALL' && t.recurrence !== filterRecurrence) return false;
    return true;
  });

  const handleClearExclusions = (task: Task) => {
    updateTask({
      ...task,
      excludedDates: []
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-theme-card border border-theme-border rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-theme-border flex items-center justify-between bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-theme-text font-display">
                  Recurring Tasks & Schedules Hub
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {recurringTasks.length} Series Active
                </span>
              </div>
              <p className="text-xs text-theme-muted font-medium">
                Separate centralized management for recurring event rules, exceptions, and series deletions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenTaskModal();
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New Recurring Task</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-theme-border flex items-center justify-between gap-3 flex-wrap bg-theme-card-hover/30 text-xs font-bold">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {['ALL', 'Daily', 'Selected Days', 'Weekly', 'Monthly', 'Yearly'].map((rec) => (
              <button
                key={rec}
                onClick={() => setFilterRecurrence(rec)}
                className={`px-3 py-1 rounded-xl transition-all whitespace-nowrap ${
                  filterRecurrence === rec
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-theme-card hover:bg-theme-border text-theme-muted hover:text-theme-text border border-theme-border'
                }`}
              >
                {rec === 'ALL' ? `All (${recurringTasks.length})` : rec}
              </button>
            ))}
          </div>
        </div>

        {/* Task List */}
        <div className="p-6 space-y-3 overflow-y-auto flex-1">
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-theme-card-hover/40 border border-dashed border-theme-border space-y-3">
              <Repeat className="w-8 h-8 text-theme-muted mx-auto opacity-40" />
              <h5 className="text-sm font-bold text-theme-text">No Recurring Tasks Found</h5>
              <p className="text-xs text-theme-muted max-w-sm mx-auto">
                {filterRecurrence === 'ALL' 
                  ? "You don't have any repeating schedules configured yet. Click '+ New Recurring Task' to schedule daily standups, weekly reviews, or routine habits."
                  : `No tasks configured with '${filterRecurrence}' recurrence.`}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const pMeta = prioritySettings[task.priority];
              const isPaused = task.status === 'Hold';
              const excludedCount = (task.excludedDates || []).length;

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-2xl border transition-all space-y-3 ${
                    isPaused
                      ? 'bg-theme-card/60 border-theme-border opacity-75'
                      : 'bg-theme-card border-theme-border hover:border-blue-400 shadow-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    
                    {/* Title & Priority Header */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded font-mono ${
                          task.priority === 'P1' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                          task.priority === 'P2' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                          'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        }`}>
                          {task.priority} • {pMeta?.label}
                        </span>

                        <span className="text-[10px] font-mono font-bold text-theme-muted px-2 py-0.5 rounded bg-theme-card-hover border border-theme-border">
                          {task.projectCode}
                        </span>

                        <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{task.startTime} - {task.endTime} ({task.appointedMinutes}m)</span>
                        </span>

                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isPaused
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {isPaused ? '⏸ Paused Schedule' : '● Active Schedule'}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-theme-text truncate">
                        {task.title}
                      </h4>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                      {isPaused ? (
                        <button
                          onClick={() => resumeRecurringSeries(task.id)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1"
                          title="Resume Recurring Schedule"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Resume</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => pauseRecurringSeries(task.id)}
                          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1"
                          title="Pause Recurring Schedule"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onClose();
                          onOpenTaskModal(task);
                        }}
                        className="p-1.5 rounded-xl border border-theme-border hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
                        title="Edit Master Recurring Task"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => requestDeleteTask(task)}
                        className="p-1.5 rounded-xl border border-theme-border hover:bg-red-50 hover:text-red-600 text-theme-muted transition-colors"
                        title="Delete Recurring Schedule / Occurrence"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>

                  {/* Recurrence Rule Banner */}
                  <div className="p-2.5 rounded-xl bg-theme-card-hover border border-theme-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-theme-muted font-medium">
                      <Repeat className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>
                        Rule: <strong className="text-theme-text">{task.recurrence}</strong>
                        {task.selectedDays && task.selectedDays.length > 0 && (
                          <span> ({task.selectedDays.join(', ')})</span>
                        )}
                        <span> • Started on {task.taskDate}</span>
                      </span>
                    </div>

                    {excludedCount > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                          {excludedCount} date{excludedCount > 1 ? 's' : ''} skipped
                        </span>
                        <button
                          onClick={() => handleClearExclusions(task)}
                          className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                          title="Restore all skipped dates for this recurring series"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore skipped dates</span>
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
