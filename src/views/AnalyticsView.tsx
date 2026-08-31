import React from 'react';
import { useApp } from '../context/AppContext';
import { PriorityLevel } from '../types';
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
  Award
} from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { tasks, categories, prioritySettings, capacitySettings } = useApp();

  // Metrics computation
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Done').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Actual vs Projected time calculation
  const executedTasksWithLogs = tasks.filter(t => t.totalActualMinutes > 0);
  const totalProjectedMinutes = executedTasksWithLogs.reduce((acc, t) => acc + t.appointedMinutes, 0);
  const totalActualMinutes = executedTasksWithLogs.reduce((acc, t) => acc + t.totalActualMinutes, 0);
  
  const accuracyRate = totalProjectedMinutes > 0 
    ? Math.max(0, Math.min(100, Math.round(100 - (Math.abs(totalActualMinutes - totalProjectedMinutes) / totalProjectedMinutes) * 100))) 
    : 95;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Execution Accuracy Card */}
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
            Projected vs Actual time-boxing adherence.
          </p>
        </div>

        {/* Completion Rate */}
        <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-2">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Task Completion</span>
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
            Total deliverables accomplished across all horizons.
          </p>
        </div>

        {/* Total Appointed Hours */}
        <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-2">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Total Time Boxed</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {Math.round(tasks.reduce((sum, t) => sum + t.appointedMinutes, 0) / 60)}h
            </span>
            <span className="text-xs text-theme-muted font-bold">
              Allocated
            </span>
          </div>
          <p className="text-[11px] text-theme-muted">
            Scheduled across P1-P5 scientific priorities.
          </p>
        </div>

        {/* Capacity Burnout Safety */}
        <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-2">
          <div className="flex items-center justify-between text-theme-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Red-Line Guard</span>
            <ShieldCheck className="w-4 h-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-theme-text font-display">
              {capacitySettings.maxWorkHours}h
            </span>
            <span className="text-xs text-blue-500 font-bold">
              Budget Cap
            </span>
          </div>
          <p className="text-[11px] text-theme-muted">
            Protects {capacitySettings.sleepHours}h Sleep + {capacitySettings.bufferHours}h Buffer/Leisure.
          </p>
        </div>

      </div>

      {/* Main Charts & Visual Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Priority Level (P1-P5) Breakdown Bar Chart */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Priority Matrix Distribution
            </h3>
            <span className="text-xs text-theme-muted">P1-P5 Minutes</span>
          </div>

          <div className="space-y-3">
            {(['P1', 'P2', 'P3', 'P4', 'P5'] as PriorityLevel[]).map((p) => {
              const meta = prioritySettings[p];
              const pTasks = tasks.filter(t => t.priority === p);
              const count = pTasks.length;
              const totalMins = pTasks.reduce((sum, t) => sum + t.appointedMinutes, 0);
              const maxMinutesPossible = Math.max(1, tasks.reduce((sum, t) => sum + t.appointedMinutes, 0));
              const percent = Math.round((totalMins / maxMinutesPossible) * 100);

              return (
                <div key={p} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-1.5 py-0.5 rounded font-black text-[10px]"
                        style={{ backgroundColor: meta.bgColor, color: meta.color }}
                      >
                        {p}
                      </span>
                      <span className="text-theme-text">{meta.label}</span>
                    </div>
                    <span className="font-mono text-theme-muted">
                      {count} tasks • {totalMins}m ({percent}%)
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%`, backgroundColor: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category ROI & Time Allocation */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              Category Time Allocation
            </h3>
            <span className="text-xs text-theme-muted">Dedicated Focus</span>
          </div>

          <div className="space-y-3">
            {categories.map((cat) => {
              const catTasks = tasks.filter(t => t.category === cat.name);
              const count = catTasks.length;
              const totalMins = catTasks.reduce((sum, t) => sum + t.appointedMinutes, 0);
              const maxMinutesPossible = Math.max(1, tasks.reduce((sum, t) => sum + t.appointedMinutes, 0));
              const percent = Math.round((totalMins / maxMinutesPossible) * 100);

              return (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-theme-text">{cat.name}</span>
                    </div>
                    <span className="font-mono text-theme-muted">
                      {count} tasks • {Math.floor(totalMins / 60)}h {totalMins % 60}m ({percent}%)
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Execution Accuracy: Projected vs Actual Log Table */}
      <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
        <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-500" />
          Projected vs Actual Execution Accuracy Audit
        </h3>

        {executedTasksWithLogs.length === 0 ? (
          <p className="text-xs text-theme-muted">
            Start live timers on your scheduled tasks to populate granular execution accuracy analytics.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-theme-border text-theme-muted font-bold">
                  <th className="py-2.5 px-3">Project Code</th>
                  <th className="py-2.5 px-3">Task Title</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Projected</th>
                  <th className="py-2.5 px-3">Actual Executed</th>
                  <th className="py-2.5 px-3">Buffer Applied</th>
                  <th className="py-2.5 px-3">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {executedTasksWithLogs.map((task) => {
                  const variance = task.totalActualMinutes - task.appointedMinutes;
                  const isLate = variance > 0;
                  return (
                    <tr key={task.id} className="hover:bg-theme-card-hover transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {task.projectCode}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-theme-text max-w-xs truncate">
                        {task.title}
                      </td>
                      <td className="py-2.5 px-3 font-bold">{task.priority}</td>
                      <td className="py-2.5 px-3 font-mono">{task.appointedMinutes} min</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-theme-text">
                        {task.totalActualMinutes} min
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          task.bufferMinutes === 5 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950'
                        }`}>
                          +{task.bufferMinutes}m
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        {variance === 0 ? (
                          <span className="text-emerald-500">Exact 0m</span>
                        ) : isLate ? (
                          <span className="text-red-500">+{variance}m (Late)</span>
                        ) : (
                          <span className="text-blue-500">{variance}m (Early)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
