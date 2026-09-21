import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { PriorityLevel } from '../types';
import { 
  getDayOfWeekFromDate 
} from '../utils/timeUtils';
import { Plus, Check } from 'lucide-react';

interface QuickTaskEntryBarProps {
  selectedDate: string;
  onDateChange?: (date: string) => void;
  className?: string;
}

const PRIORITIES: PriorityLevel[] = ['P1', 'P2', 'P3', 'P4', 'P5'];

export const QuickTaskEntryBar: React.FC<QuickTaskEntryBarProps> = ({
  selectedDate,
  className = ''
}) => {
  const { addTask, categories, prioritySettings } = useApp();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('P3');
  const [category, setCategory] = useState<string>(categories[0]?.name || 'VRTX');
  const [isSuccessFlash, setIsSuccessFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      inputRef.current?.focus();
      return;
    }

    // Fast-add task without time or complex rituals
    addTask({
      title: title.trim(),
      description: '',
      taskDate: selectedDate,
      dayOfWeek: getDayOfWeekFromDate(selectedDate),
      priority,
      category,
      startTime: 'Anytime',
      endTime: 'Anytime',
      hasNoTime: true,
      appointedMinutes: 0,
      bufferMinutes: 0,
      status: 'Pending',
      recurrence: 'None',
      subtasks: [],
      links: [],
      signalNoise: priority === 'P5' ? 'noise' : 'signal'
    });

    setTitle('');
    setIsSuccessFlash(true);
    setTimeout(() => setIsSuccessFlash(false), 1500);

    // Keep focus on input for instant multi-task entry
    inputRef.current?.focus();
  };

  const priorityMeta = prioritySettings[priority] || {
    label: priority,
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.15)'
  };

  return (
    <div className={`glass-panel p-2 sm:p-2.5 rounded-2xl border border-blue-400/40 dark:border-blue-700/50 shadow-md shadow-blue-500/5 bg-gradient-to-r from-blue-500/[0.04] via-theme-card to-indigo-500/[0.04] transition-all ${className}`}>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Fast Task Title Input */}
        <div className="flex-1 relative min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="⚡ Fast entry: Type task title and press Enter (No time needed)..."
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
                  onClick={() => setPriority(p)}
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
                  title={`Default Priority: ${p} (${meta.label})`}
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
                <span>Added!</span>
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
