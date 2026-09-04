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
  getTimePeriodForTime,
  formatDisplayDate
} from '../utils/timeUtils';
import { useApp } from '../context/AppContext';
import { 
  Calendar, 
  Clock, 
  Sparkles, 
  ArrowRight,
  ArrowLeft,
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

  // 1. Calculate the ideal conflict-free NEXT AVAILABLE slot (Today if available, or rolls over to Tomorrow)
  // Strictly avoids the task's identical unchanged slot and active working tasks
  const suggestedNextSlot = useMemo(() => {
    return findNextAvailableSlot(
      task.appointedMinutes,
      allTasks,
      capacitySettings,
      task.id,
      undefined, // Start from Today!
      false,
      15,
      { 
        date: task.taskDate, 
        startTime: task.startTime, 
        endTime: task.endTime,
        id: task.id,
        simultaneousWithIds: task.simultaneousWithIds
      }
    );
  }, [task.appointedMinutes, allTasks, capacitySettings, task.id, task.taskDate, task.startTime, task.endTime, task.simultaneousWithIds]);

  const [anchorDate, setAnchorDate] = useState<string>(() => {
    if (task.taskDate && task.taskDate >= todayStr) {
      return task.taskDate;
    }
    if (suggestedNextSlot && suggestedNextSlot.date >= todayStr) {
      return suggestedNextSlot.date;
    }
    return todayStr;
  });
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlotResult | null>(null);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'ALL'>('ALL');
  const [customDate, setCustomDate] = useState<string>(() => {
    if (task.taskDate && task.taskDate >= todayStr) {
      return task.taskDate;
    }
    if (suggestedNextSlot && suggestedNextSlot.date >= todayStr) {
      return suggestedNextSlot.date;
    }
    return todayStr;
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

    // If an active task is running right now on Today, no reschedule slot can start during its window
    if (isToday) {
      const activeWorkingTask = allTasks.find(t => 
        t.status === 'Working' && 
        isTaskScheduledForDate(t, todayStr)
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
      12, // Up to 12 distinct slots per day to support 3-5 before and 3-5 after
      task.id,
      capacitySettings.sleepStartTime,
      capacitySettings.sleepEndTime,
      { 
        date: task.taskDate, 
        startTime: task.startTime, 
        endTime: task.endTime,
        id: task.id,
        simultaneousWithIds: task.simultaneousWithIds
      }
    );

    let dayLabel = `+${days} Days`;
    let subLabel = `${dayOfWeek.slice(0, 3)}, ${formatDisplayDate(dateStr)}`;
    
    if (dateStr === task.taskDate && days === 0) {
      dayLabel = dateStr === todayStr ? 'Today (Current)' : `Task Date (${dayOfWeek.slice(0, 3)})`;
      subLabel = `${formatDisplayDate(dateStr)} (Current)`;
    } else if (dateStr === todayStr) {
      dayLabel = 'Today';
      subLabel = `Remaining (${dayOfWeek.slice(0, 3)})`;
    } else if (dateStr === tomorrowStr) {
      dayLabel = 'Tomorrow';
      subLabel = `Full Day (${dayOfWeek.slice(0, 3)})`;
    } else if (days === 1) {
      dayLabel = `Next Day (+1d)`;
      subLabel = `${dayOfWeek.slice(0, 3)}, ${formatDisplayDate(dateStr)}`;
    } else if (days === 7) {
      dayLabel = `+1 Week (+7d)`;
      subLabel = `${dayOfWeek.slice(0, 3)}, ${formatDisplayDate(dateStr)}`;
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
      { 
        date: task.taskDate, 
        startTime: task.startTime, 
        endTime: task.endTime,
        id: task.id,
        simultaneousWithIds: task.simultaneousWithIds
      }
    );
  }, [customDate, task.appointedMinutes, allTasks, capacitySettings, todayStr, currentMinutes, task.id, task.taskDate, task.startTime, task.endTime, task.simultaneousWithIds]);

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
    if (selectedSlot.date < todayStr) {
      alert('Reschedule cannot move into past dates.');
      return;
    }
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

  // Find all available slots on the actively selected anchorDate
  const activeDateSlots = useMemo(() => {
    const dayData = weekDaysData.find(d => d.dateStr === anchorDate);
    return dayData ? dayData.slots : [];
  }, [weekDaysData, anchorDate]);

  const wakingStartMin = useMemo(() => {
    return parse12HourToMinutes(capacitySettings?.sleepEndTime || capacitySettings?.dayStartTime || '06:00 AM');
  }, [capacitySettings]);

  // Helper to compute circadian minutes relative to day start (so 12:00 AM midnight is 1440, not 0)
  const getCircadianMinutes = (timeStr: string) => {
    const raw = parse12HourToMinutes(timeStr);
    return raw < wakingStartMin ? raw + 1440 : raw;
  };

  const taskCircadianStartMin = useMemo(() => {
    return task.startTime && task.startTime !== 'All Day' ? getCircadianMinutes(task.startTime) : null;
  }, [task.startTime, wakingStartMin]);

  // Partition available slots into 3-5 Before (Blue) and 3-5 After (Green) relative to Current Task Time
  const { beforeSlots, afterSlots } = useMemo(() => {
    if (taskCircadianStartMin === null || activeDateSlots.length === 0) {
      return { beforeSlots: [], afterSlots: activeDateSlots.slice(0, 5) };
    }
    const before = activeDateSlots
      .filter(s => getCircadianMinutes(s.startTime) < taskCircadianStartMin)
      .slice(-5); // Take the 3 to 5 slots closest before current time
    const after = activeDateSlots
      .filter(s => getCircadianMinutes(s.startTime) > taskCircadianStartMin)
      .slice(0, 5); // Take the 3 to 5 slots closest after current time
    return { beforeSlots: before, afterSlots: after };
  }, [activeDateSlots, taskCircadianStartMin, wakingStartMin]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-md animate-fade-in">
      <div className="bg-theme-card border border-theme-border rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-[0_25px_70px_rgba(0,0,0,0.25)] space-y-3.5 animate-slide-up max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-theme-text font-display tracking-tight">
                  Reschedule • Available Time Slots
                </h3>
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-theme-card-hover text-theme-muted border border-theme-border">
                  {task.projectCode}
                </span>
              </div>
              <div className="text-xs text-theme-muted mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Task: <strong className="text-theme-text font-semibold">{task.title}</strong></span>
                {task.startTime && task.startTime !== 'All Day' && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-theme-muted/40">•</span>
                    <span>Current:</span>
                    <strong className="font-mono text-theme-text">{task.startTime}</strong>
                    {(() => {
                      const period = getTimePeriodForTime(task.startTime, timePeriodSettings);
                      if (!period) return null;
                      return (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-theme-card-hover text-theme-text border border-theme-border flex items-center gap-1">
                          <span>{period.emoji}</span>
                          <span>{period.name}</span>
                        </span>
                      );
                    })()}
                  </span>
                )}
                <span className="text-theme-muted/40">•</span>
                <span>Duration: <span className="font-semibold text-blue-600 dark:text-blue-400">{task.appointedMinutes} mins</span></span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recurring Task Scope Selector */}
        {isRecurring && (
          <div className="p-3 bg-purple-500/[0.06] dark:bg-purple-400/[0.08] border border-purple-500/20 dark:border-purple-400/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 block">
                  Recurring Routine: {task.recurrence}
                </span>
                <span className="text-[11px] text-theme-muted">
                  Choose whether to move only this date or reschedule the whole recurring series.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 bg-theme-card p-1 rounded-xl border border-theme-border">
              <button
                type="button"
                onClick={() => setRecurringScope('single')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  recurringScope === 'single'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                Only This Day
              </button>
              <button
                type="button"
                onClick={() => setRecurringScope('series')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  recurringScope === 'series'
                    ? 'bg-purple-600 text-white shadow-xs'
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
          <div className="relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-gradient-to-r from-emerald-500/[0.08] via-teal-500/[0.04] to-emerald-500/[0.02] dark:from-emerald-400/[0.12] dark:via-teal-400/[0.06] dark:to-emerald-400/[0.03] border border-emerald-500/25 dark:border-emerald-400/25 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 dark:bg-emerald-400/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 dark:border-emerald-400/20">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    Suggested Next Available Slot
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                    {suggestedNextSlot.isNextDay ? (suggestedNextSlot.daysOffset === 1 ? '🌅 Next Day (+1d)' : `📅 In ${suggestedNextSlot.daysOffset} Days`) : '⚡ Today'}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-indigo-500" />
                    Sleep Time Protected ({capacitySettings.sleepStartTime || '11:00 PM'} - {capacitySettings.sleepEndTime || '06:00 AM'})
                  </span>
                </div>
                <div className="text-sm sm:text-base font-bold font-display text-theme-text mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{suggestedNextSlot.date} ({suggestedNextSlot.dayOfWeek})</span>
                  <span className="text-emerald-600 dark:text-emerald-300 font-mono font-bold tracking-tight">
                    • {suggestedNextSlot.startTime} – {suggestedNextSlot.endTime}
                  </span>
                  {(() => {
                    const period = getTimePeriodForTime(suggestedNextSlot.startTime, timePeriodSettings);
                    if (!period) return null;
                    return (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border border-indigo-500/20 flex items-center gap-1">
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
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-semibold shadow-sm shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Confirm This Slot</span>
            </button>
          </div>
        )}

        {/* Anchor Date Quick Switcher Bar */}
        <div className="flex items-center justify-between p-2 rounded-2xl bg-theme-card-hover border border-theme-border flex-wrap gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="font-semibold text-theme-text">Target Date:</span>
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
              className="px-2.5 py-1 rounded-lg bg-theme-card border border-theme-border text-theme-text font-mono font-medium text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {task.taskDate && task.taskDate !== todayStr && (
              <button
                type="button"
                onClick={() => {
                  setAnchorDate(task.taskDate >= todayStr ? task.taskDate : todayStr);
                  setSelectedSlot(null);
                }}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  anchorDate === (task.taskDate >= todayStr ? task.taskDate : todayStr)
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'bg-theme-card text-theme-muted hover:text-theme-text border border-theme-border hover:bg-theme-card-hover'
                }`}
              >
                Task Date ({formatDisplayDate(task.taskDate)})
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setAnchorDate(todayStr);
                setSelectedSlot(null);
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                anchorDate === todayStr
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'bg-theme-card text-theme-muted hover:text-theme-text border border-theme-border hover:bg-theme-card-hover'
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
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                anchorDate === tomorrowStr
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'bg-theme-card text-theme-muted hover:text-theme-text border border-theme-border hover:bg-theme-card-hover'
              }`}
            >
              Tomorrow
            </button>

            <button
              type="button"
              onClick={() => {
                const parts = todayStr.split('-').map(Number);
                const nextDay = new Date(parts[0], parts[1] - 1, parts[2] + 2);
                const dStr = toISODateString(nextDay);
                setAnchorDate(dStr);
                setSelectedSlot(null);
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                anchorDate === (() => {
                  const parts = todayStr.split('-').map(Number);
                  return toISODateString(new Date(parts[0], parts[1] - 1, parts[2] + 2));
                })()
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'bg-theme-card text-theme-muted hover:text-theme-text border border-theme-border hover:bg-theme-card-hover'
              }`}
            >
              +2 Days
            </button>

            <button
              type="button"
              onClick={() => {
                const parts = todayStr.split('-').map(Number);
                const nextWeek = new Date(parts[0], parts[1] - 1, parts[2] + 7);
                const dStr = toISODateString(nextWeek);
                setAnchorDate(dStr);
                setSelectedSlot(null);
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                anchorDate === (() => {
                  const parts = todayStr.split('-').map(Number);
                  return toISODateString(new Date(parts[0], parts[1] - 1, parts[2] + 7));
                })()
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'bg-theme-card text-theme-muted hover:text-theme-text border border-theme-border hover:bg-theme-card-hover'
              }`}
            >
              +1 Week
            </button>
          </div>
        </div>

        {/* Navigation Mode Tabs */}
        <div className="flex items-center gap-1 p-1 bg-theme-card-hover rounded-xl border border-theme-border text-xs font-semibold shrink-0">
          <button
            onClick={() => setViewMode('week')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              viewMode === 'week' 
                ? 'bg-theme-card text-blue-600 dark:text-blue-400 shadow-xs border border-theme-border' 
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
            <span>7-Day Schedule Matrix (from {formatDisplayDate(anchorDate)})</span>
          </button>
          <button
            onClick={() => setViewMode('scanner')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              viewMode === 'scanner' 
                ? 'bg-theme-card text-purple-600 dark:text-purple-400 shadow-xs border border-theme-border' 
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>100-Day Smart Scanner</span>
          </button>
          <button
            onClick={() => setViewMode('custom')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              viewMode === 'custom' 
                ? 'bg-theme-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-theme-border' 
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Custom Date Finder</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          
          {/* TAB 1: TOMORROW & NEXT 7 DAYS MULTIPLE TIME SLOTS */}
          {viewMode === 'week' && (
            <div className="space-y-3">
              
              {/* Day Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-medium no-scrollbar">
                <button
                  onClick={() => setSelectedDayFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedDayFilter === 'ALL'
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'bg-theme-card text-theme-muted border border-theme-border hover:text-theme-text hover:bg-theme-card-hover'
                  }`}
                >
                  <span>All Days</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedDayFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-theme-card-hover text-theme-muted'
                  }`}>
                    {weekDaysData.length}
                  </span>
                </button>
                {weekDaysData.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDayFilter(i)}
                    className={`px-3 py-1.5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                      selectedDayFilter === i
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'bg-theme-card text-theme-muted border border-theme-border hover:text-theme-text hover:bg-theme-card-hover'
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

              {/* RELATIVE SHIFT TIMELINE MATRIX */}
              {taskCircadianStartMin !== null && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-theme-card-hover/70 border border-theme-border shadow-xs space-y-3 shrink-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-theme-border/60">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs font-bold text-theme-text tracking-tight">
                        Shift Timeline Matrix ({formatDisplayDate(anchorDate)})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-medium text-theme-muted flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>Earlier ({beforeSlots.length})</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>Current Anchor</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Later ({afterSlots.length})</span>
                      </span>
                    </div>
                  </div>

                  {/* 3-Section Visual Layout: Before ⟵ Current Anchor ⟶ After */}
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_135px_1fr] gap-3 items-stretch">
                    
                    {/* 1. BEFORE SLOTS (BLUE / PRE-PONE) */}
                    <div className="space-y-2 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider px-1">
                        <span className="flex items-center gap-1">
                          <ArrowLeft className="w-3 h-3 stroke-[2.5]" /> Shift Earlier ({beforeSlots.length})
                        </span>
                        <span className="text-[10px] font-normal text-theme-muted normal-case">Pre-pone</span>
                      </div>

                      <div className="space-y-1.5 flex-1 flex flex-col justify-start">
                        {beforeSlots.length === 0 ? (
                          <div className="p-3 rounded-xl bg-blue-500/[0.04] dark:bg-blue-400/[0.06] border border-dashed border-blue-500/20 text-center text-xs text-theme-muted flex items-center justify-center flex-1 min-h-[70px]">
                            No earlier conflict-free slots on {anchorDate}
                          </div>
                        ) : (
                          beforeSlots.map((slot, bIdx) => {
                            const isSelected = selectedSlot?.date === slot.date && selectedSlot?.startTime === slot.startTime;
                            const period = getTimePeriodForTime(slot.startTime, timePeriodSettings);
                            const diffMin = (taskCircadianStartMin ?? 0) - getCircadianMinutes(slot.startTime);
                            const diffHours = Math.floor(diffMin / 60);
                            const diffMins = diffMin % 60;
                            const diffLabel = diffHours > 0 
                              ? (diffMins > 0 ? `-${diffHours}h ${diffMins}m` : `-${diffHours}h`)
                              : `-${diffMins}m`;

                            return (
                              <button
                                key={`before-${bIdx}`}
                                type="button"
                                onClick={() => setSelectedSlot(slot)}
                                className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30'
                                    : 'bg-blue-500/[0.04] dark:bg-blue-400/[0.08] border-blue-500/20 dark:border-blue-400/25 hover:border-blue-500/40 hover:bg-blue-500/[0.08] shadow-2xs'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                  <div className={`text-xs font-mono font-bold ${isSelected ? 'text-white' : 'text-theme-text'}`}>
                                    {slot.startTime} → {slot.endTime}
                                  </div>
                                  <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded-full shrink-0 flex items-center gap-0.5 ${
                                    isSelected 
                                      ? 'bg-white/20 text-white' 
                                      : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                                  }`}>
                                    <span>{period?.emoji || '⏰'}</span>
                                    <span>{period?.name || slot.period}</span>
                                  </span>
                                  {(slot.isAfterMidnight || slot.date !== anchorDate) && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-0.5">
                                      <Moon className="w-2.5 h-2.5" /> Next Day ({formatDisplayDate(slot.date)})
                                    </span>
                                  )}
                                  {slot.crossesMidnight && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 flex items-center gap-0.5">
                                      <Moon className="w-2.5 h-2.5" /> Spans Midnight
                                    </span>
                                  )}
                                  {slot.isSimultaneousSlot && (
                                    <span className="text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25 flex items-center gap-0.5">
                                      <Zap className="w-2.5 h-2.5 fill-current" /> Simultaneous
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                    isSelected ? 'bg-white/25 text-white' : 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                                  }`}>
                                    {diffLabel}
                                  </span>
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5] text-white" />}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* 2. CURRENT TIME REFERENCE (APPLE CUPERTINO PIN CARD) */}
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-500/[0.06] dark:bg-amber-400/[0.08] border border-amber-500/30 dark:border-amber-400/30 text-center space-y-1 shrink-0 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> CURRENT
                      </span>
                      <div className="font-mono font-bold text-xs sm:text-sm text-theme-text leading-tight mt-1">
                        {task.startTime}
                      </div>
                      <div className="text-[11px] text-theme-muted font-mono font-medium">
                        ↓ {task.endTime}
                      </div>
                      <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                        {task.taskDate === todayStr ? `Today (${formatDisplayDate(task.taskDate)})` : formatDisplayDate(task.taskDate)}
                      </div>
                      {(() => {
                        const curPeriod = getTimePeriodForTime(task.startTime, timePeriodSettings);
                        return (
                          <span className="text-[10px] font-medium text-theme-muted truncate max-w-full px-1">
                            {curPeriod?.emoji || '⏰'} {curPeriod?.name || 'Anchor'}
                          </span>
                        );
                      })()}
                    </div>

                    {/* 3. AFTER SLOTS (GREEN / POST-PONE) */}
                    <div className="space-y-2 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider px-1">
                        <span className="flex items-center gap-1">
                          Shift Later ({afterSlots.length}) <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                        </span>
                        <span className="text-[10px] font-normal text-theme-muted normal-case">Post-pone</span>
                      </div>

                      <div className="space-y-1.5 flex-1 flex flex-col justify-start">
                        {afterSlots.length === 0 ? (
                          <div className="p-3 rounded-xl bg-emerald-500/[0.04] dark:bg-emerald-400/[0.06] border border-dashed border-emerald-500/20 text-center text-xs text-theme-muted flex items-center justify-center flex-1 min-h-[70px]">
                            No later conflict-free slots on {anchorDate}
                          </div>
                        ) : (
                          afterSlots.map((slot, aIdx) => {
                            const isSelected = selectedSlot?.date === slot.date && selectedSlot?.startTime === slot.startTime;
                            const period = getTimePeriodForTime(slot.startTime, timePeriodSettings);
                            const diffMin = getCircadianMinutes(slot.startTime) - (taskCircadianStartMin ?? 0);
                            const diffHours = Math.floor(diffMin / 60);
                            const diffMins = diffMin % 60;
                            const diffLabel = diffHours > 0 
                              ? (diffMins > 0 ? `+${diffHours}h ${diffMins}m` : `+${diffHours}h`)
                              : `+${diffMins}m`;

                            return (
                              <button
                                key={`after-${aIdx}`}
                                type="button"
                                onClick={() => setSelectedSlot(slot)}
                                className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
                                    : 'bg-emerald-500/[0.04] dark:bg-emerald-400/[0.08] border-emerald-500/20 dark:border-emerald-400/25 hover:border-emerald-500/40 hover:bg-emerald-500/[0.08] shadow-2xs'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                  <div className={`text-xs font-mono font-bold ${isSelected ? 'text-white' : 'text-theme-text'}`}>
                                    {slot.startTime} → {slot.endTime}
                                  </div>
                                  <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded-full shrink-0 flex items-center gap-0.5 ${
                                    isSelected 
                                      ? 'bg-white/20 text-white' 
                                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                  }`}>
                                    <span>{period?.emoji || '⏰'}</span>
                                    <span>{period?.name || slot.period}</span>
                                  </span>
                                  {(slot.isAfterMidnight || slot.date !== anchorDate) && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-0.5">
                                      <Moon className="w-2.5 h-2.5" /> Next Day ({formatDisplayDate(slot.date)})
                                    </span>
                                  )}
                                  {slot.crossesMidnight && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 flex items-center gap-0.5">
                                      <Moon className="w-2.5 h-2.5" /> Spans Midnight
                                    </span>
                                  )}
                                  {slot.isSimultaneousSlot && (
                                    <span className="text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25 flex items-center gap-0.5">
                                      <Zap className="w-2.5 h-2.5 fill-current" /> Simultaneous
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                    isSelected ? 'bg-white/25 text-white' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                  }`}>
                                    {diffLabel}
                                  </span>
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5] text-white" />}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}

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
                          ? 'bg-blue-500/[0.03] dark:bg-blue-400/[0.04] border-blue-500/25 dark:border-blue-400/25' 
                          : 'bg-theme-card border-theme-border/70'
                      }`}
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between gap-2 border-b border-theme-border/50 pb-2.5 mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isTomorrow 
                              ? 'bg-blue-600 text-white shadow-xs' 
                              : 'bg-theme-card-hover text-theme-text'
                          }`}>
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-theme-text font-display">
                                {dayGroup.dayLabel}
                              </span>
                              <span className="text-xs text-theme-muted font-mono">
                                ({dayGroup.dayOfWeek}, {dayGroup.dateStr})
                              </span>
                              {isTomorrow && (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                  Recommended
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          hasSlots 
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20'
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
                            const period = getTimePeriodForTime(slot.startTime, timePeriodSettings);
                            const isBeforeCurrent = taskCircadianStartMin !== null && getCircadianMinutes(slot.startTime) < taskCircadianStartMin;
                            const isAfterCurrent = taskCircadianStartMin !== null && getCircadianMinutes(slot.startTime) > taskCircadianStartMin;

                            return (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => setSelectedSlot(slot)}
                                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between gap-2 cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600/10 dark:bg-blue-400/15 border-blue-500 shadow-sm ring-2 ring-blue-500/30'
                                    : isSuggested
                                      ? 'bg-emerald-500/[0.06] dark:bg-emerald-400/[0.08] border-emerald-500/30 hover:border-emerald-500/50'
                                      : 'bg-theme-card hover:bg-theme-card-hover border-theme-border hover:border-blue-400 dark:hover:border-blue-600'
                                }`}
                              >
                                {/* Top Row: Time Period on Left, Clean Badges on Right */}
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center gap-1 truncate">
                                      <span>{period?.emoji || (slot.period === 'Morning' ? '🌅' : slot.period === 'Afternoon' ? '☀️' : '🌙')}</span>
                                      <span className="truncate">{period?.name || slot.period}</span>
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {slot.isSimultaneousSlot && (
                                      <span className="text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25 flex items-center gap-0.5">
                                        <Zap className="w-2.5 h-2.5 fill-current" />
                                        SIMULTANEOUS
                                      </span>
                                    )}

                                    {isSuggested && (
                                      <span className="text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 flex items-center gap-0.5">
                                        <Zap className="w-2.5 h-2.5 fill-current" />
                                        RECOMMENDED
                                      </span>
                                    )}

                                    {isSelected ? (
                                      <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                        <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                                      </div>
                                    ) : (
                                      <span className="text-[11px] font-mono text-theme-muted">
                                        #{sIdx + 1}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Middle Row: Time + Offset Pill */}
                                <div className="flex items-center justify-between gap-2 my-0.5 flex-wrap">
                                  <div className="text-xs sm:text-sm font-bold font-mono text-theme-text flex items-center gap-1.5">
                                    <span>{slot.startTime}</span>
                                    <ArrowRight className="w-3 h-3 text-theme-muted" />
                                    <span>{slot.endTime}</span>
                                  </div>

                                  {isBeforeCurrent ? (
                                    <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 shrink-0 flex items-center gap-0.5">
                                      <ArrowLeft className="w-2.5 h-2.5" /> Earlier
                                    </span>
                                  ) : isAfterCurrent ? (
                                    <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0 flex items-center gap-0.5">
                                      Later <ArrowRight className="w-2.5 h-2.5" />
                                    </span>
                                  ) : null}
                                </div>

                                {/* Bottom Row: Duration + Sleep Protection */}
                                <div className="flex items-center justify-between text-[10px] text-theme-muted font-medium pt-1.5 border-t border-theme-border/40">
                                  <span>{task.appointedMinutes}m block</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">No Sleep Overlap ✓</span>
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
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-purple-500/10 dark:bg-purple-400/15 border-purple-500 shadow-sm ring-2 ring-purple-500/30'
                          : 'bg-theme-card border-theme-border hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 font-bold text-xs font-mono flex items-center justify-center">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-theme-text font-display flex items-center gap-1.5">
                            <span>{slot.date}</span>
                            <span className="text-theme-muted font-normal">({slot.dayOfWeek})</span>
                          </div>
                          <div className="text-xs font-mono font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 flex-wrap">
                            <span>{slot.startTime} – {slot.endTime} ({task.appointedMinutes}m)</span>
                            {(() => {
                              const period = getTimePeriodForTime(slot.startTime, timePeriodSettings);
                              if (!period) return null;
                              return (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-theme-card-hover text-theme-text border border-theme-border flex items-center gap-0.5">
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
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-theme-border'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
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
                <label className="text-xs font-semibold text-theme-text flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Choose Target Date to Scan Multiple Slots:</span>
                </label>
                <input
                  type="date"
                  value={customDate}
                  min={tomorrowStr}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-theme-border bg-theme-card text-theme-text text-sm font-semibold focus:outline-none focus:border-emerald-500 transition-all"
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
                      const period = getTimePeriodForTime(slot.startTime, timePeriodSettings);
                      return (
                        <div
                          key={cIdx}
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                            isSelected
                              ? 'bg-emerald-500/10 dark:bg-emerald-400/15 border-emerald-500 shadow-sm ring-2 ring-emerald-500/30'
                              : 'bg-theme-card border-theme-border hover:border-emerald-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1 truncate">
                                <span>{period?.emoji || '⏰'}</span>
                                <span className="truncate">{period?.name || `${slot.period} Slot`}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {slot.isSimultaneousSlot && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25 flex items-center gap-0.5">
                                  <Zap className="w-2.5 h-2.5 fill-current" />
                                  SIMULTANEOUS
                                </span>
                              )}
                              {isSelected && (
                                <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                  <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-xs font-mono font-bold text-theme-text">
                            {slot.startTime} – {slot.endTime}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-red-500/[0.04] border border-red-500/20 text-center space-y-1">
                  <div className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      {customDate < tomorrowStr 
                        ? 'Reschedule only works from Tomorrow onwards. Today is not acceptable.' 
                        : 'No available time slots found on selected date.'}
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    {customDate < tomorrowStr 
                      ? 'Please pick Tomorrow or a future date to reschedule this task.' 
                      : `This day is full during waking hours (${capacitySettings.dayStartTime} - ${capacitySettings.dayEndTime}).`}
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Selected Slot Summary & Action Footer */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-theme-card-hover/80 border border-theme-border backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div>
            <div className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
              Selected Target Reschedule Slot:
            </div>
            {selectedSlot ? (
              <div className="text-sm font-bold text-theme-text mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{selectedSlot.date} ({selectedSlot.dayOfWeek.slice(0, 3)})</span>
                <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">
                  • {selectedSlot.startTime} – {selectedSlot.endTime}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                  {selectedSlot.period || 'Wake Slot'} ✓
                </span>
              </div>
            ) : (
              <div className="text-xs text-theme-muted font-medium mt-0.5">
                Select an available time slot above to reschedule
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-theme-border bg-theme-card hover:bg-theme-card-hover text-xs font-semibold text-theme-text transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedSlot}
              onClick={handleApplyReschedule}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-semibold shadow-md shadow-blue-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Confirm Reschedule</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
