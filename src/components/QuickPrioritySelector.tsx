import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverHeight = popoverRef.current?.offsetHeight || 255;
    const popoverWidth = popoverRef.current?.offsetWidth || 256;

    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenUp = spaceBelow < popoverHeight + 10 && rect.top > popoverHeight + 10;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popoverWidth - 12);
    }
    if (left < 12) left = 12;

    let top = shouldOpenUp ? rect.top - popoverHeight - 6 : rect.bottom + 6;
    if (top < 12) top = 12;
    if (top + popoverHeight > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - popoverHeight - 12);
    }

    setCoords({ top, left });
  };

  // Close when clicking outside and update position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    const rafId = requestAnimationFrame(updatePosition);

    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
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
    <div className={`inline-block text-left ${className}`}>
      {/* Priority Trigger Button */}
      <button
        ref={triggerRef}
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

      {/* Floating Dropdown Popover (Mounted via Portal directly to body to bypass any parent overflow clipping) */}
      {isOpen && createPortal(
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 99999
          }}
          className="w-60 sm:w-64 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-1.5 space-y-1 animate-fade-in ring-1 ring-black/10"
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
        </div>,
        document.body
      )}
    </div>
  );
};
