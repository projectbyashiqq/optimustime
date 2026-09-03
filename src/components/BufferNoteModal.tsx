import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { BufferCategoryItem, BufferStatusNote, SignalNoiseType } from '../types';
import { detectSignalVsNoise } from '../utils/signalNoiseUtils';
import { 
  getBufferActivityEmoji, 
  diffTimeInMinutes,
  addMinutesToTime,
  toISODateString,
  getCurrentRoundedTime12Hour
} from '../utils/timeUtils';
import { 
  Sparkles, 
  Check, 
  X, 
  Trash2, 
  Calendar, 
  Edit2, 
  Plus, 
  RotateCcw,
  Settings2,
  Smile
} from 'lucide-react';
import { TimePicker } from './TimePicker';

const PRESET_EMOJIS = [
  '☕', '🚶', '🥪', '🧘', '📚', '💤', '✨', '🧹', '💬', '🎯', '🎮', '📝',
  '🎨', '🎵', '🏋️', '🌳', '🛠️', '📖', '💡', '💆', '🏊', '🚗', '🍎', '🥤',
  '🎬', '🎧', '🚲', '📞', '🪴', '🐕'
];

export const BufferNoteModal: React.FC = () => {
  const { 
    bufferNoteModalState, 
    closeBufferNoteModal, 
    bufferNotes,
    addBufferNote, 
    updateBufferNote, 
    deleteBufferNote,
    bufferCategories,
    addBufferCategory,
    updateBufferCategory,
    deleteBufferCategory,
    resetBufferCategories
  } = useApp();

  const { isOpen, initialData } = bufferNoteModalState;

  // Centralized resolution of existing note: by object, by id, by task+date, or by date+startTime
  const existingNote = useMemo(() => {
    if (!initialData) return undefined;
    if (initialData.existingNote) return initialData.existingNote;
    if (initialData.id) return bufferNotes.find(n => n.id === initialData.id);
    if (initialData.relatedTaskId && initialData.date) {
      const byTask = bufferNotes.find(n => n.relatedTaskId === initialData.relatedTaskId && n.date === initialData.date);
      if (byTask) return byTask;
    }
    if (initialData.date && initialData.startTime) {
      const byTime = bufferNotes.find(n => n.date === initialData.date && n.startTime === initialData.startTime);
      if (byTime) return byTime;
    }
    return undefined;
  }, [initialData, bufferNotes]);

  const isEditing = !!existingNote;

  const todayStr = toISODateString(new Date());

  const [date, setDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>('10:00 AM');
  const [endTime, setEndTime] = useState<string>('10:15 AM');
  const [activityTag, setActivityTag] = useState<string>('Break / Rest');
  const [notes, setNotes] = useState<string>('');
  const [energyLevel, setEnergyLevel] = useState<number>(4);
  const [signalNoise, setSignalNoise] = useState<SignalNoiseType>('signal');
  const [manualOverrideSN, setManualOverrideSN] = useState<boolean>(false);

  // Category Editor / Management Mode
  const [isManagingCategories, setIsManagingCategories] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<BufferCategoryItem | null>(null);
  const [newCatLabel, setNewCatLabel] = useState<string>('');
  const [newCatIcon, setNewCatIcon] = useState<string>('☕');
  const [newCatDesc, setNewCatDesc] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);

  // Auto-detection analysis
  const autoSN = detectSignalVsNoise({
    title: activityTag,
    notes,
    tag: activityTag,
    energyLevel
  });

  // Sync state whenever modal opens or initialData / existingNote changes
  useEffect(() => {
    if (isOpen) {
      setIsManagingCategories(false);
      setEditingCategory(null);
      if (existingNote) {
        setDate(existingNote.date);
        setStartTime(existingNote.startTime);
        setEndTime(existingNote.endTime);
        setActivityTag(existingNote.activityTag);
        setNotes(existingNote.notes || '');
        setEnergyLevel(existingNote.energyLevel ?? 4);
        if (existingNote.signalNoise) {
          setSignalNoise(existingNote.signalNoise);
          setManualOverrideSN(true);
        } else {
          const detected = detectSignalVsNoise({
            title: existingNote.activityTag,
            notes: existingNote.notes,
            tag: existingNote.activityTag,
            energyLevel: existingNote.energyLevel
          });
          setSignalNoise(detected.type);
          setManualOverrideSN(false);
        }
      } else {
        const d = initialData?.date || todayStr;
        const s = initialData?.startTime || getCurrentRoundedTime12Hour(15);
        const duration = initialData?.durationMinutes || 15;
        const e = initialData?.endTime || addMinutesToTime(s, duration);
        const initialTag = initialData?.activityTag || bufferCategories[0]?.label || 'Break / Rest';

        setDate(d);
        setStartTime(s);
        setEndTime(e);
        setActivityTag(initialTag);
        setNotes(initialData?.notes || '');
        setEnergyLevel(initialData?.energyLevel ?? 4);
        const detected = detectSignalVsNoise({
          title: initialTag,
          notes: initialData?.notes || '',
          tag: initialTag,
          energyLevel: initialData?.energyLevel ?? 4
        });
        setSignalNoise(detected.type);
        setManualOverrideSN(false);
      }
    }
  }, [isOpen, existingNote, initialData, todayStr, bufferCategories]);

  // Update auto-suggested signal/noise when notes or tag change if user hasn't locked a manual choice
  const handleTagSelect = (tag: string) => {
    setActivityTag(tag);
    if (!manualOverrideSN) {
      const detected = detectSignalVsNoise({
        title: tag,
        notes,
        tag,
        energyLevel
      });
      setSignalNoise(detected.type);
    }
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    if (!manualOverrideSN) {
      const detected = detectSignalVsNoise({
        title: activityTag,
        notes: val,
        tag: activityTag,
        energyLevel
      });
      setSignalNoise(detected.type);
    }
  };

  if (!isOpen) return null;

  const durationMinutes = Math.max(1, diffTimeInMinutes(startTime, endTime));

  const handleQuickDuration = (minutes: number) => {
    setEndTime(addMinutesToTime(startTime, minutes));
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && existingNote) {
      updateBufferNote({
        ...existingNote,
        date,
        startTime,
        endTime,
        durationMinutes,
        activityTag,
        notes: notes.trim(),
        energyLevel,
        signalNoise
      });
    } else {
      addBufferNote({
        date,
        startTime,
        endTime,
        durationMinutes,
        activityTag,
        notes: notes.trim(),
        energyLevel,
        signalNoise,
        relatedTaskId: initialData?.relatedTaskId,
        relatedTaskTitle: initialData?.relatedTaskTitle
      });
    }
    closeBufferNoteModal();
  };

  const handleDeleteNote = () => {
    if (existingNote) {
      deleteBufferNote(existingNote.id);
      closeBufferNoteModal();
    }
  };

  // Category Editor Handlers
  const handleStartEditCategory = (cat: BufferCategoryItem) => {
    setEditingCategory(cat);
    setNewCatLabel(cat.label);
    setNewCatIcon(cat.icon);
    setNewCatDesc(cat.desc);
    setShowEmojiPicker(false);
  };

  const handleCancelCategoryEdit = () => {
    setEditingCategory(null);
    setNewCatLabel('');
    setNewCatIcon('☕');
    setNewCatDesc('');
    setShowEmojiPicker(false);
  };

  const handleSaveCategory = () => {
    if (!newCatLabel.trim()) return;

    if (editingCategory) {
      updateBufferCategory({
        ...editingCategory,
        label: newCatLabel.trim(),
        tag: newCatLabel.trim(),
        icon: newCatIcon || '📝',
        desc: newCatDesc.trim() || 'Custom activity'
      });
      if (activityTag === editingCategory.label) {
        setActivityTag(newCatLabel.trim());
      }
    } else {
      addBufferCategory({
        label: newCatLabel.trim(),
        tag: newCatLabel.trim(),
        icon: newCatIcon || '📝',
        desc: newCatDesc.trim() || 'Custom activity'
      });
      setActivityTag(newCatLabel.trim());
    }

    handleCancelCategoryEdit();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-theme-card border border-theme-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-scale-up">
        
        {/* Header Ribbon */}
        <div className="px-5 py-4 border-b border-theme-border flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-blue-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/25 text-lg">
              {getBufferActivityEmoji(activityTag)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-theme-text font-display">
                  {isEditing ? 'Edit Buffer Status Note' : 'Buffer Status & Free-Time Note'}
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  24H Tracker
                </span>
              </div>
              <p className="text-xs text-theme-muted font-medium">
                Keep 100% of your 24 hours accounted for & on track.
              </p>
            </div>
          </div>

          <button
            onClick={closeBufferNoteModal}
            className="p-2 rounded-xl text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveNote} className="p-5 space-y-5 overflow-y-auto flex-1">
          
          {/* Main Question Highlight Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/80 via-sky-50/60 to-emerald-50/80 dark:from-amber-950/30 dark:via-sky-950/20 dark:to-emerald-950/30 border border-amber-200/80 dark:border-amber-900/40 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 font-display">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Free-Time Reflection Question</span>
            </div>
            <p className="text-sm font-bold text-theme-text leading-snug">
              "What did you do during this free time or buffer window?"
            </p>
            {initialData?.relatedTaskTitle && (
              <p className="text-xs text-theme-muted flex items-center gap-1.5 pt-1">
                <span className="font-semibold text-blue-600 dark:text-blue-400">Post-Task Buffer:</span>
                <span>{initialData.relatedTaskTitle}</span>
              </p>
            )}
          </div>

          {/* Time & Duration Controls */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center justify-between">
              <span>Time Window & Duration</span>
              <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800">
                {durationMinutes} minutes
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Date</label>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border">
                  <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs font-bold text-theme-text bg-transparent focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Start Time</label>
                <TimePicker
                  value={startTime}
                  onChange={(val) => setStartTime(val)}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">End Time</label>
                <TimePicker
                  value={endTime}
                  onChange={(val) => setEndTime(val)}
                />
              </div>
            </div>

            {/* Quick Duration Buttons */}
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <span className="text-[10px] font-semibold text-theme-muted">Quick Slot:</span>
              {[5, 10, 15, 20, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleQuickDuration(mins)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                    durationMinutes === mins
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-theme-card-hover hover:bg-theme-border text-theme-muted hover:text-theme-text border border-theme-border'
                  }`}
                >
                  +{mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Activity Category Section with Edit Mode Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <span>Activity Category</span>
                <span className="text-[10px] font-normal text-theme-muted">({bufferCategories.length} options)</span>
              </label>
              
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsManagingCategories(!isManagingCategories);
                    handleCancelCategoryEdit();
                  }}
                  className={`text-xs font-bold px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 shadow-sm ${
                    isManagingCategories
                      ? 'bg-amber-500 text-white'
                      : 'bg-theme-card-hover hover:bg-theme-border text-theme-muted hover:text-theme-text border border-theme-border'
                  }`}
                  title="Customize activity categories"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>{isManagingCategories ? 'Done Editing' : '✏️ Edit Menu'}</span>
                </button>
              </div>
            </div>

            {/* Category Management Drawer */}
            {isManagingCategories && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-slide-up">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-amber-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span>{editingCategory ? 'Edit Category' : 'Add New Buffer Activity'}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={resetBufferCategories}
                    className="text-[10px] font-bold text-theme-muted hover:text-red-500 flex items-center gap-1"
                    title="Restore default preset categories"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restore Defaults</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  
                  {/* Emoji Picker Box */}
                  <div className="sm:col-span-3 relative">
                    <label className="text-[10px] font-bold text-theme-muted block mb-1">Emoji Icon</label>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="w-full h-9 flex items-center justify-center text-xl bg-theme-card border border-theme-border rounded-xl hover:border-amber-400"
                    >
                      {newCatIcon || '☕'}
                    </button>

                    {showEmojiPicker && (
                      <div className="absolute z-20 top-12 left-0 w-56 p-2 bg-theme-card border border-theme-border rounded-2xl shadow-xl grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
                        {PRESET_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setNewCatIcon(emoji);
                              setShowEmojiPicker(false);
                            }}
                            className="p-1.5 rounded-lg hover:bg-theme-card-hover text-base transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Name Input */}
                  <div className="sm:col-span-4">
                    <label className="text-[10px] font-bold text-theme-muted block mb-1">Activity Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Yoga Stretch"
                      value={newCatLabel}
                      onChange={(e) => setNewCatLabel(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Description Input */}
                  <div className="sm:col-span-5">
                    <label className="text-[10px] font-bold text-theme-muted block mb-1">Short Description</label>
                    <input
                      type="text"
                      placeholder="e.g., Mindfulness & body reset"
                      value={newCatDesc}
                      onChange={(e) => setNewCatDesc(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={handleCancelCategoryEdit}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-theme-muted hover:text-theme-text"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveCategory}
                    disabled={!newCatLabel.trim()}
                    className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-black shadow-sm flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{editingCategory ? 'Update Category' : '+ Add Activity'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Category Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {bufferCategories.map((item) => {
                const isSelected = activityTag === item.label || activityTag === item.tag;
                return (
                  <div
                    key={item.id}
                    className={`group relative p-2.5 rounded-xl border text-left transition-all flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 shadow-sm ring-1 ring-amber-500'
                        : 'border-theme-border bg-theme-card hover:bg-theme-card-hover text-theme-text'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleTagSelect(item.label)}
                      className="min-w-0 flex-1 flex items-start gap-2 text-left"
                    >
                      <span className="text-lg shrink-0">{item.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{item.label}</div>
                        <div className="text-[10px] text-theme-muted truncate leading-tight">{item.desc}</div>
                      </div>
                    </button>

                    {/* Edit / Delete Buttons in Edit Mode or on Hover */}
                    {isManagingCategories && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditCategory(item)}
                          className="p-1 rounded hover:bg-theme-card text-theme-muted hover:text-amber-500 transition-colors"
                          title="Edit Category"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        {bufferCategories.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteBufferCategory(item.id)}
                            className="p-1 rounded hover:bg-red-50 text-theme-muted hover:text-red-500 transition-colors"
                            title="Delete Category"
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

          {/* Notes Text Area */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center justify-between">
              <span>What did you do? (Life Diary Log & Details)</span>
              <span className="text-[10px] text-theme-muted font-normal">Life Journal Entry</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="e.g., Brewed fresh coffee, walked outside for 15 mins, stretched, and reviewed next goals..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-theme-card-hover border border-theme-border text-xs sm:text-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all placeholder:text-theme-muted"
            />
          </div>

          {/* Intelligent Signal vs. Noise Categorization */}
          <div className="p-3.5 rounded-2xl bg-theme-card-hover/80 border border-theme-border space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-theme-text uppercase tracking-wider">
                  Signal vs. Noise Classification
                </span>
              </div>
              <span className="text-[10px] font-mono text-theme-muted px-2 py-0.5 rounded bg-theme-card border border-theme-border">
                {manualOverrideSN ? 'Locked Override' : 'AI Auto-Detected'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSignalNoise('signal');
                  setManualOverrideSN(true);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                  signalNoise === 'signal'
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-400'
                    : 'bg-theme-card border-theme-border text-theme-muted hover:text-theme-text'
                }`}
              >
                <span className="text-lg">🎯</span>
                <div className="min-w-0">
                  <div className="text-xs font-black">Signal (High Value)</div>
                  <div className={`text-[10px] truncate ${signalNoise === 'signal' ? 'text-emerald-100' : 'text-theme-muted'}`}>
                    Deep work, health, renewal
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSignalNoise('noise');
                  setManualOverrideSN(true);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                  signalNoise === 'noise'
                    ? 'bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/20 ring-2 ring-rose-400'
                    : 'bg-theme-card border-theme-border text-theme-muted hover:text-theme-text'
                }`}
              >
                <span className="text-lg">⚠️</span>
                <div className="min-w-0">
                  <div className="text-xs font-black">Noise (Distraction)</div>
                  <div className={`text-[10px] truncate ${signalNoise === 'noise' ? 'text-rose-100' : 'text-theme-muted'}`}>
                    Aimless feeds, idle leak
                  </div>
                </div>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] px-1 text-theme-muted pt-0.5">
              <span className="flex items-center gap-1 truncate">
                <span className="font-semibold text-theme-text">Detection:</span>
                <span className="truncate">{autoSN.reason}</span>
              </span>
              {manualOverrideSN && (
                <button
                  type="button"
                  onClick={() => {
                    setManualOverrideSN(false);
                    setSignalNoise(autoSN.type);
                  }}
                  className="text-[10px] text-blue-500 hover:underline font-bold shrink-0 ml-2"
                >
                  Reset Auto
                </button>
              )}
            </div>
          </div>

          {/* Energy & Focus Level Rating */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center justify-between">
              <span>Energy & Focus State After Buffer</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {energyLevel === 5 ? '⚡ Peak Energized' :
                 energyLevel === 4 ? '🔋 Refreshed & Ready' :
                 energyLevel === 3 ? '😐 Neutral Steady' :
                 energyLevel === 2 ? '🥱 Slightly Fatigued' : '😴 Low Energy'}
              </span>
            </label>

            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setEnergyLevel(lvl)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold text-center border transition-all flex flex-col items-center gap-0.5 ${
                    energyLevel === lvl
                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/20 ring-1 ring-emerald-400'
                      : 'bg-theme-card-hover hover:bg-theme-border border-theme-border text-theme-muted hover:text-theme-text'
                  }`}
                >
                  <span className="text-sm">
                    {lvl === 5 ? '⚡' : lvl === 4 ? '🔋' : lvl === 3 ? '☕' : lvl === 2 ? '🥱' : '💤'}
                  </span>
                  <span>Lvl {lvl}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-theme-border flex items-center justify-between gap-3">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDeleteNote}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs font-bold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeBufferNoteModal}
                className="px-4 py-2 rounded-xl border border-theme-border text-xs font-semibold text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-emerald-500 to-blue-600 hover:from-amber-600 hover:to-blue-700 text-white text-xs font-black shadow-lg shadow-amber-500/20 transition-all transform active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{isEditing ? 'Update Buffer Note' : 'Log to 24H Tracker'}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
