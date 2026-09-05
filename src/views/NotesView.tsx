import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task, PriorityLevel, RecurrenceType, SubTask, TaskLink } from '../types';
import { 
  playNotificationChime, 
  toISODateString, 
  getDayOfWeekFromDate, 
  generateProjectCode,
  isDateTimeBeforeNow,
  shouldRolloverToNextDay,
  formatDisplayDate,
  isNoteCategory,
  isReminderCategory
} from '../utils/timeUtils';
import { 
  StickyNote, 
  Plus, 
  CheckCircle2, 
  Trash2, 
  Calendar, 
  Sparkles, 
  Flame, 
  Clock, 
  Tag, 
  Check, 
  Edit2, 
  ArrowRight, 
  Search,
  Filter,
  FileText,
  AlertTriangle,
  Folder,
  X,
  Repeat,
  Link as LinkIcon,
  CheckSquare,
  Square,
  ExternalLink,
  Layers
} from 'lucide-react';

interface NotesViewProps {
  onOpenTaskModal?: (task?: Task) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({ onOpenTaskModal }) => {
  const { 
    tasks, 
    addTask, 
    updateTask, 
    deleteTask, 
    searchQuery,
    categories,
    prioritySettings 
  } = useApp();

  // New / Edit Note Form State
  const [title, setTitle] = useState('');
  const [notesBody, setNotesBody] = useState('');
  const [date, setDate] = useState(toISODateString(new Date()));
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('P5'); // Default is Auto P5
  const [category, setCategory] = useState('Notes');
  const [subCategory, setSubCategory] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('None');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Filters
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'P1' | 'P5' | 'P2_P4' | 'RECURRING'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'COMPLETED' | 'ALL'>('ACTIVE');

  // Category change handler with smart priority & recurrence defaults
  const handleCategorySelect = (newCat: string) => {
    setCategory(newCat);
    setFormError(null);
    if (isReminderCategory(newCat)) {
      // Reminders default to P1 and mandatorily recurring with Yearly by default
      setPriority('P1');
      if (recurrence === 'None') {
        setRecurrence('Yearly');
      }
    } else if (isNoteCategory(newCat)) {
      // Notes are by default P5 and no other mandatory
      setPriority('P5');
    }
  };

  // Notes & Reminders are Tasks with category Note/Notes or Reminder/Reminders or appointedMinutes === 0 or isAllDay
  const noteTasks = tasks.filter(t => {
    const isNote = isNoteCategory(t.category) || isReminderCategory(t.category) || t.appointedMinutes === 0 || t.isAllDay;
    if (!isNote) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = (t.description || t.notes || '').toLowerCase().includes(q);
      const matchCode = t.projectCode?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCode) return false;
    }
    return true;
  });

  const activeNotes = noteTasks.filter(t => t.status !== 'Done' && t.status !== 'Terminated');
  const completedNotes = noteTasks.filter(t => t.status === 'Done');

  const filteredByStatus = statusFilter === 'ACTIVE' 
    ? activeNotes 
    : statusFilter === 'COMPLETED' 
      ? completedNotes 
      : noteTasks;

  const displayedNotes = filteredByStatus.filter(t => {
    if (priorityFilter === 'P1') return t.priority === 'P1';
    if (priorityFilter === 'P5') return t.priority === 'P5';
    if (priorityFilter === 'P2_P4') return t.priority === 'P2' || t.priority === 'P3' || t.priority === 'P4';
    if (priorityFilter === 'RECURRING') return t.recurrence && t.recurrence !== 'None';
    return true;
  });

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
    if (formError) setFormError(null);
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSub: SubTask = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: newSubtaskTitle.trim(),
      isCompleted: false,
      depthLevel: 1,
      assignedTimeMin: 0,
      subtasks: []
    };
    setSubtasks([...subtasks, newSub]);
    setNewSubtaskTitle('');
  };

  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return;
    const newL: TaskLink = {
      id: `link_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: newLinkTitle.trim() || newLinkUrl.trim(),
      url: newLinkUrl.trim().startsWith('http') ? newLinkUrl.trim() : `https://${newLinkUrl.trim()}`,
      type: 'url'
    };
    setLinks([...links, newL]);
    setNewLinkTitle('');
    setNewLinkUrl('');
  };

  const handleSaveNote = () => {
    if (!title.trim()) {
      setFormError('Note Title is required.');
      playNotificationChime('alert');
      return;
    }

    // Reminders require mandatory recurrence
    if (category === 'Reminder') {
      if (recurrence === 'None') {
        setFormError('Reminders require a recurrence schedule (Yearly, Daily, Custom Days, Weekly, or Monthly).');
        playNotificationChime('alert');
        return;
      }
      if (recurrence === 'Selected Days' && selectedDays.length === 0) {
        setFormError('Please select at least one day for Custom Days recurring reminder.');
        playNotificationChime('alert');
        return;
      }
    }

    setFormError(null);

    // Past time warning for point-in-time reminders
    if (time) {
      const pastInfo = isDateTimeBeforeNow(date, time);
      if (pastInfo.isPast) {
        const proceed = window.confirm(
          `⚠️ Past Time Warning:\nThe scheduled time "${time}" on ${date} is before the current time (${pastInfo.currentTimeStr}).\n\nDo you want to log it as a past entry anyway?`
        );
        if (!proceed) return;
      }
    }

    if (editingNoteId) {
      const existing = tasks.find(t => t.id === editingNoteId);
      if (existing) {
        updateTask({
          ...existing,
          title: title.trim(),
          description: notesBody.trim(),
          notes: notesBody.trim(),
          taskDate: date,
          dayOfWeek: getDayOfWeekFromDate(date),
          priority,
          category: category || 'Notes',
          subCategory: subCategory || undefined,
          startTime: time || 'All Day',
          endTime: time || 'All Day',
          recurrence,
          selectedDays: recurrence === 'Selected Days' ? selectedDays : [],
          subtasks,
          links
        });
      }
      setEditingNoteId(null);
    } else {
      addTask({
        projectCode: generateProjectCode(),
        title: title.trim(),
        description: notesBody.trim(),
        notes: notesBody.trim(),
        taskDate: date,
        dayOfWeek: getDayOfWeekFromDate(date),
        priority, // Auto P5 for Notes or customized/P1 for Reminders
        category: category || 'Notes',
        subCategory: subCategory || undefined,
        appointedMinutes: 0,
        startTime: time || 'All Day',
        endTime: time || 'All Day',
        isAllDay: !time,
        status: 'Pending',
        bufferMinutes: 0,
        recurrence,
        selectedDays: recurrence === 'Selected Days' ? selectedDays : [],
        links,
        subtasks
      });
    }

    playNotificationChime(priority === 'P1' ? 'alert' : 'success');
    resetForm();
    setShowAddForm(false);
  };

  const resetForm = () => {
    setTitle('');
    setNotesBody('');
    setTime('');
    setPriority('P5');
    setCategory('Notes');
    setSubCategory('');
    setRecurrence('None');
    setSelectedDays([]);
    setSubtasks([]);
    setLinks([]);
    setEditingNoteId(null);
    setFormError(null);
  };

  const handleStartEdit = (task: Task) => {
    setEditingNoteId(task.id);
    setTitle(task.title);
    setNotesBody(task.description || task.notes || '');
    setDate(task.taskDate);
    setTime(task.startTime !== 'All Day' ? task.startTime : '');
    setPriority(task.priority || 'P5');
    setCategory(task.category || 'Notes');
    setSubCategory(task.subCategory || '');
    setRecurrence(task.recurrence || 'None');
    setSelectedDays(task.selectedDays || []);
    setSubtasks(task.subtasks || []);
    setLinks(task.links || []);
    setFormError(null);
    setShowAddForm(true);
  };

  const handleToggleP1P5 = (task: Task) => {
    const newPriority: PriorityLevel = task.priority === 'P1' ? 'P5' : 'P1';
    updateTask({
      ...task,
      priority: newPriority
    });
    playNotificationChime(newPriority === 'P1' ? 'alert' : 'timer');
  };

  const handleToggleSubtask = (task: Task, subtaskId: string) => {
    const updatedSubs = (task.subtasks || []).map(s => 
      s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
    );
    updateTask({
      ...task,
      subtasks: updatedSubs
    });
  };

  const p1Count = activeNotes.filter(n => n.priority === 'P1').length;
  const recurringCount = activeNotes.filter(n => n.recurrence && n.recurrence !== 'None').length;

  const categoryOptions = Array.from(new Set(['Notes', 'Reminder', ...categories.map(c => c.name)]));

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-theme-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <StickyNote className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-theme-text tracking-tight font-display">
                Notes & Reminders Hub
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                Notes: Auto P5
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 font-mono">
                Reminders: P1 & Recurring
              </span>
              {p1Count > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 animate-pulse flex items-center gap-1">
                  <Flame className="w-3 h-3 text-red-500 fill-red-500" />
                  {p1Count} Urgent P1
                </span>
              )}
              {recurringCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 flex items-center gap-1">
                  <Repeat className="w-3 h-3 text-indigo-500" />
                  {recurringCount} Recurring
                </span>
              )}
            </div>
            <p className="text-xs text-theme-muted mt-0.5">
              Full-featured Notes & Reminders with custom recurrence rules, checklists, links, and 1-click P1/P5 priority toggle.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowAddForm(!showAddForm);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/20 transition-all transform active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>{showAddForm ? 'Close Form' : '+ New Note / Reminder'}</span>
        </button>
      </div>

      {/* Quick Add / Edit Note Form */}
      {showAddForm && (
        <div className="glass-panel p-5 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 space-y-4 animate-slide-up shadow-md">
          <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-900/60 pb-3">
            <h3 className="text-sm font-bold text-theme-text flex items-center gap-2 font-display">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>
                {editingNoteId 
                  ? 'Edit Note / Reminder' 
                  : category === 'Reminder' 
                    ? 'Create Recurring Reminder' 
                    : 'Create Note / Reminder'}
              </span>
            </h3>
            <button
              onClick={() => {
                resetForm();
                setShowAddForm(false);
              }}
              className="text-theme-muted hover:text-theme-text p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Validation Warning */}
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider">
                {category === 'Reminder' ? 'Reminder Title' : 'Note Title'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder={category === 'Reminder' ? 'e.g. Daily Standup Reminder, Weekly Review...' : 'e.g. Daily Standup Notes, Brainstorming ideas...'}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="w-full px-3.5 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
            </div>

            {/* Note Content / Body */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider">
                {category === 'Reminder' ? 'Reminder Details & Context' : 'Note Details & Context (Markdown Supported)'}
              </label>
              <textarea
                rows={3}
                placeholder="Write thoughts, reference items, instructions, or agenda..."
                value={notesBody}
                onChange={(e) => setNotesBody(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text text-xs placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Priority Selector (P5 default for notes vs P1 default for reminders) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center justify-between">
                <span>Priority Level</span>
                <span className="text-[10px] text-theme-muted font-mono font-bold">
                  {priority === 'P5' 
                    ? '★ Auto P5 (Notes Default)' 
                    : priority === 'P1' 
                      ? '🔥 P1 (Reminders Default - Urgent)' 
                      : `${priority}`}
                </span>
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['P5', 'P1', 'P2', 'P3', 'P4'] as PriorityLevel[]).map((p) => {
                  const meta = prioritySettings[p];
                  const isSelected = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-1.5 px-1 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-amber-500 shadow-sm font-black'
                          : 'bg-theme-card opacity-70 hover:opacity-100 border-theme-border'
                      }`}
                      style={{
                        backgroundColor: isSelected ? meta.bgColor : undefined,
                        color: isSelected ? meta.color : undefined,
                        borderColor: isSelected ? meta.color : undefined
                      }}
                    >
                      <div>{p}</div>
                      <div className="text-[9px] truncate">{p === 'P5' ? 'Auto' : p === 'P1' ? 'Urgent' : meta.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center justify-between">
                <span>Category</span>
                <span className="text-[10px] font-semibold text-theme-muted">
                  {category === 'Reminder' ? '⚡ P1 & Recurring Enabled' : '📝 Auto P5 General'}
                </span>
              </label>
              <div className="flex flex-wrap gap-1">
                {categoryOptions.map((cName) => {
                  const isCatSelected = category === cName;
                  return (
                    <button
                      key={cName}
                      type="button"
                      onClick={() => handleCategorySelect(cName)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 cursor-pointer ${
                        isCatSelected
                          ? cName === 'Reminder'
                            ? 'bg-red-600 text-white border-red-600 shadow-xs'
                            : 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-theme-card text-theme-muted hover:text-theme-text border-theme-border'
                      }`}
                    >
                      <Tag className="w-2.5 h-2.5" />
                      <span>{cName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date & Alert Time */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-500" />
                  <span>Date</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-text text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span>Alert Time (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10:00 AM (or empty for all-day)"
                  value={time}
                  onChange={(e) => {
                    const newT = e.target.value;
                    setTime(newT);
                    if (newT.trim().match(/^(\d{1,2})(?:[:.](\d{1,2}))?(?:[:.]\d{1,2})?\s*:?\s*(AM|PM)$/i)) {
                      const rollover = shouldRolloverToNextDay(date, newT.trim(), undefined, tasks);
                      if (rollover.shouldRollover && date !== rollover.nextDateStr) {
                        setDate(rollover.nextDateStr);
                      }
                    }
                  }}
                  className="w-full px-3 py-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-text text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* 🔁 Recurrence Rule Engine */}
            <div className={`space-y-2 p-3 rounded-xl border transition-all ${
              category === 'Reminder'
                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 ring-1 ring-indigo-500/30'
                : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/60'
            }`}>
              <label className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center justify-between uppercase tracking-wider font-display">
                <span className="flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Recurrence Schedule</span>
                  {category === 'Reminder' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800">
                      * Mandatory for Reminders
                    </span>
                  )}
                </span>
                <span className="font-mono text-[10px] text-indigo-700 dark:text-indigo-300 font-bold">
                  {recurrence !== 'None' ? `Repeating: ${recurrence}` : category === 'Reminder' ? '⚠️ Recurrence Required' : 'One-time'}
                </span>
              </label>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                {(['None', 'Yearly', 'Daily', 'Selected Days', 'Weekly', 'Monthly'] as RecurrenceType[]).map((rType) => (
                  <button
                    key={rType}
                    type="button"
                    onClick={() => {
                      setRecurrence(rType);
                      if (formError) setFormError(null);
                    }}
                    className={`py-1 px-1 rounded-lg text-xs font-bold transition-all border text-center cursor-pointer ${
                      recurrence === rType
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : rType === 'None' && category === 'Reminder'
                          ? 'bg-theme-card text-red-500/70 hover:text-red-600 border-dashed border-red-300 dark:border-red-900/50'
                          : 'bg-theme-card text-theme-muted hover:text-theme-text border-theme-border'
                    }`}
                  >
                    {rType === 'Selected Days' ? 'Custom Days' : rType}
                  </button>
                ))}
              </div>

              {/* Selected Days checkboxes if Custom Days */}
              {recurrence === 'Selected Days' && (
                <div className="pt-2 border-t border-indigo-200 dark:border-indigo-900/40">
                  <div className="flex items-center gap-1 flex-wrap">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                      const isSelected = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-theme-card text-theme-muted border-theme-border hover:border-indigo-400'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Checklist / Subtasks Tray */}
            <div className="space-y-2 p-3 rounded-xl bg-theme-card-hover border border-theme-border">
              <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Checklist & Action Items ({subtasks.length})</span>
                </span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Add item to note checklist..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-theme-card border border-theme-border text-xs text-theme-text focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  className="px-3 py-1.5 bg-theme-card border border-theme-border hover:border-amber-400 text-theme-text text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  + Add
                </button>
              </div>

              {subtasks.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto pt-1">
                  {subtasks.map((st, sIdx) => (
                    <div key={st.id} className="flex items-center justify-between gap-2 p-1.5 rounded bg-theme-card text-xs border border-theme-border">
                      <span className="font-medium text-theme-text truncate">{st.title}</span>
                      <button
                        type="button"
                        onClick={() => setSubtasks(subtasks.filter((_, idx) => idx !== sIdx))}
                        className="text-theme-muted hover:text-red-500 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reference Links Tray */}
            <div className="space-y-2 p-3 rounded-xl bg-theme-card-hover border border-theme-border">
              <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
                  <span>Reference Links ({links.length})</span>
                </span>
              </label>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Label"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  className="w-1/3 px-2.5 py-1.5 rounded-lg bg-theme-card border border-theme-border text-xs text-theme-text focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <input
                  type="text"
                  placeholder="URL (e.g. https://...)"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-theme-card border border-theme-border text-xs text-theme-text focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="px-2.5 py-1.5 bg-theme-card border border-theme-border hover:border-amber-400 text-theme-text text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>

              {links.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto pt-1">
                  {links.map((lk, lIdx) => (
                    <div key={lk.id} className="flex items-center justify-between gap-2 p-1.5 rounded bg-theme-card text-xs border border-theme-border">
                      <span className="font-medium text-blue-600 dark:text-blue-400 truncate">{lk.title}</span>
                      <button
                        type="button"
                        onClick={() => setLinks(links.filter((_, idx) => idx !== lIdx))}
                        className="text-theme-muted hover:text-red-500 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200 dark:border-amber-900/60">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddForm(false);
              }}
              className="px-4 py-2 rounded-xl border border-theme-border bg-theme-card hover:bg-theme-card-hover text-xs font-bold text-theme-text transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={!title.trim()}
              className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md transition-all transform active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                category === 'Reminder'
                  ? 'bg-red-600 hover:bg-red-700 disabled:opacity-50'
                  : 'bg-amber-500 hover:bg-amber-600 disabled:opacity-50'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>
                {editingNoteId 
                  ? 'Update Note / Reminder' 
                  : category === 'Reminder' 
                    ? 'Save Recurring Reminder' 
                    : 'Save Recurrable Note'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs & Counts */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-theme-border pb-3">
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { id: 'ALL', label: `All Notes (${noteTasks.length})` },
            { id: 'P1', label: `🔥 P1 Must-Do (${noteTasks.filter(n => n.priority === 'P1').length})` },
            { id: 'RECURRING', label: `🔁 Recurring (${noteTasks.filter(n => n.recurrence && n.recurrence !== 'None').length})` },
            { id: 'P5', label: `📝 Auto P5 (${noteTasks.filter(n => n.priority === 'P5').length})` },
            { id: 'P2_P4', label: `P2 - P4 (${noteTasks.filter(n => n.priority === 'P2' || n.priority === 'P3' || n.priority === 'P4').length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPriorityFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                priorityFilter === tab.id
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text border border-theme-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {[
            { id: 'ACTIVE', label: `Active (${activeNotes.length})` },
            { id: 'COMPLETED', label: `Done (${completedNotes.length})` },
            { id: 'ALL', label: 'All' }
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-theme-card text-theme-muted hover:text-theme-text border border-theme-border'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes Grid */}
      {displayedNotes.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-dashed border-theme-border space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-theme-card flex items-center justify-center mx-auto text-theme-muted">
            <StickyNote className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-theme-text">No Notes or Reminders Found</h3>
          <p className="text-xs text-theme-muted max-w-sm mx-auto">
            Capture thoughts, recurring reminder notes, and checklists. Auto P5 by default, or set to P1.
          </p>
          <button
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            + Create First Note / Reminder
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedNotes.map((note) => {
            const isDone = note.status === 'Done';
            const isP1 = note.priority === 'P1';
            const isRecurring = note.recurrence && note.recurrence !== 'None';
            const pMeta = prioritySettings[note.priority || 'P5'];
            const completedSubs = (note.subtasks || []).filter(s => s.isCompleted).length;
            const totalSubs = (note.subtasks || []).length;

            return (
              <div
                key={note.id}
                className={`glass-panel p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 shadow-sm hover:shadow-md ${
                  isDone
                    ? 'opacity-60 bg-theme-card border-theme-border'
                    : isP1
                    ? 'border-red-400 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20 ring-1 ring-red-400/30'
                    : isRecurring
                    ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/20 dark:bg-indigo-950/10'
                    : 'border-theme-border hover:border-amber-400/60'
                }`}
              >
                {/* Note Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Priority Tag (Click to toggle P1 / P5) */}
                      <button
                        type="button"
                        onClick={() => handleToggleP1P5(note)}
                        title={`Click to switch between P1 and P5 (Currently ${note.priority})`}
                        className="px-2 py-0.5 rounded font-black text-[10px] shadow-2xs transition-transform active:scale-95 cursor-pointer flex items-center gap-1"
                        style={{ backgroundColor: pMeta?.bgColor || '#f1f5f9', color: pMeta?.color || '#475569' }}
                      >
                        {isP1 && <Flame className="w-2.5 h-2.5 fill-red-500" />}
                        <span>{note.priority || 'P5'}</span>
                        <span className="text-[8px] font-normal opacity-75">
                          {isP1 ? 'Urgent' : 'Auto'}
                        </span>
                      </button>

                      {/* Recurrence Badge */}
                      {isRecurring && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 flex items-center gap-1 font-mono">
                          <Repeat className="w-2.5 h-2.5" />
                          <span>{note.recurrence === 'Selected Days' ? (note.selectedDays || []).join(',') : note.recurrence}</span>
                        </span>
                      )}

                      {/* Category Tag */}
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-theme-card border border-theme-border text-theme-muted font-mono">
                        {note.category || 'Notes'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Edit Button */}
                      <button
                        onClick={() => handleStartEdit(note)}
                        className="p-1 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors cursor-pointer"
                        title="Edit Note"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => {
                          if (confirm(`Delete note "${note.title}"?`)) {
                            deleteTask(note.id);
                          }
                        }}
                        className="p-1 rounded-lg text-theme-muted hover:text-red-500 hover:bg-theme-card-hover transition-colors cursor-pointer"
                        title="Delete Note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h4 className={`text-sm font-bold text-theme-text leading-snug font-display ${isDone ? 'line-through text-theme-muted' : ''}`}>
                    {note.title}
                  </h4>

                  {/* Note Body Details */}
                  {(note.description || note.notes) && (
                    <p className="text-xs text-theme-muted whitespace-pre-wrap line-clamp-4 leading-relaxed font-sans bg-theme-card/60 p-2.5 rounded-xl border border-theme-border/50">
                      {note.description || note.notes}
                    </p>
                  )}

                  {/* Checklist Subtasks */}
                  {totalSubs > 0 && (
                    <div className="space-y-1 p-2 rounded-xl bg-theme-card/70 border border-theme-border/60">
                      <div className="flex items-center justify-between text-[10px] font-bold text-theme-muted pb-1 border-b border-theme-border/40">
                        <span className="flex items-center gap-1">
                          <CheckSquare className="w-3 h-3 text-emerald-500" />
                          <span>Checklist</span>
                        </span>
                        <span>{completedSubs}/{totalSubs} completed</span>
                      </div>
                      <div className="space-y-1 pt-1 max-h-24 overflow-y-auto">
                        {note.subtasks?.map((st) => (
                          <div
                            key={st.id}
                            onClick={() => handleToggleSubtask(note, st.id)}
                            className="flex items-center gap-1.5 text-xs text-theme-text cursor-pointer hover:text-blue-500 transition-colors"
                          >
                            {st.isCompleted ? (
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-theme-muted shrink-0" />
                            )}
                            <span className={`text-[11px] truncate ${st.isCompleted ? 'line-through text-theme-muted' : ''}`}>
                              {st.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reference Links Chips */}
                  {note.links && note.links.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {note.links.map((lk) => (
                        <a
                          key={lk.id}
                          href={lk.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold hover:underline"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[120px]">{lk.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Meta & Actions */}
                <div className="pt-2 border-t border-theme-border/60 flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2 font-mono text-[11px] text-theme-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-blue-500" />
                      <span>{formatDisplayDate(note.taskDate)}</span>
                    </span>
                    {note.startTime && note.startTime !== 'All Day' && (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                        <Clock className="w-3 h-3" />
                        <span>{note.startTime}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Convert to Scheduled Time-Box Task */}
                    {onOpenTaskModal && !isDone && (
                      <button
                        onClick={() => onOpenTaskModal(note)}
                        className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Schedule this note into a fixed time slot"
                      >
                        <Clock className="w-3 h-3" />
                        <span>Schedule Task</span>
                      </button>
                    )}

                    {/* Complete / Toggle Done */}
                    <button
                      onClick={() => {
                        updateTask({
                          ...note,
                          status: isDone ? 'Pending' : 'Done'
                        });
                        playNotificationChime(isDone ? 'timer' : 'success');
                      }}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        isDone
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-theme-card hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-theme-muted hover:text-emerald-600 border-theme-border'
                      }`}
                      title={isDone ? 'Mark as Active' : 'Mark as Done'}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
