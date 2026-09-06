import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Task, 
  PriorityLevel, 
  RecurrenceType, 
  SubTask,
  TaskLink
} from '../types';
import { 
  formatDisplayDate, 
  toISODateString, 
  addMinutesToTime, 
  diffTimeInMinutes,
  getNextRecurrenceDate,
  findNextValidOccurrenceDate,
  getNextUpcomingOccurrence,
  NextOccurrenceInfo,
  parse12HourToMinutes,
  isTaskScheduledForDate,
  SHORT_DAYS 
} from '../utils/timeUtils';
import { TimePicker } from './TimePicker';
import { 
  Repeat, 
  Clock, 
  Calendar, 
  Pause, 
  Play, 
  Trash2, 
  Edit2, 
  Plus, 
  X, 
  CheckCircle2, 
  AlertCircle,
  RotateCcw,
  Sparkles,
  Zap,
  ShieldCheck,
  Copy,
  Sliders,
  Check,
  Lock,
  ArrowRight,
  TrendingUp,
  Folder,
  Tag,
  Search,
  Filter,
  ArrowUpDown
} from 'lucide-react';

interface RecurringManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTaskModal?: (
    task?: Task, 
    date?: string, 
    startTime?: string,
    projectCode?: string,
    category?: string,
    planProjectId?: string,
    initialRecurrence?: RecurrenceType,
    isMasterRecurringSeriesAdmin?: boolean
  ) => void;
}

export const RecurringManagerModal: React.FC<RecurringManagerModalProps> = ({
  isOpen,
  onClose,
  onOpenTaskModal
}) => {
  const { 
    tasks, 
    categories,
    prioritySettings, 
    capacitySettings,
    planProjects,
    pauseRecurringSeries, 
    resumeRecurringSeries, 
    deleteRecurringSeries,
    updateRecurringSeriesEntirely,
    shiftRecurringSeriesTime,
    duplicateRecurringSeries,
    bulkPauseRecurringSeries,
    bulkResumeRecurringSeries
  } = useApp();

  const [filterRecurrence, setFilterRecurrence] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Scientific Sorting State
  // Default: 'next-occurrence' (Earliest upcoming occurrence first - industry standard)
  const [sortMode, setSortMode] = useState<
    'next-occurrence' | 'time-of-day' | 'priority' | 'cadence' | 'title'
  >('next-occurrence');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [separatePaused, setSeparatePaused] = useState<boolean>(true);

  if (!isOpen) return null;

  // Recurring tasks list
  const recurringTasks = useMemo(() => {
    return tasks.filter(t => t.recurrence && t.recurrence !== 'None');
  }, [tasks]);

  // Priority ordering mapping (Eisenhower matrix: P0 highest to P5 lowest)
  const PRIORITY_ORDER: Record<string, number> = {
    P0: 0,
    P1: 1,
    P2: 2,
    P3: 3,
    P4: 4,
    P5: 5
  };

  // Cadence ordering mapping (Daily highest frequency to Yearly lowest)
  const CADENCE_ORDER: Record<string, number> = {
    'Daily': 0,
    'Selected Days': 1,
    'Weekly': 2,
    'Monthly': 3,
    'Yearly': 4
  };

  // Reference now timestamp updated whenever modal opens
  const now = useMemo(() => new Date(), [isOpen]);

  // Compute Next Occurrence Info for all recurring tasks (O(N) memoized)
  const occurrenceMap = useMemo(() => {
    const map = new Map<string, NextOccurrenceInfo>();
    for (const t of recurringTasks) {
      map.set(t.id, getNextUpcomingOccurrence(t, now));
    }
    return map;
  }, [recurringTasks, now]);

  // Executive Telemetry
  const telemetry = useMemo(() => {
    let weeklyMinutes = 0;
    let totalSkippedDates = 0;
    let pausedCount = 0;

    for (const t of recurringTasks) {
      const duration = t.appointedMinutes || diffTimeInMinutes(t.startTime, t.endTime) || 60;
      if (t.status === 'Hold') pausedCount++;
      totalSkippedDates += (t.excludedDates || []).length;

      if (t.recurrence === 'Daily') {
        weeklyMinutes += duration * 7;
      } else if (t.recurrence === 'Selected Days' && t.selectedDays) {
        weeklyMinutes += duration * t.selectedDays.length;
      } else if (t.recurrence === 'Weekly') {
        weeklyMinutes += duration;
      } else if (t.recurrence === 'Monthly') {
        weeklyMinutes += duration * (7 / 30);
      } else if (t.recurrence === 'Yearly') {
        weeklyMinutes += duration * (7 / 365);
      }
    }

    const weeklyHours = (weeklyMinutes / 60).toFixed(1);
    return {
      activeCount: recurringTasks.length - pausedCount,
      pausedCount,
      weeklyHours,
      totalSkippedDates
    };
  }, [recurringTasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return recurringTasks.filter(t => {
      if (filterRecurrence !== 'ALL' && t.recurrence !== filterRecurrence) return false;
      if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchCode = t.projectCode?.toLowerCase().includes(q);
        const matchCat = t.category.toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchCat) return false;
      }
      return true;
    });
  }, [recurringTasks, filterRecurrence, filterCategory, searchQuery]);

  // Scientifically sorted tasks list
  const sortedTasks = useMemo(() => {
    const list = [...filteredTasks];

    return list.sort((a, b) => {
      const aPaused = a.status === 'Hold';
      const bPaused = b.status === 'Hold';

      // If separatePaused is enabled, push paused routines cleanly to the bottom
      if (separatePaused && aPaused !== bPaused) {
        return aPaused ? 1 : -1;
      }

      const aOcc = occurrenceMap.get(a.id);
      const bOcc = occurrenceMap.get(b.id);

      let comparison = 0;

      if (sortMode === 'next-occurrence') {
        // 1. Next trigger timestamp (earliest first: Happening Now -> Today Upcoming -> Tomorrow -> Later)
        const aTime = aOcc?.dateTimeMs ?? 0;
        const bTime = bOcc?.dateTimeMs ?? 0;
        comparison = aTime - bTime;

        // Secondary: start time of day
        if (comparison === 0) {
          comparison = parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime);
        }
        // Tertiary: priority
        if (comparison === 0) {
          comparison = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
        }
      } else if (sortMode === 'time-of-day') {
        // Circadian daily order (morning to night)
        comparison = parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime);
        if (comparison === 0) {
          const aTime = aOcc?.dateTimeMs ?? 0;
          const bTime = bOcc?.dateTimeMs ?? 0;
          comparison = aTime - bTime;
        }
      } else if (sortMode === 'priority') {
        // Eisenhower Priority Matrix: P0 > P1 > P2 > P3
        comparison = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
        if (comparison === 0) {
          const aTime = aOcc?.dateTimeMs ?? 0;
          const bTime = bOcc?.dateTimeMs ?? 0;
          comparison = aTime - bTime;
        }
      } else if (sortMode === 'cadence') {
        // Daily > Selected Days > Weekly > Monthly > Yearly
        comparison = (CADENCE_ORDER[a.recurrence || ''] ?? 99) - (CADENCE_ORDER[b.recurrence || ''] ?? 99);
        if (comparison === 0) {
          const aTime = aOcc?.dateTimeMs ?? 0;
          const bTime = bOcc?.dateTimeMs ?? 0;
          comparison = aTime - bTime;
        }
      } else if (sortMode === 'title') {
        comparison = a.title.localeCompare(b.title);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredTasks, sortMode, sortDirection, separatePaused, occurrenceMap]);

  // Helper to preview upcoming dates (up to 3 dates), skipping excluded dates
  const getUpcomingDates = (task: Task, count: number = 3): string[] => {
    const dates: string[] = [];
    const todayStr = toISODateString(now);

    // If today is scheduled and not excluded, and either in progress or upcoming, include today
    if (isTaskScheduledForDate(task, todayStr) && !(task.excludedDates || []).includes(todayStr)) {
      const startMin = parse12HourToMinutes(task.startTime);
      const endMin = parse12HourToMinutes(task.endTime) || (startMin + (task.appointedMinutes || 60));
      const curMin = now.getHours() * 60 + now.getMinutes();
      if (curMin < endMin) {
        dates.push(todayStr);
      }
    }

    let cursor = todayStr;
    for (let i = 0; i < 40 && dates.length < count; i++) {
      const next = findNextValidOccurrenceDate(task, cursor);
      if (!next || next === cursor) break;
      if (!dates.includes(next)) {
        dates.push(next);
      }
      cursor = next;
    }
    return dates;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-theme-card border border-theme-border rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        
        {/* =========================================================================
            HEADER & GOD ADMIN HERO
            ========================================================================= */}
        <div className="px-6 py-5 border-b border-theme-border flex items-center justify-between bg-gradient-to-r from-blue-600/15 via-indigo-600/15 to-purple-600/15">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              <Repeat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-theme-text font-display">
                  Recurring Tasks & Schedules Hub
                </h3>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-mono border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  God Admin Series Authority
                </span>
              </div>
              <p className="text-xs text-theme-muted font-medium">
                Centralized command for recurring schedules. Any change configured here updates the task series entirely everywhere.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenTaskModal?.(undefined, undefined, undefined, undefined, undefined, undefined, 'Daily', true)}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer"
              title="Create New Recurring Series with Full Task Engine"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>New Recurring Series</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors"
              title="Close Hub"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            EXECUTIVE TELEMETRY RIBBON
            ========================================================================= */}
        <div className="px-6 py-3.5 border-b border-theme-border grid grid-cols-2 sm:grid-cols-4 gap-3 bg-theme-card-hover/40 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <span className="text-theme-muted text-[11px] block">Active Series</span>
              <span className="font-mono font-black text-theme-text text-sm">
                {telemetry.activeCount} Master Schedules
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            <div>
              <span className="text-theme-muted text-[11px] block">Weekly Budget</span>
              <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                ~{telemetry.weeklyHours}h / week
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <div>
              <span className="text-theme-muted text-[11px] block">Paused Series</span>
              <span className="font-mono font-black text-theme-text text-sm">
                {telemetry.pausedCount} on Hold
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
            <div>
              <span className="text-theme-muted text-[11px] block">Skipped Dates</span>
              <span className="font-mono font-black text-theme-text text-sm">
                {telemetry.totalSkippedDates} Total Excluded
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            FILTER CONTROLS & BULK COMMANDS
            ========================================================================= */}
        <div className="px-6 py-3 border-b border-theme-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-theme-card text-xs">
          
          {/* Frequency Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {['ALL', 'Daily', 'Selected Days', 'Weekly', 'Monthly', 'Yearly'].map((rec) => (
              <button
                key={rec}
                type="button"
                onClick={() => setFilterRecurrence(rec)}
                className={`px-3 py-1 rounded-xl font-bold transition-all whitespace-nowrap ${
                  filterRecurrence === rec
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-theme-card-hover hover:bg-theme-border text-theme-muted hover:text-theme-text border border-theme-border'
                }`}
              >
                {rec === 'ALL' ? `All (${recurringTasks.length})` : rec}
              </button>
            ))}
          </div>

          {/* Search & Bulk Operations */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search series..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <button
              type="button"
              onClick={bulkPauseRecurringSeries}
              className="px-2.5 py-1.5 rounded-xl border border-theme-border bg-theme-card-hover hover:bg-theme-border text-theme-muted hover:text-theme-text text-xs font-bold transition-colors"
              title="Pause all active recurring schedules"
            >
              Pause All
            </button>

            <button
              type="button"
              onClick={bulkResumeRecurringSeries}
              className="px-2.5 py-1.5 rounded-xl border border-theme-border bg-theme-card-hover hover:bg-theme-border text-theme-muted hover:text-theme-text text-xs font-bold transition-colors"
              title="Resume all paused schedules"
            >
              Resume All
            </button>
          </div>

        </div>

        {/* =========================================================================
            SCIENTIFIC SORTING & ARRANGEMENT RIBBON
            ========================================================================= */}
        <div className="px-6 py-2.5 bg-theme-card-hover/40 border-b border-theme-border flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="flex items-center gap-1.5 text-theme-muted font-bold shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-blue-500" />
              <span>Sort:</span>
            </div>

            <div className="flex items-center gap-1 bg-theme-card p-1 rounded-xl border border-theme-border flex-wrap">
              {/* 1. Next Occurrence (Earliest First - User Recommended / Standard) */}
              <button
                type="button"
                onClick={() => {
                  if (sortMode === 'next-occurrence') {
                    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortMode('next-occurrence');
                    setSortDirection('asc');
                  }
                }}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  sortMode === 'next-occurrence'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
                title="Scientific Next-Up: Sort by earliest upcoming occurrence (Happening Now -> Today -> Tomorrow -> Later)"
              >
                <Sparkles className="w-3 h-3" />
                <span>Next Occurrence</span>
                {sortMode === 'next-occurrence' && (
                  <span className="text-[10px] opacity-90 font-mono ml-0.5">
                    {sortDirection === 'asc' ? '↑ Earliest' : '↓ Furthest'}
                  </span>
                )}
              </button>

              {/* 2. Circadian / Time of Day */}
              <button
                type="button"
                onClick={() => {
                  if (sortMode === 'time-of-day') {
                    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortMode('time-of-day');
                    setSortDirection('asc');
                  }
                }}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  sortMode === 'time-of-day'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
                title="Circadian Schedule: Sort chronologically by daily routine slot (Morning -> Night)"
              >
                <Clock className="w-3 h-3" />
                <span>Time of Day</span>
                {sortMode === 'time-of-day' && (
                  <span className="text-[10px] opacity-90 font-mono ml-0.5">
                    {sortDirection === 'asc' ? '↑ Early' : '↓ Late'}
                  </span>
                )}
              </button>

              {/* 3. Eisenhower Priority Matrix */}
              <button
                type="button"
                onClick={() => {
                  if (sortMode === 'priority') {
                    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortMode('priority');
                    setSortDirection('asc');
                  }
                }}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  sortMode === 'priority'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
                title="Eisenhower Matrix: P0 Critical to P3 Low"
              >
                <Zap className="w-3 h-3" />
                <span>Priority</span>
                {sortMode === 'priority' && (
                  <span className="text-[10px] opacity-90 font-mono ml-0.5">
                    {sortDirection === 'asc' ? '↑ P0 First' : '↓ P3 First'}
                  </span>
                )}
              </button>

              {/* 4. Cadence / Frequency */}
              <button
                type="button"
                onClick={() => {
                  if (sortMode === 'cadence') {
                    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortMode('cadence');
                    setSortDirection('asc');
                  }
                }}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  sortMode === 'cadence'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
                title="Cadence: Daily -> Selected Days -> Weekly -> Monthly -> Yearly"
              >
                <Repeat className="w-3 h-3" />
                <span>Cadence</span>
                {sortMode === 'cadence' && (
                  <span className="text-[10px] opacity-90 font-mono ml-0.5">
                    {sortDirection === 'asc' ? '↑ Daily' : '↓ Yearly'}
                  </span>
                )}
              </button>

              {/* 5. Alphabetical */}
              <button
                type="button"
                onClick={() => {
                  if (sortMode === 'title') {
                    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortMode('title');
                    setSortDirection('asc');
                  }
                }}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  sortMode === 'title'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
                title="Alphabetical: A to Z"
              >
                <span>A–Z</span>
                {sortMode === 'title' && (
                  <span className="text-[10px] opacity-90 font-mono ml-0.5">
                    {sortDirection === 'asc' ? '↑ A-Z' : '↓ Z-A'}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
            <label className="flex items-center gap-1.5 text-[11px] text-theme-muted hover:text-theme-text cursor-pointer select-none font-semibold">
              <input
                type="checkbox"
                checked={separatePaused}
                onChange={(e) => setSeparatePaused(e.target.checked)}
                className="rounded border-theme-border text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Active First (Hold to Bottom)</span>
            </label>

            <span className="text-[11px] font-mono font-bold text-theme-muted">
              {sortedTasks.length} {sortedTasks.length === 1 ? 'Series' : 'Series'}
            </span>
          </div>
        </div>

        {/* =========================================================================
            SERIES LIST / MAIN STAGE
            ========================================================================= */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {sortedTasks.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-theme-card-hover/40 border border-dashed border-theme-border space-y-3">
              <Repeat className="w-9 h-9 text-theme-muted mx-auto opacity-40" />
              <h5 className="text-sm font-bold text-theme-text">No Recurring Series Found</h5>
              <p className="text-xs text-theme-muted max-w-sm mx-auto">
                {filterRecurrence === 'ALL' 
                  ? "You don't have any repeating schedules configured yet. Click '+ New Recurring Series' to create daily standups, weekly deep work sessions, or habits."
                  : `No series found matching '${filterRecurrence}'.`}
              </p>
            </div>
          ) : (
            sortedTasks.map((task) => {
              const pMeta = prioritySettings[task.priority];
              const isPaused = task.status === 'Hold';
              const excludedCount = (task.excludedDates || []).length;
              const upcomingDates = getUpcomingDates(task, 3);
              const occ = occurrenceMap.get(task.id) || getNextUpcomingOccurrence(task, now);

              return (
                <div
                  key={task.id}
                  className={`p-5 rounded-2xl border transition-all space-y-3.5 shadow-xs ${
                    isPaused
                      ? 'bg-theme-card/60 border-theme-border opacity-80'
                      : 'bg-theme-card border-theme-border hover:border-blue-400 hover:shadow-md'
                  }`}
                >
                  {/* Top Row: Priority, Project Code, Time, Status, God Admin Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-theme-border/40 pb-3">
                    
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Priority Badge */}
                        <span 
                          className="text-[10px] font-black px-2 py-0.5 rounded font-mono uppercase"
                          style={{ backgroundColor: pMeta?.bgColor, color: pMeta?.color }}
                        >
                          {task.priority} • {pMeta?.label}
                        </span>

                        {/* Category */}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-theme-card-hover text-theme-muted border border-theme-border">
                          {task.category}
                        </span>

                        {/* Project Code */}
                        <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                          {task.projectCode}
                        </span>

                        {/* Scheduled Time */}
                        <span className="text-xs font-mono font-bold text-theme-text flex items-center gap-1 bg-theme-card-hover px-2.5 py-0.5 rounded-lg border border-theme-border">
                          <Clock className="w-3.5 h-3.5 text-theme-muted" />
                          <span>{task.startTime} – {task.endTime} ({task.appointedMinutes}m)</span>
                        </span>

                        {/* Next Imminent Trigger Badge */}
                        {!isPaused && (
                          occ.isInProgress ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse">
                              <Zap className="w-3 h-3 fill-current text-emerald-500" />
                              <span>IN PROGRESS • Ends {occ.endTime}</span>
                            </span>
                          ) : occ.isTodayUpcoming ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-blue-500" />
                              <span>NEXT: Today at {occ.startTime}</span>
                            </span>
                          ) : occ.isTomorrow ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-teal-500" />
                              <span>NEXT: Tomorrow at {occ.startTime}</span>
                            </span>
                          ) : occ.daysUntil <= 7 ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-indigo-500" />
                              <span>NEXT: {occ.label}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-theme-card-hover text-theme-muted border border-theme-border flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-theme-muted" />
                              <span>Next: {occ.label}</span>
                            </span>
                          )
                        )}

                        {/* Buffer Pill */}
                        {task.bufferMinutes !== undefined && task.bufferMinutes > 0 && (
                          <span className="text-[10px] font-mono text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full bg-purple-500/15">
                            +{task.bufferMinutes}m buffer
                          </span>
                        )}

                        {/* Mandatory Fixed Lock */}
                        {task.isMandatorySchedule && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Locked Schedule
                          </span>
                        )}

                        {/* Status */}
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                          isPaused
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {isPaused ? '⏸ Paused' : '● Active'}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-theme-text leading-snug">
                        {task.title}
                      </h4>

                      {task.description && (
                        <p className="text-xs text-theme-muted line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </div>

                    {/* God Admin Fast Action Toolbar */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 flex-wrap">
                      
                      {/* Fast Time-Shift Tool (-15m / +15m) */}
                      <div className="flex items-center bg-theme-card-hover p-0.5 rounded-xl border border-theme-border">
                        <button
                          type="button"
                          onClick={() => shiftRecurringSeriesTime(task.id, -15)}
                          className="px-2 py-1 text-[10px] font-mono font-bold text-theme-muted hover:text-theme-text hover:bg-theme-card rounded-lg transition-colors"
                          title="Shift entire recurring series 15 minutes earlier across all dates"
                        >
                          -15m
                        </button>
                        <button
                          type="button"
                          onClick={() => shiftRecurringSeriesTime(task.id, 15)}
                          className="px-2 py-1 text-[10px] font-mono font-bold text-theme-muted hover:text-theme-text hover:bg-theme-card rounded-lg transition-colors"
                          title="Shift entire recurring series 15 minutes later across all dates"
                        >
                          +15m
                        </button>
                      </div>

                      {/* Pause / Resume */}
                      {isPaused ? (
                        <button
                          type="button"
                          onClick={() => resumeRecurringSeries(task.id)}
                          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
                          title="Resume Recurring Schedule"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => pauseRecurringSeries(task.id)}
                          className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs"
                          title="Pause Recurring Schedule"
                        >
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        </button>
                      )}

                      {/* Duplicate Series */}
                      <button
                        type="button"
                        onClick={() => duplicateRecurringSeries(task.id)}
                        className="p-2 rounded-xl border border-theme-border hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
                        title="Duplicate Entire Recurring Series"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* 👑 EDIT MASTER SERIES (GOD ADMIN FULL TASK MODAL) */}
                      <button
                        type="button"
                        onClick={() => onOpenTaskModal?.(task, undefined, undefined, undefined, undefined, undefined, undefined, true)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer"
                        title="Edit Master Recurring Series with 100% of New Task System"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Series</span>
                      </button>

                      {/* Delete Series */}
                      <button
                        type="button"
                        onClick={() => deleteRecurringSeries(task.id)}
                        className="p-2 rounded-xl border border-theme-border hover:bg-rose-50 dark:hover:bg-rose-950/40 text-theme-muted hover:text-rose-500 transition-colors"
                        title="Delete Entire Recurring Series Everywhere"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>

                  {/* Recurrence Rule Banner & Active Day Pills */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Repeat className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="font-bold text-theme-text">
                        {task.recurrence}
                      </span>

                      {/* Day pills if Selected Days */}
                      {task.selectedDays && task.selectedDays.length > 0 && (
                        <div className="flex items-center gap-1">
                          {SHORT_DAYS.map((day) => {
                            const isSelected = task.selectedDays?.includes(day);
                            return (
                              <span
                                key={day}
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                                  isSelected
                                    ? 'bg-blue-600 text-white font-black'
                                    : 'bg-theme-card-hover text-theme-muted/50 border border-theme-border/40'
                                }`}
                              >
                                {day.slice(0, 1)}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Subtasks template pill */}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {task.subtasks.length} subtask template
                        </span>
                      )}
                    </div>

                    {/* Upcoming Dates Preview */}
                    {upcomingDates.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-theme-muted flex-wrap">
                        <span className="font-semibold text-theme-text/80">Upcoming Schedule:</span>
                        {upcomingDates.map((d, idx) => {
                          const isNext = idx === 0;
                          const [y, m, day] = d.split('-').map(Number);
                          const dObj = new Date(y, m - 1, day);
                          const dayName = SHORT_DAYS[dObj.getDay()];
                          const isTodayDate = d === toISODateString(now);
                          const isTomorrowDate = (() => {
                            const t = new Date(now);
                            t.setDate(t.getDate() + 1);
                            return d === toISODateString(t);
                          })();

                          return (
                            <span 
                              key={idx} 
                              className={`font-mono text-xs px-2.5 py-0.5 rounded-lg border flex items-center gap-1 ${
                                isNext
                                  ? isTodayDate 
                                    ? 'bg-blue-600 text-white font-black border-blue-600 shadow-xs'
                                    : isTomorrowDate
                                      ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30 font-bold'
                                      : 'bg-theme-card-hover text-theme-text border-theme-border font-bold'
                                  : 'bg-theme-card text-theme-muted border-theme-border/60'
                              }`}
                              title={`Scheduled occurrence: ${d}`}
                            >
                              {isNext && <Sparkles className="w-3 h-3 text-current" />}
                              <span>{isTodayDate ? 'Today' : isTomorrowDate ? 'Tomorrow' : dayName}, {formatDisplayDate(d)}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Skipped Exclusions Count */}
                    {excludedCount > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                          {excludedCount} skipped
                        </span>
                        <button
                          type="button"
                          onClick={() => updateRecurringSeriesEntirely(task.id, {}, { clearExclusions: true })}
                          className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                          title="Restore all skipped dates for this recurring series"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore All</span>
                        </button>
                      </div>
                    )}

                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
