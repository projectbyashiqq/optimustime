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
  ExternalLink
} from 'lucide-react';
import { DEFAULT_SQL_SCHEMA } from '../services/supabase';

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
    exportStateJson,
    importStateJson,
    resetToDefaultData,
    securitySettings,
    updateSecuritySettings,
    cloudSyncConfig,
    cloudSyncStatus,
    updateCloudSyncConfig,
    pushToCloud,
    pullFromCloud,
    syncNow,
    testCloudConnection
  } = useApp();

  // Local editing states
  const [maxWorkHours, setMaxWorkHours] = useState(capacitySettings.maxWorkHours);
  const [sleepHours, setSleepHours] = useState(capacitySettings.sleepHours);
  const [bufferHours, setBufferHours] = useState(capacitySettings.bufferHours);
  const [dayStartTime, setDayStartTime] = useState(capacitySettings.dayStartTime || '06:00 AM');
  const [dayEndTime, setDayEndTime] = useState(capacitySettings.dayEndTime || '11:00 PM');

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

  const handleSaveCloudSync = () => {
    updateCloudSyncConfig({
      isEnabled: isCloudSyncEnabled,
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      tableName: 'optimustime_sync',
      autoRealtimeSync
    });
    setCloudStatusMsg({ text: 'Cloud sync configuration saved successfully! ☁️', isError: false });
    setTimeout(() => setCloudStatusMsg(null), 4000);
  };

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setCloudStatusMsg(null);
    const result = await testCloudConnection();
    setIsTestingConn(false);
    setCloudStatusMsg({ text: result.message, isError: !result.success });
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
      dayEndTime
    });
    alert('Capacity budget and sleep/wake-up schedule saved successfully!');
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

        {/* Capacity & Red-Line Protocol Settings */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
          <div className="flex items-center justify-between border-b border-theme-border pb-3">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              Daily Capacity & Red-Line Protocol
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-theme-text block mb-1">
                Max Daily Work Budget (Hours)
              </label>
              <input
                type="number"
                min="4"
                max="24"
                value={maxWorkHours}
                onChange={(e) => setMaxWorkHours(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-mono font-bold"
              />
              <p className="text-[11px] text-theme-muted mt-1">
                Trigger Red Alert indicator when scheduled work exceeds this threshold. Default: 14h.
              </p>
            </div>

            {/* Sleep & Wake-up Time Anchors */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-theme-card-hover border border-theme-border">
              <div>
                <TimePicker
                  label="Wake-Up Time"
                  value={dayStartTime}
                  onChange={setDayStartTime}
                />
              </div>

              <div>
                <TimePicker
                  label="Bedtime / Sleep"
                  value={dayEndTime}
                  onChange={setDayEndTime}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-theme-text block mb-1">
                  Guaranteed Sleep (Hours)
                </label>
                <input
                  type="number"
                  min="4"
                  max="12"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-theme-text block mb-1">
                  Buffer / Leisure (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={bufferHours}
                  onChange={(e) => setBufferHours(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-mono font-bold"
                />
              </div>
            </div>

            {/* 24-Hour Circadian Budget Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] font-semibold text-theme-muted">
                <span>24-Hour Circadian Budget:</span>
                <span>{maxWorkHours}h Work • {bufferHours}h Buffer • {sleepHours}h Sleep</span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                <div
                  className="bg-blue-600 h-full"
                  style={{ width: `${(maxWorkHours / 24) * 100}%` }}
                  title={`Work: ${maxWorkHours}h`}
                />
                <div
                  className="bg-amber-500 h-full"
                  style={{ width: `${(bufferHours / 24) * 100}%` }}
                  title={`Buffer: ${bufferHours}h`}
                />
                <div
                  className="bg-indigo-500 h-full"
                  style={{ width: `${(sleepHours / 24) * 100}%` }}
                  title={`Sleep: ${sleepHours}h`}
                />
              </div>
            </div>

            <button
              onClick={handleSaveCapacity}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-colors mt-2"
            >
              Update Capacity & Sleep Budget
            </button>
          </div>
        </div>

        {/* Priority Custom Time Setup (P1-P5) */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
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
            <p className="text-theme-muted">
              Connect a free <strong>Supabase</strong> project to automatically synchronize all tasks, categories, knowledge notes, and settings across your phone, laptop, and live Vercel deployments in real time.
            </p>

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
                  onClick={async () => {
                    const ok = await pushToCloud();
                    setCloudStatusMsg({
                      text: ok ? 'Local data successfully pushed to Cloud! 🚀' : 'Failed to push to Cloud.',
                      isError: !ok
                    });
                    setTimeout(() => setCloudStatusMsg(null), 4000);
                  }}
                  disabled={!supabaseUrl || !supabaseAnonKey}
                  className="py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Push Local to Cloud</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const ok = await pullFromCloud();
                    setCloudStatusMsg({
                      text: ok ? 'Cloud data pulled & applied locally! 📥' : 'No cloud data found or fetch failed.',
                      isError: !ok
                    });
                    setTimeout(() => setCloudStatusMsg(null), 4000);
                  }}
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

        {/* Data Backup & Restore */}
        <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
          <div className="flex items-center justify-between border-b border-theme-border pb-3">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <Download className="w-4 h-4 text-purple-500" />
              Unified Data Backup & Restore
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <p className="text-theme-muted">
              Export your full system matrix, tasks, categories, knowledge hub and reminders as a JSON file or restore from a previous backup.
            </p>

            <button
              onClick={handleExport}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Full JSON Backup</span>
            </button>

            <div className="pt-2 border-t border-theme-border space-y-2">
              <label className="font-bold text-theme-text block">
                Restore State from JSON:
              </label>
              <textarea
                rows={3}
                placeholder="Paste exported JSON state here..."
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-mono text-[11px]"
              />
              <button
                onClick={handleImport}
                className="w-full py-2 bg-theme-card-hover hover:bg-theme-border border border-theme-border text-theme-text rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Import & Restore</span>
              </button>

              {importStatus && (
                <p className="text-xs text-emerald-500 font-bold text-center">
                  {importStatus}
                </p>
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
  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);
  const [editingSubText, setEditingSubText] = useState('');
  const [newSubText, setNewSubText] = useState('');

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <input
            type="color"
            value={category.color}
            onChange={(e) => onUpdate({ ...category, color: e.target.value })}
            className="w-5 h-5 rounded-md cursor-pointer border-0 p-0 bg-transparent"
            title="Change Category Color"
          />
          <span className="font-bold text-theme-text">{category.name}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-theme-card border border-theme-border text-theme-muted">
            {category.subCategories.length} sub-entities
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1 rounded-lg bg-theme-card border border-theme-border hover:bg-theme-border text-theme-text font-bold flex items-center gap-1 text-[11px]"
          >
            <span>Manage SubCategories</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {!category.isSystem && (
            <button
              onClick={onDelete}
              className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 dark:hover:bg-red-950/40"
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
                      className="p-0.5 text-emerald-600 hover:text-emerald-700"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingSubIndex(null)}
                      className="p-0.5 text-red-500 hover:text-red-700"
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
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-muted hover:text-blue-600 transition-opacity"
                    title="Rename SubCategory"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteSub(sub)}
                    className="p-0.5 text-theme-muted hover:text-red-500 transition-colors"
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
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm"
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

