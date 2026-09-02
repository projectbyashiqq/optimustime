import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PriorityLevel, Category } from '../types';
import { TimePicker } from '../components/TimePicker';
import {
  Settings2,
  Layers,
  FolderKanban,
  Flame,
  Clock,
  Download,
  Upload,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  Tag,
  Palette,
  ShieldCheck,
  Edit2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Moon,
  Sun,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Cloud,
  CloudOff,
  Database,
  RefreshCw,
  Copy,
  ExternalLink,
  Sparkles,
  Coffee,
  Zap,
  AlertTriangle,
  ShieldAlert,
  Timer,
  Sliders,
  Activity,
  FileSpreadsheet,
  FileJson
} from 'lucide-react';
import { exportTasksToExcelWorkbook, exportTasksToDetailedCSV } from '../utils/excelExporter';
import { DEFAULT_SQL_SCHEMA, testSupabaseConnection } from '../services/supabase';

export const AdminSettingsView: React.FC = () => {
  const {
    capacitySettings,
    updateCapacitySettings,
    prioritySettings,
    updatePrioritySettings,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    bufferCategories,
    addBufferCategory,
    updateBufferCategory,
    deleteBufferCategory,
    resetBufferCategories,
    emergencyCategories,
    deleteEmergencyCategory,
    resetEmergencyCategories,
    tasks,
    planProjects,
    exportStateJson,
    exportSettingsOnlyJson,
    importStateJson,
    rollbackLastRestore,
    canRollback,
    openBackupModal,
    resetToDefaultData,
    securitySettings,
    updateSecuritySettings,
    cloudSyncConfig,
    cloudSyncStatus,
    updateCloudSyncConfig,
    pushToCloud,
    pullFromCloud,
    syncNow,
    testCloudConnection,
    defaultTaskSettings,
    updateDefaultTaskSettings
  } = useApp();

  // Local editing states (24-Hours Locked System Tools)
  const [maxWorkHours, setMaxWorkHours] = useState(capacitySettings.maxWorkHours);
  const [sleepHours, setSleepHours] = useState(capacitySettings.sleepHours);
  const [bufferHours, setBufferHours] = useState(capacitySettings.bufferHours);
  const [dayStartTime, setDayStartTime] = useState(capacitySettings.dayStartTime || '06:00 AM');
  const [dayEndTime, setDayEndTime] = useState(capacitySettings.dayEndTime || '11:00 PM');
  const [sleepStartTime, setSleepStartTime] = useState(capacitySettings.sleepStartTime || capacitySettings.dayEndTime || '11:00 PM');
  const [sleepEndTime, setSleepEndTime] = useState(capacitySettings.sleepEndTime || capacitySettings.dayStartTime || '06:00 AM');
  const [defaultBufferMinutes, setDefaultBufferMinutes] = useState(capacitySettings.defaultBufferMinutes || 15);
  const [capacityStatusMsg, setCapacityStatusMsg] = useState<string | null>(null);

  // Security Editing State
  const [isPasswordProtected, setIsPasswordProtected] = useState(securitySettings.isPasswordProtected);
  const [masterPassword, setMasterPassword] = useState(securitySettings.masterPassword);
  const [autoLockMinutes, setAutoLockMinutes] = useState(securitySettings.autoLockMinutes);
  const [username, setUsername] = useState(securitySettings.username);
  const [showPass, setShowPass] = useState(false);
  const [securityStatusMsg, setSecurityStatusMsg] = useState<string | null>(null);

  // Cloud Sync Editing State
  const [isCloudSyncEnabled, setIsCloudSyncEnabled] = useState(cloudSyncConfig.isEnabled);
  const [supabaseUrl, setSupabaseUrl] = useState(cloudSyncConfig.supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(cloudSyncConfig.supabaseAnonKey);
  const [autoRealtimeSync, setAutoRealtimeSync] = useState(cloudSyncConfig.autoRealtimeSync);
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [cloudStatusMsg, setCloudStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [hasCopiedSql, setHasCopiedSql] = useState(false);

  // Custom Priority Minutes
  const [pMinutes, setPMinutes] = useState({
    P1: prioritySettings.P1.defaultMinutes,
    P2: prioritySettings.P2.defaultMinutes,
    P3: prioritySettings.P3.defaultMinutes,
    P4: prioritySettings.P4.defaultMinutes,
    P5: prioritySettings.P5.defaultMinutes,
  });

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#2563EB');
  const [newSubcats, setNewSubcats] = useState('');

  // Import JSON State
  const [importJsonText, setImportJsonText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Default Task Adding Presets State
  const [taskDefaults, setTaskDefaults] = useState(defaultTaskSettings);
  const [taskDefaultsStatusMsg, setTaskDefaultsStatusMsg] = useState<string | null>(null);

  // Keep form inputs synced when cloudSyncConfig updates (e.g. from environment or context)
  React.useEffect(() => {
    setIsCloudSyncEnabled(cloudSyncConfig.isEnabled);
    if (cloudSyncConfig.supabaseUrl) setSupabaseUrl(cloudSyncConfig.supabaseUrl);
    if (cloudSyncConfig.supabaseAnonKey) setSupabaseAnonKey(cloudSyncConfig.supabaseAnonKey);
    setAutoRealtimeSync(cloudSyncConfig.autoRealtimeSync);
  }, [
    cloudSyncConfig.isEnabled,
    cloudSyncConfig.supabaseUrl,
    cloudSyncConfig.supabaseAnonKey,
    cloudSyncConfig.autoRealtimeSync
  ]);

  // Keep 24H Capacity editing state synced when capacitySettings updates in context
  React.useEffect(() => {
    setMaxWorkHours(capacitySettings.maxWorkHours);
    setSleepHours(capacitySettings.sleepHours);
    setBufferHours(capacitySettings.bufferHours);
    setDayStartTime(capacitySettings.dayStartTime || '06:00 AM');
    setDayEndTime(capacitySettings.dayEndTime || '11:00 PM');
    setSleepStartTime(capacitySettings.sleepStartTime || capacitySettings.dayEndTime || '11:00 PM');
    setSleepEndTime(capacitySettings.sleepEndTime || capacitySettings.dayStartTime || '06:00 AM');
    setDefaultBufferMinutes(capacitySettings.defaultBufferMinutes || 15);
  }, [capacitySettings]);

  // Keep task defaults synced when context updates
  React.useEffect(() => {
    if (defaultTaskSettings) {
      setTaskDefaults(defaultTaskSettings);
    }
  }, [defaultTaskSettings]);

  const handleSaveCloudSync = async () => {
    const isConfigured = Boolean(supabaseUrl.trim() && supabaseAnonKey.trim());
    const newConfig = {
      isEnabled: isCloudSyncEnabled && isConfigured,
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      tableName: 'optimustime_sync',
      autoRealtimeSync
    };
    updateCloudSyncConfig(newConfig);

    if (newConfig.isEnabled) {
      setIsTestingConn(true);
      const testRes = await testSupabaseConnection(newConfig);
      setIsTestingConn(false);
      if (testRes.success) {
        setCloudStatusMsg({ text: 'Cloud sync connected and saved successfully! ☁️', isError: false });
        await pushToCloud();
      } else {
        setCloudStatusMsg({ text: `Config saved, but connection error: ${testRes.message}`, isError: true });
      }
    } else {
      setCloudStatusMsg({ text: 'Cloud sync configuration updated.', isError: false });
    }
    setTimeout(() => setCloudStatusMsg(null), 5000);
  };

  const handleTestConnection = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setCloudStatusMsg({ text: 'Please enter both Supabase Project URL and Anon Key.', isError: true });
      return;
    }
    setIsTestingConn(true);
    setCloudStatusMsg(null);
    const result = await testSupabaseConnection({
      isEnabled: true,
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      tableName: 'optimustime_sync',
      autoRealtimeSync
    });
    setIsTestingConn(false);
    setCloudStatusMsg({ text: result.message, isError: !result.success });
  };

  const handlePushLocalToCloud = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setCloudStatusMsg({ text: 'Please enter Supabase URL and Anon Key first.', isError: true });
      return;
    }
    const config = {
      isEnabled: true,
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      tableName: 'optimustime_sync',
      autoRealtimeSync
    };
    updateCloudSyncConfig(config);
    const ok = await pushToCloud();
    setCloudStatusMsg({
      text: ok ? 'Local data successfully pushed to Cloud! 🚀' : 'Failed to push to Cloud. Check Supabase URL, Key & SQL table.',
      isError: !ok
    });
    setTimeout(() => setCloudStatusMsg(null), 4000);
  };

  const handlePullCloudToLocal = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setCloudStatusMsg({ text: 'Please enter Supabase URL and Anon Key first.', isError: true });
      return;
    }
    const config = {
      isEnabled: true,
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      tableName: 'optimustime_sync',
      autoRealtimeSync
    };
    updateCloudSyncConfig(config);
    const ok = await pullFromCloud();
    setCloudStatusMsg({
      text: ok ? 'Cloud data pulled & applied locally! 📥' : 'No cloud data found or fetch failed. (If database is new, use "Push Local to Cloud" first).',
      isError: !ok
    });
    setTimeout(() => setCloudStatusMsg(null), 5000);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(DEFAULT_SQL_SCHEMA);
    setHasCopiedSql(true);
    setTimeout(() => setHasCopiedSql(false), 3000);
  };

  const handleSaveSecurity = () => {
    if (isPasswordProtected && !masterPassword.trim()) {
      alert('Master Password cannot be blank when password protection is enabled.');
      return;
    }
    updateSecuritySettings({
      isPasswordProtected,
      masterPassword: masterPassword.trim(),
      autoLockMinutes: Number(autoLockMinutes),
      username: username.trim() || 'Master Admin'
    });
    setSecurityStatusMsg('Security and authentication settings updated successfully! ✅');
    setTimeout(() => setSecurityStatusMsg(null), 4000);
  };

  const handleSaveCapacity = () => {
    updateCapacitySettings({
      ...capacitySettings,
      maxWorkHours: Number(maxWorkHours),
      sleepHours: Number(sleepHours),
      bufferHours: Number(bufferHours),
      dayStartTime,
      dayEndTime,
      sleepStartTime,
      sleepEndTime,
      defaultBufferMinutes: Number(defaultBufferMinutes)
    });
    setCapacityStatusMsg('24-Hour Capacity & Red-Line Protocol saved successfully! ✅');
    setTimeout(() => setCapacityStatusMsg(null), 4000);
  };

  const handleSavePriorities = () => {
    updatePrioritySettings({
      ...prioritySettings,
      P1: { ...prioritySettings.P1, defaultMinutes: Number(pMinutes.P1) },
      P2: { ...prioritySettings.P2, defaultMinutes: Number(pMinutes.P2) },
      P3: { ...prioritySettings.P3, defaultMinutes: Number(pMinutes.P3) },
      P4: { ...prioritySettings.P4, defaultMinutes: Number(pMinutes.P4) },
      P5: { ...prioritySettings.P5, defaultMinutes: Number(pMinutes.P5) },
    });
    alert('Priority duration rules updated!');
  };

  const handleSaveTaskDefaults = () => {
    updateDefaultTaskSettings(taskDefaults);
    setTaskDefaultsStatusMsg('Default Task Adding Presets saved successfully! ✅');
    setTimeout(() => setTaskDefaultsStatusMsg(null), 4000);
  };

  const handleCreateCategory = () => {
    if (!newCatName.trim()) return;
    const subs = newSubcats.split(',').map(s => s.trim()).filter(Boolean);
    addCategory({
      name: newCatName.trim(),
      color: newCatColor,
      iconName: 'FolderKanban',
      subCategories: subs.length > 0 ? subs : ['General']
    });
    setNewCatName('');
    setNewSubcats('');
  };

  const handleExport = () => {
    const jsonStr = exportStateJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimustime_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (!importJsonText.trim()) return;
    const success = importStateJson(importJsonText.trim());
    if (success) {
      setImportStatus('Backup state restored successfully!');
      setImportJsonText('');
    } else {
      setImportStatus('Invalid JSON format. Please verify the backup syntax.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Top Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-theme-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-900 dark:from-slate-800 dark:to-slate-950 flex items-center justify-center text-white shadow-lg">
            <Settings2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-black text-theme-text tracking-tight">
              Global Control & Admin Panel
            </h2>
            <p className="text-xs text-theme-muted mt-0.5">
              Customize dynamic priority minutes, categories, capacity limits, and system parameters.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (confirm('Reset entire system state to default rich demo data?')) {
              resetToDefaultData();
            }
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-theme-card-hover hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 border border-theme-border text-xs font-bold rounded-xl transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Demo Data</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Daily Capacity & Red-Line Protocol (24-Hours Locked System Tools) */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-6 relative z-20">
          <div className="flex items-center justify-between border-b border-theme-border pb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-theme-text uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                <span>Daily Capacity & Red-Line Protocol</span>
              </h3>
              <p className="text-[11px] text-theme-muted mt-0.5">
                24-Hours Locked System Tools • Work Target, Sleep Window & Automated Buffer
              </p>
            </div>
            
            {/* 24h Lock Balance Status Badge */}
            <div className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm transition-all ${
              (maxWorkHours + bufferHours + sleepHours) === 24
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                : (maxWorkHours + bufferHours + sleepHours) > 24
                  ? 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-700 animate-pulse'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
            }`}>
              {(maxWorkHours + bufferHours + sleepHours) === 24 ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>24.0h Locked & Balanced (Exact)</span>
                </>
              ) : (maxWorkHours + bufferHours + sleepHours) > 24 ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span>{(maxWorkHours + bufferHours + sleepHours)}h / 24h (+{((maxWorkHours + bufferHours + sleepHours) - 24)}h Over Red-Line)</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>{(maxWorkHours + bufferHours + sleepHours)}h / 24h ({(24 - (maxWorkHours + bufferHours + sleepHours))}h Unallocated)</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-5 text-xs">

            {/* Pillar 1: Work Time Target & Shift Window */}
            <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-theme-text text-xs flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-blue-500" />
                      <span>Work Time Target & Shift Window</span>
                    </h4>
                    <p className="text-[10px] text-theme-muted">
                      Daily deep-work capacity threshold and active working schedule boundaries
                    </p>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Target: {maxWorkHours}h
                </span>
              </div>

              {/* Work Target Quick Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-theme-muted">Target Presets:</span>
                {[10, 12, 14, 16].map((targetH) => (
                  <button
                    key={targetH}
                    type="button"
                    onClick={() => {
                      setMaxWorkHours(targetH);
                      const rem = Math.max(0, 24 - targetH - sleepHours);
                      setBufferHours(rem);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      maxWorkHours === targetH
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-theme-card text-theme-muted border border-theme-border hover:border-blue-400'
                    }`}
                  >
                    {targetH} Hours
                  </button>
                ))}
              </div>

              {/* Work Starts From & Work Ends At Time Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="font-bold text-theme-text block mb-1 text-[11px]">
                    Work Target Budget (Hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="0.5"
                    value={maxWorkHours}
                    onChange={(e) => {
                      const w = Number(e.target.value);
                      setMaxWorkHours(w);
                      const rem = Math.max(0, 24 - w - sleepHours);
                      setBufferHours(rem);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-theme-card border border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-mono font-bold text-center"
                  />
                </div>

                <div>
                  <TimePicker
                    label="Work Starts From"
                    value={dayStartTime}
                    onChange={(val) => {
                      setDayStartTime(val);
                      setSleepEndTime(val);
                    }}
                    align="right"
                  />
                </div>

                <div>
                  <TimePicker
                    label="Work Ends At"
                    value={dayEndTime}
                    onChange={(val) => {
                      setDayEndTime(val);
                      setSleepStartTime(val);
                    }}
                    align="right"
                  />
                </div>
              </div>
            </div>

            {/* Pillar 2: Estimated Sleep Time Setup */}
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-theme-text text-xs flex items-center gap-1.5">
                      <Moon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Estimated Sleep Time Setup</span>
                    </h4>
                    <p className="text-[10px] text-theme-muted">
                      Ultradian 90-minute restorative sleep cycles & anchor times
                    </p>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Sleep: {sleepHours}h ({((sleepHours * 60) / 90).toFixed(1)} Cycles)
                </span>
              </div>

              {/* 90-min Sleep Cycle Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { name: 'Sprint', hours: 6, cycles: '4.0 Cycles', start: '06:00 AM', end: '12:00 AM', badge: '6h' },
                  { name: 'Optimal', hours: 7, cycles: '4.6 Cycles', start: '06:00 AM', end: '11:00 PM', badge: '7h' },
                  { name: 'Standard', hours: 8, cycles: '5.3 Cycles', start: '07:00 AM', end: '11:00 PM', badge: '8h' },
                  { name: 'Recovery', hours: 9, cycles: '6.0 Cycles', start: '07:00 AM', end: '10:00 PM', badge: '9h' },
                ].map((preset) => {
                  const isSelected = sleepHours === preset.hours;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setSleepHours(preset.hours);
                        setDayStartTime(preset.start);
                        setDayEndTime(preset.end);
                        setSleepStartTime(preset.end);
                        setSleepEndTime(preset.start);
                        // Mandatory 24h balance: adjust buffer
                        const remainingBuffer = Math.max(0, 24 - maxWorkHours - preset.hours);
                        setBufferHours(remainingBuffer);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-indigo-100/70 dark:bg-indigo-950 border-indigo-500 ring-1 ring-indigo-500 shadow-sm'
                          : 'bg-theme-card border-theme-border hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-theme-text text-[11px]">{preset.name}</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-theme-card-hover text-theme-muted border border-theme-border'
                        }`}>
                          {preset.badge}
                        </span>
                      </div>
                      <div className="text-[10px] text-theme-muted mt-1 font-mono">
                        {preset.cycles}
                      </div>
                      <div className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                        {preset.end.slice(0, 5)} → {preset.start.slice(0, 5)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Sleep Hours Input & Bedtime/Wake-up Anchors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="font-bold text-theme-text block mb-1 text-[11px]">
                    Sleep Target (Hours)
                  </label>
                  <input
                    type="number"
                    min="4"
                    max="12"
                    step="0.5"
                    value={sleepHours}
                    onChange={(e) => {
                      const s = Number(e.target.value);
                      setSleepHours(s);
                      const rem = Math.max(0, 24 - maxWorkHours - s);
                      setBufferHours(rem);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-theme-card border border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-center"
                  />
                </div>

                <div>
                  <TimePicker
                    label="Bedtime / Sleep Anchor"
                    value={sleepStartTime}
                    onChange={(val) => {
                      setSleepStartTime(val);
                      setDayEndTime(val);
                    }}
                    align="right"
                  />
                </div>

                <div>
                  <TimePicker
                    label="Wake-Up Time Anchor"
                    value={sleepEndTime}
                    onChange={(val) => {
                      setSleepEndTime(val);
                      setDayStartTime(val);
                    }}
                    align="right"
                  />
                </div>
              </div>
            </div>

            {/* Pillar 3: Automated Buffer Time & Leisure Allocation */}
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-theme-text text-xs flex items-center gap-1.5">
                      <Coffee className="w-3.5 h-3.5 text-amber-500" />
                      <span>Automated Buffer Time & Leisure Setup</span>
                    </h4>
                    <p className="text-[10px] text-theme-muted">
                      Configured automated buffer applied between tasks (Default: 15 min) + daily whitespace hours
                    </p>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Buffer: {defaultBufferMinutes}m / task • {bufferHours}h total
                </span>
              </div>

              {/* Automated Task Buffer Quick Selector (5, 10, 15, 20, 30 min) */}
              <div className="space-y-1.5">
                <label className="font-bold text-theme-text flex items-center justify-between text-[11px]">
                  <span>Automated Buffer Time Between Tasks:</span>
                  <span className="text-amber-700 dark:text-amber-400 font-mono">
                    Currently: {defaultBufferMinutes} Minutes {defaultBufferMinutes === 15 ? '(Default 15 min)' : ''}
                  </span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { min: 5, label: '5 min', desc: 'Tight Sprint' },
                    { min: 10, label: '10 min', desc: 'Compact' },
                    { min: 15, label: '15 min', desc: 'Standard (Default)' },
                    { min: 20, label: '20 min', desc: 'Relaxed' },
                    { min: 30, label: '30 min', desc: 'Deep Breath' },
                  ].map((preset) => {
                    const isSelected = defaultBufferMinutes === preset.min;
                    return (
                      <button
                        key={preset.min}
                        type="button"
                        onClick={() => setDefaultBufferMinutes(preset.min)}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'bg-amber-100 dark:bg-amber-900/60 border-amber-500 ring-1 ring-amber-500 shadow-sm'
                            : 'bg-theme-card border-theme-border hover:border-amber-300 dark:hover:border-amber-700'
                        }`}
                      >
                        <div className="font-black text-xs text-theme-text">{preset.label}</div>
                        <div className="text-[9px] text-theme-muted mt-0.5">{preset.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Total Daily Buffer Hours Input & Leisure Presets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="font-bold text-theme-text block mb-1 text-[11px]">
                    Daily Buffer & Leisure Budget (Hours)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="12"
                    step="0.5"
                    value={bufferHours}
                    onChange={(e) => {
                      const b = Number(e.target.value);
                      setBufferHours(b);
                      setMaxWorkHours(Math.max(1, 24 - sleepHours - b));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-theme-card border border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 font-mono font-bold text-center"
                  />
                </div>

                <div>
                  <label className="font-bold text-theme-text block mb-1 text-[11px]">
                    Custom Task Buffer Minutes
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="60"
                      step="5"
                      value={defaultBufferMinutes}
                      onChange={(e) => setDefaultBufferMinutes(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text font-mono font-bold text-center"
                    />
                    <span className="text-xs font-mono text-theme-muted">min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. 24-Hour Locked System Math & Presets Tool */}
            <div className="space-y-3 p-4 rounded-xl bg-theme-card-hover border border-theme-border">
              <div className="flex justify-between items-center text-[11px] font-semibold text-theme-muted">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-500" />
                  <span>24-Hour Locked System Breakdown:</span>
                </span>
                <span className="font-mono font-bold text-theme-text">
                  {maxWorkHours}h Work • {bufferHours}h Buffer • {sleepHours}h Sleep = <strong className={(maxWorkHours + bufferHours + sleepHours) === 24 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>{(maxWorkHours + bufferHours + sleepHours)}h</strong> / 24h
                </span>
              </div>
              
              {/* Visual 24h Segmented Bar */}
              <div className="w-full h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex shadow-inner">
                <div
                  className="bg-blue-600 h-full transition-all duration-300 flex items-center justify-center text-[10px] text-white font-bold"
                  style={{ width: `${Math.min(100, (maxWorkHours / 24) * 100)}%` }}
                  title={`Work Time Target: ${maxWorkHours}h (${Math.round((maxWorkHours / 24) * 100)}%)`}
                >
                  {maxWorkHours >= 2 ? `${maxWorkHours}h Work` : ''}
                </div>
                <div
                  className="bg-amber-500 h-full transition-all duration-300 flex items-center justify-center text-[10px] text-white font-bold"
                  style={{ width: `${Math.min(100, (bufferHours / 24) * 100)}%` }}
                  title={`Buffer & Leisure: ${bufferHours}h (${Math.round((bufferHours / 24) * 100)}%)`}
                >
                  {bufferHours >= 2 ? `${bufferHours}h Buffer` : ''}
                </div>
                <div
                  className="bg-indigo-600 h-full transition-all duration-300 flex items-center justify-center text-[10px] text-white font-bold"
                  style={{ width: `${Math.min(100, (sleepHours / 24) * 100)}%` }}
                  title={`Sleep Budget: ${sleepHours}h (${Math.round((sleepHours / 24) * 100)}%)`}
                >
                  {sleepHours >= 2 ? `${sleepHours}h Sleep` : ''}
                </div>
              </div>

              {/* 24-Hour System Quick Lock Presets */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">Locked 24h Presets:</span>
                  {[
                    { label: 'Standard (14W / 3B / 7S)', w: 14, b: 3, s: 7, buf: 15 },
                    { label: 'Optimal Focus (13W / 3B / 8S)', w: 13, b: 3, s: 8, buf: 15 },
                    { label: 'Peak Sprint (16W / 2B / 6S)', w: 16, b: 2, s: 6, buf: 10 },
                    { label: 'Wellness (11W / 5B / 8S)', w: 11, b: 5, s: 8, buf: 20 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setMaxWorkHours(p.w);
                        setBufferHours(p.b);
                        setSleepHours(p.s);
                        setDefaultBufferMinutes(p.buf);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-theme-card hover:bg-theme-card-hover border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {(maxWorkHours + bufferHours + sleepHours) !== 24 && (
                  <button
                    type="button"
                    onClick={() => {
                      const balancedWork = Math.max(1, 24 - sleepHours - bufferHours);
                      setMaxWorkHours(balancedWork);
                    }}
                    className="text-[10px] font-black px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Zap className="w-3 h-3" />
                    Auto-Balance to 24h Lock
                  </button>
                )}
              </div>
            </div>

            {/* Save Status Alert Message */}
            {capacityStatusMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{capacityStatusMsg}</span>
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={handleSaveCapacity}
              className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 hover:from-blue-700 hover:via-indigo-700 hover:to-sky-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-xs"
            >
              <Check className="w-4 h-4" />
              <span>Save 24-Hours Locked Capacity & Red-Line Protocol</span>
            </button>
          </div>
        </div>

        {/* Priority Custom Time Setup (P1-P5) */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4 relative z-10">
          <div className="flex items-center justify-between border-b border-theme-border pb-3">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Priority Default Duration Setup (Minutes)
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            {(['P1', 'P2', 'P3', 'P4', 'P5'] as PriorityLevel[]).map((p) => {
              const meta = prioritySettings[p];
              return (
                <div key={p} className="flex items-center justify-between gap-3 p-2 rounded-xl bg-theme-card-hover border border-theme-border">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded font-black text-xs"
                      style={{ backgroundColor: meta.bgColor, color: meta.color }}
                    >
                      {p}
                    </span>
                    <span className="font-bold text-theme-text">{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={pMinutes[p]}
                      onChange={(e) => setPMinutes({ ...pMinutes, [p]: Number(e.target.value) })}
                      className="w-20 px-2 py-1 rounded-lg bg-theme-card border border-theme-border text-theme-text font-mono font-bold text-right"
                    />
                    <span className="font-mono text-theme-muted">min</span>
                  </div>
                </div>
              );
            })}

            <button
              onClick={handleSavePriorities}
              className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-md transition-colors mt-2"
            >
              Update Priority Minutes
            </button>
          </div>
        </div>

        {/* Default Task Adding System (Fast-Add Presets & Reduced Clicks) */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-5">
          <div className="flex items-center justify-between border-b border-theme-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2 font-display">
                <Sparkles className="w-4 h-4 text-blue-500" />
                Default Task Adding Presets (Fast-Add System)
              </h3>
              <p className="text-xs text-theme-muted mt-0.5">
                Preset defaults to reduce clicks on new task creation. Defaults are pre-applied automatically so you never get blocked even if you forget to click options.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* Fast-Add Auto-Confirmation Toggle */}
            <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="font-bold text-theme-text flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-500" />
                  <span>Fast-Add 1-Click Mode</span>
                </div>
                <p className="text-[11px] text-theme-muted">
                  Auto-confirms default priority and category so you can save tasks instantly without mandatory clicks.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={taskDefaults.autoConfirmDefaults}
                  onChange={(e) => setTaskDefaults({ ...taskDefaults, autoConfirmDefaults: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Default Priority Preset */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span>Default Priority</span>
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['P1', 'P2', 'P3', 'P4', 'P5'] as PriorityLevel[]).map((p) => {
                  const meta = prioritySettings[p];
                  const isSelected = taskDefaults.defaultPriority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTaskDefaults({ ...taskDefaults, defaultPriority: p })}
                      className={`p-2 rounded-xl text-center border font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-blue-500 shadow-sm'
                          : 'bg-theme-card-hover border-theme-border opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: isSelected ? meta.bgColor : undefined,
                        color: isSelected ? meta.color : undefined,
                        borderColor: isSelected ? meta.color : undefined
                      }}
                    >
                      <div className="text-xs font-black">{p}</div>
                      <div className="text-[10px] truncate">{meta.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Default Category Preset */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center gap-1">
                <FolderKanban className="w-3.5 h-3.5 text-emerald-500" />
                <span>Default Category</span>
              </label>
              <select
                value={taskDefaults.defaultCategory}
                onChange={(e) => setTaskDefaults({ ...taskDefaults, defaultCategory: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text font-bold text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name} ({cat.subCategories.length} subcategories)
                  </option>
                ))}
              </select>
            </div>

            {/* Default Automated Post-Task Buffer */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Coffee className="w-3.5 h-3.5 text-purple-500" />
                  <span>Default Post-Task Buffer Time</span>
                </span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                  {taskDefaults.defaultBufferMinutes} min
                </span>
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[0, 5, 10, 15, 20, 30, 45].map((bMin) => (
                  <button
                    key={bMin}
                    type="button"
                    onClick={() => setTaskDefaults({ ...taskDefaults, defaultBufferMinutes: bMin })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      taskDefaults.defaultBufferMinutes === bMin
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-theme-card text-theme-muted hover:text-theme-text border-theme-border'
                    }`}
                  >
                    {bMin === 0 ? '0m (None)' : `${bMin}m`}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Smart Slot Strategy */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>Default Start Time Strategy</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'auto-fit', label: 'Auto-Fit Next Free Slot', desc: 'Finds first non-overlapping gap' },
                  { id: 'current-time', label: 'Current Real Time (Now)', desc: 'Starts at nearest 5m tick' },
                  { id: 'work-start', label: 'Work Start Time', desc: `Starts at ${capacitySettings.dayStartTime || '06:00 AM'}` }
                ].map((strat) => (
                  <button
                    key={strat.id}
                    type="button"
                    onClick={() => setTaskDefaults({ ...taskDefaults, defaultSmartSlot: strat.id as any })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      taskDefaults.defaultSmartSlot === strat.id
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-theme-card-hover border-theme-border opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="font-bold text-theme-text text-xs">{strat.label}</div>
                    <div className="text-[10px] text-theme-muted mt-0.5">{strat.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Save Status Alert Message */}
            {taskDefaultsStatusMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{taskDefaultsStatusMsg}</span>
              </div>
            )}

            {/* Save Task Defaults Button */}
            <button
              onClick={handleSaveTaskDefaults}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Default Task Adding Presets</span>
            </button>
          </div>
        </div>

        {/* Category & SubCategory CRUD */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
          <div className="flex items-center justify-between border-b border-theme-border pb-3">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-emerald-500" />
              Category & SubCategory Management
            </h3>
          </div>

          {/* Add New Category */}
          <div className="space-y-3 p-3.5 rounded-xl bg-theme-card-hover border border-theme-border text-xs">
            <h4 className="font-bold text-theme-text">Create New Category</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Category Name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-theme-card border border-theme-border text-theme-text font-bold"
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  placeholder="Subcategories (e.g. Ops, Dev, R&D)..."
                  value={newSubcats}
                  onChange={(e) => setNewSubcats(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-theme-card border border-theme-border text-theme-text"
                />
              </div>
            </div>
            <button
              onClick={handleCreateCategory}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Category</span>
            </button>
          </div>

          {/* Existing Categories & SubCategory Management List */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {categories.map((c) => (
              <CategoryItemEditor
                key={c.id}
                category={c}
                onUpdate={updateCategory}
                onDelete={() => deleteCategory(c.id)}
              />
            ))}
          </div>
        </div>

        {/* Buffer Status & Free-Time Activity Menu Management */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
          <div className="flex items-center justify-between border-b border-theme-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-500" />
                <span>Buffer Status & Free-Time Activity Menu ({bufferCategories.length})</span>
              </h3>
              <p className="text-xs text-theme-muted mt-0.5">
                Customize activity categories and emoji tags shown in the 24H Buffer Status Note popup.
              </p>
            </div>
            <button
              onClick={resetBufferCategories}
              className="text-xs font-bold text-theme-muted hover:text-amber-600 flex items-center gap-1"
              title="Reset buffer menu categories to defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Defaults</span>
            </button>
          </div>

          {/* Buffer Category Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
            {bufferCategories.map((bCat) => (
              <div
                key={bCat.id}
                className="p-3 rounded-xl bg-theme-card-hover border border-theme-border flex items-start justify-between gap-2 group"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="text-xl shrink-0 p-1.5 rounded-lg bg-theme-card border border-theme-border/60">
                    {bCat.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-theme-text truncate">{bCat.label}</div>
                    <div className="text-[11px] text-theme-muted truncate">{bCat.desc}</div>
                  </div>
                </div>

                {bufferCategories.length > 1 && (
                  <button
                    onClick={() => deleteBufferCategory(bCat.id)}
                    className="p-1 text-theme-muted hover:text-red-500 opacity-60 group-hover:opacity-100 transition-opacity"
                    title="Delete activity tag"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Buffer Presets & Categories Management */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
          <div className="flex items-center justify-between border-b border-theme-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <span>Emergency Buffer Presets & Categories ({emergencyCategories.length})</span>
              </h3>
              <p className="text-xs text-theme-muted mt-0.5">
                Customize emergency event types, icons, and default durations shown in the Emergency BUFFER menu.
              </p>
            </div>
            <button
              onClick={resetEmergencyCategories}
              className="text-xs font-bold text-theme-muted hover:text-red-600 flex items-center gap-1"
              title="Reset emergency presets to system defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Defaults</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
            {emergencyCategories.map((eCat) => (
              <div
                key={eCat.id}
                className="p-3 rounded-xl bg-theme-card-hover border border-theme-border flex items-start justify-between gap-2 group"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="text-xl shrink-0 p-1.5 rounded-lg bg-theme-card border border-theme-border/60">
                    {eCat.emoji}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-theme-text truncate">{eCat.name}</div>
                    <div className="text-[11px] text-theme-muted font-mono">{eCat.defaultDuration} mins default</div>
                  </div>
                </div>

                {!eCat.isSystem && (
                  <button
                    onClick={() => deleteEmergencyCategory(eCat.id)}
                    className="p-1 text-theme-muted hover:text-red-500 opacity-60 group-hover:opacity-100 transition-opacity"
                    title="Delete emergency preset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Security & Access Protection Shield */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
          <div className="flex items-center justify-between border-b border-theme-border pb-3">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              Security & Master Access Gate
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPasswordProtected ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 text-amber-800'
              }`}>
              {isPasswordProtected ? 'Gate Armed' : 'Gate Disabled'}
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Protection Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-theme-card-hover border border-theme-border">
              <div>
                <strong className="text-theme-text block text-sm">Require Master Password / PIN</strong>
                <span className="text-theme-muted text-[11px]">Locks system upon startup or inactivity</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPasswordProtected}
                  onChange={(e) => setIsPasswordProtected(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {isPasswordProtected && (
              <div className="space-y-3 animate-fade-in">
                {/* Username */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                    <span>Admin Username / Display Name:</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-bold"
                  />
                </div>

                {/* Master Password */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-theme-text flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                      Master Password / PIN:
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={masterPassword}
                      onChange={(e) => setMasterPassword(e.target.value)}
                      placeholder="Enter master password..."
                      className="w-full pl-3 pr-10 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-text"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Auto-Lock Timer */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Inactivity Auto-Lock Timeout:</span>
                  </label>
                  <select
                    value={autoLockMinutes}
                    onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-bold cursor-pointer"
                  >
                    <option value={0}>Never (Stay Unlocked)</option>
                    <option value={15}>15 Minutes Inactivity</option>
                    <option value={30}>30 Minutes Inactivity (Recommended)</option>
                    <option value={60}>1 Hour Inactivity</option>
                    <option value={240}>4 Hours Inactivity</option>
                  </select>
                </div>
              </div>
            )}

            {securityStatusMsg && (
              <p className="text-xs text-emerald-500 font-bold text-center">
                {securityStatusMsg}
              </p>
            )}

            <button
              onClick={handleSaveSecurity}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Save Security Settings</span>
            </button>
          </div>
        </div>
        {/* Real-Time Cloud Database Sync (Supabase) */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
          <div className="flex items-center justify-between border-b border-theme-border pb-3">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-500" />
              Real-Time Cloud Database Sync (Supabase)
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              cloudSyncStatus === 'synced'
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                : cloudSyncStatus === 'syncing' || cloudSyncStatus === 'connecting'
                ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 animate-pulse'
                : cloudSyncStatus === 'error'
                ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              {cloudSyncStatus.toUpperCase()}
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Vercel Multi-Device One-Time Setup Callout */}
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
                <Cloud className="w-4 h-4" />
                <span>সব ডিভাইসে অটোমেটিক সিঙ্ক করার সহজ উপায় (Vercel Environment Variables)</span>
              </div>
              <p className="text-[11px] text-theme-muted leading-relaxed">
                আপনি যদি Vercel-এ একবার Environment Variables অ্যাড করে দেন, তবে <strong>যেকোনো ফোন, ট্যাব বা ল্যাপটপ</strong> থেকে এই অ্যাপ ওপেন করলে ম্যানুয়ালি কিছু সেটআপ করা লাগবে না — সব ডিভাইস সরাসরি একই ডাটাবেজের সাথে লাইভ সিঙ্ক থাকবে।
              </p>
              <div className="p-2 rounded-lg bg-theme-bg/80 border border-theme-border font-mono text-[11px] space-y-1">
                <div className="flex items-center justify-between text-theme-text">
                  <span className="text-blue-500 font-bold">VITE_SUPABASE_URL</span>
                  <span className="text-theme-muted text-[10px]">Supabase Project URL</span>
                </div>
                <div className="flex items-center justify-between text-theme-text">
                  <span className="text-emerald-500 font-bold">VITE_SUPABASE_ANON_KEY</span>
                  <span className="text-theme-muted text-[10px]">Supabase anon/public key</span>
                </div>
              </div>
              <p className="text-[10px] text-theme-muted">
                👉 <strong>Vercel Dashboard</strong> → <strong>Project</strong> → <strong>Settings</strong> → <strong>Environment Variables</strong> এ গিয়ে এই দুটি ভ্যারিয়েবল যোগ করে <strong>Redeploy</strong> করুন।
              </p>
            </div>

            {/* Cloud Sync Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-theme-card-hover border border-theme-border">
              <div>
                <strong className="text-theme-text block text-sm">Enable Cloud Database Sync</strong>
                <span className="text-theme-muted text-[11px]">Turn on to sync across phone, laptop, and web</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCloudSyncEnabled}
                  onChange={(e) => setIsCloudSyncEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>

            {/* Step 1: SQL Setup Script Box */}
            <div className="p-3.5 rounded-xl bg-theme-card-hover border border-theme-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-theme-text text-xs flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-black">1</span>
                  <span>Run SQL Script in Supabase (SQL Editor):</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                >
                  {hasCopiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{hasCopiedSql ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
                </button>
              </div>
              <p className="text-[11px] text-theme-muted">
                Open <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline font-semibold inline-flex items-center gap-0.5">Supabase Dashboard <ExternalLink className="w-2.5 h-2.5" /></a> → click <strong>SQL Editor</strong> → click <strong>New Query</strong> → paste this SQL → click <strong>Run</strong>:
              </p>
              <pre className="p-3 rounded-xl bg-theme-bg border border-theme-border font-mono text-[10px] text-theme-text overflow-x-auto select-all leading-relaxed">
                {DEFAULT_SQL_SCHEMA}
              </pre>
            </div>

            {/* Step 2: Supabase Credentials */}
            <div className="space-y-3 p-3.5 rounded-xl bg-theme-card-hover border border-theme-border">
              <span className="font-bold text-theme-text text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-black">2</span>
                <span>Enter Supabase API Credentials (from Project Settings → API):</span>
              </span>

              {/* Supabase URL */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-theme-text flex items-center justify-between">
                  <span>Supabase Project URL:</span>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline flex items-center gap-1 font-normal text-[11px]"
                  >
                    <span>Supabase Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzabcdefg.supabase.co"
                  className="w-full px-3 py-2 rounded-xl bg-theme-bg border border-theme-border text-theme-text font-mono text-xs"
                />
              </div>

              {/* Supabase Anon Key */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-theme-text flex items-center justify-between">
                  <span>Supabase Anon (Public) Key:</span>
                </label>
                <div className="relative">
                  <input
                    type={showAnonKey ? 'text' : 'password'}
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full pl-3 pr-10 py-2 rounded-xl bg-theme-bg border border-theme-border text-theme-text font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAnonKey(!showAnonKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-text"
                  >
                    {showAnonKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Real-time Broadcast Toggle */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-theme-bg border border-theme-border">
                <div>
                  <span className="font-bold text-theme-text block text-xs">Live Real-Time Subscriptions</span>
                  <span className="text-[10px] text-theme-muted">Broadcast updates immediately to all connected browsers/phones</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoRealtimeSync}
                  onChange={(e) => setAutoRealtimeSync(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 cursor-pointer"
                />
              </div>

              {/* Action Buttons: Test, Push, Pull */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConn || !supabaseUrl || !supabaseAnonKey}
                  className="py-2 px-3 rounded-xl bg-theme-bg hover:bg-theme-border border border-theme-border text-theme-text font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isTestingConn ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5 text-sky-500" />
                  )}
                  <span>Test Connection</span>
                </button>

                <button
                  type="button"
                  onClick={handlePushLocalToCloud}
                  disabled={!supabaseUrl || !supabaseAnonKey}
                  className="py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Push Local to Cloud</span>
                </button>

                <button
                  type="button"
                  onClick={handlePullCloudToLocal}
                  disabled={!supabaseUrl || !supabaseAnonKey}
                  className="py-2 px-3 rounded-xl bg-theme-bg hover:bg-theme-border border border-theme-border text-theme-text font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pull Cloud to Local</span>
                </button>
              </div>
            </div>

            {cloudStatusMsg && (
              <p className={`text-xs font-bold text-center ${cloudStatusMsg.isError ? 'text-red-500' : 'text-emerald-500'}`}>
                {cloudStatusMsg.text}
              </p>
            )}

            <button
              type="button"
              onClick={handleSaveCloudSync}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Database className="w-4 h-4" />
              <span>Save Cloud Sync Configuration</span>
            </button>
          </div>
        </div>

        {/* Complete 100% Data Backup & Recovery Hub */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
          <div className="flex items-center justify-between border-b border-theme-border pb-3 flex-wrap gap-2">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-500" />
              <span>100% System Backup & Data Hub</span>
            </h3>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-mono">
              v2.0 Vault
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <p className="text-theme-muted leading-relaxed">
              Export a complete 100% snapshot of your system (tasks, journals, rules, and settings), download a multi-sheet Excel workbook, or restore from a JSON backup.
            </p>

            {/* Hub Launcher Button */}
            <button
              onClick={() => openBackupModal('export')}
              className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-black shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2 transform active:scale-95"
            >
              <Database className="w-4 h-4" />
              <span>Open 100% Backup & Recovery Hub</span>
            </button>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                onClick={handleExport}
                className="p-2.5 rounded-xl border border-theme-border bg-theme-card-hover hover:bg-theme-border text-theme-text font-bold transition-all flex flex-col items-center text-center gap-1"
                title="Download full database + settings JSON"
              >
                <FileJson className="w-4 h-4 text-blue-500" />
                <span className="text-[11px]">Full Backup (JSON)</span>
              </button>

              <button
                onClick={() => {
                  const jsonStr = exportSettingsOnlyJson();
                  const blob = new Blob([jsonStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `optimustime_settings_profile_${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="p-2.5 rounded-xl border border-theme-border bg-theme-card-hover hover:bg-theme-border text-theme-text font-bold transition-all flex flex-col items-center text-center gap-1"
                title="Download only settings and configurations"
              >
                <Settings2 className="w-4 h-4 text-purple-500" />
                <span className="text-[11px]">Settings Profile</span>
              </button>

              <button
                onClick={() => {
                  exportTasksToExcelWorkbook(tasks, planProjects, prioritySettings);
                }}
                className="p-2.5 rounded-xl border border-theme-border bg-theme-card-hover hover:bg-theme-border text-theme-text font-bold transition-all flex flex-col items-center text-center gap-1"
                title="Download 4-sheet complete Excel tasks workbook"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span className="text-[11px]">Tasks Excel (.xlsx)</span>
              </button>
            </div>

            {/* Restore Quick Trigger & Rollback */}
            <div className="pt-3 border-t border-theme-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-theme-text text-[11px]">Quick Restore:</span>
                <button
                  onClick={() => openBackupModal('restore')}
                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>File Picker & Inspection Mode</span>
                </button>
              </div>

              {canRollback && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-[11px] font-bold text-theme-text">Safety Snapshot Available</span>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Revert system to pre-restore snapshot?')) {
                        rollbackLastRestore();
                      }
                    }}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black shadow-sm transition-all"
                  >
                    Undo / Rollback
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

interface CategoryItemEditorProps {
  category: Category;
  onUpdate: (cat: Category) => void;
  onDelete: () => void;
}

const CategoryItemEditor: React.FC<CategoryItemEditorProps> = ({
  category,
  onUpdate,
  onDelete
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameText, setEditingNameText] = useState(category.name);
  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);
  const [editingSubText, setEditingSubText] = useState('');
  const [newSubText, setNewSubText] = useState('');

  const isPermanent = ['notes', 'note', 'reminder', 'reminders'].includes(category.name.trim().toLowerCase());

  // Save renamed category
  const handleSaveCategoryName = () => {
    if (!editingNameText.trim() || isPermanent) {
      setIsEditingName(false);
      return;
    }
    onUpdate({
      ...category,
      name: editingNameText.trim()
    });
    setIsEditingName(false);
  };

  // Delete a subcategory
  const handleDeleteSub = (subToDelete: string) => {
    const updatedSubs = category.subCategories.filter(s => s !== subToDelete);
    onUpdate({
      ...category,
      subCategories: updatedSubs
    });
  };

  // Start editing a subcategory
  const handleStartEditSub = (index: number, currentText: string) => {
    setEditingSubIndex(index);
    setEditingSubText(currentText);
  };

  // Save edited subcategory
  const handleSaveEditSub = (index: number) => {
    if (!editingSubText.trim()) return;
    const updatedSubs = [...category.subCategories];
    updatedSubs[index] = editingSubText.trim();
    onUpdate({
      ...category,
      subCategories: updatedSubs
    });
    setEditingSubIndex(null);
    setEditingSubText('');
  };

  // Add new subcategory to this category
  const handleAddSub = () => {
    if (!newSubText.trim()) return;
    const trimmed = newSubText.trim();
    if (category.subCategories.includes(trimmed)) return;
    onUpdate({
      ...category,
      subCategories: [...category.subCategories, trimmed]
    });
    setNewSubText('');
  };

  return (
    <div className="rounded-xl bg-theme-card-hover border border-theme-border p-3 space-y-2.5 text-xs transition-all">
      {/* Category Header Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <input
            type="color"
            value={category.color}
            onChange={(e) => onUpdate({ ...category, color: e.target.value })}
            className="w-5 h-5 rounded-md cursor-pointer border-0 p-0 bg-transparent shrink-0"
            title="Change Category Color"
          />

          {isEditingName && !isPermanent ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={editingNameText}
                onChange={(e) => setEditingNameText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCategoryName(); }}
                className="text-xs px-2 py-0.5 rounded bg-theme-card text-theme-text font-bold border border-blue-400 focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveCategoryName}
                className="p-1 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                title="Save Category Name"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setEditingNameText(category.name);
                  setIsEditingName(false);
                }}
                className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-theme-text truncate">{category.name}</span>
              {!isPermanent && (
                <button
                  onClick={() => {
                    setEditingNameText(category.name);
                    setIsEditingName(true);
                  }}
                  className="p-0.5 text-theme-muted hover:text-blue-600 rounded transition-colors cursor-pointer"
                  title="Rename Category"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {isPermanent ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1 shrink-0">
              <Lock className="w-2.5 h-2.5" />
              <span>Permanent Core</span>
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-theme-card border border-theme-border text-theme-muted shrink-0">
              {category.subCategories.length} sub-entities
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1 rounded-lg bg-theme-card border border-theme-border hover:bg-theme-border text-theme-text font-bold flex items-center gap-1 text-[11px] cursor-pointer"
          >
            <span>Manage SubCategories</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {!isPermanent && (
            <button
              onClick={() => {
                if (confirm(`Are you sure you want to delete category "${category.name}"?`)) {
                  onDelete();
                }
              }}
              className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
              title="Delete Category"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* SubCategory Modification & CRUD Area */}
      {isExpanded && (
        <div className="p-3 rounded-lg bg-theme-card border border-theme-border space-y-2.5 animate-fade-in">
          <div className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
            SubCategories for {category.name}:
          </div>

          {/* SubCategories Chips List */}
          <div className="flex flex-wrap gap-2">
            {category.subCategories.map((sub, idx) => {
              const isEditing = editingSubIndex === idx;

              if (isEditing) {
                return (
                  <div key={idx} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-400 p-1 rounded-lg">
                    <input
                      type="text"
                      value={editingSubText}
                      onChange={(e) => setEditingSubText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditSub(idx); }}
                      className="text-xs px-1.5 py-0.5 rounded bg-theme-card text-theme-text font-bold w-28 focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEditSub(idx)}
                      className="p-0.5 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingSubIndex(null)}
                      className="p-0.5 text-red-500 hover:text-red-700 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text font-semibold text-xs hover:border-blue-300 transition-colors"
                >
                  <Tag className="w-3 h-3 text-blue-500" />
                  <span>{sub}</span>
                  <button
                    onClick={() => handleStartEditSub(idx, sub)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-muted hover:text-blue-600 transition-opacity cursor-pointer"
                    title="Rename SubCategory"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteSub(sub)}
                    className="p-0.5 text-theme-muted hover:text-red-500 transition-colors cursor-pointer"
                    title="Delete SubCategory"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add SubCategory Inline Form */}
          <div className="flex gap-1.5 pt-1">
            <input
              type="text"
              placeholder="Add new subcategory..."
              value={newSubText}
              onChange={(e) => setNewSubText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSub(); }}
              className="flex-1 text-xs px-2.5 py-1 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleAddSub}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

