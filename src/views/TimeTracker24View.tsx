import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Task, DaySlice24 } from '../types';
import { 
  get24HourContinuousTimeline, 
  toISODateString, 
  getDayOfWeekFromDate, 
  parse12HourToMinutes, 
  formatDisplayDate,
  addMinutesToTime
} from '../utils/timeUtils';
import { 
  generateDailyLifeSynthesis, 
  exportDayDiaryAsMarkdown 
} from '../utils/signalNoiseUtils';
import { 
  Clock, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  Moon, 
  Sun, 
  Coffee, 
  Plus, 
  Search, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  BookOpen, 
  Compass, 
  SlidersHorizontal,
  Flame,
  Zap,
  Activity,
  ArrowDown
} from 'lucide-react';
import { TimelineSpineItem } from '../components/timeline/TimelineSpineItem';
import { TimelineAnalyticsHUD } from '../components/timeline/TimelineAnalyticsHUD';
import { TimelineProGrid } from '../components/timeline/TimelineProGrid';

interface TimeTracker24ViewProps {
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
}

export const TimeTracker24View: React.FC<TimeTracker24ViewProps> = ({ onOpenTaskModal }) => {
  const { 
    tasks, 
    bufferNotes, 
    capacitySettings, 
    openBufferNoteModal,
    toggleSliceSignalNoise
  } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(toISODateString(new Date()));
  const dateInputRef = useRef<HTMLInputElement>(null);
  const nowIndicatorRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  const [filterType, setFilterType] = useState<'ALL' | 'SIGNAL' | 'NOISE' | 'WORK' | 'BUFFERS' | 'GAPS'>('ALL');
  const [viewMode, setViewMode] = useState<'spine' | 'grid' | 'diary'>('spine');
  const [searchQuery, setSearchQuery] = useState('');
  const [nowTime, setNowTime] = useState(new Date());

  // Real-time clock tick
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dayOfWeek = getDayOfWeekFromDate(selectedDate);
  const isToday = selectedDate === toISODateString(nowTime);
  const nowMinutes = nowTime.getHours() * 60 + nowTime.getMinutes();

  // Compute full 24-hour continuous timeline (12 AM to 11:59 PM) & daily metrics
  const { slices, metrics } = useMemo(() => {
    return get24HourContinuousTimeline(selectedDate, tasks, bufferNotes, capacitySettings);
  }, [selectedDate, tasks, bufferNotes, capacitySettings]);

  // Daily Life Synthesis & AI Review
  const dailySynthesis = useMemo(() => {
    return generateDailyLifeSynthesis(selectedDate, slices, metrics);
  }, [selectedDate, slices, metrics]);

  // Filtered slices for timeline views
  const filteredSlices = useMemo(() => {
    return slices.filter(slice => {
      if (filterType === 'SIGNAL' && slice.signalNoise !== 'signal') return false;
      if (filterType === 'NOISE' && slice.signalNoise !== 'noise') return false;
      if (filterType === 'WORK' && !slice.type.startsWith('work_')) return false;
      if (filterType === 'BUFFERS' && slice.type !== 'buffer_note' && slice.type !== 'task_buffer') return false;
      if (filterType === 'GAPS' && slice.type !== 'unaccounted_gap') return false;
      
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = slice.title.toLowerCase().includes(q);
        const matchNotes = slice.bufferNote?.notes?.toLowerCase().includes(q);
        const matchTag = slice.bufferNote?.activityTag?.toLowerCase().includes(q);
        const matchTaskDesc = slice.task?.description?.toLowerCase().includes(q);
        const matchTaskCode = slice.task?.projectCode?.toLowerCase().includes(q);
        if (!matchTitle && !matchNotes && !matchTag && !matchTaskDesc && !matchTaskCode) return false;
      }
      return true;
    });
  }, [slices, filterType, searchQuery]);

  // Date step helper (prev/next day)
  const handleShiftDate = (days: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(toISODateString(d));
  };

  // Scroll to "Now" indicator
  const handleScrollToNow = () => {
    if (nowIndicatorRef.current) {
      nowIndicatorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Export 24-hour Life Diary as Markdown (.md)
  const handleExportMarkdownDiary = () => {
    const mdContent = exportDayDiaryAsMarkdown(selectedDate, slices, metrics);
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `optimustime_life_diary_${selectedDate}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export 24-hour ledger JSON
  const handleExportJsonLedger = () => {
    const ledgerData = {
      date: selectedDate,
      dayOfWeek,
      metrics,
      synthesis: dailySynthesis,
      slices: slices.map(s => ({
        type: s.type,
        title: s.title,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        signalNoise: s.signalNoise,
        snReason: s.snReason,
        taskCode: s.task?.projectCode,
        taskDescription: s.task?.description,
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

  // Circadian Milestones along the spine
  const circadianMilestones = [
    { minute: 0, label: '12:00 AM • Deep Night & Rest Window', icon: Moon, color: 'text-indigo-400' },
    { minute: 360, label: '06:00 AM • Dawn & Morning Priming', icon: Sun, color: 'text-amber-500' },
    { minute: 540, label: '09:00 AM • Peak Morning Deep Work', icon: Zap, color: 'text-blue-500' },
    { minute: 720, label: '12:00 PM • Midday Nutrition & Recharge', icon: Coffee, color: 'text-emerald-500' },
    { minute: 840, label: '02:00 PM • Afternoon Execution & Sprint', icon: Flame, color: 'text-orange-500' },
    { minute: 1080, label: '06:00 PM • Evening Wind-Down & Personal Life', icon: Compass, color: 'text-purple-400' },
    { minute: 1290, label: '09:30 PM • Night Reflection & Sleep Transition', icon: Moon, color: 'text-indigo-400' }
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* =========================================================================
          1. TOP COMMAND BAR: DATE NAVIGATOR, VIEW SWITCHER & ACTIONS
          ========================================================================= */}
      <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-theme-border shadow-xs space-y-4">
        
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          
          {/* Left: Title & Live Pulse */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-theme-text font-display tracking-tight">
                  24-Hour Timeline & Command Center
                </h2>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono border border-emerald-200 dark:border-emerald-900 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-500" />
                  Circadian 1,440m Rail
                </span>
              </div>
              <p className="text-xs sm:text-sm text-theme-muted font-medium">
                Your entire 24-hour day (12:00 AM → 11:59 PM) unified serially with tasks, buffers, and live telemetry.
              </p>
            </div>
          </div>

          {/* Right: Precision Date Navigator & Quick Day Buttons */}
          <div className="flex items-center gap-2 flex-wrap self-stretch xl:self-auto justify-between sm:justify-start">
            
            {/* Previous Day */}
            <button
              type="button"
              onClick={() => handleShiftDate(-1)}
              className="p-2 rounded-xl bg-theme-card-hover hover:bg-theme-border border border-theme-border text-theme-text transition-all active:scale-95"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Clickable Date Picker Card */}
            <div 
              onClick={() => {
                try {
                  dateInputRef.current?.showPicker();
                } catch {
                  dateInputRef.current?.focus();
                }
              }}
              className="flex items-center gap-2 bg-theme-card-hover hover:bg-theme-card hover:border-blue-500 px-3.5 py-2 rounded-2xl border border-theme-border cursor-pointer transition-all shadow-2xs group relative"
            >
              <Calendar className="w-4 h-4 text-blue-500 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="font-bold text-xs sm:text-sm text-theme-text font-mono">
                {formatDisplayDate(selectedDate)}
              </span>
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
              />
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-theme-card text-theme-muted border border-theme-border font-mono group-hover:text-theme-text">
                {dayOfWeek.slice(0, 3)}
              </span>
            </div>

            {/* Next Day */}
            <button
              type="button"
              onClick={() => handleShiftDate(1)}
              className="p-2 rounded-xl bg-theme-card-hover hover:bg-theme-border border border-theme-border text-theme-text transition-all active:scale-95"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Today Button */}
            <button
              type="button"
              onClick={() => setSelectedDate(toISODateString(new Date()))}
              className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                isToday
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text border border-theme-border'
              }`}
            >
              {isToday && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
              <span>Today</span>
            </button>

            {/* Jump to Now Button (if Today) */}
            {isToday && (
              <button
                type="button"
                onClick={handleScrollToNow}
                className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-red-600/10 hover:bg-red-600/20 text-red-600 dark:text-red-400 text-xs font-black border border-red-500/20 transition-all active:scale-95"
                title="Scroll down directly to current time"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Jump to Now</span>
              </button>
            )}

            {/* Quick Action Buttons */}
            <button
              type="button"
              onClick={() => openBufferNoteModal({ date: selectedDate })}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black shadow-xs transition-all active:scale-95"
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Log Entry</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenTaskModal(undefined, selectedDate)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Schedule Task</span>
            </button>

          </div>

        </div>

        {/* View Mode Switcher, Filter Tabs & Search Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2 border-t border-theme-border/60">
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Lens Switcher */}
            <div className="flex items-center gap-1 p-1 bg-theme-card-hover rounded-2xl border border-theme-border">
              <button
                type="button"
                onClick={() => setViewMode('spine')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'spine'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Spine Timeline</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Pro 24h Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('diary')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'diary'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Life Diary</span>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-theme-card-hover rounded-2xl border border-theme-border overflow-x-auto no-scrollbar">
              {(['ALL', 'SIGNAL', 'NOISE', 'WORK', 'BUFFERS', 'GAPS'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    filterType === type
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-theme-muted hover:text-theme-text'
                  }`}
                >
                  {type === 'ALL' ? 'All' :
                   type === 'SIGNAL' ? '🎯 Signal' :
                   type === 'NOISE' ? '⚠️ Noise' :
                   type === 'WORK' ? 'Work' :
                   type === 'BUFFERS' ? 'Diary' : 'Gaps'}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Export Tools */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks, notes, buffers..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <button
              type="button"
              onClick={handleExportMarkdownDiary}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-theme-border bg-theme-card-hover hover:bg-theme-border text-theme-text text-xs font-bold transition-colors"
              title="Export formatted Markdown Life Diary (.md)"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Diary (.md)</span>
            </button>

            <button
              type="button"
              onClick={handleExportJsonLedger}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-theme-border bg-theme-card-hover hover:bg-theme-border text-theme-text text-xs font-bold transition-colors"
              title="Export JSON Day Ledger"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
          </div>

        </div>

      </div>

      {/* =========================================================================
          2. 24-HOUR MASTER VISUAL CONTINUOUS CIRCADIAN RIBBON (00:00 → 24:00)
          ========================================================================= */}
      <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-theme-border space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-black uppercase tracking-wider text-theme-text font-display flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Circadian 24-Hour Continuous Bar (12:00 AM → 11:59 PM)
            </span>
            <span className="text-[11px] font-mono text-theme-muted">
              ({metrics.signalRatio}% Signal • {metrics.accountabilityScore}% Accounted)
            </span>
          </div>

          {/* Color Legend */}
          <div className="flex items-center gap-3 text-[10px] font-bold text-theme-muted flex-wrap">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Signal Focus</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Buffer / Diary</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Noise / Leak</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              <span>Sleep</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span>Void Gap</span>
            </div>
          </div>
        </div>

        {/* 1,440-minute Continuous Multi-Segment Strip with live cursor */}
        <div className="relative">
          <div className="w-full h-7 bg-slate-200 dark:bg-slate-800 rounded-2xl overflow-hidden flex shadow-inner border border-theme-border/60">
            {slices.map((slice) => {
              const widthPct = Math.max(0.2, (slice.durationMinutes / 1440) * 100);
              const isNoise = slice.signalNoise === 'noise';

              let bg = 'bg-slate-300 dark:bg-slate-700';
              if (slice.type === 'work_completed') bg = 'bg-emerald-500';
              else if (slice.type === 'work_active') bg = 'bg-blue-600 animate-pulse';
              else if (slice.type.startsWith('work_')) bg = 'bg-blue-500';
              else if (slice.type === 'buffer_note') bg = isNoise ? 'bg-rose-500' : 'bg-amber-400';
              else if (slice.type === 'task_buffer') bg = 'bg-purple-400';
              else if (slice.type === 'sleep') bg = 'bg-indigo-600';

              return (
                <div
                  key={slice.id}
                  style={{ width: `${widthPct}%` }}
                  className={`h-full ${bg} transition-all relative group cursor-pointer border-r border-black/10 last:border-r-0`}
                  onClick={() => {
                    if (slice.task) onOpenTaskModal(slice.task);
                    else if (slice.bufferNote) openBufferNoteModal({ existingNote: slice.bufferNote });
                    else if (slice.type === 'unaccounted_gap') {
                      openBufferNoteModal({
                        date: selectedDate,
                        startTime: slice.startTime,
                        endTime: slice.endTime,
                        durationMinutes: slice.durationMinutes
                      });
                    }
                  }}
                  title={`${slice.startTime} – ${slice.endTime} (${slice.durationMinutes}m) [${slice.signalNoise.toUpperCase()}]: ${slice.title}`}
                />
              );
            })}
          </div>

          {/* Live NOW Needle Cursor */}
          {isToday && (
            <div
              style={{ left: `${(nowMinutes / 1440) * 100}%` }}
              className="absolute top-0 bottom-0 w-1 bg-red-600 z-10 pointer-events-none shadow-md -ml-0.5"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-white -mt-1 -ml-[3px]" />
            </div>
          )}
        </div>

        {/* Circadian Hour Labels (12 AM to 12 AM) */}
        <div className="flex justify-between text-[10px] font-mono font-bold text-theme-muted px-1">
          <span>12 AM</span>
          <span>03 AM</span>
          <span>06 AM</span>
          <span>09 AM</span>
          <span>12 PM</span>
          <span>03 PM</span>
          <span>06 PM</span>
          <span>09 PM</span>
          <span>11:59 PM</span>
        </div>
      </div>

      {/* =========================================================================
          3. UNIFIED DUAL-COLUMN STAGE ("SEEN AND ANALYSIS IN ONE PLACE")
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* MAIN CENTER STAGE: 24-HOUR SERIAL TIMELINE SPINE (approx 65% width) */}
        <div className="lg:col-span-8 space-y-4">
          
          {filteredSlices.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl border border-theme-border text-center space-y-2">
              <p className="text-sm font-bold text-theme-text">No time intervals found matching your current filter.</p>
              <p className="text-xs text-theme-muted">Try resetting the filter to view your complete 24-hour day.</p>
            </div>
          ) : viewMode === 'spine' ? (
            
            /* LENS 1: GOD-LEVEL 24-HOUR SERIAL SPINE TIMELINE (12:00 AM → 11:59 PM) */
            <div 
              ref={timelineContainerRef}
              className="glass-panel p-4 sm:p-6 rounded-3xl border border-theme-border shadow-xs relative"
            >
              {/* Central Chronological Rail Line */}
              <div className="absolute left-6 sm:left-8 top-8 bottom-8 w-1 timeline-spine-rail rounded-full z-0 pointer-events-none" />

              <div className="space-y-1 relative z-10">
                {/* 12:00 AM Midnight Milestone */}
                <div className="flex items-center gap-2.5 pb-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shadow-md z-10">
                    <Moon className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-mono text-xs font-black uppercase tracking-wider text-theme-text bg-theme-card px-2.5 py-1 rounded-xl border border-theme-border shadow-2xs">
                    12:00 AM • Day Starts (Midnight)
                  </span>
                </div>

                {/* Slices & Circadian Milestones */}
                {filteredSlices.map((slice, index) => {
                  const isCurrent = isToday && nowMinutes >= slice.startMinute && nowMinutes < slice.endMinute;
                  const isNowInGapBefore = isToday && index === 0 && nowMinutes < slice.startMinute;

                  return (
                    <React.Fragment key={slice.id}>
                      
                      {/* Live Glowing "NOW" Laser Indicator Line */}
                      {isToday && nowMinutes >= slice.startMinute && (index === filteredSlices.length - 1 || nowMinutes < filteredSlices[index + 1].startMinute) && (
                        <div 
                          ref={nowIndicatorRef}
                          className="relative pl-8 sm:pl-12 py-3 z-20 animate-fade-in"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[9px] font-black shadow-lg ring-4 ring-red-500/30 animate-pulse shrink-0">
                              ●
                            </div>
                            <div className="timeline-laser-line flex-1 rounded-full" />
                            <span className="bg-red-600 text-white font-mono text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md shrink-0 flex items-center gap-1 animate-pulse">
                              <span>NOW • {formatDisplayDate(toISODateString(nowTime))}</span>
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Main Spine Item (Task, Buffer Note, Gap, Buffer Bridge, Sleep) */}
                      <TimelineSpineItem
                        slice={slice}
                        selectedDate={selectedDate}
                        isCurrentSlice={isCurrent}
                        onOpenTaskModal={onOpenTaskModal}
                        nextSlice={filteredSlices[index + 1]}
                      />

                    </React.Fragment>
                  );
                })}

                {/* 11:59 PM Night Milestone */}
                <div className="flex items-center gap-2.5 pt-4">
                  <div className="w-7 h-7 rounded-full bg-indigo-900 text-white flex items-center justify-center text-xs shadow-md z-10">
                    <Moon className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-mono text-xs font-black uppercase tracking-wider text-theme-text bg-theme-card px-2.5 py-1 rounded-xl border border-theme-border shadow-2xs">
                    11:59 PM • Day Concludes (24h Complete)
                  </span>
                </div>

              </div>
            </div>

          ) : viewMode === 'grid' ? (

            /* LENS 2: PRO 24-HOUR PROPORTIONAL CANVAS GRID */
            <TimelineProGrid
              slices={filteredSlices}
              selectedDate={selectedDate}
              isToday={isToday}
              nowMinutes={nowMinutes}
              onOpenTaskModal={onOpenTaskModal}
            />

          ) : (

            /* LENS 3: NARRATIVE LIFE DIARY JOURNAL STREAM */
            <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-theme-border space-y-4">
              <div className="flex items-center justify-between border-b border-theme-border pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-theme-text font-display">
                    Narrative Life Diary Stream
                  </h3>
                </div>
                <span className="text-xs text-theme-muted font-medium">
                  {filteredSlices.length} daily entries recorded
                </span>
              </div>

              <div className="space-y-3">
                {filteredSlices.map((slice) => {
                  const isSignal = slice.signalNoise === 'signal';
                  return (
                    <div 
                      key={slice.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isSignal 
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60' 
                          : 'bg-theme-card border-theme-border'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs pb-1">
                        <span className="font-mono font-bold text-theme-text">
                          {slice.startTime} – {slice.endTime} ({slice.durationMinutes}m)
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          isSignal ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                        }`}>
                          {slice.signalNoise.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-theme-text pt-1">
                        {slice.title}
                      </h4>
                      {slice.bufferNote?.notes && (
                        <p className="text-xs text-theme-muted italic pt-1">
                          "{slice.bufferNote.notes}"
                        </p>
                      )}
                      {slice.task?.description && (
                        <p className="text-xs text-theme-muted pt-1">
                          {slice.task.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          )}

        </div>

        {/* RIGHT STAGE: APPLE-GRADE STICKY ANALYTICS HUD ("SEEN & ANALYZED IN ONE PLACE") */}
        <div className="lg:col-span-4 sticky top-4">
          <TimelineAnalyticsHUD
            selectedDate={selectedDate}
            slices={slices}
            metrics={metrics}
            synthesis={dailySynthesis}
          />
        </div>

      </div>

    </div>
  );
};
