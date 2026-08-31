import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatHeaderDate, toISODateString } from '../utils/timeUtils';
import { 
  Clock, 
  AlertTriangle, 
  Plus, 
  Search, 
  Palette, 
  Flame, 
  CheckCircle2, 
  Sparkles,
  Layers,
  ChevronDown,
  Lock,
  Cloud,
  CloudOff,
  RefreshCw
} from 'lucide-react';
import { ThemeName } from '../types';

interface HeaderProps {
  onOpenNewTaskModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewTaskModal }) => {
  const { 
    tasks, 
    capacitySettings, 
    dailyScheduledMinutes, 
    isCapacityRedLineExceeded, 
    theme, 
    setTheme, 
    searchQuery, 
    setSearchQuery,
    securitySettings,
    logout,
    cloudSyncConfig,
    cloudSyncStatus,
    syncNow
  } = useApp();

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // Live 12h clock with seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = toISODateString(currentTime);
  const scheduledMinutesToday = dailyScheduledMinutes(todayStr);
  const maxCapacityMinutes = capacitySettings.maxWorkHours * 60;
  const capacityPercent = Math.min(100, Math.round((scheduledMinutesToday / maxCapacityMinutes) * 100));
  const isRedLine = isCapacityRedLineExceeded(todayStr);

  const formattedHours = Math.floor(scheduledMinutesToday / 60);
  const formattedRemainingMinutes = scheduledMinutesToday % 60;

  // Format 12-hour AM/PM with seconds
  const formattedTimeStr = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const themesList: { id: ThemeName; name: string; badge: string; color: string }[] = [
    { id: 'light', name: 'Light White & Bluish', badge: 'Default', color: '#2563EB' },
    { id: 'cyber-dark', name: 'Cyber Midnight Dark', badge: 'Pro', color: '#3B82F6' },
    { id: 'nord-slate', name: 'Nord Slate Arctic', badge: 'Cool', color: '#88C0D0' },
    { id: 'emerald-obsidian', name: 'Emerald Obsidian', badge: 'Zen', color: '#10B981' },
    { id: 'sunset-amber', name: 'Sunset Amber Dusk', badge: 'Warm', color: '#F97316' },
    { id: 'rose-quartz', name: 'Rose Quartz Violet', badge: 'Neon', color: '#EC4899' },
  ];

  return (
    <header className="sticky top-0 z-30 glass-header shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Logo & Live Time Section */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-lg tracking-wider">
                OT
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-lg font-black tracking-tight font-display text-theme-text flex items-center gap-1">
                    OPTIMUS<span className="text-blue-600 dark:text-blue-400">TIME</span>
                  </h1>
                  <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                    Unified
                  </span>
                </div>
                <div className="text-xs text-theme-muted font-medium flex items-center gap-1.5">
                  <span>{formatHeaderDate(currentTime)}</span>
                </div>
              </div>
            </div>

            {/* Live Clock Badge */}
            <div className="flex items-center gap-2 bg-theme-card-hover px-3 py-1.5 rounded-lg border border-theme-border shadow-inner">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
              <span className="font-mono text-sm font-bold tracking-wide text-theme-text">
                {formattedTimeStr}
              </span>
            </div>

            {/* Cloud Sync Status Pill */}
            <button
              onClick={() => syncNow()}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                cloudSyncStatus === 'synced'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                  : cloudSyncStatus === 'syncing' || cloudSyncStatus === 'connecting'
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 animate-pulse'
                  : cloudSyncStatus === 'error'
                  ? 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                  : 'bg-theme-card-hover border-theme-border text-theme-muted hover:text-theme-text'
              }`}
              title={
                cloudSyncConfig.isEnabled
                  ? `Cloud Sync: ${cloudSyncStatus.toUpperCase()} (Click to Sync Now)`
                  : 'Cloud Sync Disabled (Setup in Admin Settings → Cloud Sync)'
              }
            >
              {cloudSyncStatus === 'synced' ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Synced</span>
                </>
              ) : cloudSyncStatus === 'syncing' || cloudSyncStatus === 'connecting' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                  <span className="hidden sm:inline">Syncing...</span>
                </>
              ) : cloudSyncStatus === 'error' ? (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-red-500" />
                  <span className="hidden sm:inline">Sync Error</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-theme-muted" />
                  <span className="hidden sm:inline">Local Only</span>
                </>
              )}
            </button>
          </div>

          {/* Daily Capacity & Red-Line Indicator */}
          <div className="w-full md:w-auto flex-1 max-w-md">
            <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
              isRedLine 
                ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 animate-glow-danger' 
                : 'bg-theme-card border-theme-border'
            }`}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5 font-semibold">
                  {isRedLine ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 animate-bounce" />
                      <span className="text-red-700 dark:text-red-400 font-bold uppercase tracking-wider">
                        Red-Line Alert Exceeded!
                      </span>
                    </>
                  ) : (
                    <>
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-theme-text font-medium">Daily Capacity Budget</span>
                    </>
                  )}
                </div>
                <div className="font-mono text-[11px] font-bold text-theme-muted">
                  <span className={isRedLine ? 'text-red-600 font-black' : 'text-blue-600 dark:text-blue-400'}>
                    {formattedHours}h {formattedRemainingMinutes}m
                  </span>
                  {' '}/ {capacitySettings.maxWorkHours}h Max
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    isRedLine 
                      ? 'bg-gradient-to-r from-orange-500 to-red-600' 
                      : capacityPercent > 80 
                        ? 'bg-gradient-to-r from-blue-500 to-amber-500' 
                        : 'bg-gradient-to-r from-blue-600 to-sky-400'
                  }`}
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Search & Actions */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            
            {/* Search Input */}
            <div className="relative flex-1 md:w-48">
              <Search className="w-3.5 h-3.5 text-theme-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tasks, codes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Theme Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="flex items-center gap-1.5 p-2 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text hover:bg-theme-border transition-colors text-xs font-medium"
                title="Change Theme"
              >
                <Palette className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <ChevronDown className="w-3 h-3 text-theme-muted" />
              </button>

              {showThemeMenu && (
                <div className="absolute right-0 mt-2 w-56 glass-panel rounded-xl shadow-xl z-50 p-2 border border-theme-border animate-fade-in">
                  <div className="text-[11px] font-bold text-theme-muted px-2 py-1 uppercase tracking-wider">
                    Select Aesthetic Theme
                  </div>
                  <div className="space-y-1 mt-1">
                    {themesList.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTheme(t.id);
                          setShowThemeMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          theme === t.id 
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold' 
                            : 'hover:bg-theme-card-hover text-theme-text'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded-full shadow-sm" 
                            style={{ backgroundColor: t.color }}
                          />
                          <span>{t.name}</span>
                        </div>
                        {theme === t.id && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Primary New Task CTA */}
            <button
              onClick={onOpenNewTaskModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white text-xs font-bold rounded-lg shadow-md shadow-blue-500/25 transition-all transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Task</span>
            </button>

            {/* Quick Lock / Logout Button */}
            {securitySettings.isPasswordProtected && (
              <button
                onClick={logout}
                className="p-2 rounded-lg bg-theme-card-hover border border-theme-border text-theme-muted hover:text-red-600 hover:border-red-300 dark:hover:border-red-800 transition-colors text-xs flex items-center gap-1.5"
                title="Lock System / Sign Out"
              >
                <Lock className="w-4 h-4" />
                <span className="hidden xl:inline text-[11px] font-bold">Lock</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
