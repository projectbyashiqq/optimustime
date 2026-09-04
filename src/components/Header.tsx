import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatHeaderDate, toISODateString, getBangladeshNow, formatBangladeshTime } from '../utils/timeUtils';
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
  Repeat,
  Sun,
  Moon
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

  const [currentTime, setCurrentTime] = useState<Date>(() => getBangladeshNow());
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // Live 12h clock with seconds anchored to Bangladesh Standard Time (Asia/Dhaka)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getBangladeshNow());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const bdTime = formatBangladeshTime(currentTime);
  const todayStr = toISODateString(currentTime);
  const scheduledMinutesToday = dailyScheduledMinutes(todayStr);
  const maxCapacityMinutes = capacitySettings.maxWorkHours * 60;
  const capacityPercent = Math.min(100, Math.round((scheduledMinutesToday / maxCapacityMinutes) * 100));
  const isRedLine = isCapacityRedLineExceeded(todayStr);

  const formattedHours = Math.floor(scheduledMinutesToday / 60);
  const formattedRemainingMinutes = scheduledMinutesToday % 60;

  // Format 12-hour AM/PM with seconds in Bangladesh time
  const formattedTimeStr = `${bdTime.timeClean}:${bdTime.seconds} ${bdTime.period}`;

  const themesList: { id: ThemeName; name: string; badge: string; color: string }[] = [
    { id: 'light', name: 'Light White & Bluish', badge: 'Default', color: '#2563EB' },
    { id: 'cyber-dark', name: 'Cyber Midnight Dark', badge: 'Pro', color: '#3B82F6' },
    { id: 'nord-slate', name: 'Nord Slate Arctic', badge: 'Cool', color: '#88C0D0' },
    { id: 'emerald-obsidian', name: 'Emerald Obsidian', badge: 'Zen', color: '#10B981' },
    { id: 'sunset-amber', name: 'Sunset Amber Dusk', badge: 'Warm', color: '#F97316' },
    { id: 'rose-quartz', name: 'Rose Quartz Violet', badge: 'Neon', color: '#EC4899' },
  ];

  return (
    <header className="sticky top-0 z-30 glass-header shadow-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between gap-3">
          
          {/* Logo & Live Time Section */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/30 text-white font-black text-sm tracking-wider ring-1 ring-white/20 shrink-0">
              OT
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black tracking-tight font-display text-theme-text flex items-center gap-1">
                  OPTIMUS<span className="text-blue-600 dark:text-blue-400">TIME</span>
                </h1>
                <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-400/15 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                  Unified
                </span>
              </div>
              <div className="text-[11px] text-theme-muted font-medium flex items-center gap-1.5">
                <span>{formatHeaderDate(currentTime)}</span>
              </div>
            </div>

            {/* Big Live Clock Badge in Bangladesh Time (Apple Complication Style) */}
            <div className="hidden sm:flex items-center gap-2 bg-theme-card/60 dark:bg-theme-card/50 backdrop-blur-xl px-3 py-1.5 rounded-2xl border border-theme-border/80 shadow-xs ml-1 ring-1 ring-black/5 dark:ring-white/5">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600 dark:bg-blue-400"></span>
              </div>
              {bdTime.isNight ? (
                <Moon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              )}
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs sm:text-sm font-bold tracking-tight text-theme-text">
                  {formattedTimeStr}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                  bdTime.isNight 
                    ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25' 
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25'
                }`}>
                  {bdTime.circadianPeriod}
                </span>
              </div>
            </div>
          </div>

          {/* Daily Capacity & Red-Line Indicator (Apple Master-Level Lighting Capsule) */}
          <div className="hidden md:block flex-1 max-w-[250px] lg:max-w-[280px] px-1.5 shrink-0">
            <div className={`px-3 py-2 rounded-2xl border transition-all duration-300 shadow-2xs group ${
              isRedLine 
                ? 'bg-red-500/[0.08] dark:bg-red-500/[0.14] border-red-500/40 animate-glow-danger' 
                : 'bg-theme-card/70 dark:bg-theme-card/50 backdrop-blur-xl border-theme-border/80 hover:border-theme-border hover:shadow-xs'
            }`}>
              {/* Top Row: Icon + Label + Single-line Tabular Figures + Percent Pill */}
              <div className="flex items-center justify-between gap-2 mb-1.5 whitespace-nowrap">
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                    isRedLine 
                      ? 'bg-red-500/20 text-red-600 dark:text-red-400' 
                      : 'bg-amber-500/15 text-amber-500'
                  }`}>
                    {isRedLine ? (
                      <AlertTriangle className="w-2.5 h-2.5 animate-bounce stroke-[2.5]" />
                    ) : (
                      <Flame className="w-2.5 h-2.5 fill-current" />
                    )}
                  </div>
                  <span className={`text-[11px] font-bold tracking-tight font-display ${
                    isRedLine ? 'text-red-600 dark:text-red-400 uppercase tracking-wider text-[10px]' : 'text-theme-text'
                  }`}>
                    {isRedLine ? 'Red-Line' : 'Capacity'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 font-mono">
                  <div className="text-[10px] font-bold tracking-tight text-theme-muted whitespace-nowrap">
                    <span className={isRedLine ? 'text-red-600 dark:text-red-400 font-black' : 'text-theme-text font-bold'}>
                      {formattedHours}h {formattedRemainingMinutes}m
                    </span>
                    <span className="opacity-50 mx-0.5">/</span>
                    <span className="opacity-80">{capacitySettings.maxWorkHours}h</span>
                  </div>

                  <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border shrink-0 ${
                    isRedLine
                      ? 'bg-red-500/20 text-red-600 dark:text-red-300 border-red-500/40 font-black'
                      : capacityPercent > 80
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25'
                  }`}>
                    {capacityPercent}%
                  </span>
                </div>
              </div>

              {/* Apple Master-Level Lighting Progress Bar */}
              <div className="w-full bg-black/[0.08] dark:bg-white/[0.08] h-2 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)] overflow-hidden relative ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
                {capacityPercent > 0 && (
                  <div 
                    className={`h-full rounded-full transition-all duration-500 relative overflow-hidden ${
                      isRedLine 
                        ? 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600 apple-lighting-glow-red' 
                        : capacityPercent > 80 
                          ? 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500 apple-lighting-glow-amber' 
                          : 'bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300 apple-lighting-glow-blue'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(3, capacityPercent))}%` }}
                  >
                    {/* Animated Specular Traveling Light Sheen */}
                    <div className="apple-lighting-sheen" />

                    {/* Apple Dynamic Leading Light Beacon */}
                    <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/70 rounded-full blur-[1px] pointer-events-none" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Search & Actions (Apple Cupertino Header Bar) */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Search Input (Apple Spotlight Pill) */}
            <div className="relative w-24 sm:w-36 md:w-44 focus-within:w-36 sm:focus-within:w-48 transition-all duration-200">
              <Search className="w-3.5 h-3.5 text-theme-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-full bg-theme-card-hover/80 border border-theme-border/80 text-theme-text placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-2xs"
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
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-95 shadow-2xs ${
                cloudSyncStatus === 'synced'
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                  : cloudSyncStatus === 'syncing'
                  ? 'bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
                  : cloudSyncStatus === 'connecting'
                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                  : cloudSyncStatus === 'error'
                  ? 'bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                  : 'bg-theme-card-hover border-theme-border/80 text-theme-muted hover:text-theme-text'
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-theme-border/80 bg-theme-card-hover/80 hover:bg-theme-border/80 text-theme-muted hover:text-theme-text text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-95 shadow-2xs"
              title="Recurring Tasks & Schedules Hub (God Admin)"
            >
              <Repeat className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="hidden lg:inline text-[11px]">Recurring</span>
              <span className="text-[9px] font-mono font-black px-1.5 py-0.2 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                {tasks.filter(t => t.recurrence && t.recurrence !== 'None').length}
              </span>
            </button>

            {/* Theme Selector Dropdown (Apple macOS Popover Style) */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="flex items-center gap-1 p-2 rounded-full bg-theme-card-hover/80 border border-theme-border/80 text-theme-text hover:bg-theme-border/80 transition-all text-xs font-medium cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                title="Change Theme"
              >
                <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <ChevronDown className="w-3 h-3 text-theme-muted" />
              </button>

              {showThemeMenu && (
                <div className="absolute right-0 mt-2 w-52 glass-panel rounded-2xl shadow-2xl z-50 p-2 border border-theme-border animate-fade-in">
                  <div className="text-[10px] font-bold text-theme-muted px-2.5 py-1 uppercase tracking-wider">
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
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                          theme === t.id 
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold' 
                            : 'hover:bg-theme-card-hover text-theme-text'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full shadow-xs" 
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

            {/* Primary New Task CTA (Apple Cupertino Blue Pill) */}
            <button
              onClick={onOpenNewTaskModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/30 hover:shadow-md hover:shadow-blue-600/40 transition-all active:scale-95 shrink-0 whitespace-nowrap cursor-pointer"
              title="Create New Task"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">New Task</span>
            </button>

            {/* Quick Lock / Logout Button */}
            {securitySettings.isPasswordProtected && (
              <button
                onClick={logout}
                className="w-8 h-8 rounded-full flex items-center justify-center border border-theme-border/80 bg-theme-card-hover/80 hover:text-red-600 hover:border-red-300 dark:hover:border-red-800 text-theme-muted transition-all active:scale-95 cursor-pointer shadow-2xs"
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
