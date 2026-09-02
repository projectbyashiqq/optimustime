import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Task, PriorityLevel, TaskStatus } from '../../types';
import { 
  getWeekDays, 
  toISODateString, 
  parse12HourToMinutes, 
  isTaskScheduledForDate,
  formatMinutesTo12Hour,
  WeekDayInfo,
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
  Lock,
  Moon
} from 'lucide-react';

interface WeeklyCalendarViewProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
}

export const WeeklyCalendarView: React.FC<WeeklyCalendarViewProps> = ({
  selectedDate,
  onSelectDate,
  onOpenTaskModal
}) => {
  const { 
    tasks, 
    capacitySettings, 
    prioritySettings,
    startTask, 
    pauseTask, 
    completeTask, 
    updateTask, 
    deleteTask,
    requestDeleteTask,
    dailyScheduledMinutes,
    isCapacityRedLineExceeded
  } = useApp();

  // Current anchor date for the week view
  const [currentBaseDate, setCurrentBaseDate] = useState<Date>(() => {
    const parts = selectedDate.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  });

  // Generate 7 days for the active week
  const weekDays: WeekDayInfo[] = useMemo(() => {
    return getWeekDays(currentBaseDate, true);
  }, [currentBaseDate]);

  // Navigate weeks
  const handlePrevWeek = () => {
    const d = new Date(currentBaseDate);
    d.setDate(d.getDate() - 7);
    setCurrentBaseDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentBaseDate);
    d.setDate(d.getDate() + 7);
    setCurrentBaseDate(d);
  };

  const handleThisWeek = () => {
    const d = new Date();
    setCurrentBaseDate(d);
    onSelectDate(toISODateString(d));
  };

  // Week range label e.g. "31 Aug 2026 – 06 Sep 2026"
  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) return '';
    const first = weekDays[0];
    const last = weekDays[6];
    const m1 = first.date.toLocaleString('default', { month: 'short' });
    const m2 = last.date.toLocaleString('default', { month: 'short' });
    return `${first.dayNumber} ${m1} ${first.date.getFullYear()} — ${last.dayNumber} ${m2} ${last.date.getFullYear()}`;
  }, [weekDays]);

  // Total weekly allocated time
  const totalWeeklyMinutes = useMemo(() => {
    return weekDays.reduce((acc, d) => acc + dailyScheduledMinutes(d.dateStr), 0);
  }, [weekDays, dailyScheduledMinutes]);

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* Weekly Header & Controls */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-theme-border">
        
        {/* Navigation & Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Calendar className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-theme-text">
                {weekRangeLabel}
              </h3>
            </div>
            <p className="text-xs text-theme-muted">
              Weekly Allocation: <span className="font-bold text-theme-text">{formatMinutes(totalWeeklyMinutes)}</span> across 7 days
            </p>
          </div>
        </div>

        {/* Week Switchers */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePrevWeek}
            className="p-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
            title="Previous Week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={handleThisWeek}
            className="px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-xs font-bold text-theme-text hover:bg-theme-border transition-colors"
          >
            Current Week
          </button>

          <button
            onClick={handleNextWeek}
            className="p-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
            title="Next Week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onOpenTaskModal(undefined, selectedDate)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all ml-2"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Add Task</span>
          </button>
        </div>

      </div>

      {/* 7-Column Weekly Grid Board */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day) => {
          const isSelected = day.dateStr === selectedDate;
          const dayMinutes = dailyScheduledMinutes(day.dateStr);
          const isRed = isCapacityRedLineExceeded(day.dateStr);

          // Get tasks for this day
          const dayTasksList = tasks
            .filter(t => isTaskScheduledForDate(t, day.dateStr) && t.status !== 'Terminated')
            .sort((a, b) => parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime));

          return (
            <div
              key={day.dateStr}
              onClick={() => onSelectDate(day.dateStr)}
              className={`rounded-2xl border flex flex-col transition-all min-h-[500px] cursor-pointer ${
                isSelected
                  ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                  : 'bg-theme-card border-theme-border hover:border-theme-border/80'
              }`}
            >
              
              {/* Day Column Header */}
              <div className={`p-3 rounded-t-2xl border-b transition-colors flex items-center justify-between ${
                day.isToday
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-theme-card-hover/60 border-theme-border text-theme-text'
              }`}>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase tracking-wider">
                      {day.shortDayName}
                    </span>
                    <span className={`text-xs font-black px-1.5 py-0.2 rounded-md ${
                      day.isToday ? 'bg-white text-blue-700' : 'text-theme-text'
                    }`}>
                      {day.dayNumber}
                    </span>
                  </div>

                  <div className="text-[10px] font-mono mt-0.5 opacity-85">
                    {formatMinutes(dayMinutes)} • {dayTasksList.length} tasks
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {isRed && (
                    <span className="p-1 bg-red-500 text-white rounded-md animate-pulse" title="Red-Line Exceeded (14h+)">
                      <Flame className="w-3 h-3" />
                    </span>
                  )}
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTaskModal(undefined, day.dateStr);
                    }}
                    className={`p-1 rounded-lg transition-colors ${
                      day.isToday ? 'hover:bg-white/20 text-white' : 'hover:bg-theme-border text-theme-muted hover:text-theme-text'
                    }`}
                    title={`Add task for ${day.dayName}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tasks List inside Day Column */}
              <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[65vh]">
                {dayTasksList.length === 0 ? (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTaskModal(undefined, day.dateStr);
                    }}
                    className="p-4 text-center rounded-xl border border-dashed border-theme-border/60 hover:bg-theme-card-hover/40 text-theme-muted transition-colors mt-2"
                  >
                    <p className="text-[11px]">Free Day</p>
                    <span className="text-[10px] text-blue-500 font-bold block mt-1">+ Schedule</span>
                  </div>
                ) : (
                  dayTasksList.map((task) => {
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
                        className={`p-2.5 rounded-xl border transition-all text-xs space-y-1.5 ${
                          isDone
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 opacity-80'
                            : isWorking
                            ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 shadow-sm ring-1 ring-blue-500/30'
                            : isInSleep
                            ? 'bg-slate-900/95 text-slate-100 dark:bg-slate-950 dark:text-slate-100 border-indigo-900/90 shadow-sm ring-1 ring-indigo-500/40'
                            : task.priority === 'P1'
                            ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
                            : task.priority === 'P2'
                            ? 'bg-orange-50/60 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40'
                            : 'bg-theme-card border-theme-border hover:border-blue-300'
                        }`}
                      >
                        {/* Header: Priority & Time */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded font-mono ${
                              task.priority === 'P1' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                              task.priority === 'P2' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                              'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            }`}>
                              {task.priority}
                            </span>
                            {task.isMandatorySchedule && (
                              <span title="Mandatory Fixed Schedule" className="inline-flex">
                                <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                              </span>
                            )}
                            {isInSleep && (
                              <span title="Scheduled on Sleep / Recovery Window" className="inline-flex">
                                <Moon className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] font-mono text-theme-muted font-semibold truncate">
                            {task.startTime}
                          </span>
                        </div>

                        {/* Title */}
                        <h5 className={`font-bold leading-snug line-clamp-2 ${
                          isDone ? 'line-through text-theme-muted' : 
                          isInSleep ? 'text-white font-black drop-shadow-sm' : 'text-theme-text'
                        }`}>
                          {task.title}
                        </h5>

                        {/* Card Controls & Duration */}
                        <div className="flex items-center justify-between pt-1 border-t border-theme-border/40 text-[10px] text-theme-muted">
                          <span>{task.appointedMinutes}m</span>

                          <div className="flex items-center gap-1">
                            {!isDone && (
                              isWorking ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); pauseTask(task.id); }}
                                  className="p-1 bg-amber-500 text-white rounded hover:bg-amber-600"
                                  title="Pause"
                                >
                                  <Pause className="w-2.5 h-2.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); startTask(task.id); }}
                                  className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                  title="Start"
                                >
                                  <Play className="w-2.5 h-2.5" />
                                </button>
                              )
                            )}

                            {!isDone ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); completeTask(task.id); }}
                                className="p-1 bg-theme-card-hover border border-theme-border rounded text-theme-muted hover:text-emerald-600"
                                title="Done"
                              >
                                <Check className="w-2.5 h-2.5" />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); updateTask({ ...task, status: 'Pending' }); }}
                                className="p-1 text-emerald-500"
                                title="Reopen"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                              </button>
                            )}

                            <button
                              onClick={(e) => { e.stopPropagation(); requestDeleteTask(task, day.dateStr); }}
                              className="p-1 bg-theme-card-hover border border-theme-border rounded text-theme-muted hover:text-rose-600"
                              title="Delete Task / Occurrence"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
