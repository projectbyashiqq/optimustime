import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  Upload, 
  FileText, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Layers, 
  Calendar, 
  Clock, 
  Trash2, 
  Plus, 
  HelpCircle, 
  Folder,
  CalendarDays,
  ArrowRight,
  RefreshCw,
  LayoutList,
  Table as TableIcon,
  Lock,
  Unlock,
  Repeat,
  Shield,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Tag
} from 'lucide-react';
import { PriorityLevel, TaskStatus, RecurrenceType } from '../types';
import { 
  parseMultiLineText, 
  parseSpreadsheetFile, 
  downloadBatchTemplate, 
  BatchTaskItem, 
  BatchDefaults, 
  addDaysToDate 
} from '../utils/batchTaskParser';
import { 
  toISODateString, 
  formatDurationHuman, 
  addMinutesToTime,
  parse12HourToMinutes,
  formatMinutesTo12Hour
} from '../utils/timeUtils';

interface BatchTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  initialCategory?: string;
  initialPlanProjectId?: string;
}

export const BatchTaskModal: React.FC<BatchTaskModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialCategory,
  initialPlanProjectId
}) => {
  const { 
    categories, 
    planProjects, 
    addBatchTasks, 
    prioritySettings,
    defaultTaskSettings
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tabs: 'text' or 'file'
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');

  // Preview Layout on Mobile: 'cards' or 'table'
  const [previewViewMode, setPreviewViewMode] = useState<'cards' | 'table'>('cards');

  // Multi-line raw text placeholder demonstrating full task options
  const [rawText, setRawText] = useState<string>(
`Project Kickoff & Architecture | P1 | 45m | Engineering / Core Engine | | 09:00 AM | PRJ-VRTX | +15m
Draft Database Schema & Models | P2 | 90m | Engineering / Infrastructure | | 10:00 AM | PRJ-VRTX | +10m
Review Sprint Milestone Goals | P2 | 30m | Operations / Strategy | | 02:00 PM | PLN-2026-01 | Weekly
Customer Feedback & Bug Fixes | P3 | 60m | Operations / Client Relations | | 03:00 PM | +10m
Evening Workout & Recharge | P5 | 45m | Personal / Health & Fitness | | Anytime | Daily`
  );

  // File Upload State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);

  // Batch Defaults: Date Options
  const [defaultDate, setDefaultDate] = useState<string>(() => initialDate || toISODateString(new Date()));
  const [dateMode, setDateMode] = useState<'same' | 'spread'>('same');
  const [tasksPerDay, setTasksPerDay] = useState<number>(1);

  // Batch Defaults: Plan / Project Option
  const [defaultPlanProjectId, setDefaultPlanProjectId] = useState<string>(() => initialPlanProjectId || '');

  // Batch Defaults: Core Task Attributes
  const [defaultPriority, setDefaultPriority] = useState<PriorityLevel>('P3');
  const [defaultCategory, setDefaultCategory] = useState<string>(() => initialCategory || (categories[0]?.name || 'General'));
  const [defaultSubCategory, setDefaultSubCategory] = useState<string>('');
  const [defaultDuration, setDefaultDuration] = useState<number>(() => defaultTaskSettings?.defaultAppointedMinutes || 60);
  const [defaultBufferMinutes, setDefaultBufferMinutes] = useState<number>(() => defaultTaskSettings?.defaultBufferMinutes ?? 0);
  const [defaultRecurrence, setDefaultRecurrence] = useState<RecurrenceType>('None');
  const [defaultIsMandatory, setDefaultIsMandatory] = useState<boolean>(false);
  const [timeMode, setTimeMode] = useState<'sequence' | 'anytime' | 'fixed'>('sequence');
  const [sequenceStartTime, setSequenceStartTime] = useState<string>('09:00 AM');

  // Inline notes drawer in table view
  const [expandedNotesRowIndex, setExpandedNotesRowIndex] = useState<number | null>(null);

  // Parsed Tasks preview
  const [parsedTasks, setParsedTasks] = useState<BatchTaskItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSyntaxGuide, setShowSyntaxGuide] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active Category Object & Subcategories
  const currentCategoryObj = useMemo(() => {
    return categories.find(c => c.name.toLowerCase() === defaultCategory.toLowerCase());
  }, [categories, defaultCategory]);

  const availableSubCategories = useMemo(() => {
    return currentCategoryObj?.subCategories || [];
  }, [currentCategoryObj]);

  // Sync default subcategory when category changes
  const handleSelectDefaultCategory = (catName: string) => {
    setDefaultCategory(catName);
    const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
    if (cat && cat.subCategories && cat.subCategories.length > 0) {
      setDefaultSubCategory(cat.subCategories[0]);
    } else {
      setDefaultSubCategory('');
    }
  };

  // Update initial defaults if props change
  useEffect(() => {
    if (initialDate) setDefaultDate(initialDate);
    if (initialCategory) {
      handleSelectDefaultCategory(initialCategory);
    }
    if (initialPlanProjectId) setDefaultPlanProjectId(initialPlanProjectId);
  }, [initialDate, initialCategory, initialPlanProjectId, isOpen]);

  // Combine defaults
  const currentDefaults: BatchDefaults = useMemo(() => ({
    taskDate: defaultDate,
    dateMode,
    tasksPerDay,
    priority: defaultPriority,
    category: defaultCategory,
    subCategory: defaultSubCategory || undefined,
    appointedMinutes: defaultDuration,
    timeMode,
    sequenceStartTime,
    bufferMinutes: defaultBufferMinutes,
    recurrence: defaultRecurrence,
    isMandatorySchedule: defaultIsMandatory,
    status: 'Pending' as TaskStatus,
    planProjectId: defaultPlanProjectId || undefined,
    planProjects
  }), [
    defaultDate, 
    dateMode, 
    tasksPerDay, 
    defaultPriority, 
    defaultCategory, 
    defaultSubCategory, 
    defaultDuration, 
    timeMode, 
    sequenceStartTime, 
    defaultBufferMinutes, 
    defaultRecurrence, 
    defaultIsMandatory, 
    defaultPlanProjectId, 
    planProjects
  ]);

  // Parse text whenever text or defaults change in 'text' tab
  useEffect(() => {
    if (activeTab === 'text') {
      const tasks = parseMultiLineText(rawText, currentDefaults);
      setParsedTasks(tasks);
    }
  }, [rawText, currentDefaults, activeTab]);

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setUploadedFile(file);
    setFileError(null);
    setIsParsingFile(true);
    try {
      const tasks = await parseSpreadsheetFile(file, currentDefaults);
      if (tasks.length === 0) {
        setFileError('No valid task rows could be found in the file. Ensure column headers include "Title" or "Task".');
      } else {
        setParsedTasks(tasks);
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setFileError(`Failed to parse file: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsParsingFile(false);
    }
  };

  // Drag and drop handlers
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  // Quick Date Presets
  const setQuickDate = (type: 'today' | 'tomorrow' | 'nextMon') => {
    const now = new Date();
    if (type === 'today') {
      setDefaultDate(toISODateString(now));
    } else if (type === 'tomorrow') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      setDefaultDate(toISODateString(d));
    } else if (type === 'nextMon') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = day === 0 ? 1 : 8 - day;
      d.setDate(d.getDate() + diff);
      setDefaultDate(toISODateString(d));
    }
  };

  // Bulk Apply Helpers
  const applyDateToAllRows = () => {
    setParsedTasks(prev => prev.map((t, idx) => {
      let taskDate = defaultDate;
      if (dateMode === 'spread') {
        const offset = Math.floor(idx / Math.max(1, tasksPerDay));
        taskDate = addDaysToDate(defaultDate, offset);
      }
      return { ...t, taskDate };
    }));
  };

  const handleSelectDefaultProject = (projId: string) => {
    setDefaultPlanProjectId(projId);
    const matched = planProjects.find(p => p.id === projId);
    if (matched) {
      handleSelectDefaultCategory(matched.category);
    }
  };

  const applyPlanProjectToAllRows = () => {
    const matched = planProjects.find(p => p.id === defaultPlanProjectId);
    setParsedTasks(prev => prev.map(t => ({
      ...t,
      planProjectId: defaultPlanProjectId || undefined,
      category: matched && (!t.category || t.category === 'General') ? matched.category : t.category
    })));
  };

  const applyCategoryAndSubToAllRows = () => {
    setParsedTasks(prev => prev.map(t => ({
      ...t,
      category: defaultCategory,
      subCategory: defaultSubCategory || undefined
    })));
  };

  const applyBufferToAllRows = () => {
    setParsedTasks(prev => prev.map(t => ({
      ...t,
      bufferMinutes: defaultBufferMinutes
    })));
  };

  const applyRecurrenceToAllRows = () => {
    setParsedTasks(prev => prev.map(t => ({
      ...t,
      recurrence: defaultRecurrence
    })));
  };

  const applyLockToAllRows = () => {
    setParsedTasks(prev => prev.map(t => ({
      ...t,
      isMandatorySchedule: defaultIsMandatory
    })));
  };

  const applyAllDefaultsToAllRows = () => {
    let currentSequenceMinutes = parse12HourToMinutes(sequenceStartTime || '09:00 AM');
    let lastCalculatedDate = defaultDate;

    setParsedTasks(prev => prev.map((t, idx) => {
      let taskDate = defaultDate;
      if (dateMode === 'spread') {
        const offset = Math.floor(idx / Math.max(1, tasksPerDay));
        taskDate = addDaysToDate(defaultDate, offset);
      }

      if (taskDate !== lastCalculatedDate) {
        currentSequenceMinutes = parse12HourToMinutes(sequenceStartTime || '09:00 AM');
        lastCalculatedDate = taskDate;
      }

      let startTime = '09:00 AM';
      let endTime = '10:00 AM';
      let hasNoTime = false;

      if (timeMode === 'anytime') {
        startTime = 'Anytime';
        endTime = 'Anytime';
        hasNoTime = true;
      } else if (timeMode === 'sequence') {
        startTime = formatMinutesTo12Hour(currentSequenceMinutes);
        endTime = formatMinutesTo12Hour(currentSequenceMinutes + defaultDuration);
        currentSequenceMinutes = (currentSequenceMinutes + defaultDuration) % 1440;
      } else {
        startTime = sequenceStartTime || '09:00 AM';
        endTime = addMinutesToTime(startTime, defaultDuration);
      }

      return {
        ...t,
        taskDate,
        startTime,
        endTime,
        hasNoTime,
        appointedMinutes: defaultDuration,
        priority: defaultPriority,
        category: defaultCategory,
        subCategory: defaultSubCategory || undefined,
        bufferMinutes: defaultBufferMinutes,
        recurrence: defaultRecurrence,
        isMandatorySchedule: defaultIsMandatory,
        planProjectId: defaultPlanProjectId || undefined
      };
    }));
  };

  // Inline editing in preview table
  const handleUpdateTaskField = (index: number, field: keyof BatchTaskItem, value: any) => {
    setParsedTasks(prev => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

      if (field === 'category') {
        const catObj = categories.find(c => c.name.toLowerCase() === String(value).toLowerCase());
        if (catObj && catObj.subCategories && catObj.subCategories.length > 0) {
          if (!catObj.subCategories.includes(target.subCategory || '')) {
            target.subCategory = catObj.subCategories[0];
          }
        } else {
          target.subCategory = '';
        }
      }

      if (field === 'appointedMinutes' && !target.hasNoTime && target.startTime !== 'Anytime') {
        target.endTime = addMinutesToTime(target.startTime, Number(value) || 30);
      }
      if (field === 'startTime' && !target.hasNoTime && value !== 'Anytime') {
        target.endTime = addMinutesToTime(value, target.appointedMinutes);
      }

      updated[index] = target;
      return updated;
    });
  };

  const handleRemoveTask = (index: number) => {
    setParsedTasks(prev => prev.filter((_, i) => i !== index));
    if (expandedNotesRowIndex === index) {
      setExpandedNotesRowIndex(null);
    }
  };

  const handleAddEmptyRow = () => {
    const nextStart = parsedTasks.length > 0 && !parsedTasks[parsedTasks.length - 1].hasNoTime
      ? parsedTasks[parsedTasks.length - 1].endTime
      : sequenceStartTime;

    const newTask: BatchTaskItem = {
      title: 'New Task',
      description: '',
      notes: '',
      priority: defaultPriority,
      appointedMinutes: defaultDuration,
      category: defaultCategory,
      subCategory: defaultSubCategory || undefined,
      taskDate: defaultDate,
      startTime: timeMode === 'anytime' ? 'Anytime' : nextStart,
      endTime: timeMode === 'anytime' ? 'Anytime' : addMinutesToTime(nextStart, defaultDuration),
      bufferMinutes: defaultBufferMinutes,
      recurrence: defaultRecurrence,
      isMandatorySchedule: defaultIsMandatory,
      status: 'Pending',
      hasNoTime: timeMode === 'anytime',
      planProjectId: defaultPlanProjectId || undefined
    };
    setParsedTasks(prev => [...prev, newTask]);
  };

  // Commit and add tasks to system
  const handleCommitTasks = async () => {
    if (parsedTasks.length === 0) {
      setStatusBanner({ type: 'error', message: 'No tasks to import. Please add or upload some tasks.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const tasksToCreate = parsedTasks.map(t => ({
        title: t.title.trim() || 'Untitled Task',
        description: t.description || '',
        notes: t.notes || '',
        priority: t.priority,
        category: t.category,
        subCategory: t.subCategory || '',
        appointedMinutes: t.appointedMinutes,
        taskDate: t.taskDate,
        startTime: t.startTime,
        endTime: t.endTime,
        status: t.status || 'Pending',
        hasNoTime: t.hasNoTime,
        bufferMinutes: t.bufferMinutes !== undefined ? t.bufferMinutes : defaultBufferMinutes,
        recurrence: t.recurrence || defaultRecurrence || 'None',
        isMandatorySchedule: t.isMandatorySchedule !== undefined ? t.isMandatorySchedule : defaultIsMandatory,
        planProjectId: t.planProjectId || undefined
      }));

      const created = addBatchTasks(tasksToCreate);

      setStatusBanner({
        type: 'success',
        message: `Successfully created ${created.length} tasks!`
      });

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('Batch add error:', err);
      setStatusBanner({
        type: 'error',
        message: `Failed to create tasks: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalAppointedMins = parsedTasks.reduce((acc, t) => acc + (t.appointedMinutes || 0), 0);

  // Group Plan/Projects
  const projectsList = planProjects.filter(p => p.type === 'project');
  const plansList = planProjects.filter(p => p.type === 'plan');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/60 backdrop-blur-md overflow-hidden animate-fade-in">
      <div 
        className="relative w-full sm:max-w-5xl md:max-w-6xl h-[92vh] sm:h-auto sm:max-h-[92vh] flex flex-col rounded-t-[32px] sm:rounded-3xl bg-theme-card border border-theme-border shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Apple Mobile Sheet Grab Handle */}
        <div className="w-12 h-1.5 rounded-full bg-black/20 dark:bg-white/20 mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 border-b border-theme-border bg-theme-card-hover/40 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20 ring-1 ring-white/20 shrink-0">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-black tracking-tight text-theme-text font-display">
                Batch Task Importer
              </h2>
              <p className="text-[11px] sm:text-xs text-theme-muted hidden sm:block">
                Fast multi-task import with Date scheduling, Plan / Project binding, and auto-detection
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-theme-muted hover:text-theme-text hover:bg-theme-card-hover transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Apple Segmented Control Tab Switcher */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-theme-border bg-theme-bg/60 shrink-0 flex-wrap gap-2">
          <div className="bg-black/[0.06] dark:bg-white/[0.08] p-1 rounded-2xl flex items-center gap-1 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('text')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'text'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-black/[0.04] dark:ring-white/[0.08]'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Multi-Line Text</span>
            </button>

            <button
              onClick={() => setActiveTab('file')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'file'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs ring-1 ring-black/[0.04] dark:ring-white/[0.08]'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel & CSV Upload</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => downloadBatchTemplate('xlsx', defaultDate)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
              title="Download Microsoft Excel Sample Template"
            >
              <Download className="w-3 h-3" />
              <span>Excel Template</span>
            </button>

            <button
              type="button"
              onClick={() => downloadBatchTemplate('csv', defaultDate)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition-all cursor-pointer"
              title="Download CSV Sample Template"
            >
              <Download className="w-3 h-3" />
              <span>CSV Template</span>
            </button>
          </div>
        </div>

        {/* Global Batch Defaults Bar: Structured in 2 High-Density Apple/SaaS Panels */}
        <div className="px-4 sm:px-6 py-2.5 bg-theme-card-hover/40 border-b border-theme-border space-y-2 text-xs shrink-0 max-h-56 sm:max-h-none overflow-y-auto sm:overflow-visible">
          
          {/* Row 1: Date Scheduling & Plan/Project/Category Hierarchy */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-2.5 items-stretch">
            
            {/* Date Configuration Block */}
            <div className="lg:col-span-5 bg-theme-card p-2 sm:p-2.5 rounded-2xl border border-theme-border/80 shadow-2xs space-y-1.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider flex items-center gap-1 font-display">
                  <Calendar className="w-3 h-3 text-blue-500" />
                  <span>Date Scheduling</span>
                </label>

                {/* Quick Date Pills */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQuickDate('today')}
                    className="px-2 py-0.5 rounded-lg bg-theme-card-hover hover:bg-blue-500/10 hover:text-blue-500 text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate('tomorrow')}
                    className="px-2 py-0.5 rounded-lg bg-theme-card-hover hover:bg-blue-500/10 hover:text-blue-500 text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate('nextMon')}
                    className="px-2 py-0.5 rounded-lg bg-theme-card-hover hover:bg-blue-500/10 hover:text-blue-500 text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    Next Mon
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 items-center">
                <input
                  type="date"
                  value={defaultDate}
                  onChange={(e) => setDefaultDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-theme-bg border border-theme-border text-theme-text text-xs focus:ring-1 focus:ring-blue-500 font-medium"
                />

                <div className="flex items-center gap-1">
                  <select
                    value={dateMode === 'same' ? 'same' : `spread-${tasksPerDay}`}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'same') {
                        setDateMode('same');
                      } else {
                        setDateMode('spread');
                        setTasksPerDay(parseInt(val.replace('spread-', ''), 10) || 1);
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded-xl bg-theme-bg border border-theme-border text-theme-text text-xs focus:ring-1 focus:ring-blue-500 font-semibold"
                  >
                    <option value="same">All on Same Date</option>
                    <option value="spread-1">Daily (1 task / day)</option>
                    <option value="spread-2">Daily (2 tasks / day)</option>
                    <option value="spread-3">Daily (3 tasks / day)</option>
                  </select>

                  <button
                    type="button"
                    onClick={applyDateToAllRows}
                    title="Apply current date settings to all preview rows"
                    className="p-1.5 rounded-xl border border-theme-border bg-theme-card-hover hover:bg-theme-border text-theme-muted hover:text-theme-text transition-colors shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Plan / Project & Category Hierarchy Block */}
            <div className="lg:col-span-7 bg-theme-card p-2 sm:p-2.5 rounded-2xl border border-theme-border/80 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-wider flex items-center gap-1 font-display">
                  <Folder className="w-3 h-3 text-indigo-500" />
                  <span>Hierarchy: Plan / Project & Categories</span>
                </label>

                <div className="flex items-center gap-2">
                  {defaultPlanProjectId && (
                    <button
                      type="button"
                      onClick={applyPlanProjectToAllRows}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      title="Apply this Plan / Project to all rows"
                    >
                      Sync Project
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={applyCategoryAndSubToAllRows}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    title="Apply Category & Sub-Category to all rows"
                  >
                    Sync Cat & Sub
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                {/* Project Select */}
                <select
                  value={defaultPlanProjectId}
                  onChange={(e) => handleSelectDefaultProject(e.target.value)}
                  className={`w-full px-2 py-1.5 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 font-semibold transition-all ${
                    defaultPlanProjectId
                      ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'bg-theme-bg border-theme-border text-theme-text'
                  }`}
                >
                  <option value="">No Plan / Project</option>
                  {projectsList.length > 0 && (
                    <optgroup label="📂 Projects">
                      {projectsList.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.code} • {p.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {plansList.length > 0 && (
                    <optgroup label="📋 Plans">
                      {plansList.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.code} • {p.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {/* Category Select */}
                <select
                  value={defaultCategory}
                  onChange={(e) => handleSelectDefaultCategory(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-xl bg-theme-bg border border-theme-border text-theme-text text-xs focus:ring-1 focus:ring-blue-500 font-bold"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="General">General</option>
                </select>

                {/* Sub-Category Select or Input */}
                {availableSubCategories.length > 0 ? (
                  <select
                    value={defaultSubCategory}
                    onChange={(e) => setDefaultSubCategory(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-xl bg-theme-bg border border-theme-border text-theme-text text-xs focus:ring-1 focus:ring-blue-500 font-semibold"
                  >
                    <option value="">No Sub-Category</option>
                    {availableSubCategories.map((sub, sIdx) => (
                      <option key={sIdx} value={sub}>{sub}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={defaultSubCategory}
                    onChange={(e) => setDefaultSubCategory(e.target.value)}
                    placeholder="Sub-Category (Optional)"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-theme-bg border border-theme-border text-theme-text text-xs focus:ring-1 focus:ring-blue-500 placeholder-theme-muted"
                  />
                )}
              </div>

              {/* Quick Sub-Category Pills */}
              {availableSubCategories.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                  <span className="text-[9px] text-theme-muted font-bold shrink-0">Sub:</span>
                  {availableSubCategories.map((sub, sIdx) => {
                    const isSelected = defaultSubCategory === sub;
                    return (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => setDefaultSubCategory(isSelected ? '' : sub)}
                        className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold transition-all border shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-theme-bg text-theme-muted border-theme-border hover:text-theme-text'
                        }`}
                      >
                        {sub}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Row 2: Priority, Duration, Buffer, Recurrence, Time Mode & Slot, Lock Schedule */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2 items-end">
            
            {/* Priority */}
            <div>
              <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-0.5">
                Priority
              </label>
              <select
                value={defaultPriority}
                onChange={(e) => setDefaultPriority(e.target.value as PriorityLevel)}
                className="w-full px-2 py-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-text text-xs focus:ring-1 focus:ring-blue-500 font-bold"
              >
                <option value="P1">P1 - Critical</option>
                <option value="P2">P2 - High</option>
                <option value="P3">P3 - Medium</option>
                <option value="P4">P4 - Low</option>
                <option value="P5">P5 - Noise</option>
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-0.5">
                Duration
              </label>
              <select
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-text text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value={15}>15m</option>
                <option value={30}>30m</option>
                <option value={45}>45m</option>
                <option value={60}>60m (1h)</option>
                <option value={90}>90m (1.5h)</option>
                <option value={120}>120m (2h)</option>
              </select>
            </div>

            {/* Buffer Cushion */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider">
                  Buffer
                </label>
                <button
                  type="button"
                  onClick={applyBufferToAllRows}
                  className="text-[9px] font-bold text-blue-500 hover:underline cursor-pointer"
                  title="Apply buffer to all rows"
                >
                  All
                </button>
              </div>
              <select
                value={defaultBufferMinutes}
                onChange={(e) => setDefaultBufferMinutes(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-text text-xs focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value={0}>0m (None)</option>
                <option value={5}>+5m Buffer</option>
                <option value={10}>+10m Buffer</option>
                <option value={15}>+15m Buffer</option>
                <option value={20}>+20m Buffer</option>
                <option value={30}>+30m Buffer</option>
              </select>
            </div>

            {/* Recurrence Engine */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider">
                  Repeat
                </label>
                <button
                  type="button"
                  onClick={applyRecurrenceToAllRows}
                  className="text-[9px] font-bold text-blue-500 hover:underline cursor-pointer"
                  title="Apply recurrence to all rows"
                >
                  All
                </button>
              </div>
              <select
                value={defaultRecurrence}
                onChange={(e) => setDefaultRecurrence(e.target.value as RecurrenceType)}
                className="w-full px-2 py-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-text text-xs focus:ring-1 focus:ring-blue-500 font-semibold"
              >
                <option value="None">None</option>
                <option value="Daily">Daily</option>
                <option value="Selected Days">Weekdays</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>

            {/* Time Mode */}
            <div>
              <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-0.5">
                Time Mode
              </label>
              <select
                value={timeMode}
                onChange={(e) => setTimeMode(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-text text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="sequence">Auto-Sequence</option>
                <option value="anytime">Anytime / Floating</option>
                <option value="fixed">Fixed Single Slot</option>
              </select>
            </div>

            {/* Slot Time */}
            <div>
              <label className="block text-[10px] font-bold text-theme-muted uppercase tracking-wider mb-0.5">
                {timeMode === 'sequence' ? 'Sequence Start' : 'Slot Time'}
              </label>
              <input
                type="text"
                disabled={timeMode === 'anytime'}
                value={timeMode === 'anytime' ? 'Anytime' : sequenceStartTime}
                onChange={(e) => setSequenceStartTime(e.target.value)}
                placeholder="09:00 AM"
                className="w-full px-2 py-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-text text-xs focus:ring-1 focus:ring-blue-500 disabled:opacity-50 font-mono"
              />
            </div>

            {/* Lock Schedule & Master Sync */}
            <div className="flex items-center gap-1.5 col-span-2 sm:col-span-2 lg:col-span-1">
              <button
                type="button"
                onClick={() => setDefaultIsMandatory(!defaultIsMandatory)}
                title="Lock Schedule: Protected from auto-shifts and auto-rescheduling"
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  defaultIsMandatory
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-2xs'
                    : 'bg-theme-card border-theme-border text-theme-muted hover:text-theme-text'
                }`}
              >
                {defaultIsMandatory ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span className="truncate">{defaultIsMandatory ? 'Locked' : 'Flex'}</span>
              </button>

              <button
                type="button"
                onClick={applyAllDefaultsToAllRows}
                title="Apply all default settings above to all current parsed rows"
                className="p-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-xs cursor-pointer shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 space-y-4">
          
          {/* Status Message Notification */}
          {statusBanner && (
            <div className={`p-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-slide-up ${
              statusBanner.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {statusBanner.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <span>{statusBanner.message}</span>
              </div>
              <button onClick={() => setStatusBanner(null)} className="p-1 hover:opacity-75">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Tab 1: Multi-line text input */}
          {activeTab === 'text' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-theme-text flex items-center gap-1.5">
                  <span>Paste Tasks List</span>
                  <span className="text-theme-muted font-normal text-[11px]">
                    ({rawText.split('\n').filter(l => l.trim()).length} tasks detected)
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowSyntaxGuide(!showSyntaxGuide)}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer text-xs"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showSyntaxGuide ? 'Hide Format Guide' : 'Formatting Guide'}</span>
                </button>
              </div>

              {showSyntaxGuide && (
                <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs space-y-1.5 text-theme-text animate-fade-in">
                  <div className="font-bold text-blue-700 dark:text-blue-300">Industry-Standard Supported Formats:</div>
                  <ul className="list-disc list-inside space-y-1 text-theme-muted font-mono text-[11px]">
                    <li><strong className="text-theme-text font-sans">Plain Lines:</strong> Write task titles line-by-line. All batch defaults configured above apply automatically.</li>
                    <li><strong className="text-theme-text font-sans">Delimited:</strong> <code>Title | Priority | Duration | Category / SubCategory | Date | StartTime | Buffer | Recurrence | ProjectCode</code></li>
                    <li><strong className="text-theme-text font-sans">Category / Sub:</strong> E.g. <code>Engineering / Core Engine</code> or <code>Personal / Health</code> sets both category and subcategory seamlessly.</li>
                    <li><strong className="text-theme-text font-sans">Buffer & Recurrence:</strong> Add <code>+15m</code> or <code>Daily</code> / <code>Weekly</code> anywhere in delimited line.</li>
                    <li><strong className="text-theme-text font-sans">Bullets:</strong> <code>- [ ] Task Title</code> or <code>1. Task Title</code> strip bullets automatically.</li>
                  </ul>
                </div>
              )}

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={4}
                placeholder={`Build Login UI | P1 | 60m | Engineering / Core Engine | 2026-09-24 | 10:00 AM | PRJ-VRTX | +15m\nTeam Sync | P2 | 30m | Meetings | | 02:00 PM | Weekly\nDraft Report`}
                className="w-full p-3 rounded-2xl bg-theme-bg border border-theme-border font-mono text-xs text-theme-text placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-y shadow-inner"
              />
            </div>
          )}

          {/* Tab 2: Excel & CSV File Upload */}
          {activeTab === 'file' && (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-theme-border hover:border-blue-500 rounded-3xl p-5 sm:p-6 text-center cursor-pointer transition-all bg-theme-card-hover/20 hover:bg-theme-card-hover/60 group"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                  <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="text-xs sm:text-sm font-black text-theme-text">
                  {uploadedFile ? uploadedFile.name : 'Tap to select or drag & drop Excel / CSV file'}
                </div>
                <div className="text-[11px] text-theme-muted mt-0.5">
                  Supports Excel (.xlsx, .xls) and CSV. Includes Sub-Category, Buffer, Recurrence & Plan / Project auto-detection.
                </div>
                {uploadedFile && (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>File Loaded ({Math.round(uploadedFile.size / 1024)} KB)</span>
                  </div>
                )}
              </div>

              {fileError && (
                <div className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}
            </div>
          )}

          {/* Live Preview Header & Mobile View Switcher */}
          <div className="pt-2 border-t border-theme-border">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-theme-text uppercase tracking-wider flex items-center gap-1.5 font-display">
                  <span>Tasks Preview</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-mono font-bold">
                    {parsedTasks.length}
                  </span>
                </h3>

                {totalAppointedMins > 0 && (
                  <span className="text-[11px] sm:text-xs text-theme-muted font-medium">
                    • <strong className="text-theme-text">{formatDurationHuman(totalAppointedMins)}</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={applyAllDefaultsToAllRows}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-bold transition-all cursor-pointer"
                  title="Apply current batch defaults to all rows"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync Defaults</span>
                </button>

                {/* Mobile View Toggle (Cards vs Table) */}
                <div className="flex items-center bg-theme-card-hover p-0.5 rounded-xl border border-theme-border">
                  <button
                    type="button"
                    onClick={() => setPreviewViewMode('cards')}
                    className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                      previewViewMode === 'cards'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-theme-muted hover:text-theme-text'
                    }`}
                    title="Mobile Card View"
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewMode('table')}
                    className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                      previewViewMode === 'table'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-theme-muted hover:text-theme-text'
                    }`}
                    title="Full Data Table View"
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddEmptyRow}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-theme-card-hover hover:bg-theme-border text-xs font-bold text-theme-text transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add Row</span>
                </button>
              </div>
            </div>

            {/* Empty State */}
            {parsedTasks.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-theme-border bg-theme-card-hover/20 text-xs text-theme-muted">
                No tasks parsed yet. Paste some text lines above or upload a spreadsheet.
              </div>
            ) : previewViewMode === 'cards' ? (
              
              /* --- MOBILE TASK CARDS VIEW --- */
              <div className="space-y-2.5 max-h-72 overflow-y-auto no-scrollbar pr-0.5">
                {parsedTasks.map((t, idx) => {
                  const cardCatObj = categories.find(c => c.name.toLowerCase() === (t.category || '').toLowerCase());
                  const cardSubCats = cardCatObj?.subCategories || [];
                  const isExpanded = expandedNotesRowIndex === idx;

                  return (
                    <div 
                      key={idx}
                      className="p-3 rounded-2xl bg-theme-card border border-theme-border shadow-2xs space-y-2 hover:border-blue-500/40 transition-all"
                    >
                      {/* Card Top: Index, Priority, Schedule Lock, Delete */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-theme-card-hover text-theme-muted font-mono font-bold text-[10px] flex items-center justify-center">
                            {idx + 1}
                          </span>

                          {/* Priority Selector */}
                          <select
                            value={t.priority}
                            onChange={(e) => handleUpdateTaskField(idx, 'priority', e.target.value as PriorityLevel)}
                            className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold focus:outline-none ${
                              t.priority === 'P1'
                                ? 'bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400'
                                : t.priority === 'P2'
                                ? 'bg-orange-500/15 border-orange-500/30 text-orange-600 dark:text-orange-400'
                                : t.priority === 'P3'
                                ? 'bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400'
                                : t.priority === 'P4'
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-500/15 border-slate-500/30 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <option value="P1">P1 Critical</option>
                            <option value="P2">P2 High</option>
                            <option value="P3">P3 Medium</option>
                            <option value="P4">P4 Low</option>
                            <option value="P5">P5 Noise</option>
                          </select>

                          {/* Lock Schedule Toggle */}
                          <button
                            type="button"
                            onClick={() => handleUpdateTaskField(idx, 'isMandatorySchedule', !t.isMandatorySchedule)}
                            title={t.isMandatorySchedule ? 'Schedule Locked' : 'Schedule Flexible'}
                            className={`p-1 rounded-lg border transition-colors ${
                              t.isMandatorySchedule
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                : 'bg-theme-bg/60 border-theme-border text-theme-muted hover:text-theme-text'
                            }`}
                          >
                            {t.isMandatorySchedule ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setExpandedNotesRowIndex(isExpanded ? null : idx)}
                            className={`p-1 rounded-lg border text-xs transition-colors ${
                              isExpanded || t.notes || t.description
                                ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                                : 'bg-theme-bg/60 border-theme-border text-theme-muted hover:text-theme-text'
                            }`}
                            title="Edit Description & Notes"
                          >
                            <FileText className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveTask(idx)}
                            className="p-1 rounded-lg text-theme-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Title Input */}
                      <input
                        type="text"
                        value={t.title}
                        onChange={(e) => handleUpdateTaskField(idx, 'title', e.target.value)}
                        placeholder="Task Title..."
                        className="w-full px-2.5 py-1.5 rounded-xl bg-theme-bg/80 border border-theme-border text-xs text-theme-text font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />

                      {/* Card Row 1: Plan/Project & Category & SubCategory */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs">
                        {/* Plan / Project */}
                        <select
                          value={t.planProjectId || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const matched = planProjects.find(p => p.id === selectedId);
                            handleUpdateTaskField(idx, 'planProjectId', selectedId || undefined);
                            if (matched && (!t.category || t.category === 'General')) {
                              handleUpdateTaskField(idx, 'category', matched.category);
                            }
                          }}
                          className={`px-2 py-1 rounded-xl border text-[11px] transition-colors focus:outline-none ${
                            t.planProjectId
                              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold'
                              : 'bg-theme-bg/80 border-theme-border text-theme-muted'
                          }`}
                        >
                          <option value="">No Project</option>
                          {projectsList.map(p => (
                            <option key={p.id} value={p.id}>{p.code} • {p.title}</option>
                          ))}
                          {plansList.map(p => (
                            <option key={p.id} value={p.id}>{p.code} • {p.title}</option>
                          ))}
                        </select>

                        {/* Category */}
                        <select
                          value={t.category}
                          onChange={(e) => handleUpdateTaskField(idx, 'category', e.target.value)}
                          className="px-2 py-1 rounded-xl bg-theme-bg/80 border border-theme-border text-[11px] text-theme-text focus:outline-none font-bold"
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                          <option value="General">General</option>
                        </select>

                        {/* SubCategory */}
                        {cardSubCats.length > 0 ? (
                          <select
                            value={t.subCategory || ''}
                            onChange={(e) => handleUpdateTaskField(idx, 'subCategory', e.target.value)}
                            className="px-2 py-1 rounded-xl bg-theme-bg/80 border border-theme-border text-[11px] text-theme-text focus:outline-none font-medium"
                          >
                            <option value="">No Sub-Category</option>
                            {cardSubCats.map((sub, sIdx) => (
                              <option key={sIdx} value={sub}>{sub}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={t.subCategory || ''}
                            onChange={(e) => handleUpdateTaskField(idx, 'subCategory', e.target.value)}
                            placeholder="Sub-Category"
                            className="px-2 py-1 rounded-xl bg-theme-bg/80 border border-theme-border text-[11px] text-theme-text focus:outline-none"
                          />
                        )}
                      </div>

                      {/* Card Row 2: Date, Time, Duration, Buffer, Recurrence */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
                        {/* Date */}
                        <input
                          type="date"
                          value={t.taskDate}
                          onChange={(e) => handleUpdateTaskField(idx, 'taskDate', e.target.value)}
                          className="px-2 py-1 rounded-xl bg-theme-bg/80 border border-theme-border text-[11px] text-theme-text focus:outline-none font-medium"
                        />

                        {/* Start Time */}
                        <input
                          type="text"
                          value={t.startTime}
                          onChange={(e) => handleUpdateTaskField(idx, 'startTime', e.target.value)}
                          placeholder="09:00 AM"
                          className="px-1.5 py-1 rounded-xl bg-theme-bg/80 border border-theme-border text-[11px] text-theme-text font-mono focus:outline-none"
                        />

                        {/* Duration */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={5}
                            step={5}
                            value={t.appointedMinutes}
                            onChange={(e) => handleUpdateTaskField(idx, 'appointedMinutes', Number(e.target.value))}
                            className="w-full px-1.5 py-1 rounded-xl bg-theme-bg/80 border border-theme-border text-[11px] text-theme-text font-mono text-center focus:outline-none"
                            title="Duration in minutes"
                          />
                          <span className="text-[10px] text-theme-muted">m</span>
                        </div>

                        {/* Buffer */}
                        <select
                          value={t.bufferMinutes ?? 0}
                          onChange={(e) => handleUpdateTaskField(idx, 'bufferMinutes', Number(e.target.value))}
                          className="px-1.5 py-1 rounded-xl bg-theme-bg/80 border border-theme-border text-[11px] text-theme-text focus:outline-none font-medium"
                          title="Buffer cushion"
                        >
                          <option value={0}>0m Buf</option>
                          <option value={5}>+5m Buf</option>
                          <option value={10}>+10m Buf</option>
                          <option value={15}>+15m Buf</option>
                          <option value={20}>+20m Buf</option>
                          <option value={30}>+30m Buf</option>
                        </select>

                        {/* Recurrence */}
                        <select
                          value={t.recurrence || 'None'}
                          onChange={(e) => handleUpdateTaskField(idx, 'recurrence', e.target.value as RecurrenceType)}
                          className="px-1.5 py-1 rounded-xl bg-theme-bg/80 border border-theme-border text-[11px] text-theme-text focus:outline-none font-medium"
                          title="Recurrence frequency"
                        >
                          <option value="None">None</option>
                          <option value="Daily">Daily</option>
                          <option value="Selected Days">Weekdays</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Yearly">Yearly</option>
                        </select>
                      </div>

                      {/* Expandable Notes & Description drawer */}
                      {isExpanded && (
                        <div className="p-2.5 rounded-xl bg-theme-bg/90 border border-theme-border/80 space-y-1.5 animate-fade-in">
                          <input
                            type="text"
                            value={t.description || ''}
                            onChange={(e) => handleUpdateTaskField(idx, 'description', e.target.value)}
                            placeholder="Detailed task description..."
                            className="w-full px-2 py-1 rounded-lg bg-theme-card border border-theme-border text-xs text-theme-text focus:outline-none"
                          />
                          <input
                            type="text"
                            value={t.notes || ''}
                            onChange={(e) => handleUpdateTaskField(idx, 'notes', e.target.value)}
                            placeholder="Execution notes or key findings..."
                            className="w-full px-2 py-1 rounded-lg bg-theme-card border border-theme-border text-xs text-theme-text focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            ) : (

              /* --- FULL TABLE VIEW --- */
              <div className="rounded-2xl border border-theme-border overflow-hidden bg-theme-card shadow-xs">
                <div className="overflow-x-auto max-h-72 no-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-theme-card-hover/95 backdrop-blur-xs text-theme-muted uppercase text-[10px] font-black tracking-wider border-b border-theme-border z-10 font-display">
                      <tr>
                        <th className="py-2.5 px-2.5 w-8">#</th>
                        <th className="py-2.5 px-2.5 min-w-[180px]">Task Title & Notes</th>
                        <th className="py-2.5 px-2 w-20">Priority</th>
                        <th className="py-2.5 px-2 min-w-[130px]">Plan / Project</th>
                        <th className="py-2.5 px-2 w-24">Category</th>
                        <th className="py-2.5 px-2 w-28">Sub-Category</th>
                        <th className="py-2.5 px-2 w-28">Date</th>
                        <th className="py-2.5 px-2 w-22">Time</th>
                        <th className="py-2.5 px-1.5 w-16">Min</th>
                        <th className="py-2.5 px-1.5 w-18">Buffer</th>
                        <th className="py-2.5 px-2 w-22">Repeat</th>
                        <th className="py-2.5 px-1.5 text-center w-10">Lock</th>
                        <th className="py-2.5 px-1.5 text-center w-10">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border">
                      {parsedTasks.map((t, idx) => {
                        const rowCatObj = categories.find(c => c.name.toLowerCase() === (t.category || '').toLowerCase());
                        const rowSubCats = rowCatObj?.subCategories || [];
                        const isExpanded = expandedNotesRowIndex === idx;

                        return (
                          <React.Fragment key={idx}>
                            <tr className="hover:bg-theme-card-hover/40 transition-colors">
                              <td className="py-2 px-2.5 text-theme-muted font-mono text-[11px]">{idx + 1}</td>
                              
                              {/* Title + Note trigger */}
                              <td className="py-2 px-2.5">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={t.title}
                                    onChange={(e) => handleUpdateTaskField(idx, 'title', e.target.value)}
                                    className="w-full px-2 py-1 rounded-lg bg-theme-bg/80 border border-theme-border text-xs text-theme-text font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setExpandedNotesRowIndex(isExpanded ? null : idx)}
                                    className={`p-1 rounded-lg border transition-colors shrink-0 ${
                                      isExpanded || t.notes || t.description
                                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400'
                                        : 'bg-theme-bg border-theme-border text-theme-muted hover:text-theme-text'
                                    }`}
                                    title="Toggle Description & Notes"
                                  >
                                    <FileText className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>

                              {/* Priority */}
                              <td className="py-2 px-2">
                                <select
                                  value={t.priority}
                                  onChange={(e) => handleUpdateTaskField(idx, 'priority', e.target.value as PriorityLevel)}
                                  className={`w-full px-1.5 py-1 rounded-lg border text-xs font-bold focus:outline-none ${
                                    t.priority === 'P1'
                                      ? 'bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400'
                                      : t.priority === 'P2'
                                      ? 'bg-orange-500/15 border-orange-500/30 text-orange-600 dark:text-orange-400'
                                      : t.priority === 'P3'
                                      ? 'bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400'
                                      : t.priority === 'P4'
                                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-slate-500/15 border-slate-500/30 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  <option value="P1">P1</option>
                                  <option value="P2">P2</option>
                                  <option value="P3">P3</option>
                                  <option value="P4">P4</option>
                                  <option value="P5">P5</option>
                                </select>
                              </td>

                              {/* Plan / Project */}
                              <td className="py-2 px-2">
                                <select
                                  value={t.planProjectId || ''}
                                  onChange={(e) => {
                                    const selectedId = e.target.value;
                                    const matched = planProjects.find(p => p.id === selectedId);
                                    handleUpdateTaskField(idx, 'planProjectId', selectedId || undefined);
                                    if (matched && (!t.category || t.category === 'General')) {
                                      handleUpdateTaskField(idx, 'category', matched.category);
                                    }
                                  }}
                                  className={`w-full px-2 py-1 rounded-lg border text-xs transition-colors focus:outline-none ${
                                    t.planProjectId
                                      ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold'
                                      : 'bg-theme-bg/80 border-theme-border text-theme-muted'
                                  }`}
                                >
                                  <option value="">None</option>
                                  {projectsList.map(p => (
                                    <option key={p.id} value={p.id}>{p.code} • {p.title}</option>
                                  ))}
                                  {plansList.map(p => (
                                    <option key={p.id} value={p.id}>{p.code} • {p.title}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Category */}
                              <td className="py-2 px-2">
                                <select
                                  value={t.category}
                                  onChange={(e) => handleUpdateTaskField(idx, 'category', e.target.value)}
                                  className="w-full px-1.5 py-1 rounded-lg bg-theme-bg/80 border border-theme-border text-xs text-theme-text font-bold focus:outline-none"
                                >
                                  {categories.map(c => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                  ))}
                                  <option value="General">General</option>
                                </select>
                              </td>

                              {/* Sub-Category */}
                              <td className="py-2 px-2">
                                {rowSubCats.length > 0 ? (
                                  <select
                                    value={t.subCategory || ''}
                                    onChange={(e) => handleUpdateTaskField(idx, 'subCategory', e.target.value)}
                                    className="w-full px-1.5 py-1 rounded-lg bg-theme-bg/80 border border-theme-border text-xs text-theme-text focus:outline-none"
                                  >
                                    <option value="">None</option>
                                    {rowSubCats.map((sub, sIdx) => (
                                      <option key={sIdx} value={sub}>{sub}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={t.subCategory || ''}
                                    onChange={(e) => handleUpdateTaskField(idx, 'subCategory', e.target.value)}
                                    placeholder="None"
                                    className="w-full px-1.5 py-1 rounded-lg bg-theme-bg/80 border border-theme-border text-xs text-theme-text focus:outline-none"
                                  />
                                )}
                              </td>

                              {/* Date */}
                              <td className="py-2 px-2">
                                <input
                                  type="date"
                                  value={t.taskDate}
                                  onChange={(e) => handleUpdateTaskField(idx, 'taskDate', e.target.value)}
                                  className="w-full px-1.5 py-1 rounded-lg bg-theme-bg/80 border border-theme-border text-xs text-theme-text focus:outline-none font-medium"
                                />
                              </td>

                              {/* Start Time */}
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={t.startTime}
                                  onChange={(e) => handleUpdateTaskField(idx, 'startTime', e.target.value)}
                                  placeholder="09:00 AM"
                                  className="w-full px-1.5 py-1 rounded-lg bg-theme-bg/80 border border-theme-border text-xs text-theme-text font-mono focus:outline-none"
                                />
                              </td>

                              {/* Appointed Minutes */}
                              <td className="py-2 px-1.5">
                                <input
                                  type="number"
                                  min={5}
                                  step={5}
                                  value={t.appointedMinutes}
                                  onChange={(e) => handleUpdateTaskField(idx, 'appointedMinutes', Number(e.target.value))}
                                  className="w-full px-1 py-1 rounded-lg bg-theme-bg/80 border border-theme-border text-xs text-theme-text font-mono text-center focus:outline-none"
                                />
                              </td>

                              {/* Buffer Minutes */}
                              <td className="py-2 px-1.5">
                                <select
                                  value={t.bufferMinutes ?? 0}
                                  onChange={(e) => handleUpdateTaskField(idx, 'bufferMinutes', Number(e.target.value))}
                                  className="w-full px-1 py-1 rounded-lg bg-theme-bg/80 border border-theme-border text-xs text-theme-text font-medium focus:outline-none"
                                >
                                  <option value={0}>0m</option>
                                  <option value={5}>+5m</option>
                                  <option value={10}>+10m</option>
                                  <option value={15}>+15m</option>
                                  <option value={20}>+20m</option>
                                  <option value={30}>+30m</option>
                                </select>
                              </td>

                              {/* Recurrence */}
                              <td className="py-2 px-2">
                                <select
                                  value={t.recurrence || 'None'}
                                  onChange={(e) => handleUpdateTaskField(idx, 'recurrence', e.target.value as RecurrenceType)}
                                  className="w-full px-1 py-1 rounded-lg bg-theme-bg/80 border border-theme-border text-xs text-theme-text font-medium focus:outline-none"
                                >
                                  <option value="None">None</option>
                                  <option value="Daily">Daily</option>
                                  <option value="Selected Days">Wkday</option>
                                  <option value="Weekly">Weekly</option>
                                  <option value="Monthly">Monthly</option>
                                  <option value="Yearly">Yearly</option>
                                </select>
                              </td>

                              {/* Lock Schedule */}
                              <td className="py-2 px-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTaskField(idx, 'isMandatorySchedule', !t.isMandatorySchedule)}
                                  title={t.isMandatorySchedule ? 'Schedule Locked: Irreplaceable & protected' : 'Schedule Flexible'}
                                  className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                                    t.isMandatorySchedule
                                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                      : 'bg-theme-bg border-theme-border text-theme-muted hover:text-theme-text'
                                  }`}
                                >
                                  {t.isMandatorySchedule ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                </button>
                              </td>

                              {/* Delete */}
                              <td className="py-2 px-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTask(idx)}
                                  className="p-1 rounded-lg hover:bg-red-500/10 text-theme-muted hover:text-red-500 transition-colors cursor-pointer"
                                  title="Delete row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>

                            {/* Inline Expandable Drawer for Description & Notes */}
                            {isExpanded && (
                              <tr className="bg-theme-card-hover/20">
                                <td colSpan={13} className="px-4 py-2 border-b border-theme-border">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <label className="block text-[10px] font-bold text-theme-muted mb-0.5">
                                        Description
                                      </label>
                                      <input
                                        type="text"
                                        value={t.description || ''}
                                        onChange={(e) => handleUpdateTaskField(idx, 'description', e.target.value)}
                                        placeholder="Add task description..."
                                        className="w-full px-2.5 py-1 rounded-lg bg-theme-bg border border-theme-border text-xs text-theme-text focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-theme-muted mb-0.5">
                                        Notes & Findings
                                      </label>
                                      <input
                                        type="text"
                                        value={t.notes || ''}
                                        onChange={(e) => handleUpdateTaskField(idx, 'notes', e.target.value)}
                                        placeholder="Add notes, reminders, or findings..."
                                        className="w-full px-2.5 py-1 rounded-lg bg-theme-bg border border-theme-border text-xs text-theme-text focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer Controls (Apple Cupertino Safe Padding) */}
        <div className="px-4 sm:px-6 py-3 border-t border-theme-border bg-theme-card-hover/40 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="hidden sm:flex items-center gap-2 text-xs text-theme-muted">
            <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
            <span>Tasks enter schedule automatically with unique project codes.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-xl border border-theme-border hover:bg-theme-card-hover text-theme-text transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={parsedTasks.length === 0 || isSubmitting}
              onClick={handleCommitTasks}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/30 hover:shadow-lg hover:shadow-blue-600/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Layers className="w-4 h-4" />
              <span>{isSubmitting ? 'Importing...' : `Import ${parsedTasks.length} ${parsedTasks.length === 1 ? 'Task' : 'Tasks'}`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
