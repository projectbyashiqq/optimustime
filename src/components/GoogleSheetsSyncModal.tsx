import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from '../services/googleSheets';
import { 
  FileSpreadsheet, 
  Check, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  Zap, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  X, 
  HelpCircle,
  UploadCloud,
  DownloadCloud,
  Settings2
} from 'lucide-react';

export const GoogleSheetsSyncModal: React.FC = () => {
  const {
    googleSheetsConfig,
    updateGoogleSheetsConfig,
    syncGoogleSheets,
    testGoogleSheets,
    isGoogleSheetsModalOpen,
    setIsGoogleSheetsModalOpen,
    tasks
  } = useApp();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'guide' | 'code'>('dashboard');
  const [urlInput, setUrlInput] = useState(googleSheetsConfig.webAppUrl || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  if (!isGoogleSheetsModalOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleSaveAndTest = async () => {
    const cleanUrl = urlInput.trim();
    updateGoogleSheetsConfig({ webAppUrl: cleanUrl, isEnabled: Boolean(cleanUrl) });
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await testGoogleSheets();
      setTestResult(res);
      if (res.ok) {
        updateGoogleSheetsConfig({ isEnabled: true, lastSyncStatus: 'success' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Connection test failed.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTriggerSync = async (direction: 'two-way' | 'push' | 'pull') => {
    setIsSyncing(true);
    setSyncFeedback(null);

    try {
      const res = await syncGoogleSheets(direction);
      setSyncFeedback(res);
    } catch (err: any) {
      setSyncFeedback({ ok: false, message: err.message || 'Sync failed.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const isConnected = Boolean(googleSheetsConfig.isEnabled && googleSheetsConfig.webAppUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-theme-border rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-theme-border flex items-center justify-between bg-gradient-to-r from-emerald-500/[0.08] via-theme-card to-teal-500/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-theme-text font-display">
                  Google Sheets 2-Way Sync
                </h3>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isConnected 
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                }`}>
                  {isConnected ? '● Connected' : '○ Setup Required'}
                </span>
              </div>
              <p className="text-xs text-theme-muted">
                Direct live synchronization between OptimusTime and your Google Spreadsheet
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsGoogleSheetsModalOpen(false)}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-theme-border bg-theme-card-hover/40 px-4 sm:px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-theme-muted hover:text-theme-text'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Control</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-theme-muted hover:text-theme-text'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Setup Guide (3 mins)</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'code'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-theme-muted hover:text-theme-text'
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Apps Script Code</span>
          </button>
        </div>

        {/* Tab 1: Dashboard & Sync Control */}
        {activeTab === 'dashboard' && (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
            {/* Status card */}
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isConnected
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  isConnected ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'
                }`}>
                  {isConnected ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-theme-text font-display">
                    {isConnected ? 'Google Sheets Webhook Connected' : 'Google Sheets Not Connected'}
                  </h4>
                  <p className="text-xs text-theme-muted">
                    {googleSheetsConfig.lastSyncedAt
                      ? `Last synced: ${new Date(googleSheetsConfig.lastSyncedAt).toLocaleTimeString()} (${tasks.length} tasks in app)`
                      : isConnected
                      ? 'Ready to sync! Click Two-Way Sync below.'
                      : 'Follow the 3-minute Setup Guide tab to connect your sheet.'}
                  </p>
                </div>
              </div>

              {!isConnected && (
                <button
                  onClick={() => setActiveTab('guide')}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shrink-0"
                >
                  <span>Open Setup Guide</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* URL Input Form */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-theme-text flex items-center justify-between">
                <span>Google Apps Script Web App URL</span>
                <span className="text-[11px] font-normal text-theme-muted">
                  Must end with <code className="text-emerald-600">/exec</code>
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-theme-border bg-theme-card focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  onClick={handleSaveAndTest}
                  disabled={isTesting || !urlInput.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0"
                >
                  {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  <span>{isTesting ? 'Testing...' : 'Test & Save'}</span>
                </button>
              </div>

              {testResult && (
                <div className={`text-xs p-2.5 rounded-lg border flex items-center gap-2 ${
                  testResult.ok 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300'
                }`}>
                  {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            {/* Sync Actions Grid */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-theme-muted">
                Manual Synchronization Actions
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Two-Way Sync */}
                <button
                  onClick={() => handleTriggerSync('two-way')}
                  disabled={isSyncing || !googleSheetsConfig.webAppUrl}
                  className="p-3.5 rounded-xl border border-theme-border bg-theme-card hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-left transition-all disabled:opacity-50 shadow-2xs group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <RefreshCw className={`w-4 h-4 text-emerald-600 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'}`} />
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      Recommended
                    </span>
                  </div>
                  <div className="text-xs font-bold text-theme-text">Two-Way Sync</div>
                  <div className="text-[11px] text-theme-muted mt-0.5">
                    Merges edits from both App & Google Sheet
                  </div>
                </button>

                {/* Push to Sheet */}
                <button
                  onClick={() => handleTriggerSync('push')}
                  disabled={isSyncing || !googleSheetsConfig.webAppUrl}
                  className="p-3.5 rounded-xl border border-theme-border bg-theme-card hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 text-left transition-all disabled:opacity-50 shadow-2xs group"
                >
                  <UploadCloud className="w-4 h-4 text-blue-600 mb-1.5 group-hover:-translate-y-0.5 transition-transform" />
                  <div className="text-xs font-bold text-theme-text">Push to Sheet</div>
                  <div className="text-[11px] text-theme-muted mt-0.5">
                    Overwrites sheet with current app tasks ({tasks.length})
                  </div>
                </button>

                {/* Pull from Sheet */}
                <button
                  onClick={() => handleTriggerSync('pull')}
                  disabled={isSyncing || !googleSheetsConfig.webAppUrl}
                  className="p-3.5 rounded-xl border border-theme-border bg-theme-card hover:border-purple-500 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 text-left transition-all disabled:opacity-50 shadow-2xs group"
                >
                  <DownloadCloud className="w-4 h-4 text-purple-600 mb-1.5 group-hover:translate-y-0.5 transition-transform" />
                  <div className="text-xs font-bold text-theme-text">Pull from Sheet</div>
                  <div className="text-[11px] text-theme-muted mt-0.5">
                    Imports tasks & changes made in Google Sheet
                  </div>
                </button>
              </div>

              {syncFeedback && (
                <div className={`text-xs p-3 rounded-xl border flex items-center gap-2 mt-2 ${
                  syncFeedback.ok 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300'
                }`}>
                  {syncFeedback.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />}
                  <span>{syncFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Automation Options */}
            <div className="p-4 rounded-xl border border-theme-border bg-theme-card-hover/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Auto-Sync on Task Changes</span>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    Automatically pushes updates to Google Sheets in the background whenever you create, edit, or complete a task.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={googleSheetsConfig.autoSyncOnChange}
                  onChange={(e) => updateGoogleSheetsConfig({ autoSyncOnChange: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-theme-border/60 flex items-center gap-2 text-[11px] text-theme-muted">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero ban risk: Uses official Google Apps Script hosted on Google's own servers with 20,000 free operations/day.</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Setup Guide */}
        {activeTab === 'guide' && (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center gap-2">
              <span className="text-base">🚀</span>
              <span>Takes less than 3 minutes to set up. No Google Cloud project or credit card required.</span>
            </div>

            <ol className="space-y-4 counter-reset-item">
              <li className="p-3.5 rounded-xl border border-theme-border bg-theme-card space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-theme-text font-display">1. Create a Google Spreadsheet</span>
                  <a 
                    href="https://sheets.new" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <span>Open sheets.new</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-theme-muted">
                  Create a new blank Google Spreadsheet and name it whatever you like (e.g. <strong>"OptimusTime Master Sheet"</strong>).
                </p>
              </li>

              <li className="p-3.5 rounded-xl border border-theme-border bg-theme-card space-y-1.5">
                <span className="font-bold text-sm text-theme-text font-display">2. Open Apps Script</span>
                <p className="text-theme-muted">
                  In your Google Sheet, click the top menu: <strong className="text-theme-text">Extensions → Apps Script</strong>.
                </p>
              </li>

              <li className="p-3.5 rounded-xl border border-theme-border bg-theme-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-theme-text font-display">3. Paste the Sync Code</span>
                  <button
                    onClick={handleCopyCode}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs ${
                      isCopied 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    }`}
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Copied to Clipboard!' : '1-Click Copy Code'}</span>
                  </button>
                </div>
                <p className="text-theme-muted">
                  In Apps Script, delete any code inside <code>Code.gs</code>, click the button above to copy the official OptimusTime script, and paste it. Then press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">Ctrl + S</kbd> to save.
                </p>
              </li>

              <li className="p-3.5 rounded-xl border border-theme-border bg-theme-card space-y-1.5">
                <span className="font-bold text-sm text-theme-text font-display">4. Deploy as Web App</span>
                <p className="text-theme-muted leading-relaxed">
                  In Apps Script, click the blue button: <strong className="text-theme-text">Deploy → New deployment</strong>.<br />
                  - Click the gear icon <Settings2 className="w-3.5 h-3.5 inline text-theme-muted" /> and select <strong>Web app</strong>.<br />
                  - Set <strong>Execute as:</strong> <code>Me (your email)</code>.<br />
                  - Set <strong>Who has access:</strong> <strong className="text-emerald-600">Anyone</strong>.<br />
                  - Click <strong>Deploy</strong> (if prompted, click "Authorize Access" → "Advanced" → "Go to Untitled project (unsafe)").
                </p>
              </li>

              <li className="p-3.5 rounded-xl border border-theme-border bg-theme-card space-y-1.5">
                <span className="font-bold text-sm text-theme-text font-display">5. Paste Web App URL in OptimusTime</span>
                <p className="text-theme-muted">
                  Copy the generated <strong>Web App URL</strong> (ends in <code>/exec</code>), switch back to the <strong>Sync Control</strong> tab above, paste it into the URL box, and click <strong>Test & Save</strong>!
                </p>
              </li>
            </ol>
          </div>
        )}

        {/* Tab 3: Code Viewer */}
        {activeTab === 'code' && (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-theme-text font-display">
                Official OptimusTime Google Apps Script (Code.gs)
              </span>
              <button
                onClick={handleCopyCode}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                  isCopied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Copied to Clipboard!' : 'Copy Entire Script'}</span>
              </button>
            </div>

            <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[50vh] border border-slate-800 shadow-inner select-all">
              {GOOGLE_APPS_SCRIPT_TEMPLATE}
            </pre>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 sm:px-6 border-t border-theme-border flex items-center justify-between bg-theme-card text-xs">
          <div className="text-theme-muted font-mono">
            {googleSheetsConfig.webAppUrl ? 'URL Configured' : 'No Webhook URL'}
          </div>
          <button
            onClick={() => setIsGoogleSheetsModalOpen(false)}
            className="px-4 py-1.5 bg-theme-card-hover hover:bg-theme-border text-theme-text font-bold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
