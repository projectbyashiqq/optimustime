import React, { useState, useRef, useEffect } from 'react';
import { Task, PriorityLevel } from '../types';
import { useApp } from '../context/AppContext';
import { Sparkles, ChevronDown, Check } from 'lucide-react';

interface QuickPrioritySelectorProps {
  task: Task;
  className?: string;
  size?: 'sm' | 'md';
}

const PRIORITIES: { level: PriorityLevel; label: string; desc: string; color: string; bgColor: string }[] = [
  { level: 'P1', label: 'P1 Must-Do', desc: 'Critical, non-negotiable focus', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
  { level: 'P2', label: 'P2 High Value', desc: 'Important, high leverage', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.15)' },
  { level: 'P3', label: 'P3 Standard', desc: 'Normal planned work', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  { level: 'P4', label: 'P4 Maintenance', desc: 'Routine tasks & admin', color: '#64748B', bgColor: 'rgba(100, 116, 139, 0.15)' },
  { level: 'P5', label: 'P5 Flexible', desc: 'Low urgency, anytime/noise', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.15)' },
];

export const QuickPrioritySelector: React.FC<QuickPrioritySelectorProps> = ({
  task,
  className = '',
  size = 'md'
}) => {
  const { prioritySettings, updateTask } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const currentMeta = prioritySettings[task.priority] || {
    label: task.priority,
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.15)'
  };

  const handleSelectPriority = (e: React.MouseEvent, p: PriorityLevel) => {
    e.stopPropagation();
    if (task.priority !== p) {
      updateTask({ ...task, priority: p });
    }
    setIsOpen(false);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  const isSm = size === 'sm';

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Priority Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`group flex items-center justify-center gap-1 rounded-xl font-mono font-black transition-all cursor-pointer select-none active:scale-95 ${
          task.priority === 'P1'
            ? 'bg-gradient-to-tr from-rose-600 via-red-500 to-amber-400 text-white shadow-md shadow-red-500/25 ring-1 ring-red-400/80 border border-red-300 dark:border-red-400 hover:brightness-110'
            : 'border border-theme-border/70 hover:border-theme-border shadow-2xs hover:shadow-xs'
        } ${isSm ? 'px-2 py-0.5 text-xs min-w-[38px]' : 'px-2.5 py-1.5 text-xs sm:text-sm min-w-[48px]'}`}
        style={
          task.priority === 'P1'
            ? undefined
            : { backgroundColor: currentMeta.bgColor, color: currentMeta.color }
        }
        title={`Current: ${task.priority} (${currentMeta.label || ''}) • Click to change priority`}
      >
        {task.priority === 'P1' ? (
          <span className="flex items-center gap-0.5 tracking-tight font-black font-display">
            <Sparkles className="w-3 h-3 text-yellow-200 fill-yellow-200 shrink-0" />
            <span>P1</span>
          </span>
        ) : (
          <span className="font-bold tracking-tight">{task.priority}</span>
        )}
        <ChevronDown className={`w-3 h-3 opacity-60 group-hover:opacity-100 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Floating Dropdown Popover */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 mt-1.5 w-60 sm:w-64 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-2xl z-50 p-1.5 space-y-1 animate-fade-in ring-1 ring-black/5"
        >
          <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-theme-muted border-b border-theme-border/50 flex items-center justify-between">
            <span>Select Priority</span>
            <span className="text-[9px] font-normal lowercase">1-click apply</span>
          </div>

          <div className="space-y-0.5">
            {PRIORITIES.map((item) => {
              const isSelected = task.priority === item.level;
              const meta = prioritySettings[item.level] || item;

              return (
                <button
                  key={item.level}
                  type="button"
                  onClick={(e) => handleSelectPriority(e, item.level)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 font-bold'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="px-2 py-0.5 rounded-lg text-xs font-mono font-black shrink-0 border"
                      style={{
                        backgroundColor: meta.bgColor,
                        color: meta.color,
                        borderColor: `${meta.color}40`
                      }}
                    >
                      {item.level}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-theme-text group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                        {meta.label || item.label}
                      </div>
                      <div className="text-[10px] text-theme-muted truncate">
                        {item.desc}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ml-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
