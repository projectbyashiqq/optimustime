import React, { useRef, useEffect } from 'react';
import { Task, DaySlice24, BufferStatusNote } from '../../types';
import { useApp } from '../../context/AppContext';
import { getBufferActivityEmoji } from '../../utils/timeUtils';
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  Coffee, 
  Moon, 
  Plus, 
  Edit2, 
  Trash2,
  Sparkles
} from 'lucide-react';

interface TimelineProGridProps {
  slices: DaySlice24[];
  selectedDate: string;
  isToday: boolean;
  nowMinutes: number;
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
}

export const TimelineProGrid: React.FC<TimelineProGridProps> = ({
  slices,
  selectedDate,
  isToday,
  nowMinutes,
  onOpenTaskModal
}) => {
  const { 
    prioritySettings,
    startTask, 
    pauseTask, 
    completeTask, 
    openBufferNoteModal, 
    deleteBufferNote,
    toggleSliceSignalNoise 
  } = useApp();

  const containerRef = useRef<HTMLDivElement>(null);
  const HOUR_HEIGHT = 60; // 60px per hour = 1px per minute = 1,440px total

  // Scroll to current time if today
  useEffect(() => {
    if (isToday && containerRef.current) {
      const scrollPos = Math.max(0, nowMinutes * (HOUR_HEIGHT / 60) - 150);
      containerRef.current.scrollTop = scrollPos;
    }
  }, [isToday, nowMinutes]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Canvas Header */}
      <div className="flex items-center justify-between px-2 text-xs font-bold text-theme-muted">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          Proportional 24-Hour Grid (12:00 AM → 11:59 PM • 1px/min)
        </span>
        <span className="font-mono text-[11px]">
          {isToday ? 'Live Continuous Tracking Active' : 'Historical Schedule Canvas'}
        </span>
      </div>

      {/* Main Scrollable Canvas */}
      <div 
        ref={containerRef}
        className="relative h-[720px] overflow-y-auto rounded-3xl border border-theme-border glass-panel bg-theme-card/40 p-4 shadow-inner"
      >
        <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          
          {/* Background Hour Lines & Time Labels */}
          {hours.map((hour) => {
            const topPx = hour * HOUR_HEIGHT;
            const hourLabel = hour === 0 ? '12:00 AM' 
              : hour < 12 ? `${hour}:00 AM` 
              : hour === 12 ? '12:00 PM' 
              : `${hour - 12}:00 PM`;

            return (
              <div 
                key={hour} 
                className="absolute left-0 right-0 flex items-start border-t border-theme-border/30 group"
                style={{ top: `${topPx}px`, height: `${HOUR_HEIGHT}px` }}
              >
                <div className="w-20 sm:w-24 shrink-0 font-mono text-[11px] font-bold text-theme-muted -mt-2.5 bg-theme-card/90 px-2 py-0.5 rounded-md border border-theme-border/40 shadow-2xs">
                  {hourLabel}
                </div>
                <div className="flex-1 border-t border-dashed border-theme-border/20 mt-0" />
              </div>
            );
          })}

          {/* Slices positioned with exact minutes */}
          {slices.map((slice) => {
            const top = (slice.startMinute / 1440) * (24 * HOUR_HEIGHT);
            const height = Math.max(26, (slice.durationMinutes / 1440) * (24 * HOUR_HEIGHT));
            const isWork = slice.type.startsWith('work_');
            const isBuffer = slice.type === 'buffer_note';
            const isGap = slice.type === 'unaccounted_gap';
            const isSleep = slice.type === 'sleep';
            const isSignal = slice.signalNoise === 'signal';

            let cardBg = 'bg-theme-card border-theme-border';
            if (slice.type === 'work_active') cardBg = 'bg-blue-600/90 text-white border-blue-400 ring-2 ring-blue-500/40 shadow-md';
            else if (slice.type === 'work_completed') cardBg = 'bg-emerald-500/15 border-emerald-400/50 text-emerald-900 dark:text-emerald-200';
            else if (isWork) cardBg = 'bg-blue-500/10 border-blue-400/40 text-blue-900 dark:text-blue-200';
            else if (isBuffer) cardBg = isSignal ? 'bg-amber-500/15 border-amber-400/50' : 'bg-rose-500/15 border-rose-400/50';
            else if (isSleep) cardBg = 'bg-indigo-950/20 border-indigo-500/30 text-indigo-900 dark:text-indigo-200';
            else if (isGap) cardBg = 'bg-amber-500/5 border-dashed border-amber-500/30';

            return (
              <div
                key={slice.id}
                style={{ top: `${top}px`, height: `${height}px`, left: '96px', right: '8px' }}
                className={`absolute rounded-xl border p-2 overflow-hidden transition-all hover:z-20 hover:shadow-md cursor-pointer flex flex-col justify-between ${cardBg}`}
                onClick={() => {
                  if (slice.task) onOpenTaskModal(slice.task);
                  else if (slice.bufferNote) openBufferNoteModal({ existingNote: slice.bufferNote });
                  else if (isGap) {
                    openBufferNoteModal({
                      date: selectedDate,
                      startTime: slice.startTime,
                      endTime: slice.endTime,
                      durationMinutes: slice.durationMinutes
                    });
                  }
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 shrink-0">
                      {slice.startTime} – {slice.endTime} ({slice.durationMinutes}m)
                    </span>
                    <span className="text-xs font-bold truncate">
                      {slice.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSliceSignalNoise(slice);
                      }}
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded shadow-2xs ${
                        isSignal ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                      }`}
                    >
                      {isSignal ? 'SIGNAL' : 'NOISE'}
                    </button>
                  </div>
                </div>

                {/* Secondary row if space permits */}
                {height > 44 && (
                  <div className="flex items-center justify-between text-[10px] text-theme-muted pt-1">
                    <span className="truncate">
                      {slice.task?.projectCode || slice.bufferNote?.notes || (isGap ? 'Free Time Void' : '')}
                    </span>
                    {slice.task && (
                      <span className="font-bold uppercase text-[9px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">
                        {slice.task.status}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Live "NOW" Laser line if viewing today */}
          {isToday && (
            <div
              style={{ top: `${(nowMinutes / 1440) * (24 * HOUR_HEIGHT)}px` }}
              className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
            >
              <div className="w-20 sm:w-24 shrink-0 flex items-center justify-end pr-2">
                <span className="bg-red-600 text-white text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                  NOW
                </span>
              </div>
              <div className="flex-1 timeline-laser-line rounded-full" />
              <div className="w-2.5 h-2.5 rounded-full bg-red-600 ring-4 ring-red-500/40 -ml-1" />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
