import React from 'react';
import { useApp } from '../context/AppContext';
import { Task } from '../types';
import { addMinutesToTime, RecommendedSlot } from '../utils/timeUtils';
import { AlertTriangle, ArrowRight, Layers, Clock, X, Coffee, Sparkles, Lock, CheckCircle2 } from 'lucide-react';

interface ConflictModalProps {
  conflictingTasks: Task[];
  pendingTaskTitle: string;
  appointedMinutes: number;
  candidateSlots?: RecommendedSlot[];
  onAutoShift: (newCalculatedStartTime: string) => void;
  onSimultaneous: () => void;
  onSelectSlot?: (startTime: string) => void;
  onCancel: () => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  conflictingTasks,
  pendingTaskTitle,
  appointedMinutes,
  candidateSlots = [],
  onAutoShift,
  onSimultaneous,
  onSelectSlot,
  onCancel
}) => {
  const { capacitySettings } = useApp();
  // Find the latest end time + buffer among all conflicting tasks
  const primaryConflict = conflictingTasks[0];
  const bufferMinutes = primaryConflict?.bufferMinutes ?? (capacitySettings.defaultBufferMinutes || 15);
  const newCalculatedStart = primaryConflict ? addMinutesToTime(primaryConflict.endTime, bufferMinutes) : '10:00 AM';
  const newCalculatedEnd = addMinutesToTime(newCalculatedStart, appointedMinutes);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-theme-card border border-red-300 dark:border-red-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-slide-up">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600 dark:text-red-400">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-base font-bold text-theme-text">
                Time Overlap Detected!
              </h3>
              <p className="text-xs text-theme-muted">
                System rule: New tasks must schedule after work & break times.
              </p>
            </div>
          </div>
          <button 
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-theme-card-hover text-theme-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Details Card */}
        <div className="p-4 rounded-xl bg-red-50/60 dark:bg-red-950/25 border border-red-200 dark:border-red-900/50 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
              <span>Active Conflicting Task:</span>
              {primaryConflict?.isMandatorySchedule && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  MANDATORY LOCKED
                </span>
              )}
            </span>
            <span className="font-mono font-bold text-red-600 dark:text-red-400">
              [{primaryConflict?.projectCode}]
            </span>
          </div>

          <div className="font-semibold text-sm text-theme-text">
            "{primaryConflict ? primaryConflict.title : 'Existing Task'}"
          </div>

          {primaryConflict?.isMandatorySchedule && (
            <div className="p-2 rounded-lg bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>This task has a Mandatory Fixed Schedule and cannot be shifted. The pending task must be placed after it.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-red-200/60 dark:border-red-900/40 text-xs">
            <div>
              <span className="text-theme-muted block text-[11px]">Work Time:</span>
              <strong className="text-theme-text font-mono">
                {primaryConflict?.startTime} - {primaryConflict?.endTime}
              </strong>
            </div>
            <div>
              <span className="text-theme-muted block text-[11px] flex items-center gap-1">
                <Coffee className="w-3 h-3 text-amber-500" />
                Break / Buffer:
              </span>
              <strong className="text-amber-700 dark:text-amber-400 font-mono">
                +{bufferMinutes} min (until {newCalculatedStart})
              </strong>
            </div>
          </div>
        </div>

        {/* Suggested Placement Card */}
        <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-1">
          <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            Auto-Calculated Placement:
          </div>
          <div className="text-xs text-theme-text">
            Task <strong>"{pendingTaskTitle}"</strong> will start at <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{newCalculatedStart} - {newCalculatedEnd}</span> (immediately following the {bufferMinutes}m break).
          </div>
        </div>

        {/* Action Choice Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => onAutoShift(newCalculatedStart)}
            className="flex flex-col items-start p-3.5 rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-600 hover:bg-blue-700 text-white transition-all text-left shadow-md group"
          >
            <div className="flex items-center justify-between w-full font-bold text-xs mb-1">
              <span>Add After Work & Break</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
            <span className="text-[11px] text-blue-100">
              Sets start to {newCalculatedStart} and cascades downstream tasks automatically.
            </span>
          </button>

          <button
            onClick={onSimultaneous}
            className="flex flex-col items-start p-3.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 hover:bg-purple-100/70 text-purple-900 dark:text-purple-200 transition-all text-left group"
          >
            <div className="flex items-center justify-between w-full font-bold text-xs text-purple-600 dark:text-purple-400 mb-1">
              <span>Simultaneous Track</span>
              <Layers className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[11px] text-theme-muted">
              Run concurrently in dual parallel track.
            </span>
          </button>
        </div>

        {/* Candidate Available Free Slots on this Day */}
        {candidateSlots.length > 0 && onSelectSlot && (
          <div className="space-y-1.5 p-3 rounded-xl bg-theme-card-hover border border-theme-border">
            <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block">
              Or Pick An Available Free Slot on this Day:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {candidateSlots.map((slot, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectSlot(slot.startTime)}
                  className="flex items-center justify-between p-2 rounded-lg bg-theme-card border border-theme-border hover:border-blue-500 text-xs font-semibold text-theme-text transition-colors group"
                >
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                    {slot.label}
                  </span>
                  <span className="font-mono text-[10px] text-theme-muted group-hover:text-theme-text">
                    {slot.startTime} - {slot.endTime}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Secondary Cancel */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-theme-muted hover:text-theme-text rounded-lg transition-colors"
          >
            Cancel & Adjust Manually
          </button>
        </div>

      </div>
    </div>
  );
};

