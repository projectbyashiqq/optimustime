import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { 
  EmergencyBufferPlan, 
  TaskRescheduleProposal, 
  TaskRescheduleAction,
  EmergencyCategoryItem
} from '../types';
import { 
  toISODateString, 
  formatMinutesTo12Hour, 
  parse12HourToMinutes, 
  calculateEmergencyReschedule,
  calculateBatchShiftProposals,
  calculateBatchDeferToTomorrowProposals,
  calculateBatchCompressProposals,
  getSmartNextFreeSlot,
  isTaskScheduledForDate
} from '../utils/timeUtils';
import { 
  ShieldAlert, 
  Clock, 
  Calendar, 
  ArrowRight, 
  Check, 
  X, 
  FastForward, 
  Sparkles, 
  CheckCircle2, 
  CalendarDays, 
  Pause, 
  Scissors, 
  Lock, 
  Sliders, 
  CheckSquare, 
  Square,
  RotateCcw,
  Edit2,
  Plus,
  Trash2,
  Settings2
} from 'lucide-react';

const DURATION_PILLS = [30, 45, 60, 90, 120, 180, 240, 360, 1440];

const EMOJI_PALETTE = [
  '⚡', '🩺', '🚨', '🌐', '🚗', '⚠️', '🔥', '💧', '💊', '🏥',
  '👨‍👩‍👧', '💻', '🔌', '🌧️', '🌪️', '🛑', '🚑', '📱', '🛠️', '💼'
];

type StrategyType = 'auto' | 'shift1h' | 'shift2h' | 'shift4h' | 'defer24h' | 'defer48h' | 'compress' | 'hold' | 'custom';

export const EmergencyBufferModal: React.FC = () => {
  const { 
    isEmergencyModalOpen, 
    emergencyModalParams, 
    closeEmergencyModal, 
    tasks, 
    capacitySettings,
    triggerEmergencyBuffer,
    emergencyCategories,
    addEmergencyCategory,
    updateEmergencyCategory,
    deleteEmergencyCategory,
    resetEmergencyCategories
  } = useApp();

  // Part 1: Selected category & Customization mode
  const [selectedCatId, setSelectedCatId] = useState<string>('ecat-1');
  const [customTitle, setCustomTitle] = useState('⚡ Loadshedding / Power Outage');
  const [isEditingPresets, setIsEditingPresets] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catNameInput, setCatNameInput] = useState('');
  const [catEmojiInput, setCatEmojiInput] = useState('⚡');
  const [catDurationInput, setCatDurationInput] = useState(120);

  // Part 2: Small & Fast Time Customization
  const [date, setDate] = useState(toISODateString(new Date()));
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    const min = now.getMinutes();
    const roundedMin = Math.ceil(min / 5) * 5;
    now.setMinutes(roundedMin);
    return formatMinutesTo12Hour(now.getHours() * 60 + now.getMinutes());
  });
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [notes, setNotes] = useState('');

  // Part 3: Strategy & Rescheduling Studio
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('auto');
  const [proposals, setProposals] = useState<TaskRescheduleProposal[]>([]);

  // Synchronize initial modal params
  useEffect(() => {
    if (emergencyModalParams) {
      if (emergencyModalParams.date) setDate(emergencyModalParams.date);
      if (emergencyModalParams.startTime) setStartTime(emergencyModalParams.startTime);
    }
  }, [emergencyModalParams]);

  // Compute End Time
  const endTime = useMemo(() => {
    const startMin = parse12HourToMinutes(startTime);
    return formatMinutesTo12Hour(startMin + durationMinutes);
  }, [startTime, durationMinutes]);

  // Function to compute fresh auto-proposals for today by default
  const computeFreshAutoProposals = useCallback(() => {
    return calculateEmergencyReschedule(startTime, durationMinutes, date, tasks, capacitySettings);
  }, [startTime, durationMinutes, date, tasks, capacitySettings]);

  // Recompute proposals whenever time, duration, or date changes
  useEffect(() => {
    const fresh = computeFreshAutoProposals();
    const startMin = parse12HourToMinutes(startTime);
    const emergencyEndMin = startMin + durationMinutes;

    if (selectedStrategy === 'defer24h') {
      setProposals(calculateBatchDeferToTomorrowProposals(fresh, date, tasks, 1));
    } else if (selectedStrategy === 'defer48h') {
      setProposals(calculateBatchDeferToTomorrowProposals(fresh, date, tasks, 2));
    } else if (selectedStrategy === 'shift1h') {
      setProposals(calculateBatchShiftProposals(fresh, 60, emergencyEndMin, date, tasks, capacitySettings));
    } else if (selectedStrategy === 'shift2h') {
      setProposals(calculateBatchShiftProposals(fresh, 120, emergencyEndMin, date, tasks, capacitySettings));
    } else if (selectedStrategy === 'shift4h') {
      setProposals(calculateBatchShiftProposals(fresh, 240, emergencyEndMin, date, tasks, capacitySettings));
    } else if (selectedStrategy === 'compress') {
      setProposals(calculateBatchCompressProposals(fresh, emergencyEndMin, date, tasks, capacitySettings, 0.5));
    } else if (selectedStrategy === 'hold') {
      setProposals(fresh.map(p => p.isMandatory ? p : { ...p, action: 'hold', approved: true, notes: 'Placed on Hold (Backlog)' }));
    } else if (selectedStrategy === 'custom') {
      // Retain custom user adjustments unless date/time inputs changed drastically
    } else {
      // Default: auto-cascade on today
      setProposals(fresh);
      setSelectedStrategy('auto');
    }
  }, [startTime, durationMinutes, date, tasks, capacitySettings, selectedStrategy, computeFreshAutoProposals]);

  if (!isEmergencyModalOpen) return null;

  // Handle Preset Selection
  const handleSelectPreset = (cat: EmergencyCategoryItem) => {
    setSelectedCatId(cat.id);
    setCustomTitle(`${cat.emoji} ${cat.name}`);
    setDurationMinutes(cat.defaultDuration || 60);
  };

  // Preset Editor Handlers
  const handleStartEditCategory = (cat: EmergencyCategoryItem) => {
    setEditingCatId(cat.id);
    setCatNameInput(cat.name);
    setCatEmojiInput(cat.emoji);
    setCatDurationInput(cat.defaultDuration || 60);
  };

  const handleSaveCategory = () => {
    if (!catNameInput.trim()) return;

    if (editingCatId && editingCatId !== 'new') {
      const existing = emergencyCategories.find(c => c.id === editingCatId);
      if (existing) {
        updateEmergencyCategory({
          ...existing,
          name: catNameInput.trim(),
          emoji: catEmojiInput,
          defaultDuration: catDurationInput
        });
      }
    } else {
      addEmergencyCategory({
        name: catNameInput.trim(),
        emoji: catEmojiInput,
        defaultDuration: catDurationInput,
        color: '#DC2626'
      });
    }

    setEditingCatId(null);
    setCatNameInput('');
  };

  // Quick "Round to Now"
  const handleSetToCurrentTime = () => {
    const now = new Date();
    const min = now.getMinutes();
    const rounded = Math.ceil(min / 5) * 5;
    now.setMinutes(rounded);
    setStartTime(formatMinutesTo12Hour(now.getHours() * 60 + now.getMinutes()));
  };

  // Strategy Handlers
  const handleStrategyAutoCascade = () => {
    setSelectedStrategy('auto');
    setProposals(calculateEmergencyReschedule(startTime, durationMinutes, date, tasks, capacitySettings));
  };

  const handleStrategyShift = (mins: number, strategyName: StrategyType) => {
    setSelectedStrategy(strategyName);
    const startMin = parse12HourToMinutes(startTime);
    const fresh = calculateEmergencyReschedule(startTime, durationMinutes, date, tasks, capacitySettings);
    setProposals(calculateBatchShiftProposals(fresh, mins, startMin + durationMinutes, date, tasks, capacitySettings));
  };

  const handleStrategyDefer = (daysOffset: number, strategyName: StrategyType) => {
    setSelectedStrategy(strategyName);
    const fresh = calculateEmergencyReschedule(startTime, durationMinutes, date, tasks, capacitySettings);
    setProposals(calculateBatchDeferToTomorrowProposals(fresh, date, tasks, daysOffset));
  };

  const handleStrategyCompressAll = (ratio = 0.5) => {
    setSelectedStrategy('compress');
    const startMin = parse12HourToMinutes(startTime);
    const fresh = calculateEmergencyReschedule(startTime, durationMinutes, date, tasks, capacitySettings);
    setProposals(calculateBatchCompressProposals(fresh, startMin + durationMinutes, date, tasks, capacitySettings, ratio));
  };

  const handleStrategyHoldAll = () => {
    setSelectedStrategy('hold');
    setProposals(prev => prev.map(p => {
      if (p.isMandatory) return p;
      return {
        ...p,
        action: 'hold',
        approved: true,
        notes: 'Placed on Hold (Backlog)'
      };
    }));
  };

  // Toggle Single Task Permission (Approved checkbox)
  const handleToggleTaskApproval = (taskId: string) => {
    setSelectedStrategy('custom');
    setProposals(prev => prev.map(p => {
      if (p.taskId === taskId) {
        return { ...p, approved: !p.approved };
      }
      return p;
    }));
  };

  // Change Single Task Action with intelligent sequential re-cascade on Today
  const handleChangeTaskAction = (taskId: string, action: TaskRescheduleAction, daysOffset = 1, newDuration?: number) => {
    const origTask = tasks.find(t => t.id === taskId);
    if (origTask?.isMandatorySchedule) return;

    setSelectedStrategy('custom');

    const [y, m, d] = date.split('-').map(Number);
    const targetDateObj = new Date(y, m - 1, d);
    targetDateObj.setDate(targetDateObj.getDate() + daysOffset);
    const targetDateStr = toISODateString(targetDateObj);
    const emergencyEndMin = parse12HourToMinutes(startTime) + durationMinutes;
    const rawDayEnd = capacitySettings?.dayEndTime || '11:00 PM';
    const dayEndMin = parse12HourToMinutes(rawDayEnd) || 1380;
    const mandatoryTasks = tasks.filter(t => isTaskScheduledForDate(t, date) && t.isMandatorySchedule);

    setProposals(prev => {
      // 1. Update the target proposal
      const updatedList = prev.map(p => {
        if (p.taskId !== taskId) return p;

        const dur = newDuration ?? p.currentDurationMinutes;
        const buffer = origTask?.bufferMinutes ?? 5;

        if (action === 'keep') {
          return {
            ...p,
            action: 'keep' as TaskRescheduleAction,
            approved: false,
            proposedDate: date,
            proposedStartTime: p.currentStartTime,
            proposedEndTime: p.currentEndTime,
            proposedDurationMinutes: p.currentDurationMinutes,
            notes: 'Kept in original slot'
          };
        }

        if (action === 'defer_tomorrow') {
          const targetDayTasks = tasks.filter(t => 
            isTaskScheduledForDate(t, targetDateStr) && 
            t.status !== 'Done' && 
            t.status !== 'Terminated' && 
            !t.isEmergencyBuffer && 
            t.id !== taskId
          );
          const slot = getSmartNextFreeSlot(targetDateStr, dur, targetDayTasks, [], taskId, buffer);
          const dayLabel = daysOffset === 1 ? 'Tomorrow' : `+${daysOffset} Days`;
          return {
            ...p,
            action: 'defer_tomorrow' as TaskRescheduleAction,
            approved: true,
            proposedDate: targetDateStr,
            proposedStartTime: slot.startTime,
            proposedEndTime: slot.endTime,
            proposedDurationMinutes: dur,
            notes: `Moved to ${dayLabel} (${targetDateStr})`
          };
        }

        if (action === 'compress') {
          const compressedDur = newDuration ?? Math.max(15, Math.round((p.currentDurationMinutes * 0.5) / 5) * 5);
          return {
            ...p,
            action: 'compress' as TaskRescheduleAction,
            approved: true,
            proposedDate: date,
            proposedDurationMinutes: compressedDur,
            notes: `Compressed to ${compressedDur}m`
          };
        }

        if (action === 'hold') {
          return {
            ...p,
            action: 'hold' as TaskRescheduleAction,
            approved: true,
            notes: 'Placed on Hold (Backlog)'
          };
        }

        // shift_same_day
        return {
          ...p,
          action: 'shift_same_day' as TaskRescheduleAction,
          approved: true,
          proposedDate: date,
          proposedDurationMinutes: dur,
          notes: 'Scheduled on today'
        };
      });

      // 2. Re-cascade all same-day tasks sequentially so NO overlaps occur on Today!
      let cascadeCursor = emergencyEndMin;
      return updatedList.map(p => {
        if (p.isMandatory || p.action === 'keep' || p.action === 'defer_tomorrow' || p.action === 'hold') {
          if (p.isMandatory) {
            const mEnd = parse12HourToMinutes(p.currentEndTime);
            if (mEnd > cascadeCursor) cascadeCursor = Math.max(cascadeCursor, mEnd + 5);
          }
          return p;
        }

        const dur = p.proposedDurationMinutes || p.currentDurationMinutes;
        const taskBuffer = tasks.find(t => t.id === p.taskId)?.bufferMinutes ?? 5;

        let startMin = cascadeCursor;

        // Avoid mandatory tasks
        let collision = true;
        while (collision) {
          collision = false;
          const endMin = startMin + dur;
          for (const mand of mandatoryTasks) {
            const mStart = parse12HourToMinutes(mand.startTime);
            const mEnd = parse12HourToMinutes(mand.endTime);
            if (startMin < mEnd && endMin > mStart) {
              startMin = mEnd + (mand.bufferMinutes ?? 5);
              collision = true;
              break;
            }
          }
        }

        const endMin = startMin + dur;

        if (endMin <= dayEndMin) {
          cascadeCursor = endMin + taskBuffer;
          return {
            ...p,
            proposedDate: date,
            proposedStartTime: formatMinutesTo12Hour(startMin),
            proposedEndTime: formatMinutesTo12Hour(endMin),
            proposedDurationMinutes: dur
          };
        } else {
          // Overflow to tomorrow
          const tomSlot = getSmartNextFreeSlot(targetDateStr, dur, tasks, [], p.taskId, taskBuffer);
          return {
            ...p,
            action: 'defer_tomorrow' as TaskRescheduleAction,
            proposedDate: targetDateStr,
            proposedStartTime: tomSlot.startTime,
            proposedEndTime: tomSlot.endTime,
            proposedDurationMinutes: dur,
            notes: `Day overflow -> Tomorrow (${targetDateStr})`
          };
        }
      });
    });
  };

  // Format Duration Label
  const formatDurationLabel = (mins: number) => {
    if (mins === 1440) return '24h Full Day';
    if (mins % 60 === 0) return `${mins / 60}h`;
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins}m`;
  };

  // Metrics summary
  const mandatoryCount = proposals.filter(p => p.isMandatory).length;
  const approvedCount = proposals.filter(p => !p.isMandatory && p.approved && p.action !== 'keep').length;
  const shiftTodayCount = proposals.filter(p => !p.isMandatory && p.approved && (p.action === 'shift_same_day' || p.action === 'compress')).length;
  const deferTomorrowCount = proposals.filter(p => !p.isMandatory && p.approved && p.action === 'defer_tomorrow').length;
  const holdCount = proposals.filter(p => !p.isMandatory && p.approved && p.action === 'hold').length;

  // Confirm and Execute
  const handleConfirm = () => {
    const selectedCategory = emergencyCategories.find(c => c.id === selectedCatId);
    const plan: EmergencyBufferPlan = {
      id: `emerg_${Date.now()}`,
      emergencyType: (selectedCategory?.name as any) || 'Other Emergency',
      title: customTitle.trim() || '⚡ Emergency Buffer',
      date,
      startTime,
      endTime,
      durationMinutes,
      notes,
      createdAt: new Date().toISOString()
    };

    triggerEmergencyBuffer(plan, proposals);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-theme-card border-2 border-red-500/70 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-scale-up">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white flex items-center justify-between shadow-lg shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-inner ring-2 ring-white/30 animate-pulse">
              <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black font-display tracking-tight">
                  🚨 Emergency BUFFER Protocol
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/25 text-white tracking-wider">
                  Uncontrollable Disruption
                </span>
              </div>
              <p className="text-xs text-white/90 font-medium">
                Reserve emergency buffer time & sync remaining tasks around mandatory fixed schedules.
              </p>
            </div>
          </div>

          <button
            onClick={closeEmergencyModal}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-theme-text custom-scrollbar">
          
          {/* SECTION 1: EDITABLE / CUSTOMIZABLE PRESETS GRID */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-theme-muted flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center text-[10px] font-bold">1</span>
                <span>Select Emergency Event Preset ({emergencyCategories.length} available)</span>
              </label>

              {/* Edit Presets Toggle */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditingPresets(!isEditingPresets)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isEditingPresets
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-theme-card-hover hover:bg-theme-border text-theme-text border border-theme-border'
                  }`}
                  title="Customize preset categories"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{isEditingPresets ? 'Done Editing' : '✏️ Customize Presets'}</span>
                </button>

                {isEditingPresets && (
                  <button
                    type="button"
                    onClick={resetEmergencyCategories}
                    className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-theme-card hover:bg-theme-border text-theme-muted hover:text-theme-text border border-theme-border transition-all flex items-center gap-1"
                    title="Restore Default Presets"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Defaults</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inline Preset Editor Mode */}
            {isEditingPresets && (
              <div className="p-3.5 rounded-2xl bg-red-50/60 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-800/80 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-red-950 dark:text-red-200 flex items-center gap-1.5">
                    <Settings2 className="w-4 h-4 text-red-600" />
                    <span>Add or Edit Emergency Presets</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId('new');
                      setCatNameInput('');
                      setCatEmojiInput('⚡');
                      setCatDurationInput(120);
                    }}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Preset</span>
                  </button>
                </div>

                {/* Edit / Add Category Form */}
                {editingCatId && (
                  <div className="p-3 rounded-xl bg-theme-card border border-theme-border space-y-2.5 shadow-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-theme-muted">Preset Title</label>
                        <input
                          type="text"
                          value={catNameInput}
                          onChange={(e) => setCatNameInput(e.target.value)}
                          placeholder="e.g. Migraine / Power Cut / Sudden Meeting"
                          className="w-full px-3 py-1.5 rounded-lg bg-theme-card-hover border border-theme-border text-xs font-bold text-theme-text focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-theme-muted">Default Minutes</label>
                        <input
                          type="number"
                          value={catDurationInput}
                          onChange={(e) => setCatDurationInput(Math.max(10, parseInt(e.target.value) || 60))}
                          className="w-full px-3 py-1.5 rounded-lg bg-theme-card-hover border border-theme-border text-xs font-mono font-bold text-theme-text focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Emoji Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-theme-muted">Choose Emoji Icon</label>
                      <div className="flex items-center gap-1 flex-wrap p-1 bg-theme-card-hover rounded-lg border border-theme-border">
                        {EMOJI_PALETTE.map((emo) => (
                          <button
                            key={emo}
                            type="button"
                            onClick={() => setCatEmojiInput(emo)}
                            className={`w-7 h-7 rounded-md text-sm flex items-center justify-center transition-transform ${
                              catEmojiInput === emo ? 'bg-red-500 text-white scale-110 shadow-sm' : 'hover:bg-theme-card'
                            }`}
                          >
                            {emo}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingCatId(null)}
                        className="px-3 py-1 rounded-lg text-xs font-semibold text-theme-muted hover:text-theme-text"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCategory}
                        className="px-4 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm"
                      >
                        Save Preset
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {emergencyCategories.map((cat) => {
                const isSelected = selectedCatId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className={`p-2.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 ring-2 ring-red-400/40 font-bold shadow-sm'
                        : 'border-theme-border bg-theme-card hover:bg-theme-card-hover text-theme-text'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectPreset(cat)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base bg-red-100 dark:bg-red-950/80 shrink-0 shadow-sm">
                        {cat.emoji}
                      </div>
                      <div className="min-w-0 truncate">
                        <p className="text-xs font-bold truncate">{cat.name}</p>
                        <span className="text-[10px] text-theme-muted font-mono">{formatDurationLabel(cat.defaultDuration)}</span>
                      </div>
                    </button>

                    {isEditingPresets && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditCategory(cat)}
                          className="p-1 rounded hover:bg-theme-card text-theme-muted hover:text-theme-text"
                          title="Edit"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        {!cat.isSystem && (
                          <button
                            type="button"
                            onClick={() => deleteEmergencyCategory(cat.id)}
                            className="p-1 rounded hover:bg-red-100 text-theme-muted hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: SMALL, FAST TIME & DURATION CUSTOMIZATION */}
          <div className="p-3.5 rounded-2xl bg-theme-card-hover border border-theme-border space-y-2.5">
            
            {/* Title Line */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-theme-muted shrink-0">Emergency Title:</span>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl bg-theme-card border border-theme-border text-xs font-bold text-theme-text focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="e.g. ⚡ Loadshedding / Sudden Sickness"
              />
            </div>

            {/* Fast Inline Time Control Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Date */}
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-theme-card border border-theme-border">
                <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="text-[11px] font-bold text-theme-muted shrink-0">Date:</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-theme-text focus:outline-none"
                />
              </div>

              {/* Start Time */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-theme-card border border-theme-border">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-[11px] font-bold text-theme-muted shrink-0">Start:</span>
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-transparent text-xs font-bold text-theme-text font-mono focus:outline-none"
                    placeholder="01:15 PM"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSetToCurrentTime}
                  className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-[10px] font-black shrink-0 hover:underline"
                >
                  Now
                </button>
              </div>

              {/* Calculated End Time */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-theme-card border border-theme-border">
                <div className="flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-[11px] font-bold text-theme-muted shrink-0">End:</span>
                  <span className="text-xs font-black text-red-600 dark:text-red-400 font-mono">
                    {endTime}
                  </span>
                </div>
                <span className="text-[10px] text-theme-muted font-mono font-bold">
                  ({durationMinutes}m)
                </span>
              </div>
            </div>

            {/* Fast Duration Pills */}
            <div className="flex items-center justify-between gap-1 flex-wrap pt-1 border-t border-theme-border/50">
              <div className="flex items-center gap-1 flex-wrap">
                {DURATION_PILLS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      durationMinutes === mins
                        ? 'bg-red-600 text-white shadow-sm ring-1 ring-red-400'
                        : 'bg-theme-card hover:bg-theme-border text-theme-muted hover:text-theme-text border border-theme-border'
                    }`}
                  >
                    {mins === 1440 ? '🚨 24h Full Day' : formatDurationLabel(mins)}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] text-theme-muted font-bold">Custom:</span>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  step="5"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Math.max(5, parseInt(e.target.value) || 60))}
                  className="w-14 px-1.5 py-0.5 rounded-lg bg-theme-card border border-theme-border text-xs font-mono font-bold text-theme-text text-center focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: INTELLIGENT RESCHEDULING & 1-CLICK STRATEGIES STUDIO */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-black uppercase tracking-wider text-theme-muted flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center text-[10px] font-bold">3</span>
                <span>Intelligent Reschedule & Shift Matrix ({proposals.length} Tasks)</span>
              </label>

              {/* Status Summary Pills */}
              <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono font-bold">
                {mandatoryCount > 0 && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 rounded-lg border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>{mandatoryCount} Mandatory Fixed</span>
                  </span>
                )}
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 rounded-lg">
                  ⚡ {shiftTodayCount} Today
                </span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 rounded-lg">
                  📅 {deferTomorrowCount} Deferred
                </span>
                {holdCount > 0 && (
                  <span className="px-2 py-0.5 bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 rounded-lg">
                    ⏸️ {holdCount} Hold
                  </span>
                )}
              </div>
            </div>

            {/* Quick 1-Click Strategy Toolbar */}
            <div className="p-3 rounded-2xl bg-theme-card-hover border border-theme-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-theme-text flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-red-500" />
                  <span>1-Click Batch Reschedule Strategies:</span>
                </span>
                <span className="text-[10px] text-theme-muted">
                  Mandatory tasks are anchored and will never shift.
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {/* 1. Auto-Fit Today */}
                <button
                  type="button"
                  onClick={handleStrategyAutoCascade}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${
                    selectedStrategy === 'auto'
                      ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white ring-2 ring-red-400 shadow-md'
                      : 'bg-theme-card hover:bg-theme-border text-theme-text border border-theme-border'
                  }`}
                  title="Schedule all flexible tasks on TODAY sequentially starting after emergency"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>⚡ Auto-Fit Today (Default)</span>
                </button>

                {/* 2. +1h Shift */}
                <button
                  type="button"
                  onClick={() => handleStrategyShift(60, 'shift1h')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${
                    selectedStrategy === 'shift1h'
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-md'
                      : 'bg-theme-card hover:bg-theme-border text-theme-text border border-theme-border'
                  }`}
                  title="Shift all tasks forward by +1 Hour (+60m)"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>⏱️ +1h</span>
                </button>

                {/* 3. +2h Shift */}
                <button
                  type="button"
                  onClick={() => handleStrategyShift(120, 'shift2h')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${
                    selectedStrategy === 'shift2h'
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-md'
                      : 'bg-theme-card hover:bg-theme-border text-theme-text border border-theme-border'
                  }`}
                  title="Shift all tasks forward by +2 Hours (+120m)"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>⏱️ +2h</span>
                </button>

                {/* 4. +4h Shift */}
                <button
                  type="button"
                  onClick={() => handleStrategyShift(240, 'shift4h')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${
                    selectedStrategy === 'shift4h'
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-md'
                      : 'bg-theme-card hover:bg-theme-border text-theme-text border border-theme-border'
                  }`}
                  title="Shift all tasks forward by +4 Hours (+240m)"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>⏱️ +4h</span>
                </button>

                {/* 5. Tomorrow (+24h) */}
                <button
                  type="button"
                  onClick={() => handleStrategyDefer(1, 'defer24h')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${
                    selectedStrategy === 'defer24h'
                      ? 'bg-amber-500 text-white ring-2 ring-amber-300 shadow-md'
                      : 'bg-theme-card hover:bg-theme-border text-theme-text border border-theme-border'
                  }`}
                  title="Move all flexible tasks to tomorrow morning"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>📅 Tomorrow (+24h)</span>
                </button>

                {/* 6. +2 Days (+48h) */}
                <button
                  type="button"
                  onClick={() => handleStrategyDefer(2, 'defer48h')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${
                    selectedStrategy === 'defer48h'
                      ? 'bg-amber-600 text-white ring-2 ring-amber-300 shadow-md'
                      : 'bg-theme-card hover:bg-theme-border text-theme-text border border-theme-border'
                  }`}
                  title="Move all flexible tasks to 2 days later"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>📅 +2 Days (+48h)</span>
                </button>

                {/* 7. Compress 50% */}
                <button
                  type="button"
                  onClick={() => handleStrategyCompressAll(0.5)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${
                    selectedStrategy === 'compress'
                      ? 'bg-purple-600 text-white ring-2 ring-purple-300 shadow-md'
                      : 'bg-theme-card hover:bg-theme-border text-theme-text border border-theme-border'
                  }`}
                  title="Compress flexible tasks by 50% to fit remaining today's hours"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>✂️ Compress 50%</span>
                </button>

                {/* 8. Hold All */}
                <button
                  type="button"
                  onClick={handleStrategyHoldAll}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                    selectedStrategy === 'hold'
                      ? 'bg-zinc-700 text-white ring-2 ring-zinc-400 shadow-md'
                      : 'bg-theme-card hover:bg-theme-border text-theme-muted hover:text-theme-text border border-theme-border'
                  }`}
                  title="Put all flexible tasks on hold"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Hold All</span>
                </button>
              </div>
            </div>

            {/* Task Proposals Interactive Permission List */}
            {proposals.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  No other tasks scheduled on {date}
                </h4>
                <p className="text-[11px] text-theme-muted">
                  Your timeline after {startTime} is clear. The emergency buffer will be inserted cleanly.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {proposals.map((p) => {
                  const isMandatory = p.isMandatory;

                  return (
                    <div
                      key={p.taskId}
                      className={`p-3 rounded-2xl border transition-all shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 ${
                        isMandatory
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                          : p.approved && p.action !== 'keep'
                          ? 'bg-theme-card border-red-300/80 dark:border-red-900/60 ring-1 ring-red-400/20'
                          : 'bg-theme-card/60 border-theme-border opacity-75'
                      }`}
                    >
                      {/* Task Info & Time Diff */}
                      <div className="space-y-1 min-w-0 flex-1">
                        
                        {/* Header line */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {!isMandatory && (
                            <button
                              type="button"
                              onClick={() => handleToggleTaskApproval(p.taskId)}
                              className="text-theme-muted hover:text-theme-text transition-transform active:scale-90"
                              title={p.approved ? 'Approved for Reschedule (Click to exclude)' : 'Excluded (Click to approve)'}
                            >
                              {p.approved ? (
                                <CheckSquare className="w-4 h-4 text-red-600 dark:text-red-400" />
                              ) : (
                                <Square className="w-4 h-4 text-theme-muted" />
                              )}
                            </button>
                          )}

                          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded font-mono ${
                            p.priority === 'P1' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                            p.priority === 'P2' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          }`}>
                            {p.priority}
                          </span>

                          <span className="text-[10px] font-mono text-theme-muted font-bold">
                            {p.projectCode}
                          </span>

                          {isMandatory && (
                            <span className="text-[10px] font-black px-2 py-0.2 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 rounded-full flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              <span>MANDATORY FIXED</span>
                            </span>
                          )}

                          <h5 className="text-xs font-bold text-theme-text truncate">
                            {p.taskTitle}
                          </h5>
                        </div>

                        {/* Visual Time Comparison Diff */}
                        <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                          {isMandatory ? (
                            <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-amber-500" />
                              <span>Anchored: {p.currentStartTime} - {p.currentEndTime} ({p.currentDurationMinutes}m) • Protected</span>
                            </span>
                          ) : !p.approved || p.action === 'keep' ? (
                            <span className="font-semibold text-theme-muted flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span>Kept original slot: {p.currentStartTime} - {p.currentEndTime}</span>
                            </span>
                          ) : (
                            <>
                              <span className="line-through text-theme-muted opacity-60">
                                {p.currentStartTime} - {p.currentEndTime} ({p.currentDurationMinutes}m)
                              </span>
                              <ArrowRight className="w-3 h-3 text-red-500" />
                              <span className={`font-bold flex items-center gap-1 ${
                                p.action === 'defer_tomorrow' ? 'text-amber-600 dark:text-amber-400' :
                                p.action === 'hold' ? 'text-zinc-500' :
                                p.action === 'compress' ? 'text-purple-600 dark:text-purple-400' :
                                'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {p.action === 'hold' ? (
                                  <span>⏸️ Placed on Hold</span>
                                ) : (
                                  <>
                                    <span>
                                      {p.proposedDate === date ? 'Today' : p.proposedDate} &bull; {p.proposedStartTime} - {p.proposedEndTime}
                                    </span>
                                    {p.proposedDurationMinutes !== p.currentDurationMinutes && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">
                                        ✂️ {p.proposedDurationMinutes}m
                                      </span>
                                    )}
                                  </>
                                )}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Action Switcher Controls */}
                      <div className="flex items-center gap-1 shrink-0 self-end md:self-auto flex-wrap">
                        {isMandatory ? (
                          <span className="text-[10px] font-bold font-mono text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-600" />
                            <span>Immovable Schedule</span>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleChangeTaskAction(p.taskId, 'shift_same_day', 0)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                p.approved && p.action === 'shift_same_day' && p.proposedDate === date
                                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                              }`}
                              title="Schedule on Today"
                            >
                              ⚡ Today
                            </button>

                            <button
                              type="button"
                              onClick={() => handleChangeTaskAction(p.taskId, 'defer_tomorrow', 1)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                p.approved && p.action === 'defer_tomorrow' && p.proposedDate !== date
                                  ? 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-300'
                                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                              }`}
                              title="Move task to tomorrow"
                            >
                              📅 +24h
                            </button>

                            <button
                              type="button"
                              onClick={() => handleChangeTaskAction(p.taskId, 'defer_tomorrow', 2)}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-theme-card-hover text-theme-muted hover:text-theme-text transition-all"
                              title="Move task to 2 days later (+48h)"
                            >
                              📅 +48h
                            </button>

                            <button
                              type="button"
                              onClick={() => handleChangeTaskAction(p.taskId, 'compress')}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                p.approved && p.action === 'compress'
                                  ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-300'
                                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                              }`}
                              title="Compress duration to fit today"
                            >
                              ✂️ 50%
                            </button>

                            <button
                              type="button"
                              onClick={() => handleChangeTaskAction(p.taskId, 'hold')}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                p.approved && p.action === 'hold'
                                  ? 'bg-zinc-700 text-white shadow-sm ring-1 ring-zinc-400'
                                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                              }`}
                              title="Put task on hold in backlog"
                            >
                              ⏸️ Hold
                            </button>

                            <button
                              type="button"
                              onClick={() => handleChangeTaskAction(p.taskId, 'keep')}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                !p.approved || p.action === 'keep'
                                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                              }`}
                              title="Keep original scheduled slot"
                            >
                              ✓ Keep
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Action Confirmation Footer */}
        <div className="px-5 py-3.5 border-t border-theme-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-theme-card-hover/50 shrink-0">
          <div className="text-xs text-theme-muted">
            <span className="font-bold text-theme-text">{approvedCount}</span> tasks will be rescheduled &bull;{' '}
            <span className="font-bold text-amber-600 dark:text-amber-400">{mandatoryCount}</span> mandatory schedules protected
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={closeEmergencyModal}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white text-xs font-black rounded-xl shadow-lg shadow-red-500/30 transition-all transform active:scale-95"
            >
              <ShieldAlert className="w-4 h-4 stroke-[2.5]" />
              <span>Activate Emergency Buffer & Apply Reschedule ({approvedCount})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
