import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Task, BufferStatusNote, DaySlice24, BufferActivityTag } from '../types';
import { 
  get24HourContinuousTimeline, 
  getBufferActivityEmoji, 
  getBufferActivityColor,
  toISODateString, 
  getDayOfWeekFromDate, 
  parse12HourToMinutes, 
  formatMinutesTo12Hour, 
  diffTimeInMinutes,
  addMinutesToTime
} from '../utils/timeUtils';
import { 
  Clock, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  Moon, 
  Sun, 
  Coffee, 
  Plus, 
  Edit2, 
  Trash2, 
  Filter, 
  Search, 
  Download, 
  ShieldCheck, 
  AlertCircle, 
  Zap, 
  TrendingUp, 
  FileText,
  Smile,
  ArrowRight,
  Layers,
  ChevronRight,
  RotateCcw
} from 'lucide-react';

interface TimeTracker24ViewProps {
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
}

export const TimeTracker24View: React.FC<TimeTracker24ViewProps> = ({ onOpenTaskModal }) => {
  const { 
    tasks, 
    bufferNotes, 
    capacitySettings, 
    openBufferNoteModal, 
    deleteBufferNote, 
    startTask, 
    completeTask 
  } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(toISODateString(new Date()));
  const [filterType, setFilterType] = useState<'ALL' | 'WORK' | 'BUFFERS' | 'GAPS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [nowTime, setNowTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dayOfWeek = getDayOfWeekFromDate(selectedDate);
  const isToday = selectedDate === toISODateString(nowTime);

  // Compute full 24-hour continuous timeline & daily metrics
  const { slices, metrics } = useMemo(() => {
    return get24HourContinuousTimeline(selectedDate, tasks, bufferNotes, capacitySettings);
  }, [selectedDate, tasks, bufferNotes, capacitySettings]);

  // Buffer notes for selected date
  const dayBufferNotes = useMemo(() => {
    return bufferNotes.filter(n => n.date === selectedDate);
  }, [bufferNotes, selectedDate]);

  // Filtered slices for timeline view
  const filteredSlices = useMemo(() => {
    return slices.filter(slice => {
      if (filterType === 'WORK' && !slice.type.startsWith('work_')) return false;
      if (filterType === 'BUFFERS' && slice.type !== 'buffer_note' && slice.type !== 'task_buffer') return false;
      if (filterType === 'GAPS' && slice.type !== 'unaccounted_gap') return false;
      
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = slice.title.toLowerCase().includes(q);
        const matchNotes = slice.bufferNote?.notes?.toLowerCase().includes(q);
        const matchTag = slice.bufferNote?.activityTag?.toLowerCase().includes(q);
        const matchTaskCode = slice.task?.projectCode?.toLowerCase().includes(q);
        if (!matchTitle && !matchNotes && !matchTag && !matchTaskCode) return false;
      }
      return true;
    });
  }, [slices, filterType, searchQuery]);

  // Export 24-hour ledger for this day
  const handleExportDayLedger = () => {
    const ledgerData = {
      date: selectedDate,
      dayOfWeek,
      metrics,
      slices: slices.map(s => ({
        type: s.type,
        title: s.title,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        taskCode: s.task?.projectCode,
        bufferNotes: s.bufferNote?.notes,
        activityTag: s.bufferNote?.activityTag,
        energyLevel: s.bufferNote?.energyLevel
      }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ledgerData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `optimustime_24h_ledger_${selectedDate}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getSliceStyles = (slice: DaySlice24) => {
    switch (slice.type) {
      case 'work_completed':
        return {
          bg: 'bg-emerald-500',
          panelBg: 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800',
          badgeBg: 'bg-emerald-600 text-white',
          label: 'Completed Focus Work',
          icon: '✓'
        };
      case 'work_active':
        return {
          bg: 'bg-blue-600 animate-pulse',
          panelBg: 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 ring-2 ring-blue-500/40 shadow-lg',
          badgeBg: 'bg-blue-600 text-white animate-pulse',
          label: 'Active Working Task',
          icon: '⚡'
        };
      case 'work_pending':
        return {
          bg: 'bg-sky-500',
          panelBg: 'bg-theme-card border-theme-border hover:border-sky-400',
          badgeBg: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
          label: 'Scheduled Task',
          icon: '●'
        };
      case 'work_hold':
        return {
          bg: 'bg-amber-500',
          panelBg: 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800',
          badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
          label: 'Task On Hold',
          icon: '⏸'
        };
      case 'buffer_note':
        return {
          bg: 'bg-amber-400',
          panelBg: 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 shadow-sm',
          badgeBg: 'bg-amber-500 text-white font-bold',
          label: 'Logged Buffer / Free Time',
          icon: '☕'
        };
      case 'task_buffer':
        return {
          bg: 'bg-purple-400',
          panelBg: 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',
          badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
          label: 'Scheduled Buffer Window',
          icon: '🟣'
        };
      case 'sleep':
        return {
          bg: 'bg-indigo-700/80',
          panelBg: 'bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900',
          badgeBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
          label: 'Sleep & Recovery Cycle',
          icon: '🌙'
        };
      default:
        return {
          bg: 'bg-slate-300 dark:bg-slate-700',
          panelBg: 'bg-theme-card-hover/40 border-dashed border-theme-border hover:border-amber-400',
          badgeBg: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
          label: 'Unaccounted Free Time',
          icon: '⏳'
        };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner & Date Controls */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-theme-border flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-sm">
        
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/25 shrink-0">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-theme-text font-display tracking-tight">
                24-Hour Continuous Time Tracker
              </h2>
              <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono border border-blue-200 dark:border-blue-900">
                1,440 Mins Protocol
              </span>
            </div>
            <p className="text-xs sm:text-sm text-theme-muted font-medium">
              Zero unlogged minutes. Account for all focus blocks, sleep cycles, and free-time buffer notes.
            </p>
          </div>
        </div>

        {/* Date Selector & Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap self-stretch xl:self-auto justify-between sm:justify-start">
          
          <div className="flex items-center gap-2 bg-theme-card-hover px-3 py-2 rounded-2xl border border-theme-border">
            <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="font-bold text-xs sm:text-sm text-theme-text bg-transparent focus:outline-none cursor-pointer"
            />
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-theme-card text-theme-muted border border-theme-border font-mono">
              {dayOfWeek.slice(0, 3)}
            </span>
          </div>

          <button
            onClick={() => setSelectedDate(toISODateString(new Date()))}
            className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all ${
              isToday
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-theme-card-hover text-theme-muted hover:text-theme-text border border-theme-border'
            }`}
          >
            Today
          </button>

          <button
            onClick={() => openBufferNoteModal({ date: selectedDate })}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black shadow-md shadow-amber-500/20 transition-all transform active:scale-95"
          >
            <Coffee className="w-4 h-4" />
            <span>+ Log Buffer Note</span>
          </button>

          <button
            onClick={() => onOpenTaskModal(undefined, selectedDate)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Schedule Task</span>
          </button>
        </div>

      </div>

      {/* 24-Hour Master Continuous Visual Ribbon */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-theme-border space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-theme-text font-display flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Circadian 24-Hour Timeline Bar (00:00 → 24:00)
            </span>
            <span className="text-[11px] font-mono text-theme-muted">
              ({metrics.accountabilityScore}% Accounted)
            </span>
          </div>

          {/* Ribbon Legend */}
          <div className="flex items-center gap-3 text-[10px] font-bold text-theme-muted flex-wrap">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Done Work</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <span>Scheduled</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Buffer Notes</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-700" />
              <span>Sleep</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span>Unaccounted Gap</span>
            </div>
          </div>
        </div>

        {/* 1,440-minute Continuous Multi-Segment Strip */}
        <div className="w-full h-8 bg-slate-200 dark:bg-slate-800 rounded-2xl overflow-hidden flex shadow-inner border border-theme-border/60">
          {slices.map((slice) => {
            const widthPct = Math.max(0.2, (slice.durationMinutes / 1440) * 100);
            const style = getSliceStyles(slice);
            return (
              <div
                key={slice.id}
                style={{ width: `${widthPct}%` }}
                className={`h-full ${style.bg} transition-all relative group cursor-pointer border-r border-black/10 last:border-r-0`}
                onClick={() => {
                  if (slice.bufferNote) {
                    openBufferNoteModal({ existingNote: slice.bufferNote });
                  } else if (slice.task) {
                    onOpenTaskModal(slice.task);
                  } else if (slice.type === 'unaccounted_gap') {
                    openBufferNoteModal({
                      date: selectedDate,
                      startTime: slice.startTime,
                      endTime: slice.endTime,
                      durationMinutes: slice.durationMinutes
                    });
                  }
                }}
                title={`${slice.startTime} - ${slice.endTime} (${slice.durationMinutes}m): ${slice.title}`}
              />
            );
          })}
        </div>

        {/* Hour Marks 0h, 3h, 6h, 9h, 12h, 15h, 18h, 21h, 24h */}
        <div className="flex justify-between text-[10px] font-mono font-bold text-theme-muted px-1">
          <span>12 AM</span>
          <span>03 AM</span>
          <span>06 AM</span>
          <span>09 AM</span>
          <span>12 PM</span>
          <span>03 PM</span>
          <span>06 PM</span>
          <span>09 PM</span>
          <span>12 AM</span>
        </div>
      </div>

      {/* 24-Hour Life Metrics KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        
        {/* Metric 1: 24H Accountability Score */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-theme-border space-y-1 col-span-2 md:col-span-1 bg-gradient-to-br from-amber-500/10 to-blue-500/10">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">Accountability</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {metrics.accountabilityScore}%
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Score
            </span>
          </div>
          <p className="text-[10px] text-theme-muted">
            {1440 - metrics.unaccountedMinutes}m of 1,440m tracked
          </p>
        </div>

        {/* Metric 2: Work Time */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-theme-border space-y-1">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">Work Focus</span>
            <Zap className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {Math.floor(metrics.workMinutes / 60)}h {metrics.workMinutes % 60}m
            </span>
          </div>
          <p className="text-[10px] text-theme-muted">
            {metrics.completedWorkMinutes}m completed
          </p>
        </div>

        {/* Metric 3: Logged Buffer Notes */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-theme-border space-y-1 bg-amber-50/20 dark:bg-amber-950/10">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">Buffer / Free</span>
            <Coffee className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-display">
              {Math.floor(metrics.bufferLoggedMinutes / 60)}h {metrics.bufferLoggedMinutes % 60}m
            </span>
          </div>
          <p className="text-[10px] text-theme-muted">
            {dayBufferNotes.length} logged reflection notes
          </p>
        </div>

        {/* Metric 4: Sleep Cycle */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-theme-border space-y-1">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">Sleep Cycle</span>
            <Moon className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {Math.floor(metrics.sleepMinutes / 60)}h {metrics.sleepMinutes % 60}m
            </span>
          </div>
          <p className="text-[10px] text-theme-muted">
            {capacitySettings.dayEndTime} → {capacitySettings.dayStartTime}
          </p>
        </div>

        {/* Metric 5: Unaccounted Gap */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-theme-border space-y-1">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">Unaccounted</span>
            <AlertCircle className={`w-4 h-4 ${metrics.unaccountedMinutes > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl sm:text-3xl font-black font-display ${metrics.unaccountedMinutes > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>
              {Math.floor(metrics.unaccountedMinutes / 60)}h {metrics.unaccountedMinutes % 60}m
            </span>
          </div>
          <p className="text-[10px] text-theme-muted">
            {metrics.unaccountedMinutes === 0 ? '🎉 100% Accounted!' : 'Click gaps below to log notes'}
          </p>
        </div>

      </div>

      {/* Main 24-Hour Chronological Timeline Slices List */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-theme-border space-y-4">
        
        {/* Filter Controls & Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-theme-border pb-4">
          
          {/* Slices Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-theme-card-hover rounded-2xl border border-theme-border overflow-x-auto no-scrollbar">
            {(['ALL', 'WORK', 'BUFFERS', 'GAPS'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  filterType === type
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-theme-muted hover:text-theme-text hover:bg-theme-card/50'
                }`}
              >
                {type === 'ALL' ? 'All 24h Intervals' :
                 type === 'WORK' ? 'Work Tasks' :
                 type === 'BUFFERS' ? 'Buffer Notes' : 'Free Time Gaps'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes, tasks, tags..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <button
              onClick={handleExportDayLedger}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-theme-border bg-theme-card-hover hover:bg-theme-border text-theme-text text-xs font-bold transition-colors"
              title="Export 24-Hour Day Ledger JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>

        </div>

        {/* Slices Chronological Stream */}
        <div className="space-y-3">
          {filteredSlices.length === 0 ? (
            <div className="p-8 text-center text-xs text-theme-muted">
              No intervals found matching current filter.
            </div>
          ) : (
            filteredSlices.map((slice) => {
              const style = getSliceStyles(slice);
              const isGap = slice.type === 'unaccounted_gap';
              const isBufferNote = slice.type === 'buffer_note';
              const isWork = slice.type.startsWith('work_');
              const isSleep = slice.type === 'sleep';

              return (
                <div
                  key={slice.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 ${style.panelBg}`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    
                    {/* Left: Time + Status Badge + Content */}
                    <div className="flex items-start gap-3 flex-1">
                      
                      {/* Emoji / Icon Box */}
                      <div className="w-10 h-10 rounded-2xl bg-theme-card border border-theme-border flex items-center justify-center text-lg shrink-0 shadow-sm">
                        {isBufferNote && slice.bufferNote
                          ? getBufferActivityEmoji(slice.bufferNote.activityTag)
                          : isSleep ? '🌙'
                          : isWork ? (slice.type === 'work_completed' ? '✓' : '⚡')
                          : isGap ? '⏳' : '🟣'}
                      </div>

                      <div className="space-y-1 flex-1">
                        
                        {/* Time & Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-theme-text bg-theme-card px-2 py-0.5 rounded border border-theme-border">
                            {slice.startTime} - {slice.endTime}
                          </span>

                          <span className="font-mono text-[11px] font-bold text-theme-muted">
                            ({slice.durationMinutes} mins)
                          </span>

                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${style.badgeBg}`}>
                            {style.label}
                          </span>

                          {isBufferNote && slice.bufferNote && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                              {slice.bufferNote.activityTag}
                            </span>
                          )}

                          {isBufferNote && slice.bufferNote?.energyLevel && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <span>⚡ Energy: Lvl {slice.bufferNote.energyLevel}/5</span>
                            </span>
                          )}

                          {slice.task && (
                            <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                              {slice.task.projectCode}
                            </span>
                          )}
                        </div>

                        {/* Title or Note */}
                        {isBufferNote && slice.bufferNote ? (
                          <div className="space-y-0.5">
                            <h4 className="text-sm font-bold text-theme-text">
                              {slice.bufferNote.notes || `Spent ${slice.durationMinutes} mins on ${slice.bufferNote.activityTag}`}
                            </h4>
                            {slice.bufferNote.relatedTaskTitle && (
                              <p className="text-xs text-theme-muted">
                                Linked Buffer Post-Task: <strong>{slice.bufferNote.relatedTaskTitle}</strong>
                              </p>
                            )}
                          </div>
                        ) : isGap ? (
                          <div className="space-y-0.5">
                            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                              Unaccounted Free Time Slot ({slice.durationMinutes} min gap)
                            </h4>
                            <p className="text-xs text-theme-muted">
                              What did you do during this time? Log a buffer note to keep your 24-hour day 100% on track.
                            </p>
                          </div>
                        ) : (
                          <h4 className="text-sm font-bold text-theme-text">
                            {slice.title}
                          </h4>
                        )}

                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-theme-border">
                      {isGap && (
                        <button
                          onClick={() => openBufferNoteModal({
                            date: selectedDate,
                            startTime: slice.startTime,
                            endTime: slice.endTime,
                            durationMinutes: slice.durationMinutes
                          })}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-sm transition-all transform active:scale-95"
                        >
                          <Coffee className="w-3.5 h-3.5" />
                          <span>Log Buffer Note</span>
                        </button>
                      )}

                      {isGap && (
                        <button
                          onClick={() => onOpenTaskModal(undefined, selectedDate, slice.startTime)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Fill Task</span>
                        </button>
                      )}

                      {isBufferNote && slice.bufferNote && (
                        <button
                          onClick={() => openBufferNoteModal({ existingNote: slice.bufferNote })}
                          className="p-1.5 rounded-lg hover:bg-theme-card text-theme-muted hover:text-theme-text transition-colors"
                          title="Edit Buffer Note"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isBufferNote && slice.bufferNote && (
                        <button
                          onClick={() => deleteBufferNote(slice.bufferNote!.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors"
                          title="Delete Buffer Note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isWork && slice.task && (
                        <button
                          onClick={() => onOpenTaskModal(slice.task)}
                          className="p-1.5 rounded-lg hover:bg-theme-card text-theme-muted hover:text-theme-text transition-colors"
                          title="View / Edit Task"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

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
