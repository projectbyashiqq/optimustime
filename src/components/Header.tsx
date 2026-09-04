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
  RefreshCw,
  Repeat
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
    syncNow,
    openRecurringHub,
    setActiveTab
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-3">
          
          {/* Logo & Live Time Section */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-base tracking-wider">
              OT
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black tracking-tight font-display text-theme-text flex items-center gap-1">
                  OPTIMUS<span className="text-blue-600 dark:text-blue-400">TIME</span>
                </h1>
                <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                  Unified
                </span>
              </div>
              <div className="text-[11px] text-theme-muted font-medium flex items-center gap-1.5">
                <span>{formatHeaderDate(currentTime)}</span>
              </div>
            </div>

            {/* Big Live Clock Badge */}
            <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-theme-card dark:from-blue-950/50 dark:via-sky-950/30 dark:to-theme-card px-3.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800/80 shadow-sm ml-2 ring-1 ring-blue-500/20">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600 dark:bg-blue-400"></span>
              </div>
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="font-mono text-sm sm:text-base font-black tracking-wider text-theme-text font-display">
                {formattedTimeStr}
              </span>
            </div>
          </div>

          {/* Daily Capacity & Red-Line Indicator */}
          <div className="hidden md:block flex-1 max-w-xs lg:max-w-sm px-2">
            <div className={`p-2 rounded-xl border transition-all duration-300 ${
              isRedLine 
                ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 animate-glow-danger' 
                : 'bg-theme-card/70 border-theme-border'
            }`}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <div className="flex items-center gap-1 font-semibold">
                  {isRedLine ? (
                    <>
                      <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 animate-bounce" />
                      <span className="text-red-700 dark:text-red-400 font-bold uppercase tracking-wider text-[10px]">
                        Red-Line Exceeded!
                      </span>
                    </>
                  ) : (
                    <>
                      <Flame className="w-3 h-3 text-amber-500" />
                      <span className="text-theme-text font-medium">Capacity</span>
                    </>
                  )}
                </div>
                <div className="font-mono text-[10px] font-bold text-theme-muted">
                  <span className={isRedLine ? 'text-red-600 font-black' : 'text-blue-600 dark:text-blue-400'}>
                    {formattedHours}h {formattedRemainingMinutes}m
                  </span>
                  {' '}/ {capacitySettings.maxWorkHours}h
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
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
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Search Input */}
            <div className="relative w-24 sm:w-36 md:w-44 focus-within:w-36 sm:focus-within:w-48 transition-all duration-200">
              <Search className="w-3.5 h-3.5 text-theme-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-7 pr-2.5 py-1.5 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Cloud Sync Status Indicator */}
            <button
              onClick={() => {
                if (!cloudSyncConfig.isEnabled) {
                  setActiveTab('settings');
                } else {
                  syncNow();
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                cloudSyncStatus === 'synced'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                  : cloudSyncStatus === 'syncing'
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
                  : cloudSyncStatus === 'connecting'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                  : cloudSyncStatus === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                  : 'bg-theme-card-hover border-theme-border text-theme-muted hover:text-theme-text'
              }`}
              title={
                !cloudSyncConfig.isEnabled
                  ? 'Cloud Sync Offline (Click to configure in Settings)'
                  : cloudSyncStatus === 'synced'
                  ? 'Cloud Synced - Real-time active (Click to Sync Now)'
                  : cloudSyncStatus === 'syncing'
                  ? 'Syncing with Supabase...'
                  : cloudSyncStatus === 'connecting'
                  ? 'Connecting to Supabase...'
                  : 'Sync Error (Click to retry)'
              }
            >
              {cloudSyncStatus === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
              ) : cloudSyncStatus === 'synced' ? (
                <Cloud className="w-3.5 h-3.5 text-emerald-500" />
              ) : cloudSyncStatus === 'error' ? (
                <CloudOff className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-theme-muted" />
              )}
              <span className="hidden xl:inline text-[11px]">
                {cloudSyncStatus === 'synced'
                  ? 'Synced'
                  : cloudSyncStatus === 'syncing'
                  ? 'Syncing...'
                  : cloudSyncStatus === 'connecting'
                  ? 'Connecting...'
                  : cloudSyncStatus === 'error'
                  ? 'Error'
                  : 'Local'}
              </span>
            </button>

            {/* Recurring Hub God Admin Button */}
            <button
              onClick={openRecurringHub}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-theme-border bg-theme-card-hover hover:bg-theme-border text-theme-muted hover:text-theme-text text-xs font-semibold transition-all cursor-pointer shrink-0"
              title="Recurring Tasks & Schedules Hub (God Admin)"
            >
              <Repeat className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="hidden lg:inline text-[11px]">Recurring</span>
              <span className="text-[9px] font-mono font-black px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {tasks.filter(t => t.recurrence && t.recurrence !== 'None').length}
              </span>
            </button>

            {/* Theme Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="flex items-center gap-1 p-1.5 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text hover:bg-theme-border transition-colors text-xs font-medium cursor-pointer shrink-0"
                title="Change Theme"
              >
                <Palette className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <ChevronDown className="w-3 h-3 text-theme-muted" />
              </button>

              {showThemeMenu && (
                <div className="absolute right-0 mt-2 w-52 glass-panel rounded-xl shadow-xl z-50 p-2 border border-theme-border animate-fade-in">
                  <div className="text-[10px] font-bold text-theme-muted px-2 py-1 uppercase tracking-wider">
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
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          theme === t.id 
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold' 
                            : 'hover:bg-theme-card-hover text-theme-text'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full shadow-sm" 
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
              className="btn-pro btn-pro-primary flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl shadow-md shrink-0 whitespace-nowrap"
              title="Create New Task"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">New Task</span>
            </button>

            {/* Quick Lock / Logout Button */}
            {securitySettings.isPasswordProtected && (
              <button
                onClick={logout}
                className="btn-pro-icon hover:text-red-600 hover:border-red-300 dark:hover:border-red-800 text-xs"
                title="Lock System / Sign Out"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
