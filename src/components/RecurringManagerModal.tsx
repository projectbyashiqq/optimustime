import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Task, 
  PriorityLevel, 
  RecurrenceType, 
  SubTask,
  TaskLink
} from '../types';
import { 
  formatDisplayDate, 
  toISODateString, 
  addMinutesToTime, 
  diffTimeInMinutes,
  getNextRecurrenceDate,
  SHORT_DAYS 
} from '../utils/timeUtils';
import { TimePicker } from './TimePicker';
import { 
  Repeat, 
  Clock, 
  Calendar, 
  Pause, 
  Play, 
  Trash2, 
  Edit2, 
  Plus, 
  X, 
  CheckCircle2, 
  AlertCircle,
  RotateCcw,
  Sparkles,
  Zap,
  ShieldCheck,
  Copy,
  Sliders,
  Check,
  Lock,
  ArrowRight,
  TrendingUp,
  Folder,
  Tag,
  Search,
  Filter
} from 'lucide-react';

interface RecurringManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTaskModal?: (task?: Task) => void;
}

export const RecurringManagerModal: React.FC<RecurringManagerModalProps> = ({
  isOpen,
  onClose
}) => {
  const { 
    tasks, 
    categories,
    prioritySettings, 
    capacitySettings,
    planProjects,
    pauseRecurringSeries, 
    resumeRecurringSeries, 
    deleteRecurringSeries,
    updateRecurringSeriesEntirely,
    shiftRecurringSeriesTime,
    duplicateRecurringSeries,
    bulkPauseRecurringSeries,
    bulkResumeRecurringSeries,
    addTask
  } = useApp();

  const [filterRecurrence, setFilterRecurrence] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // God Admin Series Editor State
  const [editingSeries, setEditingSeries] = useState<Task | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // Form fields for God Admin Series Editor
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<PriorityLevel>('P1');
  const [formCategory, setFormCategory] = useState('Work');
  const [formSubCategory, setFormSubCategory] = useState('');
  const [formStartTime, setFormStartTime] = useState('09:00 AM');
  const [formEndTime, setFormEndTime] = useState('10:00 AM');
  const [formDuration, setFormDuration] = useState<number>(60);
  const [formBuffer, setFormBuffer] = useState<number>(15);
  const [formRecurrence, setFormRecurrence] = useState<RecurrenceType>('Daily');
  const [formSelectedDays, setFormSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [formIsMandatory, setFormIsMandatory] = useState<boolean>(false);
  const [formPlanProjectId, setFormPlanProjectId] = useState<string | undefined>(undefined);
  const [formNotes, setFormNotes] = useState('');
  const [formSubtasks, setFormSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskMinutes, setNewSubtaskMinutes] = useState<number>(15);
  const [propagateScope, setPropagateScope] = useState<'all' | 'future'>('all');
  const [clearExclusionsOnSave, setClearExclusionsOnSave] = useState<boolean>(false);

  if (!isOpen) return null;

  // Recurring tasks list
  const recurringTasks = useMemo(() => {
    return tasks.filter(t => t.recurrence && t.recurrence !== 'None');
  }, [tasks]);

  // Executive Telemetry
  const telemetry = useMemo(() => {
    let weeklyMinutes = 0;
    let totalSkippedDates = 0;
    let pausedCount = 0;

    for (const t of recurringTasks) {
      const duration = t.appointedMinutes || diffTimeInMinutes(t.startTime, t.endTime) || 60;
      if (t.status === 'Hold') pausedCount++;
      totalSkippedDates += (t.excludedDates || []).length;

      if (t.recurrence === 'Daily') {
        weeklyMinutes += duration * 7;
      } else if (t.recurrence === 'Selected Days' && t.selectedDays) {
        weeklyMinutes += duration * t.selectedDays.length;
      } else if (t.recurrence === 'Weekly') {
        weeklyMinutes += duration;
      } else if (t.recurrence === 'Monthly') {
        weeklyMinutes += duration * (7 / 30);
      } else if (t.recurrence === 'Yearly') {
        weeklyMinutes += duration * (7 / 365);
      }
    }

    const weeklyHours = (weeklyMinutes / 60).toFixed(1);
    return {
      activeCount: recurringTasks.length - pausedCount,
      pausedCount,
      weeklyHours,
      totalSkippedDates
    };
  }, [recurringTasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return recurringTasks.filter(t => {
      if (filterRecurrence !== 'ALL' && t.recurrence !== filterRecurrence) return false;
      if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchCode = t.projectCode?.toLowerCase().includes(q);
        const matchCat = t.category.toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchCat) return false;
      }
      return true;
    });
  }, [recurringTasks, filterRecurrence, filterCategory, searchQuery]);

  // Open God Admin Editor for an existing series
  const handleOpenEditSeries = (task: Task) => {
    setEditingSeries(task);
    setIsCreatingNew(false);
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormPriority(task.priority);
    setFormCategory(task.category);
    setFormSubCategory(task.subCategory || '');
    setFormStartTime(task.startTime);
    setFormEndTime(task.endTime);
    setFormDuration(task.appointedMinutes || 60);
    setFormBuffer(task.bufferMinutes ?? 15);
    setFormRecurrence(task.recurrence);
    setFormSelectedDays(task.selectedDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setFormIsMandatory(Boolean(task.isMandatorySchedule));
    setFormPlanProjectId(task.planProjectId);
    setFormNotes(task.notes || '');
    setFormSubtasks(task.subtasks || []);
    setClearExclusionsOnSave(false);
    setPropagateScope('all');
  };

  // Open God Admin Editor to create a brand-new series
  const handleOpenCreateNewSeries = () => {
    setEditingSeries(null);
    setIsCreatingNew(true);
    setFormTitle('');
    setFormDescription('');
    setFormPriority('P1');
    setFormCategory(categories[0]?.name || 'Work');
    setFormSubCategory('');
    setFormStartTime('09:00 AM');
    setFormEndTime('10:00 AM');
    setFormDuration(60);
    setFormBuffer(capacitySettings.defaultBufferMinutes || 15);
    setFormRecurrence('Daily');
    setFormSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setFormIsMandatory(false);
    setFormPlanProjectId(undefined);
    setFormNotes('');
    setFormSubtasks([]);
    setClearExclusionsOnSave(false);
    setPropagateScope('all');
  };

  // Close God Admin Editor
  const handleCloseEditor = () => {
    setEditingSeries(null);
    setIsCreatingNew(false);
  };

  // When duration changes in editor
  const handleDurationChange = (minutes: number) => {
    setFormDuration(minutes);
    setFormEndTime(addMinutesToTime(formStartTime, minutes));
  };

  // When start time changes in editor
  const handleStartTimeChange = (newStart: string) => {
    setFormStartTime(newStart);
    setFormEndTime(addMinutesToTime(newStart, formDuration));
  };

  // Toggle Day of Week
  const handleToggleDay = (day: string) => {
    setFormSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Add subtask to master template
  const handleAddSubtask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    const newSt: SubTask = {
      id: `st-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: newSubtaskTitle.trim(),
      isCompleted: false,
      depthLevel: 1,
      assignedTimeMin: newSubtaskMinutes
    };

    setFormSubtasks(prev => [...prev, newSt]);
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (id: string) => {
    setFormSubtasks(prev => prev.filter(st => st.id !== id));
  };

  // Save changes from God Admin
  const handleSaveSeries = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formTitle.trim()) return;

    const calculatedEndTime = addMinutesToTime(formStartTime, formDuration);

    if (isCreatingNew) {
      // Create new recurring master series
      addTask({
        title: formTitle.trim(),
        description: formDescription.trim(),
        priority: formPriority,
        category: formCategory,
        subCategory: formSubCategory,
        startTime: formStartTime,
        endTime: calculatedEndTime,
        appointedMinutes: formDuration,
        bufferMinutes: formBuffer,
        recurrence: formRecurrence,
        selectedDays: formRecurrence === 'Selected Days' ? formSelectedDays : [],
        isMandatorySchedule: formIsMandatory,
        planProjectId: formPlanProjectId,
        notes: formNotes,
        subtasks: formSubtasks,
        taskDate: toISODateString(new Date()),
        dayOfWeek: 'Monday',
        status: 'Pending',
        links: []
      });
    } else if (editingSeries) {
      // SUPREME GOD ADMIN UPDATE: Entirely propagate across system
      updateRecurringSeriesEntirely(editingSeries.id, {
        title: formTitle.trim(),
        description: formDescription.trim(),
        priority: formPriority,
        category: formCategory,
        subCategory: formSubCategory,
        startTime: formStartTime,
        endTime: calculatedEndTime,
        appointedMinutes: formDuration,
        bufferMinutes: formBuffer,
        recurrence: formRecurrence,
        selectedDays: formRecurrence === 'Selected Days' ? formSelectedDays : [],
        isMandatorySchedule: formIsMandatory,
        planProjectId: formPlanProjectId,
        notes: formNotes,
        subtasks: formSubtasks
      }, {
        clearExclusions: clearExclusionsOnSave,
        syncSnapshots: true,
        propagateScope
      });
    }

    handleCloseEditor();
  };

  // Helper to preview upcoming dates
  const getUpcomingDates = (task: Task, count: number = 3): string[] => {
    const dates: string[] = [];
    const today = new Date();
    let cursor = toISODateString(today);
    for (let i = 0; i < 20 && dates.length < count; i++) {
      const next = getNextRecurrenceDate(task, cursor);
      if (!next || next === cursor) break;
      const isExcluded = (task.excludedDates || []).includes(next);
      if (!isExcluded) {
        dates.push(next);
      }
      cursor = next;
    }
    return dates;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-theme-card border border-theme-border rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        
        {/* =========================================================================
            HEADER & GOD ADMIN HERO
            ========================================================================= */}
        <div className="px-6 py-5 border-b border-theme-border flex items-center justify-between bg-gradient-to-r from-blue-600/15 via-indigo-600/15 to-purple-600/15">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              <Repeat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-theme-text font-display">
                  Recurring Tasks & Schedules Hub
                </h3>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-mono border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  God Admin Series Authority
                </span>
              </div>
              <p className="text-xs text-theme-muted font-medium">
                Centralized command for recurring schedules. Any change configured here updates the task series entirely everywhere.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCreateNewSeries}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all transform active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>New Recurring Series</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors"
              title="Close Hub"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            EXECUTIVE TELEMETRY RIBBON
            ========================================================================= */}
        <div className="px-6 py-3.5 border-b border-theme-border grid grid-cols-2 sm:grid-cols-4 gap-3 bg-theme-card-hover/40 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <span className="text-theme-muted text-[11px] block">Active Series</span>
              <span className="font-mono font-black text-theme-text text-sm">
                {telemetry.activeCount} Master Schedules
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            <div>
              <span className="text-theme-muted text-[11px] block">Weekly Budget</span>
              <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                ~{telemetry.weeklyHours}h / week
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <div>
              <span className="text-theme-muted text-[11px] block">Paused Series</span>
              <span className="font-mono font-black text-theme-text text-sm">
                {telemetry.pausedCount} on Hold
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
            <div>
              <span className="text-theme-muted text-[11px] block">Skipped Dates</span>
              <span className="font-mono font-black text-theme-text text-sm">
                {telemetry.totalSkippedDates} Total Excluded
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            FILTER CONTROLS & BULK COMMANDS
            ========================================================================= */}
        <div className="px-6 py-3 border-b border-theme-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-theme-card text-xs">
          
          {/* Frequency Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {['ALL', 'Daily', 'Selected Days', 'Weekly', 'Monthly', 'Yearly'].map((rec) => (
              <button
                key={rec}
                type="button"
                onClick={() => setFilterRecurrence(rec)}
                className={`px-3 py-1 rounded-xl font-bold transition-all whitespace-nowrap ${
                  filterRecurrence === rec
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-theme-card-hover hover:bg-theme-border text-theme-muted hover:text-theme-text border border-theme-border'
                }`}
              >
                {rec === 'ALL' ? `All (${recurringTasks.length})` : rec}
              </button>
            ))}
          </div>

          {/* Search & Bulk Operations */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search series..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <button
              type="button"
              onClick={bulkPauseRecurringSeries}
              className="px-2.5 py-1.5 rounded-xl border border-theme-border bg-theme-card-hover hover:bg-theme-border text-theme-muted hover:text-theme-text text-xs font-bold transition-colors"
              title="Pause all active recurring schedules"
            >
              Pause All
            </button>

            <button
              type="button"
              onClick={bulkResumeRecurringSeries}
              className="px-2.5 py-1.5 rounded-xl border border-theme-border bg-theme-card-hover hover:bg-theme-border text-theme-muted hover:text-theme-text text-xs font-bold transition-colors"
              title="Resume all paused schedules"
            >
              Resume All
            </button>
          </div>

        </div>

        {/* =========================================================================
            SERIES LIST / MAIN STAGE
            ========================================================================= */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-theme-card-hover/40 border border-dashed border-theme-border space-y-3">
              <Repeat className="w-9 h-9 text-theme-muted mx-auto opacity-40" />
              <h5 className="text-sm font-bold text-theme-text">No Recurring Series Found</h5>
              <p className="text-xs text-theme-muted max-w-sm mx-auto">
                {filterRecurrence === 'ALL' 
                  ? "You don't have any repeating schedules configured yet. Click '+ New Recurring Series' to create daily standups, weekly deep work sessions, or habits."
                  : `No series found matching '${filterRecurrence}'.`}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const pMeta = prioritySettings[task.priority];
              const isPaused = task.status === 'Hold';
              const excludedCount = (task.excludedDates || []).length;
              const upcomingDates = getUpcomingDates(task, 3);

              return (
                <div
                  key={task.id}
                  className={`p-5 rounded-2xl border transition-all space-y-3.5 shadow-xs ${
                    isPaused
                      ? 'bg-theme-card/60 border-theme-border opacity-80'
                      : 'bg-theme-card border-theme-border hover:border-blue-400 hover:shadow-md'
                  }`}
                >
                  {/* Top Row: Priority, Project Code, Time, Status, God Admin Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-theme-border/40 pb-3">
                    
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Priority Badge */}
                        <span 
                          className="text-[10px] font-black px-2 py-0.5 rounded font-mono uppercase"
                          style={{ backgroundColor: pMeta?.bgColor, color: pMeta?.color }}
                        >
                          {task.priority} • {pMeta?.label}
                        </span>

                        {/* Category */}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-theme-card-hover text-theme-muted border border-theme-border">
                          {task.category}
                        </span>

                        {/* Project Code */}
                        <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                          {task.projectCode}
                        </span>

                        {/* Scheduled Time */}
                        <span className="text-xs font-mono font-bold text-theme-text flex items-center gap-1 bg-theme-card-hover px-2.5 py-0.5 rounded-lg border border-theme-border">
                          <Clock className="w-3.5 h-3.5 text-theme-muted" />
                          <span>{task.startTime} – {task.endTime} ({task.appointedMinutes}m)</span>
                        </span>

                        {/* Buffer Pill */}
                        {task.bufferMinutes !== undefined && task.bufferMinutes > 0 && (
                          <span className="text-[10px] font-mono text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full bg-purple-500/15">
                            +{task.bufferMinutes}m buffer
                          </span>
                        )}

                        {/* Mandatory Fixed Lock */}
                        {task.isMandatorySchedule && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Locked Schedule
                          </span>
                        )}

                        {/* Status */}
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                          isPaused
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {isPaused ? '⏸ Paused' : '● Active'}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-theme-text leading-snug">
                        {task.title}
                      </h4>

                      {task.description && (
                        <p className="text-xs text-theme-muted line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </div>

                    {/* God Admin Fast Action Toolbar */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 flex-wrap">
                      
                      {/* Fast Time-Shift Tool (-15m / +15m) */}
                      <div className="flex items-center bg-theme-card-hover p-0.5 rounded-xl border border-theme-border">
                        <button
                          type="button"
                          onClick={() => shiftRecurringSeriesTime(task.id, -15)}
                          className="px-2 py-1 text-[10px] font-mono font-bold text-theme-muted hover:text-theme-text hover:bg-theme-card rounded-lg transition-colors"
                          title="Shift entire recurring series 15 minutes earlier across all dates"
                        >
                          -15m
                        </button>
                        <button
                          type="button"
                          onClick={() => shiftRecurringSeriesTime(task.id, 15)}
                          className="px-2 py-1 text-[10px] font-mono font-bold text-theme-muted hover:text-theme-text hover:bg-theme-card rounded-lg transition-colors"
                          title="Shift entire recurring series 15 minutes later across all dates"
                        >
                          +15m
                        </button>
                      </div>

                      {/* Pause / Resume */}
                      {isPaused ? (
                        <button
                          type="button"
                          onClick={() => resumeRecurringSeries(task.id)}
                          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
                          title="Resume Recurring Schedule"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => pauseRecurringSeries(task.id)}
                          className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs"
                          title="Pause Recurring Schedule"
                        >
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        </button>
                      )}

                      {/* Duplicate Series */}
                      <button
                        type="button"
                        onClick={() => duplicateRecurringSeries(task.id)}
                        className="p-2 rounded-xl border border-theme-border hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
                        title="Duplicate Entire Recurring Series"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* 👑 EDIT MASTER SERIES (GOD ADMIN) */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditSeries(task)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-xs transition-all active:scale-95"
                        title="Edit Master Recurring Series (Propagates Everywhere)"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Series</span>
                      </button>

                      {/* Delete Series */}
                      <button
                        type="button"
                        onClick={() => deleteRecurringSeries(task.id)}
                        className="p-2 rounded-xl border border-theme-border hover:bg-rose-50 dark:hover:bg-rose-950/40 text-theme-muted hover:text-rose-500 transition-colors"
                        title="Delete Entire Recurring Series Everywhere"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>

                  {/* Recurrence Rule Banner & Active Day Pills */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Repeat className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="font-bold text-theme-text">
                        {task.recurrence}
                      </span>

                      {/* Day pills if Selected Days */}
                      {task.selectedDays && task.selectedDays.length > 0 && (
                        <div className="flex items-center gap-1">
                          {SHORT_DAYS.map((day) => {
                            const isSelected = task.selectedDays?.includes(day);
                            return (
                              <span
                                key={day}
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                                  isSelected
                                    ? 'bg-blue-600 text-white font-black'
                                    : 'bg-theme-card-hover text-theme-muted/50 border border-theme-border/40'
                                }`}
                              >
                                {day.slice(0, 1)}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Subtasks template pill */}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {task.subtasks.length} subtask template
                        </span>
                      )}
                    </div>

                    {/* Upcoming Dates Preview */}
                    {upcomingDates.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-theme-muted">
                        <span>Upcoming:</span>
                        {upcomingDates.map((d, idx) => (
                          <span 
                            key={idx} 
                            className="font-mono font-bold px-2 py-0.5 rounded-md bg-theme-card-hover border border-theme-border text-theme-text"
                          >
                            {formatDisplayDate(d)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Skipped Exclusions Count */}
                    {excludedCount > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                          {excludedCount} skipped
                        </span>
                        <button
                          type="button"
                          onClick={() => updateRecurringSeriesEntirely(task.id, {}, { clearExclusions: true })}
                          className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                          title="Restore all skipped dates for this recurring series"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore All</span>
                        </button>
                      </div>
                    )}

                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* =========================================================================
            GOD ADMIN IN-PLACE MASTER SERIES EDITOR (MODAL OVERLAY)
            ========================================================================= */}
        {(editingSeries || isCreatingNew) && (
          <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fade-in">
            <div className="bg-theme-card border border-theme-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
              
              {/* Editor Header */}
              <div className="px-6 py-4 border-b border-theme-border flex items-center justify-between bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                    👑
                  </div>
                  <div>
                    <h4 className="text-base font-black text-theme-text font-display">
                      {isCreatingNew ? 'Create New Master Recurring Series' : `God Admin: Edit Series "${editingSeries?.title}"`}
                    </h4>
                    <span className="text-[10px] font-mono text-theme-muted">
                      Changes configured here will update this Task series ENTIRELY everywhere.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseEditor}
                  className="p-1.5 rounded-xl text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Editor Form Body */}
              <form onSubmit={handleSaveSeries} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                
                {/* 1. Core Identity */}
                <div className="space-y-3">
                  <div>
                    <label className="font-bold text-theme-text block pb-1">
                      Series Title *
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Morning Executive Sync, Deep Work Block, Habit..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-theme-card-hover border border-theme-border text-sm text-theme-text placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-theme-text block pb-1">
                      Series Description / Routine Purpose
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Describe what occurs during every occurrence of this series..."
                      rows={2}
                      className="w-full px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                    />
                  </div>

                  {/* Priority & Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-theme-text block pb-1">
                        Priority Level
                      </label>
                      <select
                        value={formPriority}
                        onChange={(e) => setFormPriority(e.target.value as PriorityLevel)}
                        className="w-full px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-xs font-bold text-theme-text focus:outline-none cursor-pointer"
                      >
                        {(['P1', 'P2', 'P3', 'P4', 'P5'] as PriorityLevel[]).map(p => (
                          <option key={p} value={p}>
                            {p} • {prioritySettings[p]?.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-theme-text block pb-1">
                        Category
                      </label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-xs font-bold text-theme-text focus:outline-none cursor-pointer"
                      >
                        {categories.map(c => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Circadian Timing Engine */}
                <div className="p-4 rounded-2xl bg-theme-card-hover/60 border border-theme-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-theme-text flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      Circadian Timing & Duration
                    </span>
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      {formStartTime} – {formEndTime} ({formDuration}m)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-theme-muted block pb-1">
                        Start Time
                      </label>
                      <TimePicker
                        value={formStartTime}
                        onChange={handleStartTimeChange}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-theme-muted block pb-1">
                        Duration (Minutes)
                      </label>
                      <div className="flex items-center gap-1 bg-theme-card p-1 rounded-xl border border-theme-border">
                        {[15, 30, 45, 60, 90, 120].map(mins => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => handleDurationChange(mins)}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all ${
                              formDuration === mins
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-theme-muted hover:text-theme-text'
                            }`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Transition Buffer & Mandatory Lock */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-theme-muted block pb-1">
                        Transition Buffer
                      </label>
                      <select
                        value={formBuffer}
                        onChange={(e) => setFormBuffer(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-xl bg-theme-card border border-theme-border text-xs font-bold text-theme-text"
                      >
                        <option value={0}>0 mins (No buffer)</option>
                        <option value={5}>5 mins buffer</option>
                        <option value={10}>10 mins buffer</option>
                        <option value={15}>15 mins buffer</option>
                        <option value={30}>30 mins buffer</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-theme-card border border-theme-border self-end">
                      <div className="space-y-0.5">
                        <span className="font-bold text-theme-text text-[11px] block">
                          Locked Schedule
                        </span>
                        <span className="text-[10px] text-theme-muted block">
                          Immune to auto-shifts
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formIsMandatory}
                        onChange={(e) => setFormIsMandatory(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Recurrence Pattern & Days */}
                <div className="p-4 rounded-2xl bg-theme-card-hover/60 border border-theme-border space-y-3">
                  <span className="font-bold text-theme-text flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-blue-500" />
                    Recurrence Frequency & Rules
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(['Daily', 'Selected Days', 'Weekly', 'Monthly', 'Yearly'] as RecurrenceType[]).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormRecurrence(r)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          formRecurrence === r
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-theme-card hover:bg-theme-card-hover text-theme-muted border border-theme-border'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  {/* Day of Week Selector */}
                  {(formRecurrence === 'Selected Days' || formRecurrence === 'Weekly') && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-theme-muted">
                        Active Days of the Week
                      </span>
                      <div className="grid grid-cols-7 gap-1">
                        {SHORT_DAYS.map(day => {
                          const isSelected = formSelectedDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => handleToggleDay(day)}
                              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
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

                {/* 4. Master Subtask Template (Repeats on every occurrence) */}
                <div className="p-4 rounded-2xl bg-theme-card-hover/60 border border-theme-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-theme-text flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Master Subtask Template ({formSubtasks.length})
                    </span>
                    <span className="text-[10px] text-theme-muted">
                      Repeats on every occurrence
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Add repeating subtask item..."
                      className="flex-1 px-3 py-1.5 rounded-xl bg-theme-card border border-theme-border text-xs text-theme-text"
                    />
                    <button
                      type="button"
                      onClick={handleAddSubtask}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs"
                    >
                      Add
                    </button>
                  </div>

                  {formSubtasks.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {formSubtasks.map((st) => (
                        <div 
                          key={st.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-theme-card border border-theme-border text-xs"
                        >
                          <span className="font-medium text-theme-text">{st.title}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubtask(st.id)}
                            className="text-theme-muted hover:text-rose-500 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. God Admin Propagation Notice & Scope */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-theme-card to-purple-500/10 border border-indigo-500/30 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-indigo-800 dark:text-indigo-300">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span>God Admin Propagation Protocol</span>
                  </div>
                  <p className="text-[11px] text-theme-muted leading-relaxed">
                    Saving here updates the entire master schedule. All future calendar days, 24-hour timeline slots, and dashboard views reflect these new rules.
                  </p>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-theme-border/40">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clearExclusionsOnSave}
                        onChange={(e) => setClearExclusionsOnSave(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="font-bold text-theme-text text-[11px]">
                        Restore all skipped / excluded dates
                      </span>
                    </label>

                    <div className="flex items-center gap-1 bg-theme-card p-1 rounded-xl border border-theme-border">
                      <button
                        type="button"
                        onClick={() => setPropagateScope('all')}
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                          propagateScope === 'all'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-theme-muted'
                        }`}
                      >
                        All Everywhere
                      </button>
                      <button
                        type="button"
                        onClick={() => setPropagateScope('future')}
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                          propagateScope === 'future'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-theme-muted'
                        }`}
                      >
                        From Today Onward
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submit & Cancel Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-theme-border">
                  <button
                    type="button"
                    onClick={handleCloseEditor}
                    className="px-4 py-2 rounded-xl border border-theme-border text-theme-muted hover:text-theme-text font-bold transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black shadow-md shadow-indigo-500/25 transition-all transform active:scale-95"
                  >
                    {isCreatingNew ? 'Create Series Everywhere' : '👑 Save & Propagate Entirely'}
                  </button>
                </div>

              </form>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
