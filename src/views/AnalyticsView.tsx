import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PriorityLevel, LifeEventType, LifeEventLog, Task } from '../types';
import { toISODateString } from '../utils/timeUtils';
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
  Check
} from 'lucide-react';

type TimeHorizon = '1D' | '7D' | '30D' | '365D' | 'ALL';

export const AnalyticsView: React.FC = () => {
  const { 
    tasks, 
    categories, 
    prioritySettings, 
    capacitySettings, 
    auditLogs, 
    clearAuditLogs 
  } = useApp();

  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('7D');
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

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      // Horizon filter
      if (timeHorizon !== 'ALL' && log.date < horizonStartDateStr) {
        return false;
      }
      // Event type filter
      if (logFilter !== 'ALL' && log.eventType !== logFilter) {
        return false;
      }
      // Priority filter
      if (logPriorityFilter !== 'ALL' && log.priority !== logPriorityFilter) {
        return false;
      }
      // Search filter
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
        return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> DONE</span>;
      case 'TASK_DELAYED':
        return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center gap-1"><Clock className="w-3 h-3" /> DELAYED</span>;
      case 'TASK_RESCHEDULED':
        return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> RESCHEDULED</span>;
      case 'TASK_INCOMPLETE':
        return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> INCOMPLETE</span>;
      case 'TASK_STARTED':
        return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center gap-1"><Play className="w-3 h-3" /> STARTED</span>;
      case 'TASK_PAUSED':
        return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1"><Pause className="w-3 h-3" /> PAUSED</span>;
      case 'TASK_TERMINATED':
        return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 flex items-center gap-1"><XCircle className="w-3 h-3" /> TERMINATED</span>;
      case 'TASK_CREATED':
        return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center gap-1"><Plus className="w-3 h-3" /> CREATED</span>;
      default:
        return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{type}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner Header */}
      <div className="glass-panel p-6 rounded-2xl border border-theme-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-theme-text tracking-tight font-display">
                Unified Life Analytics & Execution Accuracy
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                {auditLogs.length} Events Logged
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                {accuracyRate}% Precision
              </span>
            </div>
            <p className="text-xs text-theme-muted mt-0.5">
              Comprehensive 24h life tracking, chronological event ledger, P1–P5 matrix adherence, and delay diagnostics.
            </p>
          </div>
        </div>

        {/* Global Horizon Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-theme-card-hover rounded-xl border border-theme-border text-xs font-bold shrink-0">
          <button
            onClick={() => setTimeHorizon('1D')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              timeHorizon === '1D' ? 'bg-blue-600 text-white shadow-sm' : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            1 Day
          </button>
          <button
            onClick={() => setTimeHorizon('7D')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              timeHorizon === '7D' ? 'bg-blue-600 text-white shadow-sm' : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeHorizon('30D')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              timeHorizon === '30D' ? 'bg-blue-600 text-white shadow-sm' : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeHorizon('365D')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              timeHorizon === '365D' ? 'bg-blue-600 text-white shadow-sm' : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            1 Year
          </button>
          <button
            onClick={() => setTimeHorizon('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              timeHorizon === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Core Execution & Accuracy Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Execution Accuracy */}
        <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-2">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Execution Accuracy</span>
            <Target className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {accuracyRate}%
            </span>
            <span className="text-xs text-emerald-500 font-bold">
              High Precision
            </span>
          </div>
          <p className="text-[11px] text-theme-muted">
            Time-boxing adherence across completed tasks.
          </p>
        </div>

        {/* On-Time Delivery Rate */}
        <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-2">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-xs font-bold uppercase tracking-wider">On-Time Delivery</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {onTimeRate}%
            </span>
            <span className="text-xs text-theme-muted font-bold">
              {onTimeDeliveries}/{executedTasks.length || 1}
            </span>
          </div>
          <p className="text-[11px] text-theme-muted">
            {delayedDeliveries} delayed overruns recorded.
          </p>
        </div>

        {/* Completion Rate */}
        <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-2">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {completionRate}%
            </span>
            <span className="text-xs text-theme-muted font-bold">
              {completedTasks}/{totalTasks} Done
            </span>
          </div>
          <p className="text-[11px] text-theme-muted">
            {incompleteTasks} incomplete • {rescheduledTasks} rescheduled.
          </p>
        </div>

        {/* Total Time Boxed */}
        <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-2">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Time Boxed</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {Math.round(totalAppointedMinutes / 60)}h
            </span>
            <span className="text-xs text-theme-muted font-bold">
              {totalActualMinutes}m Actual
            </span>
          </div>
          <p className="text-[11px] text-theme-muted">
            Allocated across {totalTasks} scheduled slots.
          </p>
        </div>

        {/* 24h Red-Line Guard */}
        <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-2">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Life Balance Cap</span>
            <ShieldCheck className="w-4 h-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {capacitySettings.maxWorkHours}h
            </span>
            <span className="text-xs text-blue-500 font-bold">
              Daily Max
            </span>
          </div>
          <p className="text-[11px] text-theme-muted">
            Protects {capacitySettings.sleepHours}h Sleep + {capacitySettings.bufferHours}h Buffer.
          </p>
        </div>

      </div>

      {/* Main Two-Column Analysis: Priority Distribution & Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Priority Matrix Performance (P1-P5) */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Priority Matrix Throughput (P1 → P5)
            </h3>
            <span className="text-xs text-theme-muted font-mono">
              Horizon: {timeHorizon}
            </span>
          </div>

          <div className="space-y-3.5">
            {(['P1', 'P2', 'P3', 'P4', 'P5'] as PriorityLevel[]).map((p) => {
              const meta = prioritySettings[p];
              const pTasks = horizonTasks.filter(t => t.priority === p);
              const count = pTasks.length;
              const doneCount = pTasks.filter(t => t.status === 'Done').length;
              const incompleteCount = pTasks.filter(t => t.status === 'Incomplete').length;
              const totalMins = pTasks.reduce((sum, t) => sum + (t.appointedMinutes || 0), 0);
              const maxMinutesPossible = Math.max(1, totalAppointedMinutes);
              const percent = Math.round((totalMins / maxMinutesPossible) * 100);
              const donePercent = count > 0 ? Math.round((doneCount / count) * 100) : 0;

              return (
                <div key={p} className="space-y-1.5 p-3 rounded-xl bg-theme-card-hover/40 border border-theme-border/60">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded font-black text-[11px]"
                        style={{ backgroundColor: meta.bgColor, color: meta.color }}
                      >
                        {p}
                      </span>
                      <span className="text-theme-text font-bold">{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{doneCount}/{count} Done ({donePercent}%)</span>
                      {incompleteCount > 0 && (
                        <span className="text-red-500 font-bold">({incompleteCount} Missed)</span>
                      )}
                      <span className="text-theme-muted">• {totalMins}m</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${donePercent}%`, backgroundColor: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task Lifecycle Status Breakdown */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              Task Execution Health
            </h3>
            <span className="text-xs text-theme-muted font-mono">{totalTasks} Total Tasks</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <span>Completed Tasks</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display">
                {completedTasks}
              </span>
              <p className="text-[10px] text-theme-muted">{completionRate}% of deliverables</p>
            </div>

            <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-red-700 dark:text-red-300">
                <span>Incomplete Queue</span>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-2xl font-black text-red-600 dark:text-red-400 font-display">
                {incompleteTasks}
              </span>
              <p className="text-[10px] text-theme-muted">Missed time slots</p>
            </div>

            <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-300">
                <span>Rescheduled Slots</span>
                <RotateCcw className="w-4 h-4" />
              </div>
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-display">
                {rescheduledTasks}
              </span>
              <p className="text-[10px] text-theme-muted">Shifted downstream</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-theme-border space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Terminated / Cancelled</span>
                <XCircle className="w-4 h-4" />
              </div>
              <span className="text-2xl font-black text-slate-600 dark:text-slate-400 font-display">
                {terminatedTasks}
              </span>
              <p className="text-[10px] text-theme-muted">Purposely terminated</p>
            </div>
          </div>

          {/* Circadian 24-Hour Breakdown */}
          <div className="p-4 rounded-xl bg-theme-card border border-theme-border space-y-2">
            <span className="text-xs font-bold text-theme-text block uppercase tracking-wider">
              24-Hour Life Horizon Blueprint
            </span>
            <div className="flex items-center gap-2 text-xs font-mono">
              <div className="flex-1 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-center">
                <span className="block text-[10px] text-blue-600 dark:text-blue-400 font-bold">WORK CAPACITY</span>
                <span className="font-bold text-theme-text">{capacitySettings.maxWorkHours}h</span>
              </div>
              <div className="flex-1 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-center">
                <span className="block text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">SLEEP CYCLE</span>
                <span className="font-bold text-theme-text">{capacitySettings.sleepHours}h</span>
              </div>
              <div className="flex-1 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
                <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-bold">BUFFER / LEISURE</span>
                <span className="font-bold text-theme-text">{capacitySettings.bufferHours}h</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Chronological Life Event Audit Ledger */}
      <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
        
        {/* Ledger Header & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-theme-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-theme-text">
                Chronological Life Event Audit Ledger
              </h3>
              <p className="text-xs text-theme-muted">
                Immutable record of every task creation, start, pause, completion, delay, and rescheduling event.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card-hover border border-theme-border hover:bg-theme-border text-theme-text text-xs font-bold rounded-xl transition-all"
              title="Export Audit Ledger as CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card-hover border border-theme-border hover:bg-theme-border text-theme-text text-xs font-bold rounded-xl transition-all"
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
                  className="px-2.5 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700"
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
                className="p-1.5 text-theme-muted hover:text-red-500 rounded-xl transition-colors"
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
              className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                logFilter === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
              }`}
            >
              All Events ({auditLogs.length})
            </button>
            <button
              onClick={() => setLogFilter('TASK_COMPLETED')}
              className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                logFilter === 'TASK_COMPLETED' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setLogFilter('TASK_DELAYED')}
              className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                logFilter === 'TASK_DELAYED' ? 'bg-amber-600 text-white shadow-sm' : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
              }`}
            >
              Delayed
            </button>
            <button
              onClick={() => setLogFilter('TASK_RESCHEDULED')}
              className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                logFilter === 'TASK_RESCHEDULED' ? 'bg-purple-600 text-white shadow-sm' : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
              }`}
            >
              Rescheduled
            </button>
            <button
              onClick={() => setLogFilter('TASK_INCOMPLETE')}
              className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                logFilter === 'TASK_INCOMPLETE' ? 'bg-red-600 text-white shadow-sm' : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
              }`}
            >
              Incomplete
            </button>
            <button
              onClick={() => setLogFilter('TASK_CREATED')}
              className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                logFilter === 'TASK_CREATED' ? 'bg-sky-600 text-white shadow-sm' : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
              }`}
            >
              Created
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
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {filteredAuditLogs.length === 0 ? (
            <div className="p-12 text-center text-xs text-theme-muted border border-theme-border rounded-xl">
              No audit logs match the current filters.
            </div>
          ) : (
            filteredAuditLogs.map((log) => {
              const logDate = new Date(log.timestamp);
              const timeStr = logDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

              return (
                <div
                  key={log.id}
                  className="p-3 rounded-xl border bg-theme-card border-theme-border hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0 flex-wrap">
                    
                    {/* Timestamp */}
                    <span className="font-mono text-[11px] text-theme-muted shrink-0 bg-theme-card-hover px-2 py-0.5 rounded border border-theme-border">
                      {log.date} {timeStr}
                    </span>

                    {/* Event Badge */}
                    <div className="shrink-0">
                      {getEventBadge(log.eventType)}
                    </div>

                    {/* Priority & Project Code */}
                    {log.priority && (
                      <span className="font-black text-[10px] px-1.5 py-0.2 rounded bg-theme-card-hover text-theme-text shrink-0">
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
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 shrink-0">
                      +{log.details.delayMinutes}m Overtime
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>

    </div>
  );
};
