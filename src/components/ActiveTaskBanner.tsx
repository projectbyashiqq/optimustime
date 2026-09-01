import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FastForward, 
  Sparkles,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

export const ActiveTaskBanner: React.FC = () => {
  const { tasks, completeTask, pauseTask, holdTask, prioritySettings } = useApp();
  
  const activeTask = tasks.find(t => t.status === 'Working');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!activeTask) {
      setElapsedSeconds(0);
      return;
    }

    const lastLog = activeTask.executionLogs[activeTask.executionLogs.length - 1];
    const startTime = lastLog ? new Date(lastLog.startedAt).getTime() : Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - startTime) / 1000));
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTask]);

  if (!activeTask) return null;

  const appointedSeconds = activeTask.appointedMinutes * 60;
  const isOvertime = elapsedSeconds > appointedSeconds;
  const progressPercent = Math.min(100, Math.round((elapsedSeconds / appointedSeconds) * 100));

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const priorityMeta = prioritySettings[activeTask.priority];

  return (
    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white shadow-xl border-b border-blue-400/30 sticky top-[108px] z-20 animate-slide-up">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Active Task Meta */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center animate-pulse">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/20 tracking-wider">
                  WORKING NOW
                </span>
                <span className="text-xs font-mono font-bold text-blue-100">
                  [{activeTask.projectCode}]
                </span>
                <span 
                  className="text-[10px] font-black px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: priorityMeta?.color || '#3B82F6', color: '#fff' }}
                >
                  {activeTask.priority}
                </span>
                <span className="text-xs text-blue-100 font-medium">
                  {activeTask.category} {activeTask.subCategory ? `• ${activeTask.subCategory}` : ''}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-white truncate max-w-md font-openSans">
                {activeTask.title}
              </h3>
            </div>
          </div>

          {/* Stopwatch & Auto-Buffer Alert */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                {isOvertime && (
                  <span className="text-[11px] font-bold bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <AlertCircle className="w-3 h-3" />
                    Overtime (+5m Buffer)
                  </span>
                )}
                <div className="font-mono text-2xl sm:text-3xl font-black tracking-wider text-white drop-shadow-md">
                  {formatTimer(elapsedSeconds)}
                </div>
                <span className="text-xs sm:text-sm text-blue-100 font-bold">
                  / {activeTask.appointedMinutes}m
                </span>
              </div>
              
              {/* Micro Progress Bar */}
              <div className="w-36 bg-blue-900/50 h-1.5 rounded-full overflow-hidden mt-1">
                <div 
                  className={`h-full transition-all duration-300 ${isOvertime ? 'bg-amber-400' : 'bg-white'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => pauseTask(activeTask.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold backdrop-blur-sm border border-white/20 transition-colors"
                title="Pause Execution"
              >
                <Pause className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pause</span>
              </button>

              <button
                onClick={() => completeTask(activeTask.id)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all transform active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Task</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
