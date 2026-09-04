import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PriorityLevel, Category, NamedTimePeriod, SplitScheduleSession } from '../types';
import { DEFAULT_NAMED_TIME_PERIODS, DEFAULT_SPLIT_SESSIONS } from '../context/initialData';
import { getTimePeriodForTime, getPeriodDurationMinutes, formatMinutesTo12Hour, parse12HourToMinutes, formatDurationHuman } from '../utils/timeUtils';
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
  Minus,
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
  Timer,
  Sliders,
  Activity,
  FileSpreadsheet,
  FileJson,
  Sunrise,
  Search,
  Scissors,
  ArrowRight
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
    updateDefaultTaskSettings,
    timePeriodSettings,
    updateTimePeriodSettings,
    resetTimePeriodsToDefault
  } = useApp();

  // Name of Time (Day Zones) States
  const [periodCustomizeEnabled, setPeriodCustomizeEnabled] = useState(timePeriodSettings.isEnabled);
  const [periodsList, setPeriodsList] = useState<NamedTimePeriod[]>(timePeriodSettings.periods);
  const [periodSaveMsg, setPeriodSaveMsg] = useState<string | null>(null);
  const [testTimeInput, setTestTimeInput] = useState<string>('01:30 PM');
  const [editingBoundaries, setEditingBoundaries] = useState<Record<string, string>>({});

  // Local editing states (Daily Capacity & Circadian Red-Line Protocol)
  const [maxWorkHours, setMaxWorkHours] = useState(capacitySettings.maxWorkHours);
  const [sleepHours, setSleepHours] = useState(capacitySettings.sleepHours);
  const [bufferHours, setBufferHours] = useState(capacitySettings.bufferHours);
  const [dayStartTime, setDayStartTime] = useState(capacitySettings.dayStartTime || '06:00 AM');
  const [dayEndTime, setDayEndTime] = useState(capacitySettings.dayEndTime || '11:00 PM');
  const [sleepStartTime, setSleepStartTime] = useState(capacitySettings.sleepStartTime || capacitySettings.dayEndTime || '11:00 PM');
  const [sleepEndTime, setSleepEndTime] = useState(capacitySettings.sleepEndTime || capacitySettings.dayStartTime || '06:00 AM');
  const [defaultBufferMinutes, setDefaultBufferMinutes] = useState(capacitySettings.defaultBufferMinutes ?? 0);
  const [autoSleepScheduleEnabled, setAutoSleepScheduleEnabled] = useState(Boolean(capacitySettings.autoSleepScheduleEnabled));
  const [isManualMode, setIsManualMode] = useState<boolean>(capacitySettings.isManualMode !== undefined ? Boolean(capacitySettings.isManualMode) : true);
  const [capacityStatusMsg, setCapacityStatusMsg] = useState<string | null>(null);

  // Split Schedule Sessions state (Night-Owl / Custom Polyphasic Routine)
  const [splitSessions, setSplitSessions] = useState<SplitScheduleSession[]>(
    capacitySettings.splitScheduleSessions && capacitySettings.splitScheduleSessions.length > 0
      ? capacitySettings.splitScheduleSessions
      : DEFAULT_SPLIT_SESSIONS
  );
  const [isEditingBlueprint, setIsEditingBlueprint] = useState<boolean>(false);

  const handleUpdateSplitSession = (id: string, updates: Partial<SplitScheduleSession>) => {
    setSplitSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleAddSplitSession = () => {
    const newId = `split-${Date.now()}`;
    const newSession: SplitScheduleSession = {
      id: newId,
      name: `Custom Phase ${splitSessions.length + 1}`,
      type: 'custom',
      startTime: '02:00 PM',
      endTime: '04:00 PM',
      note: 'Focus block or restorative break',
      emoji: '🎯',
      color: '#8b5cf6'
    };
    setSplitSessions(prev => [...prev, newSession]);
  };

  const handleRemoveSplitSession = (id: string) => {
    if (splitSessions.length <= 1) {
      alert('You must keep at least 1 session in your schedule blueprint.');
      return;
    }
    setSplitSessions(prev => prev.filter(s => s.id !== id));
  };

  const handleApplySplitBlueprint = () => {
    const sleepSession = splitSessions.find(s => s.type === 'sleep');
    let totalWorkMinutes = 0;
    let totalSleepMinutes = 0;

    splitSessions.forEach(s => {
      const sMin = parse12HourToMinutes(s.startTime);
      let eMin = parse12HourToMinutes(s.endTime);
      if (eMin <= sMin) eMin += 1440;
      const dur = eMin - sMin;
      if (s.type === 'sleep') {
        totalSleepMinutes += dur;
      } else {
        totalWorkMinutes += dur;
      }
    });

    if (sleepSession) {
      setSleepStartTime(sleepSession.startTime);
      setSleepEndTime(sleepSession.endTime);
      const computedSleepHours = Math.round((totalSleepMinutes / 60) * 4) / 4;
      setSleepHours(computedSleepHours);
    }

    if (splitSessions.length > 0) {
      setDayStartTime(splitSessions[0].startTime);
      setDayEndTime(splitSessions[splitSessions.length - 1].endTime);
    }

    const computedWorkHours = Math.round((totalWorkMinutes / 60) * 4) / 4;
    const computedSleepHours = Math.round((totalSleepMinutes / 60) * 4) / 4;
    const computedBufferHours = Math.max(0, Math.round((24 - computedWorkHours - computedSleepHours) * 4) / 4);

    setMaxWorkHours(computedWorkHours);
    setBufferHours(computedBufferHours);
    setIsManualMode(true);

    setCapacityStatusMsg('Split Blueprint applied to Capacity Protocol! Click "Save" below to lock changes. 🌟');
    setTimeout(() => setCapacityStatusMsg(null), 4000);
  };

  const handleResetToNightOwl = () => {
    setSplitSessions(DEFAULT_SPLIT_SESSIONS);
    setDayStartTime('12:01 AM');
    setDayEndTime('11:59 PM');
    setSleepStartTime('02:15 AM');
    setSleepEndTime('09:00 AM');
    setMaxWorkHours(15);
    setSleepHours(6.75);
    setBufferHours(2.25);
    setIsManualMode(true);
    setCapacityStatusMsg('Reset to Night-Owl Split Schedule Master Routine! ✨');
    setTimeout(() => setCapacityStatusMsg(null), 3000);
  };

  // Fast 24-Hours Auto-Balancing Engine & Manual Control
  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
  const roundQuarter = (val: number) => Math.round(val * 4) / 4;
  const roundHalf = (val: number) => Math.round(val * 2) / 2;

  const updateValue = (
    type: 'work' | 'sleep' | 'buffer',
    newValue: number
  ) => {
    const cleanVal = roundQuarter(newValue);
    if (isManualMode) {
      // 100% Manual Freedom Mode: user directly configures each pillar with zero forced cross-overwrites
      if (type === 'work') setMaxWorkHours(clamp(cleanVal, 0, 24));
      else if (type === 'sleep') setSleepHours(clamp(cleanVal, 0, 24));
      else if (type === 'buffer') setBufferHours(clamp(cleanVal, 0, 24));
      return;
    }

    // Auto-balance mode (strict 24h invariant helper)
    updateWithAutoBalance(type, newValue);
  };

  const updateWithAutoBalance = (
    type: 'work' | 'sleep' | 'buffer',
    newValue: number
  ) => {
    const rounded = roundHalf(newValue);

    if (type === 'work') {
      const newW = clamp(rounded, 1, 19.5);
      let newS = sleepHours;
      let newB = roundHalf(24 - newW - newS);
      if (newB < 0.5) {
        newB = 0.5;
        newS = roundHalf(24 - newW - newB);
        if (newS < 4) {
          newS = 4;
          newB = roundHalf(24 - newW - newS);
        }
      }
      setMaxWorkHours(newW);
      setBufferHours(newB);
      setSleepHours(newS);
    } else if (type === 'sleep') {
      const newS = clamp(rounded, 4, 12);
      let newW = maxWorkHours;
      let newB = roundHalf(24 - newW - newS);
      if (newB < 0.5) {
        newB = 0.5;
        newW = roundHalf(24 - newS - newB);
        if (newW < 1) {
          newW = 1;
          newB = roundHalf(24 - newW - newS);
        }
      }
      setSleepHours(newS);
      setBufferHours(newB);
      setMaxWorkHours(newW);
    } else if (type === 'buffer') {
      const newB = clamp(rounded, 0.5, 12);
      let newS = sleepHours;
      let newW = roundHalf(24 - newB - newS);
      if (newW < 1) {
        newW = 1;
        newS = roundHalf(24 - newW - newB);
        if (newS < 4) {
          newS = 4;
          newW = roundHalf(24 - newB - newS);
        }
      }
      setBufferHours(newB);
      setMaxWorkHours(newW);
      setSleepHours(newS);
    }
  };

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

  // Modern UI/UX Navigation Tab & Search State
  const [activeTab, setActiveTab] = useState<'all' | 'capacity' | 'tasks' | 'categories' | 'security'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Keep Capacity editing state synced when capacitySettings updates in context
  React.useEffect(() => {
    setMaxWorkHours(capacitySettings.maxWorkHours);
    setSleepHours(capacitySettings.sleepHours);
    setBufferHours(capacitySettings.bufferHours);
    setDayStartTime(capacitySettings.dayStartTime || '06:00 AM');
    setDayEndTime(capacitySettings.dayEndTime || '11:00 PM');
    setSleepStartTime(capacitySettings.sleepStartTime || capacitySettings.dayEndTime || '11:00 PM');
    setSleepEndTime(capacitySettings.sleepEndTime || capacitySettings.dayStartTime || '06:00 AM');
    setDefaultBufferMinutes(capacitySettings.defaultBufferMinutes ?? 0);
    setAutoSleepScheduleEnabled(Boolean(capacitySettings.autoSleepScheduleEnabled));
    setIsManualMode(capacitySettings.isManualMode !== undefined ? Boolean(capacitySettings.isManualMode) : true);
    if (capacitySettings.splitScheduleSessions && capacitySettings.splitScheduleSessions.length > 0) {
      setSplitSessions(capacitySettings.splitScheduleSessions);
    }
  }, [capacitySettings]);

  // Keep task defaults synced when context updates
  React.useEffect(() => {
    if (defaultTaskSettings) {
      setTaskDefaults(defaultTaskSettings);
    }
  }, [defaultTaskSettings]);

  // Keep Day Zones (Name of Time) synced when context updates
  React.useEffect(() => {
    if (timePeriodSettings) {
      setPeriodCustomizeEnabled(timePeriodSettings.isEnabled);
      setPeriodsList(timePeriodSettings.periods || []);
    }
  }, [timePeriodSettings]);

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

  // =============================================================
  // 24-HOURS NAME ENGINE: CONTIGUOUS RING & SMART SPLITTING
  // Invariant: sum(duration) == 1440m (24.0h), zero overlaps, zero gaps
  // =============================================================

  // Compute total duration covered across all zones
  const totalZoneMinutes = periodsList.reduce((acc, p) => acc + getPeriodDurationMinutes(p), 0);
  const totalZoneHours = (totalZoneMinutes / 60).toFixed(1);

  // 1. Update zone metadata (name, emoji, color)
  const handlePeriodMetaChange = (id: string, field: 'name' | 'emoji' | 'color', val: string) => {
    setPeriodsList(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  // 2. Commit boundary between Zone index and Zone (index + 1)
  // Supports 12-hour (e.g. "09:30 AM", "2 PM") and 24-hour ("14:30", "09:00") inputs
  const handleCommitBoundary = (index: number, rawValue: string) => {
    const list = [...periodsList];
    if (list.length <= 1) return;

    const trimmed = rawValue.trim();
    if (!trimmed) {
      setEditingBoundaries(prev => {
        const next = { ...prev };
        delete next[`end_${index}`];
        return next;
      });
      return;
    }

    const newEndMin = parse12HourToMinutes(trimmed);
    const cleanTimeStr = formatMinutesTo12Hour(newEndMin);
    const nextIndex = (index + 1) % list.length;

    list[index] = { ...list[index], endTime: cleanTimeStr };
    list[nextIndex] = { ...list[nextIndex], startTime: cleanTimeStr };

    setPeriodsList(list);
    setEditingBoundaries(prev => {
      const next = { ...prev };
      delete next[`end_${index}`];
      return next;
    });
  };

  // 2b. Commit Master Day Anchor Start Time (Zone #1 start and final zone's end)
  const handleCommitStartAnchor = (rawValue: string) => {
    const list = [...periodsList];
    if (list.length === 0) return;

    const trimmed = rawValue.trim();
    if (!trimmed) {
      setEditingBoundaries(prev => {
        const next = { ...prev };
        delete next['start_0'];
        return next;
      });
      return;
    }

    const startMin = parse12HourToMinutes(trimmed);
    const cleanTimeStr = formatMinutesTo12Hour(startMin);
    const lastIndex = list.length - 1;

    list[0] = { ...list[0], startTime: cleanTimeStr };
    list[lastIndex] = { ...list[lastIndex], endTime: cleanTimeStr };

    setPeriodsList(list);
    setEditingBoundaries(prev => {
      const next = { ...prev };
      delete next['start_0'];
      return next;
    });
  };

  // 3. 1-Click Stepper Nudge (Shift boundary by +/-15 minutes)
  const handleNudgeBoundary = (index: number, deltaMinutes: number) => {
    const list = [...periodsList];
    if (list.length <= 1) return;

    const curEndMin = parse12HourToMinutes(list[index].endTime);
    const nextEndMin = (curEndMin + deltaMinutes + 1440) % 1440;
    const cleanTimeStr = formatMinutesTo12Hour(nextEndMin);
    const nextIndex = (index + 1) % list.length;

    list[index] = { ...list[index], endTime: cleanTimeStr };
    list[nextIndex] = { ...list[nextIndex], startTime: cleanTimeStr };

    setPeriodsList(list);
    setEditingBoundaries(prev => {
      const next = { ...prev };
      delete next[`end_${index}`];
      return next;
    });
  };

  // 4. Split Zone: 1-click bisect any zone into two balanced halves with zero gaps!
  const handleSplitPeriod = (index: number) => {
    const list = [...periodsList];
    const target = list[index];
    if (!target) return;

    const startMin = parse12HourToMinutes(target.startTime);
    const duration = getPeriodDurationMinutes(target);
    if (duration < 30) {
      alert('Zone duration is too short (< 30 minutes) to split.');
      return;
    }

    const halfDuration = Math.round(duration / 2);
    const midMin = (startMin + halfDuration) % 1440;
    const midTimeStr = formatMinutesTo12Hour(midMin);

    const firstHalf: NamedTimePeriod = {
      ...target,
      endTime: midTimeStr
    };

    const secondHalf: NamedTimePeriod = {
      id: `period-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${target.name.replace(/ \(Part \d+\)$/, '')} (Part 2)`,
      startTime: midTimeStr,
      endTime: target.endTime,
      emoji: target.emoji || '⚡',
      color: target.color || '#3b82f6'
    };

    list.splice(index, 1, firstHalf, secondHalf);
    setPeriodsList(list);
    setPeriodSaveMsg(`Split "${target.name}" into two ${(halfDuration / 60).toFixed(1)}h zones! ✂️`);
    setTimeout(() => setPeriodSaveMsg(null), 3000);
  };

  // 5. Smart Add Zone: automatically finds the longest zone in the 24h day and splits it!
  const handleAddPeriod = () => {
    if (periodsList.length === 0) {
      setPeriodsList(DEFAULT_NAMED_TIME_PERIODS);
      return;
    }

    let longestIdx = 0;
    let maxDur = 0;
    periodsList.forEach((p, idx) => {
      const dur = getPeriodDurationMinutes(p);
      if (dur > maxDur) {
        maxDur = dur;
        longestIdx = idx;
      }
    });

    handleSplitPeriod(longestIdx);
  };

  // 6. Delete Zone: cleanly merges deleted zone's slice into previous zone (preserves 24h total)
  const handleDeletePeriod = (id: string) => {
    if (periodsList.length <= 1) {
      alert('You must keep at least one named time period to cover the 24-hour cycle.');
      return;
    }

    const index = periodsList.findIndex(p => p.id === id);
    if (index === -1) return;

    const list = [...periodsList];
    const prevIndex = (index - 1 + list.length) % list.length;
    
    // Merge deleted zone's time slice into previous zone
    list[prevIndex] = {
      ...list[prevIndex],
      endTime: list[index].endTime
    };

    list.splice(index, 1);
    setPeriodsList(list);
  };

  // 7. Preset Profiles
  const applyPreset = (presetType: 'classic' | 'executive' | 'quarter' | 'circadian') => {
    let newPeriods: NamedTimePeriod[] = [];
    if (presetType === 'classic') {
      newPeriods = DEFAULT_NAMED_TIME_PERIODS;
    } else if (presetType === 'executive') {
      newPeriods = [
        { id: 'exec-1', name: 'Morning Routine & Fitness', startTime: '05:00 AM', endTime: '08:30 AM', emoji: '🧘', color: '#f59e0b' },
        { id: 'exec-2', name: 'Deep Work Block', startTime: '08:30 AM', endTime: '01:00 PM', emoji: '⚡', color: '#3b82f6' },
        { id: 'exec-3', name: 'Execution & Meetings', startTime: '01:00 PM', endTime: '05:30 PM', emoji: '💼', color: '#10b981' },
        { id: 'exec-4', name: 'Evening & Family', startTime: '05:30 PM', endTime: '10:00 PM', emoji: '🏡', color: '#f97316' },
        { id: 'exec-5', name: 'Deep Sleep & Recovery', startTime: '10:00 PM', endTime: '05:00 AM', emoji: '💤', color: '#6366f1' }
      ];
    } else if (presetType === 'quarter') {
      newPeriods = [
        { id: 'q-1', name: 'Morning Quad', startTime: '06:00 AM', endTime: '12:00 PM', emoji: '🌅', color: '#f59e0b' },
        { id: 'q-2', name: 'Afternoon Quad', startTime: '12:00 PM', endTime: '06:00 PM', emoji: '☀️', color: '#3b82f6' },
        { id: 'q-3', name: 'Evening Quad', startTime: '06:00 PM', endTime: '12:00 AM', emoji: '🌆', color: '#8b5cf6' },
        { id: 'q-4', name: 'Night Sleep Quad', startTime: '12:00 AM', endTime: '06:00 AM', emoji: '🌙', color: '#1e293b' }
      ];
    } else if (presetType === 'circadian') {
      newPeriods = [
        { id: 'bio-1', name: 'Dawn Awakening', startTime: '05:30 AM', endTime: '08:30 AM', emoji: '🌄', color: '#f59e0b' },
        { id: 'bio-2', name: 'Peak Cognitive Window', startTime: '08:30 AM', endTime: '12:30 PM', emoji: '🧠', color: '#3b82f6' },
        { id: 'bio-3', name: 'Midday Siesta / Reset', startTime: '12:30 PM', endTime: '03:30 PM', emoji: '🌿', color: '#10b981' },
        { id: 'bio-4', name: 'Secondary Focus', startTime: '03:30 PM', endTime: '07:30 PM', emoji: '🎯', color: '#f97316' },
        { id: 'bio-5', name: 'Wind Down & Reflection', startTime: '07:30 PM', endTime: '11:00 PM', emoji: '🕯️', color: '#8b5cf6' },
        { id: 'bio-6', name: 'Cellular Restoration', startTime: '11:00 PM', endTime: '05:30 AM', emoji: '🛌', color: '#475569' }
      ];
    }

    setPeriodsList(newPeriods);
    setPeriodCustomizeEnabled(true);
    updateTimePeriodSettings({
      isEnabled: true,
      periods: newPeriods
    });
    setPeriodSaveMsg(`Applied ${presetType.toUpperCase()} 24h Profile! All zones synchronized across the app ✨`);
    setTimeout(() => setPeriodSaveMsg(null), 3500);
  };

  const handleResetPeriods = () => {
    if (confirm('Reset all Day Zones to standard 7 contiguous 24-hour periods?')) {
      setPeriodsList(DEFAULT_NAMED_TIME_PERIODS);
      setPeriodCustomizeEnabled(true);
      resetTimePeriodsToDefault();
      setPeriodSaveMsg('Reset to default 24-Hour Day Zones! 🌅');
      setTimeout(() => setPeriodSaveMsg(null), 3500);
    }
  };

  const handleSavePeriods = () => {
    updateTimePeriodSettings({
      isEnabled: periodCustomizeEnabled,
      periods: periodsList
    });
    try {
      localStorage.setItem('optimustime_app_state_v2_time_periods', JSON.stringify({
        isEnabled: periodCustomizeEnabled,
        periods: periodsList
      }));
    } catch (e) {
      console.error('Failed to direct save periods', e);
    }
    setPeriodSaveMsg('24-Hour Name Engine saved! Active across all views & calculations ✨');
    setTimeout(() => setPeriodSaveMsg(null), 3500);
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
    const chosenBuffer = taskDefaults.defaultBufferMinutes !== undefined
      ? taskDefaults.defaultBufferMinutes
      : (capacitySettings.defaultBufferMinutes !== undefined ? capacitySettings.defaultBufferMinutes : 0);

    updateCapacitySettings({
      ...capacitySettings,
      maxWorkHours: Number(maxWorkHours),
      sleepHours: Number(sleepHours),
      bufferHours: Number(bufferHours),
      dayStartTime,
      dayEndTime,
      sleepStartTime,
      sleepEndTime,
      defaultBufferMinutes: Number(chosenBuffer),
      autoSleepScheduleEnabled,
      isManualMode,
      splitScheduleSessions: splitSessions
    });

    updateDefaultTaskSettings({
      ...taskDefaults,
      defaultBufferMinutes: Number(chosenBuffer)
    });

    setCapacityStatusMsg('Capacity & Circadian Red-Line Protocol saved successfully! ✅');
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
    const chosenBuffer = taskDefaults.defaultBufferMinutes !== undefined ? taskDefaults.defaultBufferMinutes : 0;
    updateDefaultTaskSettings({
      ...taskDefaults,
      defaultBufferMinutes: chosenBuffer
    });

    updateCapacitySettings({
      ...capacitySettings,
      defaultBufferMinutes: chosenBuffer
    });

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

  // Smart Visibility Checker for Search & Tab Navigation
  const isCardVisible = (cardId: 'capacity' | 'priorities' | 'taskDefaults' | 'dayZones' | 'categories' | 'bufferStatus' | 'security' | 'cloudSync' | 'backupHub') => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const keywordsMap: Record<string, string[]> = {
        capacity: ['capacity', 'hours', 'sleep', 'buffer', '24h', 'work target', 'bedtime', 'wake', 'red-line', 'protocol', 'balance', 'shift'],
        priorities: ['priority', 'p1', 'p2', 'p3', 'p4', 'p5', 'duration', 'minutes', 'rules'],
        taskDefaults: ['task defaults', 'presets', 'fast-add', 'category', 'start time', 'strategy', 'buffer', '1-click'],
        dayZones: ['day zones', 'time period', 'morning', 'night', 'lunch', '24-hour clock', 'clock', 'nomenclature', 'periods'],
        categories: ['category', 'subcategory', 'tags', 'color', 'entities', 'crud', 'manage'],
        bufferStatus: ['buffer status', 'free time', 'activity menu', 'coffee', 'exercise', 'nap', 'reading', 'meditation'],
        security: ['security', 'password', 'pin', 'gate', 'lock', 'username', 'admin', 'protect', 'access'],
        cloudSync: ['cloud', 'supabase', 'database', 'sync', 'realtime', 'sql', 'multi-device', 'anon key', 'url', 'vercel'],
        backupHub: ['backup', 'restore', 'export', 'excel', 'json', 'recovery', 'vault', 'xlsx', 'snapshot', 'rollback']
      };
      const keys = keywordsMap[cardId] || [];
      return keys.some(k => k.includes(q));
    }

    if (activeTab === 'all') return true;
    if (activeTab === 'capacity') return cardId === 'capacity';
    if (activeTab === 'tasks') return ['priorities', 'taskDefaults', 'dayZones'].includes(cardId);
    if (activeTab === 'categories') return ['categories', 'bufferStatus'].includes(cardId);
    if (activeTab === 'security') return ['security', 'cloudSync', 'backupHub'].includes(cardId);
    return true;
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Top Banner & Command Navigation Hub */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-theme-border space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-950 text-white flex items-center justify-center shadow-md shadow-slate-900/20 shrink-0">
              <Settings2 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-theme-text tracking-tight font-display">
                  Global Control & Admin Panel
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono border border-blue-200 dark:border-blue-800">
                  Engine v2.0
                </span>
              </div>
              <p className="text-xs text-theme-muted mt-0.5">
                Dynamic priority minutes, 24h capacity limits, system presets, and multi-device cloud parameters.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (confirm('Are you sure you want to empty all tasks, notes, buffer logs, and projects, and reset to clean default settings?')) {
                resetToDefaultData();
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-theme-card-hover hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 border border-theme-border text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-98"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear All Tasks & Reset Defaults</span>
          </button>
        </div>

        {/* Category Navigation Tabs & Quick Search */}
        <div className="pt-2 border-t border-theme-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Fast Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'All Settings', icon: Sliders },
              { id: 'capacity', label: 'Capacity & Schedule', icon: ShieldCheck },
              { id: 'tasks', label: 'Tasks & Day Zones', icon: Sparkles },
              { id: 'categories', label: 'Categories & Buffers', icon: FolderKanban },
              { id: 'security', label: 'Security & Cloud Sync', icon: Lock },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setSearchQuery('');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 ring-1 ring-blue-500'
                      : 'bg-theme-card-hover text-theme-muted hover:text-theme-text hover:bg-theme-border border border-theme-border'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-blue-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Search Box */}
          <div className="relative shrink-0 sm:w-64">
            <Search className="w-3.5 h-3.5 text-theme-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Quick search settings..."
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-theme-card border border-theme-border text-theme-text placeholder:text-theme-muted focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-text cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${activeTab === 'capacity' ? 'max-w-4xl mx-auto' : 'lg:grid-cols-2'} gap-5`}>

        {/* Daily Capacity & Red-Line Protocol (24-Hours Locked System Tools) */}
        {isCardVisible('capacity') && (
        <div className={`glass-panel p-5 sm:p-6 rounded-2xl border border-theme-border space-y-5 relative z-20 ${activeTab === 'capacity' ? 'lg:col-span-2' : ''}`}>
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
            
            {/* Mode Switcher & Allocation Summary Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsManualMode(!isManualMode)}
                className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                  isManualMode
                    ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                }`}
                title={isManualMode ? "Switch to 24.0h Auto-Balanced Protocol" : "Switch to Full Manual Control Mode"}
              >
                {isManualMode ? (
                  <>
                    <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>⚙️ Manual Control Mode (Unlocked)</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>🔒 24.0h Auto-Balanced Protocol</span>
                  </>
                )}
              </button>
              
              {/* Live Hours Sum Pill */}
              <div className={`px-2.5 py-1 rounded-full font-mono text-[11px] font-black border ${
                Math.abs((maxWorkHours + bufferHours + sleepHours) - 24) < 0.05
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-700'
              }`}>
                {(maxWorkHours + bufferHours + sleepHours).toFixed(1)}h / 24h
              </div>
            </div>
          </div>

          <div className="space-y-5 text-xs">

            {/* Dedicated Split Routine Blueprint: Fully Editable & Customizable for any Schedule */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-blue-500/10 border-2 border-indigo-300/80 dark:border-indigo-800/80 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🌙</span>
                    <h4 className="font-black text-theme-text text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <span>Split Schedule Blueprint</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-mono font-bold text-[9px]">
                        Master Routine
                      </span>
                    </h4>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    Configure your segmented daily routine: each phase below is fully editable in real-time.
                  </p>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={handleResetToNightOwl}
                    className="px-3 py-1.5 rounded-xl bg-theme-card hover:bg-theme-card-hover border border-theme-border text-theme-muted hover:text-theme-text font-bold text-[11px] transition-all cursor-pointer"
                    title="Reset to 12:01 AM - 2:15 AM / 2:15 AM - 9:00 AM / 9:00 AM - 11:59 PM default"
                  >
                    Reset Default Night-Owl
                  </button>

                  <button
                    type="button"
                    onClick={handleApplySplitBlueprint}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Apply these exact session times directly to Work Starts, Work Ends, Bedtime, Wake-up, and Capacity Targets"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Apply to Schedule Protocol</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Editable Session Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {splitSessions.map((session, index) => {
                  const sMin = parse12HourToMinutes(session.startTime);
                  let eMin = parse12HourToMinutes(session.endTime);
                  if (eMin <= sMin) eMin += 1440;
                  const durMin = eMin - sMin;
                  const durHuman = formatDurationHuman(durMin);

                  const isSleep = session.type === 'sleep';
                  const isWork = session.type === 'work';
                  const isBuffer = session.type === 'buffer';

                  const cardBg = isSleep
                    ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/70'
                    : isWork
                    ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/70'
                    : isBuffer
                    ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/70'
                    : 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/70';

                  const badgeColor = isSleep
                    ? 'text-indigo-700 dark:text-indigo-300'
                    : isWork
                    ? 'text-blue-700 dark:text-blue-300'
                    : isBuffer
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-purple-700 dark:text-purple-300';

                  return (
                    <div
                      key={session.id || `split-${index}`}
                      className={`p-3 rounded-2xl border ${cardBg} space-y-2.5 transition-all shadow-2xs relative group`}
                    >
                      {/* Top Row: Type Selector & Delete */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={session.type}
                            onChange={(e) => handleUpdateSplitSession(session.id, { type: e.target.value as any })}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-theme-card border border-theme-border text-theme-text focus:outline-none cursor-pointer"
                          >
                            <option value="work">⚡ Work Focus</option>
                            <option value="sleep">🌙 Sleep Window</option>
                            <option value="buffer">☕ Buffer / Rest</option>
                            <option value="custom">🎯 Custom Phase</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className={`text-[11px] font-mono font-black ${badgeColor}`}>
                            {durHuman}
                          </span>
                          {splitSessions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSplitSession(session.id)}
                              className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                              title="Delete this phase"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Title Input */}
                      <div>
                        <input
                          type="text"
                          value={session.name}
                          onChange={(e) => handleUpdateSplitSession(session.id, { name: e.target.value })}
                          placeholder="Session title..."
                          className="w-full text-xs font-bold bg-theme-card/80 border border-theme-border/80 rounded-lg px-2 py-1 text-theme-text placeholder:text-theme-muted focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                        />
                      </div>

                      {/* Time Pickers (Start & End) */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <TimePicker
                            label="Start"
                            value={session.startTime}
                            onChange={(val) => handleUpdateSplitSession(session.id, { startTime: val })}
                          />
                        </div>
                        <div>
                          <TimePicker
                            label="End"
                            value={session.endTime}
                            onChange={(val) => handleUpdateSplitSession(session.id, { endTime: val })}
                          />
                        </div>
                      </div>

                      {/* Notes / Description Input */}
                      <div>
                        <input
                          type="text"
                          value={session.note || ''}
                          onChange={(e) => handleUpdateSplitSession(session.id, { note: e.target.value })}
                          placeholder="Note / focus directive..."
                          className="w-full text-[10px] bg-theme-card/70 border border-theme-border/60 rounded-lg px-2 py-0.5 text-theme-muted placeholder:text-theme-muted/60 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Phase & Summary Row */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-indigo-200/60 dark:border-indigo-900/60">
                <button
                  type="button"
                  onClick={handleAddSplitSession}
                  className="px-3 py-1.5 rounded-xl bg-theme-card hover:bg-theme-card-hover border border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Split Phase</span>
                </button>

                <div className="text-[11px] text-theme-muted flex items-center gap-2">
                  <span>💡 Tip: Click <strong>"Apply to Schedule Protocol"</strong> to push session times to the settings below.</span>
                </div>
              </div>
            </div>

            {/* Pillar 1: Work Time Target & Shift Window */}
            <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
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
                <div className="flex items-center gap-2">
                  {(() => {
                    let sMin = parse12HourToMinutes(dayStartTime);
                    let eMin = parse12HourToMinutes(dayEndTime);
                    if (eMin <= sMin) eMin += 1440;
                    return (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-100/60 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Shift Span: {formatDurationHuman(eMin - sMin)}
                      </span>
                    );
                  })()}
                  <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Target: {maxWorkHours}h ({Math.round(maxWorkHours * 60)}m)
                  </span>
                </div>
              </div>

              {/* Work Target Quick Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-theme-muted">Target Presets:</span>
                {[10, 12, 14, 15, 16].map((targetH) => (
                  <button
                    key={targetH}
                    type="button"
                    onClick={() => updateValue('work', targetH)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      maxWorkHours === targetH
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-theme-card text-theme-muted border border-theme-border hover:border-blue-400'
                    }`}
                  >
                    {targetH} Hours
                  </button>
                ))}
              </div>

              {/* Work Starts From & Work Ends At Time Pickers + Exact Hours & Minutes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="font-bold text-theme-text block mb-1 text-[11px]">
                    Work Target Budget
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Hours Stepper */}
                    <div>
                      <div className="text-[9px] text-theme-muted mb-0.5 font-semibold">Hours</div>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => updateValue('work', Math.max(0, maxWorkHours - 1))}
                          className="h-8 px-2 rounded-l-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/60 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 border border-r-0 border-blue-300 dark:border-blue-700 transition-colors flex items-center justify-center font-bold active:scale-95 cursor-pointer"
                          title="Decrease 1 Hour"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="24"
                          value={Math.floor(maxWorkHours)}
                          onChange={(e) => {
                            const newH = Math.max(0, parseInt(e.target.value, 10) || 0);
                            const currentM = Math.round((maxWorkHours % 1) * 60);
                            updateValue('work', newH + currentM / 60);
                          }}
                          className="w-full h-8 bg-theme-card border-y border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 font-mono font-bold text-center text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateValue('work', Math.min(24, maxWorkHours + 1))}
                          className="h-8 px-2 rounded-r-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/60 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 border border-l-0 border-blue-300 dark:border-blue-700 transition-colors flex items-center justify-center font-bold active:scale-95 cursor-pointer"
                          title="Increase 1 Hour"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Minutes Stepper */}
                    <div>
                      <div className="text-[9px] text-theme-muted mb-0.5 font-semibold">Minutes</div>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => updateValue('work', Math.max(0, maxWorkHours - 0.25))}
                          className="h-8 px-2 rounded-l-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/60 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 border border-r-0 border-blue-300 dark:border-blue-700 transition-colors flex items-center justify-center font-bold active:scale-95 cursor-pointer"
                          title="Decrease 15 Minutes"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          step="15"
                          value={Math.round((maxWorkHours % 1) * 60)}
                          onChange={(e) => {
                            const newM = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0));
                            const currentH = Math.floor(maxWorkHours);
                            updateValue('work', currentH + newM / 60);
                          }}
                          className="w-full h-8 bg-theme-card border-y border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 font-mono font-bold text-center text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateValue('work', Math.min(24, maxWorkHours + 0.25))}
                          className="h-8 px-2 rounded-r-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/60 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 border border-l-0 border-blue-300 dark:border-blue-700 transition-colors flex items-center justify-center font-bold active:scale-95 cursor-pointer"
                          title="Increase 15 Minutes"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <TimePicker
                    label="Work Starts From"
                    value={dayStartTime}
                    onChange={(val) => {
                      setDayStartTime(val);
                      if (!isManualMode) {
                        setSleepEndTime(val);
                      }
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
                      if (!isManualMode) {
                        setSleepStartTime(val);
                      }
                    }}
                    align="right"
                  />
                </div>
              </div>
            </div>



            {/* Pillar 3: Daily Buffer & Leisure Budget (Macro Allocation) */}
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-theme-text text-xs flex items-center gap-1.5">
                      <Coffee className="w-3.5 h-3.5 text-amber-500" />
                      <span>Daily Buffer & Leisure Budget</span>
                    </h4>
                    <p className="text-[10px] text-theme-muted">
                      Allocated daily whitespace, restorative breathing room, and transition downtime balancing your 24-hour cycle
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const remaining = Math.max(0, Math.round((24 - maxWorkHours - sleepHours) * 4) / 4);
                      updateValue('buffer', remaining);
                    }}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                    title="Calculate remaining hours to complete 24.0h"
                  >
                    🎯 Auto-Balance to 24h ({Math.max(0, 24 - maxWorkHours - sleepHours).toFixed(2)}h)
                  </button>
                  <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Buffer: {bufferHours}h total ({Math.round(bufferHours * 60)}m)
                  </span>
                </div>
              </div>

              {/* Quick Macro Buffer Budget Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-theme-muted">Buffer Presets:</span>
                {[
                  { label: '1.5 Hours', hours: 1.5 },
                  { label: '2.0 Hours', hours: 2.0 },
                  { label: '2.25 Hours', hours: 2.25 },
                  { label: '3.0 Hours', hours: 3.0 },
                  { label: '4.0 Hours', hours: 4.0 },
                  { label: '5.0 Hours', hours: 5.0 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => updateValue('buffer', preset.hours)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      Math.abs(bufferHours - preset.hours) < 0.1
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-theme-card text-theme-muted border border-theme-border hover:border-amber-400'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Buffer Hours & Minutes Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="font-bold text-theme-text block mb-1 text-[11px]">
                    Daily Buffer Target Budget
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Hours Stepper */}
                    <div>
                      <div className="text-[9px] text-theme-muted mb-0.5 font-semibold">Hours</div>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => updateValue('buffer', Math.max(0, bufferHours - 1))}
                          className="h-8 px-2 rounded-l-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800 text-amber-700 dark:text-amber-300 border border-r-0 border-amber-300 dark:border-amber-700 transition-colors flex items-center justify-center font-bold active:scale-95 cursor-pointer"
                          title="Decrease 1 Hour"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="24"
                          value={Math.floor(bufferHours)}
                          onChange={(e) => {
                            const newH = Math.max(0, parseInt(e.target.value, 10) || 0);
                            const currentM = Math.round((bufferHours % 1) * 60);
                            updateValue('buffer', newH + currentM / 60);
                          }}
                          className="w-full h-8 bg-theme-card border-y border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 font-mono font-bold text-center text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateValue('buffer', Math.min(24, bufferHours + 1))}
                          className="h-8 px-2 rounded-r-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800 text-amber-700 dark:text-amber-300 border border-l-0 border-amber-300 dark:border-amber-700 transition-colors flex items-center justify-center font-bold active:scale-95 cursor-pointer"
                          title="Increase 1 Hour"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Minutes Stepper */}
                    <div>
                      <div className="text-[9px] text-theme-muted mb-0.5 font-semibold">Minutes</div>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => updateValue('buffer', Math.max(0, bufferHours - 0.25))}
                          className="h-8 px-2 rounded-l-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800 text-amber-700 dark:text-amber-300 border border-r-0 border-amber-300 dark:border-amber-700 transition-colors flex items-center justify-center font-bold active:scale-95 cursor-pointer"
                          title="Decrease 15 Minutes"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          step="15"
                          value={Math.round((bufferHours % 1) * 60)}
                          onChange={(e) => {
                            const newM = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0));
                            const currentH = Math.floor(bufferHours);
                            updateValue('buffer', currentH + newM / 60);
                          }}
                          className="w-full h-8 bg-theme-card border-y border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 font-mono font-bold text-center text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateValue('buffer', Math.min(24, bufferHours + 0.25))}
                          className="h-8 px-2 rounded-r-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800 text-amber-700 dark:text-amber-300 border border-l-0 border-amber-300 dark:border-amber-700 transition-colors flex items-center justify-center font-bold active:scale-95 cursor-pointer"
                          title="Increase 15 Minutes"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-theme-text block mb-1 text-[11px]">
                    Automated Task Break Buffer (Minutes)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="120"
                      step="5"
                      value={defaultBufferMinutes}
                      onChange={(e) => setDefaultBufferMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-24 h-8 bg-theme-card border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 font-mono font-bold text-center text-xs rounded-lg focus:outline-none"
                    />
                    <div className="flex items-center gap-1 flex-wrap">
                      {[0, 5, 10, 15, 20, 30].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDefaultBufferMinutes(m)}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            defaultBufferMinutes === m
                              ? 'bg-amber-500 text-white'
                              : 'bg-theme-card border border-theme-border text-theme-muted hover:border-amber-400'
                          }`}
                        >
                          {m === 0 ? 'None' : `${m}m`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Daily Allocation Bar & Presets */}
            <div className="space-y-3 p-4 rounded-2xl bg-theme-card/60 dark:bg-theme-card/40 border border-theme-border/80 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-theme-text text-[11px] uppercase tracking-wider">
                    Daily Capacity Distribution
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {maxWorkHours}h Work
                  </span>
                  <span className="text-theme-muted/40">•</span>
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {bufferHours}h Buffer
                  </span>
                  <span className="text-theme-muted/40">•</span>
                  <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    {sleepHours}h Sleep
                  </span>
                </div>
              </div>

              {/* Visual Segmented Bar */}
              {(() => {
                const totalHours = Math.max(0.1, maxWorkHours + bufferHours + sleepHours);
                const denom = Math.max(24, totalHours);
                return (
                  <div className="w-full h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex p-0.5 border border-theme-border/60 shadow-inner gap-0.5">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-blue-500 h-full rounded-l-full transition-all duration-300 flex items-center justify-center text-[10px] text-white font-black tracking-tight"
                      style={{ width: `${(maxWorkHours / denom) * 100}%` }}
                      title={`Work Target: ${maxWorkHours}h (${Math.round((maxWorkHours / totalHours) * 100)}%)`}
                    >
                      {maxWorkHours >= 3 ? `${maxWorkHours}h` : ''}
                    </div>
                    <div
                      className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-300 flex items-center justify-center text-[10px] text-white font-black tracking-tight"
                      style={{ width: `${(bufferHours / denom) * 100}%` }}
                      title={`Buffer & Leisure: ${bufferHours}h (${Math.round((bufferHours / totalHours) * 100)}%)`}
                    >
                      {bufferHours >= 2 ? `${bufferHours}h` : ''}
                    </div>
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-indigo-500 h-full rounded-r-full transition-all duration-300 flex items-center justify-center text-[10px] text-white font-black tracking-tight"
                      style={{ width: `${(sleepHours / denom) * 100}%` }}
                      title={`Sleep Target: ${sleepHours}h (${Math.round((sleepHours / totalHours) * 100)}%)`}
                    >
                      {sleepHours >= 3 ? `${sleepHours}h` : ''}
                    </div>
                  </div>
                );
              })()}

              {/* Clean Presets */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">Presets:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: '🌙 Split Routine', sub: '15h / 2.25h / 6.75h', w: 15, b: 2.25, s: 6.75, dStart: '12:01 AM', dEnd: '11:59 PM', sStart: '02:15 AM', sEnd: '09:00 AM' },
                    { label: 'Standard', sub: '14h / 3h / 7h', w: 14, b: 3, s: 7, dStart: '06:00 AM', dEnd: '11:00 PM', sStart: '11:00 PM', sEnd: '06:00 AM' },
                    { label: 'Deep Focus', sub: '13h / 3h / 8h', w: 13, b: 3, s: 8, dStart: '07:00 AM', dEnd: '11:00 PM', sStart: '11:00 PM', sEnd: '07:00 AM' },
                    { label: 'Sprint', sub: '16h / 2h / 6h', w: 16, b: 2, s: 6, dStart: '06:00 AM', dEnd: '12:00 AM', sStart: '12:00 AM', sEnd: '06:00 AM' },
                    { label: 'Wellness', sub: '11h / 5h / 8h', w: 11, b: 5, s: 8, dStart: '07:00 AM', dEnd: '10:00 PM', sStart: '10:00 PM', sEnd: '07:00 AM' },
                  ].map((p) => {
                    const isActive = Math.abs(maxWorkHours - p.w) < 0.1 && Math.abs(bufferHours - p.b) < 0.1 && Math.abs(sleepHours - p.s) < 0.1;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setMaxWorkHours(p.w);
                          setBufferHours(p.b);
                          setSleepHours(p.s);
                          if (p.dStart) setDayStartTime(p.dStart);
                          if (p.dEnd) setDayEndTime(p.dEnd);
                          if (p.sStart) setSleepStartTime(p.sStart);
                          if (p.sEnd) setSleepEndTime(p.sEnd);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-theme-card hover:bg-theme-card-hover border border-theme-border text-theme-muted hover:text-theme-text'
                        }`}
                      >
                        <span>{p.label}</span>
                        <span className={`text-[10px] font-mono ${isActive ? 'text-blue-100' : 'text-theme-muted/70'}`}>
                          {p.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
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
              className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 hover:from-blue-700 hover:via-indigo-700 hover:to-sky-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-xs cursor-pointer active:scale-99"
            >
              <Check className="w-4 h-4" />
              <span>Save 24-Hours Locked Capacity & Red-Line Protocol</span>
            </button>
          </div>
        </div>
        )}

        {/* Right Column Stack: Priority Durations + Task Presets (Flawless Height Balance & Zero Empty Voids) */}
        {(isCardVisible('priorities') || isCardVisible('taskDefaults')) && (
          <div className="space-y-5 flex flex-col justify-between">
            {isCardVisible('priorities') && (
            <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-4 relative z-10 shadow-xs">
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
            )}

            {/* Default Task Adding System (Fast-Add Presets & Reduced Clicks) */}
            {isCardVisible('taskDefaults') && (
            <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-4 shadow-xs">
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
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center gap-1">
                      <Coffee className="w-3.5 h-3.5 text-purple-500" />
                      <span>Default Post-Task Buffer Time</span>
                    </label>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-xs">
                      {taskDefaults.defaultBufferMinutes} min
                    </span>
                  </div>
                  <p className="text-[10px] text-theme-muted">
                    Automated post-task rest & transition buffer applied to each scheduled activity
                  </p>
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
                    <div className="flex items-center gap-1 ml-auto">
                      <input
                        type="number"
                        min="0"
                        max="60"
                        step="5"
                        value={taskDefaults.defaultBufferMinutes}
                        onChange={(e) => setTaskDefaults({ ...taskDefaults, defaultBufferMinutes: Math.max(0, Number(e.target.value)) })}
                        className="w-14 h-8 text-center text-xs font-mono font-bold rounded-lg bg-theme-card border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-purple-500"
                        title="Custom buffer minutes"
                      />
                      <span className="text-[10px] font-mono text-theme-muted">min</span>
                    </div>
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
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                          taskDefaults.defaultSmartSlot === strat.id
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                            : 'bg-theme-card hover:bg-theme-card-hover border-theme-border'
                        }`}
                      >
                        <div className="font-bold text-xs text-theme-text">{strat.label}</div>
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
            )}
          </div>
        )}

        {/* 24-Hours Name Engine (Day Zones) */}
        {isCardVisible('dayZones') && (
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-amber-300/40 dark:border-amber-800/40 space-y-3.5 lg:col-span-2 shadow-sm bg-gradient-to-b from-amber-50/20 to-transparent dark:from-amber-950/10 dark:to-transparent">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-theme-border/70 pb-3 gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                <Sunrise className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-theme-text uppercase tracking-wider font-display">
                    24-Hour Name Engine
                  </h3>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{totalZoneHours}h / 24.0h Covered (100%)</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                    0 Overlaps • 0 Gaps
                  </span>
                </div>
                <p className="text-[11px] text-theme-muted mt-0.5">
                  Contiguous 24-hour closed loop. Adjusting any boundary auto-syncs adjacent zones to guarantee exact 24h coverage.
                </p>
              </div>
            </div>

            {/* Presets & Customize Toggle */}
            <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
              {/* Presets Quick Pills */}
              <div className="flex items-center gap-1 bg-theme-card p-1 rounded-xl border border-theme-border text-[11px] font-bold">
                <span className="text-[10px] text-theme-muted uppercase px-1.5 hidden sm:inline">Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPreset('classic')}
                  className="px-2 py-0.5 rounded-lg hover:bg-theme-card-hover text-theme-text transition-colors cursor-pointer"
                  title="7 Classic Optimus Zones (EarlyMorning to Deep Night)"
                >
                  Classic 7
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('executive')}
                  className="px-2 py-0.5 rounded-lg hover:bg-theme-card-hover text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                  title="5 Executive Zones (Routine, Deep Work, Execution, Evening, Sleep)"
                >
                  Executive 5
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('quarter')}
                  className="px-2 py-0.5 rounded-lg hover:bg-theme-card-hover text-purple-600 dark:text-purple-400 transition-colors cursor-pointer"
                  title="4 Simple 6-Hour Quarters"
                >
                  Quarter 4
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('circadian')}
                  className="px-2 py-0.5 rounded-lg hover:bg-theme-card-hover text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                  title="6 Circadian Energy Zones"
                >
                  Circadian 6
                </button>
              </div>

              {/* Master Toggle */}
              <div className="flex items-center gap-2 bg-theme-card-hover px-2.5 py-1 rounded-xl border border-theme-border shadow-2xs">
                <span className="text-xs font-bold text-theme-text whitespace-nowrap">Engine Active</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={periodCustomizeEnabled}
                    onChange={(e) => {
                      setPeriodCustomizeEnabled(e.target.checked);
                      updateTimePeriodSettings({
                        isEnabled: e.target.checked,
                        periods: periodsList
                      });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Feedback Message */}
          {periodSaveMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-slide-up flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{periodSaveMsg}</span>
            </div>
          )}

          {!periodCustomizeEnabled ? (
            <div className="p-5 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-theme-border text-center space-y-1.5">
              <Moon className="w-6 h-6 text-theme-muted mx-auto opacity-50" />
              <p className="text-xs font-bold text-theme-muted">
                24-Hour Name Engine is currently disabled. Toggle &ldquo;Engine Active&rdquo; to turn on Day Zone nomenclature across all views.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Visual 24-Hour Continuum Segmented Bar */}
              <div className="bg-theme-card p-2 rounded-xl border border-theme-border shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-theme-muted uppercase tracking-wider px-1">
                  <span>24-Hour Timeline Distribution</span>
                  <span>1440m / 24.0h Closed Loop</span>
                </div>
                
                <div className="w-full h-6 rounded-lg overflow-hidden flex border border-theme-border/80 bg-slate-900/10 shadow-inner">
                  {periodsList.map((period, idx) => {
                    const dur = getPeriodDurationMinutes(period);
                    const pct = (dur / 1440) * 100;
                    const colors = [
                      'from-amber-400 to-amber-500',
                      'from-yellow-400 to-amber-400',
                      'from-orange-400 to-orange-500',
                      'from-lime-500 to-emerald-500',
                      'from-teal-400 to-cyan-500',
                      'from-indigo-500 to-indigo-600',
                      'from-purple-500 to-purple-600',
                      'from-blue-500 to-blue-600',
                      'from-pink-500 to-rose-500'
                    ];
                    const bgGrad = colors[idx % colors.length];

                    return (
                      <div
                        key={period.id}
                        style={{ width: `${pct}%` }}
                        className={`h-full bg-gradient-to-r ${bgGrad} text-white flex items-center justify-center text-[10px] font-bold px-1 transition-all border-r border-white/20 last:border-r-0 hover:brightness-110 cursor-pointer overflow-hidden relative group`}
                        title={`${period.name}: ${period.startTime} – ${period.endTime} (${(dur / 60).toFixed(1)}h • ${pct.toFixed(0)}%)`}
                      >
                        <span className="truncate flex items-center gap-1 drop-shadow-xs">
                          <span>{period.emoji || '⏰'}</span>
                          {pct >= 9 && <span className="hidden sm:inline">{period.name}</span>}
                          {pct >= 6 && <span className="text-[9px] opacity-90">{(dur / 60).toFixed(1)}h</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* High-Density Smart Table of Zones */}
              <div className="bg-theme-card rounded-xl border border-theme-border overflow-hidden shadow-2xs">
                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1.5 bg-theme-card-hover/80 border-b border-theme-border text-[10px] font-bold text-theme-muted uppercase tracking-wider items-center">
                  <div className="col-span-1"># & Icon</div>
                  <div className="col-span-4">Zone Name</div>
                  <div className="col-span-4">Time Window (Auto-Chained)</div>
                  <div className="col-span-1 text-center">Duration</div>
                  <div className="col-span-2 text-right">Smart Actions</div>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-theme-border/60">
                  {periodsList.map((period, index) => {
                    const dur = getPeriodDurationMinutes(period);
                    const durHours = (dur / 60).toFixed(1);
                    const pct = ((dur / 1440) * 100).toFixed(1);

                    return (
                      <div
                        key={period.id}
                        className="px-3 py-1.5 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center hover:bg-theme-card-hover/40 transition-colors"
                      >
                        {/* # & Emoji */}
                        <div className="sm:col-span-1 flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold text-theme-muted w-4">
                            #{index + 1}
                          </span>
                          <input
                            type="text"
                            value={period.emoji || '⏰'}
                            onChange={(e) => handlePeriodMetaChange(period.id, 'emoji', e.target.value)}
                            className="w-7 h-7 text-center rounded-lg bg-theme-card border border-theme-border text-xs focus:outline-none focus:border-amber-500"
                            title="Emoji Icon"
                            maxLength={2}
                          />
                        </div>

                        {/* Zone Name */}
                        <div className="sm:col-span-4">
                          <input
                            type="text"
                            value={period.name}
                            onChange={(e) => handlePeriodMetaChange(period.id, 'name', e.target.value)}
                            placeholder="e.g. EarlyMorning"
                            className="w-full px-2.5 py-1 rounded-lg bg-theme-card border border-theme-border text-xs font-bold text-theme-text focus:outline-none focus:border-amber-500 transition-colors"
                          />
                        </div>

                        {/* Time Window: Start -> End with Steppers */}
                        <div className="sm:col-span-4 flex items-center gap-1.5 flex-wrap">
                          {/* Start Time: Editable anchor for Zone 1, Locked for subsequent zones */}
                          {index === 0 ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingBoundaries['start_0'] ?? period.startTime}
                                onChange={(e) => setEditingBoundaries(prev => ({ ...prev, 'start_0': e.target.value }))}
                                onBlur={(e) => handleCommitStartAnchor(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCommitStartAnchor((e.target as HTMLInputElement).value);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                placeholder="12:00 AM"
                                className="w-20 px-2 py-1 rounded-lg bg-theme-card border border-amber-300 dark:border-amber-700 font-mono text-[11px] font-bold text-theme-text text-center focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
                                title="Day Anchor Start Time (syncs with final zone's end time - press Enter or blur to save)"
                              />
                              <label 
                                className="w-6 h-6 rounded bg-theme-card-hover hover:bg-theme-border text-theme-muted hover:text-theme-text flex items-center justify-center border border-theme-border cursor-pointer transition-colors"
                                title="Clock picker for Day Anchor Start Time"
                              >
                                <Clock className="w-3 h-3" />
                                <input
                                  type="time"
                                  className="sr-only"
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleCommitStartAnchor(e.target.value);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          ) : (
                            <span 
                              className="px-2 py-1 rounded-lg bg-theme-card-hover border border-theme-border font-mono text-[11px] font-bold text-theme-muted"
                              title={`Start Time is automatically locked to previous zone's end time (${period.startTime})`}
                            >
                              {period.startTime}
                            </span>
                          )}

                          <ArrowRight className="w-3 h-3 text-theme-muted shrink-0" />

                          {/* Editable End Time with Text Buffer, Clock Picker & Steppers */}
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingBoundaries[`end_${index}`] ?? period.endTime}
                              onChange={(e) => setEditingBoundaries(prev => ({ ...prev, [`end_${index}`]: e.target.value }))}
                              onBlur={(e) => handleCommitBoundary(index, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCommitBoundary(index, (e.target as HTMLInputElement).value);
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              placeholder="09:00 AM"
                              className="w-20 px-2 py-1 rounded-lg bg-theme-card border border-theme-border font-mono text-[11px] font-bold text-theme-text text-center focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                              title="Edit boundary (type 12h e.g. 09:30 AM, or 24h e.g. 14:00 - press Enter or blur to save)"
                            />

                            {/* Native Clock Picker */}
                            <label 
                              className="w-6 h-6 rounded bg-theme-card-hover hover:bg-theme-border text-theme-muted hover:text-theme-text flex items-center justify-center border border-theme-border cursor-pointer transition-colors"
                              title="Pick end time from clock"
                            >
                              <Clock className="w-3 h-3" />
                              <input
                                type="time"
                                className="sr-only"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleCommitBoundary(index, e.target.value);
                                  }
                                }}
                              />
                            </label>

                            {/* -15m Stepper */}
                            <button
                              type="button"
                              onClick={() => handleNudgeBoundary(index, -15)}
                              className="w-6 h-6 rounded bg-theme-card-hover hover:bg-theme-border text-[10px] font-bold text-theme-text flex items-center justify-center border border-theme-border transition-colors cursor-pointer"
                              title="Nudge boundary -15m"
                            >
                              -15
                            </button>

                            {/* +15m Stepper */}
                            <button
                              type="button"
                              onClick={() => handleNudgeBoundary(index, 15)}
                              className="w-6 h-6 rounded bg-theme-card-hover hover:bg-theme-border text-[10px] font-bold text-theme-text flex items-center justify-center border border-theme-border transition-colors cursor-pointer"
                              title="Nudge boundary +15m"
                            >
                              +15
                            </button>
                          </div>
                        </div>

                        {/* Duration Pill */}
                        <div className="sm:col-span-1 text-center">
                          <span 
                            className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800"
                            title={`${dur} minutes (${pct}% of 24-hour day)`}
                          >
                            {durHours}h
                          </span>
                        </div>

                        {/* Smart Actions: Split & Delete */}
                        <div className="sm:col-span-2 flex items-center justify-end gap-1.5">
                          {/* Split Button */}
                          <button
                            type="button"
                            onClick={() => handleSplitPeriod(index)}
                            className="px-2 py-1 rounded-lg bg-theme-card-hover hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/60 dark:hover:text-blue-300 text-[10px] font-bold text-theme-muted border border-theme-border transition-colors flex items-center gap-1 cursor-pointer"
                            title="Split this zone into 2 equal halves"
                          >
                            <Scissors className="w-3 h-3" />
                            <span>Split</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeletePeriod(period.id)}
                            disabled={periodsList.length <= 1}
                            className="p-1 rounded-lg text-theme-muted hover:text-red-500 hover:bg-theme-card transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Remove zone and merge time into previous zone"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleAddPeriod}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-theme-card-hover hover:bg-theme-border text-xs font-bold text-theme-text border border-theme-border transition-all cursor-pointer shadow-2xs"
                    title="Finds the longest zone and splits it smoothly"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Zone (Smart Split)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetPeriods}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-theme-card-hover hover:bg-theme-border text-xs font-bold text-amber-600 dark:text-amber-400 border border-theme-border transition-all cursor-pointer shadow-2xs"
                    title="Restore default 7 contiguous periods"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset 7 Defaults</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSavePeriods}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-98"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Save Day Zones</span>
                </button>
              </div>

              {/* Compact Live Interactive Day Zone Tester */}
              <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-theme-text">Live 24h Time Zone Tester:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                        setTestTimeInput(nowStr);
                      }}
                      className="px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px] font-extrabold hover:brightness-110 cursor-pointer"
                    >
                      Now
                    </button>
                    {['08:00 AM', '01:30 PM', '06:00 PM', '10:30 PM', '03:00 AM'].map(sample => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => setTestTimeInput(sample)}
                        className="px-1.5 py-0.2 rounded bg-theme-card text-theme-muted hover:text-theme-text text-[10px] font-mono font-bold border border-theme-border cursor-pointer"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <input
                    type="text"
                    value={testTimeInput}
                    onChange={(e) => setTestTimeInput(e.target.value)}
                    placeholder="01:30 PM"
                    className="w-24 px-2 py-1 rounded-lg bg-theme-card border border-theme-border font-mono font-bold text-xs text-theme-text text-center focus:outline-none focus:border-amber-500"
                  />
                  {(() => {
                    const resolved = getTimePeriodForTime(testTimeInput, periodsList);
                    if (!resolved) {
                      return (
                        <div className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                          <span>⚠️ Unmapped</span>
                        </div>
                      );
                    }
                    const dur = getPeriodDurationMinutes(resolved);
                    return (
                      <div className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                        <span>{resolved.emoji || '⏰'}</span>
                        <span className="font-extrabold">{resolved.name}</span>
                        <span className="font-mono text-[10px] text-amber-700 dark:text-amber-300">
                          ({resolved.startTime} - {resolved.endTime} • {(dur/60).toFixed(1)}h)
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Category & SubCategory CRUD */}
        {isCardVisible('categories') && (
        <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-4 shadow-xs">
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
        )}

        {/* Buffer Status & Free-Time Activity Menu Management */}
        {isCardVisible('bufferStatus') && (
        <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-4 shadow-xs">
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
        )}

        {/* Security & Access Protection Shield */}
        {isCardVisible('security') && (
        <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-4 shadow-xs">
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
        )}

        {/* Real-Time Cloud Database Sync (Supabase) */}
        {isCardVisible('cloudSync') && (
        <div className={`glass-panel p-5 rounded-2xl border border-theme-border space-y-4 shadow-xs ${activeTab === 'security' ? 'lg:col-span-2' : ''}`}>
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
        )}

        {/* Complete 100% Data Backup & Recovery Hub */}
        {isCardVisible('backupHub') && (
        <div className="glass-panel p-5 rounded-2xl border border-theme-border space-y-4 shadow-xs">
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
        )}

        {/* Empty State for Search Filter */}
        {searchQuery && !(['capacity', 'priorities', 'taskDefaults', 'dayZones', 'categories', 'bufferStatus', 'security', 'cloudSync', 'backupHub'] as const).some(isCardVisible) && (
          <div className="lg:col-span-2 p-12 text-center rounded-2xl border border-dashed border-theme-border bg-theme-card/50 space-y-2 animate-fade-in">
            <Search className="w-8 h-8 text-theme-muted mx-auto opacity-50" />
            <h4 className="text-sm font-bold text-theme-text">No Settings Found for &ldquo;{searchQuery}&rdquo;</h4>
            <p className="text-xs text-theme-muted">Try searching for keywords like &ldquo;sleep&rdquo;, &ldquo;priority&rdquo;, &ldquo;backup&rdquo;, &ldquo;pin&rdquo;, &ldquo;cloud&rdquo;, or &ldquo;buffer&rdquo;.</p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors mt-2 cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        )}

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

