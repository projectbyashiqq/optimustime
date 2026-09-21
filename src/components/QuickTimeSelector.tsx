import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../types';
import { useApp } from '../context/AppContext';
import { 
  parse12HourToMinutes, 
  formatMinutesTo12Hour, 
  addMinutesToTime, 
  isNoTimeTask,
  getCurrentRoundedTime12Hour,
  getBangladeshNow,
  formatBangladeshTime
} from '../utils/timeUtils';
import { Clock, Zap, Check, ChevronDown, Timer, Calendar, X } from 'lucide-react';

interface QuickTimeSelectorProps {
  task: Task;
  className?: string;
  isInSleep?: boolean;
}

const COMMON_SLOTS = [
  '09:00 AM',
  '11:00 AM',
  '01:00 PM',
  '03:00 PM',
  '05:00 PM',
  '07:00 PM',
  '09:00 PM',
  '11:00 PM'
];

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export const QuickTimeSelector: React.FC<QuickTimeSelectorProps> = ({
  task,
  className = '',
  isInSleep = false
}) => {
  const { updateTask } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isNoTime = isNoTimeTask(task);

  // Local draft state for quick editing
  const [startTime, setStartTime] = useState(isNoTime ? '09:00 AM' : task.startTime);
  const [durationMinutes, setDurationMinutes] = useState(task.appointedMinutes > 0 ? task.appointedMinutes : 30);
  const [endTime, setEndTime] = useState(isNoTime ? addMinutesToTime('09:00 AM', 30) : task.endTime);

  // Sync draft when task changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (isNoTime) {
        const roundedNow = getCurrentRoundedTime12Hour(15);
        setStartTime(roundedNow);
        setDurationMinutes(30);
        setEndTime(addMinutesToTime(roundedNow, 30));
      } else {
        setStartTime(task.startTime);
        setDurationMinutes(task.appointedMinutes > 0 ? task.appointedMinutes : 30);
        setEndTime(task.endTime);
      }
    }
  }, [isOpen, task, isNoTime]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  // 1-Click Action: Make task Anytime / No Time
  const handleSetAnytime = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask({
      ...task,
      hasNoTime: true,
      startTime: 'Anytime',
      endTime: 'Anytime',
      appointedMinutes: 0
    });
    setIsOpen(false);
  };

  // 1-Click Action: Start Right Now (Bangladesh Time)
  const handleSetToNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const bdNow = getBangladeshNow();
    const bdFormatted = formatBangladeshTime(bdNow);
    const now12h = `${bdFormatted.timeClean} ${bdFormatted.period}`;
    const dur = durationMinutes > 0 ? durationMinutes : 30;
    const newEnd = addMinutesToTime(now12h, dur);

    updateTask({
      ...task,
      hasNoTime: false,
      startTime: now12h,
      endTime: newEnd,
      appointedMinutes: dur
    });
    setIsOpen(false);
  };

  // Select a preset slot
  const handleSelectSlot = (slot: string) => {
    setStartTime(slot);
    setEndTime(addMinutesToTime(slot, durationMinutes));
  };

  // Select a duration preset
  const handleSelectDuration = (dur: number) => {
    setDurationMinutes(dur);
    setEndTime(addMinutesToTime(startTime, dur));
  };

  // Apply custom time
  const handleApplyTime = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startMins = parse12HourToMinutes(startTime);
    const endMins = parse12HourToMinutes(endTime);
    let diff = endMins - startMins;
    if (diff <= 0) diff += 1440; // Midnight crossover
    const finalDuration = durationMinutes > 0 ? durationMinutes : diff;

    updateTask({
      ...task,
      hasNoTime: false,
      startTime,
      endTime,
      appointedMinutes: finalDuration
    });
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Time Badge Trigger */}
      <button
        type="button"
        onClick={handleToggle}
        className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer select-none active:scale-95 border ${
          isNoTime
            ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
            : isInSleep
            ? 'night-time-pill hover:brightness-110'
            : 'text-theme-text bg-theme-card-hover border-theme-border hover:border-blue-400/80 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 shadow-2xs'
        }`}
        title="Click to quickly change time slot or set to Anytime"
      >
        {isNoTime ? (
          <>
            <Zap className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
            <span>Anytime</span>
            <span className="text-[10px] font-normal opacity-70 hidden sm:inline">(Free Slot)</span>
          </>
        ) : (
          <>
            <Clock className="w-3 h-3 text-blue-500 shrink-0" />
            <span>{task.startTime} - {task.endTime}</span>
            {task.appointedMinutes > 0 && (
              <span className="text-[10px] font-normal opacity-75">({task.appointedMinutes}m)</span>
            )}
          </>
        )}
        <ChevronDown className={`w-3 h-3 opacity-50 group-hover:opacity-100 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Floating Time Editor Popover */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 mt-1.5 w-72 sm:w-80 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-3 space-y-3 animate-fade-in ring-1 ring-black/5"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 border-b border-theme-border/60">
            <div className="flex items-center gap-1.5 text-xs font-black text-theme-text font-display">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Quick Time Adjust</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-theme-card text-theme-muted hover:text-theme-text transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Instant 1-Click Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleSetAnytime}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isNoTime
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300/60 dark:border-amber-700/60'
              }`}
            >
              <Zap className="w-3 h-3 fill-amber-500" />
              <span>⚡ Anytime (No Time)</span>
            </button>

            <button
              type="button"
              onClick={handleSetToNow}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300/60 dark:border-blue-700/60 transition-all cursor-pointer"
            >
              <Timer className="w-3 h-3 text-blue-500" />
              <span>⏰ Set to Now</span>
            </button>
          </div>

          {/* Quick Start Slot Presets */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-theme-muted">
              Common Start Times
            </label>
            <div className="grid grid-cols-4 gap-1">
              {COMMON_SLOTS.map((slot) => {
                const isSelected = startTime === slot && !isNoTime;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => handleSelectSlot(slot)}
                    className={`py-1 px-1 rounded-lg text-[11px] font-mono font-bold text-center border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-theme-card-hover/80 hover:bg-theme-card text-theme-text border-theme-border/70'
                    }`}
                  >
                    {slot.replace(':00', '')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration Presets */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-theme-muted">
              <span>Duration</span>
              <span className="text-blue-600 dark:text-blue-400 lowercase">{durationMinutes}m</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {DURATION_PRESETS.map((dur) => {
                const isSelected = durationMinutes === dur;
                return (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => handleSelectDuration(dur)}
                    className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-mono font-bold text-center border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-theme-card-hover/80 hover:bg-theme-card text-theme-text border-theme-border/70'
                    }`}
                  >
                    {dur >= 60 ? `${dur / 60}h` : `${dur}m`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Time Slot Inputs */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-theme-border/60 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-[10px] text-theme-muted block mb-0.5">Start Time</span>
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartTime(val);
                    setEndTime(addMinutesToTime(val, durationMinutes));
                  }}
                  placeholder="09:00 AM"
                  className="w-full px-2 py-1 rounded-lg border border-theme-border bg-theme-card text-theme-text font-bold text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <span className="text-[10px] text-theme-muted block mb-0.5">End Time</span>
                <input
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="10:30 AM"
                  className="w-full px-2 py-1 rounded-lg border border-theme-border bg-theme-card text-theme-text font-bold text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Save / Apply Button */}
          <button
            type="button"
            onClick={handleApplyTime}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 active:scale-98 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Apply Time Slot ({startTime} - {endTime})</span>
          </button>
        </div>
      )}
    </div>
  );
};
