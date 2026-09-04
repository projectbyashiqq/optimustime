import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PriorityLevel, LifeEventType, LifeEventLog, Task } from '../types';
import { toISODateString, formatMinutesTo12Hour, getBufferActivityEmoji } from '../utils/timeUtils';
import { detectSignalVsNoise } from '../utils/signalNoiseUtils';
import { 
  BarChart3, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Flame, 
  Target, 
  Zap, 
  ShieldCheck, 
  AlertTriangle, 
  Award,
  Calendar,
  Filter,
  Search,
  Download,
  Trash2,
  RotateCcw,
  Plus,
  Play,
  Pause,
  XCircle,
  FileSpreadsheet,
  FileJson,
  Layers,
  ArrowRight,
  Activity,
  History,
  Check,
  Coffee,
  Sparkles,
  Compass,
  PieChart,
  Gauge,
  CheckCheck,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Sliders,
  Shield,
  Brain,
  ChevronRight
} from 'lucide-react';

type TimeHorizon = '1D' | '7D' | '30D' | '365D' | 'ALL';
type AnalyticsTab = 'matrix' | 'variance' | 'directives' | 'ledger';

export const AnalyticsView: React.FC = () => {
  const { 
    tasks, 
    categories, 
    prioritySettings, 
    capacitySettings, 
    auditLogs, 
    clearAuditLogs,
    bufferNotes
  } = useApp();

  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('7D');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('matrix');
  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [logPriorityFilter, setLogPriorityFilter] = useState<string>('ALL');
  const [logSearch, setLogSearch] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const now = new Date();
  const todayStr = toISODateString(now);

  // Compute date threshold for time horizon
  const horizonStartDateStr = useMemo(() => {
    if (timeHorizon === 'ALL') return '1970-01-01';
    const target = new Date();
    if (timeHorizon === '1D') {
      return todayStr;
    } else if (timeHorizon === '7D') {
      target.setDate(target.getDate() - 7);
    } else if (timeHorizon === '30D') {
      target.setDate(target.getDate() - 30);
    } else if (timeHorizon === '365D') {
      target.setDate(target.getDate() - 365);
    }
    return toISODateString(target);
  }, [timeHorizon, todayStr]);

  // Tasks in selected horizon
  const horizonTasks = useMemo(() => {
    return tasks.filter(t => t.taskDate >= horizonStartDateStr && t.taskDate <= todayStr);
  }, [tasks, horizonStartDateStr, todayStr]);

  // Buffer notes in selected horizon
  const horizonBufferNotes = useMemo(() => {
    return bufferNotes.filter(n => n.date >= horizonStartDateStr && n.date <= todayStr);
  }, [bufferNotes, horizonStartDateStr, todayStr]);

  // Total metrics
  const totalTasks = horizonTasks.length;
  const completedTasks = horizonTasks.filter(t => t.status === 'Done').length;
  const incompleteTasks = horizonTasks.filter(t => t.status === 'Incomplete').length;
  const rescheduledTasks = horizonTasks.filter(t => t.status === 'Reschedule').length;
  const terminatedTasks = horizonTasks.filter(t => t.status === 'Terminated').length;
  const workingTasks = horizonTasks.filter(t => t.status === 'Working').length;
  const pendingTasks = horizonTasks.filter(t => t.status === 'Pending').length;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // On-time vs delayed deliverables analysis
  const executedTasks = horizonTasks.filter(t => t.status === 'Done' && t.totalActualMinutes > 0);
  const delayedDeliveries = executedTasks.filter(t => t.totalActualMinutes > t.appointedMinutes).length;
  const onTimeDeliveries = executedTasks.length - delayedDeliveries;
  const onTimeRate = executedTasks.length > 0 
    ? Math.round((onTimeDeliveries / executedTasks.length) * 100) 
    : 100;

  // Actual vs Projected time calculation
  const totalAppointedMinutes = horizonTasks.reduce((acc, t) => acc + (t.appointedMinutes || 0), 0);
  const totalActualMinutes = executedTasks.reduce((acc, t) => acc + t.totalActualMinutes, 0);
  const totalProjectedMinutesExecuted = executedTasks.reduce((acc, t) => acc + t.appointedMinutes, 0);

  const accuracyRate = totalProjectedMinutesExecuted > 0
    ? Math.max(0, Math.min(100, Math.round(100 - (Math.abs(totalActualMinutes - totalProjectedMinutesExecuted) / totalProjectedMinutesExecuted) * 100)))
    : 95;

  // Estimation calibration: On-Target vs Under-estimated vs Over-estimated
  const estimationCalibration = useMemo(() => {
    let onTarget = 0;
    let underEstimated = 0; // took longer than appointed (> 15m)
    let overEstimated = 0;  // took less than appointed (< -15m)

    executedTasks.forEach(t => {
      const diff = t.totalActualMinutes - t.appointedMinutes;
      if (Math.abs(diff) <= 15) {
        onTarget++;
      } else if (diff > 15) {
        underEstimated++;
      } else {
        overEstimated++;
      }
    });

    const total = executedTasks.length || 1;
    return {
      onTarget,
      onTargetPct: Math.round((onTarget / total) * 100),
      underEstimated,
      underEstimatedPct: Math.round((underEstimated / total) * 100),
      overEstimated,
      overEstimatedPct: Math.round((overEstimated / total) * 100),
      totalExecuted: executedTasks.length
    };
  }, [executedTasks]);

  // Signal vs Noise Detection across Horizon Tasks & Buffer Notes
  const signalNoiseAnalysis = useMemo(() => {
    let signalCount = 0;
    let noiseCount = 0;
    let signalMinutes = 0;
    let noiseMinutes = 0;

    horizonTasks.forEach(t => {
      const c = detectSignalVsNoise({
        title: t.title,
        notes: t.description,
        category: t.category,
        priority: t.priority
      });
      const mins = t.totalActualMinutes > 0 ? t.totalActualMinutes : (t.appointedMinutes || 60);
      if (c.type === 'signal') {
        signalCount++;
        signalMinutes += mins;
      } else {
        noiseCount++;
        noiseMinutes += mins;
      }
    });

    horizonBufferNotes.forEach(b => {
      const c = detectSignalVsNoise({
        title: b.activityTag || b.relatedTaskTitle || 'Buffer Activity',
        notes: b.notes,
        tag: b.activityTag,
        sliceType: 'buffer_note',
        explicitType: b.signalNoise
      });
      const mins = b.durationMinutes || 15;
      if (c.type === 'signal') {
        signalCount++;
        signalMinutes += mins;
      } else {
        noiseCount++;
        noiseMinutes += mins;
      }
    });

    const totalItems = signalCount + noiseCount;
    const signalPercent = totalItems > 0 ? Math.round((signalCount / totalItems) * 100) : 92;

    return {
      signalCount,
      noiseCount,
      signalMinutes,
      noiseMinutes,
      signalPercent
    };
  }, [horizonTasks, horizonBufferNotes]);

  // High-leverage P1/P2 Throughput Focus
  const p1P2Focus = useMemo(() => {
    const highLeverage = horizonTasks.filter(t => t.priority === 'P1' || t.priority === 'P2');
    const highLeverageMins = highLeverage.reduce((acc, t) => acc + (t.appointedMinutes || 0), 0);
    const ratio = totalAppointedMinutes > 0 
      ? Math.round((highLeverageMins / totalAppointedMinutes) * 100) 
      : 0;
    const completedHigh = highLeverage.filter(t => t.status === 'Done').length;
    return {
      count: highLeverage.length,
      completed: completedHigh,
      ratio,
      minutes: highLeverageMins
    };
  }, [horizonTasks, totalAppointedMinutes]);

  // Category Distribution Analysis
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; minutes: number; doneCount: number }>();

    horizonTasks.forEach(t => {
      const cat = t.category || 'Unknown';
      const cur = map.get(cat) || { count: 0, minutes: 0, doneCount: 0 };
      cur.count += 1;
      cur.minutes += (t.appointedMinutes || 0);
      if (t.status === 'Done') cur.doneCount += 1;
      map.set(cat, cur);
    });

    const list = Array.from(map.entries()).map(([name, data]) => {
      const catMeta = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
      const sharePct = totalAppointedMinutes > 0 ? Math.round((data.minutes / totalAppointedMinutes) * 100) : 0;
      const donePct = data.count > 0 ? Math.round((data.doneCount / data.count) * 100) : 0;
      return {
        name,
        color: catMeta?.color || '#3b82f6',
        ...data,
        sharePct,
        donePct
      };
    });

    return list.sort((a, b) => b.minutes - a.minutes);
  }, [horizonTasks, categories, totalAppointedMinutes]);

  // Master Life Executive Score (0 - 100)
  const masterScore = useMemo(() => {
    if (totalTasks === 0) return 94; // Baseline default
    const compWeight = completionRate * 0.35;
    const onTimeWeight = onTimeRate * 0.25;
    const accuracyWeight = accuracyRate * 0.20;
    const signalWeight = signalNoiseAnalysis.signalPercent * 0.20;
    return Math.min(100, Math.max(10, Math.round(compWeight + onTimeWeight + accuracyWeight + signalWeight)));
  }, [totalTasks, completionRate, onTimeRate, accuracyRate, signalNoiseAnalysis.signalPercent]);

  // Executive Status Level
  const executiveStatus = useMemo(() => {
    if (masterScore >= 90) return { label: 'Peak Flow State', badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', icon: Award };
    if (masterScore >= 75) return { label: 'High Velocity Execution', badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30', icon: Zap };
    if (masterScore >= 60) return { label: 'Balanced Capacity', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30', icon: Gauge };
    return { label: 'Capacity Drift Alert', badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30', icon: AlertTriangle };
  }, [masterScore]);

  // Horizon Day Count
  const horizonDays = useMemo(() => {
    if (timeHorizon === '1D') return 1;
    if (timeHorizon === '7D') return 7;
    if (timeHorizon === '30D') return 30;
    if (timeHorizon === '365D') return 365;
    return 30;
  }, [timeHorizon]);

  const dailyAvgWorkHours = useMemo(() => {
    return (totalAppointedMinutes / 60 / horizonDays).toFixed(1);
  }, [totalAppointedMinutes, horizonDays]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (timeHorizon !== 'ALL' && log.date < horizonStartDateStr) return false;
      if (logFilter !== 'ALL' && log.eventType !== logFilter) return false;
      if (logPriorityFilter !== 'ALL' && log.priority !== logPriorityFilter) return false;
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase();
        const matchMsg = log.message.toLowerCase().includes(q);
        const matchTitle = log.taskTitle?.toLowerCase().includes(q);
        const matchCode = log.projectCode?.toLowerCase().includes(q);
        const matchCat = log.category?.toLowerCase().includes(q);
        if (!matchMsg && !matchTitle && !matchCode && !matchCat) return false;
      }
      return true;
    });
  }, [auditLogs, timeHorizon, horizonStartDateStr, logFilter, logPriorityFilter, logSearch]);

  // Export audit logs to JSON
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `optimustime_audit_logs_${todayStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export audit logs to CSV
  const handleExportCsv = () => {
    if (auditLogs.length === 0) return;
    const headers = ["Timestamp", "Date", "EventType", "ProjectCode", "Priority", "Category", "TaskTitle", "Message", "DurationMinutes", "DelayMinutes"];
    const rows = auditLogs.map(l => [
      `"${l.timestamp}"`,
      `"${l.date}"`,
      `"${l.eventType}"`,
      `"${l.projectCode || ''}"`,
      `"${l.priority || ''}"`,
      `"${l.category || ''}"`,
      `"${(l.taskTitle || '').replace(/"/g, '""')}"`,
      `"${(l.message || '').replace(/"/g, '""')}"`,
      l.details?.durationMinutes ?? '',
      l.details?.delayMinutes ?? ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `optimustime_audit_ledger_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getEventBadge = (type: LifeEventType) => {
    switch (type) {
      case 'TASK_COMPLETED':
        return <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> DONE</span>;
      case 'TASK_DELAYED':
        return <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1"><Clock className="w-3 h-3" /> DELAYED</span>;
      case 'TASK_RESCHEDULED':
        return <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> RESCHEDULED</span>;
      case 'TASK_INCOMPLETE':
        return <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> INCOMPLETE</span>;
      case 'TASK_STARTED':
        return <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1"><Play className="w-3 h-3" /> STARTED</span>;
      case 'TASK_PAUSED':
        return <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30 flex items-center gap-1"><Pause className="w-3 h-3" /> PAUSED</span>;
      case 'TASK_TERMINATED':
        return <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1"><XCircle className="w-3 h-3" /> TERMINATED</span>;
      case 'TASK_CREATED':
        return <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center gap-1"><Plus className="w-3 h-3" /> CREATED</span>;
      case 'BUFFER_NOTE_LOGGED':
        return <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1"><Coffee className="w-3 h-3" /> BUFFER NOTE</span>;
      case 'BUFFER_NOTE_DELETED':
        return <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1"><Trash2 className="w-3 h-3" /> BUFFER DELETED</span>;
      default:
        return <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">{type}</span>;
    }
  };

  const StatusIcon = executiveStatus.icon;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      
      {/* =========================================================================
          1. APPLE-GRADE EXECUTIVE TELEMETRY HERO & ACTIVITY RING GAUGES
      ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-theme-card via-theme-card/90 to-blue-500/5 border border-theme-border/80 p-6 sm:p-8 shadow-xl backdrop-blur-xl">
        
        {/* Ambient Glow Orbs */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 right-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          
          {/* Left Column: Title, Subtitle, Apple Master Score & Telemetry Badges */}
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
                Apple-Grade Life Intelligence
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border shadow-xs ${executiveStatus.badge}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {executiveStatus.label}
              </span>
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-theme-card-hover border border-theme-border text-theme-muted">
                {auditLogs.length} Verified Events
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-theme-text tracking-tight font-display">
                Executive Life Analytics & Flow Telemetry
              </h1>
              <p className="text-xs sm:text-sm text-theme-muted mt-1 leading-relaxed">
                Chronological ledger integrity, P1–P5 matrix adherence, time-boxing precision, and circadian capacity guardrails.
              </p>
            </div>

            {/* Quick Metrics Bar Under Header */}
            <div className="flex items-center gap-4 pt-1 text-xs text-theme-muted flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Completion: <strong className="text-theme-text font-mono font-bold">{completionRate}%</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>On-Time: <strong className="text-theme-text font-mono font-bold">{onTimeRate}%</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <span>Signal: <strong className="text-theme-text font-mono font-bold">{signalNoiseAnalysis.signalPercent}%</strong></span>
              </div>
            </div>
          </div>

          {/* Right Column: Triple Activity Rings (Apple Fitness Style) & Master Life Efficiency Score */}
          <div className="flex items-center gap-6 self-center lg:self-auto shrink-0 bg-theme-card/80 p-4 sm:p-5 rounded-2xl border border-theme-border/60 backdrop-blur-md shadow-lg">
            
            {/* SVG Triple Ring Gauge */}
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                {/* Background tracks */}
                <circle cx="60" cy="60" r="48" fill="transparent" stroke="currentColor" strokeWidth="9" className="text-slate-200 dark:text-slate-800 opacity-60" />
                <circle cx="60" cy="60" r="36" fill="transparent" stroke="currentColor" strokeWidth="9" className="text-slate-200 dark:text-slate-800 opacity-60" />
                <circle cx="60" cy="60" r="24" fill="transparent" stroke="currentColor" strokeWidth="9" className="text-slate-200 dark:text-slate-800 opacity-60" />

                {/* Outer Ring: Completion (Cyan / Emerald) */}
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 48}`}
                  strokeDashoffset={`${2 * Math.PI * 48 * (1 - completionRate / 100)}`}
                  className="transition-all duration-1000 ease-out"
                />

                {/* Middle Ring: Signal Purity (Indigo / Violet) */}
                <circle
                  cx="60"
                  cy="60"
                  r="36"
                  fill="transparent"
                  stroke="#6366f1"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 36}`}
                  strokeDashoffset={`${2 * Math.PI * 36 * (1 - signalNoiseAnalysis.signalPercent / 100)}`}
                  className="transition-all duration-1000 ease-out"
                />

                {/* Inner Ring: Precision / Accuracy (Amber / Orange) */}
                <circle
                  cx="60"
                  cy="60"
                  r="24"
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - onTimeRate / 100)}`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>

              {/* Centered Score */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black font-display text-theme-text leading-none">
                  {masterScore}
                </span>
                <span className="text-[9px] font-bold text-theme-muted uppercase tracking-tighter">
                  Index
                </span>
              </div>
            </div>

            {/* Ring Legend & Master Details */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
                <span className="text-theme-muted">Deliveries:</span>
                <span className="font-mono font-bold text-theme-text ml-auto">{completionRate}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-xs" />
                <span className="text-theme-muted">Signal Purity:</span>
                <span className="font-mono font-bold text-theme-text ml-auto">{signalNoiseAnalysis.signalPercent}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
                <span className="text-theme-muted">On-Time Accuracy:</span>
                <span className="font-mono font-bold text-theme-text ml-auto">{onTimeRate}%</span>
              </div>
            </div>

          </div>

        </div>

        {/* Global Horizon Selector Segment */}
        <div className="mt-6 pt-5 border-t border-theme-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-theme-muted">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <span>Time Horizon: <strong className="text-theme-text">{timeHorizon === '1D' ? 'Today' : timeHorizon === '7D' ? 'Past 7 Days' : timeHorizon === '30D' ? 'Past 30 Days' : timeHorizon === '365D' ? 'Past Year' : 'All-Time'}</strong></span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-theme-card-hover/80 rounded-xl border border-theme-border text-xs font-bold shrink-0">
            {(['1D', '7D', '30D', '365D', 'ALL'] as TimeHorizon[]).map((horizon) => {
              const label = horizon === '1D' ? '1 Day' : horizon === '7D' ? '7 Days' : horizon === '30D' ? '30 Days' : horizon === '365D' ? '1 Year' : 'All Time';
              const isActive = timeHorizon === horizon;
              return (
                <button
                  key={horizon}
                  onClick={() => setTimeHorizon(horizon)}
                  className={`px-3 py-1.5 rounded-lg transition-all text-xs ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-xs font-black' 
                      : 'text-theme-muted hover:text-theme-text hover:bg-theme-card/60'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* =========================================================================
          2. FIVE APPLE-GRADE EXECUTIVE METRIC CARDS
      ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Execution Accuracy */}
        <div className="p-5 rounded-2xl bg-theme-card border border-theme-border hover:border-blue-400 transition-all space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">Execution Accuracy</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {accuracyRate}%
            </span>
            <span className="text-xs text-emerald-500 font-bold flex items-center">
              <ArrowUpRight className="w-3 h-3" />
              Calibrated
            </span>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${accuracyRate}%` }} />
            </div>
            <p className="text-[11px] text-theme-muted truncate">
              {estimationCalibration.onTargetPct}% on-target (±15m delta)
            </p>
          </div>
        </div>

        {/* Card 2: Deep Work & Focus Throughput */}
        <div className="p-5 rounded-2xl bg-theme-card border border-theme-border hover:border-indigo-400 transition-all space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">Deep Work Velocity</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {Math.round(totalAppointedMinutes / 60)}h
            </span>
            <span className="text-xs text-indigo-500 font-bold">
              {p1P2Focus.ratio}% P1/P2 Focus
            </span>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${p1P2Focus.ratio}%` }} />
            </div>
            <p className="text-[11px] text-theme-muted truncate">
              {totalTasks} slots scheduled in horizon
            </p>
          </div>
        </div>

        {/* Card 3: Signal Purity Index */}
        <div className="p-5 rounded-2xl bg-theme-card border border-theme-border hover:border-emerald-400 transition-all space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">Signal vs Noise Purity</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {signalNoiseAnalysis.signalPercent}%
            </span>
            <span className="text-xs text-emerald-500 font-bold">
              Pure Signal
            </span>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500" style={{ width: `${signalNoiseAnalysis.signalPercent}%` }} />
              <div className="h-full bg-rose-400" style={{ width: `${100 - signalNoiseAnalysis.signalPercent}%` }} />
            </div>
            <p className="text-[11px] text-theme-muted truncate">
              {signalNoiseAnalysis.signalCount} Signal items vs {signalNoiseAnalysis.noiseCount} Noise leaks
            </p>
          </div>
        </div>

        {/* Card 4: On-Time Delivery Rate */}
        <div className="p-5 rounded-2xl bg-theme-card border border-theme-border hover:border-amber-400 transition-all space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">On-Time Delivery</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {onTimeRate}%
            </span>
            <span className="text-xs text-theme-muted font-bold font-mono">
              {onTimeDeliveries}/{executedTasks.length || 1}
            </span>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${onTimeRate}%` }} />
            </div>
            <p className="text-[11px] text-theme-muted truncate">
              {delayedDeliveries} delay overruns absorbed
            </p>
          </div>
        </div>

        {/* Card 5: Circadian Life Balance Guard */}
        <div className="p-5 rounded-2xl bg-theme-card border border-theme-border hover:border-sky-400 transition-all space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-[11px] font-black uppercase tracking-wider">Daily Balance Cap</span>
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {dailyAvgWorkHours}h
            </span>
            <span className="text-xs text-theme-muted font-bold">
              / {capacitySettings.maxWorkHours}h Max
            </span>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${Number(dailyAvgWorkHours) > capacitySettings.maxWorkHours ? 'bg-rose-500' : 'bg-sky-500'}`} 
                style={{ width: `${Math.min(100, (Number(dailyAvgWorkHours) / (capacitySettings.maxWorkHours || 8)) * 100)}%` }} 
              />
            </div>
            <p className="text-[11px] text-theme-muted truncate">
              Guards {capacitySettings.sleepHours}h Sleep + {capacitySettings.bufferHours}h Buffer
            </p>
          </div>
        </div>

      </div>

      {/* =========================================================================
          3. APPLE-GRADE SEGMENTED CONTROL TABS
      ========================================================================= */}
      <div className="flex items-center gap-1.5 border-b border-theme-border/60 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'matrix'
              ? 'bg-blue-600 text-white shadow-xs font-black'
              : 'text-theme-muted hover:text-theme-text hover:bg-theme-card-hover'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Priority Matrix & Throughput</span>
        </button>

        <button
          onClick={() => setActiveTab('variance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'variance'
              ? 'bg-blue-600 text-white shadow-xs font-black'
              : 'text-theme-muted hover:text-theme-text hover:bg-theme-card-hover'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Time Variance & Flow Calibration</span>
        </button>

        <button
          onClick={() => setActiveTab('directives')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'directives'
              ? 'bg-blue-600 text-white shadow-xs font-black'
              : 'text-theme-muted hover:text-theme-text hover:bg-theme-card-hover'
          }`}
        >
          <Brain className="w-4 h-4 text-purple-400" />
          <span>AI Executive Directives</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'ledger'
              ? 'bg-blue-600 text-white shadow-xs font-black'
              : 'text-theme-muted hover:text-theme-text hover:bg-theme-card-hover'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Chronological Life Event Ledger ({auditLogs.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: PRIORITY MATRIX & CATEGORY THROUGHPUT
      ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Priority Matrix Adherence & Completion Throughput */}
            <div className="p-6 rounded-3xl bg-theme-card border border-theme-border space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-theme-text uppercase tracking-wider flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    Priority Matrix Throughput (P1 → P5)
                  </h3>
                  <p className="text-xs text-theme-muted">
                    Velocity and completion adherence categorized by Eisenhower urgency.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-theme-muted px-2.5 py-1 rounded-lg bg-theme-card-hover border border-theme-border">
                  {totalTasks} Total
                </span>
              </div>

              <div className="space-y-3">
                {(['P1', 'P2', 'P3', 'P4', 'P5'] as PriorityLevel[]).map((p) => {
                  const meta = prioritySettings[p];
                  const pTasks = horizonTasks.filter(t => t.priority === p);
                  const count = pTasks.length;
                  const doneCount = pTasks.filter(t => t.status === 'Done').length;
                  const incompleteCount = pTasks.filter(t => t.status === 'Incomplete').length;
                  const totalMins = pTasks.reduce((sum, t) => sum + (t.appointedMinutes || 0), 0);
                  const donePercent = count > 0 ? Math.round((doneCount / count) * 100) : 0;

                  return (
                    <div key={p} className="p-3.5 rounded-2xl bg-theme-card-hover/40 border border-theme-border/60 hover:border-theme-border transition-all space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2.5 py-0.5 rounded-md font-black text-[11px] shadow-xs"
                            style={{ backgroundColor: meta?.bgColor, color: meta?.color }}
                          >
                            {p}
                          </span>
                          <span className="text-theme-text font-bold">{meta?.label}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="text-emerald-600 dark:text-emerald-400 font-black">
                            {doneCount}/{count} Done ({donePercent}%)
                          </span>
                          {incompleteCount > 0 && (
                            <span className="text-rose-500 font-bold">
                              ({incompleteCount} Missed)
                            </span>
                          )}
                          <span className="text-theme-muted">
                            • {Math.round(totalMins / 60)}h ({totalMins}m)
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${donePercent}%`, backgroundColor: meta?.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Time-Share Distribution */}
            <div className="p-6 rounded-3xl bg-theme-card border border-theme-border space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-theme-text uppercase tracking-wider flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-blue-500" />
                    Category Time-Share Distribution
                  </h3>
                  <p className="text-xs text-theme-muted">
                    Proportion of lifetime scheduled and executed across active domains.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-theme-muted px-2.5 py-1 rounded-lg bg-theme-card-hover border border-theme-border">
                  {categoryBreakdown.length} Domains
                </span>
              </div>

              <div className="space-y-3">
                {categoryBreakdown.length === 0 ? (
                  <div className="p-12 text-center text-xs text-theme-muted border border-dashed border-theme-border rounded-2xl">
                    No category data available in this time horizon.
                  </div>
                ) : (
                  categoryBreakdown.map(cat => (
                    <div key={cat.name} className="p-3.5 rounded-2xl bg-theme-card-hover/40 border border-theme-border/60 hover:border-theme-border transition-all space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="font-bold text-theme-text">{cat.name}</span>
                          <span className="text-[10px] text-theme-muted font-mono">
                            ({cat.count} tasks)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="text-theme-text font-bold">
                            {Math.round(cat.minutes / 60)}h {cat.minutes % 60}m
                          </span>
                          <span className="text-blue-600 dark:text-blue-400 font-bold">
                            {cat.sharePct}%
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${cat.sharePct}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* 24-Hour Circadian Blueprint Banner */}
          <div className="p-6 rounded-3xl bg-theme-card border border-theme-border space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-theme-text uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-500" />
                  24-Hour Circadian Life Architecture Blueprint
                </h3>
                <p className="text-xs text-theme-muted">
                  Configured daily capacity thresholds protecting sleep, high-focus work, and restorative buffers.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 space-y-1 text-center">
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Productive Work Allocation</span>
                <span className="text-3xl font-black text-blue-600 dark:text-blue-300 font-display block">
                  {capacitySettings.maxWorkHours}h
                </span>
                <p className="text-[11px] text-theme-muted">Configured daily max work capacity</p>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 space-y-1 text-center">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Sleep Window Sanctuary</span>
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-300 font-display block">
                  {capacitySettings.sleepHours}h
                </span>
                <p className="text-[11px] text-theme-muted">Protected circadian rest cycle</p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1 text-center">
                <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Buffer & Leisure Reserve</span>
                <span className="text-3xl font-black text-amber-600 dark:text-amber-300 font-display block">
                  {capacitySettings.bufferHours}h
                </span>
                <p className="text-[11px] text-theme-muted">Unallocated slack & transition time</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          TAB 2: TIME VARIANCE & FLOW CALIBRATION
      ========================================================================= */}
      {activeTab === 'variance' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Estimation Calibration Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* On-Target */}
            <div className="p-5 rounded-3xl bg-theme-card border border-emerald-500/30 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">On-Target (±15m)</span>
                <CheckCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-theme-text font-display">
                  {estimationCalibration.onTargetPct}%
                </span>
                <span className="text-xs text-theme-muted font-mono font-bold">
                  {estimationCalibration.onTarget} tasks
                </span>
              </div>
              <p className="text-xs text-theme-muted">
                Completed within ±15 minutes of appointed time slot.
              </p>
            </div>

            {/* Under-Estimated (Overruns) */}
            <div className="p-5 rounded-3xl bg-theme-card border border-amber-500/30 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">Under-Estimated (&gt;15m Late)</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-theme-text font-display">
                  {estimationCalibration.underEstimatedPct}%
                </span>
                <span className="text-xs text-theme-muted font-mono font-bold">
                  {estimationCalibration.underEstimated} tasks
                </span>
              </div>
              <p className="text-xs text-theme-muted">
                Overran projected duration and required buffer absorption.
              </p>
            </div>

            {/* Over-Estimated (Early Finish) */}
            <div className="p-5 rounded-3xl bg-theme-card border border-blue-500/30 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">Over-Estimated (Early Finish)</span>
                <Zap className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-theme-text font-display">
                  {estimationCalibration.overEstimatedPct}%
                </span>
                <span className="text-xs text-theme-muted font-mono font-bold">
                  {estimationCalibration.overEstimated} tasks
                </span>
              </div>
              <p className="text-xs text-theme-muted">
                Finished faster than budgeted, yielding bonus free time.
              </p>
            </div>

          </div>

          {/* Task Lifecycle Status Matrix */}
          <div className="p-6 rounded-3xl bg-theme-card border border-theme-border space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-theme-text uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-500" />
                  Task Execution Health & Lifecycle Matrix
                </h3>
                <p className="text-xs text-theme-muted">
                  State breakdown across all deliverables within the active horizon.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-theme-muted">
                {totalTasks} Total Records
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <span>Completed</span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display">
                  {completedTasks}
                </span>
                <p className="text-[10px] text-theme-muted">{completionRate}% of deliverables</p>
              </div>

              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-300">
                  <span>Rescheduled</span>
                  <RotateCcw className="w-4 h-4" />
                </div>
                <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-display">
                  {rescheduledTasks}
                </span>
                <p className="text-[10px] text-theme-muted">Shifted downstream</p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-300">
                  <span>Incomplete</span>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-display">
                  {incompleteTasks}
                </span>
                <p className="text-[10px] text-theme-muted">Missed time slots</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-500/10 border border-slate-500/25 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Terminated</span>
                  <XCircle className="w-4 h-4" />
                </div>
                <span className="text-2xl font-black text-slate-600 dark:text-slate-400 font-display">
                  {terminatedTasks}
                </span>
                <p className="text-[10px] text-theme-muted">Purposely closed</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          TAB 3: AI EXECUTIVE LIFE SYNTHESIS & DIRECTIVES
      ========================================================================= */}
      {activeTab === 'directives' && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="p-6 rounded-3xl bg-theme-card border border-theme-border space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-theme-text tracking-tight">
                    Proactive Life Execution Directives
                  </h3>
                  <p className="text-xs text-theme-muted">
                    Automated intelligence generated from your chronological metrics and execution telemetry.
                  </p>
                </div>
              </div>
              <span className="text-xs px-3 py-1 rounded-full font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Live Analysis
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Directive 1: High-Leverage Flow */}
              <div className="p-4 rounded-2xl bg-theme-card-hover/40 border border-theme-border/60 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>High-Leverage Execution Ratio</span>
                </div>
                <p className="text-xs text-theme-text leading-relaxed">
                  {p1P2Focus.ratio >= 50
                    ? `Excellent strategic focus: ${p1P2Focus.ratio}% of your allocated schedule is invested directly in P1 and P2 high-impact deliverables.`
                    : `Focus calibration advised: Currently only ${p1P2Focus.ratio}% of appointed time is directed toward P1/P2 priorities. Aim for at least 60% high-leverage allocation.`}
                </p>
              </div>

              {/* Directive 2: Estimation Calibration */}
              <div className="p-4 rounded-2xl bg-theme-card-hover/40 border border-theme-border/60 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                  <Target className="w-4 h-4" />
                  <span>Time-Box Calibration Health</span>
                </div>
                <p className="text-xs text-theme-text leading-relaxed">
                  {estimationCalibration.underEstimatedPct > 25
                    ? `Warning on duration estimates: ${estimationCalibration.underEstimatedPct}% of completed tasks exceeded their scheduled window. Consider increasing default break buffers by +10m.`
                    : `Rock-solid estimation accuracy: ${estimationCalibration.onTargetPct}% of tasks completed squarely within ±15 minutes of budget.`}
                </p>
              </div>

              {/* Directive 3: Signal-to-Noise Purity */}
              <div className="p-4 rounded-2xl bg-theme-card-hover/40 border border-theme-border/60 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <Compass className="w-4 h-4" />
                  <span>Signal vs Distraction Purity</span>
                </div>
                <p className="text-xs text-theme-text leading-relaxed">
                  {signalNoiseAnalysis.signalPercent >= 85
                    ? `Your life efficiency purity index is ${signalNoiseAnalysis.signalPercent}%. Distractions and unaccounted leaks are minimal.`
                    : `Attention leak detected: ${100 - signalNoiseAnalysis.signalPercent}% of entries are classified as low-leverage or unlogged filler. Use the 24H Life Diary to account for gaps.`}
                </p>
              </div>

              {/* Directive 4: Circadian Capacity Guard */}
              <div className="p-4 rounded-2xl bg-theme-card-hover/40 border border-theme-border/60 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Circadian Red-Line Protection</span>
                </div>
                <p className="text-xs text-theme-text leading-relaxed">
                  {Number(dailyAvgWorkHours) <= capacitySettings.maxWorkHours
                    ? `Optimal circadian protection: Daily average of ${dailyAvgWorkHours}h work respects your ${capacitySettings.maxWorkHours}h cap, guaranteeing ${capacitySettings.sleepHours}h of restful sleep.`
                    : `Over-capacity warning: Average of ${dailyAvgWorkHours}h work per day exceeds your ${capacitySettings.maxWorkHours}h limit, risking burnout and sleep debt.`}
                </p>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          TAB 4: CHRONOLOGICAL LIFE EVENT AUDIT LEDGER
      ========================================================================= */}
      {activeTab === 'ledger' && (
        <div className="p-6 rounded-3xl bg-theme-card border border-theme-border space-y-4 shadow-xs animate-fade-in">
          
          {/* Ledger Header & Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-theme-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-theme-text">
                  Chronological Life Event Audit Ledger
                </h3>
                <p className="text-xs text-theme-muted">
                  Immutable chronological record of task creation, execution, pauses, completions, and reschedules.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card-hover border border-theme-border hover:bg-theme-border text-theme-text text-xs font-bold rounded-xl transition-all shadow-xs"
                title="Export Audit Ledger as CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card-hover border border-theme-border hover:bg-theme-border text-theme-text text-xs font-bold rounded-xl transition-all shadow-xs"
                title="Export Audit Ledger as JSON"
              >
                <FileJson className="w-4 h-4 text-blue-500" />
                <span>Export JSON</span>
              </button>

              {showClearConfirm ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      clearAuditLogs();
                      setShowClearConfirm(false);
                    }}
                    className="px-2.5 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 shadow-xs"
                  >
                    Confirm Clear
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-1.5 text-xs text-theme-muted hover:text-theme-text"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="p-1.5 text-theme-muted hover:text-rose-500 rounded-xl transition-colors"
                  title="Clear Audit History"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Ledger Filters & Search */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            
            {/* Event Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
              <button
                onClick={() => setLogFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  logFilter === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                }`}
              >
                All Events ({auditLogs.length})
              </button>
              <button
                onClick={() => setLogFilter('TASK_COMPLETED')}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  logFilter === 'TASK_COMPLETED' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setLogFilter('TASK_DELAYED')}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  logFilter === 'TASK_DELAYED' ? 'bg-amber-600 text-white shadow-xs' : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                }`}
              >
                Delayed
              </button>
              <button
                onClick={() => setLogFilter('TASK_RESCHEDULED')}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  logFilter === 'TASK_RESCHEDULED' ? 'bg-purple-600 text-white shadow-xs' : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                }`}
              >
                Rescheduled
              </button>
              <button
                onClick={() => setLogFilter('TASK_INCOMPLETE')}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  logFilter === 'TASK_INCOMPLETE' ? 'bg-rose-600 text-white shadow-xs' : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                }`}
              >
                Incomplete
              </button>
              <button
                onClick={() => setLogFilter('TASK_CREATED')}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  logFilter === 'TASK_CREATED' ? 'bg-sky-600 text-white shadow-xs' : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                }`}
              >
                Created
              </button>
              <button
                onClick={() => setLogFilter('BUFFER_NOTE_LOGGED')}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1 ${
                  logFilter === 'BUFFER_NOTE_LOGGED' ? 'bg-amber-600 text-white shadow-xs' : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                }`}
              >
                <Coffee className="w-3 h-3" />
                <span>Buffer Notes</span>
              </button>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-theme-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search audit logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Ledger Event List */}
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {filteredAuditLogs.length === 0 ? (
              <div className="p-12 text-center text-xs text-theme-muted border border-dashed border-theme-border rounded-2xl">
                No audit logs match the current filters.
              </div>
            ) : (
              filteredAuditLogs.map((log) => {
                const logDate = new Date(log.timestamp);
                const timeStr = logDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

                return (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl border bg-theme-card border-theme-border hover:border-blue-400/60 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs shadow-xs"
                  >
                    <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0 flex-wrap">
                      
                      {/* Timestamp */}
                      <span className="font-mono text-[11px] text-theme-muted shrink-0 bg-theme-card-hover px-2 py-0.5 rounded-md border border-theme-border">
                        {log.date} {timeStr}
                      </span>

                      {/* Event Badge */}
                      <div className="shrink-0">
                        {getEventBadge(log.eventType)}
                      </div>

                      {/* Priority & Project Code */}
                      {log.priority && (
                        <span className="font-black text-[10px] px-2 py-0.5 rounded-md bg-theme-card-hover text-theme-text shrink-0 border border-theme-border">
                          {log.priority}
                        </span>
                      )}

                      {log.projectCode && (
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-[11px] shrink-0">
                          {log.projectCode}
                        </span>
                      )}

                      {/* Message */}
                      <span className="text-theme-text font-medium truncate flex-1 min-w-[200px]">
                        {log.message}
                      </span>
                    </div>

                    {/* Right Detail Tag */}
                    {log.details?.delayMinutes !== undefined && log.details.delayMinutes > 0 && (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0">
                        +{log.details.delayMinutes}m Overtime
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

    </div>
  );
};
