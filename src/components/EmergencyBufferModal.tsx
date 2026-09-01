import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { EmergencyCategoryItem, TaskRescheduleProposal, EmergencyBufferPlan, PriorityLevel } from '../types';
import { 
  toISODateString, 
  formatMinutesTo12Hour, 
  parse12HourToMinutes, 
  calculateEmergencyReschedule,
  getSmartNextFreeSlot,
  getDayOfWeekFromDate,
  addMinutesToTime
} from '../utils/timeUtils';
import { 
  ShieldAlert, 
  Zap, 
  Stethoscope, 
  Users, 
  WifiOff, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  ArrowRight, 
  Check, 
  X, 
  FastForward, 
  RotateCcw,
  Sparkles,
  Flame,
  CheckCircle2,
  CalendarDays,
  Pause,
  Edit2,
  Plus,
  Trash2,
  Settings2,
  Hourglass,
  Lock
} from 'lucide-react';

const DURATION_PRESETS = [30, 60, 120, 180, 240, 360, 1440];

const EMOJI_PALETTE = [
  '⚡', '🩺', '🚨', '🌐', '🚗', '⚠️', '🔥', '💧', '💊', '🏥',
  '👨‍👩‍👧', '💻', '🔌', '🌧️', '🌪️', '🦷', '🛑', '🚑', '📱', '🛠️',
  '📦', '✈️', '🚆', '🗣️', '💼', '⏳', '🔋', '🛑', '💤', '📝'
];

export const EmergencyBufferModal: React.FC = () => {
  const { 
    isEmergencyModalOpen, 
    emergencyModalParams, 
    closeEmergencyModal, 
    tasks, 
    capacitySettings,
    triggerEmergencyBuffer,
    prioritySettings,
    emergencyCategories,
    addEmergencyCategory,
    updateEmergencyCategory,
    deleteEmergencyCategory,
    resetEmergencyCategories
  } = useApp();

  const [selectedCatId, setSelectedCatId] = useState<string>('ecat-1');
  const [customTitle, setCustomTitle] = useState('⚡ Loadshedding / Power Outage');
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

  // Editable menu mode state
  const [isEditingMenu, setIsEditingMenu] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catNameInput, setCatNameInput] = useState('');
  const [catEmojiInput, setCatEmojiInput] = useState('⚡');
  const [catDurationInput, setCatDurationInput] = useState(60);

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

  // Compute day tasks on date
  const dayTasks = useMemo(() => {
    return tasks.filter(t => t.taskDate === date && t.status !== 'Done' && t.status !== 'Terminated' && !t.isEmergencyBuffer);
  }, [tasks, date]);

  // Generate initial auto proposals with intelligent non-overlapping cascade
  const autoProposals = useMemo(() => {
    return calculateEmergencyReschedule(startTime, durationMinutes, date, tasks, capacitySettings);
  }, [startTime, durationMinutes, date, tasks, capacitySettings]);

  // Local state for editable proposals
  const [proposals, setProposals] = useState<TaskRescheduleProposal[]>([]);

  useEffect(() => {
    setProposals(autoProposals);
  }, [autoProposals]);

  if (!isEmergencyModalOpen) return null;

  const currentCat = emergencyCategories.find(c => c.id === selectedCatId) || emergencyCategories[0];

  // Handle Preset Selection
  const handleSelectPreset = (cat: EmergencyCategoryItem) => {
    setSelectedCatId(cat.id);
    setCustomTitle(`${cat.emoji} ${cat.name}`);
    setDurationMinutes(cat.defaultDuration || 60);
  };

  // Batch Action 1: +1 Hour Delay for all flexible tasks
  const handleBatchDelay = (delayMins: number) => {
    const [y, m, d] = date.split('-').map(Number);
    const tomDate = new Date(y, m - 1, d);
    tomDate.setDate(tomDate.getDate() + 1);
    const tomorrowStr = toISODateString(tomDate);
    const dayEndMin = parse12HourToMinutes(capacitySettings.dayEndTime);

    setProposals(prev => prev.map(p => {
      const origTask = tasks.find(t => t.id === p.taskId);
      // Mandatory fixed tasks NEVER shift with batch delays
      if (origTask?.isMandatorySchedule) {
        return p;
      }

      const origStartMin = parse12HourToMinutes(p.currentStartTime);
      const origEndMin = parse12HourToMinutes(p.currentEndTime);
      const dur = origEndMin - origStartMin;
      
      const newStartMin = origStartMin + delayMins;
      const newEndMin = newStartMin + dur;

      if (newEndMin <= dayEndMin) {
        return {
          ...p,
          proposedDate: date,
          proposedStartTime: formatMinutesTo12Hour(newStartMin),
          proposedEndTime: formatMinutesTo12Hour(newEndMin),
          action: 'shift_same_day',
          delayMinutes: delayMins
        };
      } else {
        // Exceeds day end -> move to tomorrow morning
        const tomStart = parse12HourToMinutes(capacitySettings.dayStartTime);
        return {
          ...p,
          proposedDate: tomorrowStr,
          proposedStartTime: formatMinutesTo12Hour(tomStart),
          proposedEndTime: formatMinutesTo12Hour(tomStart + dur),
          action: 'defer_tomorrow',
          delayMinutes: delayMins
        };
      }
    }));
  };

  // Batch Action 2: Move Flexible Remaining Tasks to Next Day (Tomorrow) with ZERO overlaps
  const handleBatchMoveAllToNextDay = () => {
    const [y, m, d] = date.split('-').map(Number);
    const tomDate = new Date(y, m - 1, d);
    tomDate.setDate(tomDate.getDate() + 1);
    const tomorrowStr = toISODateString(tomDate);

    const tomorrowTasks = tasks.filter(t => t.taskDate === tomorrowStr && t.status !== 'Done' && t.status !== 'Terminated' && !t.isEmergencyBuffer);
    const simulatedPool: any[] = [...tomorrowTasks];

    setProposals(prev => prev.map(p => {
      const origTask = tasks.find(t => t.id === p.taskId);
      // Mandatory fixed tasks NEVER defer to tomorrow
      if (origTask?.isMandatorySchedule) {
        return p;
      }

      const origStartMin = parse12HourToMinutes(p.currentStartTime);
      const origEndMin = parse12HourToMinutes(p.currentEndTime);
      const dur = origEndMin - origStartMin;
      const buffer = origTask?.bufferMinutes || 5;

      const tomSlot = getSmartNextFreeSlot(
        tomorrowStr,
        dur,
        simulatedPool,
        [],
        p.taskId,
        buffer
      );

      simulatedPool.push({
        id: p.taskId,
        taskDate: tomorrowStr,
        startTime: tomSlot.startTime,
        endTime: tomSlot.endTime,
        appointedMinutes: dur,
        bufferMinutes: buffer,
        status: 'Pending'
      });

      return {
        ...p,
        proposedDate: tomorrowStr,
        proposedStartTime: tomSlot.startTime,
        proposedEndTime: tomSlot.endTime,
        action: 'defer_tomorrow'
      };
    }));
  };

  // Batch Action 3: Hold All
  const handleBatchHoldAll = () => {
    setProposals(prev => prev.map(p => {
      const origTask = tasks.find(t => t.id === p.taskId);
      if (origTask?.isMandatorySchedule) {
        return p;
      }
      return {
        ...p,
        action: 'hold'
      };
    }));
  };

  // Toggle Action for single task
  const handleToggleTaskAction = (taskId: string, actionType: TaskRescheduleProposal['action'], delayMins?: number) => {
    const origTask = tasks.find(t => t.id === taskId);
    if (origTask?.isMandatorySchedule) {
      return; // Cannot modify mandatory locked task
    }

    const [y, m, d] = date.split('-').map(Number);
    const tomDate = new Date(y, m - 1, d);
    tomDate.setDate(tomDate.getDate() + 1);
    const tomorrowStr = toISODateString(tomDate);

    setProposals(prev => prev.map(p => {
      if (p.taskId !== taskId) return p;

      const origStartMin = parse12HourToMinutes(p.currentStartTime);
      const origEndMin = parse12HourToMinutes(p.currentEndTime);
      const dur = origEndMin - origStartMin;

      if (actionType === 'defer_tomorrow') {
        const tomorrowTasks = tasks.filter(t => t.taskDate === tomorrowStr && t.status !== 'Done' && t.status !== 'Terminated' && !t.isEmergencyBuffer && t.id !== taskId);
        const tomSlot = getSmartNextFreeSlot(
          tomorrowStr,
          dur,
          tomorrowTasks,
          [],
          taskId,
          origTask?.bufferMinutes || 5
        );
        return {
          ...p,
          proposedDate: tomorrowStr,
          proposedStartTime: tomSlot.startTime,
          proposedEndTime: tomSlot.endTime,
          action: 'defer_tomorrow'
        };
      } else if (actionType === 'hold') {
        return { ...p, action: 'hold' };
      } else {
        // shift_same_day with custom delay
        const added = delayMins || 60;
        const newStart = origStartMin + added;
        return {
          ...p,
          proposedDate: date,
          proposedStartTime: formatMinutesTo12Hour(newStart),
          proposedEndTime: formatMinutesTo12Hour(newStart + dur),
          action: 'shift_same_day',
          delayMinutes: added
        };
      }
    }));
  };

  // Category Editor Handlers
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

  // Confirm and Execute Emergency Protocol
  const handleConfirm = () => {
    const plan: EmergencyBufferPlan = {
      id: `emerg_${Date.now()}`,
      emergencyType: (currentCat?.name as any) || 'Loadshedding',
      title: customTitle,
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-theme-card border-2 border-red-500/60 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-inner animate-pulse">
              <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black font-display tracking-tight">
                  🚨 Emergency BUFFER Protocol
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/25 text-white tracking-widest">
                  Uncontrollable Event
                </span>
              </div>
              <p className="text-xs text-white/90 font-medium">
                Insert an emergency buffer and delay or move remaining tasks of the day.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditingMenu(!isEditingMenu)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                isEditingMenu
                  ? 'bg-white text-red-700 shadow-md'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
              title="Edit Emergency Menu Presets"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{isEditingMenu ? 'Done Editing' : '✏️ Edit Menu'}</span>
            </button>

            <button
              onClick={closeEmergencyModal}
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 text-theme-text">
          
          {/* Inline Emergency Menu Editor */}
          {isEditingMenu && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/30 border-2 border-red-300 dark:border-red-800 space-y-4 animate-slide-up">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-red-950 dark:text-red-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Settings2 className="w-4 h-4 text-red-600" />
                    <span>Customize Emergency Buffer Menu</span>
                  </h4>
                  <p className="text-[11px] text-red-800/80 dark:text-red-300/80">
                    Add, edit, or delete emergency presets (e.g. Loadshedding, Illness, Family, Traffic).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId('new');
                      setCatNameInput('');
                      setCatEmojiInput('⚡');
                      setCatDurationInput(60);
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Preset</span>
                  </button>

                  <button
                    type="button"
                    onClick={resetEmergencyCategories}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 hover:bg-red-100 text-theme-muted hover:text-red-600 border border-theme-border flex items-center gap-1"
                    title="Restore System Defaults"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restore Defaults</span>
                  </button>
                </div>
              </div>

              {/* Edit / Add Form */}
              {editingCatId && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-theme-muted">Emergency Preset Name</label>
                      <input
                        type="text"
                        value={catNameInput}
                        onChange={(e) => setCatNameInput(e.target.value)}
                        placeholder="e.g. Migraine / Power Cut / Sudden Meeting"
                        className="w-full px-3 py-1.5 rounded-lg bg-theme-card border border-theme-border text-xs font-bold text-theme-text focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-theme-muted">Default Minutes</label>
                      <input
                        type="number"
                        value={catDurationInput}
                        onChange={(e) => setCatDurationInput(Math.max(10, parseInt(e.target.value) || 60))}
                        className="w-full px-3 py-1.5 rounded-lg bg-theme-card border border-theme-border text-xs font-mono font-bold text-theme-text focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Emoji Picker */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-theme-muted">Choose Emoji Icon</label>
                    <div className="flex items-center gap-1 flex-wrap max-h-24 overflow-y-auto p-1 bg-theme-card rounded-lg border border-theme-border">
                      {EMOJI_PALETTE.map((emo) => (
                        <button
                          key={emo}
                          type="button"
                          onClick={() => setCatEmojiInput(emo)}
                          className={`w-7 h-7 rounded-md text-sm flex items-center justify-center transition-transform ${
                            catEmojiInput === emo ? 'bg-red-500 text-white scale-110 shadow-sm' : 'hover:bg-theme-card-hover'
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

              {/* Existing Categories List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {emergencyCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-theme-border flex items-center justify-between gap-2 shadow-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{cat.emoji}</span>
                      <div className="truncate">
                        <p className="text-xs font-bold text-theme-text truncate">{cat.name}</p>
                        <span className="text-[10px] text-theme-muted font-mono">{cat.defaultDuration}m</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditCategory(cat)}
                        className="p-1 rounded hover:bg-theme-card-hover text-theme-muted hover:text-theme-text"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {!cat.isSystem && (
                        <button
                          type="button"
                          onClick={() => deleteEmergencyCategory(cat.id)}
                          className="p-1 rounded hover:bg-red-50 hover:text-red-600 text-theme-muted"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 1: Emergency Type Selection */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-theme-muted flex items-center justify-between">
              <span>1. Select Emergency Type</span>
              <span className="text-[11px] font-normal text-theme-muted lowercase">({emergencyCategories.length} presets available)</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {emergencyCategories.map((cat) => {
                const isSelected = selectedCatId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectPreset(cat)}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                      isSelected
                        ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-2 ring-red-400/40 font-bold shadow-sm'
                        : 'border-theme-border bg-theme-card hover:bg-theme-card-hover text-theme-text'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg bg-red-100 dark:bg-red-950/80 shrink-0 shadow-sm">
                      {cat.emoji}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{cat.name}</p>
                      <span className="text-[10px] text-theme-muted font-mono">{cat.defaultDuration}m</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Time & Duration */}
          <div className="p-4 rounded-2xl bg-theme-card-hover border border-theme-border space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              <div className="sm:col-span-3 space-y-1">
                <label className="text-[11px] font-bold text-theme-muted">Emergency Event Title</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-xs font-bold text-theme-text focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="e.g. Loadshedding / Sudden Sickness"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-theme-muted flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span>Date</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-xs font-bold text-theme-text focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-theme-muted flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Start Time</span>
                </label>
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-xs font-bold text-theme-text font-mono focus:outline-none"
                  placeholder="e.g. 02:30 PM"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-theme-muted flex items-center gap-1">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Calculated End Time</span>
                </label>
                <div className="w-full px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-xs font-black text-red-600 dark:text-red-400 font-mono">
                  {endTime} ({durationMinutes} mins)
                </div>
              </div>

            </div>

            {/* Quick Duration Pills & Custom Input */}
            <div className="space-y-2 pt-1 border-t border-theme-border/60">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-theme-muted">
                  Emergency Duration (Change Time: 60m / 120m / 1440m Full Day)
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-theme-muted">Custom mins:</span>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    step="5"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(5, parseInt(e.target.value) || 60))}
                    className="w-16 px-2 py-0.5 rounded-md bg-theme-card border border-theme-border text-xs font-mono font-bold text-theme-text text-center focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {DURATION_PRESETS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      durationMinutes === mins
                        ? 'bg-red-600 text-white shadow-sm shadow-red-500/30 ring-2 ring-red-500/50'
                        : 'bg-theme-card hover:bg-theme-border text-theme-muted hover:text-theme-text border border-theme-border'
                    }`}
                  >
                    {mins === 1440 ? (
                      <span>🚨 24h (Full Day)</span>
                    ) : mins >= 60 ? (
                      <span>{mins / 60}h ({mins}m)</span>
                    ) : (
                      <span>{mins}m</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Rest-of-the-Day Tasks & Delay / Move Menu */}
          <div className="p-4 rounded-2xl bg-theme-card-hover border-2 border-dashed border-red-300 dark:border-red-900/60 space-y-4">
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-theme-text flex items-center gap-1.5">
                  <Hourglass className="w-4 h-4 text-red-500" />
                  <span>Rest of the Day Tasks ({proposals.length} remaining)</span>
                </h4>
                <p className="text-[11px] text-theme-muted">
                  How should we reschedule your remaining day tasks? Select 1h/2h delay or move to next day:
                </p>
              </div>

              {/* 1-Click Rest-of-the-Day Batch Delay Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleBatchDelay(60)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                  title="Shift all remaining day tasks forward by +1 Hour"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>⏱️ +1 Hour Delay</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBatchDelay(120)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                  title="Shift all remaining day tasks forward by +2 Hours"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>⏱️ +2 Hours Delay</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchMoveAllToNextDay}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                  title="Move all remaining day tasks to tomorrow morning"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>📅 Move to Next Day</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchHoldAll}
                  className="px-2.5 py-1.5 rounded-xl bg-theme-card hover:bg-theme-border text-theme-muted hover:text-theme-text border border-theme-border text-xs font-semibold transition-all"
                  title="Put all remaining tasks on hold"
                >
                  <Pause className="w-3 h-3" />
                  <span>Hold All</span>
                </button>
              </div>
            </div>

            {/* Task Proposals List */}
            {proposals.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  No other tasks scheduled for the rest of today
                </p>
                <p className="text-[11px] text-theme-muted">
                  Your timeline after {startTime} is clear. The emergency buffer will be inserted cleanly.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {proposals.map((p) => {
                  const origTask = tasks.find(t => t.id === p.taskId);
                  const isMandatory = origTask?.isMandatorySchedule;

                  return (
                    <div
                      key={p.taskId}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 transition-colors shadow-sm ${
                        isMandatory
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                          : 'bg-theme-card border-theme-border hover:border-red-300'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
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

                        {/* Shift Preview */}
                        <div className="flex items-center gap-2 text-xs font-mono">
                          {isMandatory ? (
                            <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-amber-500" />
                              <span>Anchored in slot: {p.currentStartTime} - {p.currentEndTime} (Locked • Never Shifts)</span>
                            </span>
                          ) : p.action === 'keep' ? (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              ✓ Kept in original slot: {p.currentStartTime} - {p.currentEndTime}
                            </span>
                          ) : (
                            <>
                              <span className="line-through text-theme-muted opacity-75">
                                {p.currentStartTime} - {p.currentEndTime}
                              </span>
                              <ArrowRight className="w-3 h-3 text-red-500" />
                              <span className={`font-bold ${
                                p.action === 'defer_tomorrow' ? 'text-amber-600 dark:text-amber-400' :
                                p.action === 'hold' ? 'text-zinc-500' :
                                'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {p.action === 'hold' ? '⏸ Put on Hold' : `${p.proposedDate === date ? 'Today' : 'Tomorrow'} • ${p.proposedStartTime} - ${p.proposedEndTime}`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Individual Delay / Move Controls */}
                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto flex-wrap">
                        {isMandatory ? (
                          <span className="text-[10px] font-bold font-mono text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-600" />
                            <span>Locked Schedule</span>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleTaskAction(p.taskId, 'shift_same_day', 60)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                p.action === 'shift_same_day' && p.delayMinutes === 60
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                              }`}
                            >
                              +1h Delay
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleTaskAction(p.taskId, 'shift_same_day', 120)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                p.action === 'shift_same_day' && p.delayMinutes === 120
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                              }`}
                            >
                              +2h Delay
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleTaskAction(p.taskId, 'defer_tomorrow')}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                p.action === 'defer_tomorrow'
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                              }`}
                            >
                              Next Day
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleTaskAction(p.taskId, 'hold')}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                p.action === 'hold'
                                  ? 'bg-zinc-700 text-white shadow-sm'
                                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text'
                              }`}
                            >
                              Hold
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

        {/* Action Footer */}
        <div className="px-5 py-4 border-t border-theme-border flex items-center justify-between bg-theme-card-hover/40">
          <button
            type="button"
            onClick={closeEmergencyModal}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white text-xs font-black rounded-xl shadow-lg shadow-red-500/30 transition-all transform active:scale-95"
          >
            <ShieldAlert className="w-4 h-4 stroke-[2.5]" />
            <span>Activate Emergency Buffer & Reschedule Rest of Day</span>
          </button>
        </div>

      </div>
    </div>
  );
};
