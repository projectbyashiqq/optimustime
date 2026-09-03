import React, { useState, useMemo } from 'react';
import { Task, CapacitySettings } from '../types';
import { 
  findAllAvailableSlotsOnDate,
  findAvailableSlotOnDate,
  findNextAvailableSlot,
  SuggestedNextSlotResult,
  AvailableSlotResult, 
  toISODateString, 
  addMinutesToTime, 
  parse12HourToMinutes,
  getDayOfWeekFromDate,
  isTaskScheduledForDate,
  getTimePeriodForTime
} from '../utils/timeUtils';
import { useApp } from '../context/AppContext';
import { 
  Calendar, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  X, 
  Search, 
  Check, 
  Zap, 
  Layers, 
  AlertCircle,
  TrendingUp,
  RotateCcw,
  Sun,
  Moon,
  Sunrise,
  CalendarDays,
  ShieldCheck
} from 'lucide-react';

interface RescheduleModalProps {
  task: Task;
  allTasks: Task[];
  capacitySettings: CapacitySettings;
  onConfirmReschedule: (task: Task, newDate: string, newStartTime: string, newEndTime: string, scope?: 'single' | 'series') => void;
  onClose: () => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  task,
  allTasks,
  capacitySettings,
  onConfirmReschedule,
  onClose
}) => {
  const { timePeriodSettings } = useApp();
  const isRecurring = Boolean(task.recurrence && task.recurrence !== 'None');
  const [recurringScope, setRecurringScope] = useState<'single' | 'series'>('single');

  const todayStr = toISODateString(new Date());
  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toISODateString(d);
  })();

  // 1. Calculate the ideal conflict-free NEXT AVAILABLE slot (even if next day, avoiding sleep time)
  // Strictly avoid the task's existing slot so we never suggest the same time back to the user
  const suggestedNextSlot = useMemo(() => {
    return findNextAvailableSlot(
      task.appointedMinutes,
      allTasks,
      capacitySettings,
      task.id,
      undefined,
      false,
      15,
      { date: task.taskDate, startTime: task.startTime }
    );
  }, [task.appointedMinutes, allTasks, capacitySettings, task.id, task.taskDate, task.startTime]);

  const [anchorDate, setAnchorDate] = useState<string>(() => {
    if (suggestedNextSlot && suggestedNextSlot.date >= todayStr) {
      return suggestedNextSlot.date;
    }
    if (task.taskDate && task.taskDate >= todayStr) {
      return task.taskDate;
    }
    return todayStr;
  });
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlotResult | null>(null);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'ALL'>('ALL');
  const [customDate, setCustomDate] = useState<string>(() => {
    if (suggestedNextSlot && suggestedNextSlot.date >= todayStr) {
      return suggestedNextSlot.date;
    }
    if (task.taskDate && task.taskDate >= todayStr) {
      return task.taskDate;
    }
    return tomorrowStr;
  });
  const [viewMode, setViewMode] = useState<'week' | 'scanner' | 'custom'>('week');

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Helper to compute multiple conflict-free slots relative to anchorDate (0..7 days)
  const getSlotsForDayOffset = (days: number): { dayLabel: string; subLabel: string; dateStr: string; dayOfWeek: string; slots: AvailableSlotResult[] } => {
    const parts = anchorDate.split('-').map(Number);
    const target = new Date(parts[0], parts[1] - 1, parts[2] + days);
    const dateStr = toISODateString(target);
    const dayOfWeek = getDayOfWeekFromDate(dateStr);
    const isToday = (dateStr === todayStr);
    const isPast = (dateStr < todayStr);
    let earliestAllowed = isToday ? currentMinutes + 5 : undefined;

    // If an active task is running right now, no reschedule slot can start during its window
    if (isToday) {
      const activeWorkingTask = allTasks.find(t => 
        t.status === 'Working' && 
        isTaskScheduledForDate(t, todayStr) && 
        t.id !== task.id
      );
      if (activeWorkingTask) {
        const aStart = parse12HourToMinutes(activeWorkingTask.startTime);
        let aEnd = parse12HourToMinutes(activeWorkingTask.endTime);
        if (aEnd < aStart) aEnd += 1440;
        const aEndWithBuf = aEnd + (activeWorkingTask.bufferMinutes !== undefined ? activeWorkingTask.bufferMinutes : 15);
        earliestAllowed = Math.max(earliestAllowed ?? aEndWithBuf, aEndWithBuf);
      }
    }

    const slots = isPast ? [] : findAllAvailableSlotsOnDate(
      dateStr,
      task.appointedMinutes,
      allTasks,
      capacitySettings.dayStartTime,
      capacitySettings.dayEndTime,
      earliestAllowed,
      6, // Up to 6 distinct slots per day
      task.id,
      capacitySettings.sleepStartTime,
      capacitySettings.sleepEndTime,
      { date: task.taskDate, startTime: task.startTime }
    );

    let dayLabel = `+${days} Days`;
    let subLabel = `${dayOfWeek.slice(0, 3)}, ${dateStr}`;
    
    if (dateStr === task.taskDate && days === 0) {
      dayLabel = `Task Date (${dayOfWeek.slice(0, 3)})`;
      subLabel = `${dateStr} (Current)`;
    } else if (dateStr === todayStr) {
      dayLabel = 'Today';
      subLabel = `Remaining (${dayOfWeek.slice(0, 3)})`;
    } else if (dateStr === tomorrowStr) {
      dayLabel = 'Tomorrow';
      subLabel = `Full Day (${dayOfWeek.slice(0, 3)})`;
    } else if (days === 1) {
      dayLabel = `Next Day (+1d)`;
      subLabel = `${dayOfWeek.slice(0, 3)}, ${dateStr.slice(5)}`;
    } else if (days === 7) {
      dayLabel = `+1 Week (+7d)`;
      subLabel = `${dayOfWeek.slice(0, 3)}, ${dateStr.slice(5)}`;
    }

    return {
      dayLabel,
      subLabel,
      dateStr,
      dayOfWeek,
      slots
    };
  };

  // Compute Multiple Slots for Anchor Date + Next 7 Days (Days 0 to 7)
  const weekDaysData = useMemo(() => {
    const daysArr: ReturnType<typeof getSlotsForDayOffset>[] = [];
    for (let d = 0; d <= 7; d++) {
      const dayData = getSlotsForDayOffset(d);
      daysArr.push(dayData);
    }
    return daysArr;
  }, [anchorDate, task.appointedMinutes, allTasks, capacitySettings, task.id]);

  // 100-Day Smart Scanner: Scans the next 100 days to find earliest recommended conflict-free slots
  const scannedSlots = useMemo(() => {
    const results: AvailableSlotResult[] = [];
    for (let d = 0; d <= 100 && results.length < 8; d++) {
      const target = new Date();
      target.setDate(target.getDate() + d);
      const dateStr = toISODateString(target);
      const earliest = d === 0 ? currentMinutes + 5 : undefined;

      const slot = findAvailableSlotOnDate(
        dateStr,
        task.appointedMinutes,
        allTasks,
        capacitySettings.dayStartTime,
        capacitySettings.dayEndTime,
        earliest,
        task.id,
        capacitySettings.sleepStartTime,
        capacitySettings.sleepEndTime
      );
      if (slot) {
        results.push(slot);
      }
    }
    return results;
  }, [task.appointedMinutes, allTasks, capacitySettings, task.id, currentMinutes]);

  // Custom date slots calculation (multiple slots on custom chosen date)
  const customSlots = useMemo(() => {
    if (!customDate || customDate < todayStr) return [];
    const isToday = customDate === todayStr;
    const earliest = isToday ? currentMinutes + 5 : undefined;
    return findAllAvailableSlotsOnDate(
      customDate,
      task.appointedMinutes,
      allTasks,
      capacitySettings.dayStartTime,
      capacitySettings.dayEndTime,
      earliest,
      6,
      task.id,
      capacitySettings.sleepStartTime,
      capacitySettings.sleepEndTime,
      { date: task.taskDate, startTime: task.startTime }
    );
  }, [customDate, task.appointedMinutes, allTasks, capacitySettings, todayStr, currentMinutes, task.id]);

  // Auto-select the suggested optimal next slot by default
  React.useEffect(() => {
    if (suggestedNextSlot && !selectedSlot) {
      setSelectedSlot({
        date: suggestedNextSlot.date,
        dayOfWeek: suggestedNextSlot.dayOfWeek,
        startTime: suggestedNextSlot.startTime,
        endTime: suggestedNextSlot.endTime,
        scheduledMinutesOnDay: 0,
        remainingCapacityMinutes: 600,
        isRedLine: false,
        period: suggestedNextSlot.period
      });
      if (suggestedNextSlot.date > anchorDate) {
        setAnchorDate(suggestedNextSlot.date);
      }
    } else if (!selectedSlot || selectedSlot.date < todayStr) {
      for (const day of weekDaysData) {
        if (day.dateStr >= todayStr && day.slots.length > 0) {
          setSelectedSlot(day.slots[0]);
          break;
        }
      }
    }
  }, [suggestedNextSlot, weekDaysData, selectedSlot, todayStr]);

  const handleApplyReschedule = () => {
    if (!selectedSlot) return;
    onConfirmReschedule(task, selectedSlot.date, selectedSlot.startTime, selectedSlot.endTime, recurringScope);
    onClose();
  };

  const getPeriodIcon = (period?: string) => {
    if (period === 'Morning') return <Sunrise className="w-3 h-3 text-amber-500" />;
    if (period === 'Afternoon') return <Sun className="w-3 h-3 text-orange-500" />;
    return <Moon className="w-3 h-3 text-indigo-400" />;
  };

  const filteredDays = useMemo(() => {
    if (selectedDayFilter === 'ALL') return weekDaysData;
    return weekDaysData.filter((_, idx) => idx === selectedDayFilter);
  }, [weekDaysData, selectedDayFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-theme-card border border-theme-border rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-slide-up max-h-[94vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-theme-text font-display">
                  Reschedule • Multiple Available Time Slots
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {task.projectCode}
                </span>
              </div>
              <div className="text-xs text-theme-muted mt-1 flex items-center gap-2 flex-wrap">
                <span>Task: <strong className="text-theme-text">{task.title}</strong></span>
                {task.startTime && task.startTime !== 'All Day' && (
                  <span className="flex items-center gap-1">
                    <span>• Current:</span>
                    <strong className="font-mono text-theme-text">{task.startTime}</strong>
                    {(() => {
                      const period = getTimePeriodForTime(task.startTime, timePeriodSettings);
                      if (!period) return null;
                      return (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-0.5">
                          <span>{period.emoji}</span>
                          <span>{period.name}</span>
                        </span>
                      );
                    })()}
                  </span>
                )}
                <span>• Duration: <span className="font-bold text-blue-600 dark:text-blue-400">{task.appointedMinutes} mins</span></span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-theme-card-hover text-theme-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Recurring Task Scope Selector */}
        {isRecurring && (
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-purple-900 dark:text-purple-200 block">
                  Recurring Routine: {task.recurrence}
                </span>
                <span className="text-[11px] text-theme-muted">
                  Choose whether to move only this date or reschedule the whole recurring series.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 bg-theme-card p-1 rounded-xl border border-theme-border">
              <button
                type="button"
                onClick={() => setRecurringScope('single')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  recurringScope === 'single'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                Only This Day
              </button>
              <button
                type="button"
                onClick={() => setRecurringScope('series')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  recurringScope === 'series'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                Entire Series
              </button>
            </div>
          </div>
        )}

        {/* Suggested Next Available Time Slot Hero Card */}
        {suggestedNextSlot && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-blue-500/10 to-indigo-500/15 border-2 border-emerald-500/50 dark:border-emerald-500/40 shadow-lg shadow-emerald-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-600/30">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    Suggested Next Available Slot
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60">
                    {suggestedNextSlot.isNextDay ? (suggestedNextSlot.daysOffset === 1 ? '🌅 Next Day (+1d)' : `📅 In ${suggestedNextSlot.daysOffset} Days`) : '⚡ Today'}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-indigo-500" />
                    Sleep Time Protected ({capacitySettings.sleepStartTime || '11:00 PM'} - {capacitySettings.sleepEndTime || '06:00 AM'})
                  </span>
                </div>
                <div className="text-sm sm:text-base font-black font-display text-theme-text mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{suggestedNextSlot.date} ({suggestedNextSlot.dayOfWeek})</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">
                    • {suggestedNextSlot.startTime} - {suggestedNextSlot.endTime}
                  </span>
                  {(() => {
                    const period = getTimePeriodForTime(suggestedNextSlot.startTime, timePeriodSettings);
                    if (!period) return null;
                    return (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700 flex items-center gap-1 shadow-2xs">
                        <span>{period.emoji}</span>
                        <span>{period.name}</span>
                      </span>
                    );
                  })()}
                  <span className="text-xs font-normal text-theme-muted">
                    ({suggestedNextSlot.durationMinutes} mins)
                  </span>
                </div>
                <p className="text-[11px] text-theme-muted mt-0.5">
                  {suggestedNextSlot.reason}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onConfirmReschedule(task, suggestedNextSlot.date, suggestedNextSlot.startTime, suggestedNextSlot.endTime, recurringScope);
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Confirm This Slot</span>
            </button>
          </div>
        )}

        {/* Anchor Date Quick Switcher Bar */}
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-theme-card-hover border border-theme-border flex-wrap gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="font-bold text-theme-text">Target Base Date:</span>
            <input 
              type="date"
              min={todayStr}
              value={anchorDate}
              onChange={(e) => {
                if (e.target.value) {
                  const val = e.target.value < todayStr ? todayStr : e.target.value;
                  setAnchorDate(val);
                  setSelectedSlot(null);
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-theme-card border border-theme-border text-theme-text font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {task.taskDate && task.taskDate >= todayStr && (
              <button
                type="button"
                onClick={() => {
                  setAnchorDate(task.taskDate);
                  setSelectedSlot(null);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  anchorDate === task.taskDate
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-theme-card text-theme-muted hover:text-theme-text border-theme-border'
                }`}
              >
                Task Date ({task.taskDate})
              </button>
            )}

            {task.taskDate && task.taskDate < todayStr && (
              <span className="px-2.5 py-1 rounded-lg font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 text-[11px] flex items-center gap-1">
                ⚠️ Past Task ({task.taskDate}) → Moving to Future
              </span>
            )}
            
            <button
              type="button"
              onClick={() => {
                setAnchorDate(todayStr);
                setSelectedSlot(null);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all border ${
                anchorDate === todayStr
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-theme-card text-theme-muted hover:text-theme-text border-theme-border'
              }`}
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => {
                setAnchorDate(tomorrowStr);
                setSelectedSlot(null);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all border ${
                anchorDate === tomorrowStr
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-theme-card text-theme-muted hover:text-theme-text border-theme-border'
              }`}
            >
              Tomorrow
            </button>
          </div>
        </div>

        {/* Navigation Mode Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-theme-card-hover rounded-xl border border-theme-border text-xs font-bold shrink-0">
          <button
            onClick={() => setViewMode('week')}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'week' 
                ? 'bg-theme-card text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>7-Day Schedule Matrix (from {anchorDate})</span>
          </button>
          <button
            onClick={() => setViewMode('scanner')}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'scanner' 
                ? 'bg-theme-card text-purple-600 dark:text-purple-400 shadow-sm' 
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>100-Day Smart Scanner</span>
          </button>
          <button
            onClick={() => setViewMode('custom')}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'custom' 
                ? 'bg-theme-card text-emerald-600 dark:text-emerald-400 shadow-sm' 
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Custom Date Finder</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          
          {/* TAB 1: TOMORROW & NEXT 7 DAYS MULTIPLE TIME SLOTS */}
          {viewMode === 'week' && (
            <div className="space-y-3">
              
              {/* Day Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold no-scrollbar">
                <button
                  onClick={() => setSelectedDayFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl shrink-0 transition-all border ${
                    selectedDayFilter === 'ALL'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-theme-card text-theme-muted border-theme-border hover:text-theme-text'
                  }`}
                >
                  All Days ({weekDaysData.length})
                </button>
                {weekDaysData.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDayFilter(i)}
                    className={`px-3 py-1.5 rounded-xl shrink-0 transition-all border flex items-center gap-1.5 ${
                      selectedDayFilter === i
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-theme-card text-theme-muted border-theme-border hover:text-theme-text'
                    }`}
                  >
                    <span>{d.dayLabel}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedDayFilter === i ? 'bg-white/20 text-white' : 'bg-theme-card-hover text-theme-muted'
                    }`}>
                      {d.slots.length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Day Groups List */}
              <div className="space-y-3">
                {filteredDays.map((dayGroup, groupIdx) => {
                  const hasSlots = dayGroup.slots.length > 0;
                  const isTomorrow = dayGroup.dayLabel === 'Tomorrow';

                  return (
                    <div 
                      key={groupIdx}
                      className={`p-4 rounded-2xl border transition-all ${
                        isTomorrow 
                          ? 'bg-gradient-to-r from-blue-50/40 via-theme-card to-theme-card dark:from-blue-950/20 border-blue-300/80 dark:border-blue-800/80' 
                          : 'bg-theme-card border-theme-border'
                      }`}
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between gap-2 border-b border-theme-border/60 pb-2.5 mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isTomorrow 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'bg-theme-card-hover text-theme-text'
                          }`}>
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-theme-text font-display">
                                {dayGroup.dayLabel}
                              </span>
                              <span className="text-xs text-theme-muted font-mono font-medium">
                                ({dayGroup.dayOfWeek}, {dayGroup.dateStr})
                              </span>
                              {isTomorrow && (
                                <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                  Recommended
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          hasSlots 
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                        }`}>
                          {hasSlots 
                            ? `${dayGroup.slots.length} Slots Available` 
                            : dayGroup.dateStr === todayStr 
                              ? 'No time left today' 
                              : dayGroup.dateStr < todayStr 
                                ? 'Past Date' 
                                : 'Fully Booked'}
                        </span>
                      </div>

                      {/* Multiple Time Slots Grid */}
                      {hasSlots ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {dayGroup.slots.map((slot, sIdx) => {
                            const isSelected = selectedSlot?.date === slot.date && selectedSlot?.startTime === slot.startTime;
                            const isSuggested = suggestedNextSlot?.date === slot.date && suggestedNextSlot?.startTime === slot.startTime;

                            return (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => setSelectedSlot(slot)}
                                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-2 cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-50/90 dark:bg-blue-950/80 border-blue-500 shadow-md ring-2 ring-blue-500/40'
                                    : isSuggested
                                      ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-400/80 hover:border-emerald-500'
                                      : 'bg-theme-card-hover/70 hover:bg-theme-card-hover border-theme-border hover:border-blue-400 dark:hover:border-blue-600'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1.5 w-full">
                                  <div className="flex items-center gap-1.5">
                                    {getPeriodIcon(slot.period)}
                                    <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                                      {slot.period}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {isSuggested && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-0.5">
                                        <Zap className="w-2.5 h-2.5 fill-current" />
                                        RECOMMENDED NEXT
                                      </span>
                                    )}

                                    {isSelected ? (
                                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 stroke-[3]" />
                                      </div>
                                    ) : (
                                      <span className="text-[10px] font-mono text-theme-muted font-semibold">
                                        Slot #{sIdx + 1}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-1 mt-0.5 flex-wrap">
                                  <div className="text-xs font-black font-mono text-theme-text flex items-center gap-1">
                                    <span>{slot.startTime}</span>
                                    <ArrowRight className="w-3 h-3 text-theme-muted" />
                                    <span>{slot.endTime}</span>
                                  </div>
                                  {(() => {
                                    const period = getTimePeriodForTime(slot.startTime, timePeriodSettings);
                                    if (!period) return null;
                                    return (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0 flex items-center gap-0.5">
                                        <span>{period.emoji}</span>
                                        <span>{period.name}</span>
                                      </span>
                                    );
                                  })()}
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-theme-muted font-medium pt-1 border-t border-theme-border/40">
                                  <span>{task.appointedMinutes}m block</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">No Sleep Overlap ✓</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 text-center text-xs text-theme-muted rounded-xl bg-theme-card-hover/40 border border-dashed border-theme-border">
                          No open gaps large enough for {task.appointedMinutes} minutes between waking hours ({capacitySettings.dayStartTime} - {capacitySettings.dayEndTime}).
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* TAB 2: 100-DAY SMART SCANNER */}
          {viewMode === 'scanner' && (
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-theme-muted flex items-center gap-1.5 pb-1">
                <Search className="w-3.5 h-3.5 text-purple-500" />
                <span>Earliest recommended conflict-free windows across the next 100 days (Strictly waking hours):</span>
              </div>

              <div className="space-y-2">
                {scannedSlots.map((slot, idx) => {
                  const isSelected = selectedSlot?.date === slot.date && selectedSlot?.startTime === slot.startTime;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-purple-50/90 dark:bg-purple-950/60 border-purple-500 shadow-md ring-2 ring-purple-500/30'
                          : 'bg-theme-card border-theme-border hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600 font-bold text-xs font-mono">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-theme-text font-display flex items-center gap-1.5">
                            <span>{slot.date}</span>
                            <span className="text-theme-muted font-normal">({slot.dayOfWeek})</span>
                          </div>
                          <div className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 flex-wrap">
                            <span>{slot.startTime} - {slot.endTime} ({task.appointedMinutes}m)</span>
                            {(() => {
                              const period = getTimePeriodForTime(slot.startTime, timePeriodSettings);
                              if (!period) return null;
                              return (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-0.5">
                                  <span>{period.emoji}</span>
                                  <span>{period.name}</span>
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <div className="text-[10px] text-theme-muted font-medium">Scheduled Load:</div>
                          <div className="text-xs font-mono font-bold text-theme-text">
                            {Math.floor(slot.scheduledMinutesOnDay / 60)}h {slot.scheduledMinutesOnDay % 60}m
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                          isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-theme-border'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM DATE FINDER */}
          {viewMode === 'custom' && (
            <div className="space-y-4 p-4 rounded-2xl bg-theme-card-hover/40 border border-theme-border">
              <div className="space-y-2">
                <label className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Choose Target Date to Scan Multiple Slots:</span>
                </label>
                <input
                  type="date"
                  value={customDate}
                  min={toISODateString(new Date())}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-theme-border bg-theme-card text-theme-text text-sm font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Custom Slots List */}
              {customSlots.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-theme-text block">
                    Found {customSlots.length} Available Slots on {customDate}:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {customSlots.map((slot, cIdx) => {
                      const isSelected = selectedSlot?.date === slot.date && selectedSlot?.startTime === slot.startTime;
                      return (
                        <div
                          key={cIdx}
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                              : 'bg-theme-card border-theme-border hover:border-emerald-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {getPeriodIcon(slot.period)}
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                                {slot.period} Slot
                              </span>
                            </div>
                            {isSelected && (
                              <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5 flex-wrap">
                            <div className="text-xs font-mono font-bold text-theme-text">
                              {slot.startTime} - {slot.endTime}
                            </div>
                            {(() => {
                              const period = getTimePeriodForTime(slot.startTime, timePeriodSettings);
                              if (!period) return null;
                              return (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0 flex items-center gap-0.5">
                                  <span>{period.emoji}</span>
                                  <span>{period.name}</span>
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-300 dark:border-red-800 text-center space-y-1">
                  <div className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>No available time slots found on selected date.</span>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    This day is full during waking hours ({capacitySettings.dayStartTime} - {capacitySettings.dayEndTime}).
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Selected Slot Summary & Action Footer */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div>
            <div className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
              Selected Target Reschedule Slot:
            </div>
            {selectedSlot ? (
              <div className="text-sm font-black text-theme-text font-display flex items-center gap-2 flex-wrap">
                <span>{selectedSlot.date} ({selectedSlot.dayOfWeek.slice(0, 3)})</span>
                <span className="text-blue-600 dark:text-blue-400 font-mono font-black">
                  • {selectedSlot.startTime} - {selectedSlot.endTime}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  {selectedSlot.period || 'Wake Slot'} ✓
                </span>
              </div>
            ) : (
              <div className="text-xs text-red-500 font-semibold">
                Please select an available time slot above
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-theme-border bg-theme-card hover:bg-theme-card-hover text-xs font-bold text-theme-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedSlot}
              onClick={handleApplyReschedule}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black shadow-lg shadow-blue-500/25 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Confirm Reschedule</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
