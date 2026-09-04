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
  lateStartMinutes?: number; // Late start tracking vs scheduled start
  earlyStartMinutes?: number; // Early start tracking vs scheduled start
  scheduledStartTime?: string;
  actualStartTime?: string;
  originalEndTime?: string;
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
  endDate?: string; // YYYY-MM-DD when task spans across midnight to next calendar day
  crossesMidnight?: boolean; // True when endTime < startTime (e.g. 11:00 PM -> 01:00 AM)
  isAllDay?: boolean;
  status: TaskStatus;
  bufferMinutes: number; // 15 or 5
  recurrence: RecurrenceType;
  selectedDays?: string[]; // e.g. ["Mon", "Wed", "Fri"]
  excludedDates?: string[]; // Dates (YYYY-MM-DD) where this recurring instance was skipped/deleted
  
  // Trackers & Analytics
  executionLogs: TaskExecutionLog[];
  totalActualMinutes: number;
  
  // Knowledge, Links & Sub-tasks
  notes?: string;
  links: TaskLink[];
  subtasks: SubTask[];
  
  // Simultaneous execution tracking
  simultaneousWithIds?: string[];

  // Emergency Buffer Flag
  isEmergencyBuffer?: boolean;
  emergencyType?: EmergencyType;

  // Actual Execution Timing & Discrepancy Tracking (Early / Late start relative to scheduled)
  originalScheduledStartTime?: string;
  originalScheduledEndTime?: string;
  originalAppointedMinutes?: number;
  startDiscrepancyMinutes?: number; // < 0 = early, > 0 = late, 0 = on time
  actualStartTime?: string;
  actualEndTime?: string; // e.g. "02:45 PM" when finished early
  completedBeforeTimeOccurred?: boolean; // True if task was completed before scheduled window began
  savedFreeMinutes?: number; // Minutes of free time gained by early completion

  // Mandatory / Fixed Schedule Flag (Non-reschedulable, irreplaceable & protected from auto-shifts)
  isMandatorySchedule?: boolean;

  // Reschedule & Creation Analytics
  rescheduleCount?: number; // Total number of times this task was rescheduled
  lastRescheduledAt?: string; // ISO timestamp of the most recent reschedule
  originallyAddedAt?: string; // ISO timestamp when task was first added to system
  originalScheduledDate?: string; // Initial taskDate when first created

  // Plan / Project Folder Association
  planProjectId?: string;

  // Signal vs Noise classification
  signalNoise?: SignalNoiseType;
}

export type SignalNoiseType = 'signal' | 'noise';

export type PlanProjectType = 'plan' | 'project';
export type PlanProjectStatus = 'active' | 'completed' | 'on_hold' | 'archived';

export interface PlanProjectFolder {
  id: string;
  type: PlanProjectType;
  title: string;
  code: string; // e.g. "PLN-2026-01", "PRJ-VRTX"
  description: string;
  color: string;
  iconName: string;
  category: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (Strict Deadline)
  targetMinutes?: number; // Planned Time Budget (Minutes)
  status: PlanProjectStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export type EmergencyType = 
  | 'Loadshedding' 
  | 'Sickness' 
  | 'Family Emergency' 
  | 'Device / Net Outage' 
  | 'Urgent Crisis' 
  | 'Other Emergency';

export interface EmergencyBufferPlan {
  id: string;
  emergencyType: EmergencyType;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  notes: string;
  createdAt: string;
}

export interface EmergencyCategoryItem {
  id: string;
  name: string;
  emoji: string;
  defaultDuration: number;
  description?: string;
  color?: string;
  isSystem?: boolean;
}

export type TaskRescheduleAction = 'shift_same_day' | 'defer_tomorrow' | 'compress' | 'hold' | 'keep';

export interface TaskRescheduleProposal {
  taskId: string;
  taskTitle: string;
  projectCode: string;
  priority: PriorityLevel;
  currentDate: string;
  currentStartTime: string;
  currentEndTime: string;
  currentDurationMinutes: number;
  proposedDate: string;
  proposedStartTime: string;
  proposedEndTime: string;
  proposedDurationMinutes: number;
  action: TaskRescheduleAction;
  approved: boolean; // User permission checkbox
  delayMinutes?: number;
  isMandatory?: boolean;
  notes?: string;
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
  maxWorkHours: number; // Work Time Target (Hours) - Default: 14
  sleepHours: number; // Estimated Sleep Time (Hours) - Default: 7
  bufferHours: number; // Buffer / Leisure Total Budget (Hours) - Default: 3
  dayStartTime: string; // Work Starts From (e.g. "06:00 AM")
  dayEndTime: string; // Work Ends At (e.g. "11:00 PM")
  sleepStartTime?: string; // Estimated Bedtime (e.g. "11:00 PM")
  sleepEndTime?: string; // Estimated Wake-up (e.g. "06:00 AM")
  defaultBufferMinutes: number; // Automated Buffer Time between tasks (Default: 15 min)
  autoSleepScheduleEnabled?: boolean; // When true, 24-hour tracker auto-schedules sleep; when false, no automatic sleep blocks
  isManualMode?: boolean; // When true, capacity and shift windows are managed completely manually without auto-balance forced overrides
}

export interface NamedTimePeriod {
  id: string;
  name: string; // e.g. "EarlyMorning", "Morning", "Lunch Time zone", "After Lunch", "Evening", "Night", "deep night"
  startTime: string; // "05:00 AM"
  endTime: string; // "08:59 AM"
  emoji?: string;
  color?: string;
}

export interface TimePeriodSettings {
  isEnabled: boolean; // Customize enable toggle
  periods: NamedTimePeriod[];
}

export interface DefaultTaskSettings {
  defaultPriority: PriorityLevel; // Default 'P1'
  defaultCategory: string; // Default 'VRTX'
  defaultAppointedMinutes?: number; // Optional duration override
  defaultBufferMinutes: number; // Default buffer time (e.g. 15 min)
  defaultSmartSlot: 'auto-fit' | 'current-time' | 'work-start'; // Slot suggestion strategy
  defaultIsMandatory: boolean; // Mandatory locked schedule by default
  autoConfirmDefaults: boolean; // Fast-Add mode: automatically confirms defaults without blocking clicks
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
  projectCode?: string;
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
  projectCode?: string;
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
  | 'time-tracker'
  | 'all-tasks' 
  | 'plans-projects'
  | 'categories' 
  | 'analytics' 
  | 'notes' 
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

export type BufferActivityTag = string;

export interface BufferCategoryItem {
  id: string;
  tag: string;
  label: string;
  icon: string;
  desc: string;
  color?: string;
  bgColor?: string;
  isSystem?: boolean;
  defaultSignalNoise?: SignalNoiseType;
}

export interface BufferStatusNote {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "10:30 AM"
  endTime: string; // "10:45 AM"
  durationMinutes: number;
  activityTag: BufferActivityTag | string;
  notes: string; // "What did you do during this free time / buffer?"
  energyLevel?: number; // 1 to 5
  signalNoise?: SignalNoiseType;
  reflectionNotes?: string;
  relatedTaskId?: string;
  relatedTaskTitle?: string;
  createdAt: string; // ISO string
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
  | 'TASK_INSTANCE_EXCLUDED'
  | 'TASK_SERIES_DELETED'
  | 'TASK_SERIES_UPDATED'
  | 'PLAN_PROJECT_CREATED'
  | 'PLAN_PROJECT_UPDATED'
  | 'PLAN_PROJECT_DELETED'
  | 'EMERGENCY_BUFFER_TRIGGERED'
  | 'BUFFER_NOTE_LOGGED'
  | 'BUFFER_NOTE_DELETED'
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
    previousEndTime?: string;
    newEndTime?: string;
    previousDate?: string;
    newDate?: string;
    durationMinutes?: number;
    appointedMinutes?: number;
    delayMinutes?: number;
    extraMinutes?: number;
    isLate?: boolean;
    reason?: string;
    emergencyType?: string;
    proposalsCount?: number;
    bufferActivityTag?: string;
    bufferNotes?: string;
    scheduledStartTime?: string;
    originalScheduledStartTime?: string;
    actualStartTime?: string;
    scheduledEndTime?: string;
    lateStartMinutes?: number;
    earlyStartMinutes?: number;
    startDiscrepancyMinutes?: number;
    isLateStart?: boolean;
    signalNoiseType?: SignalNoiseType;
    [key: string]: any;
  };
}

export interface DaySlice24 {
  id: string;
  type: 'work_completed' | 'work_active' | 'work_pending' | 'work_hold' | 'task_buffer' | 'buffer_note' | 'sleep' | 'unaccounted_gap';
  title: string;
  startTime: string;
  endTime: string;
  startMinute: number; // 0 to 1439
  endMinute: number; // 1 to 1440
  durationMinutes: number;
  category?: string;
  priority?: PriorityLevel;
  task?: Task;
  bufferNote?: BufferStatusNote;
  color?: string;
  bgColor?: string;
  signalNoise: SignalNoiseType;
  isNoise: boolean;
  snReason?: string;
}

export interface DayBreakdown24Metrics {
  totalMinutes: 1440;
  workMinutes: number;
  completedWorkMinutes: number;
  sleepMinutes: number;
  bufferLoggedMinutes: number;
  scheduledBufferMinutes: number;
  unaccountedMinutes: number;
  accountabilityScore: number; // 0 - 100%
  // Signal vs Noise Metrics
  signalMinutes: number;
  noiseMinutes: number;
  signalRatio: number; // 0 - 100%
  snrMultiplier: number; // e.g. 4.5x
  noiseLeakMinutes: number;
}



