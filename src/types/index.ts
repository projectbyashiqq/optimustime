export type PriorityLevel = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export type TaskStatus = 
  | 'Pending' 
  | 'Working' 
  | 'Done' 
  | 'Hold' 
  | 'Terminated' 
  | 'Reschedule' 
  | 'Incomplete';

export type RecurrenceType = 
  | 'None' 
  | 'Daily' 
  | 'Selected Days' 
  | 'Weekly' 
  | 'Monthly' 
  | 'Yearly';

export interface SubTask {
  id: string;
  title: string;
  isCompleted: boolean;
  depthLevel: number;
  assignedTimeMin?: number;
  subtasks?: SubTask[];
}

export interface TaskExecutionLog {
  startedAt: string; // ISO string
  pausedAt?: string;
  resumedAt?: string;
  completedAt?: string;
  actualDurationMinutes: number;
  isLateFinish: boolean;
  notes?: string;
}

export interface TaskLink {
  id: string;
  title: string;
  url: string;
  type: 'doc' | 'url' | 'github' | 'design' | 'other';
}

export interface Task {
  id: string;
  projectCode: string; // e.g. "OPT-2609-8472"
  title: string;
  description: string;
  dateAdded: string; // ISO timestamp
  taskDate: string; // YYYY-MM-DD
  dayOfWeek: string; // Monday, Tuesday, etc.
  priority: PriorityLevel;
  category: string;
  subCategory?: string;
  appointedMinutes: number;
  startTime: string; // "09:00 AM" or "All Day"
  endTime: string; // "10:30 AM" or "All Day"
  isAllDay?: boolean;
  status: TaskStatus;
  bufferMinutes: number; // 15 or 5
  recurrence: RecurrenceType;
  selectedDays?: string[]; // e.g. ["Mon", "Wed", "Fri"]
  
  // Trackers & Analytics
  executionLogs: TaskExecutionLog[];
  totalActualMinutes: number;
  
  // Knowledge, Links & Sub-tasks
  notes?: string;
  links: TaskLink[];
  subtasks: SubTask[];
  
  // Project Escalation
  isProject?: boolean;
  escalationReason?: string;
  
  // Simultaneous execution tracking
  simultaneousWithIds?: string[];
}

export interface Category {
  id: string;
  name: string;
  color: string;
  iconName: string;
  subCategories: string[];
  isSystem?: boolean;
}

export interface CapacitySettings {
  maxWorkHours: number; // Default: 14
  sleepHours: number; // Default: 6
  bufferHours: number; // Default: 2
  dayStartTime: string; // "06:00 AM"
  dayEndTime: string; // "11:00 PM"
}

export interface PrioritySettings {
  P1: { label: string; defaultMinutes: number; description: string; color: string; bgColor: string };
  P2: { label: string; defaultMinutes: number; description: string; color: string; bgColor: string };
  P3: { label: string; defaultMinutes: number; description: string; color: string; bgColor: string };
  P4: { label: string; defaultMinutes: number; description: string; color: string; bgColor: string };
  P5: { label: string; defaultMinutes: number; description: string; color: string; bgColor: string };
}

export interface Reminder {
  id: string;
  taskId?: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // "10:00 AM"
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  notes?: string;
  isTriggered: boolean;
  isDismissed: boolean;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  links: string[];
  createdAt: string;
  updatedAt: string;
  relatedTaskIds?: string[];
}

export type ThemeName = 
  | 'light' 
  | 'cyber-dark' 
  | 'nord-slate' 
  | 'emerald-obsidian' 
  | 'sunset-amber' 
  | 'rose-quartz';

export type ActiveTab = 
  | 'dashboard' 
  | 'all-tasks' 
  | 'categories' 
  | 'projects' 
  | 'analytics' 
  | 'knowledge' 
  | 'reminders' 
  | 'settings';

export interface SecuritySettings {
  isPasswordProtected: boolean;
  masterPassword: string; // Plain/hashed master key
  autoLockMinutes: number; // 0 = never, 15, 30, 60, 240
  username: string; // e.g. "Master Admin"
}

export type CloudSyncStatus = 'offline' | 'connecting' | 'synced' | 'syncing' | 'error';

export interface CloudSyncConfig {
  isEnabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  tableName: string; // Default: 'optimustime_data'
  lastSyncedAt?: string;
  autoRealtimeSync: boolean;
}

export type LifeEventType = 
  | 'TASK_CREATED'
  | 'TASK_STARTED'
  | 'TASK_PAUSED'
  | 'TASK_COMPLETED'
  | 'TASK_DELAYED'
  | 'TASK_RESCHEDULED'
  | 'TASK_INCOMPLETE'
  | 'TASK_HOLD'
  | 'TASK_TERMINATED'
  | 'TASK_DELETED'
  | 'CAPACITY_WARNING'
  | 'SETTINGS_UPDATED';

export interface LifeEventLog {
  id: string;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  eventType: LifeEventType;
  taskId?: string;
  taskTitle?: string;
  projectCode?: string;
  priority?: PriorityLevel;
  category?: string;
  message: string;
  details?: {
    previousStartTime?: string;
    newStartTime?: string;
    previousDate?: string;
    newDate?: string;
    durationMinutes?: number;
    appointedMinutes?: number;
    delayMinutes?: number;
    isLate?: boolean;
    reason?: string;
  };
}


