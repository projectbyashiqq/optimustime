import { 
  Category, 
  PrioritySettings, 
  CapacitySettings, 
  Task, 
  KnowledgeItem, 
  Reminder, 
  SecuritySettings, 
  CloudSyncConfig, 
  BufferStatusNote, 
  BufferCategoryItem,
  PlanProjectFolder,
  DefaultTaskSettings,
  NamedTimePeriod,
  TimePeriodSettings
} from '../types';

export const DEFAULT_NAMED_TIME_PERIODS: NamedTimePeriod[] = [
  {
    id: 'period-1',
    name: 'EarlyMorning',
    startTime: '05:00 AM',
    endTime: '08:59 AM',
    emoji: '🌅',
    color: '#f59e0b'
  },
  {
    id: 'period-2',
    name: 'Morning',
    startTime: '09:00 AM',
    endTime: '11:59 AM',
    emoji: '☀️',
    color: '#3b82f6'
  },
  {
    id: 'period-3',
    name: 'Lunch Time zone',
    startTime: '12:00 PM',
    endTime: '03:30 PM',
    emoji: '🍲',
    color: '#10b981'
  },
  {
    id: 'period-4',
    name: 'After Lunch',
    startTime: '03:31 PM',
    endTime: '05:29 PM',
    emoji: '☕',
    color: '#8b5cf6'
  },
  {
    id: 'period-5',
    name: 'Evening',
    startTime: '05:30 PM',
    endTime: '07:59 PM',
    emoji: '🌇',
    color: '#ec4899'
  },
  {
    id: 'period-6',
    name: 'Night',
    startTime: '08:00 PM',
    endTime: '02:00 AM',
    emoji: '🌙',
    color: '#6366f1'
  },
  {
    id: 'period-7',
    name: 'deep night',
    startTime: '02:01 AM',
    endTime: '04:59 AM',
    emoji: '🌌',
    color: '#475569'
  }
];

export const DEFAULT_TIME_PERIOD_SETTINGS: TimePeriodSettings = {
  isEnabled: true,
  periods: DEFAULT_NAMED_TIME_PERIODS
};


const envSupabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
const envSupabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

export const DEFAULT_CLOUD_SYNC: CloudSyncConfig = {
  isEnabled: Boolean(envSupabaseUrl && envSupabaseAnonKey),
  supabaseUrl: envSupabaseUrl,
  supabaseAnonKey: envSupabaseAnonKey,
  tableName: 'optimustime_sync',
  autoRealtimeSync: true
};

export const DEFAULT_SECURITY: SecuritySettings = {
  isPasswordProtected: true,
  masterPassword: 'admin', // Default master password
  autoLockMinutes: 30,
  username: 'Master Admin'
};

export const DEFAULT_CAPACITY: CapacitySettings = {
  maxWorkHours: 14,
  sleepHours: 7,
  bufferHours: 3,
  dayStartTime: '06:00 AM',
  dayEndTime: '11:00 PM',
  sleepStartTime: '11:00 PM',
  sleepEndTime: '06:00 AM',
  defaultBufferMinutes: 15,
  autoSleepScheduleEnabled: false
};

export const DEFAULT_TASK_PRESETS: DefaultTaskSettings = {
  defaultPriority: 'P1',
  defaultCategory: 'VRTX',
  defaultBufferMinutes: 15,
  defaultSmartSlot: 'auto-fit',
  defaultIsMandatory: false,
  autoConfirmDefaults: true
};

export const DEFAULT_PRIORITIES: PrioritySettings = {
  P1: {
    label: 'Must Do',
    defaultMinutes: 90,
    description: 'High stakes, mission-critical tasks for the day',
    color: '#EF4444',
    bgColor: '#FEE2E2'
  },
  P2: {
    label: 'High ROI',
    defaultMinutes: 60,
    description: 'High return on investment, core development & value creation',
    color: '#F97316',
    bgColor: '#FFEDD5'
  },
  P3: {
    label: 'Delegatable',
    defaultMinutes: 45,
    description: 'Operational, administrative or delegatable workflows',
    color: '#3B82F6',
    bgColor: '#DBEAFE'
  },
  P4: {
    label: 'Optional',
    defaultMinutes: 30,
    description: 'Bonus items to tackle if energy and time permit',
    color: '#8B5CF6',
    bgColor: '#EDE9FE'
  },
  P5: {
    label: 'Noise / Filter',
    defaultMinutes: 0,
    description: 'Low-value items, filter out from primary focus',
    color: '#6B7280',
    bgColor: '#F3F4F6'
  }
};

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat-vrtx',
    name: 'VRTX',
    color: '#3B82F6',
    iconName: 'Zap',
    subCategories: ['Core Engine', 'Infrastructure', 'API Design'],
    isSystem: false
  },
  {
    id: 'cat-personal',
    name: 'Personal',
    color: '#10B981',
    iconName: 'User',
    subCategories: ['Health & Fitness', 'Family', 'Self Development'],
    isSystem: false
  },
  {
    id: 'cat-optimuslab',
    name: 'OptimusLAB',
    color: '#8B5CF6',
    iconName: 'Cpu',
    subCategories: ['R&D', 'Experimental Tech', 'Automation'],
    isSystem: false
  },
  {
    id: 'cat-ashiqq',
    name: 'Ashiqq Online',
    color: '#F59E0B',
    iconName: 'Globe',
    subCategories: ['Content Strategy', 'Media Production', 'Community'],
    isSystem: false
  },
  {
    id: 'cat-mybiz',
    name: 'My Business',
    color: '#EC4899',
    iconName: 'Briefcase',
    subCategories: ['Finance', 'Client Relations', 'Strategy'],
    isSystem: false
  },
  {
    id: 'cat-research',
    name: 'Research',
    color: '#06B6D4',
    iconName: 'BookOpen',
    subCategories: ['AI Models', 'System Architecture', 'Market Insights'],
    isSystem: false
  },
  {
    id: 'cat-reminder',
    name: 'Reminder',
    color: '#EAB308',
    iconName: 'Bell',
    subCategories: ['Bills & Deadlines', 'Appointments', 'Follow-ups'],
    isSystem: true
  },
  {
    id: 'cat-note',
    name: 'Notes',
    color: '#64748B',
    iconName: 'FileText',
    subCategories: ['Quick Thoughts', 'Architectural Specs', 'Logs'],
    isSystem: true
  }
];



export const INITIAL_TASKS: Task[] = [];
export const INITIAL_KNOWLEDGE: KnowledgeItem[] = [];
export const INITIAL_REMINDERS: Reminder[] = [];
export const INITIAL_BUFFER_NOTES: BufferStatusNote[] = [];

export const INITIAL_BUFFER_CATEGORIES: BufferCategoryItem[] = [
  { id: 'bcat-1', tag: 'Coffee / Tea', label: 'Coffee / Tea', icon: '☕', desc: 'Hydration, espresso, tea ritual', color: '#D97706', bgColor: '#FEF3C7', isSystem: true },
  { id: 'bcat-2', tag: 'Walk / Exercise', label: 'Walk / Exercise', icon: '🚶', desc: 'Outdoor walk, stretching, workout', color: '#059669', bgColor: '#D1FAE5', isSystem: true },
  { id: 'bcat-3', tag: 'Meal / Snack', label: 'Meal / Snack', icon: '🥪', desc: 'Breakfast, lunch, dinner, nutrition', color: '#D97706', bgColor: '#FEF3C7', isSystem: true },
  { id: 'bcat-4', tag: 'Break / Rest', label: 'Break / Rest', icon: '🧘', desc: 'Eye rest, breathing, mental reset', color: '#7C3AED', bgColor: '#EDE9FE', isSystem: true },
  { id: 'bcat-5', tag: 'Reading / Learning', label: 'Reading / Learning', icon: '📚', desc: 'Articles, books, research, news', color: '#2563EB', bgColor: '#DBEAFE', isSystem: true },
  { id: 'bcat-6', tag: 'Power Nap', label: 'Power Nap', icon: '💤', desc: '15-25 min restorative sleep', color: '#7C3AED', bgColor: '#EDE9FE', isSystem: true },
  { id: 'bcat-7', tag: 'Meditation', label: 'Meditation', icon: '✨', desc: 'Mindfulness, reflection, breathing', color: '#7C3AED', bgColor: '#EDE9FE', isSystem: true },
  { id: 'bcat-8', tag: 'Quick Chores', label: 'Quick Chores', icon: '🧹', desc: 'Desk tidy, quick errands, tasks', color: '#4B5563', bgColor: '#F3F4F6', isSystem: true },
  { id: 'bcat-9', tag: 'Social / Chat', label: 'Social / Chat', icon: '💬', desc: 'Call, team chat, family connection', color: '#DB2777', bgColor: '#FCE7F3', isSystem: true },
  { id: 'bcat-10', tag: 'Planning', label: 'Planning', icon: '🎯', desc: 'Next task prep, roadmap reflection', color: '#0891B2', bgColor: '#CFFAFE', isSystem: true },
  { id: 'bcat-11', tag: 'Entertainment', label: 'Entertainment', icon: '🎮', desc: 'Music, light gaming, casual media', color: '#8B5CF6', bgColor: '#EDE9FE', isSystem: true },
  { id: 'bcat-12', tag: 'Other Activity', label: 'Other Activity', icon: '📝', desc: 'Custom free-time log', color: '#D97706', bgColor: '#FEF3C7', isSystem: true },
];

export const INITIAL_EMERGENCY_CATEGORIES: import('../types').EmergencyCategoryItem[] = [
  { id: 'ecat-1', name: 'Loadshedding / Power Outage', emoji: '⚡', defaultDuration: 120, description: 'Power grid cut or inverter failure', color: '#D97706', isSystem: true },
  { id: 'ecat-2', name: 'Medical Sickness / Health', emoji: '🩺', defaultDuration: 180, description: 'Sudden illness, headache, medical clinic', color: '#E11D48', isSystem: true },
  { id: 'ecat-3', name: 'Family Emergency / Crisis', emoji: '🚨', defaultDuration: 120, description: 'Urgent family situation or call', color: '#DC2626', isSystem: true },
  { id: 'ecat-4', name: 'Device / Internet Failure', emoji: '🌐', defaultDuration: 60, description: 'Broadband outage or laptop crash', color: '#EA580C', isSystem: true },
  { id: 'ecat-5', name: 'Traffic / Transit Jam', emoji: '🚗', defaultDuration: 60, description: 'Unplanned transit delay or gridlock', color: '#2563EB', isSystem: false },
  { id: 'ecat-6', name: 'Urgent Crisis / Other', emoji: '⚠️', defaultDuration: 90, description: 'Other uncontrollable life disruption', color: '#7C3AED', isSystem: true },
];

export const INITIAL_PLAN_PROJECTS: PlanProjectFolder[] = [];


