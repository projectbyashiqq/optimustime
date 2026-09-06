import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, GitMerge, Download, Upload, Loader2, AlertTriangle } from 'lucide-react';

export const CloudConflictBanner: React.FC = () => {
  const { 
    cloudSyncStatus, 
    syncConflict, 
    resolveConflictWithMerge, 
    resolveConflictWithCloud, 
    resolveConflictWithLocalForce 
  } = useApp();

  const [resolvingAction, setResolvingAction] = useState<'merge' | 'cloud' | 'local' | null>(null);

  if (cloudSyncStatus !== 'conflict' || !syncConflict) {
    return null;
  }

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return 'Unknown time';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
        ' (' + d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
    } catch {
      return isoString;
    }
  };

  const handleMerge = async () => {
    setResolvingAction('merge');
    try {
      await resolveConflictWithMerge();
    } finally {
      setResolvingAction(null);
    }
  };

  const handleLoadCloud = async () => {
    setResolvingAction('cloud');
    try {
      await resolveConflictWithCloud();
    } finally {
      setResolvingAction(null);
    }
  };

  const handleForceLocal = async () => {
    if (!window.confirm('Are you sure you want to overwrite the cloud with this device? Changes saved on your other device may be overwritten.')) {
      return;
    }
    setResolvingAction('local');
    try {
      await resolveConflictWithLocalForce();
    } finally {
      setResolvingAction(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mb-4 animate-fade-in">
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 dark:bg-amber-950/40 dark:border-amber-500/40 backdrop-blur-xl shadow-lg space-y-3">
        
        {/* Header Title & Remote Time Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
          <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-300 font-bold text-sm sm:text-base">
            <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span>Cloud Sync Conflict Detected</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-200 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Cloud Updated: {formatTimestamp(syncConflict.remoteUpdatedAt)}</span>
          </div>
        </div>

        {/* Informative Explanation */}
        <p className="text-xs sm:text-sm text-theme-muted leading-relaxed">
          Another device updated your tasks after this device was last synced. To prevent accidental data loss, automatic overwrite has been safely blocked. Please choose how you want to proceed:
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          
          {/* Smart Merge (Recommended) */}
          <button
            type="button"
            onClick={handleMerge}
            disabled={resolvingAction !== null}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all transform active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            {resolvingAction === 'merge' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GitMerge className="w-4 h-4 text-white" />
            )}
            <span>Smart Merge Both (Recommended)</span>
          </button>

          {/* Load Cloud Version */}
          <button
            type="button"
            onClick={handleLoadCloud}
            disabled={resolvingAction !== null}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-theme-card hover:bg-theme-card-hover border border-theme-border text-theme-text font-bold text-xs shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {resolvingAction === 'cloud' ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            ) : (
              <Download className="w-4 h-4 text-blue-500" />
            )}
            <span>Load Cloud Version</span>
          </button>

          {/* Keep Local Version (Force Overwrite) */}
          <button
            type="button"
            onClick={handleForceLocal}
            disabled={resolvingAction !== null}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {resolvingAction === 'local' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>Keep Local & Overwrite Cloud</span>
          </button>

        </div>

      </div>
    </div>
  );
};
