import React, { useState, useMemo } from 'react';
import { DaySlice24, DayBreakdown24Metrics, SignalNoiseType } from '../../types';
import { useApp } from '../../context/AppContext';
import { detectSignalVsNoise, DailyLifeSynthesis } from '../../utils/signalNoiseUtils';
import { getCurrentRoundedTime12Hour } from '../../utils/timeUtils';
import { TimePicker } from '../TimePicker';
import { 
  Zap, 
  Flame, 
  ShieldCheck, 
  AlertCircle, 
  Moon, 
  Coffee, 
  Clock, 
  ChevronDown, 
  Send, 
  Sparkles, 
  Award, 
  Activity, 
  CheckCircle2,
  TrendingUp,
  BatteryCharging
} from 'lucide-react';

interface TimelineAnalyticsHUDProps {
  selectedDate: string;
  slices: DaySlice24[];
  metrics: DayBreakdown24Metrics;
  synthesis: DailyLifeSynthesis;
}

export const TimelineAnalyticsHUD: React.FC<TimelineAnalyticsHUDProps> = ({
  selectedDate,
  slices,
  metrics,
  synthesis
}) => {
  const { 
    bufferCategories, 
    addQuickDiaryEntry 
  } = useApp();

  // Quick Composer State
  const [diaryText, setDiaryText] = useState('');
  const [diaryStartTime, setDiaryStartTime] = useState<string>(getCurrentRoundedTime12Hour(15));
  const [diaryDuration, setDiaryDuration] = useState<number>(15);
  const [diaryTag, setDiaryTag] = useState<string>('Coffee / Tea');
  const [diarySNOverride, setDiarySNOverride] = useState<SignalNoiseType | null>(null);
  const [diaryEnergy, setDiaryEnergy] = useState<number>(4);
  const [isComposerExpanded, setIsComposerExpanded] = useState(true);
  const [isSynthesisExpanded, setIsSynthesisExpanded] = useState(true);

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

  const handleSaveDiary = (e?: React.FormEvent) => {
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

    setDiaryText('');
    setDiarySNOverride(null);
    setDiaryStartTime(getCurrentRoundedTime12Hour(15));
  };

  // 24 Hourly Flow Rhythm calculation (0 to 23 hours)
  const hourlyActivity = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => {
      const hStart = h * 60;
      const hEnd = (h + 1) * 60;
      // Find slices overlapping this hour
      const overlapping = slices.filter(s => s.startMinute < hEnd && s.endMinute > hStart);
      
      let dominantType: 'work' | 'buffer' | 'sleep' | 'gap' = 'gap';
      if (overlapping.some(s => s.type.startsWith('work_'))) dominantType = 'work';
      else if (overlapping.some(s => s.type === 'buffer_note' || s.type === 'task_buffer')) dominantType = 'buffer';
      else if (overlapping.some(s => s.type === 'sleep')) dominantType = 'sleep';

      return {
        hour: h,
        label: h === 0 ? '12A' : h === 12 ? '12P' : h > 12 ? `${h - 12}P` : `${h}A`,
        type: dominantType
      };
    });
    return hours;
  }, [slices]);

  // Donut Ring calculations (percentages of 1440 min)
  const workPct = Math.round((metrics.workMinutes / 1440) * 100);
  const sleepPct = Math.round((metrics.sleepMinutes / 1440) * 100);
  const bufferPct = Math.round(((metrics.bufferLoggedMinutes + metrics.scheduledBufferMinutes) / 1440) * 100);
  const gapPct = Math.max(0, 100 - (workPct + sleepPct + bufferPct));

  return (
    <div className="space-y-4">
      
      {/* CARD 1: Executive Circadian Telemetry & Donut Breakdown */}
      <div className="glass-panel p-5 rounded-3xl border border-theme-border shadow-xs space-y-4 bg-gradient-to-br from-theme-card via-theme-card to-blue-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-theme-text font-display">
              Circadian 24-Hour Telemetry
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-theme-muted bg-theme-card px-2 py-0.5 rounded-md border border-theme-border">
            1,440m Total
          </span>
        </div>

        {/* Circular Progress & Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Signal Ratio */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="text-[10px] font-black uppercase tracking-wider">Signal Output</span>
              <Flame className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-theme-text font-display">
                {metrics.signalRatio}%
              </span>
              <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                ({metrics.snrMultiplier}x)
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${metrics.signalRatio}%` }}
              />
            </div>
            <span className="text-[10px] text-theme-muted block pt-0.5">
              {Math.floor(metrics.signalMinutes / 60)}h {metrics.signalMinutes % 60}m High-Leverage
            </span>
          </div>

          {/* Accountability */}
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
              <span className="text-[10px] font-black uppercase tracking-wider">Accountability</span>
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-theme-text font-display">
                {metrics.accountabilityScore}%
              </span>
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                Score
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-500"
                style={{ width: `${metrics.accountabilityScore}%` }}
              />
            </div>
            <span className="text-[10px] text-theme-muted block pt-0.5">
              {1440 - metrics.unaccountedMinutes}m of 1,440m Tracked
            </span>
          </div>
        </div>

        {/* 24-Hour Breakdown Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-theme-muted">
            <span>24-Hour Distribution</span>
            <span className="font-mono text-[10px]">{metrics.unaccountedMinutes}m Unaccounted Void</span>
          </div>

          <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800 border border-theme-border/60">
            <div 
              style={{ width: `${workPct}%` }} 
              className="h-full bg-blue-600 transition-all duration-300"
              title={`Focus Work: ${workPct}% (${Math.floor(metrics.workMinutes / 60)}h ${metrics.workMinutes % 60}m)`}
            />
            <div 
              style={{ width: `${bufferPct}%` }} 
              className="h-full bg-amber-400 transition-all duration-300"
              title={`Buffers & Diary: ${bufferPct}%`}
            />
            <div 
              style={{ width: `${sleepPct}%` }} 
              className="h-full bg-indigo-600 transition-all duration-300"
              title={`Sleep & Rest: ${sleepPct}% (${Math.floor(metrics.sleepMinutes / 60)}h ${metrics.sleepMinutes % 60}m)`}
            />
            <div 
              style={{ width: `${gapPct}%` }} 
              className="h-full bg-slate-400 dark:bg-slate-600 transition-all duration-300"
              title={`Unaccounted: ${gapPct}%`}
            />
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-theme-muted pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              <span>Work: {Math.floor(metrics.workMinutes / 60)}h {metrics.workMinutes % 60}m ({workPct}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span>Buffers: {metrics.bufferLoggedMinutes + metrics.scheduledBufferMinutes}m ({bufferPct}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
              <span>Sleep: {Math.floor(metrics.sleepMinutes / 60)}h {metrics.sleepMinutes % 60}m ({sleepPct}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
              <span>Void Gaps: {metrics.unaccountedMinutes}m ({gapPct}%)</span>
            </div>
          </div>
        </div>

        {/* 24-Hour Hourly Flow Heat Ribbon (0h to 23h) */}
        <div className="pt-2 border-t border-theme-border/40 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-theme-muted">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-blue-500" />
              Hourly Flow Rhythm (0h → 23h)
            </span>
            <span className="text-[10px] font-mono">Circadian Density</span>
          </div>

          <div className="grid grid-cols-12 gap-1">
            {hourlyActivity.map((ha) => {
              let bg = 'bg-slate-200 dark:bg-slate-800';
              if (ha.type === 'work') bg = 'bg-blue-500';
              else if (ha.type === 'buffer') bg = 'bg-amber-400';
              else if (ha.type === 'sleep') bg = 'bg-indigo-600';

              return (
                <div
                  key={ha.hour}
                  className={`h-4 rounded-sm ${bg} transition-all relative group cursor-pointer`}
                  title={`Hour ${ha.label}: ${ha.type.toUpperCase()}`}
                />
              );
            })}
          </div>

          <div className="flex justify-between text-[9px] font-mono text-theme-muted px-0.5">
            <span>12A</span>
            <span>06A</span>
            <span>12P</span>
            <span>06P</span>
            <span>11P</span>
          </div>
        </div>
      </div>

      {/* CARD 2: Quick Life Diary Micro-Composer (Inline Instant Entry) */}
      <div className="glass-panel p-5 rounded-3xl border border-theme-border shadow-xs space-y-3 bg-gradient-to-br from-amber-500/5 via-theme-card to-emerald-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <h3 className="text-xs font-black uppercase tracking-wider text-theme-text font-display">
              ⚡ Quick Life Diary Log
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setIsComposerExpanded(!isComposerExpanded)}
            className="text-theme-muted hover:text-theme-text p-1 rounded-lg transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isComposerExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {isComposerExpanded && (
          <form onSubmit={handleSaveDiary} className="space-y-3 pt-1">
            <input
              type="text"
              value={diaryText}
              onChange={(e) => setDiaryText(e.target.value)}
              placeholder="What did you just do? (e.g. Read 15 pages, gym, tea...)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-theme-card border border-theme-border text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-amber-500/40 shadow-inner"
            />

            {/* Time & Duration Controls */}
            <div className="flex items-center gap-2">
              <div className="w-28 shrink-0">
                <TimePicker
                  value={diaryStartTime}
                  onChange={(val) => setDiaryStartTime(val)}
                />
              </div>

              {/* Quick Duration Pills */}
              <div className="flex items-center gap-1 bg-theme-card p-1 rounded-xl border border-theme-border flex-1 justify-around">
                {[10, 15, 30, 45, 60].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDiaryDuration(mins)}
                    className={`px-1.5 py-0.5 rounded-lg text-[10px] font-black transition-all ${
                      diaryDuration === mins
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-theme-muted hover:text-theme-text'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Category & Energy */}
            <div className="flex items-center gap-2">
              <select
                value={diaryTag}
                onChange={(e) => setDiaryTag(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-xs font-bold text-theme-text focus:outline-none cursor-pointer"
              >
                {bufferCategories.map(cat => (
                  <option key={cat.id} value={cat.label}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>

              {/* Energy Level Selector */}
              <div className="flex items-center gap-0.5 bg-theme-card px-2 py-1 rounded-xl border border-theme-border">
                {[1, 2, 3, 4, 5].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDiaryEnergy(lvl)}
                    className={`text-xs p-0.5 transition-transform ${
                      diaryEnergy >= lvl ? 'text-amber-500 scale-110' : 'text-slate-300 dark:text-slate-700'
                    }`}
                    title={`Energy Level ${lvl}/5`}
                  >
                    ⚡
                  </button>
                ))}
              </div>
            </div>

            {/* Signal/Noise classification & Save */}
            <div className="flex items-center justify-between pt-1 border-t border-theme-border/40 gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = composerAutoSN.type === 'signal' ? 'noise' : 'signal';
                  setDiarySNOverride(next);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black transition-all ${
                  composerAutoSN.type === 'signal'
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                    : 'bg-rose-500 text-white shadow-rose-500/20'
                }`}
                title="Click to toggle Signal vs Noise"
              >
                <span>{composerAutoSN.type === 'signal' ? '🎯 SIGNAL' : '⚠️ NOISE'}</span>
              </button>

              <button
                type="submit"
                disabled={!diaryText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-emerald-500 to-blue-600 hover:from-amber-600 hover:to-blue-700 disabled:opacity-40 text-white text-xs font-black shadow-xs transition-all active:scale-95"
              >
                <Send className="w-3 h-3" />
                <span>Save to Diary</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* CARD 3: Daily AI Life Synthesis & Strategic Advice */}
      <div className="glass-panel p-5 rounded-3xl border border-theme-border shadow-xs space-y-3 bg-gradient-to-br from-blue-500/5 via-theme-card to-emerald-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-theme-text font-display">
              Daily AI Life Synthesis
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setIsSynthesisExpanded(!isSynthesisExpanded)}
            className="text-theme-muted hover:text-theme-text p-1 rounded-lg transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSynthesisExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {isSynthesisExpanded && (
          <div className="space-y-3 text-xs pt-1">
            <p className={`font-bold text-xs ${synthesis.verdictColor}`}>
              {synthesis.headline}
            </p>
            <p className="text-theme-muted font-medium leading-relaxed text-[11px]">
              {synthesis.reflectionSummary}
            </p>

            {/* Key Wins */}
            {synthesis.keySignalWins.length > 0 && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Key Signal Accomplishments
                </span>
                <ul className="space-y-1 text-[11px] text-theme-muted">
                  {synthesis.keySignalWins.slice(0, 3).map((w: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-emerald-500 font-bold shrink-0">🎯</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Strategic Advice */}
            <div className="p-3 rounded-2xl bg-theme-card border border-theme-border flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-theme-muted">
                <span className="font-bold text-theme-text">Strategic Advice: </span>
                {synthesis.recommendation}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
