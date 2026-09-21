import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PriorityLevel } from '../types';
import { 
  getDayOfWeekFromDate, 
  calculateNextFreeTimeAfterTimedTasks 
} from '../utils/timeUtils';
import { 
  Plus, 
  Check, 
  Clock, 
  Sparkles, 
  Coffee, 
  Zap,
  Calendar
} from 'lucide-react';

interface QuickTaskEntryBarProps {
  selectedDate: string;
  onDateChange?: (date: string) => void;
  className?: string;
}

const PRIORITIES: PriorityLevel[] = ['P1', 'P2', 'P3', 'P4', 'P5'];
const COMMON_DURATIONS = [15, 30, 45, 60, 90];

export const QuickTaskEntryBar: React.FC<QuickTaskEntryBarProps> = ({
  selectedDate,
  onDateChange,
  className = ''
}) => {
  const { 
    addTask, 
    categories, 
    prioritySettings, 
    tasks, 
    capacitySettings, 
    defaultTaskSettings 
  } = useApp();

  const [title, setTitle] = useState('');
  
  // Follow the user's task adding rules and presets
  const initialPriority = defaultTaskSettings?.defaultPriority || 'P1';
  const initialCategory = defaultTaskSettings?.defaultCategory || categories[0]?.name || 'VRTX';
  const initialDuration = defaultTaskSettings?.defaultAppointedMinutes 
    || prioritySettings[initialPriority]?.defaultMinutes 
    || 60;

  const [priority, setPriority] = useState<PriorityLevel>(initialPriority);
  const [category, setCategory] = useState<string>(initialCategory);
  const [duration, setDuration] = useState<number>(initialDuration > 0 ? initialDuration : 30);
  const [isSuccessFlash, setIsSuccessFlash] = useState(false);
  const [lastAddedSlot, setLastAddedSlot] = useState<string>('');
  const [scheduleMode, setScheduleMode] = useState<'auto-slot' | 'anytime'>('auto-slot');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync state if defaultTaskSettings update in background
  useEffect(() => {
    if (defaultTaskSettings) {
      if (defaultTaskSettings.defaultPriority) {
        setPriority(defaultTaskSettings.defaultPriority);
      }
      if (defaultTaskSettings.defaultCategory) {
        setCategory(defaultTaskSettings.defaultCategory);
      }
      const defDur = defaultTaskSettings.defaultAppointedMinutes 
        || prioritySettings[defaultTaskSettings.defaultPriority]?.defaultMinutes 
        || 60;
      if (defDur > 0) {
        setDuration(defDur);
      }
    }
  }, [defaultTaskSettings, prioritySettings]);

  // When priority changes manually, update duration to that priority's rule
  const handlePriorityChange = (newP: PriorityLevel) => {
    setPriority(newP);
    const defM = prioritySettings[newP]?.defaultMinutes;
    if (defM && defM > 0) {
      setDuration(defM);
    } else {
      setDuration(30);
    }
  };

  // Calculate the next free slot after timed tasks according to user rules
  const nextSlot = useMemo(() => {
    if (scheduleMode === 'anytime') return null;
    return calculateNextFreeTimeAfterTimedTasks({
      selectedDate,
      durationMinutes: duration,
      tasks,
      capacitySettings,
      defaultTaskSettings,
      defaultBufferMinutes: defaultTaskSettings?.defaultBufferMinutes
    });
  }, [scheduleMode, selectedDate, duration, tasks, capacitySettings, defaultTaskSettings]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      inputRef.current?.focus();
      return;
    }

    const defaultBuffer = defaultTaskSettings?.defaultBufferMinutes ?? capacitySettings?.defaultBufferMinutes ?? 15;
    const isAutoSlot = scheduleMode === 'auto-slot' && nextSlot;

    const taskDate = isAutoSlot ? nextSlot.targetDate : selectedDate;
    const crossesMidnight = isAutoSlot ? nextSlot.crossesMidnight : false;
    const endDate = isAutoSlot ? nextSlot.endDate : taskDate;

    // Fast-add task scheduled into the next free time following all rules
    addTask({
      title: title.trim(),
      description: '',
      taskDate,
      dayOfWeek: getDayOfWeekFromDate(taskDate),
      priority,
      category,
      startTime: isAutoSlot ? nextSlot.startTime : 'Anytime',
      endTime: isAutoSlot ? nextSlot.endTime : 'Anytime',
      crossesMidnight,
      endDate,
      hasNoTime: !isAutoSlot,
      appointedMinutes: duration,
      bufferMinutes: isAutoSlot ? defaultBuffer : 0,
      status: 'Pending',
      recurrence: 'None',
      subtasks: [],
      links: [],
      signalNoise: priority === 'P5' ? 'noise' : 'signal'
    });

    const slotLabel = isAutoSlot 
      ? (nextSlot.isNextDay ? `${taskDate} ${nextSlot.startTime}` : `${nextSlot.startTime}`)
      : 'Buffer';
    setLastAddedSlot(slotLabel);
    setTitle('');
    setIsSuccessFlash(true);
    setTimeout(() => setIsSuccessFlash(false), 1800);

    // If task crossed to the next day, automatically move the view to the new date!
    if (isAutoSlot && nextSlot.targetDate !== selectedDate) {
      onDateChange?.(nextSlot.targetDate);
    }

    // Keep focus on input for continuous multi-task entry
    inputRef.current?.focus();
  };

  const priorityMeta = prioritySettings[priority] || {
    label: priority,
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.15)'
  };

  return (
    <div className={`glass-panel p-2.5 sm:p-3 rounded-2xl border border-blue-400/40 dark:border-blue-700/50 shadow-md shadow-blue-500/5 bg-gradient-to-r from-blue-500/[0.04] via-theme-card to-indigo-500/[0.04] transition-all space-y-2 ${className}`}>
      
      {/* Top Strip: Next Free Slot Badge & Duration Customizer */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {scheduleMode === 'auto-slot' && nextSlot ? (
            <div 
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono font-bold text-[11px] shadow-2xs ${
                nextSlot.isNextDay
                  ? 'bg-purple-50/90 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800/80 text-purple-700 dark:text-purple-300'
                  : nextSlot.crossesMidnight
                  ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300'
                  : 'bg-blue-50/80 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300'
              }`}
              title={
                nextSlot.isNextDay 
                  ? `Day is full/exceeds bedtime. Automatically advances to ${nextSlot.targetDate}`
                  : nextSlot.crossesMidnight 
                  ? "This task starts tonight and spans past midnight into tomorrow"
                  : nextSlot.isAfterExistingTask 
                  ? "Sequentially placed after previous timed tasks" 
                  : "Starts at earliest daytime opening"
              }
            >
              <Clock className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              <span>
                {nextSlot.isNextDay ? `Next Slot (${nextSlot.targetDate}):` : 'Next Slot:'}
              </span>
              <span className="font-extrabold">{nextSlot.startTime} – {nextSlot.endTime}</span>
              <span className="text-[10px] opacity-75">({duration}m)</span>
              {nextSlot.isNextDay && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-200/70 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100 font-sans font-bold flex items-center gap-0.5">
                  <Calendar className="w-2.5 h-2.5" />
                  <span>Moves to Next Day</span>
                </span>
              )}
              {nextSlot.crossesMidnight && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-200/70 dark:bg-indigo-900/70 text-indigo-900 dark:text-indigo-100 font-sans font-bold flex items-center gap-0.5">
                  <span>🌙</span>
                  <span>Spans Midnight</span>
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[11px]">
              <Coffee className="w-3.5 h-3.5" />
              <span>Flexible Buffer Mode (No Fixed Time)</span>
            </div>
          )}

          {/* Duration Selector Pills */}
          <div className="flex items-center gap-1 bg-theme-card-hover/80 p-0.5 rounded-lg border border-theme-border/60">
            {COMMON_DURATIONS.map((dur) => (
              <button
                key={dur}
                type="button"
                onClick={() => setDuration(dur)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  duration === dur
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
                title={`Task duration: ${dur} minutes`}
              >
                {dur}m
              </button>
            ))}
          </div>
        </div>

        {/* Schedule Mode Switch (Next Slot vs Anytime) */}
        <button
          type="button"
          onClick={() => setScheduleMode(scheduleMode === 'auto-slot' ? 'anytime' : 'auto-slot')}
          className="text-[10px] font-bold text-theme-muted hover:text-theme-text transition-colors flex items-center gap-1 cursor-pointer"
          title="Toggle between Auto-scheduling after timed tasks or Anytime Buffer pool"
        >
          <span>Mode:</span>
          <span className="underline decoration-dotted text-blue-600 dark:text-blue-400">
            {scheduleMode === 'auto-slot' ? '⏰ Auto-Fit Timeline' : '⚡ No Time (Buffer)'}
          </span>
        </button>
      </div>

      {/* Main Input Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        
        {/* Fast Task Title Input */}
        <div className="flex-1 relative min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              scheduleMode === 'auto-slot' && nextSlot
                ? `⚡ Fast entry: Type title and press Enter (slots at ${nextSlot.startTime})...`
                : "⚡ Fast entry: Type task title and press Enter..."
            }
            className="w-full pl-3.5 pr-20 py-2 sm:py-2.5 rounded-xl border border-theme-border bg-theme-card text-theme-text placeholder-theme-muted text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-2xs"
          />

          {/* Quick Enter Hint */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 pointer-events-none text-[10px] font-mono font-bold text-theme-muted bg-theme-card-hover px-1.5 py-0.5 rounded border border-theme-border">
            <span>Enter</span>
            <span className="text-xs leading-none">↵</span>
          </div>
        </div>

        {/* Controls: Priority Pill + Add Button */}
        <div className="flex items-center gap-1.5 shrink-0 justify-between md:justify-end">
          
          {/* Priority Pill Selector */}
          <div className="flex items-center gap-0.5 p-0.5 bg-theme-card-hover rounded-xl border border-theme-border/80">
            {PRIORITIES.map((p) => {
              const isSelected = priority === p;
              const meta = prioritySettings[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePriorityChange(p)}
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-black transition-all cursor-pointer ${
                    isSelected
                      ? p === 'P1'
                        ? 'bg-gradient-to-tr from-red-600 to-amber-500 text-white shadow-xs scale-105'
                        : 'border shadow-2xs scale-105'
                      : 'text-theme-muted hover:text-theme-text opacity-70 hover:opacity-100'
                  }`}
                  style={
                    isSelected && p !== 'P1'
                      ? { backgroundColor: meta.bgColor, color: meta.color, borderColor: `${meta.color}60` }
                      : undefined
                  }
                  title={`Priority: ${p} (${meta.label})`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!title.trim()}
            className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm active:scale-95 ${
              isSuccessFlash
                ? 'bg-emerald-600 text-white shadow-emerald-500/30'
                : title.trim()
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25'
                : 'bg-theme-card-hover text-theme-muted opacity-50 cursor-not-allowed border border-theme-border'
            }`}
          >
            {isSuccessFlash ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Added ({lastAddedSlot})!</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Task</span>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
};
