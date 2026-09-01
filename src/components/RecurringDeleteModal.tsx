import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  AlertTriangle, 
  Trash2, 
  RotateCcw, 
  Calendar, 
  Clock, 
  X,
  Repeat,
  Flame
} from 'lucide-react';

export const RecurringDeleteModal: React.FC = () => {
  const { 
    recurringDeletePrompt, 
    closeRecurringDeletePrompt, 
    deleteRecurringInstance, 
    deleteRecurringSeries,
    prioritySettings
  } = useApp();

  if (!recurringDeletePrompt || !recurringDeletePrompt.isOpen || !recurringDeletePrompt.task) {
    return null;
  }

  const { task, date } = recurringDeletePrompt;
  const targetDate = date || task.taskDate;
  const pMeta = prioritySettings[task.priority];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-theme-card border border-theme-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-scale-up">
        
        {/* Header Ribbon */}
        <div className="px-5 py-4 border-b border-theme-border flex items-center justify-between bg-gradient-to-r from-amber-500/15 via-red-500/10 to-orange-500/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/25">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-theme-text font-display">
                  Delete Recurring Task
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  {task.recurrence}
                </span>
              </div>
              <p className="text-xs text-theme-muted font-medium">
                Choose how you want to manage this recurring schedule
              </p>
            </div>
          </div>

          <button
            onClick={closeRecurringDeletePrompt}
            className="p-2 rounded-xl text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          
          {/* Target Task Summary Card */}
          <div className="p-3.5 rounded-2xl bg-theme-card-hover border border-theme-border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded font-mono ${
                  task.priority === 'P1' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                  task.priority === 'P2' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                }`}>
                  {task.priority} • {pMeta?.label}
                </span>
                <span className="text-[10px] font-mono text-theme-muted font-bold">
                  {task.projectCode}
                </span>
              </div>

              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{task.startTime} - {task.endTime}</span>
              </span>
            </div>

            <h4 className="text-sm font-bold text-theme-text">
              {task.title}
            </h4>

            <div className="flex items-center gap-2 text-xs text-theme-muted flex-wrap pt-1 border-t border-theme-border/60">
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                <Calendar className="w-3.5 h-3.5" />
                Selected Date: <strong>{targetDate}</strong>
              </span>
              <span>•</span>
              <span>Repeats: <strong>{task.recurrence}</strong> {task.selectedDays && task.selectedDays.length > 0 ? `(${task.selectedDays.join(', ')})` : ''}</span>
            </div>
          </div>

          <p className="text-xs text-theme-muted leading-relaxed">
            This task is part of a recurring series. Would you like to delete only this specific occurrence or remove the entire recurring series?
          </p>

          {/* Action Options */}
          <div className="space-y-2.5 pt-1">
            
            {/* Option 1: Delete This Occurrence Only */}
            <button
              onClick={() => deleteRecurringInstance(task.id, targetDate)}
              className="w-full p-4 rounded-2xl border-2 border-amber-300 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 text-left transition-all group flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5 group-hover:scale-105 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-black text-amber-950 dark:text-amber-200">
                    Delete This Occurrence Only ({targetDate})
                  </h5>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed mt-0.5">
                    Removes only this day's slot from your schedule. Future recurring occurrences will continue as scheduled.
                  </p>
                </div>
              </div>
            </button>

            {/* Option 2: Delete Entire Recurring Series */}
            <button
              onClick={() => deleteRecurringSeries(task.id)}
              className="w-full p-4 rounded-2xl border-2 border-red-300 dark:border-red-800/80 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/60 dark:hover:bg-red-900/30 text-left transition-all group flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5 group-hover:scale-105 transition-transform">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-black text-red-950 dark:text-red-200">
                    Delete Entire Recurring Series (All Dates)
                  </h5>
                  <p className="text-[11px] text-red-800/80 dark:text-red-300/80 leading-relaxed mt-0.5">
                    Permanently removes this master recurring rule. All future occurrences will stop completely.
                  </p>
                </div>
              </div>
            </button>

          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-theme-border flex items-center justify-end bg-theme-card-hover/40">
          <button
            onClick={closeRecurringDeletePrompt}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors"
          >
            Cancel (Keep Task)
          </button>
        </div>

      </div>
    </div>
  );
};
