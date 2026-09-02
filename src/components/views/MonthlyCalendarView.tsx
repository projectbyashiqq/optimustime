import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Task, PriorityLevel, TaskStatus } from '../../types';
import { 
  getMonthDays, 
  formatMonthYear, 
  toISODateString, 
  parse12HourToMinutes, 
  isTaskScheduledForDate,
  MonthDayInfo,
  isTaskInSleepWindow
} from '../../utils/timeUtils';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Clock, 
  Plus, 
  Play, 
  Pause, 
  CheckCircle2, 
  Check, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  Flame,
  Layers,
  Sparkles,
  ArrowRight,
  Lock,
  Moon
} from 'lucide-react';

interface MonthlyCalendarViewProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
}

export const MonthlyCalendarView: React.FC<MonthlyCalendarViewProps> = ({
  selectedDate,
  onSelectDate,
  onOpenTaskModal
}) => {
  const { 
    tasks, 
    capacitySettings, 
    prioritySettings,
    dailyScheduledMinutes,
    isCapacityRedLineExceeded
  } = useApp();

  // Current year & month for view
  const [currentYear, setCurrentYear] = useState<number>(() => {
    const parts = selectedDate.split('-').map(Number);
    return parts[0] || new Date().getFullYear();
  });

  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(() => {
    const parts = selectedDate.split('-').map(Number);
    return parts[1] ? parts[1] - 1 : new Date().getMonth();
  });

  // Generate matrix of days for this month
  const monthDays: MonthDayInfo[] = useMemo(() => {
    return getMonthDays(currentYear, currentMonthIndex);
  }, [currentYear, currentMonthIndex]);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonthIndex(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonthIndex(prev => prev + 1);
    }
  };

  const handleThisMonth = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonthIndex(now.getMonth());
    onSelectDate(toISODateString(now));
  };

  // Month header text e.g. "September 2026"
  const monthTitle = useMemo(() => {
    return formatMonthYear(currentYear, currentMonthIndex);
  }, [currentYear, currentMonthIndex]);

  // Monthly stats
  const monthlyStats = useMemo(() => {
    const activeMonthDays = monthDays.filter(d => d.isCurrentMonth);
    const totalMinutes = activeMonthDays.reduce((acc, d) => acc + dailyScheduledMinutes(d.dateStr), 0);
    const daysWithTasks = activeMonthDays.filter(d => dailyScheduledMinutes(d.dateStr) > 0).length;
    const redLineDays = activeMonthDays.filter(d => isCapacityRedLineExceeded(d.dateStr)).length;

    return {
      totalHours: (totalMinutes / 60).toFixed(1),
      daysWithTasks,
      redLineDays
    };
  }, [monthDays, dailyScheduledMinutes, isCapacityRedLineExceeded]);

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* Month Header & Controls */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-theme-border">
        
        {/* Navigation & Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Calendar className="w-5 h-5" />
          </div>

          <div>
            <h3 className="text-base font-black text-theme-text">
              {monthTitle}
            </h3>
            <p className="text-xs text-theme-muted">
              {monthlyStats.totalHours}h allocated across {monthlyStats.daysWithTasks} active days
              {monthlyStats.redLineDays > 0 && (
                <span className="text-rose-500 font-bold ml-1.5">• {monthlyStats.redLineDays} Red-Line days</span>
              )}
            </p>
          </div>
        </div>

        {/* Switcher buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={handleThisMonth}
            className="px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-xs font-bold text-theme-text hover:bg-theme-border transition-colors"
          >
            Current Month
          </button>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onOpenTaskModal(undefined, selectedDate)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all ml-2"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Schedule Task</span>
          </button>
        </div>

      </div>

      {/* Monthly Grid Board */}
      <div className="glass-panel p-3 sm:p-4 rounded-3xl border border-theme-border shadow-sm space-y-2">
        
        {/* Weekday Row Header */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center pb-2 border-b border-theme-border/60">
          {weekdays.map((dayName) => (
            <div key={dayName} className="text-xs font-black text-theme-muted uppercase tracking-wider py-1">
              {dayName}
            </div>
          ))}
        </div>

        {/* 35/42-Day Matrix */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {monthDays.map((day) => {
            const isSelected = day.dateStr === selectedDate;
            const dayMinutes = dailyScheduledMinutes(day.dateStr);
            const isRed = isCapacityRedLineExceeded(day.dateStr);

            // Tasks scheduled for this date
            const dayTasksList = tasks
              .filter(t => isTaskScheduledForDate(t, day.dateStr) && t.status !== 'Terminated')
              .sort((a, b) => parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime));

            return (
              <div
                key={day.dateStr}
                onClick={() => onSelectDate(day.dateStr)}
                className={`min-h-[100px] sm:min-h-[120px] p-2 rounded-2xl border flex flex-col justify-between transition-all cursor-pointer relative group ${
                  !day.isCurrentMonth
                    ? 'opacity-40 bg-theme-card-hover/20 border-theme-border/30'
                    : isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                    : 'bg-theme-card border-theme-border hover:bg-theme-card-hover/80 hover:border-theme-border'
                }`}
              >
                {/* Top: Day Number & Allocated Time Badge */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                    day.isToday
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isSelected
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-theme-text'
                  }`}>
                    {day.dayNumber}
                  </span>

                  <div className="flex items-center gap-1">
                    {isRed && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Capacity Red-Line Exceeded (14h+)" />
                    )}

                    {dayMinutes > 0 && (
                      <span className="text-[10px] font-mono font-bold text-theme-muted">
                        {Math.floor(dayMinutes / 60)}h{dayMinutes % 60 > 0 ? ` ${dayMinutes % 60}m` : ''}
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTaskModal(undefined, day.dateStr);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-blue-600 hover:text-white text-theme-muted transition-all"
                      title={`Add task on ${day.dateStr}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Middle: Task Pills List */}
                <div className="space-y-1 my-1 overflow-hidden">
                  {dayTasksList.slice(0, 3).map((task) => {
                    const isDone = task.status === 'Done';
                    const isWorking = task.status === 'Working';
                    const isInSleep = isTaskInSleepWindow(task, capacitySettings);

                    return (
                      <div
                        key={task.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTaskModal(task);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded-md truncate font-medium flex items-center gap-1 border transition-all ${
                          isDone
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 line-through opacity-70'
                            : isWorking
                            ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-400 font-bold animate-pulse'
                            : isInSleep
                            ? 'bg-slate-900/95 text-slate-100 dark:bg-slate-950 dark:text-slate-100 border-indigo-900/90 shadow-2xs'
                            : task.priority === 'P1'
                            ? 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                            : task.priority === 'P2'
                            ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20'
                            : 'bg-theme-card-hover text-theme-text border-theme-border'
                        }`}
                        title={`${task.startTime} - ${task.title}${isInSleep ? ' (Sleep Window)' : ''}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isInSleep ? 'bg-indigo-400' :
                          task.priority === 'P1' ? 'bg-red-500' :
                          task.priority === 'P2' ? 'bg-orange-500' : 'bg-blue-500'
                        }`} />
                        {task.isMandatorySchedule && (
                          <span title="Mandatory Schedule" className="inline-flex">
                            <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                          </span>
                        )}
                        {isInSleep && (
                          <span title="Sleep Window" className="inline-flex">
                            <Moon className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                          </span>
                        )}
                        <span className={`truncate ${isInSleep ? 'text-white font-bold' : ''}`}>{task.title}</span>
                      </div>
                    );
                  })}

                  {dayTasksList.length > 3 && (
                    <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 block text-right">
                      +{dayTasksList.length - 3} more
                    </span>
                  )}
                </div>

                {/* Bottom: Sub-indicator dot count */}
                <div className="flex items-center justify-end gap-1 text-[9px] text-theme-muted font-mono">
                  {dayTasksList.length > 0 && (
                    <span>{dayTasksList.filter(t => t.status === 'Done').length}/{dayTasksList.length} done</span>
                  )}
                </div>

              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
