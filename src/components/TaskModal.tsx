import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Task, 
  PriorityLevel, 
  TaskStatus, 
  RecurrenceType, 
  TaskLink, 
  SubTask 
} from '../types';
import { 
  generateProjectCode, 
  addMinutesToTime, 
  diffTimeInMinutes, 
  toISODateString, 
  getDayOfWeekFromDate,
  getCurrentRoundedTime12Hour,
  SHORT_DAYS,
  getSmartNextFreeSlot,
  getRecommendedDayFreeSlots,
  RecommendedSlot,
  isTimeInSleepWindow
} from '../utils/timeUtils';
import { ConflictModal } from './ConflictModal';
import { TimePicker } from './TimePicker';
import { 
  X, 
  Clock, 
  Calendar, 
  Tag, 
  Folder, 
  Layers, 
  Link as LinkIcon, 
  Plus, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  CornerDownRight,
  Lock,
  Zap,
  RotateCcw,
  Repeat,
  Moon
} from 'lucide-react';

interface TaskModalProps {
  taskToEdit?: Task | null;
  initialDate?: string;
  initialStartTime?: string;
  initialProjectCode?: string;
  initialCategory?: string;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  taskToEdit,
  initialDate,
  initialStartTime,
  initialProjectCode,
  initialCategory,
  onClose
}) => {
  const { 
    tasks,
    categories, 
    capacitySettings,
    prioritySettings, 
    defaultTaskSettings,
    planProjects,
    bufferNotes,
    addTask, 
    updateTask, 
    detectConflicts, 
    cascadeShiftDownstream,
    linkSimultaneousTasks 
  } = useApp();

  const isEditing = !!taskToEdit;

  // Task Presets from Admin Settings
  const taskDefaults = defaultTaskSettings || {
    defaultPriority: 'P1',
    defaultCategory: categories[0]?.name || 'VRTX',
    defaultBufferMinutes: capacitySettings.defaultBufferMinutes || 15,
    defaultSmartSlot: 'auto-fit',
    defaultIsMandatory: false,
    autoConfirmDefaults: true
  };

  // Form State
  const [projectCode, setProjectCode] = useState(
    taskToEdit?.projectCode || initialProjectCode || generateProjectCode()
  );
  const [title, setTitle] = useState(taskToEdit?.title || '');
  const [description, setDescription] = useState(taskToEdit?.description || '');
  const [taskDate, setTaskDate] = useState(taskToEdit?.taskDate || initialDate || toISODateString(new Date()));
  const [priority, setPriority] = useState<PriorityLevel>(
    taskToEdit?.priority || taskDefaults.defaultPriority || 'P1'
  );
  const [category, setCategory] = useState(
    taskToEdit?.category || initialCategory || taskDefaults.defaultCategory || 'Unknown'
  );
  const [subCategory, setSubCategory] = useState(taskToEdit?.subCategory || '');
  
  // Mandatory Manual Confirmation tracking (auto-confirmed if Fast-Add mode is enabled)
  const [hasConfirmedPriority, setHasConfirmedPriority] = useState<boolean>(
    isEditing || Boolean(taskDefaults.autoConfirmDefaults)
  );
  const [hasConfirmedCategory, setHasConfirmedCategory] = useState<boolean>(
    isEditing || !!initialCategory || Boolean(taskDefaults.autoConfirmDefaults)
  );
  
  // Mandatory Schedule (Fixed/Locked non-reschedulable time slot)
  const [isMandatorySchedule, setIsMandatorySchedule] = useState<boolean>(
    taskToEdit?.isMandatorySchedule ?? (taskDefaults.defaultIsMandatory || false)
  );
  
  // Simultaneous execution option (Co-working / Parallel Slot)
  const [isSimultaneous, setIsSimultaneous] = useState<boolean>(
    Boolean(taskToEdit?.simultaneousWithIds && taskToEdit.simultaneousWithIds.length > 0)
  );

  // Plan / Project Folder Grouping
  const [planProjectId, setPlanProjectId] = useState<string | undefined>(taskToEdit?.planProjectId);
  
  const defaultMin = prioritySettings[taskToEdit?.priority || taskDefaults.defaultPriority || 'P1']?.defaultMinutes ?? 90;
  const [appointedMinutes, setAppointedMinutes] = useState<number>(
    taskToEdit?.appointedMinutes ?? (taskDefaults.defaultAppointedMinutes || defaultMin)
  );
  const [bufferMinutes, setBufferMinutes] = useState<number>(
    taskToEdit?.bufferMinutes !== undefined 
      ? taskToEdit.bufferMinutes 
      : (taskDefaults.defaultBufferMinutes ?? (capacitySettings.defaultBufferMinutes || 15))
  );
  
  // Smart Next Free Slot Computation on Creation
  const initialSmartSlot = useMemo(() => {
    if (taskToEdit) {
      return { startTime: taskToEdit.startTime, endTime: taskToEdit.endTime };
    }
    if (initialStartTime) {
      return { startTime: initialStartTime, endTime: addMinutesToTime(initialStartTime, defaultMin) };
    }
    
    const strategy = taskDefaults.defaultSmartSlot || 'auto-fit';
    if (strategy === 'current-time') {
      const roundedNow = getCurrentRoundedTime12Hour(5);
      return { startTime: roundedNow, endTime: addMinutesToTime(roundedNow, defaultMin) };
    }
    if (strategy === 'work-start') {
      const workStart = capacitySettings.dayStartTime || '06:00 AM';
      return { startTime: workStart, endTime: addMinutesToTime(workStart, defaultMin) };
    }

    return getSmartNextFreeSlot(initialDate || toISODateString(new Date()), defaultMin, tasks, bufferNotes, undefined, capacitySettings.defaultBufferMinutes || 15);
  }, [taskToEdit, initialStartTime, initialDate, defaultMin, tasks, bufferNotes, capacitySettings.defaultBufferMinutes, capacitySettings.dayStartTime, taskDefaults.defaultSmartSlot]);

  const [startTime, setStartTime] = useState<string>(initialSmartSlot.startTime);
  const [endTime, setEndTime] = useState<string>(initialSmartSlot.endTime);
  
  const [status, setStatus] = useState<TaskStatus>(taskToEdit?.status || 'Pending');
  const [recurrence, setRecurrence] = useState<RecurrenceType>(taskToEdit?.recurrence || 'None');
  const [selectedDays, setSelectedDays] = useState<string[]>(taskToEdit?.selectedDays || []);
  const [recurringEditScope, setRecurringEditScope] = useState<'single' | 'series'>('single');
  const [notes, setNotes] = useState(taskToEdit?.notes || '');
  const [links, setLinks] = useState<TaskLink[]>(taskToEdit?.links || []);
  const [subtasks, setSubtasks] = useState<SubTask[]>(taskToEdit?.subtasks || []);

  // Link Input fields
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  
  // Subtask Input fields
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskMinutes, setNewSubtaskMinutes] = useState<number>(30);
  
  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);

  // Conflict state
  const [conflictingTasks, setConflictingTasks] = useState<Task[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Auto calculate day of week
  const dayOfWeek = getDayOfWeekFromDate(taskDate);

  // Recommended candidate free slots across the day
  const recommendedSlots = useMemo(() => {
    return getRecommendedDayFreeSlots(taskDate, appointedMinutes, tasks, bufferNotes, taskToEdit?.id, 4, capacitySettings.defaultBufferMinutes || 15);
  }, [taskDate, appointedMinutes, tasks, bufferNotes, taskToEdit?.id, capacitySettings.defaultBufferMinutes]);

  // Live Overlap / Conflict Intelligence calculation
  const liveOverlaps = useMemo(() => {
    return detectConflicts(taskDate, startTime, endTime, taskToEdit?.id);
  }, [taskDate, startTime, endTime, taskToEdit?.id, detectConflicts]);

  // Sleep / Night Window Conflict Calculation & Warning
  const sleepWindowWarning = useMemo(() => {
    const sleepStart = capacitySettings?.sleepStartTime || capacitySettings?.dayEndTime || '11:00 PM';
    const sleepEnd = capacitySettings?.sleepEndTime || capacitySettings?.dayStartTime || '06:00 AM';
    const inSleep = isTimeInSleepWindow(startTime, endTime, sleepStart, sleepEnd);
    return {
      inSleep,
      sleepStart,
      sleepEnd
    };
  }, [startTime, endTime, capacitySettings]);

  // Update subcategories when category changes
  const currentCategoryObj = categories.find(c => c.name === category);
  useEffect(() => {
    if (currentCategoryObj && currentCategoryObj.subCategories.length > 0 && !subCategory) {
      setSubCategory(currentCategoryObj.subCategories[0]);
    }
  }, [category, currentCategoryObj, subCategory]);

  // When priority changes via manual click
  const handlePriorityChange = (newPriority: PriorityLevel) => {
    setPriority(newPriority);
    setHasConfirmedPriority(true);
    setValidationError(null);
    const newMinutes = prioritySettings[newPriority]?.defaultMinutes ?? 60;
    setAppointedMinutes(newMinutes);
    setEndTime(addMinutesToTime(startTime, newMinutes));
  };

  // Quick-fill all auto presets
  const handleQuickFillAutoPresets = () => {
    setPriority('P1');
    setHasConfirmedPriority(true);
    const cat = categories[0]?.name || 'VRTX';
    setCategory(cat);
    setHasConfirmedCategory(true);
    const catObj = categories.find(c => c.name === cat);
    setSubCategory(catObj?.subCategories[0] || '');
    setValidationError(null);
  };

  // When start time changes, recompute end time
  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    setValidationError(null);
    setEndTime(addMinutesToTime(newStart, appointedMinutes));
  };

  // When appointed minutes changes, recompute end time
  const handleMinutesChange = (newMins: number) => {
    setAppointedMinutes(newMins);
    setValidationError(null);
    setEndTime(addMinutesToTime(startTime, newMins));
  };

  // Add Link
  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return;
    const newLink: TaskLink = {
      id: `lnk-${Date.now()}`,
      title: newLinkTitle.trim() || newLinkUrl.trim(),
      url: newLinkUrl.trim(),
      type: 'url'
    };
    setLinks([...links, newLink]);
    setNewLinkTitle('');
    setNewLinkUrl('');
  };

  // Remove Link
  const handleRemoveLink = (linkId: string) => {
    setLinks(links.filter(l => l.id !== linkId));
  };

  // Add Subtask
  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSub: SubTask = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      isCompleted: false,
      depthLevel: 1,
      assignedTimeMin: newSubtaskMinutes,
      subtasks: []
    };
    setSubtasks([...subtasks, newSub]);
    setNewSubtaskTitle('');
  };

  // Toggle Day Selection for Recurrence
  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // Submission with mandatory parameters validation & conflict detection
  const handleSave = (forceNoConflictCheck = false) => {
    if (!title.trim()) {
      setValidationError('Task Title is mandatory. Please enter a title.');
      return;
    }
    if (!hasConfirmedPriority && !taskDefaults.autoConfirmDefaults) {
      setValidationError('Please manually click your Priority level (P1-P5) to confirm urgency & duration.');
      return;
    }
    if (!taskDate) {
      setValidationError('Task Date is mandatory. Please select a date.');
      return;
    }
    if (!startTime) {
      setValidationError('Task Time is mandatory. Please select a start time.');
      return;
    }
    setValidationError(null);

    // Auto-choose Unknown if category is not selected
    const effectiveCategory = (category && category.trim()) ? category.trim() : 'Unknown';

    if (!forceNoConflictCheck && !isSimultaneous) {
      const conflicts = detectConflicts(taskDate, startTime, endTime, taskToEdit?.id);
      if (conflicts.length > 0) {
        setConflictingTasks(conflicts);
        setShowConflictModal(true);
        return;
      }
    }

    const payload = {
      projectCode: projectCode.trim() || generateProjectCode(),
      title: title.trim(),
      description: description.trim(),
      taskDate,
      dayOfWeek,
      priority,
      category: effectiveCategory,
      subCategory,
      appointedMinutes,
      startTime,
      endTime,
      status,
      bufferMinutes,
      recurrence,
      selectedDays: recurrence === 'Selected Days' ? selectedDays : [],
      isMandatorySchedule,
      simultaneousWithIds: isSimultaneous ? liveOverlaps.map(t => t.id) : [],
      planProjectId: planProjectId || undefined,
      notes,
      links,
      subtasks
    };

    if (isEditing && taskToEdit) {
      if (taskToEdit.recurrence && taskToEdit.recurrence !== 'None' && recurringEditScope === 'single') {
        // Exclude today/this occurrence from master series so future recurring stays fit on original time
        const targetDate = initialDate || taskToEdit.taskDate || taskDate;
        const existingExclusions = taskToEdit.excludedDates || [];
        const updatedExclusions = existingExclusions.includes(targetDate)
          ? existingExclusions
          : [...existingExclusions, targetDate];

        updateTask({
          ...taskToEdit,
          excludedDates: updatedExclusions
        });

        // Create standalone single occurrence with the updated time / details
        addTask({
          ...payload,
          recurrence: 'None',
          selectedDays: []
        });
      } else {
        updateTask({
          ...taskToEdit,
          ...payload
        });
      }
    } else {
      addTask(payload);
    }

    onClose();
  };

  // Resolve conflict via Auto-Shift (Places after work time + break time)
  const handleResolveWithAutoShift = (newCalculatedStartTime: string) => {
    const newEnd = addMinutesToTime(newCalculatedStartTime, appointedMinutes);
    // Cascade shift any downstream tasks starting at or after the new start time forward
    const autoBuffer = capacitySettings.defaultBufferMinutes || 15;
    cascadeShiftDownstream(taskDate, newCalculatedStartTime, appointedMinutes + autoBuffer, taskToEdit?.id);
    setShowConflictModal(false);
    setStartTime(newCalculatedStartTime);
    setEndTime(newEnd);

    const payload = {
      projectCode: projectCode.trim() || generateProjectCode(),
      title: title.trim(),
      description: description.trim(),
      taskDate,
      dayOfWeek,
      priority,
      category,
      subCategory,
      appointedMinutes,
      startTime: newCalculatedStartTime,
      endTime: newEnd,
      status,
      bufferMinutes: taskToEdit?.bufferMinutes ?? autoBuffer,
      recurrence,
      selectedDays: recurrence === 'Selected Days' ? selectedDays : [],
      isMandatorySchedule,
      simultaneousWithIds: [],
      planProjectId: planProjectId || undefined,
      notes,
      links,
      subtasks
    };

    if (isEditing && taskToEdit) {
      updateTask({
        ...taskToEdit,
        ...payload
      });
    } else {
      addTask(payload);
    }

    onClose();
  };

  // Resolve conflict by enabling Simultaneous mode
  const handleResolveWithSimultaneous = () => {
    setIsSimultaneous(true);
    setShowConflictModal(false);

    const payload = {
      projectCode: projectCode.trim() || generateProjectCode(),
      title: title.trim(),
      description: description.trim(),
      taskDate,
      dayOfWeek,
      priority,
      category,
      subCategory,
      appointedMinutes,
      startTime,
      endTime,
      status,
      bufferMinutes: 15,
      recurrence,
      selectedDays: recurrence === 'Selected Days' ? selectedDays : [],
      isMandatorySchedule,
      simultaneousWithIds: conflictingTasks.map(t => t.id),
      planProjectId: planProjectId || undefined,
      notes,
      links,
      subtasks
    };

    if (isEditing && taskToEdit) {
      updateTask({
        ...taskToEdit,
        ...payload
      });
    } else {
      addTask(payload);
    }

    onClose();
  };

  // Resolve conflict by selecting candidate slot
  const handleResolveWithSelectedSlot = (chosenStart: string) => {
    const chosenEnd = addMinutesToTime(chosenStart, appointedMinutes);
    setShowConflictModal(false);
    setStartTime(chosenStart);
    setEndTime(chosenEnd);

    const payload = {
      projectCode: projectCode.trim() || generateProjectCode(),
      title: title.trim(),
      description: description.trim(),
      taskDate,
      dayOfWeek,
      priority,
      category,
      subCategory,
      appointedMinutes,
      startTime: chosenStart,
      endTime: chosenEnd,
      status,
      bufferMinutes: 15,
      recurrence,
      selectedDays: recurrence === 'Selected Days' ? selectedDays : [],
      isMandatorySchedule,
      simultaneousWithIds: [],
      planProjectId: planProjectId || undefined,
      notes,
      links,
      subtasks
    };

    if (isEditing && taskToEdit) {
      updateTask({
        ...taskToEdit,
        ...payload
      });
    } else {
      addTask(payload);
    }

    onClose();
  };

  const priorityMeta = prioritySettings[priority];

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
        <div className="bg-theme-card border border-theme-border rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-8 animate-slide-up">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-theme-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-theme-text">
                  {isEditing ? 'Edit Task Matrix' : 'Create New Scheduled Task'}
                </h2>
                <div className="flex items-center gap-2 text-xs text-theme-muted">
                  <span>Code:</span>
                  <input
                    type="text"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-transparent border-b border-dashed border-blue-400 focus:outline-none text-xs w-32"
                    title="Unique Project Code (Custom Editable)"
                  />
                  <span>• {dayOfWeek}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-theme-card-hover text-theme-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            
            {/* Validation Error Banner */}
            {validationError && (
              <div className="p-3 rounded-xl bg-red-100/80 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2 animate-shake shadow-sm">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Mandatory Setup Checklist Summary Banner */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-theme-card dark:from-blue-950/50 dark:via-sky-950/30 dark:to-theme-card border border-blue-200 dark:border-blue-800/80 shadow-inner">
              <div className="text-[11px] font-bold text-theme-muted uppercase tracking-wider mb-2 flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-1.5 text-theme-text font-black">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  Mandatory Task Pillars Checklist:
                </span>
                
                <button
                  type="button"
                  onClick={handleQuickFillAutoPresets}
                  className="text-[10px] font-black px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-1 active:scale-95"
                  title="Auto-fill with P1, Today & default Category"
                >
                  <Sparkles className="w-3 h-3" />
                  Auto-Fill All Presets
                </button>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                {/* 1. Priority */}
                <div className={`p-2 rounded-lg border transition-all ${
                  hasConfirmedPriority
                    ? 'bg-theme-card border-emerald-500/50 dark:border-emerald-500/40 shadow-sm'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700 animate-pulse'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${hasConfirmedPriority ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <div className="truncate">
                      <div className="text-[9px] text-theme-muted font-bold">1. Priority</div>
                      <div className={`font-black truncate ${hasConfirmedPriority ? 'text-theme-text' : 'text-amber-600 dark:text-amber-400'}`}>
                        {hasConfirmedPriority ? `${priority} (${priorityMeta?.defaultMinutes}m)` : '👉 Click Priority'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Category */}
                <div className={`p-2 rounded-lg border transition-all ${
                  hasConfirmedCategory
                    ? 'bg-theme-card border-emerald-500/50 dark:border-emerald-500/40 shadow-sm'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700 animate-pulse'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${hasConfirmedCategory ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <div className="truncate">
                      <div className="text-[9px] text-theme-muted font-bold">2. Category</div>
                      <div className={`font-black truncate ${hasConfirmedCategory ? 'text-theme-text' : 'text-amber-600 dark:text-amber-400'}`}>
                        {hasConfirmedCategory ? category : '👉 Click Category'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Date */}
                <div className="p-2 rounded-lg bg-theme-card border border-theme-border flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <div className="truncate">
                    <div className="text-[9px] text-theme-muted font-bold">3. Date</div>
                    <div className="font-mono font-bold text-theme-text truncate">{taskDate}</div>
                  </div>
                </div>

                {/* 4. Time */}
                <div className="p-2 rounded-lg bg-theme-card border border-theme-border flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <div className="truncate">
                    <div className="text-[9px] text-theme-muted font-bold">4. Start Time</div>
                    <div className="font-mono font-bold text-theme-text truncate">{startTime} ({appointedMinutes}m)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Task Title with Main Category on Left & Budget Duration on Right */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* Left Side: Task Title Label & Main Category */}
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1 font-display">
                    <span>Task Title</span>
                    <span className="text-red-500 font-black">*</span>
                  </label>
                  
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-blue-100/90 dark:bg-blue-950/80 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-bold text-xs shadow-2xs">
                    <Folder className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-[10px] text-theme-muted uppercase font-semibold">Category:</span>
                    <span className="font-black text-theme-text font-mono text-xs">{category || 'VRTX'}</span>
                  </div>
                </div>

                {/* Right Side: Budget Duration & Time Slot */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800/80 text-amber-800 dark:text-amber-200 text-xs font-bold font-mono shadow-2xs">
                    <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Budget Duration:</span>
                    <span className="font-black text-amber-950 dark:text-amber-100">
                      {appointedMinutes}m {appointedMinutes >= 60 ? `(${Math.floor(appointedMinutes / 60)}h${appointedMinutes % 60 ? ` ${appointedMinutes % 60}m` : ''})` : ''}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-theme-muted font-bold">
                    ({startTime} → {endTime})
                  </span>
                </div>
              </div>

              {/* Title Input Field */}
              <input
                type="text"
                placeholder="e.g. OptimusLAB Unified Architecture Audit..."
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                className={`w-full text-sm px-3.5 py-2.5 rounded-xl bg-theme-card-hover border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold shadow-2xs ${
                  validationError && !title.trim() ? 'border-red-500 ring-1 ring-red-500' : 'border-theme-border'
                }`}
                autoFocus
              />
            </div>

            {/* Recurring Task Edit Scope Switcher (When Editing a Recurring Task) */}
            {isEditing && taskToEdit?.recurrence && taskToEdit.recurrence !== 'None' && (
              <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 font-display">
                    <Repeat className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Recurring Scope Protection</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100">
                    Rule: {taskToEdit.recurrence}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecurringEditScope('single')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      recurringEditScope === 'single'
                        ? 'bg-white dark:bg-slate-900 border-indigo-600 ring-2 ring-indigo-500/40 shadow-xs'
                        : 'bg-theme-card/60 border-theme-border opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="font-bold text-theme-text text-xs flex items-center gap-1">
                      <span>📅 Only Today / This Slot</span>
                    </div>
                    <div className="text-[10px] text-theme-muted mt-0.5 leading-tight">
                      Next recurring stays fit at original schedule.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecurringEditScope('series')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      recurringEditScope === 'series'
                        ? 'bg-white dark:bg-slate-900 border-indigo-600 ring-2 ring-indigo-500/40 shadow-xs'
                        : 'bg-theme-card/60 border-theme-border opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="font-bold text-theme-text text-xs flex items-center gap-1">
                      <span>🔄 All Future Occurrences</span>
                    </div>
                    <div className="text-[10px] text-theme-muted mt-0.5 leading-tight">
                      Updates the master rule for all future days.
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Category & SubCategory (Moved UP: Small, compact & fast clicking) */}
            <div className="space-y-1.5 p-2.5 rounded-xl bg-theme-card-hover border border-theme-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-blue-500" />
                  <span>Category Selection</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                    hasConfirmedCategory
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {hasConfirmedCategory ? '✓ Confirmed' : '* Click to Confirm'}
                  </span>
                </label>
              </div>

              {/* Fast-Click Category Pills (Compact) */}
              <div className="flex flex-wrap gap-1">
                {categories.map((c) => {
                  const isCatSelected = category === c.name && hasConfirmedCategory;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCategory(c.name);
                        setHasConfirmedCategory(true);
                        if (validationError) setValidationError(null);
                        const catObj = categories.find(cat => cat.name === c.name);
                        setSubCategory(catObj?.subCategories[0] || '');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 transform active:scale-95 cursor-pointer ${
                        isCatSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-1 ring-blue-500/20'
                          : 'bg-theme-card text-theme-muted hover:text-theme-text border-theme-border hover:border-blue-400'
                      }`}
                    >
                      <Tag className="w-2.5 h-2.5" />
                      <span>{c.name}</span>
                    </button>
                  );
                })}

                {/* Explicit Unknown Category Pill */}
                <button
                  type="button"
                  onClick={() => {
                    setCategory('Unknown');
                    setHasConfirmedCategory(true);
                    setSubCategory('');
                    if (validationError) setValidationError(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 transform active:scale-95 cursor-pointer ${
                    category === 'Unknown'
                      ? 'bg-slate-700 text-white border-slate-700 shadow-sm ring-1 ring-slate-500/30'
                      : 'bg-theme-card text-theme-muted hover:text-theme-text border-theme-border hover:border-slate-400'
                  }`}
                >
                  <Tag className="w-2.5 h-2.5 opacity-60" />
                  <span>Unknown</span>
                </button>
              </div>

              {/* SubCategory Selection (Small & Fast) */}
              {currentCategoryObj && currentCategoryObj.subCategories.length > 0 && (
                <div className="pt-1.5 border-t border-theme-border/50">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-theme-muted shrink-0">Sub:</span>
                    {currentCategoryObj.subCategories.map((sub, idx) => {
                      const isSubSelected = subCategory === sub;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSubCategory(sub)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all border ${
                            isSubSelected
                              ? 'bg-theme-card-hover border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                              : 'bg-theme-card text-theme-muted border-theme-border hover:text-theme-text'
                          }`}
                        >
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Priority Level Protocol (Left) + Duration Box (Right) */}
            <div className="p-3 rounded-2xl bg-theme-card-hover border border-theme-border space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                
                {/* Left Side: Priority Level Buttons (P1-P5) */}
                <div className="md:col-span-7 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                      <span>Priority (P1-P5)</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                        hasConfirmedPriority
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {hasConfirmedPriority ? '✓ Confirmed Preset' : '* Click to Confirm'}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { p: 'P1' as PriorityLevel, shortLabel: 'Must Do' },
                      { p: 'P2' as PriorityLevel, shortLabel: 'High ROI' },
                      { p: 'P3' as PriorityLevel, shortLabel: 'Delegate' },
                      { p: 'P4' as PriorityLevel, shortLabel: 'Optional' },
                      { p: 'P5' as PriorityLevel, shortLabel: 'Filter' }
                    ].map(({ p, shortLabel }) => {
                      const meta = prioritySettings[p];
                      const isSelected = priority === p;
                      const isDefault = taskDefaults.defaultPriority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handlePriorityChange(p)}
                          className={`py-1.5 px-1 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 transform active:scale-95 shadow-2xs cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 shadow-sm ring-2 ring-blue-500/30 font-black scale-[1.02]'
                              : !hasConfirmedPriority
                                ? 'border-dashed border-theme-border hover:border-blue-400 hover:bg-theme-card'
                                : 'border-theme-border hover:bg-theme-card opacity-85 hover:opacity-100'
                          }`}
                          style={{
                            backgroundColor: isSelected ? meta.bgColor : undefined,
                            borderColor: isSelected ? meta.color : undefined
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-black tracking-tight" style={{ color: meta.color }}>
                              {p}
                            </span>
                            {isDefault && (
                              <span className="text-[8px] text-amber-500 font-bold" title="Admin Default Preset">★</span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-theme-text leading-tight truncate w-full">
                            {shortLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Side: Duration Box & Quick Pills */}
                <div className="md:col-span-5 space-y-1.5 md:pl-3 md:border-l border-theme-border/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Duration</span>
                    </label>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-theme-card border border-theme-border text-theme-muted font-mono font-bold">
                      End: {endTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Number input */}
                    <div className="relative w-24 shrink-0">
                      <input
                        type="number"
                        min="5"
                        step="5"
                        value={appointedMinutes}
                        onChange={(e) => handleMinutesChange(parseInt(e.target.value, 10) || 0)}
                        className="w-full text-xs pr-6 pl-2.5 py-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-text font-mono font-black text-center focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                        placeholder="60"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-theme-muted font-bold pointer-events-none">
                        m
                      </span>
                    </div>

                    {/* Quick Duration Preset Pills */}
                    <div className="flex items-center gap-1 flex-wrap flex-1">
                      {[15, 30, 45, 60, 90, 120].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleMinutesChange(m)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all border shadow-2xs ${
                            appointedMinutes === m
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-1 ring-blue-400'
                              : 'bg-theme-card text-theme-muted hover:text-theme-text border-theme-border hover:border-blue-400 hover:bg-theme-card-hover'
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Description & Custom Writing */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-theme-text uppercase tracking-wider">
                Description & Custom Writing
              </label>
              <textarea
                rows={2}
                placeholder="Detailed objectives, expected outcomes, or context..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs px-3.5 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Plan / Project Folder Assignment (Task Group) */}
            <div className="space-y-1.5 p-3 rounded-xl bg-theme-card-hover border border-theme-border">
              <label className="text-[11px] font-bold text-theme-text flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-500" />
                  <span>Plan / Project Folder (Optional Grouping)</span>
                </span>
                {planProjectId && (
                  <button
                    type="button"
                    onClick={() => setPlanProjectId(undefined)}
                    className="text-[10px] text-red-500 hover:underline font-normal"
                  >
                    Clear Assignment
                  </button>
                )}
              </label>

              <select
                value={planProjectId || ''}
                onChange={(e) => setPlanProjectId(e.target.value || undefined)}
                className="w-full text-xs px-3 py-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-text font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- No Plan / Project (Stand-alone Task) --</option>
                {planProjects.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.type === 'plan' ? '🎯 [PLAN]' : '💼 [PROJECT]'} {folder.code} • {folder.title} (Deadline: {folder.endDate})
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Time Settings */}
            <div className="space-y-2 p-3.5 rounded-xl bg-theme-card-hover border border-theme-border">
              {/* Quick Date Click Buttons & Auto Free Slot Button */}
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-theme-text flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span>Scheduled Date & Time *</span>
                </label>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setTaskDate(toISODateString(new Date()));
                      if (validationError) setValidationError(null);
                    }}
                    className={`px-2 py-0.5 rounded font-bold border transition-colors ${
                      taskDate === toISODateString(new Date())
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-theme-card text-theme-muted border-theme-border'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      setTaskDate(toISODateString(tomorrow));
                      if (validationError) setValidationError(null);
                    }}
                    className="px-2 py-0.5 rounded font-bold bg-theme-card text-theme-muted border border-theme-border hover:text-theme-text transition-colors"
                  >
                    Tomorrow
                  </button>
                </div>
              </div>

              {/* Recommended Free Time Slot Chips Tray */}
              <div className="space-y-1.5 p-2 rounded-xl bg-theme-card border border-theme-border/70">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-theme-muted flex items-center gap-1 font-sans">
                    <Sparkles className="w-3 h-3 text-blue-500" />
                    <span>Free Time Slots on {taskDate}:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const smart = getSmartNextFreeSlot(taskDate, appointedMinutes, tasks, bufferNotes, taskToEdit?.id, capacitySettings.defaultBufferMinutes || 15);
                      setStartTime(smart.startTime);
                      setEndTime(smart.endTime);
                      setValidationError(null);
                    }}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    title="Auto-calculate next non-overlapping free slot"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Auto-Fit Next Free Slot</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {recommendedSlots.map((slot, idx) => {
                    const isSelected = startTime === slot.startTime;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setStartTime(slot.startTime);
                          setEndTime(slot.endTime);
                          setValidationError(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border flex items-center gap-1 shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-theme-card-hover text-theme-muted hover:text-theme-text border-theme-border hover:border-blue-400'
                        }`}
                      >
                        <span>{slot.label}</span>
                        <span className="font-mono text-[9px] opacity-80">({slot.startTime} - {slot.endTime})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Slot Conflict / Synchronized Status Banner */}
              {liveOverlaps.length > 0 && (
                <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn ${
                  isSimultaneous
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200'
                    : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                }`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isSimultaneous ? (
                      <Zap className="w-4 h-4 text-purple-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 animate-pulse" />
                    )}
                    <span className="truncate text-[11px]">
                      {isSimultaneous
                        ? `🔀 Co-running simultaneously with [${liveOverlaps[0].projectCode}] "${liveOverlaps[0].title}" (${liveOverlaps[0].startTime} - ${liveOverlaps[0].endTime})`
                        : `🚨 Time Overlap with [${liveOverlaps[0].projectCode}] "${liveOverlaps[0].title}" (${liveOverlaps[0].startTime} - ${liveOverlaps[0].endTime}). Enable Simultaneous Mode or pick a Free Slot.`
                      }
                    </span>
                  </div>

                  {!isSimultaneous && (
                    <button
                      type="button"
                      onClick={() => {
                        const smart = getSmartNextFreeSlot(taskDate, appointedMinutes, tasks, bufferNotes, taskToEdit?.id, capacitySettings.defaultBufferMinutes || 15);
                        setStartTime(smart.startTime);
                        setEndTime(smart.endTime);
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shrink-0 shadow-xs whitespace-nowrap"
                    >
                      Pick Free Slot
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <input
                    type="date"
                    value={taskDate}
                    onChange={(e) => {
                      setTaskDate(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    className="w-full text-xs px-2.5 py-2 rounded-lg bg-theme-card border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <TimePicker
                    label="Start Time (12h Clock)"
                    value={startTime}
                    onChange={handleStartTimeChange}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-theme-text flex items-center justify-between mb-1">
                    <span>Duration (Min)</span>
                    <span className="text-[10px] text-theme-muted font-mono">End: {endTime}</span>
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={appointedMinutes}
                    onChange={(e) => handleMinutesChange(parseInt(e.target.value, 10) || 0)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-theme-card border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Automated Post-Task Buffer Time Selector */}
              <div className="space-y-1.5 pt-1 p-3 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider text-[10px] flex items-center gap-1 font-display">
                    <span>🟣 Automated Post-Task Break Buffer</span>
                  </span>
                  <span className="font-mono text-[11px] font-bold text-purple-700 dark:text-purple-300">
                    {bufferMinutes} min {bufferMinutes === (capacitySettings.defaultBufferMinutes || 15) ? '(Admin Default)' : '(Custom Override)'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[0, 5, 10, 15, 20, 30, 45].map((bMin) => {
                    const isSelected = bufferMinutes === bMin;
                    const isDefault = bMin === (capacitySettings.defaultBufferMinutes || 15);
                    return (
                      <button
                        key={bMin}
                        type="button"
                        onClick={() => setBufferMinutes(bMin)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-theme-card text-theme-muted hover:text-theme-text border-theme-border hover:border-purple-400'
                        }`}
                      >
                        <span>{bMin === 0 ? '0m (None)' : `${bMin}m`}</span>
                        {isDefault && <span className="text-[9px] opacity-85 font-mono">★Default</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sleep / Night Window Conflict Warning & Avoidance Action */}
              {sleepWindowWarning.inSleep && (
                <div className="p-3 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 text-xs space-y-2 animate-fadeIn shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-indigo-200 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 shrink-0 mt-0.5">
                      <Moon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-black text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5">
                          <span>🌙 Sleep Time Conflict Warning</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 font-mono font-bold">
                            {sleepWindowWarning.sleepStart} → {sleepWindowWarning.sleepEnd}
                          </span>
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-slate-100 dark:bg-slate-950 dark:text-indigo-300 border border-indigo-700/50">
                          Dark Night Theme Enabled
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-800 dark:text-indigo-300 mt-1">
                        This task is scheduled at <strong className="font-mono">{startTime} - {endTime}</strong>, which overlaps with your designated Sleep & Recovery Protocol. Working during sleep hours compromises circadian recovery.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-1 border-t border-indigo-200 dark:border-indigo-900/60 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const newStart = sleepWindowWarning.sleepEnd;
                        const newEnd = addMinutesToTime(newStart, appointedMinutes);
                        setStartTime(newStart);
                        setEndTime(newEnd);
                        if (validationError) setValidationError(null);
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-yellow-300" />
                      <span>Avoid Sleep Time: Auto-Shift to Morning ({sleepWindowWarning.sleepEnd})</span>
                    </button>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium italic">
                      Or proceed to save with dark night-shift theme
                    </span>
                  </div>
                </div>
              )}

              {/* Mandatory Schedule Checkbox & Irreplaceable Lock */}
              <div className={`mt-3 p-3 rounded-xl border transition-all ${
                isMandatorySchedule
                  ? 'bg-amber-500/10 border-amber-500/50 dark:border-amber-400/40 shadow-sm ring-1 ring-amber-500/30'
                  : 'bg-theme-card border-theme-border/80 hover:border-theme-border'
              }`}>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      checked={isMandatorySchedule}
                      onChange={(e) => setIsMandatorySchedule(e.target.checked)}
                      className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-theme-text flex items-center gap-1.5 font-display">
                        <Lock className={`w-3.5 h-3.5 ${isMandatorySchedule ? 'text-amber-600 dark:text-amber-400' : 'text-theme-muted'}`} />
                        Mandatory Schedule (Fixed Time Protocol)
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isMandatorySchedule
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800 font-mono'
                          : 'bg-theme-card-hover text-theme-muted border border-theme-border font-mono'
                      }`}>
                        {isMandatorySchedule ? '🔒 Locked • Irreplaceable' : 'Flexible / Shiftable'}
                      </span>
                    </div>
                    <p className="text-[11px] text-theme-muted mt-1 leading-snug">
                      Guarantees this event cannot be replaced, rescheduled, auto-shifted by cascading downstream delays, or displaced by emergency buffers.
                    </p>
                  </div>
                </label>
              </div>

              {/* Simultaneous Execution Checkbox (Parallel Execution Slot) */}
              <div className={`mt-2 p-3 rounded-xl border transition-all ${
                isSimultaneous
                  ? 'bg-purple-500/10 border-purple-500/50 dark:border-purple-400/40 shadow-sm ring-1 ring-purple-500/30'
                  : 'bg-theme-card border-theme-border/80 hover:border-theme-border'
              }`}>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      checked={isSimultaneous}
                      onChange={(e) => setIsSimultaneous(e.target.checked)}
                      className="w-4 h-4 rounded border-purple-400 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-theme-text flex items-center gap-1.5 font-display">
                        <Zap className={`w-3.5 h-3.5 ${isSimultaneous ? 'text-purple-600 dark:text-purple-400' : 'text-theme-muted'}`} />
                        Run Simultaneously (Co-Working / Parallel Slot)
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSimultaneous
                          ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border border-purple-300 dark:border-purple-800 font-mono'
                          : 'bg-theme-card-hover text-theme-muted border border-theme-border font-mono'
                      }`}>
                        {isSimultaneous ? '🔀 Simultaneous Active' : 'Sequential Strict Sync'}
                      </span>
                    </div>
                    <p className="text-[11px] text-theme-muted mt-1 leading-snug">
                      Allows this task to run concurrently alongside other scheduled tasks during the same time window. If unselected, overlapping tasks cannot be scheduled without conflict resolution.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Recurrence & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-theme-text mb-1.5 block">
                  Event Recurrence
                </label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="None">None (One-time)</option>
                  <option value="Daily">Daily</option>
                  <option value="Selected Days">Selected Days</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-theme-text mb-1.5 block">
                  Status State
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="Pending">Pending</option>
                  <option value="Working">Working</option>
                  <option value="Done">Done</option>
                  <option value="Hold">Hold</option>
                  <option value="Terminated">Terminated</option>
                  <option value="Reschedule">Reschedule</option>
                  <option value="Incomplete">Incomplete</option>
                </select>
              </div>
            </div>

            {/* Selected Days Selector */}
            {recurrence === 'Selected Days' && (
              <div className="p-3 rounded-xl bg-theme-card-hover border border-theme-border space-y-1.5 animate-fade-in">
                <label className="text-xs font-bold text-theme-text">
                  Choose Days of Week:
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {SHORT_DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedDays.includes(d)
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-theme-card text-theme-muted hover:bg-theme-border'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-tasks & Checklist Breakdown */}
            <div className="space-y-3 pt-2 border-t border-theme-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-500" />
                  Sub-tasks & Checklist
                </label>
                {subtasks.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-full">
                    {subtasks.length} {subtasks.length === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>

              {/* Sub-tasks entry bar with duration selector */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add deliverable or sub-task..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <select
                  value={newSubtaskMinutes}
                  onChange={(e) => setNewSubtaskMinutes(Number(e.target.value))}
                  className="text-xs px-2 py-1.5 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text font-bold"
                >
                  <option value={15}>15m</option>
                  <option value={30}>30m</option>
                  <option value={45}>45m</option>
                  <option value={60}>60m</option>
                  <option value={90}>90m</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  className="px-3 py-1.5 bg-theme-card-hover hover:bg-theme-border border border-theme-border rounded-lg text-xs font-bold text-theme-text flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {subtasks.length > 0 && (
                <div className="space-y-1.5 mt-2 bg-theme-card-hover p-2.5 rounded-xl border border-theme-border max-h-36 overflow-y-auto">
                  {subtasks.map((st, idx) => (
                    <div key={st.id || idx} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-theme-card border border-theme-border">
                      <span className="text-theme-text font-medium flex items-center gap-1.5">
                        <CornerDownRight className="w-3 h-3 text-purple-500" />
                        {st.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-theme-muted bg-theme-card-hover px-1.5 py-0.5 rounded border border-theme-border">
                          {st.assignedTimeMin || 30}m
                        </span>
                        <button
                          type="button"
                          onClick={() => setSubtasks(subtasks.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unified Links & Docs */}
            <div className="space-y-2 pt-1 border-t border-theme-border">
              <label className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
                Unified Links & Document IDs
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Doc / URL Title..."
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  className="w-1/3 text-xs px-3 py-1.5 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none"
                />
                <input
                  type="url"
                  placeholder="https://..."
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="px-3 py-1.5 bg-theme-card-hover hover:bg-theme-border border border-theme-border rounded-lg text-xs font-bold text-theme-text"
                >
                  Attach
                </button>
              </div>

              {links.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {links.map((lnk) => (
                    <span key={lnk.id} className="inline-flex items-center gap-1.5 text-xs bg-theme-card border border-theme-border px-2.5 py-1 rounded-lg text-theme-text">
                      <LinkIcon className="w-3 h-3 text-blue-500" />
                      <a href={lnk.url} target="_blank" rel="noreferrer" className="hover:underline font-medium text-blue-600 dark:text-blue-400">
                        {lnk.title}
                      </a>
                      <button type="button" onClick={() => handleRemoveLink(lnk.id)} className="text-red-500 hover:text-red-700 ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Notes Management */}
            <div className="space-y-1.5 pt-1 border-t border-theme-border">
              <label className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                Notes & Knowledge Base Link
              </label>
              <textarea
                rows={2}
                placeholder="Key insights, technical findings or checklists..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between border-t border-theme-border pt-4">
            <div className="text-xs text-theme-muted">
              Auto-Buffer: <strong className="text-theme-text">15m</strong> (5m on delay)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-theme-muted hover:text-theme-text rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/25 transition-all transform active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isEditing ? 'Save Changes' : 'Schedule Task'}</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Conflict Resolution Modal */}
      {showConflictModal && (
        <ConflictModal
          conflictingTasks={conflictingTasks}
          pendingTaskTitle={title || 'New Task'}
          appointedMinutes={appointedMinutes}
          candidateSlots={recommendedSlots}
          onAutoShift={handleResolveWithAutoShift}
          onSimultaneous={handleResolveWithSimultaneous}
          onSelectSlot={handleResolveWithSelectedSlot}
          onCancel={() => setShowConflictModal(false)}
        />
      )}
    </>
  );
};
