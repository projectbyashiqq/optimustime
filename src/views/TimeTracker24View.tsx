import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Task, BufferStatusNote, DaySlice24, SignalNoiseType } from '../types';
import { 
  get24HourContinuousTimeline, 
  getBufferActivityEmoji, 
  getBufferActivityColor,
  toISODateString, 
  getDayOfWeekFromDate, 
  parse12HourToMinutes, 
  formatMinutesTo12Hour, 
  diffTimeInMinutes,
  addMinutesToTime,
  getCurrentRoundedTime12Hour,
  formatDisplayDate
} from '../utils/timeUtils';
import { 
  detectSignalVsNoise, 
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
  ChevronDown,
  RotateCcw,
  BookOpen,
  Sliders,
  Flame,
  BatteryCharging,
  Send,
  Check,
  Award,
  Maximize2
} from 'lucide-react';
import { TimePicker } from '../components/TimePicker';

interface TimeTracker24ViewProps {
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
}

export const TimeTracker24View: React.FC<TimeTracker24ViewProps> = ({ onOpenTaskModal }) => {
  const { 
    tasks, 
    bufferNotes, 
    bufferCategories,
    capacitySettings, 
    openBufferNoteModal, 
    deleteBufferNote, 
    updateBufferNote,
    toggleSliceSignalNoise,
    addQuickDiaryEntry,
    startTask, 
    completeTask 
  } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(toISODateString(new Date()));
  const trackerDateInputRef = useRef<HTMLInputElement>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'SIGNAL' | 'NOISE' | 'WORK' | 'BUFFERS' | 'GAPS'>('ALL');
  const [viewMode, setViewMode] = useState<'timeline' | 'diary'>('diary');
  const [searchQuery, setSearchQuery] = useState('');
  const [nowTime, setNowTime] = useState(new Date());

  // Quick Life Diary Composer state
  const [diaryText, setDiaryText] = useState('');
  const [diaryStartTime, setDiaryStartTime] = useState<string>(getCurrentRoundedTime12Hour(15));
  const [diaryDuration, setDiaryDuration] = useState<number>(15);
  const [diaryTag, setDiaryTag] = useState<string>('Coffee / Tea');
  const [diarySNOverride, setDiarySNOverride] = useState<SignalNoiseType | null>(null);
  const [diaryEnergy, setDiaryEnergy] = useState<number>(4);
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(true);

  // Daily AI Life Synthesis card collapse
  const [isSynthesisOpen, setIsSynthesisOpen] = useState<boolean>(true);

  // Inline Reflection / Details Expansion state
  const [expandedSliceId, setExpandedSliceId] = useState<string | null>(null);
  const [inlineReflectionText, setInlineReflectionText] = useState<string>('');

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

  // Daily Life Synthesis & AI Review
  const dailySynthesis = useMemo(() => {
    return generateDailyLifeSynthesis(selectedDate, slices, metrics);
  }, [selectedDate, slices, metrics]);

  // Filtered slices for timeline and narrative diary view
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

  // Live Auto-Detection for Composer
  const composerAutoSN = useMemo(() => {
    return detectSignalVsNoise({
      title: diaryTag,
      notes: diaryText,
      tag: diaryTag,
      energyLevel: diaryEnergy,
      explicitType: diarySNOverride || undefined
    });
  }, [diaryTag, diaryText, diaryEnergy, diarySNOverride]);

  // Submit Quick Micro-Diary Entry
  const handleLogQuickDiary = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!diaryText.trim()) return;

    addQuickDiaryEntry({
      date: selectedDate,
      startTime: diaryStartTime,
      durationMinutes: diaryDuration,
      text: diaryText.trim(),
      activityTag: diaryTag,
      signalNoise: composerAutoSN.type,
      energyLevel: diaryEnergy
    });

    // Reset input
    setDiaryText('');
    setDiarySNOverride(null);
    setDiaryStartTime(getCurrentRoundedTime12Hour(15));
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

  const getSliceStyles = (slice: DaySlice24) => {
    switch (slice.type) {
      case 'work_completed':
        return {
          bg: 'bg-emerald-500',
          panelBg: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800',
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
          bg: slice.signalNoise === 'noise' ? 'bg-rose-500' : 'bg-amber-400',
          panelBg: slice.signalNoise === 'noise' 
            ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 shadow-sm'
            : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 shadow-sm',
          badgeBg: slice.signalNoise === 'noise' ? 'bg-rose-500 text-white font-bold' : 'bg-amber-500 text-white font-bold',
          label: 'Logged Life Diary Entry',
          icon: '☕'
        };
      case 'task_buffer':
        return {
          bg: 'bg-purple-400',
          panelBg: 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',
          badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
          label: 'Transition Buffer',
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
          badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
          label: 'Unaccounted Void Gap',
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
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-theme-text font-display tracking-tight">
                24-Hour Life Diary & Ledger
              </h2>
              <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono border border-emerald-200 dark:border-emerald-900 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-500" />
                Signal vs. Noise Protocol
              </span>
            </div>
            <p className="text-xs sm:text-sm text-theme-muted font-medium">
              Your all-in-all life diary. Detailed tracking of every task, reflection, and buffer interval categorized intelligently.
            </p>
          </div>
        </div>

        {/* Date Selector & Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap self-stretch xl:self-auto justify-between sm:justify-start">
          
          <div 
            onClick={() => {
              try {
                trackerDateInputRef.current?.showPicker();
              } catch {
                trackerDateInputRef.current?.focus();
              }
            }}
            className="flex items-center gap-2 bg-theme-card-hover hover:bg-theme-card hover:border-blue-500 px-3 py-2 rounded-2xl border border-theme-border cursor-pointer transition-all shadow-2xs group active:scale-98 relative"
            title="Click anywhere to open full calendar"
          >
            <Calendar className="w-4 h-4 text-blue-500 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-xs sm:text-sm text-theme-text font-mono tracking-tight">
              {formatDisplayDate(selectedDate)}
            </span>
            <input
              ref={trackerDateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
            />
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-theme-card text-theme-muted border border-theme-border font-mono group-hover:text-theme-text group-hover:border-blue-400/50">
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
            onClick={handleExportMarkdownDiary}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-theme-card-hover hover:bg-theme-border text-theme-text text-xs font-bold border border-theme-border transition-all shadow-sm"
            title="Export complete Life Diary as formatted Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            <span>Export Diary (.md)</span>
          </button>

          <button
            onClick={() => openBufferNoteModal({ date: selectedDate })}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black shadow-md shadow-amber-500/20 transition-all transform active:scale-95"
          >
            <Coffee className="w-4 h-4" />
            <span>Log Entry</span>
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

      {/* Quick Life Diary Micro-Composer (Inline Diary Logging) */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-theme-border shadow-sm space-y-3 bg-gradient-to-br from-amber-500/5 via-theme-card to-blue-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <h3 className="text-xs sm:text-sm font-black text-theme-text uppercase tracking-wider font-display flex items-center gap-1.5">
              <span>⚡ Quick Life Diary Composer</span>
              <span className="text-[10px] font-mono text-theme-muted font-normal">
                (Type what you did or reflect & press Enter)
              </span>
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsComposerOpen(!isComposerOpen)}
            className="p-1.5 rounded-xl hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors text-xs font-bold flex items-center gap-1"
          >
            <span>{isComposerOpen ? 'Collapse' : 'Expand Composer'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isComposerOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {isComposerOpen && (
          <form onSubmit={handleLogQuickDiary} className="space-y-3 pt-1">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              
              {/* Text Input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={diaryText}
                  onChange={(e) => setDiaryText(e.target.value)}
                  placeholder="What did you just do? e.g., 'Read 15 pages of system design book and took notes' or 'Doomscrolled social media'..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-theme-card border border-theme-border text-xs sm:text-sm text-theme-text placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-amber-500/40 shadow-inner"
                />
              </div>

              {/* Start Time & Duration Picker */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="w-32 sm:w-36 min-w-[125px] shrink-0">
                  <TimePicker
                    value={diaryStartTime}
                    onChange={(val) => setDiaryStartTime(val)}
                  />
                </div>

                {/* Duration Chips */}
                <div className="flex items-center gap-1 bg-theme-card p-1 rounded-xl border border-theme-border">
                  {[10, 15, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDiaryDuration(mins)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                        diaryDuration === mins
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-theme-muted hover:text-theme-text'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>

                {/* Activity Tag Chip Selector */}
                <select
                  value={diaryTag}
                  onChange={(e) => setDiaryTag(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-xs font-bold text-theme-text focus:outline-none cursor-pointer"
                >
                  {bufferCategories.map(cat => (
                    <option key={cat.id} value={cat.label}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Bottom Row: Intelligent Signal vs Noise Auto-badge & Submit Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-theme-border/60">
              
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-[11px] font-bold text-theme-muted">Classification:</span>
                
                {/* 1-Click Toggle Badge */}
                <button
                  type="button"
                  onClick={() => {
                    const next = composerAutoSN.type === 'signal' ? 'noise' : 'signal';
                    setDiarySNOverride(next);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black transition-all shadow-sm ${
                    composerAutoSN.type === 'signal'
                      ? 'bg-emerald-500 text-white shadow-emerald-500/20 ring-1 ring-emerald-400'
                      : 'bg-rose-500 text-white shadow-rose-500/20 ring-1 ring-rose-400'
                  }`}
                  title="Click to flip Signal vs Noise classification"
                >
                  <span>{composerAutoSN.type === 'signal' ? '🎯 SIGNAL' : '⚠️ NOISE'}</span>
                  <span className="text-[10px] opacity-80 underline font-normal">(Click to toggle)</span>
                </button>

                <span className="text-[11px] text-theme-muted truncate max-w-xs">
                  {composerAutoSN.reason}
                </span>
              </div>

              <button
                type="submit"
                disabled={!diaryText.trim()}
                className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-emerald-500 to-blue-600 hover:from-amber-600 hover:to-blue-700 disabled:opacity-40 text-white text-xs font-black shadow-md shadow-amber-500/20 transition-all transform active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Save to Life Diary</span>
              </button>

            </div>
          </form>
        )}
      </div>

      {/* Signal vs. Noise KPI Executive Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        
        {/* KPI 1: Signal Ratio & SNR Multiplier */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-theme-border space-y-1 col-span-2 md:col-span-1 bg-gradient-to-br from-emerald-500/10 via-theme-card to-blue-500/10 shadow-sm">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">Signal Ratio</span>
            <Flame className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {metrics.signalRatio}%
            </span>
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              ({metrics.snrMultiplier}x SNR)
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full transition-all duration-500" 
              style={{ width: `${metrics.signalRatio}%` }} 
            />
          </div>
          <p className="text-[10px] text-theme-muted pt-0.5">
            {metrics.signalRatio >= 80 ? '🔥 High Flow State' : metrics.signalRatio >= 60 ? '⚡ Steady Output' : '⚠️ High Noise Creep'}
          </p>
        </div>

        {/* KPI 2: Total Signal Output */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-theme-border space-y-1 bg-emerald-50/20 dark:bg-emerald-950/10">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">Signal Output</span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-display">
              {Math.floor(metrics.signalMinutes / 60)}h {metrics.signalMinutes % 60}m
            </span>
          </div>
          <p className="text-[10px] text-theme-muted">
            Deep focus, health & learning
          </p>
        </div>

        {/* KPI 3: Noise Leakage */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-theme-border space-y-1 bg-rose-50/20 dark:bg-rose-950/10">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">Noise Leaks</span>
            <AlertCircle className={`w-4 h-4 ${metrics.noiseMinutes > 60 ? 'text-rose-500' : 'text-theme-muted'}`} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl sm:text-3xl font-black font-display ${metrics.noiseMinutes > 60 ? 'text-rose-600 dark:text-rose-400' : 'text-theme-text'}`}>
              {Math.floor(metrics.noiseMinutes / 60)}h {metrics.noiseMinutes % 60}m
            </span>
          </div>
          <p className="text-[10px] text-theme-muted">
            Distractions & unaccounted gaps
          </p>
        </div>

        {/* KPI 4: Sleep & Recovery */}
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
            Circadian recovery window
          </p>
        </div>

        {/* KPI 5: Accountability Score */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-theme-border space-y-1">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">Accountability</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {metrics.accountabilityScore}%
            </span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              Score
            </span>
          </div>
          <p className="text-[10px] text-theme-muted">
            {1440 - metrics.unaccountedMinutes}m of 1,440m tracked
          </p>
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
              ({metrics.signalRatio}% Signal • {metrics.accountabilityScore}% Accounted)
            </span>
          </div>

          {/* Ribbon Legend */}
          <div className="flex items-center gap-3 text-[10px] font-bold text-theme-muted flex-wrap">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Signal Focus</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Buffer / Diary</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-1 ring-rose-400" />
              <span>Noise / Leak</span>
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
            const isNoise = slice.signalNoise === 'noise';

            return (
              <div
                key={slice.id}
                style={{ width: `${widthPct}%` }}
                className={`h-full ${style.bg} ${isNoise ? 'ring-1 ring-rose-500/70' : ''} transition-all relative group cursor-pointer border-r border-black/10 last:border-r-0`}
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
                title={`${slice.startTime} - ${slice.endTime} (${slice.durationMinutes}m) [${slice.signalNoise.toUpperCase()}]: ${slice.title}`}
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

      {/* Daily Life Synthesis & AI Review Card (Collapsible) */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-theme-border space-y-3 bg-gradient-to-r from-blue-500/5 via-theme-card to-emerald-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-sm font-black text-theme-text uppercase tracking-wider font-display">
                Daily Life Synthesis & AI Review
              </h3>
              <p className={`text-xs font-bold ${dailySynthesis.verdictColor}`}>
                {dailySynthesis.headline}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSynthesisOpen(!isSynthesisOpen)}
            className="p-1.5 rounded-xl hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isSynthesisOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {isSynthesisOpen && (
          <div className="space-y-3 pt-2 text-xs">
            <p className="text-theme-muted font-medium leading-relaxed">
              {dailySynthesis.reflectionSummary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Wins */}
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Key Signal Accomplishments</span>
                </div>
                <ul className="space-y-1 text-theme-muted text-[11px]">
                  {dailySynthesis.keySignalWins.map((w, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold shrink-0">🎯</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Leaks */}
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-300">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Noise Leakage Points</span>
                </div>
                <ul className="space-y-1 text-theme-muted text-[11px]">
                  {dailySynthesis.noiseLeaks.map((l, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-500 font-bold shrink-0">⚡</span>
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-theme-card border border-theme-border flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-theme-muted">
                <span className="font-bold text-theme-text">Strategic Advice: </span>
                {dailySynthesis.recommendation}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Stream Section: Controls & Dual View Modes */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-theme-border space-y-4">
        
        {/* View Mode Switcher, Filter Tabs & Search */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 border-b border-theme-border pb-4">
          
          {/* Dual View Modes: Narrative Life Diary vs Visual Timeline */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-theme-card-hover rounded-2xl border border-theme-border">
              <button
                onClick={() => setViewMode('diary')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'diary'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Life Diary Stream</span>
              </button>

              <button
                onClick={() => setViewMode('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'timeline'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Timeline Grid</span>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-theme-card-hover rounded-2xl border border-theme-border overflow-x-auto no-scrollbar">
              {(['ALL', 'SIGNAL', 'NOISE', 'WORK', 'BUFFERS', 'GAPS'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    filterType === type
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-theme-muted hover:text-theme-text hover:bg-theme-card/50'
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

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search life diary, tasks, notes..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <button
              onClick={handleExportJsonLedger}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-theme-border bg-theme-card-hover hover:bg-theme-border text-theme-text text-xs font-bold transition-colors"
              title="Export 24-Hour Day Ledger JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">JSON</span>
            </button>
          </div>

        </div>

        {/* Empty State */}
        {filteredSlices.length === 0 ? (
          <div className="p-12 text-center text-xs text-theme-muted space-y-2">
            <p className="text-sm font-bold text-theme-text">No diary intervals found matching current filter.</p>
            <p>Try resetting the filter or search query to review your complete 24-hour life ledger.</p>
          </div>
        ) : viewMode === 'diary' ? (
          
          /* MODE 1: NARRATIVE LIFE DIARY MODE (Personal Life Story / Journal Stream) */
          <div className="space-y-4">
            {filteredSlices.map((slice, index) => {
              const style = getSliceStyles(slice);
              const isGap = slice.type === 'unaccounted_gap';
              const isBufferNote = slice.type === 'buffer_note';
              const isWork = slice.type.startsWith('work_');
              const isSleep = slice.type === 'sleep';
              const isSignal = slice.signalNoise === 'signal';

              return (
                <div
                  key={slice.id}
                  className={`p-5 rounded-3xl border transition-all duration-200 ${style.panelBg} relative overflow-hidden`}
                >
                  {/* Left Signal Indicator Bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isSignal ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-theme-border/50 pb-3">
                    
                    {/* Timestamp & Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-theme-text bg-theme-card px-2.5 py-1 rounded-xl border border-theme-border shadow-sm">
                        {slice.startTime} — {slice.endTime}
                      </span>

                      <span className="font-mono text-[11px] font-bold text-theme-muted">
                        ({slice.durationMinutes} mins)
                      </span>

                      {/* 1-Click Signal vs Noise Interactive Stamp */}
                      <button
                        type="button"
                        onClick={() => toggleSliceSignalNoise(slice)}
                        className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-xl transition-all shadow-sm ${
                          isSignal
                            ? 'bg-emerald-500 text-white shadow-emerald-500/20 ring-1 ring-emerald-400 hover:bg-emerald-600'
                            : 'bg-rose-500 text-white shadow-rose-500/20 ring-1 ring-rose-400 hover:bg-rose-600'
                        }`}
                        title="Click to flip between Signal and Noise"
                      >
                        <span>{isSignal ? '🎯 SIGNAL' : '⚠️ NOISE'}</span>
                        <span className="text-[9px] opacity-70 underline ml-0.5">Flip</span>
                      </button>

                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${style.badgeBg}`}>
                        {style.label}
                      </span>

                      {isBufferNote && slice.bufferNote && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                          {slice.bufferNote.activityTag}
                        </span>
                      )}

                      {slice.task?.projectCode && (
                        <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                          {slice.task.projectCode}
                        </span>
                      )}
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      {isGap && (
                        <button
                          onClick={() => openBufferNoteModal({
                            date: selectedDate,
                            startTime: slice.startTime,
                            endTime: slice.endTime,
                            durationMinutes: slice.durationMinutes
                          })}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-sm"
                        >
                          <Coffee className="w-3.5 h-3.5" />
                          <span>Turn Into Diary Log</span>
                        </button>
                      )}

                      {isBufferNote && slice.bufferNote && (
                        <button
                          onClick={() => openBufferNoteModal({ existingNote: slice.bufferNote })}
                          className="p-1.5 rounded-xl hover:bg-theme-card text-theme-muted hover:text-theme-text transition-colors"
                          title="Edit Buffer Note"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isBufferNote && slice.bufferNote && (
                        <button
                          onClick={() => deleteBufferNote(slice.bufferNote!.id)}
                          className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isWork && slice.task && (
                        <button
                          onClick={() => onOpenTaskModal(slice.task)}
                          className="p-1.5 rounded-xl hover:bg-theme-card text-theme-muted hover:text-theme-text transition-colors"
                          title="View / Edit Task"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                  </div>

                  {/* Diary Entry Narrative Body */}
                  <div className="pt-3 space-y-2">
                    
                    {/* Title & Emojis */}
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl shrink-0 mt-0.5">
                        {isBufferNote && slice.bufferNote
                          ? getBufferActivityEmoji(slice.bufferNote.activityTag)
                          : isSleep ? '🌙'
                          : isWork ? (slice.type === 'work_completed' ? '✓' : '⚡')
                          : '⏳'}
                      </span>
                      <div className="space-y-1 flex-1">
                        <h4 className="text-sm sm:text-base font-bold text-theme-text leading-snug">
                          {slice.title}
                        </h4>

                        {/* Narrative Diary Text */}
                        {isBufferNote && slice.bufferNote?.notes && (
                          <div className="p-3 rounded-2xl bg-theme-card/80 border border-theme-border/60 text-xs sm:text-sm text-theme-text font-medium leading-relaxed">
                            "{slice.bufferNote.notes}"
                          </div>
                        )}

                        {isWork && slice.task?.description && (
                          <p className="text-xs text-theme-muted leading-relaxed">
                            {slice.task.description}
                          </p>
                        )}

                        {isGap && (
                          <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                            Unaccounted {slice.durationMinutes}-minute time void. What occurred during this gap? Convert it into a life diary note to keep your day accounted.
                          </p>
                        )}

                        {/* Energy & Sub-Details */}
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-theme-muted flex-wrap">
                          {isBufferNote && slice.bufferNote?.energyLevel && (
                            <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                              <BatteryCharging className="w-3.5 h-3.5" />
                              <span>Energy State: Lvl {slice.bufferNote.energyLevel}/5</span>
                            </span>
                          )}

                          {slice.snReason && (
                            <span className="font-mono text-[10px] text-theme-muted">
                              [Classifier: {slice.snReason}]
                            </span>
                          )}

                          {slice.task?.subtasks && slice.task.subtasks.length > 0 && (
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                              {slice.task.subtasks.filter(st => st.isCompleted).length}/{slice.task.subtasks.length} Subtasks Done
                            </span>
                          )}
                        </div>

                      </div>
                    </div>

                  </div>

                </div>
              );
            })}
          </div>

        ) : (

          /* MODE 2: TIMELINE GRID MODE (Visual interval cards) */
          <div className="space-y-3">
            {filteredSlices.map((slice) => {
              const style = getSliceStyles(slice);
              const isGap = slice.type === 'unaccounted_gap';
              const isBufferNote = slice.type === 'buffer_note';
              const isWork = slice.type.startsWith('work_');
              const isSleep = slice.type === 'sleep';
              const isSignal = slice.signalNoise === 'signal';

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
                            ({slice.durationMinutes}m)
                          </span>

                          {/* 1-Click Signal vs Noise Toggle */}
                          <button
                            type="button"
                            onClick={() => toggleSliceSignalNoise(slice)}
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full transition-all shadow-sm ${
                              isSignal
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'bg-rose-500 text-white hover:bg-rose-600'
                            }`}
                            title="Click to flip Signal vs Noise"
                          >
                            {isSignal ? '🎯 SIGNAL' : '⚠️ NOISE'}
                          </button>

                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${style.badgeBg}`}>
                            {style.label}
                          </span>

                          {isBufferNote && slice.bufferNote && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                              {slice.bufferNote.activityTag}
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
                          </div>
                        ) : isGap ? (
                          <div className="space-y-0.5">
                            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                              Unaccounted Gap ({slice.durationMinutes}m)
                            </h4>
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
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-sm transition-all"
                        >
                          <Coffee className="w-3.5 h-3.5" />
                          <span>Log Note</span>
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
            })}
          </div>

        )}

      </div>

    </div>
  );
};
