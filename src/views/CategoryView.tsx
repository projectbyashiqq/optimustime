import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Task, Category, PriorityLevel, TaskStatus } from '../types';
import { 
  findScheduleGaps, 
  toISODateString, 
  getDayOfWeekFromDate, 
  parse12HourToMinutes, 
  formatMinutesTo12Hour,
  addMinutesToTime, 
  isTaskScheduledForDate, 
  TimeGap, 
  isTaskInRunningSlot, 
  isTaskPastDue, 
  findSimultaneousTasks, 
  getTaskTitleClasses,
  isTaskInSleepWindow,
  getTimePeriodForTime,
  formatDisplayDate,
  taskCrossesMidnight,
  getTaskEndDate,
  getBangladeshNow,
  formatBangladeshTime,
  getScientificDynamicGapSlots,
  ScientificGapSlot,
  isNoTimeTask,
  formatDurationHuman
} from '../utils/timeUtils';
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Layers, 
  Calendar, 
  Flame, 
  Sparkles, 
  Edit2, 
  Trash2, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Timer, 
  Hourglass, 
  X, 
  Bell, 
  StickyNote,
  RotateCcw, 
  Zap,
  Coffee,
  Repeat,
  Lock,
  Moon,
  FolderKanban,
  User,
  Cpu,
  Globe,
  Briefcase,
  BookOpen,
  FileText,
  ShieldCheck,
  Sunrise,
  BarChart3
} from 'lucide-react';
import { RescheduleModal } from '../components/RescheduleModal';

interface CategoryViewProps {
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string, projectCode?: string, category?: string) => void;
}

export type CategoryDashboardMode = 'time' | 'priority';

const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'Zap': return Zap;
    case 'User': return User;
    case 'Cpu': return Cpu;
    case 'Globe': return Globe;
    case 'Briefcase': return Briefcase;
    case 'BookOpen': return BookOpen;
    case 'Bell': return Bell;
    case 'FileText': return FileText;
    default: return FolderKanban;
  }
};

export const CategoryView: React.FC<CategoryViewProps> = ({ onOpenTaskModal }) => {
  const { 
    categories, 
    tasks, 
    prioritySettings, 
    capacitySettings, 
    startTask, 
    pauseTask, 
    completeTask, 
    addTask,
    updateTask, 
    rescheduleTask, 
    requestDeleteTask, 
    detectConflicts, 
    searchQuery: globalSearchQuery, 
    dailyScheduledMinutes, 
    isCapacityRedLineExceeded, 
    bufferNotes, 
    openBufferNoteModal, 
    timePeriodSettings, 
    defaultTaskSettings, 
    openRecurringHub 
  } = useApp();

  // Active Category State
  const [selectedCatId, setSelectedCatId] = useState<string>(() => categories[0]?.id || '');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('ALL');

  // Dashboard Control State
  const [dashboardMode, setDashboardMode] = useState<CategoryDashboardMode>('time');
  const [selectedDate, setSelectedDate] = useState<string>(() => toISODateString(getBangladeshNow()));
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [showPriorityBacklog, setShowPriorityBacklog] = useState(false);
  const [showCompletedSection, setShowCompletedSection] = useState(true);
  const [reschedulingTask, setReschedulingTask] = useState<Task | null>(null);
  const [nowTime, setNowTime] = useState<Date>(() => getBangladeshNow());
  const [slotDecomposition, setSlotDecomposition] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('optimustime_slot_decomposition');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [gapDateFilter, setGapDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'deep_focus' | 'quick'>('all');

  // Live Clock (BST)
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(getBangladeshNow());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Ensure current category is valid
  const currentCategory = useMemo(() => {
    return categories.find(c => c.id === selectedCatId) || categories[0];
  }, [categories, selectedCatId]);

  useEffect(() => {
    if (!categories.some(c => c.id === selectedCatId) && categories.length > 0) {
      setSelectedCatId(categories[0].id);
    }
  }, [categories, selectedCatId]);

  // Reset sub-category filter on category change
  useEffect(() => {
    setSelectedSubCat('ALL');
  }, [selectedCatId]);

  if (!currentCategory) {
    return <div className="p-8 text-center text-theme-muted font-bold">No categories found in system.</div>;
  }

  const categoryColor = currentCategory.color || '#3b82f6';
  const IconComponent = getCategoryIcon(currentCategory.iconName);

  // Live Clock formatting
  const bdTime = formatBangladeshTime(nowTime);
  const liveTimeClean = bdTime.timeClean;
  const liveSeconds = bdTime.seconds;
  const livePeriod = bdTime.period;
  const dayOfWeek = getDayOfWeekFromDate(selectedDate);
  const isSelectedToday = selectedDate === toISODateString(nowTime);
  const currentMinutesFromMidnight = nowTime.getHours() * 60 + nowTime.getMinutes();

  // All tasks in this category
  const allCategoryTasks = useMemo(() => {
    return tasks.filter(t => t.category === currentCategory.name);
  }, [tasks, currentCategory.name]);

  const totalTasksCount = allCategoryTasks.length;
  const completedCount = allCategoryTasks.filter(t => t.status === 'Done').length;
  const totalBudgetMinutes = allCategoryTasks.reduce((acc, t) => acc + (t.appointedMinutes || 0), 0);
  const totalActualMinutes = allCategoryTasks.reduce((acc, t) => acc + (t.totalActualMinutes || 0), 0);
  const progressPercent = totalTasksCount > 0 ? Math.round((completedCount / totalTasksCount) * 100) : 0;

  // Filter tasks for selected date under this category (and sub-category if filtered)
  const categoryDateTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.category !== currentCategory.name) return false;
      if (!isTaskScheduledForDate(t, selectedDate)) return false;
      if (selectedSubCat !== 'ALL' && t.subCategory !== selectedSubCat) return false;
      return true;
    }).sort((a, b) => {
      const aIncomplete = a.status === 'Incomplete';
      const bIncomplete = b.status === 'Incomplete';
      if (aIncomplete !== bIncomplete) return aIncomplete ? 1 : -1;

      const aNoTime = isNoTimeTask(a);
      const bNoTime = isNoTimeTask(b);
      if (aNoTime !== bNoTime) return aNoTime ? 1 : -1;

      if (dashboardMode === 'priority') {
        const pWeight: Record<PriorityLevel, number> = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };
        if (pWeight[a.priority] !== pWeight[b.priority]) {
          return pWeight[a.priority] - pWeight[b.priority];
        }
        return parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime);
      }

      return parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime);
    });
  }, [tasks, currentCategory.name, selectedDate, selectedSubCat, dashboardMode]);

  // Priority Backlog strictly for THIS category
  const categoryPriorityBacklog = useMemo(() => {
    return allCategoryTasks.filter(t => t.status === 'Incomplete' || t.status === 'Hold').sort((a, b) => {
      const pWeight: Record<PriorityLevel, number> = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };
      if (pWeight[a.priority] !== pWeight[b.priority]) {
        return pWeight[a.priority] - pWeight[b.priority];
      }
      return a.taskDate.localeCompare(b.taskDate);
    });
  }, [allCategoryTasks]);

  // Centralized Gaps Engine (Avoids ALL tasks + sleep across system)
  const wakingStart = capacitySettings.dayStartTime || '06:00 AM';
  const wakingEnd = capacitySettings.dayEndTime || '11:00 PM';
  const scheduledDateTasks = tasks.filter(t => isTaskScheduledForDate(t, selectedDate));
  const rawGaps: TimeGap[] = useMemo(() => {
    return findScheduleGaps(
      scheduledDateTasks,
      wakingStart,
      wakingEnd,
      bufferNotes.filter(n => n.date === selectedDate),
      capacitySettings.defaultBufferMinutes ?? 0,
      capacitySettings.sleepStartTime,
      capacitySettings.sleepEndTime
    );
  }, [scheduledDateTasks, wakingStart, wakingEnd, bufferNotes, selectedDate, capacitySettings]);

  // Scientific Dynamic Gap Slots (Centralized)
  const scientificSlots: ScientificGapSlot[] = useMemo(() => {
    return getScientificDynamicGapSlots({
      selectedDate,
      tasks,
      bufferNotes,
      capacitySettings,
      timePeriodSettings,
      minSlots: 10,
      currentMinutes: currentMinutesFromMidnight,
      referenceDate: nowTime,
      decomposeUltradian: slotDecomposition
    });
  }, [selectedDate, tasks, bufferNotes, capacitySettings, timePeriodSettings, currentMinutesFromMidnight, nowTime, slotDecomposition]);

  const filteredSlots = useMemo(() => {
    return scientificSlots.filter(s => {
      if (gapDateFilter === 'today') return s.isToday;
      if (gapDateFilter === 'tomorrow') return s.isTomorrow;
      if (gapDateFilter === 'deep_focus') return s.durationMinutes >= 60;
      if (gapDateFilter === 'quick') return s.durationMinutes < 45;
      return true;
    });
  }, [scientificSlots, gapDateFilter]);

  const heroSpotlightSlot = filteredSlots.find(s => s.isImmediate) || filteredSlots[0] || null;
  const listSlots = heroSpotlightSlot ? filteredSlots.filter(s => s.slotId !== heroSpotlightSlot.slotId) : filteredSlots;

  const datewiseGroups = useMemo(() => {
    const map = new Map<string, {
      date: string;
      dateLabel: string;
      dayOfWeek: string;
      isToday: boolean;
      isTomorrow: boolean;
      slots: ScientificGapSlot[];
      totalFreeMinutes: number;
    }>();

    for (const s of listSlots) {
      const existing = map.get(s.date);
      if (existing) {
        existing.slots.push(s);
        existing.totalFreeMinutes += s.durationMinutes;
      } else {
        map.set(s.date, {
          date: s.date,
          dateLabel: s.dateLabel,
          dayOfWeek: s.dayOfWeek,
          isToday: s.isToday,
          isTomorrow: s.isTomorrow,
          slots: [s],
          totalFreeMinutes: s.durationMinutes
        });
      }
    }
    return Array.from(map.values());
  }, [listSlots]);

  // Unstarted pending tasks on Today for this category
  const unstartedCategoryTasks = isSelectedToday
    ? categoryDateTasks.filter(t => t.status === 'Pending' && parse12HourToMinutes(t.startTime) <= currentMinutesFromMidnight)
    : [];

  // Capacity & Load stats
  const scheduledMinsOnDayAll = dailyScheduledMinutes(selectedDate);
  const categoryScheduledMins = categoryDateTasks.reduce((acc, t) => acc + (t.appointedMinutes || 0), 0);
  const maxCapacityMins = (capacitySettings.maxWorkHours || 14) * 60;
  const categoryCapacityPercent = maxCapacityMins > 0 ? Math.min(100, Math.round((categoryScheduledMins / maxCapacityMins) * 100)) : 0;

  // Reschedule Handlers
  const handleConfirmReschedule = (taskToReschedule: Task, newDate: string, newStartTime: string, newEndTime: string, scope: 'single' | 'series' = 'single') => {
    if (taskToReschedule.recurrence && taskToReschedule.recurrence !== 'None') {
      rescheduleTask(taskToReschedule.id, newDate, newStartTime, taskToReschedule.taskDate, scope);
    } else {
      updateTask({
        ...taskToReschedule,
        taskDate: newDate,
        dayOfWeek: getDayOfWeekFromDate(newDate),
        startTime: newStartTime,
        endTime: newEndTime,
        status: 'Pending',
        isSimultaneous: false,
        simultaneousWithIds: [],
        rescheduleCount: (taskToReschedule.rescheduleCount || 0) + 1,
        lastRescheduledAt: new Date().toISOString(),
        originalScheduledDate: newDate,
        originalScheduledStartTime: newStartTime,
        originalScheduledEndTime: newEndTime,
        startDiscrepancyMinutes: 0
      });
    }
    setReschedulingTask(null);
  };

  const handleStatusChange = (task: Task, newStatus: TaskStatus) => {
    if (newStatus === 'Reschedule') {
      if (task.isMandatorySchedule) {
        alert(`🔒 Mandatory Schedule: "${task.title}" is a locked fixed event and cannot be rescheduled.`);
        return;
      }
      setReschedulingTask(task);
      return;
    }
    updateTask({ ...task, status: newStatus });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* ========================================================================= */}
      {/* 1. TOP CATEGORY SWITCHER CAPSULE BAR                                      */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => {
          const isSelected = cat.id === currentCategory.id;
          const CatIcon = getCategoryIcon(cat.iconName);
          const taskCount = tasks.filter(t => t.category === cat.name).length;
          const hasWorking = tasks.some(t => t.category === cat.name && t.status === 'Working');

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                  : 'bg-theme-card hover:bg-theme-card-hover text-theme-muted hover:text-theme-text border-theme-border'
              }`}
            >
              <CatIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-blue-500'}`} />
              <span>{cat.name}</span>
              {hasWorking && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" title="Active Task Running" />
              )}
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                isSelected ? 'bg-white/20 text-white' : 'bg-theme-card-hover text-theme-muted border border-theme-border'
              }`}>
                {taskCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 2. CATEGORY DASHBOARD TOP BAR (IDENTICAL TO MAIN DASHBOARD TOP BAR)      */}
      {/* ========================================================================= */}
      <div className="glass-panel p-2 sm:px-3 sm:py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 sm:gap-2.5 border border-theme-border shadow-sm">
        
        {/* Left Side: Apple-Graded Unified Date & Live Time Capsule */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
          
          {/* Category Badge Pill */}
          <div 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white font-bold text-xs shadow-sm shrink-0"
            style={{ backgroundColor: categoryColor }}
          >
            <IconComponent className="w-3.5 h-3.5" />
            <span>{currentCategory.name}</span>
            <span className="text-[10px] font-mono opacity-80">Dashboard</span>
          </div>

          {/* Unified Date & Live Time Capsule */}
          <div 
            onClick={() => {
              try {
                dateInputRef.current?.showPicker();
              } catch {
                dateInputRef.current?.focus();
              }
            }}
            className="flex items-center gap-2 bg-theme-card/90 dark:bg-slate-900/80 hover:bg-theme-card hover:border-blue-500/60 px-3 py-1.5 rounded-xl border border-theme-border/80 shrink-0 cursor-pointer transition-all shadow-2xs hover:shadow-xs group active:scale-98 relative select-none whitespace-nowrap"
            title="Click to select date"
          >
            <div className="p-1 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 group-hover:scale-105 transition-all shrink-0">
              <Calendar className="w-3.5 h-3.5" />
            </div>

            <span className="font-display font-black text-sm text-theme-text tracking-tight whitespace-nowrap">
              {formatDisplayDate(selectedDate)}
            </span>

            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono uppercase tracking-wider whitespace-nowrap shrink-0">
              {dayOfWeek.slice(0, 3)}
            </span>

            <div className="h-3.5 w-px bg-theme-border/80 shrink-0 mx-0.5" />

            {/* Live Clock */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </div>
              <div className="flex items-baseline font-mono tabular-nums font-black text-xs sm:text-sm text-theme-text tracking-tight whitespace-nowrap">
                <span>{liveTimeClean}</span>
                <span className="text-[9px] font-bold text-theme-muted opacity-80 ml-0.5">:{liveSeconds}</span>
                <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 ml-1 uppercase">{livePeriod}</span>
              </div>
            </div>

            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="!absolute inset-0 opacity-0 pointer-events-none w-full h-full cursor-pointer"
            />
          </div>

          {/* Today / Tomorrow Switcher */}
          {(() => {
            const todayBdStr = toISODateString(getBangladeshNow());
            const tomorrowBdDate = getBangladeshNow();
            tomorrowBdDate.setDate(tomorrowBdDate.getDate() + 1);
            const tomorrowBdStr = toISODateString(tomorrowBdDate);

            return (
              <div className="flex items-center gap-0.5 p-0.5 bg-theme-card-hover/90 rounded-xl border border-theme-border/70 shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayBdStr)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    selectedDate === todayBdStr
                      ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                      : 'text-theme-muted hover:text-theme-text hover:bg-theme-card/50'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(tomorrowBdStr)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    selectedDate === tomorrowBdStr
                      ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                      : 'text-theme-muted hover:text-theme-text hover:bg-theme-card/50'
                  }`}
                >
                  Tomorrow
                </button>
              </div>
            );
          })()}

          {/* Priority Backlog for this Category */}
          {categoryPriorityBacklog.length > 0 && (
            <button
              onClick={() => setShowPriorityBacklog(!showPriorityBacklog)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all shadow-sm ${
                showPriorityBacklog
                  ? 'bg-gradient-to-r from-red-500 to-amber-500 text-white ring-1 ring-red-400/40'
                  : 'bg-theme-card-hover text-theme-text hover:bg-theme-border border border-theme-border'
              }`}
              title="Toggle Incomplete & Hold Priority Queue for this category"
            >
              <Flame className={`w-3.5 h-3.5 shrink-0 ${showPriorityBacklog ? 'text-white' : 'text-red-500'}`} />
              <span className="whitespace-nowrap">{currentCategory.name} Priority Queue</span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                showPriorityBacklog ? 'bg-white/25 text-white' : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
              }`}>
                {categoryPriorityBacklog.length}
              </span>
            </button>
          )}

          {/* + Buffer Note */}
          <button
            onClick={() => openBufferNoteModal({ date: selectedDate })}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl shadow-sm transition-all transform active:scale-95 shrink-0 whitespace-nowrap"
            title="Log Free-Time Buffer Note"
          >
            <Plus className="w-3 h-3 stroke-[3]" />
            <Coffee className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Side: Mode Switcher & Primary Schedule CTA */}
        <div className="flex items-center gap-2 shrink-0 ml-auto pt-1 sm:pt-0">
          <div className="flex items-center gap-0.5 p-0.5 bg-theme-card-hover/80 rounded-full border border-theme-border/80 shadow-2xs shrink-0">
            <button
              onClick={() => setDashboardMode('time')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer active:scale-95 ${
                dashboardMode === 'time'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-white/20'
                  : 'text-theme-muted hover:text-theme-text hover:bg-theme-card/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Time based</span>
            </button>

            <button
              onClick={() => setDashboardMode('priority')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer active:scale-95 ${
                dashboardMode === 'priority'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-white/20'
                  : 'text-theme-muted hover:text-theme-text hover:bg-theme-card/50'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Priority Based</span>
            </button>
          </div>

          <button
            onClick={() => onOpenTaskModal(undefined, selectedDate, undefined, (currentCategory as any).projectCode, currentCategory.name)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-full shadow-sm shadow-blue-600/30 transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Schedule in {currentCategory.name}</span>
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. SUB-ENTITIES FILTER PILLS (FROM USER'S SCREENSHOT)                     */}
      {/* ========================================================================= */}
      {currentCategory.subCategories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-bold text-theme-muted uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span>Sub-Entities:</span>
          </span>
          <button
            onClick={() => setSelectedSubCat('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              selectedSubCat === 'ALL'
                ? 'bg-theme-text text-theme-bg shadow-sm'
                : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
            }`}
          >
            All Sub-entities ({allCategoryTasks.length})
          </button>
          {currentCategory.subCategories.map((sub, idx) => {
            const subCount = allCategoryTasks.filter(t => t.subCategory === sub).length;
            const isSubSelected = selectedSubCat === sub;
            return (
              <button
                key={idx}
                onClick={() => setSelectedSubCat(sub)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isSubSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
                }`}
              >
                <span>{sub}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSubSelected ? 'bg-white/20 text-white' : 'bg-theme-card-hover text-theme-muted'
                }`}>
                  {subCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PRIORITY BACKLOG DRAWER (INCOMPLETE & HOLD TASKS IN THIS CATEGORY)     */}
      {/* ========================================================================= */}
      {showPriorityBacklog && (
        <div className="glass-panel p-5 rounded-2xl border-2 border-red-400/50 dark:border-red-700 shadow-xl space-y-4 animate-slide-up bg-red-50/15 dark:bg-red-950/10">
          <div className="flex items-center justify-between border-b border-theme-border pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/25">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-theme-text font-display flex items-center gap-2">
                  <span>{currentCategory.name} Priority Queue: Incomplete & Hold</span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300">
                    {categoryPriorityBacklog.length} Tasks
                  </span>
                </h3>
                <p className="text-xs text-theme-muted">
                  Strictly prioritized (P1 Must-Do to P5 Noise) in {currentCategory.name}.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPriorityBacklog(false)}
              className="p-1.5 rounded-lg hover:bg-theme-card text-theme-muted hover:text-theme-text transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
            {categoryPriorityBacklog.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-xl border bg-theme-card shadow-2xs space-y-2 border-red-300 dark:border-red-900/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                    {t.projectCode}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">
                    {t.status}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-theme-text line-clamp-1">{t.title}</h4>
                <div className="flex items-center justify-between pt-1 border-t border-theme-border text-xs">
                  <span className="font-mono text-theme-muted font-semibold text-[11px]">
                    {formatDisplayDate(t.taskDate)} • {t.appointedMinutes}m
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => startTask(t.id)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-sm"
                    >
                      Start
                    </button>
                    <button
                      onClick={() => onOpenTaskModal(t)}
                      className="p-1 rounded hover:bg-theme-card-hover text-theme-muted hover:text-theme-text"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MAIN DASHBOARD 2-COLUMN GRID (TIMELINE ON LEFT, GAP FINDER ON RIGHT)  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ======================================================================= */}
        {/* LEFT COLUMN: DAY SCHEDULE TIMELINE (lg:col-span-2)                      */}
        {/* ======================================================================= */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Timeline Header & Count */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>{currentCategory.name} Day Schedule Timeline</span>
              <span className="text-xs font-normal text-theme-muted">
                ({categoryDateTasks.filter(t => t.status !== 'Done' && t.status !== 'Terminated').length} active • {categoryDateTasks.filter(t => t.status === 'Done' || t.status === 'Terminated').length} completed)
              </span>
            </h3>
            {categoryDateTasks.length > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Conflict-Free
              </span>
            )}
          </div>

          {/* Active Tasks List */}
          {categoryDateTasks.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center space-y-3 border border-dashed border-theme-border">
              <div 
                className="w-12 h-12 rounded-2xl text-white mx-auto flex items-center justify-center shadow-md"
                style={{ backgroundColor: categoryColor }}
              >
                <IconComponent className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-theme-text">No {currentCategory.name} Tasks Scheduled For {formatDisplayDate(selectedDate)}</h4>
              <p className="text-xs text-theme-muted max-w-sm mx-auto">
                Fill a free time slot in the Dynamic Gap Finder on the right to optimize daily productivity under {currentCategory.name}.
              </p>
              <button
                onClick={() => onOpenTaskModal(undefined, selectedDate, undefined, (currentCategory as any).projectCode, currentCategory.name)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors cursor-pointer"
              >
                + Schedule First Task in {currentCategory.name}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Active / In-Progress Tasks List */}
              {categoryDateTasks.filter(t => t.status !== 'Done' && t.status !== 'Terminated').length === 0 ? (
                <div className="p-6 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 text-center space-y-1">
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 font-display flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>All {currentCategory.name} Tasks For Today Are Completed! 🎉</span>
                  </div>
                  <p className="text-xs text-theme-muted">
                    Check completed tasks in the finished archive below or schedule new tasks.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {categoryDateTasks
                    .filter(t => t.status !== 'Done' && t.status !== 'Terminated')
                    .map((task, idx, arr) => {
                      const priorityMeta = prioritySettings[task.priority] || { bgColor: '#f1f5f9', color: '#475569' };
                      const isWorking = task.status === 'Working';
                      const isIncomplete = task.status === 'Incomplete';
                      const isCurrentRunningSlot = isTaskInRunningSlot(task.taskDate, task.startTime, task.endTime, nowTime);
                      const isRunning = isWorking || (task.status === 'Pending' && isCurrentRunningSlot);
                      const isDue = isIncomplete || 
                        (task.status === 'Pending' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, nowTime)) ||
                        (task.status === 'Working' && isTaskPastDue(task.taskDate, task.startTime, task.endTime, nowTime));
                      const isSimultaneous = Boolean(task.isSimultaneous);
                      const simultaneousList = isSimultaneous ? findSimultaneousTasks(task, categoryDateTasks) : [];
                      const isInSleep = isTaskInSleepWindow(task, capacitySettings);
                      const isNoTime = isNoTimeTask(task);
                      const period = getTimePeriodForTime(task.startTime, timePeriodSettings);

                      return (
                        <div
                          key={task.id}
                          className={`p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden ${
                            isDue
                              ? 'bg-red-50/30 dark:bg-red-950/20 border-red-300 dark:border-red-900/60 shadow-sm'
                              : isWorking
                                ? 'bg-theme-card border-blue-500/80 shadow-lg shadow-blue-500/15 ring-1 ring-blue-500/40 card-working-ambient'
                                : isRunning
                                  ? 'bg-theme-card border-blue-400/60 shadow-md ring-1 ring-blue-400/30'
                                  : isSimultaneous
                                    ? 'bg-theme-card border-purple-300 dark:border-purple-800 hover:shadow-md'
                                    : 'bg-theme-card border-theme-border hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
                            
                            {/* Left: Priority + Title + Times */}
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              
                              {/* Priority Badge */}
                              <div
                                className={`px-2.5 py-1.5 rounded-xl text-center font-black text-xs sm:text-sm min-w-[46px] shrink-0 flex items-center justify-center transition-all ${
                                  task.priority === 'P1'
                                    ? 'bg-gradient-to-tr from-rose-600 via-red-500 to-amber-400 text-white shadow-md shadow-red-500/30 ring-1 ring-red-400/80 border border-red-300 animate-pulse font-display'
                                    : 'font-mono border border-theme-border/60 shadow-2xs'
                                }`}
                                style={task.priority === 'P1' ? undefined : { backgroundColor: priorityMeta.bgColor, color: priorityMeta.color }}
                              >
                                {task.priority === 'P1' ? (
                                  <span className="flex items-center gap-0.5 tracking-tight font-black">
                                    <Sparkles className="w-3 h-3 text-yellow-200 fill-yellow-200" />
                                    <span>P1</span>
                                  </span>
                                ) : (
                                  <span className="font-bold">{task.priority}</span>
                                )}
                              </div>

                              <div className="space-y-1.5 flex-1 min-w-0">
                                
                                {/* Title + Duration */}
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <h4 className={getTaskTitleClasses(task.title, task.status === 'Done', false, isWorking)}>
                                    {task.title}
                                  </h4>
                                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md border text-theme-muted bg-theme-card-hover/80 border-theme-border shadow-2xs">
                                    ~{task.appointedMinutes}m
                                  </span>
                                </div>

                                {/* Time Window & Badges */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border text-theme-text bg-theme-card-hover border-theme-border">
                                    {task.startTime} – {task.endTime}
                                  </span>

                                  {period && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 shrink-0">
                                      <span>{period.emoji || '⏰'}</span>
                                      <span>{period.name}</span>
                                    </span>
                                  )}

                                  <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                                    {task.projectCode}
                                  </span>

                                  {task.subCategory && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 shrink-0">
                                      {task.subCategory}
                                    </span>
                                  )}

                                  {task.isMandatorySchedule && (
                                    <span className="text-[9px] font-black px-1.5 py-0.2 bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded border border-amber-500/30 flex items-center gap-0.5">
                                      <Lock className="w-2.5 h-2.5 text-amber-500" /> FIXED
                                    </span>
                                  )}

                                  {isWorking && (
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-blue-600 text-white rounded-full flex items-center gap-1 shrink-0 animate-pulse shadow-2xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                      <span>RUNNING NOW</span>
                                    </span>
                                  )}

                                  {isDue && (
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-red-600 text-white rounded-full flex items-center gap-1 shrink-0 animate-pulse shadow-2xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                      <span>{isIncomplete ? 'INCOMPLETE' : 'OVERDUE'}</span>
                                    </span>
                                  )}
                                </div>

                                {task.description && (
                                  <p className="text-xs text-theme-muted line-clamp-1">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Right Actions: Live Timer + Play/Pause + Reschedule + Edit */}
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-theme-border relative z-10 flex-wrap">
                              
                              {/* Live Countdown Stopwatch */}
                              {isWorking && (() => {
                                const lastLog = task.executionLogs?.[task.executionLogs.length - 1];
                                const startMs = lastLog ? new Date(lastLog.startedAt).getTime() : nowTime.getTime();
                                const elapsedSec = Math.max(0, Math.floor((nowTime.getTime() - startMs) / 1000));
                                const totalAppointedSec = task.appointedMinutes * 60;
                                const remainingSec = totalAppointedSec - elapsedSec;
                                const isOvertime = remainingSec < 0;
                                const absSec = Math.abs(remainingSec);
                                const m = Math.floor(absSec / 60);
                                const s = absSec % 60;
                                const timeFormatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                return (
                                  <span className={`text-[11px] font-mono font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-2xs ${
                                    isOvertime ? 'bg-amber-400 text-amber-950 animate-pulse font-black' : 'bg-blue-600 text-white'
                                  }`}>
                                    <Hourglass className="w-3 h-3 animate-spin" />
                                    <span>{isOvertime ? `+${timeFormatted}` : timeFormatted}</span>
                                  </span>
                                );
                              })()}

                              {/* Play / Pause / Done */}
                              {isWorking ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => pauseTask(task.id)}
                                    className="p-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 shadow-sm cursor-pointer"
                                    title="Pause Task"
                                  >
                                    <Pause className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => completeTask(task.id)}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                                    title="Mark Task as Done"
                                  >
                                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                    <span>Done</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startTask(task.id)}
                                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
                                >
                                  <Play className="w-3.5 h-3.5 fill-white stroke-[2]" />
                                  <span>Start</span>
                                </button>
                              )}

                              {/* Smart Reschedule Trigger (Opens Centralized Reschedule Modal) */}
                              {!task.isMandatorySchedule && (
                                <button
                                  onClick={() => setReschedulingTask(task)}
                                  className="p-2 rounded-xl hover:bg-theme-card-hover text-theme-muted hover:text-purple-600 border border-theme-border transition-colors cursor-pointer"
                                  title="Reschedule Task (Centralized Matrix)"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Edit Task in TaskModal */}
                              <button
                                onClick={() => onOpenTaskModal(task)}
                                className="p-2 rounded-xl hover:bg-theme-card-hover text-theme-muted hover:text-blue-600 border border-theme-border transition-colors cursor-pointer"
                                title="Edit Task"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Task */}
                              <button
                                onClick={() => requestDeleteTask(task, selectedDate)}
                                className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 border border-theme-border transition-colors cursor-pointer"
                                title="Delete Task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Completed & Finished Section (Collapsible) */}
              {categoryDateTasks.filter(t => t.status === 'Done' || t.status === 'Terminated').length > 0 && (
                <div className="pt-6 border-t border-theme-border space-y-3">
                  <div 
                    onClick={() => setShowCompletedSection(!showCompletedSection)}
                    className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-theme-card-hover/60 hover:bg-theme-card-hover text-theme-muted transition-colors border border-theme-border/60"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-black uppercase tracking-wider text-theme-text font-display">
                        Completed Tasks in {currentCategory.name} ({categoryDateTasks.filter(t => t.status === 'Done' || t.status === 'Terminated').length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold">
                      <span>{showCompletedSection ? 'Collapse' : 'Expand'}</span>
                      {showCompletedSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {showCompletedSection && (
                    <div className="space-y-2 opacity-75">
                      {categoryDateTasks
                        .filter(t => t.status === 'Done' || t.status === 'Terminated')
                        .map((task) => (
                          <div
                            key={task.id}
                            className="p-3 rounded-xl bg-theme-card border border-theme-border flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-xs text-theme-muted">{task.startTime}</span>
                              <span className="text-xs font-bold text-theme-text line-through truncate">{task.title}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 text-xs">
                              <span className="text-emerald-600 font-bold text-[11px]">✓ Done</span>
                              <button
                                onClick={() => updateTask({ ...task, status: 'Pending' })}
                                className="text-[11px] text-blue-600 hover:underline"
                              >
                                Reopen
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: DYNAMIC GAP FINDER + CENTRALIZED CAPACITY (lg:col-span-1) */}
        {/* ======================================================================= */}
        <div className="space-y-4">
          
          {/* Dynamic Gap Finder Card (Centralized) */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl shadow-sm space-y-4">
            
            {/* Header Ribbon */}
            <div className="flex items-center justify-between gap-3 pb-1 border-b border-theme-border/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-amber-500/15 to-orange-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/25 shrink-0">
                  <Sparkles className="w-4 h-4 stroke-[2]" />
                </div>
                <h3 className="text-sm font-bold text-theme-text tracking-tight font-display">
                  Dynamic Gap Finder
                </h3>
              </div>

              {/* Mode Toggle */}
              <button
                type="button"
                onClick={() => {
                  setSlotDecomposition(prev => {
                    const next = !prev;
                    try {
                      localStorage.setItem('optimustime_slot_decomposition', JSON.stringify(next));
                    } catch {}
                    return next;
                  });
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all border flex items-center gap-1 cursor-pointer shadow-2xs ${
                  slotDecomposition
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                    : 'bg-black/[0.03] dark:bg-white/[0.06] text-theme-muted hover:text-theme-text border-theme-border'
                }`}
              >
                <span>{slotDecomposition ? 'Ultradian Split' : 'Raw Gaps'}</span>
              </button>
            </div>

            {/* Unstarted Task Alert in Current Slot */}
            {isSelectedToday && unstartedCategoryTasks.length > 0 && (
              <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 space-y-2 animate-slide-up shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-1 font-display">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                    <span>Current Slot Not Started</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
                    {unstartedCategoryTasks.length} {unstartedCategoryTasks.length === 1 ? 'Task' : 'Tasks'}
                  </span>
                </div>
                {unstartedCategoryTasks.map(t => (
                  <div key={t.id} className="p-2 rounded-lg bg-theme-card border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate text-theme-text">{t.title}</div>
                      <div className="text-[10px] font-mono text-theme-muted">{t.startTime} – {t.endTime}</div>
                    </div>
                    <button
                      onClick={() => startTask(t.id)}
                      className="px-2.5 py-1 rounded bg-blue-600 text-white text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      Start Now
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 3-Way Segmented Control */}
            <div className="p-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.08] grid grid-cols-3 gap-1">
              {[
                { id: 'all', label: 'All Slots', count: scientificSlots.length },
                { id: 'today', label: 'Today', count: scientificSlots.filter(s => s.isToday).length },
                { id: 'tomorrow', label: 'Tomorrow', count: scientificSlots.filter(s => s.isTomorrow).length },
              ].map(tab => {
                const isActive = gapDateFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setGapDateFilter(tab.id as any)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                      isActive
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-display'
                        : 'text-theme-muted hover:text-theme-text hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] font-mono ${isActive ? 'opacity-90 font-bold' : 'opacity-60'}`}>
                      ({tab.count})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hero Spotlight Slot */}
            {heroSpotlightSlot && (() => {
              const isHeroSimul = Boolean(heroSpotlightSlot.isSimultaneous);
              return (
                <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 animate-fade-in relative overflow-hidden group ${
                  isHeroSimul
                    ? 'border-purple-500/50 dark:border-purple-400/60 bg-gradient-to-b from-purple-500/[0.14] via-indigo-500/[0.05] to-transparent shadow-[0_4px_28px_-4px_rgba(168,85,247,0.3)] ring-2 ring-purple-500/40'
                    : 'border-emerald-500/30 dark:border-emerald-500/40 bg-gradient-to-b from-emerald-500/[0.09] via-teal-500/[0.03] to-transparent shadow-[0_4px_24px_-4px_rgba(168,85,247,0.15)]'
                }`}>
                  <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl pointer-events-none ${
                    isHeroSimul ? 'bg-purple-500/20' : 'bg-emerald-500/15'
                  }`} />

                  {/* Top Status Header */}
                  <div className="flex items-center justify-between gap-2 relative z-10">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          isHeroSimul ? 'bg-purple-400' : 'bg-emerald-400'
                        }`} />
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                          isHeroSimul ? 'bg-purple-500' : 'bg-emerald-500'
                        }`} />
                      </span>
                      <span className={`text-xs font-bold font-display tracking-tight ${
                        isHeroSimul ? 'text-purple-800 dark:text-purple-300' : 'text-emerald-800 dark:text-emerald-300'
                      }`}>
                        {isHeroSimul ? '🔀 Co-Run Slot' : 'Next Free Slot'} • {heroSpotlightSlot.isImmediate ? 'Available Now' : heroSpotlightSlot.dateLabel}
                      </span>
                    </div>

                    <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-bold font-mono shrink-0 shadow-2xs ${
                      isHeroSimul
                        ? 'bg-purple-500/15 text-purple-800 dark:text-purple-200 border-purple-500/30'
                        : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30'
                    }`}>
                      <span>{formatDurationHuman(heroSpotlightSlot.durationMinutes)}</span>
                      <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75">free</span>
                    </div>
                  </div>

                  {/* Hero Time Interval */}
                  <div className="relative z-10 space-y-1.5">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-theme-text">
                        {heroSpotlightSlot.startTime} – {heroSpotlightSlot.endTime}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.06] text-theme-muted font-display">
                        {heroSpotlightSlot.dateLabel}
                      </span>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 text-xs font-semibold">
                        <span>{heroSpotlightSlot.ultradianEmoji || '⚡'}</span>
                        <span>{heroSpotlightSlot.ultradianLabel}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20 text-xs font-semibold">
                        <span>{heroSpotlightSlot.circadianEmoji}</span>
                        <span>{heroSpotlightSlot.circadianLabel}</span>
                      </span>
                      {heroSpotlightSlot.isLateNight && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-xs font-semibold">
                          <span>🌙</span>
                          <span>Late Night</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CTA Row */}
                  <div className={`flex items-center gap-2 pt-2.5 border-t relative z-10 ${
                    isHeroSimul ? 'border-purple-500/20' : 'border-emerald-500/20'
                  }`}>
                    <button
                      onClick={() => onOpenTaskModal(undefined, heroSpotlightSlot.date, heroSpotlightSlot.startTime, (currentCategory as any).projectCode, currentCategory.name)}
                      className={`flex-1 h-9 px-4 rounded-xl active:scale-[0.98] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isHeroSimul
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-500/25'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
                      }`}
                      title={`Quick fit in ${currentCategory.name} starting at ${heroSpotlightSlot.startTime}`}
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>Quick Fit in {currentCategory.name}</span>
                    </button>

                    <button
                      onClick={() => openBufferNoteModal({
                        date: heroSpotlightSlot.date,
                        startTime: heroSpotlightSlot.startTime,
                        endTime: heroSpotlightSlot.endTime,
                        durationMinutes: heroSpotlightSlot.durationMinutes,
                        activityTag: heroSpotlightSlot.durationMinutes < 20 ? 'Break / Rest' : 'Deep Focus Buffer'
                      })}
                      className="h-9 px-3.5 rounded-xl bg-white/70 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.14] text-theme-muted hover:text-amber-600 dark:hover:text-amber-400 border border-theme-border/60 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-95 shadow-2xs"
                      title={`Log buffer note on ${heroSpotlightSlot.dateLabel}`}
                    >
                      <Coffee className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Buffer</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Datewise Grouped Slots */}
            {datewiseGroups.length > 0 ? (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {datewiseGroups.map((group) => (
                  <div
                    key={group.date}
                    className="rounded-2xl border border-theme-border/80 bg-theme-card/60 dark:bg-theme-card/30 p-3 space-y-2 shadow-2xs"
                  >
                    {/* Group Header */}
                    <div className="flex items-center justify-between px-2 py-1 text-xs font-bold text-theme-text">
                      <div className="flex items-center gap-1.5 font-display">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span>{group.dateLabel}</span>
                        <span className="text-[11px] font-normal text-theme-muted">({group.dayOfWeek})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-theme-card-hover text-theme-muted border border-theme-border/60">
                          {group.slots.length} {group.slots.length === 1 ? 'slot' : 'slots'}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatDurationHuman(group.totalFreeMinutes)} free
                        </span>
                      </div>
                    </div>

                    {/* Slot Rows */}
                    <div className="space-y-1.5">
                      {group.slots.map((item) => {
                        const humanDur = formatDurationHuman(item.durationMinutes);
                        return (
                          <div
                            key={item.slotId}
                            onClick={() => onOpenTaskModal(undefined, item.date, item.startTime, (currentCategory as any).projectCode, currentCategory.name)}
                            className={`transition-all cursor-pointer active:scale-[0.99] flex flex-col gap-2 ${
                              item.isSimultaneous
                                ? 'group p-3 sm:px-3.5 sm:py-2.5 rounded-xl border border-purple-400/80 dark:border-purple-500/80 ring-2 ring-purple-500/30 dark:ring-purple-400/30 bg-purple-500/[0.07] dark:bg-purple-950/30 hover:border-purple-500 hover:ring-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.18)]'
                                : 'group p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border border-theme-border/60 hover:border-blue-500/40 bg-theme-card/70 hover:bg-theme-card-hover shadow-2xs hover:shadow-xs'
                            }`}
                          >
                            {/* Top Row */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                {item.isSimultaneous && (
                                  <div className="w-5 h-5 rounded-full bg-purple-500/20 border-2 border-purple-500 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 text-[10px] font-bold shadow-2xs">
                                    🔀
                                  </div>
                                )}
                                <span className="font-mono text-xs sm:text-sm font-bold text-theme-text tracking-tight whitespace-nowrap">
                                  {item.startTime} – {item.endTime}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold shrink-0 ${
                                  item.isSimultaneous
                                    ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25'
                                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                }`}>
                                  {humanDur}
                                </span>
                                {item.isLateNight && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shrink-0">
                                    🌙 Night
                                  </span>
                                )}
                              </div>

                              {/* Right: Clean Action Buttons */}
                              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => onOpenTaskModal(undefined, item.date, item.startTime, (currentCategory as any).projectCode, currentCategory.name)}
                                  className={`h-7 px-3 rounded-full text-xs font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                                    item.isSimultaneous
                                      ? 'text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-sm shadow-purple-500/20'
                                      : 'text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-600 hover:text-white dark:bg-blue-500/15 dark:hover:bg-blue-500 dark:hover:text-white border border-blue-500/20'
                                  }`}
                                  title={`Schedule in ${currentCategory.name} on ${item.dateLabel} at ${item.startTime}`}
                                >
                                  <Plus className="w-3 h-3 stroke-[2.5]" />
                                  <span>{item.isSimultaneous ? 'Co-Schedule' : 'Schedule'}</span>
                                </button>
                                <button
                                  onClick={() => openBufferNoteModal({
                                    date: item.date,
                                    startTime: item.startTime,
                                    endTime: item.endTime,
                                    durationMinutes: item.durationMinutes,
                                    activityTag: item.durationMinutes < 20 ? 'Break / Rest' : 'Deep Focus Buffer'
                                  })}
                                  className="w-7 h-7 rounded-full text-theme-muted hover:text-amber-500 hover:bg-theme-card-hover border border-theme-border/60 transition-all flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
                                  title={`Log buffer note on ${item.dateLabel}`}
                                >
                                  <Coffee className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Sub-Metadata: Parallel Co-Run Context & Ultradian */}
                            <div className="text-[11px] text-theme-muted font-medium flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className="shrink-0">{item.ultradianEmoji || '⚡'} {item.ultradianLabel}</span>
                              <span className="opacity-40 shrink-0">•</span>
                              <span className="shrink-0">{item.circadianEmoji} {item.circadianLabel}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-theme-card-hover border border-theme-border/60 text-center text-xs text-theme-muted">
                No open slots found for the selected filter.
              </div>
            )}

          </div>

          {/* Category Capacity & Centralized Engine Card */}
          <div className="glass-panel p-5 rounded-3xl border border-theme-border shadow-sm space-y-3.5 bg-gradient-to-br from-theme-card via-theme-card to-theme-card-hover/40">
            
            <div className="flex items-center justify-between border-b border-theme-border/50 pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-bold text-theme-text uppercase tracking-wider font-display">
                  {currentCategory.name} Capacity Share
                </h4>
              </div>
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                {categoryCapacityPercent}% of 14h Day
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-theme-muted font-medium">
                <span>{currentCategory.name} Scheduled Today:</span>
                <strong className="text-theme-text font-mono">{formatDurationHuman(categoryScheduledMins)}</strong>
              </div>

              <div className="w-full bg-theme-card-hover h-2.5 rounded-full overflow-hidden border border-theme-border">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${categoryCapacityPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-theme-muted pt-1">
                <span>Total System Load: {formatDurationHuman(scheduledMinsOnDayAll)}</span>
                <span>Max Target: {capacitySettings.maxWorkHours || 14}h</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-theme-card-hover/60 border border-theme-border text-[11px] space-y-1 text-theme-muted">
              <div className="flex items-center justify-between">
                <span>Total Tasks in {currentCategory.name}:</span>
                <strong className="text-theme-text">{totalTasksCount}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Dedicated Work Budget:</span>
                <strong className="text-theme-text font-mono">{formatDurationHuman(totalBudgetMinutes)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Actual Logged Time:</span>
                <strong className="text-blue-600 dark:text-blue-400 font-mono">{formatDurationHuman(totalActualMinutes)}</strong>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-theme-muted font-medium pt-1 border-t border-theme-border/40">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Centralized Timings Active • Sleep Protected ({capacitySettings.sleepStartTime || '11:00 PM'} – {capacitySettings.sleepEndTime || '06:00 AM'})</span>
            </div>

          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 6. CENTRALIZED RESCHEDULE MODAL                                           */}
      {/* ========================================================================= */}
      {reschedulingTask && (
        <RescheduleModal
          task={reschedulingTask}
          allTasks={tasks}
          capacitySettings={capacitySettings}
          onConfirmReschedule={handleConfirmReschedule}
          onClose={() => setReschedulingTask(null)}
        />
      )}

    </div>
  );
};
