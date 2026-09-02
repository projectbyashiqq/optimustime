import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  validateBackupBundle, 
  triggerBackupDownload, 
  BackupValidationResult 
} from '../utils/backupUtils';
import { 
  exportTasksToExcelWorkbook, 
  exportTasksToDetailedCSV 
} from '../utils/excelExporter';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  FileJson, 
  ShieldCheck, 
  AlertTriangle, 
  Check, 
  X, 
  RotateCcw, 
  Sparkles, 
  Layers, 
  Settings2, 
  Table, 
  ArrowRight,
  Database,
  CheckCircle2,
  Info
} from 'lucide-react';

export const BackupRestoreModal: React.FC = () => {
  const { 
    isBackupModalOpen, 
    backupModalTab, 
    closeBackupModal,
    tasks,
    bufferNotes,
    planProjects,
    categories,
    bufferCategories,
    emergencyCategories,
    knowledge,
    reminders,
    auditLogs,
    capacitySettings,
    prioritySettings,
    defaultTaskSettings,
    securitySettings,
    exportStateJson,
    exportSettingsOnlyJson,
    importStateJson,
    rollbackLastRestore,
    canRollback
  } = useApp();

  const [activeTab, setActiveTab] = useState<'export' | 'restore'>(backupModalTab || 'export');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedJson, setPastedJson] = useState<string>('');
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<'full' | 'merge' | 'settings_only'>('full');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [useTextInput, setUseTextInput] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isBackupModalOpen) return null;

  const todayStr = new Date().toISOString().slice(0, 10);

  // Export handlers
  const handleDownloadFullBackup = () => {
    const jsonStr = exportStateJson();
    triggerBackupDownload(jsonStr, `optimustime_full_backup_${todayStr}.json`);
    setStatusMessage({ type: 'success', text: 'Full 100% system backup downloaded successfully!' });
  };

  const handleDownloadSettingsBackup = () => {
    const jsonStr = exportSettingsOnlyJson();
    triggerBackupDownload(jsonStr, `optimustime_settings_profile_${todayStr}.json`);
    setStatusMessage({ type: 'success', text: 'System settings & configurations profile downloaded successfully!' });
  };

  const handleDownloadExcel = () => {
    exportTasksToExcelWorkbook(tasks, planProjects, prioritySettings, {
      fileName: `optimustime_tasks_complete_${todayStr}.xlsx`
    });
    setStatusMessage({ type: 'success', text: 'Complete Tasks Excel workbook (.xlsx) downloaded successfully!' });
  };

  const handleDownloadCSV = () => {
    exportTasksToDetailedCSV(tasks, planProjects, prioritySettings, `optimustime_tasks_complete_${todayStr}.csv`);
    setStatusMessage({ type: 'success', text: 'Detailed Tasks CSV spreadsheet downloaded successfully!' });
  };

  // File loading and validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = validateBackupBundle(content);
      setValidationResult(res);
      if (!res.isValid) {
        setStatusMessage({ type: 'error', text: res.error || 'Invalid backup file structure.' });
      } else {
        // Default restore mode based on backup type
        if (res.type === 'SETTINGS_ONLY_BACKUP') {
          setRestoreMode('settings_only');
        } else {
          setRestoreMode('full');
        }
      }
    };
    reader.readAsText(file);
  };

  const handlePastedJsonChange = (text: string) => {
    setPastedJson(text);
    setStatusMessage(null);
    if (!text.trim()) {
      setValidationResult(null);
      return;
    }
    const res = validateBackupBundle(text.trim());
    setValidationResult(res);
  };

  // Execute restore
  const handleExecuteRestore = () => {
    if (!validationResult || !validationResult.isValid) return;

    const jsonStr = selectedFile 
      ? JSON.stringify(validationResult.parsedData) 
      : pastedJson.trim();

    const success = importStateJson(jsonStr, restoreMode);
    if (success) {
      setStatusMessage({ 
        type: 'success', 
        text: `Successfully restored backup in ${restoreMode.toUpperCase().replace('_', ' ')} mode!` 
      });
      // Clear inputs
      setSelectedFile(null);
      setPastedJson('');
      setValidationResult(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      setStatusMessage({ type: 'error', text: 'Failed to restore backup. Please verify file integrity.' });
    }
  };

  // Execute rollback
  const handleRollback = () => {
    if (confirm('Undo the last restore and revert to the pre-restore snapshot?')) {
      const success = rollbackLastRestore();
      if (success) {
        setStatusMessage({ type: 'success', text: 'Reverted to previous snapshot successfully!' });
      } else {
        setStatusMessage({ type: 'error', text: 'Rollback snapshot not available.' });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-theme-card border border-theme-border w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-theme-border flex items-center justify-between bg-gradient-to-r from-blue-600/10 via-theme-card to-purple-600/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-theme-text font-display tracking-tight">
                  100% System Backup & Data Hub
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono border border-blue-200 dark:border-blue-900">
                  v2.0 Protocol
                </span>
              </div>
              <p className="text-xs text-theme-muted font-medium">
                Complete data & settings backups, Excel workbooks, and pre-inspected recovery with rollback snapshots.
              </p>
            </div>
          </div>

          <button
            onClick={closeBackupModal}
            className="p-2 rounded-xl text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-theme-border bg-theme-card-hover/40">
          <button
            onClick={() => {
              setActiveTab('export');
              setStatusMessage(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black border-b-2 transition-all ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-theme-muted hover:text-theme-text'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Export & Download Hub</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('restore');
              setStatusMessage(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black border-b-2 transition-all ${
              activeTab === 'restore'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-theme-muted hover:text-theme-text'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Restore & Recovery Hub</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Status Message Notification */}
          {statusMessage && (
            <div className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold animate-slide-up ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button 
                onClick={() => setStatusMessage(null)}
                className="text-xs hover:underline opacity-80"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeTab === 'export' ? (
            
            /* TAB 1: EXPORT HUB */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Export Card 1: 100% Full System Backup (JSON) */}
                <div className="p-5 rounded-2xl border border-theme-border bg-theme-card-hover/40 space-y-3 flex flex-col justify-between hover:border-blue-500/50 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <FileJson className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono">
                        100% Full State
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-theme-text font-display">
                      Complete Full System Backup (JSON)
                    </h4>
                    <p className="text-xs text-theme-muted leading-relaxed">
                      Exports 100% of tasks, life diary buffer notes, projects, categories, knowledge, audit logs, and all system settings & capacity rules into a portable JSON file.
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-theme-muted font-mono pt-1">
                      <span>{tasks.length} Tasks</span> • 
                      <span>{bufferNotes.length} Diary Notes</span> • 
                      <span>{categories.length} Categories</span>
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadFullBackup}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 transform active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Full Backup (JSON)</span>
                  </button>
                </div>

                {/* Export Card 2: Settings & Configuration Profile (JSON) */}
                <div className="p-5 rounded-2xl border border-theme-border bg-theme-card-hover/40 space-y-3 flex flex-col justify-between hover:border-purple-500/50 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Settings2 className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-mono">
                        Config Only
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-theme-text font-display">
                      System Settings & Rules Profile (JSON)
                    </h4>
                    <p className="text-xs text-theme-muted leading-relaxed">
                      Exports all system configurations: 24h capacity rules, priority setups (P1-P5), default task presets, security parameters, custom categories, and theme settings.
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-theme-muted font-mono pt-1">
                      <span>24h Capacity</span> • <span>P1-P5 Matrix</span> • <span>Presets</span>
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadSettingsBackup}
                    className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 transform active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Settings Profile</span>
                  </button>
                </div>

                {/* Export Card 3: Complete Tasks Excel Workbook (.xlsx) */}
                <div className="p-5 rounded-2xl border border-theme-border bg-theme-card-hover/40 space-y-3 flex flex-col justify-between hover:border-emerald-500/50 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono">
                        Excel Multi-Sheet
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-theme-text font-display">
                      Complete Tasks Excel Workbook (.xlsx)
                    </h4>
                    <p className="text-xs text-theme-muted leading-relaxed">
                      Professional 4-sheet workbook: Master Tasks Matrix (28 detailed columns), Executive Summary & KPI metrics, Granular Subtasks audit, and Execution Sessions ledger.
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-theme-muted font-mono pt-1">
                      <span>4 Sheets</span> • <span>28 Columns</span> • <span>Auto Column Widths</span>
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadExcel}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 transform active:scale-95"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Download Excel Workbook (.xlsx)</span>
                  </button>
                </div>

                {/* Export Card 4: Complete Tasks CSV (.csv) */}
                <div className="p-5 rounded-2xl border border-theme-border bg-theme-card-hover/40 space-y-3 flex flex-col justify-between hover:border-amber-500/50 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Table className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono">
                        UTF-8 BOM CSV
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-theme-text font-display">
                      Detailed Tasks CSV Spreadsheet (.csv)
                    </h4>
                    <p className="text-xs text-theme-muted leading-relaxed">
                      Lightweight, universal CSV spreadsheet exported with UTF-8 BOM encoding for seamless opening in Microsoft Excel, Google Sheets, LibreOffice, or Python data analysis.
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-theme-muted font-mono pt-1">
                      <span>Universal Format</span> • <span>UTF-8 BOM Protected</span>
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadCSV}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 transform active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Detailed CSV (.csv)</span>
                  </button>
                </div>

              </div>
            </div>

          ) : (

            /* TAB 2: RESTORE & RECOVERY HUB */
            <div className="space-y-4">
              
              {/* File Input & Paste Toggle */}
              <div className="p-5 rounded-2xl border border-theme-border bg-theme-card-hover/40 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-purple-500" />
                    <span>Select Backup File (.json)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseTextInput(!useTextInput)}
                    className="text-[11px] text-blue-500 hover:underline font-bold"
                  >
                    {useTextInput ? 'Switch to File Upload' : 'Paste JSON Text Instead'}
                  </button>
                </div>

                {!useTextInput ? (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileChange}
                      className="hidden"
                      id="backup-file-picker"
                    />
                    <label
                      htmlFor="backup-file-picker"
                      className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-theme-border hover:border-purple-500 rounded-2xl cursor-pointer bg-theme-card transition-all group"
                    >
                      <FileJson className="w-8 h-8 text-theme-muted group-hover:text-purple-500 transition-colors mb-2" />
                      <span className="text-xs font-bold text-theme-text">
                        {selectedFile ? selectedFile.name : 'Click to Browse or Drag & Drop Backup JSON'}
                      </span>
                      <span className="text-[10px] text-theme-muted mt-0.5">
                        Supports OptimusTime V2.0 Full Backups and Settings Profiles
                      </span>
                    </label>
                  </div>
                ) : (
                  <textarea
                    rows={4}
                    value={pastedJson}
                    onChange={(e) => handlePastedJsonChange(e.target.value)}
                    placeholder="Paste exported backup JSON text here..."
                    className="w-full p-3 rounded-2xl bg-theme-card border border-theme-border text-xs text-theme-text font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                )}
              </div>

              {/* Pre-Inspection & Validation Card */}
              {validationResult && (
                <div className={`p-5 rounded-2xl border space-y-3 animate-slide-up ${
                  validationResult.isValid 
                    ? 'bg-purple-50/20 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800' 
                    : 'bg-red-50/20 dark:bg-red-950/20 border-red-300 dark:border-red-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{validationResult.isValid ? '🔍' : '❌'}</span>
                      <h4 className="text-xs font-black text-theme-text uppercase tracking-wider">
                        Pre-Restore Backup Inspection
                      </h4>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      validationResult.isValid ? 'bg-purple-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {validationResult.type}
                    </span>
                  </div>

                  {validationResult.isValid ? (
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center gap-3 text-theme-muted text-[11px] flex-wrap">
                        <span>Schema: <strong>{validationResult.schemaVersion}</strong></span>
                        {validationResult.exportedAt && (
                          <span>Exported: <strong>{new Date(validationResult.exportedAt).toLocaleString()}</strong></span>
                        )}
                        {validationResult.user && (
                          <span>User: <strong>{validationResult.user}</strong></span>
                        )}
                      </div>

                      {/* Content Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <div className="p-2.5 rounded-xl bg-theme-card border border-theme-border text-center">
                          <div className="text-lg font-black text-theme-text font-display">
                            {validationResult.summary.tasksCount}
                          </div>
                          <div className="text-[10px] font-bold text-theme-muted uppercase">Tasks</div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-theme-card border border-theme-border text-center">
                          <div className="text-lg font-black text-amber-500 font-display">
                            {validationResult.summary.bufferNotesCount}
                          </div>
                          <div className="text-[10px] font-bold text-theme-muted uppercase">Diary Notes</div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-theme-card border border-theme-border text-center">
                          <div className="text-lg font-black text-blue-500 font-display">
                            {validationResult.summary.categoriesCount}
                          </div>
                          <div className="text-[10px] font-bold text-theme-muted uppercase">Categories</div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-theme-card border border-theme-border text-center">
                          <div className="text-lg font-black text-emerald-500 font-display">
                            {validationResult.summary.hasSettings ? 'YES' : 'NO'}
                          </div>
                          <div className="text-[10px] font-bold text-theme-muted uppercase">Settings</div>
                        </div>
                      </div>

                      {/* Restore Mode Selection */}
                      <div className="pt-2 border-t border-theme-border/60 space-y-2">
                        <label className="text-[11px] font-black text-theme-text uppercase tracking-wider block">
                          Choose Restore Mode:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          
                          <button
                            type="button"
                            onClick={() => setRestoreMode('full')}
                            disabled={validationResult.type === 'SETTINGS_ONLY_BACKUP'}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              restoreMode === 'full'
                                ? 'bg-purple-600 text-white border-purple-700 shadow-md ring-1 ring-purple-400'
                                : 'bg-theme-card border-theme-border text-theme-muted hover:text-theme-text disabled:opacity-40'
                            }`}
                          >
                            <div className="font-black text-xs">Full Clean Restore</div>
                            <div className={`text-[10px] ${restoreMode === 'full' ? 'text-purple-100' : 'text-theme-muted'}`}>
                              Replaces state completely
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRestoreMode('merge')}
                            disabled={validationResult.type === 'SETTINGS_ONLY_BACKUP'}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              restoreMode === 'merge'
                                ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-1 ring-blue-400'
                                : 'bg-theme-card border-theme-border text-theme-muted hover:text-theme-text disabled:opacity-40'
                            }`}
                          >
                            <div className="font-black text-xs">Smart Merge</div>
                            <div className={`text-[10px] ${restoreMode === 'merge' ? 'text-blue-100' : 'text-theme-muted'}`}>
                              Appends without deleting
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRestoreMode('settings_only')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              restoreMode === 'settings_only'
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-1 ring-emerald-400'
                                : 'bg-theme-card border-theme-border text-theme-muted hover:text-theme-text'
                            }`}
                          >
                            <div className="font-black text-xs">Settings Only</div>
                            <div className={`text-[10px] ${restoreMode === 'settings_only' ? 'text-emerald-100' : 'text-theme-muted'}`}>
                              Keeps existing tasks intact
                            </div>
                          </button>

                        </div>
                      </div>

                      {/* Execute Restore Button */}
                      <button
                        type="button"
                        onClick={handleExecuteRestore}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-black text-xs shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Confirm & Apply Backup ({restoreMode.toUpperCase().replace('_', ' ')})</span>
                      </button>

                    </div>
                  ) : (
                    <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {validationResult.error}
                    </div>
                  )}
                </div>
              )}

              {/* Safety Rollback Card */}
              <div className="p-4 rounded-2xl border border-theme-border bg-theme-card flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <h5 className="text-xs font-black text-theme-text">
                      Automatic Safety Rollback Net
                    </h5>
                    <p className="text-[11px] text-theme-muted">
                      A pre-restore snapshot is automatically recorded before any restore or reset.
                    </p>
                  </div>
                </div>

                {canRollback && (
                  <button
                    type="button"
                    onClick={handleRollback}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-sm transition-all shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Undo Last Restore</span>
                  </button>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-theme-border bg-theme-card flex items-center justify-between text-xs text-theme-muted">
          <span className="font-mono text-[11px]">
            OptimusTime Enterprise Data Vault • End-to-End JSON & XLSX
          </span>
          <button
            onClick={closeBackupModal}
            className="px-4 py-2 rounded-xl border border-theme-border text-theme-muted hover:text-theme-text hover:bg-theme-card-hover font-bold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
