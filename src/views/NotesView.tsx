import React, { useState, useMemo } from 'react';
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
  FileText, 
  AlertTriangle, 
  Folder, 
  X, 
  Repeat, 
  Link as LinkIcon, 
  CheckSquare, 
  Square, 
  ExternalLink, 
  Layers, 
  Bell, 
  Heart, 
  Gift, 
  Trophy, 
  Film, 
  PartyPopper, 
  SlidersHorizontal,
  ChevronRight,
  Info
} from 'lucide-react';

interface NotesViewProps {
  onOpenTaskModal?: (task?: Task) => void;
}

export type NotesTabMode = 'split' | 'notes' | 'reminders';
export type ReminderEventType = 'anniversary' | 'birthday' | 'holiday' | 'event' | 'routine';

// Calculate days remaining until next anniversary or date
function getDaysUntilDate(dateStr: string, isYearly: boolean = false): { text: string; isToday: boolean; isSoon: boolean; days: number } {
  if (!dateStr) return { text: '', isToday: false, isSoon: false, days: 999 };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const [y, m, d] = dateStr.split('-').map(Number);
  let target = new Date(y, (m || 1) - 1, d || 1);

  if (isYearly) {
    target = new Date(today.getFullYear(), (m || 1) - 1, d || 1);
    if (target < today) {
      target = new Date(today.getFullYear() + 1, (m || 1) - 1, d || 1);
    }
  }

  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { text: 'Today! 🎉', isToday: true, isSoon: true, days: 0 };
  if (diffDays === 1) return { text: 'Tomorrow ✨', isToday: false, isSoon: true, days: 1 };
  if (diffDays > 1 && diffDays <= 7) return { text: `In ${diffDays} days 🔥`, isToday: false, isSoon: true, days: diffDays };
  if (diffDays > 7 && diffDays <= 30) return { text: `In ${diffDays} days`, isToday: false, isSoon: false, days: diffDays };
  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d ago`, isToday: false, isSoon: false, days: diffDays };
  
  const months = Math.floor(diffDays / 30);
  return { text: `In ~${months} mo (${diffDays}d)`, isToday: false, isSoon: false, days: diffDays };
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

  // Tab mode: 'split' (Side-by-Side Note | Reminder) | 'notes' | 'reminders'
  const [tabMode, setTabMode] = useState<NotesTabMode>('split');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'COMPLETED' | 'ALL'>('ACTIVE');
  const [localSearch, setLocalSearch] = useState('');

  // Form State
  const [showFormModal, setShowFormModal] = useState(false);
  const [formType, setFormType] = useState<'note' | 'reminder'>('note');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [notesBody, setNotesBody] = useState('');
  const [date, setDate] = useState(toISODateString(new Date()));
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('P5');
  const [category, setCategory] = useState('Notes');
  const [subCategory, setSubCategory] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('None');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Active query
  const effectiveQuery = (searchQuery || localSearch).trim().toLowerCase();

  // Separate all tasks into Notes and Reminders
  const allNotes = useMemo(() => {
    return tasks.filter(t => isNoteCategory(t.category));
  }, [tasks]);

  const allReminders = useMemo(() => {
    return tasks.filter(t => isReminderCategory(t.category));
  }, [tasks]);

  // Filter Notes by search and status
  const filteredNotes = useMemo(() => {
    return allNotes.filter(t => {
      if (statusFilter === 'ACTIVE' && (t.status === 'Done' || t.status === 'Terminated')) return false;
      if (statusFilter === 'COMPLETED' && t.status !== 'Done') return false;
      if (effectiveQuery) {
        const matchTitle = t.title.toLowerCase().includes(effectiveQuery);
        const matchDesc = (t.description || t.notes || '').toLowerCase().includes(effectiveQuery);
        const matchTag = (t.subCategory || '').toLowerCase().includes(effectiveQuery);
        if (!matchTitle && !matchDesc && !matchTag) return false;
      }
      return true;
    });
  }, [allNotes, statusFilter, effectiveQuery]);

  // Filter Reminders by search and status
  const filteredReminders = useMemo(() => {
    return allReminders.filter(t => {
      if (statusFilter === 'ACTIVE' && (t.status === 'Done' || t.status === 'Terminated')) return false;
      if (statusFilter === 'COMPLETED' && t.status !== 'Done') return false;
      if (effectiveQuery) {
        const matchTitle = t.title.toLowerCase().includes(effectiveQuery);
        const matchDesc = (t.description || t.notes || '').toLowerCase().includes(effectiveQuery);
        const matchTag = (t.subCategory || '').toLowerCase().includes(effectiveQuery);
        if (!matchTitle && !matchDesc && !matchTag) return false;
      }
      return true;
    });
  }, [allReminders, statusFilter, effectiveQuery]);

  const openCreateNote = () => {
    setEditingId(null);
    setFormType('note');
    setTitle('');
    setNotesBody('');
    setDate(toISODateString(new Date()));
    setTime('');
    setPriority('P5'); // Notes default to P5 Informational
    setCategory('Notes');
    setSubCategory('General');
    setRecurrence('None');
    setSelectedDays([]);
    setSubtasks([]);
    setLinks([]);
    setFormError(null);
    setShowFormModal(true);
  };

  const openCreateReminder = (preset?: 'anniversary' | 'birthday') => {
    setEditingId(null);
    setFormType('reminder');
    setTitle(preset === 'anniversary' ? 'Wedding Anniversary 💍' : preset === 'birthday' ? "Wife's Birthday 🎂" : '');
    setNotesBody('');
    setDate(toISODateString(new Date()));
    setTime('');
    setPriority('P1'); // Reminders default to P1 Urgent / Special
    setCategory('Reminder');
    setSubCategory(preset === 'anniversary' ? 'Anniversary' : preset === 'birthday' ? 'Birthday' : 'Special Event');
    setRecurrence('Yearly'); // Default to yearly repeating for special events
    setSelectedDays([]);
    setSubtasks([]);
    setLinks([]);
    setFormError(null);
    setShowFormModal(true);
  };

  const openEdit = (task: Task) => {
    const isRem = isReminderCategory(task.category);
    setEditingId(task.id);
    setFormType(isRem ? 'reminder' : 'note');
    setTitle(task.title);
    setNotesBody(task.description || task.notes || '');
    setDate(task.taskDate);
    setTime(task.startTime !== 'All Day' ? task.startTime : '');
    setPriority(task.priority || (isRem ? 'P1' : 'P5'));
    setCategory(task.category || (isRem ? 'Reminder' : 'Notes'));
    setSubCategory(task.subCategory || '');
    setRecurrence(task.recurrence || (isRem ? 'Yearly' : 'None'));
    setSelectedDays(task.selectedDays || []);
    setSubtasks(task.subtasks || []);
    setLinks(task.links || []);
    setFormError(null);
    setShowFormModal(true);
  };

  const handleSave = () => {
    if (!title.trim()) {
      setFormError('Title is required.');
      playNotificationChime('alert');
      return;
    }

    if (recurrence === 'Selected Days' && selectedDays.length === 0) {
      setFormError('Please select at least one day for custom recurring days.');
      playNotificationChime('alert');
      return;
    }

    setFormError(null);

    const chosenCategory = formType === 'reminder' ? 'Reminder' : 'Notes';
    const chosenPriority = priority || (formType === 'reminder' ? 'P1' : 'P5');

    if (editingId) {
      const existing = tasks.find(t => t.id === editingId);
      if (existing) {
        updateTask({
          ...existing,
          title: title.trim(),
          description: notesBody.trim(),
          notes: notesBody.trim(),
          taskDate: date,
          dayOfWeek: getDayOfWeekFromDate(date),
          priority: chosenPriority,
          category: chosenCategory,
          subCategory: subCategory || (formType === 'reminder' ? 'Special Event' : 'General'),
          startTime: time || 'All Day',
          endTime: time || 'All Day',
          recurrence,
          selectedDays: recurrence === 'Selected Days' ? selectedDays : [],
          subtasks,
          links
        });
      }
    } else {
      addTask({
        projectCode: generateProjectCode(),
        title: title.trim(),
        description: notesBody.trim(),
        notes: notesBody.trim(),
        taskDate: date,
        dayOfWeek: getDayOfWeekFromDate(date),
        priority: chosenPriority,
        category: chosenCategory,
        subCategory: subCategory || (formType === 'reminder' ? 'Special Event' : 'General'),
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

    playNotificationChime(formType === 'reminder' ? 'alert' : 'success');
    setShowFormModal(false);
  };

  const handleToggleSubtask = (task: Task, subtaskId: string) => {
    const updated = (task.subtasks || []).map(s => s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s);
    updateTask({ ...task, subtasks: updated });
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* ========================================================================= */}
      {/* TOP COMMAND HEADER: Title, Stats, Quick Actions & View Switcher            */}
      {/* ========================================================================= */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-theme-border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm">
        
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 shrink-0">
            <StickyNote className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-theme-text font-display tracking-tight">
                Notes & Reminders Hub
              </h2>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800">
                📝 {allNotes.length} Notes (P5)
              </span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800">
                🔔 {allReminders.length} Reminders (P1)
              </span>
            </div>
            <p className="text-xs text-theme-muted mt-0.5">
              Dual-system command: Non-blocking P5 Notes (Holidays, Matches, Oscars) & Special P1 Reminders (Birthdays, Anniversaries).
            </p>
          </div>
        </div>

        {/* Action Buttons & View Mode Controls */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
          
          {/* Quick Add Note (P5) */}
          <button
            onClick={openCreateNote}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/25 transition-all transform active:scale-95 cursor-pointer"
            title="Create general non-blocking note / event"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <StickyNote className="w-3.5 h-3.5" />
            <span>+ Add Note</span>
          </button>

          {/* Quick Add Reminder (P1 / Anniversary) */}
          <button
            onClick={() => openCreateReminder()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-sm shadow-rose-500/25 transition-all transform active:scale-95 cursor-pointer"
            title="Create special reminder, birthday, anniversary, or alarm"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <Bell className="w-3.5 h-3.5" />
            <span>+ Add Reminder</span>
          </button>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* FILTER & VIEW CONTROLS TOOLBAR                                            */}
      {/* ========================================================================= */}
      <div className="glass-panel p-3 rounded-2xl border border-theme-border flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        
        {/* Left: View Mode Segmented Switcher */}
        <div className="flex items-center gap-1 p-0.5 bg-theme-card-hover rounded-xl border border-theme-border">
          <button
            onClick={() => setTabMode('split')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tabMode === 'split'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Side-by-Side (Note | Reminder)</span>
          </button>

          <button
            onClick={() => setTabMode('notes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tabMode === 'notes'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>Notes Only ({filteredNotes.length})</span>
          </button>

          <button
            onClick={() => setTabMode('reminders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tabMode === 'reminders'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Reminders Only ({filteredReminders.length})</span>
          </button>
        </div>

        {/* Right: Search & Status Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-muted" />
            <input
              type="text"
              placeholder="Search notes & reminders..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-theme-card border border-theme-border text-xs font-semibold text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 sm:w-56"
            />
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-theme-card-hover rounded-xl border border-theme-border">
            {(['ACTIVE', 'COMPLETED', 'ALL'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                {st === 'ACTIVE' ? 'Active' : st === 'COMPLETED' ? 'Done' : 'All'}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MAIN DUAL-PANE VIEW: 📝 NOTE (LEFT)  |  🔔 REMINDER (RIGHT)               */}
      {/* ========================================================================= */}
      <div className={`grid gap-6 ${tabMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        
        {/* ======================================================================= */}
        {/* LEFT COLUMN: 📝 NOTES & GENERAL EVENTS (P5 INFORMATIONAL)               */}
        {/* ======================================================================= */}
        {(tabMode === 'split' || tabMode === 'notes') && (
          <div className="space-y-4">
            
            {/* Notes Column Header */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-300 dark:border-amber-800/80 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  📝
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-950 dark:text-amber-100 font-display flex items-center gap-1.5">
                    <span>Notes & Life Context</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.2 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                      {filteredNotes.length}
                    </span>
                  </h3>
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80">
                    Holidays, football matches, Oscars, reference items • Auto P5 non-blocking
                  </p>
                </div>
              </div>

              <button
                onClick={openCreateNote}
                className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-2xs flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
                <span>Add Note</span>
              </button>
            </div>

            {/* Notes Cards List */}
            {filteredNotes.length === 0 ? (
              <div className="glass-panel p-8 text-center rounded-2xl border border-dashed border-theme-border space-y-2">
                <StickyNote className="w-8 h-8 mx-auto text-amber-500/60" />
                <h4 className="text-xs font-bold text-theme-text">No Notes Found</h4>
                <p className="text-[11px] text-theme-muted max-w-xs mx-auto">
                  Log general context, match dates, or holidays you want to remember when free.
                </p>
                <button
                  onClick={openCreateNote}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  + Add First Note
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotes.map((note) => {
                  const isDone = note.status === 'Done';
                  const completedSubs = (note.subtasks || []).filter(s => s.isCompleted).length;
                  const totalSubs = (note.subtasks || []).length;

                  return (
                    <div
                      key={note.id}
                      className={`p-4 rounded-2xl border transition-all space-y-2.5 shadow-2xs hover:shadow-sm ${
                        isDone
                          ? 'opacity-60 bg-theme-card/60 border-theme-border'
                          : 'bg-theme-card border-amber-200/80 dark:border-amber-900/60 hover:border-amber-400/80'
                      }`}
                    >
                      {/* Card Top Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          
                          {/* Done Checkbox */}
                          <button
                            onClick={() => updateTask({ ...note, status: isDone ? 'Pending' : 'Done' })}
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                              isDone
                                ? 'bg-emerald-500 border-emerald-600 text-white'
                                : 'border-amber-400 hover:border-emerald-500'
                            }`}
                            title={isDone ? 'Reopen Note' : 'Mark as Done'}
                          >
                            {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>

                          {/* P5 Informational Tag */}
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono border border-amber-300 dark:border-amber-800">
                            P5 INFORMATIONAL
                          </span>

                          {/* Date Badge */}
                          <span className="text-[10px] font-mono text-theme-muted font-bold flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-blue-500" />
                            <span>{formatDisplayDate(note.taskDate)}</span>
                          </span>

                          {note.startTime && note.startTime !== 'All Day' && (
                            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                              ⏰ {note.startTime}
                            </span>
                          )}

                          {note.subCategory && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-theme-card-hover border border-theme-border text-theme-muted">
                              {note.subCategory}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(note)}
                            className="p-1 rounded-lg hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
                            title="Edit Note"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete note "${note.title}"?`)) {
                                deleteTask(note.id);
                              }
                            }}
                            className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors"
                            title="Delete Note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <h4 className={`text-sm font-bold text-theme-text font-display leading-snug ${isDone ? 'line-through text-theme-muted' : ''}`}>
                        {note.title}
                      </h4>

                      {/* Body Description */}
                      {(note.description || note.notes) && (
                        <p className="text-xs text-theme-muted whitespace-pre-wrap leading-relaxed bg-theme-card-hover/50 p-2.5 rounded-xl border border-theme-border/60">
                          {note.description || note.notes}
                        </p>
                      )}

                      {/* Checklist Subtasks */}
                      {totalSubs > 0 && (
                        <div className="space-y-1 p-2 rounded-xl bg-theme-card-hover/40 border border-theme-border/60">
                          <div className="flex items-center justify-between text-[10px] font-bold text-theme-muted pb-1 border-b border-theme-border/40">
                            <span className="flex items-center gap-1">
                              <CheckSquare className="w-3 h-3 text-emerald-500" />
                              <span>Checklist</span>
                            </span>
                            <span className="font-mono">{completedSubs}/{totalSubs}</span>
                          </div>
                          {note.subtasks?.map((sub) => (
                            <div
                              key={sub.id}
                              onClick={() => handleToggleSubtask(note, sub.id)}
                              className="flex items-center gap-2 text-xs text-theme-text hover:text-blue-500 cursor-pointer py-0.5"
                            >
                              {sub.isCompleted ? (
                                <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-theme-muted shrink-0" />
                              )}
                              <span className={`text-xs ${sub.isCompleted ? 'line-through text-theme-muted' : ''}`}>
                                {sub.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: 🔔 SPECIAL REMINDERS & RECURRING ALARMS (P1 / SPECIAL)     */}
        {/* ======================================================================= */}
        {(tabMode === 'split' || tabMode === 'reminders') && (
          <div className="space-y-4">
            
            {/* Reminders Column Header */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-500/15 via-red-500/10 to-amber-500/10 border border-rose-300 dark:border-rose-800/80 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  🔔
                </div>
                <div>
                  <h3 className="text-sm font-black text-rose-950 dark:text-rose-100 font-display flex items-center gap-1.5">
                    <span>Special Reminders & Events</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.2 rounded-full bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200">
                      {filteredReminders.length}
                    </span>
                  </h3>
                  <p className="text-[11px] text-rose-800/90 dark:text-rose-300/80">
                    Birthdays, wedding anniversaries, yearly events, critical alarms • P1 Special
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openCreateReminder('birthday')}
                  className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-700 hover:text-white dark:text-rose-300 text-[10px] font-bold border border-rose-300 dark:border-rose-800 transition-colors cursor-pointer hidden sm:flex items-center gap-1"
                  title="Quick add Birthday"
                >
                  <Gift className="w-3 h-3" />
                  <span>+ Birthday</span>
                </button>
                <button
                  onClick={() => openCreateReminder()}
                  className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white text-xs font-bold shadow-2xs flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  <span>Add Reminder</span>
                </button>
              </div>
            </div>

            {/* Reminders Cards List */}
            {filteredReminders.length === 0 ? (
              <div className="glass-panel p-8 text-center rounded-2xl border border-dashed border-theme-border space-y-2">
                <Bell className="w-8 h-8 mx-auto text-rose-500/60 animate-bounce" />
                <h4 className="text-xs font-bold text-theme-text">No Special Reminders Found</h4>
                <p className="text-[11px] text-theme-muted max-w-xs mx-auto">
                  Add birthdays, anniversaries, and critical alarms to track countdowns & yearly repeats.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => openCreateReminder('birthday')}
                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>+ Wife's Birthday</span>
                  </button>
                  <button
                    onClick={() => openCreateReminder('anniversary')}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span>+ Anniversary</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReminders.map((rem) => {
                  const isDone = rem.status === 'Done';
                  const isYearly = rem.recurrence === 'Yearly';
                  const countdown = getDaysUntilDate(rem.taskDate, isYearly);

                  return (
                    <div
                      key={rem.id}
                      className={`p-4 rounded-2xl border transition-all space-y-2.5 shadow-2xs hover:shadow-sm relative overflow-hidden ${
                        isDone
                          ? 'opacity-60 bg-theme-card/60 border-theme-border'
                          : countdown.isToday
                          ? 'bg-rose-500/10 border-rose-500 dark:border-rose-600 ring-2 ring-rose-500/30 shadow-md animate-pulse'
                          : countdown.isSoon
                          ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/80 ring-1 ring-rose-400/30'
                          : 'bg-theme-card border-rose-200/80 dark:border-rose-900/60 hover:border-rose-400/80'
                      }`}
                    >
                      {/* Top Row: Done Checkbox + Tags + Countdown */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          
                          {/* Done Checkbox */}
                          <button
                            onClick={() => updateTask({ ...rem, status: isDone ? 'Pending' : 'Done' })}
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                              isDone
                                ? 'bg-emerald-500 border-emerald-600 text-white'
                                : 'border-rose-400 hover:border-emerald-500'
                            }`}
                            title={isDone ? 'Reopen Reminder' : 'Mark as Done'}
                          >
                            {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>

                          {/* Countdown Badge */}
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-display uppercase tracking-wider flex items-center gap-1 shadow-2xs ${
                            countdown.isToday
                              ? 'bg-rose-600 text-white animate-bounce'
                              : countdown.isSoon
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                              : 'bg-theme-card-hover text-theme-muted border border-theme-border'
                          }`}>
                            <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>{countdown.text}</span>
                          </span>

                          {/* Recurrence Badge */}
                          {rem.recurrence && rem.recurrence !== 'None' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 flex items-center gap-1 font-mono">
                              <Repeat className="w-2.5 h-2.5" />
                              <span>{rem.recurrence === 'Yearly' ? '🔁 Yearly Event' : rem.recurrence}</span>
                            </span>
                          )}

                          {/* Date Badge */}
                          <span className="text-[10px] font-mono text-theme-muted font-bold flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-rose-500" />
                            <span>{formatDisplayDate(rem.taskDate)}</span>
                          </span>

                          {rem.startTime && rem.startTime !== 'All Day' && (
                            <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold">
                              ⏰ {rem.startTime}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(rem)}
                            className="p-1 rounded-lg hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
                            title="Edit Reminder"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete reminder "${rem.title}"?`)) {
                                deleteTask(rem.id);
                              }
                            }}
                            className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors"
                            title="Delete Reminder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <h4 className={`text-sm font-bold text-theme-text font-display leading-snug flex items-center gap-2 ${isDone ? 'line-through text-theme-muted' : ''}`}>
                        <span>{rem.title}</span>
                      </h4>

                      {/* Body Description */}
                      {(rem.description || rem.notes) && (
                        <p className="text-xs text-theme-muted whitespace-pre-wrap leading-relaxed bg-theme-card-hover/50 p-2.5 rounded-xl border border-theme-border/60">
                          {rem.description || rem.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* QUICK ADD / EDIT MODAL FOR NOTES & REMINDERS                              */}
      {/* ========================================================================= */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-theme-card border border-theme-border rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl animate-scale-in">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-theme-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold text-sm shadow-md ${
                  formType === 'reminder' ? 'bg-gradient-to-tr from-rose-500 to-red-600' : 'bg-amber-500'
                }`}>
                  {formType === 'reminder' ? '🔔' : '📝'}
                </div>
                <div>
                  <h3 className="text-base font-black text-theme-text font-display">
                    {editingId ? 'Edit Entry' : formType === 'reminder' ? 'New Special Reminder' : 'New Context Note'}
                  </h3>
                  <p className="text-xs text-theme-muted">
                    {formType === 'reminder' 
                      ? 'Birthdays, Anniversaries, Yearly Events • P1 Alert' 
                      : 'Holidays, Matches, Oscars, References • P5 Non-blocking'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowFormModal(false)}
                className="p-1.5 rounded-xl hover:bg-theme-card-hover text-theme-muted hover:text-theme-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Switch between Note and Reminder */}
            {!editingId && (
              <div className="p-1 rounded-xl bg-theme-card-hover border border-theme-border grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setFormType('note');
                    setPriority('P5');
                    setRecurrence('None');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    formType === 'note'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-theme-muted hover:text-theme-text'
                  }`}
                >
                  <StickyNote className="w-3.5 h-3.5" />
                  <span>📝 Note (Holidays / Matches / P5)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormType('reminder');
                    setPriority('P1');
                    setRecurrence('Yearly');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    formType === 'reminder'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-theme-muted hover:text-theme-text'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>🔔 Reminder (Birthday / Anniversary / P1)</span>
                </button>
              </div>
            )}

            {/* Title Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center justify-between">
                <span>{formType === 'reminder' ? 'Reminder / Event Title' : 'Note Title'}</span>
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder={formType === 'reminder' ? "e.g. Wife's Birthday 🎂, 5th Wedding Anniversary 💍..." : "e.g. Champions League Final, Oscar Night, Summer Vacation..."}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* Details / Notes */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider">
                Details & Context
              </label>
              <textarea
                rows={3}
                placeholder="Write context, venue, gift ideas, instructions, or thoughts..."
                value={notesBody}
                onChange={(e) => setNotesBody(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date & Alert Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-500" />
                  <span>Event Date</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span>Specific Time (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 08:00 PM (or empty for all-day)"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Recurrence Schedule */}
            <div className={`space-y-2 p-3.5 rounded-2xl border ${
              formType === 'reminder'
                ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60'
                : 'bg-theme-card-hover/60 border-theme-border'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-theme-text flex items-center gap-1.5 font-display">
                  <Repeat className="w-3.5 h-3.5 text-blue-500" />
                  <span>Repeat Schedule</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                  {recurrence === 'Yearly' ? '🔁 Yearly (Birthday/Anniversary)' : recurrence !== 'None' ? `Repeating: ${recurrence}` : 'One-time Event'}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                {(['None', 'Yearly', 'Daily', 'Selected Days', 'Weekly', 'Monthly'] as RecurrenceType[]).map((rType) => (
                  <button
                    key={rType}
                    type="button"
                    onClick={() => {
                      setRecurrence(rType);
                      if (formError) setFormError(null);
                    }}
                    className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                      recurrence === rType
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-theme-card text-theme-muted hover:text-theme-text border-theme-border'
                    }`}
                  >
                    {rType === 'Yearly' ? '🎂 Yearly' : rType === 'Selected Days' ? 'Custom' : rType}
                  </button>
                ))}
              </div>

              {recurrence === 'Selected Days' && (
                <div className="pt-2 border-t border-theme-border flex items-center gap-1 flex-wrap">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                    const isSelected = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-theme-card text-theme-muted border-theme-border hover:border-blue-400'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Checklist Subtasks (Optional) */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider flex items-center justify-between">
                <span>Checklist / Sub-items (Optional)</span>
                <span className="text-[10px] text-theme-muted font-mono">{subtasks.length} items</span>
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add item (e.g. Buy flowers, book restaurant)..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newSubtaskTitle.trim()) {
                        setSubtasks([...subtasks, { id: `sub_${Date.now()}`, title: newSubtaskTitle.trim(), isCompleted: false, depthLevel: 1, assignedTimeMin: 0 }]);
                        setNewSubtaskTitle('');
                      }
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newSubtaskTitle.trim()) {
                      setSubtasks([...subtasks, { id: `sub_${Date.now()}`, title: newSubtaskTitle.trim(), isCompleted: false, depthLevel: 1, assignedTimeMin: 0 }]);
                      setNewSubtaskTitle('');
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                >
                  Add
                </button>
              </div>

              {subtasks.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {subtasks.map((st, idx) => (
                    <div key={st.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-theme-card-hover border border-theme-border text-xs">
                      <span className="truncate">{st.title}</span>
                      <button
                        type="button"
                        onClick={() => setSubtasks(subtasks.filter((_, i) => i !== idx))}
                        className="text-theme-muted hover:text-red-500 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-border">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2 rounded-xl bg-theme-card-hover hover:bg-theme-border text-theme-text text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-md transition-all transform active:scale-95 cursor-pointer ${
                  formType === 'reminder'
                    ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 shadow-rose-500/25'
                    : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25'
                }`}
              >
                {editingId ? 'Save Changes' : formType === 'reminder' ? 'Create Special Reminder' : 'Create Note'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
