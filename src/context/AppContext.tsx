import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  Task, 
  Category, 
  CapacitySettings, 
  PrioritySettings, 
  Reminder, 
  KnowledgeItem, 
  ThemeName, 
  ActiveTab,
  TaskStatus,
  PriorityLevel,
  SubTask,
  SecuritySettings,
  CloudSyncConfig,
  CloudSyncStatus,
  LifeEventLog,
  LifeEventType,
  BufferStatusNote,
  BufferCategoryItem,
  EmergencyCategoryItem,
  EmergencyBufferPlan,
  TaskRescheduleProposal,
  EmergencyType,
  PlanProjectFolder,
  PlanProjectType,
  PlanProjectStatus,
  DefaultTaskSettings,
  DaySlice24,
  SignalNoiseType
} from '../types';
import { detectSignalVsNoise } from '../utils/signalNoiseUtils';
import { 
  createFullSystemBackup, 
  createSettingsOnlyBackup, 
  validateBackupBundle, 
  saveRollbackSnapshot, 
  getRollbackSnapshot, 
  clearRollbackSnapshot 
} from '../utils/backupUtils';
import { 
  DEFAULT_CAPACITY, 
  DEFAULT_PRIORITIES, 
  DEFAULT_SECURITY,
  DEFAULT_CLOUD_SYNC,
  INITIAL_CATEGORIES, 
  INITIAL_TASKS, 
  INITIAL_KNOWLEDGE, 
  INITIAL_REMINDERS,
  INITIAL_BUFFER_NOTES,
  INITIAL_BUFFER_CATEGORIES,
  INITIAL_EMERGENCY_CATEGORIES,
  INITIAL_PLAN_PROJECTS,
  DEFAULT_TASK_PRESETS
} from './initialData';
import { 
  generateProjectCode, 
  parse12HourToMinutes, 
  formatMinutesTo12Hour, 
  addMinutesToTime, 
  diffTimeInMinutes, 
  toISODateString, 
  getDayOfWeekFromDate, 
  checkOverlap,
  playNotificationChime,
  isTaskScheduledForDate,
  getCurrentRoundedTime12Hour,
  getNextRecurrenceDate,
  isTaskAutoIncompleteExpired
} from '../utils/timeUtils';
import { 
  pushStateToCloud, 
  pullStateFromCloud, 
  subscribeToRealtimeCloud,
  testSupabaseConnection 
} from '../services/supabase';
import confetti from 'canvas-confetti';

export interface BufferNoteModalParams {
  id?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  activityTag?: string;
  notes?: string;
  energyLevel?: number;
  relatedTaskId?: string;
  relatedTaskTitle?: string;
  existingNote?: BufferStatusNote;
}

interface AppContextType {
  // State
  tasks: Task[];
  categories: Category[];
  capacitySettings: CapacitySettings;
  prioritySettings: PrioritySettings;
  defaultTaskSettings: DefaultTaskSettings;
  reminders: Reminder[];
  knowledge: KnowledgeItem[];
  theme: ThemeName;
  activeTab: ActiveTab;
  activeTaskId: string | null;
  searchQuery: string;
  selectedCategoryFilter: string | null;
  
  // Navigation & UI controls
  setTheme: (theme: ThemeName) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryFilter: (cat: string | null) => void;
  
  // Task Actions & Automation Engines
  addTask: (task: Omit<Task, 'id' | 'projectCode' | 'dateAdded' | 'executionLogs' | 'totalActualMinutes'> & { id?: string; projectCode?: string }) => Task;
  updateTask: (task: Task) => void;
  deleteTask: (taskId: string) => void;
  deleteRecurringInstance: (taskId: string, dateStr: string) => void;
  deleteRecurringSeries: (taskId: string) => void;
  pauseRecurringSeries: (taskId: string) => void;
  resumeRecurringSeries: (taskId: string) => void;
  requestDeleteTask: (task: Task, date?: string) => void;
  recurringDeletePrompt: { isOpen: boolean; task?: Task; date?: string } | null;
  closeRecurringDeletePrompt: () => void;
  startTask: (taskId: string) => void;
  pauseTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  holdTask: (taskId: string) => void;
  rescheduleTask: (taskId: string, newDate: string, newStartTime: string) => void;
  terminateTask: (taskId: string) => void;
  extendTaskDuration: (taskId: string, extraMinutes: number) => void;
  
  // Conflict & Cascading Shift Engine
  detectConflicts: (date: string, startTime: string, endTime: string, ignoreTaskId?: string) => Task[];
  cascadeShiftDownstream: (date: string, fromStartTime: string, shiftMinutes: number, ignoreTaskId?: string) => number;
  linkSimultaneousTasks: (task1Id: string, task2Id: string) => void;
  
  // Sub-task Engine
  addSubTask: (taskId: string, title: string, parentSubTaskId?: string, assignedTimeMin?: number) => void;
  deleteSubTask: (taskId: string, subTaskId: string) => void;
  toggleSubTask: (taskId: string, subTaskId: string) => void;
  
  // Category CRUD
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (category: Category) => void;
  deleteCategory: (categoryId: string) => void;
  
  // Reminders CRUD
  addReminder: (reminder: Omit<Reminder, 'id' | 'isTriggered' | 'isDismissed'>) => void;
  dismissReminder: (reminderId: string) => void;
  deleteReminder: (reminderId: string) => void;
  
  // Knowledge Hub CRUD
  addKnowledgeItem: (item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateKnowledgeItem: (item: KnowledgeItem) => void;
  deleteKnowledgeItem: (itemId: string) => void;

  // Planning & Projects Folders Hub
  planProjects: PlanProjectFolder[];
  addPlanProject: (folder: Omit<PlanProjectFolder, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => PlanProjectFolder;
  updatePlanProject: (folder: PlanProjectFolder) => void;
  deletePlanProject: (folderId: string, deleteAssociatedTasks?: boolean) => void;
  assignTaskToPlanProject: (taskId: string, planProjectId?: string) => void;
  
  // Buffer Status Notes & Free Time Engine (24-Hour Accountability)
  bufferNotes: BufferStatusNote[];
  bufferCategories: BufferCategoryItem[];
  addBufferNote: (note: Omit<BufferStatusNote, 'id' | 'createdAt'> & { id?: string }) => BufferStatusNote;
  updateBufferNote: (note: BufferStatusNote) => void;
  deleteBufferNote: (noteId: string) => void;
  addBufferCategory: (cat: Omit<BufferCategoryItem, 'id'> & { id?: string }) => void;
  updateBufferCategory: (cat: BufferCategoryItem) => void;
  deleteBufferCategory: (catId: string) => void;
  resetBufferCategories: () => void;
  bufferNoteModalState: { isOpen: boolean; initialData?: BufferNoteModalParams };
  openBufferNoteModal: (params?: BufferNoteModalParams) => void;
  closeBufferNoteModal: () => void;
  activeBufferPrompt: { date: string; startTime: string; endTime: string; durationMinutes: number; relatedTaskId?: string; relatedTaskTitle?: string } | null;
  setActiveBufferPrompt: (prompt: { date: string; startTime: string; endTime: string; durationMinutes: number; relatedTaskId?: string; relatedTaskTitle?: string } | null) => void;
  toggleSliceSignalNoise: (slice: DaySlice24) => void;
  addQuickDiaryEntry: (entry: {
    date: string;
    startTime: string;
    durationMinutes: number;
    text: string;
    activityTag?: string;
    signalNoise?: SignalNoiseType;
    energyLevel?: number;
  }) => BufferStatusNote;

  // Emergency Buffer Protocol
  isEmergencyModalOpen: boolean;
  emergencyModalParams: { date?: string; startTime?: string } | null;
  openEmergencyModal: (params?: { date?: string; startTime?: string }) => void;
  closeEmergencyModal: () => void;
  triggerEmergencyBuffer: (plan: EmergencyBufferPlan, proposals: TaskRescheduleProposal[]) => void;
  emergencyCategories: EmergencyCategoryItem[];
  addEmergencyCategory: (cat: Omit<EmergencyCategoryItem, 'id'> & { id?: string }) => void;
  updateEmergencyCategory: (cat: EmergencyCategoryItem) => void;
  deleteEmergencyCategory: (catId: string) => void;
  resetEmergencyCategories: () => void;

  // Settings & Capacity
  updateCapacitySettings: (settings: CapacitySettings) => void;
  updatePrioritySettings: (settings: PrioritySettings) => void;
  updateDefaultTaskSettings: (settings: DefaultTaskSettings) => void;
  
  // Security & Authentication Gate
  securitySettings: SecuritySettings;
  updateSecuritySettings: (settings: SecuritySettings) => void;
  isAuthenticated: boolean;
  login: (password: string, rememberDevice?: boolean) => boolean;
  logout: () => void;
  
  // Real-Time Cloud Database Sync (Supabase)
  cloudSyncConfig: CloudSyncConfig;
  cloudSyncStatus: CloudSyncStatus;
  updateCloudSyncConfig: (config: CloudSyncConfig) => void;
  syncNow: () => Promise<boolean>;
  pushToCloud: () => Promise<boolean>;
  pullFromCloud: () => Promise<boolean>;
  testCloudConnection: () => Promise<{ success: boolean; message: string }>;
  
  // Backup / Restore & 100% System Data Hub
  exportStateJson: () => string;
  exportSettingsOnlyJson: () => string;
  importStateJson: (jsonStr: string, mode?: 'full' | 'merge' | 'settings_only') => boolean;
  rollbackLastRestore: () => boolean;
  canRollback: boolean;
  resetToDefaultData: () => void;
  isBackupModalOpen: boolean;
  backupModalTab: 'export' | 'restore';
  openBackupModal: (tab?: 'export' | 'restore') => void;
  closeBackupModal: () => void;
  
  // Life Event Audit & Chronological Logs
  auditLogs: LifeEventLog[];
  logLifeEvent: (event: Omit<LifeEventLog, 'id' | 'timestamp' | 'date'>) => void;
  clearAuditLogs: () => void;
  
  // Computed values
  dailyScheduledMinutes: (dateStr: string) => number;
  isCapacityRedLineExceeded: (dateStr: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'optimustime_app_state_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load state from LocalStorage or Fallback
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_tasks`);
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_categories`);
      return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  const [capacitySettings, setCapacitySettings] = useState<CapacitySettings>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_capacity`);
      return saved ? { ...DEFAULT_CAPACITY, ...JSON.parse(saved) } : DEFAULT_CAPACITY;
    } catch {
      return DEFAULT_CAPACITY;
    }
  });

  const [prioritySettings, setPrioritySettings] = useState<PrioritySettings>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_priorities`);
      return saved ? JSON.parse(saved) : DEFAULT_PRIORITIES;
    } catch {
      return DEFAULT_PRIORITIES;
    }
  });

  const [defaultTaskSettings, setDefaultTaskSettings] = useState<DefaultTaskSettings>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_default_task_settings`);
      return saved ? { ...DEFAULT_TASK_PRESETS, ...JSON.parse(saved) } : DEFAULT_TASK_PRESETS;
    } catch {
      return DEFAULT_TASK_PRESETS;
    }
  });

  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_reminders`);
      return saved ? JSON.parse(saved) : INITIAL_REMINDERS;
    } catch {
      return INITIAL_REMINDERS;
    }
  });

  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_knowledge`);
      return saved ? JSON.parse(saved) : INITIAL_KNOWLEDGE;
    } catch {
      return INITIAL_KNOWLEDGE;
    }
  });

  const [auditLogs, setAuditLogs] = useState<LifeEventLog[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_audit_logs`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Buffer Status Notes (24-Hour continuous accountability)
  const [bufferNotes, setBufferNotes] = useState<BufferStatusNote[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_buffer_notes`);
      return saved ? JSON.parse(saved) : INITIAL_BUFFER_NOTES;
    } catch {
      return INITIAL_BUFFER_NOTES;
    }
  });

  // Editable Buffer Activity Categories
  const [bufferCategories, setBufferCategories] = useState<BufferCategoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_buffer_categories`);
      return saved ? JSON.parse(saved) : INITIAL_BUFFER_CATEGORIES;
    } catch {
      return INITIAL_BUFFER_CATEGORIES;
    }
  });

  // Editable Emergency Buffer Presets & Categories
  const [emergencyCategories, setEmergencyCategories] = useState<EmergencyCategoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_emergency_categories`);
      return saved ? JSON.parse(saved) : INITIAL_EMERGENCY_CATEGORIES;
    } catch {
      return INITIAL_EMERGENCY_CATEGORIES;
    }
  });

  // Planning & Projects Folders State
  const [planProjects, setPlanProjects] = useState<PlanProjectFolder[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_plan_projects`);
      return saved ? JSON.parse(saved) : INITIAL_PLAN_PROJECTS;
    } catch {
      return INITIAL_PLAN_PROJECTS;
    }
  });

  // Buffer Status Note Modal State
  const [bufferNoteModalState, setBufferNoteModalState] = useState<{
    isOpen: boolean;
    initialData?: BufferNoteModalParams;
  }>({ isOpen: false });

  // Active post-task buffer prompt banner
  const [activeBufferPrompt, setActiveBufferPrompt] = useState<{
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    relatedTaskId?: string;
    relatedTaskTitle?: string;
  } | null>(null);

  const openBufferNoteModal = useCallback((params?: BufferNoteModalParams) => {
    setBufferNoteModalState({
      isOpen: true,
      initialData: params
    });
  }, []);

  const closeBufferNoteModal = useCallback(() => {
    setBufferNoteModalState({ isOpen: false });
  }, []);

  const logLifeEvent = useCallback((event: Omit<LifeEventLog, 'id' | 'timestamp' | 'date'>) => {
    const now = new Date();
    const newLog: LifeEventLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now.toISOString(),
      date: toISODateString(now),
      ...event
    };
    setAuditLogs(prev => [newLog, ...prev].slice(0, 5000));
  }, []);

  const clearAuditLogs = useCallback(() => {
    setAuditLogs([]);
    try {
      localStorage.removeItem(`${STORAGE_KEY}_audit_logs`);
    } catch (e) {
      console.error('Failed to clear audit logs', e);
    }
  }, []);

  // Emergency Buffer State
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emergencyModalParams, setEmergencyModalParams] = useState<{ date?: string; startTime?: string } | null>(null);

  const openEmergencyModal = useCallback((params?: { date?: string; startTime?: string }) => {
    setEmergencyModalParams(params || null);
    setIsEmergencyModalOpen(true);
  }, []);

  const closeEmergencyModal = useCallback(() => {
    setIsEmergencyModalOpen(false);
    setEmergencyModalParams(null);
  }, []);

  const triggerEmergencyBuffer = useCallback((plan: EmergencyBufferPlan, proposals: TaskRescheduleProposal[]) => {
    const emergencyTask: Task = {
      id: plan.id || `emerg_${Date.now()}`,
      projectCode: `EMERG-${(plan.emergencyType || 'URG').slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '') || 'URG'}`,
      title: plan.title,
      description: plan.notes || `Uncontrollable emergency buffer (${plan.emergencyType})`,
      dateAdded: new Date().toISOString(),
      taskDate: plan.date,
      dayOfWeek: getDayOfWeekFromDate(plan.date),
      priority: 'P1',
      category: '⚡ Emergency Buffer',
      subCategory: plan.emergencyType,
      appointedMinutes: plan.durationMinutes,
      startTime: plan.startTime,
      endTime: plan.endTime,
      status: 'Working',
      bufferMinutes: 0,
      recurrence: 'None',
      isEmergencyBuffer: true,
      emergencyType: plan.emergencyType,
      executionLogs: [{
        startedAt: new Date().toISOString(),
        actualDurationMinutes: plan.durationMinutes,
        isLateFinish: false,
        notes: plan.notes
      }],
      totalActualMinutes: 0,
      notes: plan.notes,
      links: [],
      subtasks: []
    };

    const proposalMap = new Map(proposals.map(p => [p.taskId, p]));
    const spawnedSingleInstances: Task[] = [];

    setTasks(prev => {
      const updated = prev.map(t => {
        // Strict Immutable Guard: Mandatory schedules can NEVER be rescheduled or deferred by emergency buffers
        if (t.isMandatorySchedule) {
          return t;
        }

        const prop = proposalMap.get(t.id);
        // If no proposal, or action is keep, or user didn't approve permission -> leave unchanged
        if (!prop || prop.action === 'keep' || prop.approved === false) {
          return t;
        }

        const isRecurring = t.recurrence && t.recurrence !== 'None';

        if (isRecurring) {
          // Exclude this emergency date from the recurring series and spawn a standalone single instance
          const existingExcluded = t.excludedDates || [];
          const updatedMaster = {
            ...t,
            excludedDates: existingExcluded.includes(plan.date) ? existingExcluded : [...existingExcluded, plan.date]
          };

          const singleDayInstance: Task = {
            ...t,
            id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            taskDate: prop.proposedDate,
            dayOfWeek: getDayOfWeekFromDate(prop.proposedDate),
            startTime: prop.proposedStartTime,
            endTime: prop.proposedEndTime,
            appointedMinutes: prop.proposedDurationMinutes || t.appointedMinutes,
            recurrence: 'None',
            selectedDays: undefined,
            excludedDates: undefined,
            status: (prop.action === 'hold' ? 'Hold' : 'Pending') as TaskStatus
          };

          spawnedSingleInstances.push(singleDayInstance);
          return updatedMaster;
        }

        // For regular non-recurring tasks:
        if (prop.action === 'hold') {
          return { ...t, status: 'Hold' as TaskStatus };
        } else if (prop.action === 'shift_same_day') {
          return {
            ...t,
            taskDate: prop.proposedDate,
            dayOfWeek: getDayOfWeekFromDate(prop.proposedDate),
            startTime: prop.proposedStartTime,
            endTime: prop.proposedEndTime,
            appointedMinutes: prop.proposedDurationMinutes || t.appointedMinutes
          };
        } else if (prop.action === 'compress') {
          return {
            ...t,
            taskDate: prop.proposedDate,
            dayOfWeek: getDayOfWeekFromDate(prop.proposedDate),
            startTime: prop.proposedStartTime,
            endTime: prop.proposedEndTime,
            appointedMinutes: prop.proposedDurationMinutes || t.appointedMinutes
          };
        } else if (prop.action === 'defer_tomorrow') {
          return {
            ...t,
            taskDate: prop.proposedDate,
            dayOfWeek: getDayOfWeekFromDate(prop.proposedDate),
            startTime: prop.proposedStartTime,
            endTime: prop.proposedEndTime,
            appointedMinutes: prop.proposedDurationMinutes || t.appointedMinutes,
            status: 'Pending' as TaskStatus
          };
        }
        return t;
      });

      return [emergencyTask, ...spawnedSingleInstances, ...updated];
    });

    logLifeEvent({
      eventType: 'EMERGENCY_BUFFER_TRIGGERED',
      taskTitle: plan.title,
      projectCode: emergencyTask.projectCode,
      message: `🚨 Emergency Buffer Activated: ${plan.title} (${plan.startTime} - ${plan.endTime})`,
      details: {
        emergencyType: plan.emergencyType,
        newDate: plan.date,
        durationMinutes: plan.durationMinutes,
        proposalsCount: proposals.filter(p => p.approved && p.action !== 'keep').length,
        reason: plan.notes || plan.emergencyType
      }
    });

    playNotificationChime('alert');
    setIsEmergencyModalOpen(false);
    setEmergencyModalParams(null);
  }, [logLifeEvent]);

  const [theme, setThemeState] = useState<ThemeName>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_theme`);
      return (saved as ThemeName) || 'light';
    } catch {
      return 'light';
    }
  });

  // Apply Theme attribute to document body/root
  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme);
    if (newTheme === 'light') {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

  // Security Settings & Authentication State
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_security`);
      return saved ? JSON.parse(saved) : DEFAULT_SECURITY;
    } catch {
      return DEFAULT_SECURITY;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const savedSec = localStorage.getItem(`${STORAGE_KEY}_security`);
      const sec: SecuritySettings = savedSec ? JSON.parse(savedSec) : DEFAULT_SECURITY;
      if (!sec.isPasswordProtected) return true;

      const localAuth = localStorage.getItem(`${STORAGE_KEY}_auth_session`);
      const sessionAuth = sessionStorage.getItem(`${STORAGE_KEY}_auth_session`);
      return Boolean(localAuth === 'true' || sessionAuth === 'true');
    } catch {
      return false;
    }
  });

  // Cloud Sync Config & Status
  const [cloudSyncConfig, setCloudSyncConfig] = useState<CloudSyncConfig>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_cloud_sync`);
      const parsed: CloudSyncConfig | null = saved ? JSON.parse(saved) : null;
      // If DEFAULT_CLOUD_SYNC has env vars configured and saved config has no URL, prefer DEFAULT_CLOUD_SYNC
      if (DEFAULT_CLOUD_SYNC.supabaseUrl && (!parsed || !parsed.supabaseUrl)) {
        return DEFAULT_CLOUD_SYNC;
      }
      return parsed || DEFAULT_CLOUD_SYNC;
    } catch {
      return DEFAULT_CLOUD_SYNC;
    }
  });

  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>(() => {
    return cloudSyncConfig.isEnabled ? 'connecting' : 'offline';
  });

  // Tracking flags to avoid infinite ping-pong sync loops
  const isRemoteUpdateRef = useRef(false);
  const isInitialPullDoneRef = useRef(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  // Active working task tracking
  const activeTask = tasks.find(t => t.status === 'Working');
  const activeTaskId = activeTask ? activeTask.id : null;

  // Persist states to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_tasks`, JSON.stringify(tasks));
      localStorage.setItem(`${STORAGE_KEY}_categories`, JSON.stringify(categories));
      localStorage.setItem(`${STORAGE_KEY}_capacity`, JSON.stringify(capacitySettings));
      localStorage.setItem(`${STORAGE_KEY}_priorities`, JSON.stringify(prioritySettings));
      localStorage.setItem(`${STORAGE_KEY}_default_task_settings`, JSON.stringify(defaultTaskSettings));
      localStorage.setItem(`${STORAGE_KEY}_reminders`, JSON.stringify(reminders));
      localStorage.setItem(`${STORAGE_KEY}_knowledge`, JSON.stringify(knowledge));
      localStorage.setItem(`${STORAGE_KEY}_audit_logs`, JSON.stringify(auditLogs));
      localStorage.setItem(`${STORAGE_KEY}_buffer_notes`, JSON.stringify(bufferNotes));
      localStorage.setItem(`${STORAGE_KEY}_buffer_categories`, JSON.stringify(bufferCategories));
      localStorage.setItem(`${STORAGE_KEY}_emergency_categories`, JSON.stringify(emergencyCategories));
      localStorage.setItem(`${STORAGE_KEY}_plan_projects`, JSON.stringify(planProjects));
      localStorage.setItem(`${STORAGE_KEY}_theme`, theme);
      localStorage.setItem(`${STORAGE_KEY}_security`, JSON.stringify(securitySettings));
      localStorage.setItem(`${STORAGE_KEY}_cloud_sync`, JSON.stringify(cloudSyncConfig));
    } catch (e) {
      console.error('Failed to sync to LocalStorage', e);
    }
  }, [tasks, categories, capacitySettings, prioritySettings, defaultTaskSettings, reminders, knowledge, auditLogs, bufferNotes, bufferCategories, emergencyCategories, planProjects, theme, securitySettings, cloudSyncConfig]);

  const updateCloudSyncConfig = useCallback((config: CloudSyncConfig) => {
    setCloudSyncConfig(config);
    try {
      localStorage.setItem(`${STORAGE_KEY}_cloud_sync`, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save cloud sync config', e);
    }
    if (!config.isEnabled) {
      setCloudSyncStatus('offline');
    } else {
      setCloudSyncStatus('connecting');
    }
  }, []);

  const stateRef = useRef({
    tasks,
    categories,
    capacitySettings,
    prioritySettings,
    reminders,
    knowledge,
    planProjects,
    theme,
    securitySettings
  });
  useEffect(() => {
    stateRef.current = {
      tasks,
      categories,
      capacitySettings,
      prioritySettings,
      reminders,
      knowledge,
      planProjects,
      theme,
      securitySettings
    };
  }, [tasks, categories, capacitySettings, prioritySettings, reminders, knowledge, planProjects, theme, securitySettings]);

  const cloudSyncConfigRef = useRef(cloudSyncConfig);
  useEffect(() => {
    cloudSyncConfigRef.current = cloudSyncConfig;
  }, [cloudSyncConfig]);

  const getFullBundle = useCallback(() => {
    const s = stateRef.current;
    return {
      version: '1.0.0',
      syncedAt: new Date().toISOString(),
      tasks: s.tasks,
      categories: s.categories,
      capacitySettings: s.capacitySettings,
      prioritySettings: s.prioritySettings,
      reminders: s.reminders,
      knowledge: s.knowledge,
      planProjects: s.planProjects,
      theme: s.theme,
      securitySettings: s.securitySettings
    };
  }, []);

  const applyBundle = useCallback((data: Record<string, unknown>) => {
    if (!data) return false;
    isRemoteUpdateRef.current = true;
    if (Array.isArray(data.tasks)) setTasks(data.tasks as Task[]);
    if (Array.isArray(data.categories)) setCategories(data.categories as Category[]);
    if (data.capacitySettings) setCapacitySettings(data.capacitySettings as CapacitySettings);
    if (data.prioritySettings) setPrioritySettings(data.prioritySettings as PrioritySettings);
    if (Array.isArray(data.reminders)) setReminders(data.reminders as Reminder[]);
    if (Array.isArray(data.knowledge)) setKnowledge(data.knowledge as KnowledgeItem[]);
    if (typeof data.theme === 'string') setTheme(data.theme as ThemeName);
    if (data.securitySettings) setSecuritySettings(data.securitySettings as SecuritySettings);
    setTimeout(() => {
      isRemoteUpdateRef.current = false;
    }, 1000);
    return true;
  }, [setTheme]);

  const pushToCloud = useCallback(async (): Promise<boolean> => {
    const cfg = cloudSyncConfigRef.current;
    if (!cfg.isEnabled || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return false;
    setCloudSyncStatus('syncing');
    const bundle = getFullBundle();
    const ok = await pushStateToCloud(cfg, bundle);
    if (ok) {
      setCloudSyncStatus('synced');
    } else {
      setCloudSyncStatus('error');
    }
    return ok;
  }, [getFullBundle]);

  const pullFromCloud = useCallback(async (): Promise<boolean> => {
    const cfg = cloudSyncConfigRef.current;
    if (!cfg.isEnabled || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return false;
    setCloudSyncStatus('syncing');
    const cloudData = await pullStateFromCloud(cfg);
    if (cloudData) {
      applyBundle(cloudData);
      setCloudSyncStatus('synced');
      return true;
    } else {
      setCloudSyncStatus('synced');
      return false;
    }
  }, [applyBundle]);

  const syncNow = useCallback(async (): Promise<boolean> => {
    return await pushToCloud();
  }, [pushToCloud]);

  const testCloudConnection = useCallback(async () => {
    return await testSupabaseConnection(cloudSyncConfigRef.current);
  }, []);

  const pullFromCloudRef = useRef(pullFromCloud);
  pullFromCloudRef.current = pullFromCloud;
  const pushToCloudRef = useRef(pushToCloud);
  pushToCloudRef.current = pushToCloud;
  const applyBundleRef = useRef(applyBundle);
  applyBundleRef.current = applyBundle;

  // Real-time Cloud Subscription & Initial Cloud Pull
  useEffect(() => {
    const isEnabled = cloudSyncConfig.isEnabled;
    const url = cloudSyncConfig.supabaseUrl?.trim();
    const key = cloudSyncConfig.supabaseAnonKey?.trim();
    const realtime = cloudSyncConfig.autoRealtimeSync;

    if (!isEnabled || !url || !key) {
      setCloudSyncStatus('offline');
      return;
    }

    setCloudSyncStatus('connecting');

    // Initial pull on connect
    pullFromCloudRef.current().then(success => {
      isInitialPullDoneRef.current = true;
      if (success) {
        setCloudSyncStatus('synced');
      } else {
        // Seed initial data to cloud if table row is empty
        pushToCloudRef.current().then(() => {
          setCloudSyncStatus('synced');
        });
      }
    });

    const activeConfig: CloudSyncConfig = {
      isEnabled,
      supabaseUrl: url,
      supabaseAnonKey: key,
      tableName: 'optimustime_sync',
      autoRealtimeSync: realtime
    };

    const unsubscribe = subscribeToRealtimeCloud(activeConfig, (remotePayload) => {
      applyBundleRef.current(remotePayload);
      setCloudSyncStatus('synced');
      playNotificationChime('success');
    });

    return () => {
      unsubscribe();
    };
  }, [
    cloudSyncConfig.isEnabled,
    cloudSyncConfig.supabaseUrl,
    cloudSyncConfig.supabaseAnonKey,
    cloudSyncConfig.autoRealtimeSync
  ]);

  // Auto-sync local state changes to Supabase Cloud (Debounced auto-push)
  useEffect(() => {
    const cfg = cloudSyncConfigRef.current;
    if (!cfg.isEnabled || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      return;
    }
    // Skip if update originated from cloud or before initial pull finishes
    if (isRemoteUpdateRef.current || !isInitialPullDoneRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      pushToCloudRef.current();
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    tasks,
    categories,
    capacitySettings,
    prioritySettings,
    reminders,
    knowledge,
    theme,
    securitySettings
  ]);

  // Security & Authentication Methods
  const updateSecuritySettings = useCallback((settings: SecuritySettings) => {
    setSecuritySettings(settings);
    try {
      localStorage.setItem(`${STORAGE_KEY}_security`, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save security settings', e);
    }
    if (!settings.isPasswordProtected) {
      setIsAuthenticated(true);
    }
  }, []);

  const login = useCallback((password: string, rememberDevice = false): boolean => {
    if (!securitySettings.isPasswordProtected) {
      setIsAuthenticated(true);
      return true;
    }
    if (password === securitySettings.masterPassword) {
      setIsAuthenticated(true);
      if (rememberDevice) {
        localStorage.setItem(`${STORAGE_KEY}_auth_session`, 'true');
      } else {
        sessionStorage.setItem(`${STORAGE_KEY}_auth_session`, 'true');
      }
      playNotificationChime('success');
      return true;
    }
    playNotificationChime('alert');
    return false;
  }, [securitySettings]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.removeItem(`${STORAGE_KEY}_auth_session`);
    sessionStorage.removeItem(`${STORAGE_KEY}_auth_session`);
  }, []);

  // Auto-Lock Inactivity Timer (if autoLockMinutes > 0)
  useEffect(() => {
    if (!securitySettings.isPasswordProtected || !isAuthenticated || securitySettings.autoLockMinutes <= 0) {
      return;
    }

    let timeoutId: number;

    const resetInactivityTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        logout();
      }, securitySettings.autoLockMinutes * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
    };
  }, [securitySettings.isPasswordProtected, securitySettings.autoLockMinutes, isAuthenticated, logout]);

  // Automated 6-Hour Inactivity Auto-Incomplete Engine
  // Automatically marks any task as 'Incomplete' if not started or not closed after 6 hours (360 mins)
  useEffect(() => {
    const evaluateIncompleteTasks = () => {
      const now = new Date();
      const todayStr = toISODateString(now);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      setTasks(prevTasks => {
        let hasChanges = false;
        const newSnapshots: Task[] = [];

        const updated = prevTasks.map(task => {
          if (task.status === 'Done' || task.status === 'Terminated' || task.status === 'Incomplete') {
            return task;
          }

          let isExpired = false;

          // Accurately evaluate 6-hour expiration respecting overnight / cross-midnight spans (e.g. 11:00 PM to 01:00 AM next day)
          if (task.status === 'Pending' || task.status === 'Working') {
            isExpired = isTaskAutoIncompleteExpired(
              task.taskDate,
              task.startTime,
              task.endTime,
              task.status,
              now,
              360 // 6 hours threshold
            );
          }

          if (isExpired) {
            hasChanges = true;
            logLifeEvent({
              eventType: 'TASK_INCOMPLETE',
              taskId: task.id,
              taskTitle: task.title,
              projectCode: task.projectCode,
              priority: task.priority,
              category: task.category,
              message: `⚠️ Task "${task.title}" (${task.projectCode}) marked Incomplete (6-hour window expired)`,
              details: {
                previousDate: task.taskDate,
                previousStartTime: task.startTime,
                appointedMinutes: task.appointedMinutes
              }
            });

            const isRecurring = task.recurrence && task.recurrence !== 'None';

            if (isRecurring) {
              // 1. Snapshot missed occurrence as an immutable Incomplete history record
              const missedDate = task.taskDate <= todayStr ? task.taskDate : todayStr;
              const snapshot: Task = {
                ...task,
                id: `snap-${task.id}-${missedDate}-${Date.now()}`,
                taskDate: missedDate,
                dayOfWeek: getDayOfWeekFromDate(missedDate),
                status: 'Incomplete',
                recurrence: 'None',
                selectedDays: [],
                dateAdded: new Date().toISOString()
              };
              newSnapshots.push(snapshot);

              // 2. Rollover master recurring task to next occurrence date with fresh 'Pending' state
              const nextDate = getNextRecurrenceDate(task, missedDate);
              return {
                ...task,
                taskDate: nextDate,
                dayOfWeek: getDayOfWeekFromDate(nextDate),
                status: 'Pending' as TaskStatus,
                executionLogs: []
              };
            }

            return { ...task, status: 'Incomplete' as TaskStatus };
          }

          return task;
        });

        if (hasChanges) {
          playNotificationChime('alert'); // Bip bip warning audio
          return [...newSnapshots, ...updated];
        }

        return prevTasks;
      });
    };

    // Run evaluation immediately and every 15 seconds
    evaluateIncompleteTasks();
    const interval = setInterval(evaluateIncompleteTasks, 15000);
    return () => clearInterval(interval);
  }, []);

  // Daily Scheduled Minutes computation (respects recurrence)
  const dailyScheduledMinutes = useCallback((dateStr: string): number => {
    return tasks
      .filter(t => isTaskScheduledForDate(t, dateStr) && t.status !== 'Terminated')
      .reduce((sum, t) => sum + (t.appointedMinutes || 0), 0);
  }, [tasks]);

  // Red-line Alert check
  const isCapacityRedLineExceeded = useCallback((dateStr: string): boolean => {
    const totalMinutes = dailyScheduledMinutes(dateStr);
    const maxMinutes = capacitySettings.maxWorkHours * 60;
    return totalMinutes > maxMinutes;
  }, [dailyScheduledMinutes, capacitySettings.maxWorkHours]);

  // Conflict Detection Engine (respects recurrence)
  const detectConflicts = useCallback((
    date: string, 
    startTime: string, 
    endTime: string, 
    ignoreTaskId?: string
  ): Task[] => {
    return tasks.filter(t => {
      if (t.id === ignoreTaskId) return false;
      if (!isTaskScheduledForDate(t, date)) return false;
      if (t.status === 'Terminated' || t.status === 'Done') return false;
      if (t.startTime === 'All Day' || startTime === 'All Day') return false; // Full-day tasks don't conflict with hour slots
      return checkOverlap(startTime, endTime, t.startTime, t.endTime);
    });
  }, [tasks]);

  // Cascading Auto-Shift Engine
  const cascadeShiftDownstream = useCallback((
    date: string, 
    fromStartTime: string, 
    shiftMinutes: number, 
    ignoreTaskId?: string
  ): number => {
    const fromMin = parse12HourToMinutes(fromStartTime);
    let shiftedCount = 0;

    setTasks(prevTasks => {
      return prevTasks.map(t => {
        // Never auto-shift mandatory/fixed schedule tasks, terminated/done tasks, or ignored tasks
        if (t.id === ignoreTaskId || t.taskDate !== date || t.status === 'Done' || t.status === 'Terminated' || t.isMandatorySchedule) {
          return t;
        }
        const taskStartMin = parse12HourToMinutes(t.startTime);
        if (taskStartMin >= fromMin) {
          shiftedCount++;
          const newStart = addMinutesToTime(t.startTime, shiftMinutes);
          const newEnd = addMinutesToTime(t.endTime, shiftMinutes);
          return {
            ...t,
            startTime: newStart,
            endTime: newEnd,
            status: t.status === 'Pending' ? 'Reschedule' : t.status
          };
        }
        return t;
      });
    });

    return shiftedCount;
  }, []);

  // Task CRUD & Engine operations
  const addTask = useCallback((taskData: Omit<Task, 'id' | 'projectCode' | 'dateAdded' | 'executionLogs' | 'totalActualMinutes'> & { id?: string; projectCode?: string }): Task => {
    const defaultMins = prioritySettings[taskData.priority]?.defaultMinutes ?? 60;
    const appointedMinutes = taskData.appointedMinutes || defaultMins;
    const startTime = taskData.startTime || getCurrentRoundedTime12Hour(15);
    const endTime = taskData.endTime || addMinutesToTime(startTime, appointedMinutes);
    const date = taskData.taskDate || toISODateString(new Date());
    const day = taskData.dayOfWeek || getDayOfWeekFromDate(date);

    const newTask: Task = {
      id: taskData.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      projectCode: taskData.projectCode || generateProjectCode(),
      title: taskData.title,
      description: taskData.description || '',
      dateAdded: new Date().toISOString(),
      taskDate: date,
      dayOfWeek: day,
      priority: taskData.priority,
      category: taskData.category?.trim() || 'Unknown',
      subCategory: taskData.subCategory || '',
      appointedMinutes,
      startTime,
      endTime,
      status: taskData.status || 'Pending',
      bufferMinutes: 15,
      recurrence: taskData.recurrence || 'None',
      selectedDays: taskData.selectedDays || [],
      isMandatorySchedule: taskData.isMandatorySchedule || false,
      planProjectId: taskData.planProjectId,
      executionLogs: [],
      totalActualMinutes: 0,
      notes: taskData.notes || '',
      links: taskData.links || [],
      subtasks: taskData.subtasks || []
    };

    setTasks(prev => [newTask, ...prev]);
    logLifeEvent({
      eventType: 'TASK_CREATED',
      taskId: newTask.id,
      taskTitle: newTask.title,
      projectCode: newTask.projectCode,
      priority: newTask.priority,
      category: newTask.category,
      message: `Created task "${newTask.title}" [${newTask.priority}] scheduled for ${newTask.taskDate} @ ${newTask.startTime} (${newTask.appointedMinutes}m)`,
      details: {
        newDate: newTask.taskDate,
        newStartTime: newTask.startTime,
        appointedMinutes: newTask.appointedMinutes
      }
    });

    playNotificationChime('success');
    return newTask;
  }, [prioritySettings, logLifeEvent]);

  const updateTask = useCallback((updated: Task) => {
    setTasks(prev => {
      const existing = prev.find(t => t.id === updated.id);
      
      // If user changed a recurring task's status to a closed state (Incomplete, Done, Terminated)
      if (existing && existing.recurrence && existing.recurrence !== 'None' && (updated.status === 'Incomplete' || updated.status === 'Done' || updated.status === 'Terminated')) {
        const now = new Date();
        const todayStr = toISODateString(now);
        const actionDate = updated.taskDate <= todayStr ? updated.taskDate : todayStr;

        // 1. Snapshot for the specific date
        const snapshot: Task = {
          ...updated,
          id: `snap-${updated.id}-${actionDate}-${Date.now()}`,
          taskDate: actionDate,
          dayOfWeek: getDayOfWeekFromDate(actionDate),
          recurrence: 'None',
          selectedDays: [],
          dateAdded: new Date().toISOString()
        };

        // 2. Rollover master recurring task to next occurrence date with fresh 'Pending' state
        const nextDate = getNextRecurrenceDate(existing, actionDate);
        const rolledOverMaster: Task = {
          ...existing,
          taskDate: nextDate,
          dayOfWeek: getDayOfWeekFromDate(nextDate),
          status: 'Pending' as TaskStatus,
          executionLogs: []
        };

        return [
          snapshot,
          ...prev.map(t => t.id === updated.id ? rolledOverMaster : t)
        ];
      }

      return prev.map(t => t.id === updated.id ? updated : t);
    });
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === taskId);
      if (target) {
        logLifeEvent({
          eventType: 'TASK_DELETED',
          taskId: target.id,
          taskTitle: target.title,
          projectCode: target.projectCode,
          priority: target.priority,
          category: target.category,
          message: `Deleted task "${target.title}" (${target.projectCode})`
        });
      }
      return prev.filter(t => t.id !== taskId);
    });
  }, [logLifeEvent]);

  // Recurring Delete Prompt State
  const [recurringDeletePrompt, setRecurringDeletePrompt] = useState<{
    isOpen: boolean;
    task?: Task;
    date?: string;
  } | null>(null);

  const closeRecurringDeletePrompt = useCallback(() => {
    setRecurringDeletePrompt(null);
  }, []);

  const requestDeleteTask = useCallback((task: Task, date?: string) => {
    if (task.recurrence && task.recurrence !== 'None') {
      setRecurringDeletePrompt({
        isOpen: true,
        task,
        date: date || task.taskDate || toISODateString(new Date())
      });
    } else {
      deleteTask(task.id);
    }
  }, [deleteTask]);

  // Delete only a single day's occurrence of a recurring series (adds date to excludedDates)
  const deleteRecurringInstance = useCallback((taskId: string, dateStr: string) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === taskId);
      if (!target) return prev;

      if (!target.recurrence || target.recurrence === 'None') {
        return prev.filter(t => t.id !== taskId);
      }

      const existingExclusions = target.excludedDates || [];
      const updatedExclusions = Array.from(new Set([...existingExclusions, dateStr]));

      logLifeEvent({
        eventType: 'TASK_INSTANCE_EXCLUDED',
        taskId: target.id,
        taskTitle: target.title,
        projectCode: target.projectCode,
        priority: target.priority,
        category: target.category,
        message: `Deleted recurring occurrence for "${target.title}" on ${dateStr}`,
        details: {
          previousDate: dateStr,
          newDate: dateStr
        }
      });

      return prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            excludedDates: updatedExclusions
          };
        }
        return t;
      });
    });
    setRecurringDeletePrompt(null);
    playNotificationChime('alert');
  }, [logLifeEvent]);

  // Delete the master recurring series completely
  const deleteRecurringSeries = useCallback((taskId: string) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === taskId);
      if (target) {
        logLifeEvent({
          eventType: 'TASK_SERIES_DELETED',
          taskId: target.id,
          taskTitle: target.title,
          projectCode: target.projectCode,
          priority: target.priority,
          category: target.category,
          message: `⚠️ Deleted entire recurring series for "${target.title}" [${target.recurrence}]`
        });
      }
      return prev.filter(t => t.id !== taskId);
    });
    setRecurringDeletePrompt(null);
    playNotificationChime('alert');
  }, [logLifeEvent]);

  // Pause / Resume Recurring Series
  const pauseRecurringSeries = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        logLifeEvent({
          eventType: 'TASK_HOLD',
          taskId: t.id,
          taskTitle: t.title,
          projectCode: t.projectCode,
          message: `⏸ Paused recurring schedule for "${t.title}"`
        });
        return { ...t, status: 'Hold' as TaskStatus };
      }
      return t;
    }));
  }, [logLifeEvent]);

  const resumeRecurringSeries = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        logLifeEvent({
          eventType: 'TASK_STARTED',
          taskId: t.id,
          taskTitle: t.title,
          projectCode: t.projectCode,
          message: `▶ Resumed recurring schedule for "${t.title}"`
        });
        return { ...t, status: 'Pending' as TaskStatus };
      }
      return t;
    }));
  }, [logLifeEvent]);

  // Execution Trackers: Start Task (With Exact Current Time Alignment & Early/Late Detection)
  const startTask = useCallback((taskId: string) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const todayStr = toISODateString(now);
    const curMin = now.getHours() * 60 + now.getMinutes();
    const exactCurrentTimeStr = formatMinutesTo12Hour(curMin);

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const originalScheduledStart = t.originalScheduledStartTime || t.startTime;
        let lateStartMinutes = 0;
        let earlyStartMinutes = 0;
        let diffMinutes = 0;

        if (originalScheduledStart && originalScheduledStart !== 'All Day') {
          const scheduledStartMin = parse12HourToMinutes(originalScheduledStart);
          diffMinutes = curMin - scheduledStartMin;
          if (diffMinutes > 2) {
            lateStartMinutes = diffMinutes;
          } else if (diffMinutes < -2) {
            earlyStartMinutes = Math.abs(diffMinutes);
          }
        }

        // End time will be exact time as scheduled
        const scheduledEnd = t.endTime;
        let effectiveEndTime = scheduledEnd;
        let newAppointedMinutes = t.appointedMinutes;

        if (scheduledEnd && scheduledEnd !== 'All Day') {
          const endMin = parse12HourToMinutes(scheduledEnd);
          // If started before or at scheduled end time, keep exact scheduled end
          if (curMin < endMin) {
            effectiveEndTime = scheduledEnd;
            newAppointedMinutes = endMin - curMin;
          } else {
            // If already past scheduled end time, provide duration from now
            const fallbackDuration = t.appointedMinutes > 0 ? t.appointedMinutes : 30;
            effectiveEndTime = addMinutesToTime(exactCurrentTimeStr, fallbackDuration);
            newAppointedMinutes = fallbackDuration;
          }
        }

        const logs = [...t.executionLogs, {
          startedAt: nowIso,
          actualDurationMinutes: 0,
          isLateFinish: false,
          lateStartMinutes,
          earlyStartMinutes,
          scheduledStartTime: originalScheduledStart,
          actualStartTime: exactCurrentTimeStr,
          originalEndTime: scheduledEnd
        }];

        const discrepancyText = lateStartMinutes > 0
          ? ` • ⚠️ Late Start by +${lateStartMinutes}m (Scheduled: ${originalScheduledStart})`
          : earlyStartMinutes > 0
            ? ` • ⚡ Early Start by -${earlyStartMinutes}m (Scheduled: ${originalScheduledStart})`
            : ' (On-Time)';

        logLifeEvent({
          eventType: 'TASK_STARTED',
          taskId: t.id,
          taskTitle: t.title,
          projectCode: t.projectCode,
          priority: t.priority,
          category: t.category,
          message: `⚡ Started working on task "${t.title}" (${t.projectCode})${discrepancyText}. Scheduled End preserved at ${effectiveEndTime}.`,
          details: {
            originalScheduledStartTime: originalScheduledStart,
            actualStartTime: exactCurrentTimeStr,
            scheduledEndTime: effectiveEndTime,
            lateStartMinutes,
            earlyStartMinutes,
            startDiscrepancyMinutes: diffMinutes
          }
        });

        return {
          ...t,
          taskDate: todayStr, // Aligned to today when started
          startTime: exactCurrentTimeStr, // Starts event exactly at current time
          endTime: effectiveEndTime, // End will be exact time as scheduled
          appointedMinutes: newAppointedMinutes,
          originalScheduledStartTime: originalScheduledStart,
          originalAppointedMinutes: t.originalAppointedMinutes || t.appointedMinutes,
          startDiscrepancyMinutes: diffMinutes,
          actualStartTime: exactCurrentTimeStr,
          status: 'Working' as TaskStatus,
          executionLogs: logs
        };
      } else if (t.status === 'Working') {
        // Pause any existing working task to prevent invalid parallel states
        return { ...t, status: 'Hold' as TaskStatus };
      }
      return t;
    }));
    playNotificationChime('alert');
  }, [logLifeEvent]);

  // Quick Task Duration Extension (+15 min / +30 min / +60 min)
  const extendTaskDuration = useCallback((taskId: string, extraMinutes: number) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const curEnd = t.endTime || '12:00 PM';
        const newEndTime = addMinutesToTime(curEnd, extraMinutes);
        const newAppointed = (t.appointedMinutes || 0) + extraMinutes;

        logLifeEvent({
          eventType: 'TASK_RESCHEDULED',
          taskId: t.id,
          taskTitle: t.title,
          projectCode: t.projectCode,
          priority: t.priority,
          category: t.category,
          message: `⏱️ Extended task "${t.title}" by +${extraMinutes}m (New End: ${newEndTime})`,
          details: {
            previousEndTime: curEnd,
            newEndTime,
            extraMinutes
          }
        });

        return {
          ...t,
          endTime: newEndTime,
          appointedMinutes: newAppointed
        };
      }
      return t;
    }));
    playNotificationChime('success');
  }, [logLifeEvent]);

  // Pause Task
  const pauseTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId && t.status === 'Working') {
        const lastLog = t.executionLogs[t.executionLogs.length - 1];
        if (lastLog && !lastLog.pausedAt) {
          lastLog.pausedAt = new Date().toISOString();
        }
        logLifeEvent({
          eventType: 'TASK_PAUSED',
          taskId: t.id,
          taskTitle: t.title,
          projectCode: t.projectCode,
          priority: t.priority,
          category: t.category,
          message: `⏸ Paused task "${t.title}"`
        });
        return { ...t, status: 'Hold' as TaskStatus };
      }
      return t;
    }));
  }, [logLifeEvent]);

  // Complete Task + Auto Buffer Engine (15m normal, 5m late) + Recurring Rollover
  const completeTask = useCallback((taskId: string) => {
    let completedTarget: Task | undefined;
    let isLateFinish = false;
    const now = new Date();
    const todayStr = toISODateString(now);

    setTasks(prev => {
      const target = prev.find(t => t.id === taskId);
      if (!target) return prev;

      completedTarget = target;
      let actualDuration = target.appointedMinutes;
      let isLate = false;

      const logs = [...target.executionLogs];
      if (logs.length > 0) {
        const currentLog = logs[logs.length - 1];
        currentLog.completedAt = now.toISOString();
        const startMillis = new Date(currentLog.startedAt).getTime();
        const elapsedMinutes = Math.max(1, Math.round((now.getTime() - startMillis) / 60000));
        currentLog.actualDurationMinutes = elapsedMinutes;
        actualDuration = elapsedMinutes;
        isLate = elapsedMinutes > target.appointedMinutes;
        currentLog.isLateFinish = isLate;
      }
      isLateFinish = isLate;

      const defaultBuf = capacitySettings.defaultBufferMinutes || 15;
      const bufferMinutes = isLate ? Math.min(5, defaultBuf) : defaultBuf;
      const isRecurring = target.recurrence && target.recurrence !== 'None';
      const delayMins = Math.max(0, actualDuration - target.appointedMinutes);

      logLifeEvent({
        eventType: 'TASK_COMPLETED',
        taskId: target.id,
        taskTitle: target.title,
        projectCode: target.projectCode,
        priority: target.priority,
        category: target.category,
        message: `✓ Completed "${target.title}" [${target.priority}] in ${actualDuration}m (${isLate ? `Delayed by +${delayMins}m` : 'On-Time Precision'})`,
        details: {
          durationMinutes: actualDuration,
          appointedMinutes: target.appointedMinutes,
          delayMinutes: delayMins,
          isLate
        }
      });

      if (isLate) {
        logLifeEvent({
          eventType: 'TASK_DELAYED',
          taskId: target.id,
          taskTitle: target.title,
          projectCode: target.projectCode,
          priority: target.priority,
          category: target.category,
          message: `⚠️ Task "${target.title}" exceeded allocated slot by +${delayMins} mins`,
          details: {
            durationMinutes: actualDuration,
            appointedMinutes: target.appointedMinutes,
            delayMinutes: delayMins,
            isLate: true
          }
        });
      }

      if (isRecurring) {
        // 1. Snapshot today's completed instance as an immutable Done history record
        const completionDate = target.taskDate <= todayStr ? target.taskDate : todayStr;
        const snapshot: Task = {
          ...target,
          id: `snap-${target.id}-${completionDate}-${Date.now()}`,
          taskDate: completionDate,
          dayOfWeek: getDayOfWeekFromDate(completionDate),
          status: 'Done',
          recurrence: 'None',
          selectedDays: [],
          bufferMinutes,
          totalActualMinutes: actualDuration,
          executionLogs: logs,
          dateAdded: new Date().toISOString()
        };

        // 2. Advance master recurring task to the next scheduled date with fresh 'Pending' state
        const nextDate = getNextRecurrenceDate(target, completionDate);
        return [
          snapshot,
          ...prev.map(t => {
            if (t.id === taskId) {
              return {
                ...t,
                taskDate: nextDate,
                dayOfWeek: getDayOfWeekFromDate(nextDate),
                status: 'Pending' as TaskStatus,
                executionLogs: [],
                totalActualMinutes: 0
              };
            }
            return t;
          })
        ];
      }

      return prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 'Done' as TaskStatus,
            bufferMinutes,
            totalActualMinutes: actualDuration,
            executionLogs: logs
          };
        }
        return t;
      });
    });

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch {
      // Ignored if confetti fails
    }
    playNotificationChime('timer');

    // Trigger Buffer Status Prompt: Ask what user does during the free buffer time
    if (completedTarget) {
      const current12h = getCurrentRoundedTime12Hour(1);
      const bufMin = isLateFinish ? 5 : 15;
      const bufferEnd12h = addMinutesToTime(current12h, bufMin);
      setActiveBufferPrompt({
        date: (completedTarget as Task).taskDate || todayStr,
        startTime: current12h,
        endTime: bufferEnd12h,
        durationMinutes: bufMin,
        relatedTaskId: (completedTarget as Task).id,
        relatedTaskTitle: (completedTarget as Task).title
      });
    }
  }, [logLifeEvent]);

  // Plan & Project Folders CRUD
  const addPlanProject = useCallback((folderData: Omit<PlanProjectFolder, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): PlanProjectFolder => {
    const newFolder: PlanProjectFolder = {
      id: folderData.id || `${folderData.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: folderData.type,
      title: folderData.title,
      code: folderData.code || `${folderData.type === 'plan' ? 'PLN' : 'PRJ'}-${Date.now().toString().slice(-4)}`,
      description: folderData.description || '',
      color: folderData.color || '#3B82F6',
      iconName: folderData.iconName || (folderData.type === 'plan' ? 'Target' : 'Briefcase'),
      category: folderData.category || 'VRTX',
      startDate: folderData.startDate || toISODateString(new Date()),
      endDate: folderData.endDate || toISODateString(new Date()),
      targetMinutes: folderData.targetMinutes,
      status: folderData.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setPlanProjects(prev => [newFolder, ...prev]);
    logLifeEvent({
      eventType: 'PLAN_PROJECT_CREATED',
      taskTitle: newFolder.title,
      projectCode: newFolder.code,
      message: `Created ${newFolder.type === 'plan' ? 'Plan' : 'Project'} Folder "${newFolder.title}" (${newFolder.code}) • Deadline: ${newFolder.endDate}`
    });
    playNotificationChime('success');
    return newFolder;
  }, [logLifeEvent]);

  const updatePlanProject = useCallback((updated: PlanProjectFolder) => {
    setPlanProjects(prev => prev.map(p => p.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : p));
    logLifeEvent({
      eventType: 'PLAN_PROJECT_UPDATED',
      taskTitle: updated.title,
      projectCode: updated.code,
      message: `Updated ${updated.type === 'plan' ? 'Plan' : 'Project'} Folder "${updated.title}"`
    });
  }, [logLifeEvent]);

  const deletePlanProject = useCallback((folderId: string, deleteAssociatedTasks = false) => {
    setPlanProjects(prev => {
      const target = prev.find(p => p.id === folderId);
      if (target) {
        logLifeEvent({
          eventType: 'PLAN_PROJECT_DELETED',
          taskTitle: target.title,
          projectCode: target.code,
          message: `Deleted ${target.type === 'plan' ? 'Plan' : 'Project'} Folder "${target.title}"`
        });
      }
      return prev.filter(p => p.id !== folderId);
    });

    if (deleteAssociatedTasks) {
      setTasks(prev => prev.filter(t => t.planProjectId !== folderId));
    } else {
      setTasks(prev => prev.map(t => t.planProjectId === folderId ? { ...t, planProjectId: undefined } : t));
    }
    playNotificationChime('alert');
  }, [logLifeEvent]);

  const assignTaskToPlanProject = useCallback((taskId: string, planProjectId?: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, planProjectId } : t));
  }, []);

  const holdTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        logLifeEvent({
          eventType: 'TASK_HOLD',
          taskId: t.id,
          taskTitle: t.title,
          projectCode: t.projectCode,
          priority: t.priority,
          category: t.category,
          message: `⏸ Put task "${t.title}" on Hold`
        });
        return { ...t, status: 'Hold' as TaskStatus };
      }
      return t;
    }));
  }, [logLifeEvent]);

  const rescheduleTask = useCallback((taskId: string, newDate: string, newStartTime: string) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === taskId);
      if (!target) return prev;

      if (target.isMandatorySchedule) {
        logLifeEvent({
          eventType: 'TASK_HOLD',
          taskId: target.id,
          taskTitle: target.title,
          projectCode: target.projectCode,
          priority: target.priority,
          category: target.category,
          message: `⚠️ Reschedule blocked: "${target.title}" is a Mandatory Fixed Schedule and cannot be modified.`
        });
        return prev;
      }

      const newEndTime = addMinutesToTime(newStartTime, target.appointedMinutes);
      const isRecurring = target.recurrence && target.recurrence !== 'None';

      if (isRecurring) {
        // Isolate single occurrence for today: Exclude current date from master series so future recurring tasks stay on schedule
        const originalOccurrenceDate = target.taskDate;
        const existingExclusions = target.excludedDates || [];
        const updatedExclusions = existingExclusions.includes(originalOccurrenceDate)
          ? existingExclusions
          : [...existingExclusions, originalOccurrenceDate];

        const updatedMaster: Task = {
          ...target,
          excludedDates: updatedExclusions
        };

        const singleRescheduledOccurrence: Task = {
          ...target,
          id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          taskDate: newDate,
          dayOfWeek: getDayOfWeekFromDate(newDate),
          startTime: newStartTime,
          endTime: newEndTime,
          status: 'Reschedule' as TaskStatus,
          recurrence: 'None',
          selectedDays: [],
          dateAdded: new Date().toISOString()
        };

        logLifeEvent({
          eventType: 'TASK_RESCHEDULED',
          taskId: target.id,
          taskTitle: target.title,
          projectCode: target.projectCode,
          priority: target.priority,
          category: target.category,
          message: `↻ Rescheduled single occurrence of "${target.title}" [${target.recurrence}] from ${originalOccurrenceDate} (${target.startTime}) → ${newDate} (${newStartTime}) (Next recurring stays at original time)`,
          details: {
            previousDate: originalOccurrenceDate,
            previousStartTime: target.startTime,
            newDate,
            newStartTime,
            appointedMinutes: target.appointedMinutes
          }
        });

        return [
          singleRescheduledOccurrence,
          ...prev.map(t => t.id === taskId ? updatedMaster : t)
        ];
      }

      logLifeEvent({
        eventType: 'TASK_RESCHEDULED',
        taskId: target.id,
        taskTitle: target.title,
        projectCode: target.projectCode,
        priority: target.priority,
        category: target.category,
        message: `↻ Rescheduled "${target.title}" [${target.priority}] from ${target.taskDate} (${target.startTime}) → ${newDate} (${newStartTime})`,
        details: {
          previousDate: target.taskDate,
          previousStartTime: target.startTime,
          newDate,
          newStartTime,
          appointedMinutes: target.appointedMinutes
        }
      });

      return prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            taskDate: newDate,
            dayOfWeek: getDayOfWeekFromDate(newDate),
            startTime: newStartTime,
            endTime: newEndTime,
            status: 'Reschedule' as TaskStatus
          };
        }
        return t;
      });
    });
  }, [logLifeEvent]);

  const terminateTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        logLifeEvent({
          eventType: 'TASK_TERMINATED',
          taskId: t.id,
          taskTitle: t.title,
          projectCode: t.projectCode,
          priority: t.priority,
          category: t.category,
          message: `✕ Terminated task "${t.title}" (${t.projectCode})`
        });
        return { ...t, status: 'Terminated' as TaskStatus };
      }
      return t;
    }));
  }, [logLifeEvent]);

  // Simultaneous Task Linking
  const linkSimultaneousTasks = useCallback((task1Id: string, task2Id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === task1Id) {
        const existing = t.simultaneousWithIds || [];
        return { ...t, simultaneousWithIds: Array.from(new Set([...existing, task2Id])) };
      }
      if (t.id === task2Id) {
        const existing = t.simultaneousWithIds || [];
        return { ...t, simultaneousWithIds: Array.from(new Set([...existing, task1Id])) };
      }
      return t;
    }));
  }, []);

  // Sub-task & Project/Plan Escalation Engine
  const countTotalSubtasks = (subtasks: SubTask[]): number => {
    let count = subtasks.length;
    for (const st of subtasks) {
      if (st.subtasks && st.subtasks.length > 0) {
        count += countTotalSubtasks(st.subtasks);
      }
    }
    return count;
  };

  const addSubTask = useCallback((taskId: string, title: string, parentSubTaskId?: string, assignedTimeMin?: number) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;

      const newSub: SubTask = {
        id: `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title,
        isCompleted: false,
        depthLevel: parentSubTaskId ? 2 : 1,
        assignedTimeMin: assignedTimeMin || 30,
        subtasks: []
      };

      let updatedSubtasks: SubTask[];

      if (!parentSubTaskId) {
        updatedSubtasks = [...t.subtasks, newSub];
      } else {
        const attachNested = (items: SubTask[]): SubTask[] => {
          return items.map(item => {
            if (item.id === parentSubTaskId) {
              const children = item.subtasks || [];
              newSub.depthLevel = item.depthLevel + 1;
              return { ...item, subtasks: [...children, newSub] };
            }
            if (item.subtasks && item.subtasks.length > 0) {
              return { ...item, subtasks: attachNested(item.subtasks) };
            }
            return item;
          });
        };
        updatedSubtasks = attachNested(t.subtasks);
      }

      return {
        ...t,
        subtasks: updatedSubtasks
      };
    }));
  }, []);

  const deleteSubTask = useCallback((taskId: string, subTaskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;

      const removeFromTree = (items: SubTask[]): SubTask[] => {
        return items
          .filter(item => item.id !== subTaskId)
          .map(item => ({
            ...item,
            subtasks: item.subtasks ? removeFromTree(item.subtasks) : []
          }));
      };

      return {
        ...t,
        subtasks: removeFromTree(t.subtasks)
      };
    }));
  }, []);

  const toggleSubTask = useCallback((taskId: string, subTaskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;

      const toggleInTree = (items: SubTask[]): SubTask[] => {
        return items.map(item => {
          if (item.id === subTaskId) {
            return { ...item, isCompleted: !item.isCompleted };
          }
          if (item.subtasks && item.subtasks.length > 0) {
            return { ...item, subtasks: toggleInTree(item.subtasks) };
          }
          return item;
        });
      };

      return {
        ...t,
        subtasks: toggleInTree(t.subtasks)
      };
    }));
  }, []);

  // Category CRUD
  const addCategory = useCallback((category: Omit<Category, 'id'>) => {
    const newCat: Category = {
      ...category,
      id: `cat-${Date.now()}`
    };
    setCategories(prev => [...prev, newCat]);
  }, []);

  const updateCategory = useCallback((cat: Category) => {
    setCategories(prev => {
      const oldCat = prev.find(c => c.id === cat.id);
      if (oldCat && oldCat.name !== cat.name) {
        // Cascade rename to all existing tasks using old category name
        setTasks(prevTasks => prevTasks.map(t => 
          t.category === oldCat.name ? { ...t, category: cat.name } : t
        ));
      }
      return prev.map(c => c.id === cat.id ? cat : c);
    });
  }, []);

  const deleteCategory = useCallback((catId: string) => {
    setCategories(prev => {
      const catToDelete = prev.find(c => c.id === catId);
      if (catToDelete) {
        const norm = catToDelete.name.trim().toLowerCase();
        if (norm === 'note' || norm === 'notes' || norm === 'reminder' || norm === 'reminders') {
          return prev; // Permanent core categories cannot be deleted
        }
      }
      return prev.filter(c => c.id !== catId);
    });
  }, []);

  // Reminders CRUD
  const addReminder = useCallback((rem: Omit<Reminder, 'id' | 'isTriggered' | 'isDismissed'>) => {
    const newRem: Reminder = {
      ...rem,
      id: `rem-${Date.now()}`,
      isTriggered: false,
      isDismissed: false
    };
    setReminders(prev => [newRem, ...prev]);
  }, []);

  const dismissReminder = useCallback((remId: string) => {
    setReminders(prev => prev.map(r => r.id === remId ? { ...r, isDismissed: true } : r));
  }, []);

  const deleteReminder = useCallback((remId: string) => {
    setReminders(prev => prev.filter(r => r.id !== remId));
  }, []);

  // Knowledge Hub CRUD
  const addKnowledgeItem = useCallback((item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newItem: KnowledgeItem = {
      ...item,
      id: `kno-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setKnowledge(prev => [newItem, ...prev]);
  }, []);

  const updateKnowledgeItem = useCallback((item: KnowledgeItem) => {
    setKnowledge(prev => prev.map(k => k.id === item.id ? { ...item, updatedAt: new Date().toISOString() } : k));
  }, []);

  const deleteKnowledgeItem = useCallback((itemId: string) => {
    setKnowledge(prev => prev.filter(k => k.id !== itemId));
  }, []);

  // Buffer Status Notes CRUD (24-Hour Continuous Life Accounting)
  const addBufferNote = useCallback((noteData: Omit<BufferStatusNote, 'id' | 'createdAt'> & { id?: string }): BufferStatusNote => {
    const newNote: BufferStatusNote = {
      id: noteData.id || `buf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      date: noteData.date || toISODateString(new Date()),
      startTime: noteData.startTime,
      endTime: noteData.endTime,
      durationMinutes: noteData.durationMinutes || Math.max(5, diffTimeInMinutes(noteData.startTime, noteData.endTime)),
      activityTag: noteData.activityTag || 'Break / Rest',
      notes: noteData.notes || '',
      energyLevel: noteData.energyLevel ?? 4,
      signalNoise: noteData.signalNoise,
      reflectionNotes: noteData.reflectionNotes,
      relatedTaskId: noteData.relatedTaskId,
      relatedTaskTitle: noteData.relatedTaskTitle,
      createdAt: new Date().toISOString()
    };

    setBufferNotes(prev => [newNote, ...prev]);

    logLifeEvent({
      eventType: 'BUFFER_NOTE_LOGGED',
      taskId: newNote.relatedTaskId,
      taskTitle: newNote.relatedTaskTitle,
      category: 'Buffer / Rest',
      message: `☕ Buffer Logged: [${newNote.activityTag}] ${newNote.startTime} - ${newNote.endTime} (${newNote.durationMinutes}m) • "${newNote.notes || 'Free Time'}"`,
      details: {
        newDate: newNote.date,
        newStartTime: newNote.startTime,
        durationMinutes: newNote.durationMinutes,
        bufferActivityTag: newNote.activityTag,
        bufferNotes: newNote.notes,
        signalNoiseType: newNote.signalNoise
      }
    });

    playNotificationChime('success');
    return newNote;
  }, [logLifeEvent]);

  const updateBufferNote = useCallback((updated: BufferStatusNote) => {
    setBufferNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
  }, []);

  const deleteBufferNote = useCallback((noteId: string) => {
    setBufferNotes(prev => {
      const target = prev.find(n => n.id === noteId);
      if (target) {
        logLifeEvent({
          eventType: 'BUFFER_NOTE_DELETED',
          taskId: target.relatedTaskId,
          taskTitle: target.relatedTaskTitle,
          category: 'Buffer / Rest',
          message: `Deleted buffer note [${target.activityTag}] (${target.startTime} - ${target.endTime})`
        });
      }
      return prev.filter(n => n.id !== noteId);
    });
  }, [logLifeEvent]);

  // 1-Click Signal vs Noise Toggle for any 24h timeline interval or diary entry
  const toggleSliceSignalNoise = useCallback((slice: DaySlice24) => {
    const newType: SignalNoiseType = slice.signalNoise === 'signal' ? 'noise' : 'signal';

    if (slice.task) {
      const taskId = slice.task.id;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, signalNoise: newType } : t));
      logLifeEvent({
        eventType: 'SETTINGS_UPDATED',
        taskId: slice.task.id,
        taskTitle: slice.task.title,
        message: `Toggled task "${slice.task.title}" to ${newType === 'signal' ? '🎯 SIGNAL' : '⚠️ NOISE'}`,
        details: { signalNoiseType: newType }
      });
    } else if (slice.bufferNote) {
      const noteId = slice.bufferNote.id;
      setBufferNotes(prev => prev.map(b => b.id === noteId ? { ...b, signalNoise: newType } : b));
      logLifeEvent({
        eventType: 'SETTINGS_UPDATED',
        message: `Toggled diary entry "${slice.title}" to ${newType === 'signal' ? '🎯 SIGNAL' : '⚠️ NOISE'}`,
        details: { signalNoiseType: newType }
      });
    }
    playNotificationChime('alert');
  }, [logLifeEvent]);

  // Fast inline Micro-Diary entry composer
  const addQuickDiaryEntry = useCallback((entry: {
    date: string;
    startTime: string;
    durationMinutes: number;
    text: string;
    activityTag?: string;
    signalNoise?: SignalNoiseType;
    energyLevel?: number;
  }): BufferStatusNote => {
    const endTime = addMinutesToTime(entry.startTime, entry.durationMinutes);
    const activityTag = entry.activityTag || 'Other Activity';

    // Auto-detect signal vs noise if not explicitly set
    const detectedSN = entry.signalNoise || detectSignalVsNoise({
      title: activityTag,
      notes: entry.text,
      tag: activityTag,
      energyLevel: entry.energyLevel ?? 4
    }).type;

    return addBufferNote({
      date: entry.date,
      startTime: entry.startTime,
      endTime,
      durationMinutes: entry.durationMinutes,
      activityTag,
      notes: entry.text,
      signalNoise: detectedSN,
      energyLevel: entry.energyLevel ?? 4
    });
  }, [addBufferNote]);

  // Buffer Activity Categories CRUD (Fully Editable)
  const addBufferCategory = useCallback((catData: Omit<BufferCategoryItem, 'id'> & { id?: string }) => {
    const newCat: BufferCategoryItem = {
      ...catData,
      id: catData.id || `bcat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tag: catData.tag || catData.label,
      isSystem: false
    };
    setBufferCategories(prev => [...prev, newCat]);
    playNotificationChime('success');
  }, []);

  const updateBufferCategory = useCallback((updated: BufferCategoryItem) => {
    setBufferCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
  }, []);

  const deleteBufferCategory = useCallback((catId: string) => {
    setBufferCategories(prev => prev.filter(c => c.id !== catId));
  }, []);

  const resetBufferCategories = useCallback(() => {
    setBufferCategories(INITIAL_BUFFER_CATEGORIES);
  }, []);

  // Emergency Categories CRUD (Fully Editable)
  const addEmergencyCategory = useCallback((catData: Omit<EmergencyCategoryItem, 'id'> & { id?: string }) => {
    const newCat: EmergencyCategoryItem = {
      ...catData,
      id: catData.id || `ecat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      isSystem: false
    };
    setEmergencyCategories(prev => [...prev, newCat]);
    playNotificationChime('success');
  }, []);

  const updateEmergencyCategory = useCallback((updated: EmergencyCategoryItem) => {
    setEmergencyCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
  }, []);

  const deleteEmergencyCategory = useCallback((catId: string) => {
    setEmergencyCategories(prev => prev.filter(c => c.id !== catId));
  }, []);

  const resetEmergencyCategories = useCallback(() => {
    setEmergencyCategories(INITIAL_EMERGENCY_CATEGORIES);
  }, []);

  // Settings
  const updateCapacitySettings = useCallback((settings: CapacitySettings) => {
    setCapacitySettings(settings);
    // Automatically synchronize pending tasks to new default buffer
    const newDefBuffer = settings.defaultBufferMinutes || 15;
    setTasks(prev => prev.map(t => {
      if (t.status === 'Pending') {
        return {
          ...t,
          bufferMinutes: newDefBuffer
        };
      }
      return t;
    }));
  }, []);

  const updatePrioritySettings = useCallback((settings: PrioritySettings) => {
    setPrioritySettings(settings);
  }, []);

  const updateDefaultTaskSettings = useCallback((settings: DefaultTaskSettings) => {
    setDefaultTaskSettings(settings);
  }, []);

  // Backup / Restore & 100% System Data Hub
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupModalTab, setBackupModalTab] = useState<'export' | 'restore'>('export');
  const [canRollback, setCanRollback] = useState(Boolean(getRollbackSnapshot()));

  const openBackupModal = useCallback((tab: 'export' | 'restore' = 'export') => {
    setBackupModalTab(tab);
    setIsBackupModalOpen(true);
    setCanRollback(Boolean(getRollbackSnapshot()));
  }, []);

  const closeBackupModal = useCallback(() => {
    setIsBackupModalOpen(false);
  }, []);

  const exportStateJson = useCallback((): string => {
    return createFullSystemBackup({
      tasks,
      bufferNotes,
      planProjects,
      categories,
      bufferCategories,
      emergencyCategories,
      knowledge,
      reminders,
      auditLogs,
      capacitySettings,
      prioritySettings,
      defaultTaskSettings,
      securitySettings,
      cloudSyncConfig,
      theme
    });
  }, [
    tasks, bufferNotes, planProjects, categories, bufferCategories,
    emergencyCategories, knowledge, reminders, auditLogs, capacitySettings,
    prioritySettings, defaultTaskSettings, securitySettings, cloudSyncConfig, theme
  ]);

  const exportSettingsOnlyJson = useCallback((): string => {
    return createSettingsOnlyBackup({
      categories,
      bufferCategories,
      emergencyCategories,
      capacitySettings,
      prioritySettings,
      defaultTaskSettings,
      securitySettings,
      cloudSyncConfig,
      theme
    });
  }, [
    categories, bufferCategories, emergencyCategories, capacitySettings,
    prioritySettings, defaultTaskSettings, securitySettings, cloudSyncConfig, theme
  ]);

  const importStateJson = useCallback((jsonStr: string, mode: 'full' | 'merge' | 'settings_only' = 'full'): boolean => {
    try {
      const validation = validateBackupBundle(jsonStr);
      if (!validation.isValid) {
        console.error('Backup validation failed:', validation.error);
        return false;
      }

      // Save rollback snapshot of current system before touching anything
      const currentFullBackup = exportStateJson();
      saveRollbackSnapshot(currentFullBackup);
      setCanRollback(true);

      const parsed = validation.parsedData;
      const isV2Full = validation.type === 'FULL_SYSTEM_BACKUP';
      const isV2Settings = validation.type === 'SETTINGS_ONLY_BACKUP';

      // Data extraction
      const incomingTasks: Task[] = isV2Full ? parsed.data?.tasks : parsed.tasks;
      const incomingBufferNotes: BufferStatusNote[] = isV2Full ? parsed.data?.bufferNotes : parsed.bufferNotes;
      const incomingProjects: PlanProjectFolder[] = isV2Full ? parsed.data?.planProjects : parsed.planProjects;
      const incomingCategories: Category[] = isV2Full ? parsed.data?.categories : (isV2Settings ? parsed.categories : parsed.categories);
      const incomingBufferCategories: BufferCategoryItem[] = isV2Full ? parsed.data?.bufferCategories : (isV2Settings ? parsed.bufferCategories : parsed.bufferCategories);
      const incomingEmergencyCategories: EmergencyCategoryItem[] = isV2Full ? parsed.data?.emergencyCategories : (isV2Settings ? parsed.emergencyCategories : parsed.emergencyCategories);
      const incomingKnowledge: KnowledgeItem[] = isV2Full ? parsed.data?.knowledge : parsed.knowledge;
      const incomingReminders: Reminder[] = isV2Full ? parsed.data?.reminders : parsed.reminders;
      const incomingAuditLogs: LifeEventLog[] = isV2Full ? parsed.data?.auditLogs : parsed.auditLogs;

      // Settings extraction
      const settingsObj = isV2Full || isV2Settings ? parsed.settings : parsed;
      const incomingCapacity = settingsObj?.capacitySettings || parsed.capacitySettings;
      const incomingPriorities = settingsObj?.prioritySettings || parsed.prioritySettings;
      const incomingDefaults = settingsObj?.defaultTaskSettings || parsed.defaultTaskSettings;
      const incomingSecurity = settingsObj?.securitySettings || parsed.securitySettings;
      const incomingCloud = settingsObj?.cloudSyncConfig || parsed.cloudSyncConfig;
      const incomingTheme = settingsObj?.theme || parsed.theme;

      // Apply settings
      if (incomingCapacity) setCapacitySettings(incomingCapacity);
      if (incomingPriorities) setPrioritySettings(incomingPriorities);
      if (incomingDefaults) setDefaultTaskSettings(incomingDefaults);
      if (incomingSecurity) setSecuritySettings(incomingSecurity);
      if (incomingCloud) setCloudSyncConfig(incomingCloud);
      if (incomingTheme) setTheme(incomingTheme);

      if (mode === 'settings_only') {
        if (incomingCategories && incomingCategories.length > 0) setCategories(incomingCategories);
        if (incomingBufferCategories && incomingBufferCategories.length > 0) setBufferCategories(incomingBufferCategories);
        if (incomingEmergencyCategories && incomingEmergencyCategories.length > 0) setEmergencyCategories(incomingEmergencyCategories);
        playNotificationChime('success');
        return true;
      }

      if (mode === 'merge') {
        // Smart merge: update existing or add new
        if (incomingTasks) {
          setTasks(prev => {
            const map = new Map(prev.map(t => [t.id, t]));
            incomingTasks.forEach(t => map.set(t.id, t));
            return Array.from(map.values());
          });
        }
        if (incomingBufferNotes) {
          setBufferNotes(prev => {
            const map = new Map(prev.map(b => [b.id, b]));
            incomingBufferNotes.forEach(b => map.set(b.id, b));
            return Array.from(map.values());
          });
        }
        if (incomingProjects) {
          setPlanProjects(prev => {
            const map = new Map(prev.map(p => [p.id, p]));
            incomingProjects.forEach(p => map.set(p.id, p));
            return Array.from(map.values());
          });
        }
        if (incomingCategories) {
          setCategories(prev => {
            const map = new Map(prev.map(c => [c.id, c]));
            incomingCategories.forEach(c => map.set(c.id, c));
            return Array.from(map.values());
          });
        }
        if (incomingBufferCategories) {
          setBufferCategories(prev => {
            const map = new Map(prev.map(c => [c.id, c]));
            incomingBufferCategories.forEach(c => map.set(c.id, c));
            return Array.from(map.values());
          });
        }
        if (incomingEmergencyCategories) {
          setEmergencyCategories(prev => {
            const map = new Map(prev.map(c => [c.id, c]));
            incomingEmergencyCategories.forEach(c => map.set(c.id, c));
            return Array.from(map.values());
          });
        }
        if (incomingKnowledge) {
          setKnowledge(prev => {
            const map = new Map(prev.map(k => [k.id, k]));
            incomingKnowledge.forEach(k => map.set(k.id, k));
            return Array.from(map.values());
          });
        }
        if (incomingReminders) {
          setReminders(prev => {
            const map = new Map(prev.map(r => [r.id, r]));
            incomingReminders.forEach(r => map.set(r.id, r));
            return Array.from(map.values());
          });
        }
        if (incomingAuditLogs) {
          setAuditLogs(prev => {
            const map = new Map(prev.map(l => [l.id, l]));
            incomingAuditLogs.forEach(l => map.set(l.id, l));
            return Array.from(map.values());
          });
        }
      } else {
        // Full clean restore
        if (incomingTasks) setTasks(incomingTasks);
        if (incomingBufferNotes) setBufferNotes(incomingBufferNotes);
        if (incomingProjects) setPlanProjects(incomingProjects);
        if (incomingCategories) setCategories(incomingCategories);
        if (incomingBufferCategories) setBufferCategories(incomingBufferCategories);
        if (incomingEmergencyCategories) setEmergencyCategories(incomingEmergencyCategories);
        if (incomingKnowledge) setKnowledge(incomingKnowledge);
        if (incomingReminders) setReminders(incomingReminders);
        if (incomingAuditLogs) setAuditLogs(incomingAuditLogs);
      }

      playNotificationChime('success');
      return true;
    } catch (e) {
      console.error('Failed to import backup JSON', e);
      return false;
    }
  }, [exportStateJson, setTheme]);

  const rollbackLastRestore = useCallback((): boolean => {
    const snapshot = getRollbackSnapshot();
    if (!snapshot || !snapshot.backupJson) return false;
    try {
      const parsed = JSON.parse(snapshot.backupJson);
      const isV2Full = parsed.systemIdentifier === 'OPTIMUSTIME_COMPLETE_SYSTEM_BACKUP';
      const d = isV2Full ? parsed.data : parsed;
      const s = isV2Full ? parsed.settings : parsed;

      if (d.tasks) setTasks(d.tasks);
      if (d.bufferNotes) setBufferNotes(d.bufferNotes);
      if (d.planProjects) setPlanProjects(d.planProjects);
      if (d.categories) setCategories(d.categories);
      if (d.bufferCategories) setBufferCategories(d.bufferCategories);
      if (d.emergencyCategories) setEmergencyCategories(d.emergencyCategories);
      if (d.knowledge) setKnowledge(d.knowledge);
      if (d.reminders) setReminders(d.reminders);
      if (d.auditLogs) setAuditLogs(d.auditLogs);

      if (s.capacitySettings) setCapacitySettings(s.capacitySettings);
      if (s.prioritySettings) setPrioritySettings(s.prioritySettings);
      if (s.defaultTaskSettings) setDefaultTaskSettings(s.defaultTaskSettings);
      if (s.securitySettings) setSecuritySettings(s.securitySettings);
      if (s.cloudSyncConfig) setCloudSyncConfig(s.cloudSyncConfig);
      if (s.theme) setTheme(s.theme);

      clearRollbackSnapshot();
      setCanRollback(false);
      playNotificationChime('success');
      return true;
    } catch (e) {
      console.error('Failed rollback', e);
      return false;
    }
  }, [setTheme]);

  const resetToDefaultData = useCallback(() => {
    // Save rollback snapshot of current state before wiping to demo defaults
    const currentFullBackup = exportStateJson();
    saveRollbackSnapshot(currentFullBackup);
    setCanRollback(true);

    setTasks(INITIAL_TASKS);
    setCategories(INITIAL_CATEGORIES);
    setCapacitySettings(DEFAULT_CAPACITY);
    setPrioritySettings(DEFAULT_PRIORITIES);
    setReminders(INITIAL_REMINDERS);
    setKnowledge(INITIAL_KNOWLEDGE);
    setBufferNotes(INITIAL_BUFFER_NOTES);
    setTheme('light');
  }, [exportStateJson, setTheme]);

  return (
    <AppContext.Provider
      value={{
        tasks,
        categories,
        capacitySettings,
        prioritySettings,
        defaultTaskSettings,
        reminders,
        knowledge,
        theme,
        activeTab,
        activeTaskId,
        searchQuery,
        selectedCategoryFilter,
        setTheme,
        setActiveTab,
        setSearchQuery,
        setSelectedCategoryFilter,
        addTask,
        updateTask,
        deleteTask,
        deleteRecurringInstance,
        deleteRecurringSeries,
        pauseRecurringSeries,
        resumeRecurringSeries,
        requestDeleteTask,
        recurringDeletePrompt,
        closeRecurringDeletePrompt,
        startTask,
        pauseTask,
        completeTask,
        holdTask,
        rescheduleTask,
        terminateTask,
        extendTaskDuration,
        detectConflicts,
        cascadeShiftDownstream,
        linkSimultaneousTasks,
        addSubTask,
        deleteSubTask,
        toggleSubTask,
        addCategory,
        updateCategory,
        deleteCategory,
        addReminder,
        dismissReminder,
        deleteReminder,
        addKnowledgeItem,
        updateKnowledgeItem,
        deleteKnowledgeItem,
        planProjects,
        addPlanProject,
        updatePlanProject,
        deletePlanProject,
        assignTaskToPlanProject,
        bufferNotes,
        bufferCategories,
        addBufferNote,
        updateBufferNote,
        deleteBufferNote,
        addBufferCategory,
        updateBufferCategory,
        deleteBufferCategory,
        resetBufferCategories,
        bufferNoteModalState,
        openBufferNoteModal,
        closeBufferNoteModal,
        activeBufferPrompt,
        setActiveBufferPrompt,
        toggleSliceSignalNoise,
        addQuickDiaryEntry,
        isEmergencyModalOpen,
        emergencyModalParams,
        openEmergencyModal,
        closeEmergencyModal,
        triggerEmergencyBuffer,
        emergencyCategories,
        addEmergencyCategory,
        updateEmergencyCategory,
        deleteEmergencyCategory,
        resetEmergencyCategories,
        updateCapacitySettings,
        updatePrioritySettings,
        updateDefaultTaskSettings,
        securitySettings,
        updateSecuritySettings,
        isAuthenticated,
        login,
        logout,
        cloudSyncConfig,
        cloudSyncStatus,
        updateCloudSyncConfig,
        syncNow,
        pushToCloud,
        pullFromCloud,
        testCloudConnection,
        exportStateJson,
        exportSettingsOnlyJson,
        importStateJson,
        rollbackLastRestore,
        canRollback,
        resetToDefaultData,
        isBackupModalOpen,
        backupModalTab,
        openBackupModal,
        closeBackupModal,
        auditLogs,
        logLifeEvent,
        clearAuditLogs,
        dailyScheduledMinutes,
        isCapacityRedLineExceeded
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
