import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  isTimeInSleepWindow,
  isDateTimeBeforeNow,
  shouldRolloverToNextDay,
  formatMinutesTo12Hour,
  calculateFirstRecurringDate,
  getTimePeriodForTime,
  formatDisplayDate,
  taskCrossesMidnight,
  getTaskEndDate,
  getBangladeshNow,
  parse12HourToMinutes,
  computeNextFreeRawTimes
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
  AlertOctagon,
  CalendarDays,
  ArrowRight,
  FileText,
  CornerDownRight,
  Lock,
  Zap,
  RotateCcw,
  Repeat,
  Moon,
  Sun,
  Flame,
  Coffee,
  BookOpen
} from 'lucide-react';

interface TaskModalProps {
  taskToEdit?: Task | null;
  initialDate?: string;
  initialStartTime?: string;
  initialProjectCode?: string;
  initialCategory?: string;
  initialPlanProjectId?: string;
  initialRecurrence?: RecurrenceType;
  isMasterRecurringSeriesAdmin?: boolean;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  taskToEdit,
  initialDate,
  initialStartTime,
  initialProjectCode,
  initialCategory,
  initialPlanProjectId,
  initialRecurrence,
  isMasterRecurringSeriesAdmin = false,
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
    openBufferNoteModal,
    addTask, 
    updateTask, 
    updateRecurringSeriesEntirely,
    detectConflicts, 
    cascadeShiftDownstream,
    linkSimultaneousTasks,
    timePeriodSettings
  } = useApp();

  const isEditing = !!taskToEdit;

  // Task Presets from Admin Settings
  const effectiveDefaultBuffer = defaultTaskSettings?.defaultBufferMinutes !== undefined
    ? defaultTaskSettings.defaultBufferMinutes
    : (capacitySettings.defaultBufferMinutes !== undefined ? capacitySettings.defaultBufferMinutes : 0);

  const taskDefaults = defaultTaskSettings || {
    defaultPriority: 'P1',
    defaultCategory: categories[0]?.name || 'VRTX',
    defaultBufferMinutes: effectiveDefaultBuffer,
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
  const taskDateInputRef = useRef<HTMLInputElement>(null);
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
    Boolean(taskToEdit?.isSimultaneous || (taskToEdit?.simultaneousWithIds && taskToEdit.simultaneousWithIds.length > 0))
  );

  // Plan / Project Folder Grouping
  const [planProjectId, setPlanProjectId] = useState<string | undefined>(
    taskToEdit?.planProjectId || initialPlanProjectId
  );
  
  const defaultMin = prioritySettings[taskToEdit?.priority || taskDefaults.defaultPriority || 'P1']?.defaultMinutes ?? 90;
  const [appointedMinutes, setAppointedMinutes] = useState<number>(
    taskToEdit?.appointedMinutes ?? (taskDefaults.defaultAppointedMinutes || defaultMin)
  );
  const [bufferMinutes, setBufferMinutes] = useState<number>(
    taskToEdit?.bufferMinutes !== undefined 
      ? taskToEdit.bufferMinutes 
      : effectiveDefaultBuffer
  );
  
  // Smart Next Free Slot Computation on Creation
  // Priority: (1) taskToEdit (2) initialStartTime (3) computeNextFreeRawTimes (now + 5 min, conflict-free)
  const initialSmartSlot = useMemo(() => {
    if (taskToEdit) {
      return { startTime: taskToEdit.startTime, endTime: taskToEdit.endTime, dateStr: taskToEdit.taskDate, crossesMidnight: false };
    }

    if (initialStartTime) {
      return { startTime: initialStartTime, endTime: addMinutesToTime(initialStartTime, defaultMin), dateStr: initialDate, crossesMidnight: false };
    }

    const todayStr = toISODateString(getBangladeshNow());
    const targetDate = initialDate || todayStr;
    const freeRawSlots = computeNextFreeRawTimes(
      targetDate,
      Math.min(30, defaultMin),
      tasks,
      bufferNotes,
      undefined,
      effectiveDefaultBuffer,
      capacitySettings
    );

    if (freeRawSlots.length > 0) {
      const best = freeRawSlots[0];
      return { startTime: best, endTime: addMinutesToTime(best, defaultMin), dateStr: targetDate, crossesMidnight: false };
    }

    const roundedNow = getCurrentRoundedTime12Hour(5);
    return { startTime: roundedNow, endTime: addMinutesToTime(roundedNow, defaultMin), dateStr: targetDate, crossesMidnight: false };
  }, [taskToEdit, initialStartTime, initialDate, defaultMin, tasks, bufferNotes, capacitySettings, effectiveDefaultBuffer]);

  const [startTime, setStartTime] = useState<string>(initialSmartSlot.startTime);
  const [endTime, setEndTime] = useState<string>(initialSmartSlot.endTime);

  // Next 3-5 Free Raw Time Suggestions for taskDate (Current Time + 5m, or after current tasks)
  const freeRawTimeSuggestions = useMemo(() => {
    return computeNextFreeRawTimes(
      taskDate,
      Math.min(30, appointedMinutes),
      tasks,
      bufferNotes,
      taskToEdit?.id,
      effectiveDefaultBuffer,
      capacitySettings
    );
  }, [taskDate, appointedMinutes, tasks, bufferNotes, taskToEdit?.id, effectiveDefaultBuffer, capacitySettings]);
  
  const [status, setStatus] = useState<TaskStatus>(taskToEdit?.status || 'Pending');
  const [recurrence, setRecurrence] = useState<RecurrenceType>(
    taskToEdit?.recurrence || initialRecurrence || (isMasterRecurringSeriesAdmin ? 'Daily' : 'None')
  );
  const [selectedDays, setSelectedDays] = useState<string[]>(
    taskToEdit?.selectedDays || (initialRecurrence === 'Selected Days' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] : [])
  );
  const [recurringEditScope, setRecurringEditScope] = useState<'single' | 'series'>(
    isMasterRecurringSeriesAdmin ? 'series' : 'single'
  );
  const [seriesPropagateScope, setSeriesPropagateScope] = useState<'all' | 'future'>('all');
  const [seriesClearExclusions, setSeriesClearExclusions] = useState<boolean>(false);
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

  // Rollover & Past Time Warning state
  const [rolloverNotice, setRolloverNotice] = useState<{ message: string; originalDate: string; nextDate: string } | null>(null);
  const [showPastTimeModal, setShowPastTimeModal] = useState(false);
  const [hasConfirmedPastTime, setHasConfirmedPastTime] = useState(false);

  // Conflict state
  const [conflictingTasks, setConflictingTasks] = useState<Task[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Linked 24H Life Diary Buffer Status Note
  const linkedBufferNote = useMemo(() => {
    if (!taskToEdit) return undefined;
    return bufferNotes.find(b => b.relatedTaskId === taskToEdit.id || (b.date === taskDate && b.startTime === endTime));
  }, [taskToEdit, bufferNotes, taskDate, endTime]);

  // Segmented Drawer Tab on the Right Column
  const [detailsTab, setDetailsTab] = useState<'subtasks' | 'recurrence' | 'knowledge' | 'buffer_diary'>(
    isMasterRecurringSeriesAdmin || (taskToEdit?.recurrence && taskToEdit.recurrence !== 'None')
      ? 'recurrence'
      : 'subtasks'
  );

  // Auto-roll date to tomorrow if initial smart slot landed past midnight
  useEffect(() => {
    if (!taskToEdit && !initialDate && initialSmartSlot.crossesMidnight && initialSmartSlot.dateStr) {
      setTaskDate(initialSmartSlot.dateStr);
    }
  }, [taskToEdit, initialDate, initialSmartSlot]);

  // Compute exact first scheduled date for recurring tasks
  const firstOccurrencePreview = useMemo(() => {
    if (recurrence === 'None') return null;
    return calculateFirstRecurringDate({
      recurrence,
      selectedDays,
      startTime,
      baseDate: taskDate || initialDate || toISODateString(new Date())
    });
  }, [recurrence, selectedDays, startTime, taskDate, initialDate]);

  // Track previous recurrence pattern to only auto-align when recurrence pattern changes
  const prevRecurrencePatternRef = useRef(`${recurrence}-${(selectedDays || []).sort().join(',')}`);

  // When setting recurrence on a new task, automatically align taskDate to the first valid occurrence
  useEffect(() => {
    const currentPattern = `${recurrence}-${(selectedDays || []).sort().join(',')}`;
    if (prevRecurrencePatternRef.current !== currentPattern) {
      prevRecurrencePatternRef.current = currentPattern;
      if (!taskToEdit && recurrence && recurrence !== 'None') {
        const nextValid = calculateFirstRecurringDate({
          recurrence,
          selectedDays,
          startTime,
          baseDate: taskDate
        });
        if (nextValid !== taskDate) {
          setTaskDate(nextValid);
        }
      }
    }
  }, [recurrence, selectedDays, startTime, taskDate, taskToEdit]);

  // Live evaluation of whether scheduled start time is in the past
  const pastTimeCheck = useMemo(() => {
    return isDateTimeBeforeNow(taskDate, startTime);
  }, [taskDate, startTime]);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toISODateString(d);
  }, []);

  // Auto calculate day of week
  const dayOfWeek = getDayOfWeekFromDate(taskDate);

  // Recommended candidate free slots across the day (guaranteed zero sleep window slots)
  const recommendedSlots = useMemo(() => {
    return getRecommendedDayFreeSlots(taskDate, appointedMinutes, tasks, bufferNotes, taskToEdit?.id, 10, effectiveDefaultBuffer, capacitySettings);
  }, [taskDate, appointedMinutes, tasks, bufferNotes, taskToEdit?.id, capacitySettings, effectiveDefaultBuffer]);

  // Live Overlap / Conflict Intelligence calculation
  const liveOverlaps = useMemo(() => {
    return detectConflicts(taskDate, startTime, endTime, taskToEdit?.id);
  }, [taskDate, startTime, endTime, taskToEdit?.id, detectConflicts]);

  // If time or date changes such that there are no overlapping tasks, auto-turn off simultaneous flag
  useEffect(() => {
    if (isSimultaneous && liveOverlaps.length === 0) {
      setIsSimultaneous(false);
    }
  }, [liveOverlaps.length, isSimultaneous]);

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

  // When start time changes, recompute end time and evaluate midnight rollover
  const handleStartTimeChange = (newStart: string) => {
    const oldStart = startTime;
    setStartTime(newStart);
    setValidationError(null);
    setHasConfirmedPastTime(false);
    setEndTime(addMinutesToTime(newStart, appointedMinutes));

    // Check if newStart crosses midnight relative to existing tasks or late evening hours
    const existingOnDate = tasks.filter(t => t.taskDate === taskDate && t.id !== taskToEdit?.id);
    const rollover = shouldRolloverToNextDay(taskDate, newStart, oldStart, existingOnDate);
    if (rollover.shouldRollover && taskDate !== rollover.nextDateStr) {
      const prevDate = taskDate;
      setTaskDate(rollover.nextDateStr);
      setRolloverNotice({
        message: `🌙 Rolled over to Next Day (${rollover.nextDateStr}): ${newStart} follows late night work (12:30 AM is after midnight).`,
        originalDate: prevDate,
        nextDate: rollover.nextDateStr
      });
    }
  };

  // 1-Click AM / PM Period Toggle (accurately supports 12:pm, 12:00 Am, etc.)
  const handleTogglePeriod = (targetPeriod: 'AM' | 'PM') => {
    if (!startTime || startTime === 'All Day') return;
    const totalMin = parse12HourToMinutes(startTime);
    let h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (targetPeriod === 'AM') {
      if (h >= 12) h -= 12;
    } else {
      if (h < 12) h += 12;
    }
    const newStartTime = formatMinutesTo12Hour(h * 60 + m);
    setStartTime(newStartTime);
    setEndTime(addMinutesToTime(newStartTime, appointedMinutes));
    setValidationError(null);
  };

  // Resolution handlers for past time warning dialog
  const handleAdjustToNextFreeSlot = () => {
    const now = new Date();
    const isAfternoonOrEvening = now.getHours() >= 12;
    const smart = getSmartNextFreeSlot(
      toISODateString(new Date()),
      appointedMinutes,
      tasks,
      bufferNotes,
      taskToEdit?.id,
      effectiveDefaultBuffer,
      capacitySettings,
      isAfternoonOrEvening
    );
    setTaskDate(smart.dateStr || toISODateString(new Date()));
    setStartTime(smart.startTime);
    setEndTime(smart.endTime);
    setShowPastTimeModal(false);
    setHasConfirmedPastTime(true);
  };

  const handleShiftToTomorrow = () => {
    setTaskDate(tomorrowStr);
    setShowPastTimeModal(false);
    setHasConfirmedPastTime(true);
  };

  const handleConfirmPastEntry = () => {
    setHasConfirmedPastTime(true);
    setShowPastTimeModal(false);
    handleSave(false, true);
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
  const handleSave = (forceNoConflictCheck = false, bypassPastWarning = false) => {
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

    // 🚨 HUGE WARNING INTERCEPTOR: Block saving entry before current time without explicit permission
    if (!bypassPastWarning && !hasConfirmedPastTime && pastTimeCheck.isPast) {
      setShowPastTimeModal(true);
      return;
    }

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

    // Ensure 1st schedule date for recurring task is accurate
    let effectiveTaskDate = taskDate;
    if (recurrence && recurrence !== 'None') {
      effectiveTaskDate = calculateFirstRecurringDate({
        recurrence,
        selectedDays: recurrence === 'Selected Days' ? selectedDays : [],
        startTime,
        baseDate: taskDate
      });
    }
    const crosses = taskCrossesMidnight(startTime, endTime);
    const calculatedEndDate = crosses ? getTaskEndDate(effectiveTaskDate, startTime, endTime) : effectiveTaskDate;
    const effectiveDayOfWeek = getDayOfWeekFromDate(effectiveTaskDate);

    const actualSimultaneous = Boolean(isSimultaneous && liveOverlaps.length > 0);
    const actualSimultaneousIds = actualSimultaneous ? liveOverlaps.map(t => t.id) : [];

    const payload = {
      projectCode: projectCode.trim() || generateProjectCode(),
      title: title.trim(),
      description: description.trim(),
      taskDate: effectiveTaskDate,
      endDate: calculatedEndDate,
      crossesMidnight: crosses,
      dayOfWeek: effectiveDayOfWeek,
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
      isSimultaneous: actualSimultaneous,
      simultaneousWithIds: actualSimultaneousIds,
      planProjectId: planProjectId || undefined,
      notes,
      links,
      subtasks
    };

    if (isEditing && taskToEdit) {
      if (isMasterRecurringSeriesAdmin || recurringEditScope === 'series') {
        // SUPREME GOD ADMIN: Entirely update recurring series everywhere
        updateRecurringSeriesEntirely(taskToEdit.id, payload, {
          syncSnapshots: true,
          propagateScope: seriesPropagateScope,
          clearExclusions: seriesClearExclusions
        });
      } else if (taskToEdit.recurrence && taskToEdit.recurrence !== 'None' && recurringEditScope === 'single') {
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
    const autoBuffer = effectiveDefaultBuffer;
    cascadeShiftDownstream(taskDate, newCalculatedStartTime, appointedMinutes + autoBuffer, taskToEdit?.id);
    setShowConflictModal(false);
    setStartTime(newCalculatedStartTime);
    const crosses = taskCrossesMidnight(newCalculatedStartTime, newEnd);
    const calculatedEndDate = crosses ? getTaskEndDate(taskDate, newCalculatedStartTime, newEnd) : taskDate;

    const payload = {
      projectCode: projectCode.trim() || generateProjectCode(),
      title: title.trim(),
      description: description.trim(),
      taskDate,
      endDate: calculatedEndDate,
      crossesMidnight: crosses,
      dayOfWeek,
      priority,
      category,
      subCategory,
      appointedMinutes,
      startTime: newCalculatedStartTime,
      endTime: newEnd,
      status,
      bufferMinutes,
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
      if (isMasterRecurringSeriesAdmin || recurringEditScope === 'series') {
        updateRecurringSeriesEntirely(taskToEdit.id, payload, {
          syncSnapshots: true,
          propagateScope: seriesPropagateScope,
          clearExclusions: seriesClearExclusions
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

  // Resolve conflict by enabling Simultaneous mode
  const handleResolveWithSimultaneous = () => {
    setIsSimultaneous(true);
    const crosses = taskCrossesMidnight(startTime, endTime);
    const calculatedEndDate = crosses ? getTaskEndDate(taskDate, startTime, endTime) : taskDate;

    const payload = {
      projectCode: projectCode.trim() || generateProjectCode(),
      title: title.trim(),
      description: description.trim(),
      taskDate,
      endDate: calculatedEndDate,
      crossesMidnight: crosses,
      dayOfWeek,
      priority,
      category,
      subCategory,
      appointedMinutes,
      startTime,
      endTime,
      status,
      bufferMinutes,
      recurrence,
      selectedDays: recurrence === 'Selected Days' ? selectedDays : [],
      isMandatorySchedule,
      isSimultaneous: true,
      simultaneousWithIds: conflictingTasks.map(t => t.id),
      planProjectId: planProjectId || undefined,
      notes,
      links,
      subtasks
    };

    if (isEditing && taskToEdit) {
      if (isMasterRecurringSeriesAdmin || recurringEditScope === 'series') {
        updateRecurringSeriesEntirely(taskToEdit.id, payload, {
          syncSnapshots: true,
          propagateScope: seriesPropagateScope,
          clearExclusions: seriesClearExclusions
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

  // Resolve conflict by selecting candidate slot
  const handleResolveWithSelectedSlot = (chosenStart: string) => {
    const chosenEnd = addMinutesToTime(chosenStart, appointedMinutes);
    setShowConflictModal(false);
    setStartTime(chosenStart);
    const crosses = taskCrossesMidnight(chosenStart, chosenEnd);
    const calculatedEndDate = crosses ? getTaskEndDate(taskDate, chosenStart, chosenEnd) : taskDate;

    const payload = {
      projectCode: projectCode.trim() || generateProjectCode(),
      title: title.trim(),
      description: description.trim(),
      taskDate,
      endDate: calculatedEndDate,
      crossesMidnight: crosses,
      dayOfWeek,
      priority,
      category,
      subCategory,
      appointedMinutes,
      startTime: chosenStart,
      endTime: chosenEnd,
      status,
      bufferMinutes,
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
      if (isMasterRecurringSeriesAdmin || recurringEditScope === 'series') {
        updateRecurringSeriesEntirely(taskToEdit.id, payload, {
          syncSnapshots: true,
          propagateScope: seriesPropagateScope,
          clearExclusions: seriesClearExclusions
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

  const priorityMeta = prioritySettings[priority];

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
        <div className="bg-theme-card border border-theme-border rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-scale-up">
          
          {/* =========================================================================
              MODAL HEADER (Apple Command Header)
          ========================================================================= */}
          <div className="p-4 sm:p-5 border-b border-theme-border flex items-center justify-between gap-3 shrink-0 bg-theme-card/95 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                isMasterRecurringSeriesAdmin 
                  ? 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 text-lg'
                  : 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
              }`}>
                {isMasterRecurringSeriesAdmin ? '👑' : <Clock className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-theme-text tracking-tight font-display">
                    {isMasterRecurringSeriesAdmin 
                      ? (isEditing ? 'God Admin: Edit Master Recurring Series' : 'God Admin: Create New Recurring Series')
                      : (isEditing ? 'Edit Task Matrix' : 'Create New Scheduled Task')}
                  </h2>
                  {isMasterRecurringSeriesAdmin && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-black border border-blue-500/30">
                      MASTER SERIES
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-theme-muted flex-wrap">
                  <span>Code:</span>
                  <input
                    type="text"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-transparent border-b border-dashed border-blue-400 focus:outline-none text-xs w-32"
                    title="Unique Project Code (Custom Editable)"
                  />
                  <span>• {dayOfWeek}</span>
                  {timePeriodSettings?.isEnabled && (() => {
                    const period = getTimePeriodForTime(startTime, timePeriodSettings);
                    if (!period) return null;
                    return (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 shadow-2xs">
                        <span>{period.emoji || '⏰'}</span>
                        <span>{period.name}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleQuickFillAutoPresets}
                className="hidden sm:flex text-[11px] font-black px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-xl transition-all items-center gap-1.5 active:scale-95 cursor-pointer"
                title="Auto-fill with P1, Today & default Category"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Auto-Fill Presets</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors cursor-pointer"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* =========================================================================
              MODAL BODY (Two-Column Layout with Smooth Scroll)
          ========================================================================= */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            
            {/* Validation Error Banner */}
            {validationError && (
              <div className="p-3.5 rounded-2xl bg-red-100/90 dark:bg-red-950/70 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2 animate-shake shadow-xs">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* God Admin Master Recurring Series Hero Banner */}
            {isMasterRecurringSeriesAdmin && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-600/15 via-indigo-600/15 to-purple-600/15 border border-blue-500/30 flex items-center justify-between gap-3 shadow-md animate-fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-500/25 shrink-0 text-base">
                    👑
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-theme-text font-display uppercase tracking-wider">
                        God Admin: Master Series Mode
                      </span>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/30">
                        FULL TASK ENGINE
                      </span>
                    </div>
                    <p className="text-[11px] text-theme-muted mt-0.5 leading-tight">
                      {isEditing 
                        ? `Editing master schedule for "${taskToEdit?.title}". All 100% features (P1-P5, categories, timeboxes, subtask minutes, links, notes) will sync entirely everywhere.`
                        : 'Creating a new Master Recurring Series template with full enterprise time-boxing and automatic recurring propagation.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Automatic Midnight Rollover Alert */}
            {rolloverNotice && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-blue-500/15 border border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-200 flex items-center justify-between text-xs animate-fade-in shadow-xs">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-500 shrink-0 animate-pulse" />
                  <span className="font-semibold">{rolloverNotice.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTaskDate(rolloverNotice.originalDate);
                    setRolloverNotice(null);
                  }}
                  className="px-2.5 py-1 bg-white dark:bg-black/40 hover:bg-theme-card-hover border border-indigo-300 dark:border-indigo-700 rounded-lg text-[10px] font-black text-indigo-600 dark:text-indigo-300 shrink-0 shadow-2xs transition-colors"
                >
                  Keep as {rolloverNotice.originalDate}
                </button>
              </div>
            )}

            {/* Main 2-Column Command Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* =================================================================
                  LEFT COLUMN: THE CORE SCIENTIFIC TIME-BOX ENGINE (7 cols)
              ================================================================= */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* 1. Task Title & Category Identity */}
                <div className="p-4 rounded-2xl bg-theme-card border border-theme-border space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-xs font-black text-theme-text uppercase tracking-wider flex items-center gap-1 font-display">
                      <span>Task Title</span>
                      <span className="text-red-500 font-black">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-100/90 dark:bg-blue-950/80 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-bold text-xs shadow-2xs">
                        <Folder className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-[10px] text-theme-muted uppercase font-semibold">Domain:</span>
                        <span className="font-black text-theme-text font-mono text-xs">{category || 'VRTX'}</span>
                      </div>
                      <span className="text-[11px] font-mono text-theme-muted font-bold">
                        ({startTime} → {endTime})
                      </span>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="e.g. OptimusLAB Unified Architecture Audit..."
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    className={`w-full text-sm px-4 py-2.5 rounded-xl bg-theme-card-hover border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold shadow-2xs ${
                      validationError && !title.trim() ? 'border-red-500 ring-1 ring-red-500' : 'border-theme-border'
                    }`}
                    autoFocus
                  />

                  {/* Category Selection & SubCategory */}
                  <div className="pt-2 border-t border-theme-border/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider flex items-center gap-1.5">
                        <Folder className="w-3.5 h-3.5 text-blue-500" />
                        <span>Category</span>
                      </span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                        hasConfirmedCategory
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {hasConfirmedCategory ? '✓ Confirmed' : '* Click Category to Confirm'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
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
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 transform active:scale-95 cursor-pointer shadow-2xs ${
                              isCatSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                                : 'bg-theme-card-hover text-theme-muted hover:text-theme-text border-theme-border hover:border-blue-400'
                            }`}
                          >
                            <Tag className="w-3 h-3" />
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 transform active:scale-95 cursor-pointer shadow-2xs ${
                          category === 'Unknown'
                            ? 'bg-slate-700 text-white border-slate-700 shadow-sm ring-2 ring-slate-500/30'
                            : 'bg-theme-card-hover text-theme-muted hover:text-theme-text border-theme-border hover:border-slate-400'
                        }`}
                      >
                        <Tag className="w-3 h-3 opacity-60" />
                        <span>Unknown</span>
                      </button>
                    </div>

                    {/* SubCategory Selection */}
                    {currentCategoryObj && currentCategoryObj.subCategories.length > 0 && (
                      <div className="pt-1.5 border-t border-theme-border/40 flex items-center gap-1.5 flex-wrap">
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
                                  ? 'bg-theme-card-hover border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                                  : 'bg-theme-card text-theme-muted border-theme-border hover:text-theme-text'
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

                {/* 2. Priority Protocol (P1-P5) */}
                <div className="p-4 rounded-2xl bg-theme-card border border-theme-border space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-theme-text uppercase tracking-wider flex items-center gap-1.5 font-display">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      <span>Priority Protocol (P1–P5)</span>
                    </label>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                      hasConfirmedPriority
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {hasConfirmedPriority ? '✓ Confirmed Preset' : '* Click Priority to Confirm'}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
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
                          className={`py-2 px-1.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 transform active:scale-95 shadow-2xs cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 shadow-md ring-2 ring-blue-500/30 font-black scale-[1.02]'
                              : !hasConfirmedPriority
                                ? 'border-dashed border-theme-border hover:border-blue-400 hover:bg-theme-card-hover'
                                : 'border-theme-border hover:bg-theme-card-hover opacity-85 hover:opacity-100'
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

                {/* 3. Duration & Automated Break Buffer (Unified Time-Box Math) */}
                <div className="p-4 rounded-2xl bg-theme-card border border-theme-border space-y-3.5 shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    
                    {/* Duration Input & Preset Chips */}
                    <div className="sm:col-span-7 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-theme-text uppercase tracking-wider flex items-center gap-1.5 font-display">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>Appointed Duration</span>
                        </label>
                        <span className="text-[10px] font-mono font-bold text-theme-muted">
                          End: {endTime}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative w-24 shrink-0">
                          <input
                            type="number"
                            min="5"
                            step="5"
                            value={appointedMinutes}
                            onChange={(e) => handleMinutesChange(parseInt(e.target.value, 10) || 0)}
                            className="w-full text-xs pr-6 pl-2.5 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-mono font-black text-center focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                            placeholder="60"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-theme-muted font-bold pointer-events-none">
                            m
                          </span>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap flex-1">
                          {[15, 30, 45, 60, 90, 120].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => handleMinutesChange(m)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all border shadow-2xs cursor-pointer ${
                                appointedMinutes === m
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-400'
                                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text border-theme-border hover:border-blue-400'
                              }`}
                            >
                              {m}m
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Automated Break Buffer Selection */}
                    <div className="sm:col-span-5 space-y-1.5 sm:pl-3 sm:border-l border-theme-border/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider text-[10px] flex items-center gap-1 font-display">
                          <span>🟣 Break Buffer</span>
                        </span>
                        <span className="font-mono text-[10px] font-bold text-purple-700 dark:text-purple-300">
                          +{bufferMinutes}m
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-wrap">
                        {[0, 5, 10, 15, 20, 30, 45].map((bMin) => {
                          const isSelected = bufferMinutes === bMin;
                          const isDefault = bMin === effectiveDefaultBuffer;
                          return (
                            <button
                              key={bMin}
                              type="button"
                              onClick={() => setBufferMinutes(bMin)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all border flex items-center gap-0.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                  : 'bg-theme-card-hover text-theme-muted hover:text-theme-text border-theme-border hover:border-purple-400'
                              }`}
                            >
                              <span>{bMin === 0 ? '0m' : `${bMin}m`}</span>
                              {isDefault && <span className="text-[8px] opacity-80">★</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* Contiguous Block Footprint Pill */}
                  <div className="pt-2 border-t border-theme-border/40 flex items-center justify-between text-[11px] font-mono text-theme-muted flex-wrap gap-1">
                    <span>Contiguous Time-Box Block:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-theme-text">
                        {startTime} → {addMinutesToTime(startTime, appointedMinutes + bufferMinutes)} ({appointedMinutes}m work + {bufferMinutes}m buffer = {appointedMinutes + bufferMinutes}m)
                      </span>
                      {taskCrossesMidnight(startTime, endTime) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1 font-mono">
                          <Moon className="w-3 h-3" />
                          <span>Spans into {formatDisplayDate(getTaskEndDate(taskDate, startTime, endTime))}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Scheduled Date, Time & Smart Free Slots */}
                <div className="p-4 rounded-2xl bg-theme-card border border-theme-border space-y-3 shadow-xs">
                  
                  {/* Contextual Alert: Past Time Warning */}
                  {pastTimeCheck.isPast && (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/60 text-amber-950 dark:text-amber-200 flex items-center justify-between gap-2 text-xs font-semibold animate-pulse shadow-2xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertOctagon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="truncate">
                          ⚠️ Past Time: Scheduled at <strong>{startTime}</strong> on <strong>{formatDisplayDate(taskDate)}</strong>.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAdjustToNextFreeSlot}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-black shrink-0 shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Fix to Now</span>
                      </button>
                    </div>
                  )}

                  {/* Contextual Alert: Sleep Window Warning */}
                  {sleepWindowWarning.inSleep && (
                    <div className="p-3 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 text-xs space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-black flex items-center gap-1.5">
                          <Moon className="w-3.5 h-3.5 text-indigo-500" />
                          <span>🌙 Overlaps Sleep Window ({sleepWindowWarning.sleepStart} → {sleepWindowWarning.sleepEnd})</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleTogglePeriod('PM')}
                          className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>⚡ Switch to PM</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newStart = '02:00 PM';
                            const newEnd = addMinutesToTime(newStart, appointedMinutes);
                            setStartTime(newStart);
                            setEndTime(newEnd);
                            if (validationError) setValidationError(null);
                          }}
                          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>⚡ 02:00 PM Slot</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const smart = getSmartNextFreeSlot(
                              taskDate,
                              appointedMinutes,
                              tasks,
                              bufferNotes,
                              taskToEdit?.id,
                              effectiveDefaultBuffer,
                              capacitySettings,
                              true
                            );
                            setStartTime(smart.startTime);
                            setEndTime(smart.endTime);
                            if (smart.dateStr && smart.dateStr !== taskDate) {
                              setTaskDate(smart.dateStr);
                            }
                            if (validationError) setValidationError(null);
                          }}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>⚡ Next Daytime Slot</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Contextual Alert: Overlap Conflict */}
                  {liveOverlaps.length > 0 && (
                    <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs ${
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
                            ? `🔀 Co-running with [${liveOverlaps[0].projectCode}] "${liveOverlaps[0].title}"`
                            : `🚨 Time Overlap with [${liveOverlaps[0].projectCode}] "${liveOverlaps[0].title}"`
                          }
                        </span>
                      </div>

                      {!isSimultaneous && (
                        <button
                          type="button"
                          onClick={() => {
                            const smart = getSmartNextFreeSlot(
                              taskDate, 
                              appointedMinutes, 
                              tasks, 
                              bufferNotes, 
                              taskToEdit?.id, 
                              effectiveDefaultBuffer,
                              capacitySettings,
                              startTime.includes('PM') || new Date().getHours() >= 12
                            );
                            setStartTime(smart.startTime);
                            setEndTime(smart.endTime);
                            if (smart.dateStr && smart.dateStr !== taskDate) {
                              setTaskDate(smart.dateStr);
                            }
                          }}
                          className="text-[10px] font-bold px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shrink-0 shadow-xs whitespace-nowrap cursor-pointer"
                        >
                          Pick Free Slot
                        </button>
                      )}
                    </div>
                  )}

                  {/* Date & Start Time Container (Apple Master Level Precision) */}
                  <div className="p-3 sm:p-4 rounded-2xl bg-theme-card-hover/80 dark:bg-theme-card/50 border border-theme-border shadow-2xs space-y-3">
                    
                    {/* Top Row: Date & Start Time (Balanced 50/50 Grid) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-start">
                      
                      {/* Left: Scheduled Date */}
                      <div 
                        onClick={() => {
                          try {
                            taskDateInputRef.current?.showPicker();
                          } catch {
                            taskDateInputRef.current?.focus();
                          }
                        }}
                        className="space-y-1.5 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-theme-text flex items-center gap-1.5 cursor-pointer">
                            <Calendar className="w-3.5 h-3.5 text-blue-500" />
                            <span>Scheduled Date</span>
                          </label>
                          <div className="flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const targetDate = toISODateString(getBangladeshNow());
                                setTaskDate(targetDate);
                                setRolloverNotice(null);
                                if (validationError) setValidationError(null);
                                if (!taskToEdit) {
                                  const free = computeNextFreeRawTimes(targetDate, Math.min(30, appointedMinutes), tasks, bufferNotes, undefined, effectiveDefaultBuffer, capacitySettings);
                                  if (free.length > 0) {
                                    setStartTime(free[0]);
                                    setEndTime(addMinutesToTime(free[0], appointedMinutes));
                                  }
                                }
                              }}
                              className={`px-2.5 py-0.5 rounded-full font-bold border transition-all cursor-pointer shadow-2xs ${
                                taskDate === toISODateString(getBangladeshNow())
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : 'bg-theme-card text-theme-muted border-theme-border hover:text-theme-text hover:bg-theme-card-hover'
                              }`}
                            >
                              Today
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const tomorrow = getBangladeshNow();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                const targetDate = toISODateString(tomorrow);
                                setTaskDate(targetDate);
                                setRolloverNotice(null);
                                if (validationError) setValidationError(null);
                                if (!taskToEdit) {
                                  const free = computeNextFreeRawTimes(targetDate, Math.min(30, appointedMinutes), tasks, bufferNotes, undefined, effectiveDefaultBuffer, capacitySettings);
                                  if (free.length > 0) {
                                    setStartTime(free[0]);
                                    setEndTime(addMinutesToTime(free[0], appointedMinutes));
                                  }
                                }
                              }}
                              className={`px-2.5 py-0.5 rounded-full font-bold border transition-all cursor-pointer shadow-2xs ${
                                taskDate !== toISODateString(getBangladeshNow())
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : 'bg-theme-card text-theme-muted border-theme-border hover:text-theme-text hover:bg-theme-card-hover'
                              }`}
                            >
                              Tomorrow
                            </button>
                          </div>
                        </div>

                        <input
                          ref={taskDateInputRef}
                          type="date"
                          value={taskDate}
                          onChange={(e) => {
                            const newD = e.target.value;
                            setTaskDate(newD);
                            if (validationError) setValidationError(null);
                            if (!taskToEdit && newD) {
                              const free = computeNextFreeRawTimes(newD, Math.min(30, appointedMinutes), tasks, bufferNotes, undefined, effectiveDefaultBuffer, capacitySettings);
                              if (free.length > 0) {
                                setStartTime(free[0]);
                                setEndTime(addMinutesToTime(free[0], appointedMinutes));
                              }
                            }
                          }}
                          onClick={(e) => {
                            try {
                              (e.target as HTMLInputElement).showPicker?.();
                            } catch {}
                          }}
                          className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono font-bold cursor-pointer transition-all shadow-2xs"
                        />
                      </div>

                      {/* Right: Start Time */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-theme-text flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            <span>Start Time</span>
                          </label>

                          {/* 1-Click AM / PM Quick Switcher */}
                          {(() => {
                            const isStart12 = startTime.trim().startsWith('12:') || startTime.trim().toUpperCase().startsWith('12PM') || startTime.trim().toUpperCase().startsWith('12AM');
                            const isAmActive = startTime.toUpperCase().includes('AM');
                            const isPmActive = startTime.toUpperCase().includes('PM');
                            return (
                              <div className="flex items-center p-0.5 bg-theme-card rounded-full border border-theme-border text-[10px] font-black shadow-inner">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePeriod('AM')}
                                  className={`px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                                    isAmActive
                                      ? isStart12 ? 'bg-indigo-600 text-white shadow-xs' : 'bg-amber-500 text-white shadow-xs'
                                      : 'text-theme-muted hover:text-theme-text'
                                  }`}
                                  title={isStart12 ? '12:00 AM • Night & New Date (Midnight)' : 'Switch to Morning (AM)'}
                                >
                                  {isStart12 ? <Moon className="w-2.5 h-2.5" /> : <Sun className="w-2.5 h-2.5" />}
                                  <span>AM</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTogglePeriod('PM')}
                                  className={`px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                                    isPmActive
                                      ? isStart12 ? 'bg-amber-500 text-white shadow-xs' : 'bg-indigo-600 text-white shadow-xs'
                                      : 'text-theme-muted hover:text-theme-text'
                                  }`}
                                  title={isStart12 ? '12:00 PM • Day Time (Midday / Lunch)' : 'Switch to Afternoon / Evening (PM)'}
                                >
                                  {isStart12 ? <Sun className="w-2.5 h-2.5" /> : <Moon className="w-2.5 h-2.5" />}
                                  <span>PM</span>
                                </button>
                              </div>
                            );
                          })()}
                        </div>

                        <TimePicker
                          value={startTime}
                          onChange={handleStartTimeChange}
                        />
                      </div>

                    </div>

                    {/* Bottom Full-Width Strip: Next Free Time Slots (Apple Complication Styling) */}
                    {freeRawTimeSuggestions.length > 0 && (
                      <div className="pt-2.5 border-t border-theme-border/60 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 font-bold text-theme-text font-display">
                            <div className="w-4 h-4 rounded-md bg-amber-500/15 flex items-center justify-center text-amber-500 shrink-0">
                              <Sparkles className="w-2.5 h-2.5" />
                            </div>
                            <span>Next Free Slots</span>
                            <span className="text-[10px] font-normal text-theme-muted">
                              • {taskDate === toISODateString(getBangladeshNow()) ? 'Today' : formatDisplayDate(taskDate)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const best = freeRawTimeSuggestions[0];
                                if (best) {
                                  setStartTime(best);
                                  setEndTime(addMinutesToTime(best, appointedMinutes));
                                  if (validationError) setValidationError(null);
                                }
                              }}
                              className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                              title="Auto-fit to earliest available free slot"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>Auto-Fit First</span>
                            </button>
                            <span className="text-[9px] font-mono text-theme-muted/70 hidden sm:inline">1-tap select</span>
                          </div>
                        </div>

                        {/* 3 to 5 Clickable Free Slots Pills */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {freeRawTimeSuggestions.slice(0, 5).map((timeStr, idx) => {
                            const isSelected = startTime === timeStr;
                            const mins = parse12HourToMinutes(timeStr);
                            const isLate = mins < 360 || mins >= 1380;
                            const endStr = addMinutesToTime(timeStr, appointedMinutes);

                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setStartTime(timeStr);
                                  setEndTime(endStr);
                                  if (validationError) setValidationError(null);
                                }}
                                className={`group px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer active:scale-95 flex items-center gap-2 shadow-2xs ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-600/30 ring-2 ring-blue-400/40 scale-[1.02]'
                                    : 'bg-theme-card hover:bg-theme-card-hover text-theme-text border-theme-border/80 hover:border-blue-400/50'
                                }`}
                                title={`Schedule at ${timeStr} (${timeStr} - ${endStr})`}
                              >
                                <div className="flex items-center gap-1">
                                  {isLate ? (
                                    <Moon className={`w-3 h-3 ${isSelected ? 'text-blue-200' : 'text-indigo-400'}`} />
                                  ) : (
                                    <Sun className={`w-3 h-3 ${isSelected ? 'text-amber-200' : 'text-amber-500'}`} />
                                  )}
                                  <span>{timeStr}</span>
                                </div>
                                <span className={`text-[10px] font-sans font-medium px-1.5 py-0.2 rounded-md transition-colors ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-theme-border/50 text-theme-muted group-hover:text-theme-text'
                                }`}>
                                  ~{appointedMinutes}m
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Safety & Execution Governance Protocols */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  
                  {/* Mandatory Fixed Time Lock Switch */}
                  <label className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                    isMandatorySchedule
                      ? 'bg-amber-500/10 border-amber-500/50 dark:border-amber-400/40 shadow-xs ring-1 ring-amber-500/20'
                      : 'bg-theme-card border-theme-border/80 hover:border-theme-border'
                  }`}>
                    <input
                      type="checkbox"
                      checked={isMandatorySchedule}
                      onChange={(e) => setIsMandatorySchedule(e.target.checked)}
                      className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 mt-0.5 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Lock className={`w-3.5 h-3.5 ${isMandatorySchedule ? 'text-amber-600 dark:text-amber-400' : 'text-theme-muted'}`} />
                        <span className="text-xs font-black text-theme-text font-display">
                          Mandatory Schedule
                        </span>
                      </div>
                      <p className="text-[10px] text-theme-muted mt-0.5 leading-snug">
                        Immutable fixed slot. Cannot be auto-shifted by cascading delays.
                      </p>
                    </div>
                  </label>

                  {/* Simultaneous Co-Working Switch */}
                  <label className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                    isSimultaneous
                      ? 'bg-purple-500/10 border-purple-500/50 dark:border-purple-400/40 shadow-xs ring-1 ring-purple-500/20'
                      : 'bg-theme-card border-theme-border/80 hover:border-theme-border'
                  }`}>
                    <input
                      type="checkbox"
                      checked={isSimultaneous}
                      onChange={(e) => setIsSimultaneous(e.target.checked)}
                      className="w-4 h-4 rounded border-purple-400 text-purple-600 focus:ring-purple-500 mt-0.5 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Zap className={`w-3.5 h-3.5 ${isSimultaneous ? 'text-purple-600 dark:text-purple-400' : 'text-theme-muted'}`} />
                        <span className="text-xs font-black text-theme-text font-display">
                          Run Simultaneously
                        </span>
                      </div>
                      <p className="text-[10px] text-theme-muted mt-0.5 leading-snug">
                        Allows parallel co-working alongside overlapping events.
                      </p>
                    </div>
                  </label>

                </div>

              </div>

              {/* =================================================================
                  RIGHT COLUMN: CONTEXT & PAYLOAD DRAWER (5 cols)
              ================================================================= */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* Segmented Control Drawer Tabs */}
                <div className="p-1 bg-theme-card-hover rounded-2xl border border-theme-border flex items-center gap-1 text-xs font-bold shadow-inner">
                  <button
                    type="button"
                    onClick={() => setDetailsTab('subtasks')}
                    className={`flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      detailsTab === 'subtasks'
                        ? 'bg-blue-600 text-white shadow-xs font-black'
                        : 'text-theme-muted hover:text-theme-text'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Subtasks ({subtasks.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailsTab('recurrence')}
                    className={`flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      detailsTab === 'recurrence'
                        ? 'bg-blue-600 text-white shadow-xs font-black'
                        : 'text-theme-muted hover:text-theme-text'
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Recurrence {recurrence !== 'None' ? `(${recurrence})` : ''}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailsTab('knowledge')}
                    className={`flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      detailsTab === 'knowledge'
                        ? 'bg-blue-600 text-white shadow-xs font-black'
                        : 'text-theme-muted hover:text-theme-text'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Docs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailsTab('buffer_diary')}
                    className={`flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      detailsTab === 'buffer_diary'
                        ? 'bg-amber-500 text-white shadow-xs font-black'
                        : 'text-theme-muted hover:text-theme-text'
                    }`}
                  >
                    <Coffee className="w-3.5 h-3.5" />
                    <span>Diary {linkedBufferNote ? '✓' : bufferMinutes > 0 ? `(${bufferMinutes}m)` : ''}</span>
                  </button>
                </div>

                {/* Tab Content Panels */}
                <div className="p-4 rounded-2xl bg-theme-card border border-theme-border space-y-3 min-h-[280px] shadow-xs">
                  
                  {/* TAB A: SUBTASKS & CHECKLIST */}
                  {detailsTab === 'subtasks' && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-theme-text uppercase tracking-wider flex items-center gap-1.5 font-display">
                          <Layers className="w-3.5 h-3.5 text-blue-500" />
                          <span>Sub-tasks & Checklist Breakdown</span>
                        </span>
                        {subtasks.length > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-full font-mono">
                            {subtasks.length} {subtasks.length === 1 ? 'item' : 'items'}
                          </span>
                        )}
                      </div>

                      {/* Add subtask bar */}
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Add deliverable or step..."
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                          className="flex-1 text-xs px-3 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <select
                          value={newSubtaskMinutes}
                          onChange={(e) => setNewSubtaskMinutes(Number(e.target.value))}
                          className="text-xs px-2 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-bold font-mono"
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
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-all active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>

                      {/* Subtasks List */}
                      {subtasks.length === 0 ? (
                        <div className="p-8 text-center text-xs text-theme-muted border border-dashed border-theme-border rounded-xl">
                          No subtasks added yet. Break down this task into time-boxed steps.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {subtasks.map((st, idx) => (
                            <div key={st.id || idx} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-theme-card-hover border border-theme-border/70">
                              <span className="text-theme-text font-medium flex items-center gap-1.5 truncate">
                                <CornerDownRight className="w-3 h-3 text-purple-500 shrink-0" />
                                <span className="truncate">{st.title}</span>
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] font-mono font-bold text-theme-muted bg-theme-card px-1.5 py-0.5 rounded border border-theme-border">
                                  {st.assignedTimeMin || 30}m
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSubtasks(subtasks.filter((_, i) => i !== idx))}
                                  className="text-rose-500 hover:text-rose-700 p-1 transition-colors cursor-pointer"
                                  title="Delete subtask"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB B: RECURRENCE ENGINE & PROPAGATION */}
                  {detailsTab === 'recurrence' && (
                    <div className="space-y-3 animate-fade-in">
                      
                      {/* Recurrence Rule Selector */}
                      <div className="space-y-1">
                        <label className="text-xs font-black text-theme-text uppercase tracking-wider block font-display">
                          Recurrence Schedule
                        </label>
                        <select
                          value={recurrence}
                          onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                          className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                        >
                          <option value="None">None (One-time Task)</option>
                          <option value="Daily">Daily</option>
                          <option value="Selected Days">Selected Days</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Yearly">Yearly</option>
                        </select>
                      </div>

                      {/* Selected Days Selector */}
                      {recurrence === 'Selected Days' && (
                        <div className="p-2.5 rounded-xl bg-theme-card-hover border border-theme-border space-y-1.5 animate-fade-in">
                          <label className="text-[11px] font-bold text-theme-text block">
                            Active Days of the Week:
                          </label>
                          <div className="flex gap-1 flex-wrap">
                            {SHORT_DAYS.map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => toggleDay(d)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  selectedDays.includes(d)
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-theme-card text-theme-muted hover:bg-theme-border'
                                }`}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 1st Occurrence Preview */}
                      {recurrence !== 'None' && firstOccurrencePreview && (
                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 font-medium">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>First Date: <strong>{firstOccurrencePreview} ({getDayOfWeekFromDate(firstOccurrencePreview)})</strong></span>
                          </span>
                          {firstOccurrencePreview === toISODateString(new Date()) ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              Starts Today
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                              Upcoming
                            </span>
                          )}
                        </div>
                      )}

                      {/* Recurring Scope Protection (When Editing Recurring Task) */}
                      {isEditing && taskToEdit?.recurrence && taskToEdit.recurrence !== 'None' && (
                        <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1 font-display">
                              <Repeat className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Recurring Scope Protection</span>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setRecurringEditScope('single')}
                              className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                                recurringEditScope === 'single'
                                  ? 'bg-white dark:bg-slate-900 border-indigo-600 ring-2 ring-indigo-500/40 shadow-xs font-bold'
                                  : 'bg-theme-card/60 border-theme-border opacity-70 hover:opacity-100'
                              }`}
                            >
                              <div className="font-bold text-theme-text text-xs">📅 Only Today</div>
                              <div className="text-[10px] text-theme-muted mt-0.5">Future dates stay original.</div>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRecurringEditScope('series')}
                              className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                                recurringEditScope === 'series'
                                  ? 'bg-white dark:bg-slate-900 border-indigo-600 ring-2 ring-indigo-500/40 shadow-xs font-bold'
                                  : 'bg-theme-card/60 border-theme-border opacity-70 hover:opacity-100'
                              }`}
                            >
                              <div className="font-bold text-theme-text text-xs">🔄 Master Series</div>
                              <div className="text-[10px] text-theme-muted mt-0.5">Updates rule everywhere.</div>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* God Admin Series Scope & Propagation Options */}
                      {(isMasterRecurringSeriesAdmin || (isEditing && recurringEditScope === 'series')) && (
                        <div className="p-3 rounded-xl bg-theme-card-hover border border-theme-border/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-theme-muted">Propagation Window:</span>
                            <div className="flex items-center gap-1 bg-theme-card p-1 rounded-lg border border-theme-border">
                              <button
                                type="button"
                                onClick={() => setSeriesPropagateScope('all')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                  seriesPropagateScope === 'all'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-theme-muted hover:text-theme-text'
                                }`}
                              >
                                All Dates
                              </button>
                              <button
                                type="button"
                                onClick={() => setSeriesPropagateScope('future')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                  seriesPropagateScope === 'future'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-theme-muted hover:text-theme-text'
                                }`}
                              >
                                From Today Onward
                              </button>
                            </div>
                          </div>

                          <label className="flex items-center gap-2 pt-1 text-[11px] text-theme-muted hover:text-theme-text cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={seriesClearExclusions}
                              onChange={(e) => setSeriesClearExclusions(e.target.checked)}
                              className="w-3.5 h-3.5 rounded border-theme-border text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span>Restore / Clear all skipped & excluded dates</span>
                          </label>
                        </div>
                      )}

                    </div>
                  )}

                  {/* TAB C: PLAN, DOCS & KNOWLEDGE */}
                  {detailsTab === 'knowledge' && (
                    <div className="space-y-3 animate-fade-in">
                      
                      {/* Plan / Project Folder Assignment */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-theme-text flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-purple-500" />
                            <span>Plan / Project Folder</span>
                          </label>
                          {planProjectId && (
                            <button
                              type="button"
                              onClick={() => setPlanProjectId(undefined)}
                              className="text-[10px] text-rose-500 hover:underline cursor-pointer font-semibold"
                            >
                              Clear Assignment
                            </button>
                          )}
                        </div>

                        <select
                          value={planProjectId || ''}
                          onChange={(e) => {
                            const val = e.target.value || undefined;
                            setPlanProjectId(val);
                            if (val) {
                              const matchedFolder = planProjects.find(p => p.id === val);
                              if (matchedFolder && (!category || category === 'Unknown' || category === taskDefaults.defaultCategory)) {
                                setCategory(matchedFolder.category);
                                setHasConfirmedCategory(true);
                              }
                            }
                          }}
                          className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">-- No Plan / Project (Stand-alone Task) --</option>
                          {planProjects.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.type === 'plan' ? '🎯 [PLAN]' : '💼 [PROJECT]'} {folder.code} • {folder.title} (Deadline: {folder.endDate})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Unified Links & Docs */}
                      <div className="space-y-1.5 pt-2 border-t border-theme-border/50">
                        <label className="text-[11px] font-bold text-theme-text flex items-center gap-1.5">
                          <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
                          <span>Attach Document or Web Link</span>
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Title..."
                            value={newLinkTitle}
                            onChange={(e) => setNewLinkTitle(e.target.value)}
                            className="w-1/3 text-xs px-2.5 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none"
                          />
                          <input
                            type="url"
                            placeholder="https://..."
                            value={newLinkUrl}
                            onChange={(e) => setNewLinkUrl(e.target.value)}
                            className="flex-1 text-xs px-2.5 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleAddLink}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            Attach
                          </button>
                        </div>

                        {links.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {links.map((lnk) => (
                              <span key={lnk.id} className="inline-flex items-center gap-1.5 text-xs bg-theme-card-hover border border-theme-border px-2.5 py-1 rounded-lg text-theme-text shadow-2xs">
                                <LinkIcon className="w-3 h-3 text-blue-500" />
                                <a href={lnk.url} target="_blank" rel="noreferrer" className="hover:underline font-medium text-blue-600 dark:text-blue-400">
                                  {lnk.title}
                                </a>
                                <button type="button" onClick={() => handleRemoveLink(lnk.id)} className="text-rose-500 hover:text-rose-700 ml-1 cursor-pointer">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Extended Notes Management */}
                      <div className="space-y-1.5 pt-2 border-t border-theme-border/50">
                        <label className="text-[11px] font-bold text-theme-text flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-500" />
                          <span>Notes & Knowledge Base Link</span>
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Key technical insights, execution findings or checklist notes..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                    </div>
                  )}

                  {/* TAB D: SCIENTIFIC BUFFER & 24H LIFE DIARY */}
                  {detailsTab === 'buffer_diary' && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-theme-text uppercase tracking-wider flex items-center gap-1.5 font-display">
                          <Coffee className="w-3.5 h-3.5 text-amber-500" />
                          <span>Post-Task Buffer & Life Diary</span>
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 rounded-full font-mono">
                          24H Continuity
                        </span>
                      </div>

                      {/* Scientific Buffer Explanation */}
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1 text-xs text-amber-950 dark:text-amber-200">
                        <p className="font-bold flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Zero Unnoted Time Principle</span>
                        </p>
                        <p className="text-[11px] text-theme-muted leading-relaxed">
                          Between scheduled tasks, transitions and rest must be accounted for in your 24H Life Diary so no time goes unnoted.
                        </p>
                      </div>

                      {/* Buffer Window Overview */}
                      <div className="p-3 rounded-xl bg-theme-card-hover border border-theme-border space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-theme-muted font-bold">Post-Task Window:</span>
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                            {endTime} → {addMinutesToTime(endTime, bufferMinutes > 0 ? bufferMinutes : 15)}
                          </span>
                        </div>

                        {/* Buffer Minutes Quick Buttons */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-theme-muted font-semibold">Cushion:</span>
                          {[0, 5, 10, 15, 20, 30].map(mins => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => setBufferMinutes(mins)}
                              className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                bufferMinutes === mins
                                  ? 'bg-amber-500 text-white shadow-2xs'
                                  : 'bg-theme-card hover:bg-theme-border border border-theme-border text-theme-muted hover:text-theme-text'
                              }`}
                            >
                              {mins === 0 ? 'Off' : `+${mins}m`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Existing Linked Note Card OR Add New Note Prompt */}
                      {linkedBufferNote ? (
                        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 space-y-2 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">📝</span>
                              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 font-display">
                                Logged Life Diary Note
                              </span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono">
                              {linkedBufferNote.activityTag}
                            </span>
                          </div>

                          <div className="text-xs text-theme-text font-medium bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-lg border border-emerald-500/20">
                            "{linkedBufferNote.notes || 'Mindful recovery & transition'}"
                          </div>

                          <div className="flex items-center justify-between pt-1 text-[11px] text-theme-muted">
                            <span>Window: {linkedBufferNote.startTime} - {linkedBufferNote.endTime} ({linkedBufferNote.durationMinutes}m)</span>
                            <button
                              type="button"
                              onClick={() => openBufferNoteModal({ existingNote: linkedBufferNote })}
                              className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              Edit Note →
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-amber-800 dark:text-amber-300">
                              No Diary Note Logged for This Transition
                            </span>
                            <span className="text-[10px] font-mono text-theme-muted font-bold">
                              {bufferMinutes > 0 ? `${bufferMinutes}m Free` : 'No Cushion'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              openBufferNoteModal({
                                relatedTaskId: taskToEdit?.id,
                                relatedTaskTitle: title || taskToEdit?.title || 'Task Buffer',
                                date: taskDate,
                                startTime: endTime,
                                durationMinutes: bufferMinutes > 0 ? bufferMinutes : 15,
                                activityTag: category === 'VRTX' ? 'Deep Focus Buffer' : 'Break / Rest',
                                notes: `Post-task transition & recovery after ${title || 'task'}`
                              });
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-600 hover:to-emerald-700 text-white text-xs font-black shadow-xs flex items-center justify-center gap-1.5 transition-all transform active:scale-95 cursor-pointer"
                          >
                            <Coffee className="w-3.5 h-3.5" />
                            <span>Log Post-Task Buffer Diary Note ({bufferMinutes > 0 ? bufferMinutes : 15}m)</span>
                          </button>
                        </div>
                      )}

                    </div>
                  )}

                </div>

                {/* Description & Lifecycle Status Block */}
                <div className="p-4 rounded-2xl bg-theme-card border border-theme-border space-y-3 shadow-xs">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider">
                      Description & Custom Writing
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Detailed objectives, expected deliverables or context..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-theme-text uppercase tracking-wider">
                      Lifecycle Execution Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TaskStatus)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
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

              </div>

            </div>

          </div>

          {/* =========================================================================
              STICKY FOOTER (Live Telemetry HUD & Primary Actions)
          ========================================================================= */}
          <div className="p-4 sm:p-5 border-t border-theme-border bg-theme-card/95 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-theme-muted flex items-center gap-2 flex-wrap">
              <span className="font-black px-2 py-0.5 rounded font-mono text-[11px]" style={{ backgroundColor: priorityMeta?.bgColor, color: priorityMeta?.color }}>
                {priority}
              </span>
              <span className="font-mono font-bold text-theme-text">
                {appointedMinutes}m (+{bufferMinutes}m buffer)
              </span>
              <span>•</span>
              <span className="font-mono text-theme-text font-bold">
                {formatDisplayDate(taskDate)} @ {startTime} → {endTime}
              </span>
              {taskCrossesMidnight(startTime, endTime) && (
                <span className="font-mono text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 rounded-full border border-purple-300 dark:border-purple-800 flex items-center gap-1">
                  <Moon className="w-2.5 h-2.5" />
                  <span>Spans to Next Day</span>
                </span>
              )}
              {isMasterRecurringSeriesAdmin && (
                <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-full border border-blue-500/25">
                  👑 Master Series
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-theme-muted hover:text-theme-text rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSave(false)}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-500/25 transition-all transform active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isMasterRecurringSeriesAdmin || (isEditing && recurringEditScope === 'series')
                    ? (isEditing ? '👑 Save Master Series Everywhere' : '👑 Create Master Recurring Series')
                    : (isEditing ? 'Save Changes' : 'Schedule Task')}
                </span>
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

      {/* Huge Warning Interceptor Modal: Scheduling Before Current Time */}
      {showPastTimeModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-theme-card border-2 border-red-500/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            
            {/* Header */}
            <div className="flex items-start gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30 shrink-0 ring-4 ring-red-400/20 animate-pulse">
                <AlertOctagon className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 tracking-wider">
                    CRITICAL INTERCEPTOR
                  </span>
                </div>
                <h3 className="text-base font-black text-theme-text tracking-tight mt-0.5">
                  🚨 Warning: Scheduling Before Current Time!
                </h3>
                <p className="text-xs text-theme-muted font-medium">
                  OptimusTime is a live forward-planning system. This entry starts before right now.
                </p>
              </div>
            </div>

            {/* Comparison Box */}
            <div className="p-4 rounded-2xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 space-y-2.5">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-black/40 border border-red-200/60 dark:border-red-900/40">
                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400 block uppercase tracking-wider">
                    Scheduled Start:
                  </span>
                  <strong className="text-xs font-mono text-theme-text block mt-0.5">
                    {formatDisplayDate(taskDate)} @ {startTime}
                  </strong>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-black/40 border border-theme-border">
                  <span className="text-[10px] font-bold text-theme-muted block uppercase tracking-wider">
                    Current Time (Now):
                  </span>
                  <strong className="text-xs font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5">
                    {formatDisplayDate(pastTimeCheck.todayStr)} @ {pastTimeCheck.currentTimeStr}
                  </strong>
                </div>
              </div>

              <div className="text-[11px] text-theme-muted bg-theme-card/60 p-2.5 rounded-xl border border-theme-border">
                ⚠️ This entry is <strong className="text-red-600 dark:text-red-400">{pastTimeCheck.diffMinutes >= 1440 ? `${Math.round(pastTimeCheck.diffMinutes / 1440)} day(s)` : `${pastTimeCheck.diffMinutes} minutes`}</strong> in the past. If scheduled, it will immediately be marked as expired / overdue.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleAdjustToNextFreeSlot}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <div className="text-left">
                    <div>⚡ Auto-Adjust to Next Free Slot / Now</div>
                    <div className="text-[10px] font-normal text-blue-100">Recommended: Automatically moves start time to next open gap today</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={handleShiftToTomorrow}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/70 dark:hover:bg-amber-900/30 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 font-bold text-xs transition-all"
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-amber-600" />
                  <div className="text-left">
                    <div>📅 Shift to Tomorrow ({tomorrowStr} @ {startTime})</div>
                    <div className="text-[10px] font-normal text-amber-700 dark:text-amber-400">Keep same hour ({startTime}) but schedule on tomorrow</div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleConfirmPastEntry}
                className="w-full p-2.5 rounded-xl border border-red-300 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 font-bold text-xs transition-colors"
              >
                ⚠️ Yes, Log Past Entry Anyway (Retroactive Record)
              </button>

              <button
                type="button"
                onClick={() => setShowPastTimeModal(false)}
                className="w-full py-2 text-xs font-semibold text-theme-muted hover:text-theme-text transition-colors text-center"
              >
                Cancel & Adjust Manually
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
