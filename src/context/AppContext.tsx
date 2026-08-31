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
  CloudSyncStatus
} from '../types';
import { 
  DEFAULT_CAPACITY, 
  DEFAULT_PRIORITIES, 
  DEFAULT_SECURITY,
  DEFAULT_CLOUD_SYNC,
  INITIAL_CATEGORIES, 
  INITIAL_TASKS, 
  INITIAL_KNOWLEDGE, 
  INITIAL_REMINDERS 
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
  isTaskScheduledForDate
} from '../utils/timeUtils';
import { 
  pushStateToCloud, 
  pullStateFromCloud, 
  subscribeToRealtimeCloud,
  testSupabaseConnection 
} from '../services/supabase';
import confetti from 'canvas-confetti';

interface AppContextType {
  // State
  tasks: Task[];
  categories: Category[];
  capacitySettings: CapacitySettings;
  prioritySettings: PrioritySettings;
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
  startTask: (taskId: string) => void;
  pauseTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  holdTask: (taskId: string) => void;
  rescheduleTask: (taskId: string, newDate: string, newStartTime: string) => void;
  terminateTask: (taskId: string) => void;
  
  // Conflict & Cascading Shift Engine
  detectConflicts: (date: string, startTime: string, endTime: string, ignoreTaskId?: string) => Task[];
  cascadeShiftDownstream: (date: string, fromStartTime: string, shiftMinutes: number, ignoreTaskId?: string) => number;
  linkSimultaneousTasks: (task1Id: string, task2Id: string) => void;
  
  // Sub-task & Escalation Engine
  addSubTask: (taskId: string, title: string, parentSubTaskId?: string) => void;
  toggleSubTask: (taskId: string, subTaskId: string) => void;
  escalateToProject: (taskId: string, reason?: string) => void;
  
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
  
  // Settings & Capacity
  updateCapacitySettings: (settings: CapacitySettings) => void;
  updatePrioritySettings: (settings: PrioritySettings) => void;
  
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
  
  // Backup / Restore
  exportStateJson: () => string;
  importStateJson: (jsonStr: string) => boolean;
  resetToDefaultData: () => void;
  
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
      return saved ? JSON.parse(saved) : DEFAULT_CAPACITY;
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
      localStorage.setItem(`${STORAGE_KEY}_reminders`, JSON.stringify(reminders));
      localStorage.setItem(`${STORAGE_KEY}_knowledge`, JSON.stringify(knowledge));
      localStorage.setItem(`${STORAGE_KEY}_theme`, theme);
      localStorage.setItem(`${STORAGE_KEY}_security`, JSON.stringify(securitySettings));
      localStorage.setItem(`${STORAGE_KEY}_cloud_sync`, JSON.stringify(cloudSyncConfig));
    } catch (e) {
      console.error('Failed to sync to LocalStorage', e);
    }
  }, [tasks, categories, capacitySettings, prioritySettings, reminders, knowledge, theme, securitySettings, cloudSyncConfig]);

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
      theme,
      securitySettings
    };
  }, [tasks, categories, capacitySettings, prioritySettings, reminders, knowledge, theme, securitySettings]);

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

  // Automated 2-Hour Inactivity Auto-Incomplete Engine
  // Automatically marks any task as 'Incomplete' if not started or not closed after 2 hours (120 mins)
  useEffect(() => {
    const evaluateIncompleteTasks = () => {
      const now = new Date();
      const todayStr = toISODateString(now);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      setTasks(prevTasks => {
        let hasChanges = false;
        const updated = prevTasks.map(task => {
          if (task.status === 'Done' || task.status === 'Terminated' || task.status === 'Incomplete') {
            return task;
          }

          // Rule 1: Pending task not started after 2 hours from scheduled startTime
          if (task.status === 'Pending') {
            const isPastDay = task.taskDate < todayStr;
            const isTodayExpired = task.taskDate === todayStr && nowMinutes >= (parse12HourToMinutes(task.startTime) + 120);

            if (isPastDay || isTodayExpired) {
              hasChanges = true;
              return { ...task, status: 'Incomplete' as TaskStatus };
            }
          }

          // Rule 2: Working task not closed/completed after 2 hours from scheduled endTime
          if (task.status === 'Working') {
            const isPastDay = task.taskDate < todayStr;
            const isTodayExpired = task.taskDate === todayStr && nowMinutes >= (parse12HourToMinutes(task.endTime) + 120);

            if (isPastDay || isTodayExpired) {
              hasChanges = true;
              return { ...task, status: 'Incomplete' as TaskStatus };
            }
          }

          return task;
        });

        return hasChanges ? updated : prevTasks;
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
        if (t.id === ignoreTaskId || t.taskDate !== date || t.status === 'Done' || t.status === 'Terminated') {
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
    const startTime = taskData.startTime || '09:00 AM';
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
      category: taskData.category || 'VRTX',
      subCategory: taskData.subCategory || '',
      appointedMinutes,
      startTime,
      endTime,
      status: taskData.status || 'Pending',
      bufferMinutes: 15,
      recurrence: taskData.recurrence || 'None',
      selectedDays: taskData.selectedDays || [],
      executionLogs: [],
      totalActualMinutes: 0,
      notes: taskData.notes || '',
      links: taskData.links || [],
      subtasks: taskData.subtasks || [],
      isProject: taskData.isProject || false,
      escalationReason: taskData.escalationReason
    };

    setTasks(prev => [newTask, ...prev]);
    playNotificationChime('success');
    return newTask;
  }, [prioritySettings]);

  const updateTask = useCallback((updated: Task) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  // Execution Trackers: Start Task
  const startTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const nowIso = new Date().toISOString();
        const logs = [...t.executionLogs, {
          startedAt: nowIso,
          actualDurationMinutes: 0,
          isLateFinish: false
        }];
        return {
          ...t,
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
  }, []);

  // Pause Task
  const pauseTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId && t.status === 'Working') {
        const lastLog = t.executionLogs[t.executionLogs.length - 1];
        if (lastLog && !lastLog.pausedAt) {
          lastLog.pausedAt = new Date().toISOString();
        }
        return { ...t, status: 'Hold' as TaskStatus };
      }
      return t;
    }));
  }, []);

  // Complete Task + Auto Buffer Engine (15m normal, 5m late) + Cascading Shift
  const completeTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === taskId);
      if (!target) return prev;

      const now = new Date();
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

      // Buffer Duration Logic:
      // Normal completion adds 15m Buffer Time; Late start/finish reduces buffer to 5m.
      const bufferMinutes = isLate ? 5 : 15;

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
  }, []);

  const holdTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Hold' as TaskStatus } : t));
  }, []);

  const rescheduleTask = useCallback((taskId: string, newDate: string, newStartTime: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newEndTime = addMinutesToTime(newStartTime, t.appointedMinutes);
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
    }));
  }, []);

  const terminateTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Terminated' as TaskStatus } : t));
  }, []);

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

  // Sub-task & Auto Project Escalation Engine
  const countTotalSubtasks = (subtasks: SubTask[]): number => {
    let count = subtasks.length;
    for (const st of subtasks) {
      if (st.subtasks && st.subtasks.length > 0) {
        count += countTotalSubtasks(st.subtasks);
      }
    }
    return count;
  };

  const addSubTask = useCallback((taskId: string, title: string, parentSubTaskId?: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;

      const newSub: SubTask = {
        id: `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title,
        isCompleted: false,
        depthLevel: parentSubTaskId ? 2 : 1,
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

      // Check for multi-level escalation
      const totalCount = countTotalSubtasks(updatedSubtasks);
      const shouldEscalate = totalCount >= 4 || newSub.depthLevel >= 2;

      return {
        ...t,
        subtasks: updatedSubtasks,
        isProject: t.isProject || shouldEscalate,
        escalationReason: shouldEscalate && !t.isProject 
          ? `Auto-Escalated to Project: Contains multi-level submodules (${totalCount} subtasks, Level ${newSub.depthLevel} depth)` 
          : t.escalationReason
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

  const escalateToProject = useCallback((taskId: string, reason?: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          isProject: true,
          escalationReason: reason || 'Manually promoted to full project status with multi-level tracking.'
        };
      }
      return t;
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
    setCategories(prev => prev.map(c => c.id === cat.id ? cat : c));
  }, []);

  const deleteCategory = useCallback((catId: string) => {
    setCategories(prev => prev.filter(c => c.id !== catId));
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

  // Settings
  const updateCapacitySettings = useCallback((settings: CapacitySettings) => {
    setCapacitySettings(settings);
  }, []);

  const updatePrioritySettings = useCallback((settings: PrioritySettings) => {
    setPrioritySettings(settings);
  }, []);

  // Backup / Restore
  const exportStateJson = useCallback((): string => {
    const bundle = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      tasks,
      categories,
      capacitySettings,
      prioritySettings,
      reminders,
      knowledge,
      theme
    };
    return JSON.stringify(bundle, null, 2);
  }, [tasks, categories, capacitySettings, prioritySettings, reminders, knowledge, theme]);

  const importStateJson = useCallback((jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.tasks) setTasks(data.tasks);
      if (data.categories) setCategories(data.categories);
      if (data.capacitySettings) setCapacitySettings(data.capacitySettings);
      if (data.prioritySettings) setPrioritySettings(data.prioritySettings);
      if (data.reminders) setReminders(data.reminders);
      if (data.knowledge) setKnowledge(data.knowledge);
      if (data.theme) setTheme(data.theme);
      return true;
    } catch (e) {
      console.error('Failed to import state JSON', e);
      return false;
    }
  }, [setTheme]);

  const resetToDefaultData = useCallback(() => {
    setTasks(INITIAL_TASKS);
    setCategories(INITIAL_CATEGORIES);
    setCapacitySettings(DEFAULT_CAPACITY);
    setPrioritySettings(DEFAULT_PRIORITIES);
    setReminders(INITIAL_REMINDERS);
    setKnowledge(INITIAL_KNOWLEDGE);
    setTheme('light');
  }, [setTheme]);

  return (
    <AppContext.Provider
      value={{
        tasks,
        categories,
        capacitySettings,
        prioritySettings,
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
        startTask,
        pauseTask,
        completeTask,
        holdTask,
        rescheduleTask,
        terminateTask,
        detectConflicts,
        cascadeShiftDownstream,
        linkSimultaneousTasks,
        addSubTask,
        toggleSubTask,
        escalateToProject,
        addCategory,
        updateCategory,
        deleteCategory,
        addReminder,
        dismissReminder,
        deleteReminder,
        addKnowledgeItem,
        updateKnowledgeItem,
        deleteKnowledgeItem,
        updateCapacitySettings,
        updatePrioritySettings,
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
        importStateJson,
        resetToDefaultData,
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
