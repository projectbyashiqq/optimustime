import { Category, PrioritySettings, CapacitySettings, Task, KnowledgeItem, Reminder, SecuritySettings, CloudSyncConfig } from '../types';
import { toISODateString, getDayOfWeekFromDate } from '../utils/timeUtils';

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
  sleepHours: 6,
  bufferHours: 2,
  dayStartTime: '06:00 AM',
  dayEndTime: '11:00 PM'
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
    isSystem: true
  },
  {
    id: 'cat-personal',
    name: 'Personal',
    color: '#10B981',
    iconName: 'User',
    subCategories: ['Health & Fitness', 'Family', 'Self Development'],
    isSystem: true
  },
  {
    id: 'cat-optimuslab',
    name: 'OptimusLAB',
    color: '#8B5CF6',
    iconName: 'Cpu',
    subCategories: ['R&D', 'Experimental Tech', 'Automation'],
    isSystem: true
  },
  {
    id: 'cat-ashiqq',
    name: 'Ashiqq Online',
    color: '#F59E0B',
    iconName: 'Globe',
    subCategories: ['Content Strategy', 'Media Production', 'Community'],
    isSystem: true
  },
  {
    id: 'cat-mybiz',
    name: 'My Business',
    color: '#EC4899',
    iconName: 'Briefcase',
    subCategories: ['Finance', 'Client Relations', 'Strategy'],
    isSystem: true
  },
  {
    id: 'cat-research',
    name: 'Research',
    color: '#06B6D4',
    iconName: 'BookOpen',
    subCategories: ['AI Models', 'System Architecture', 'Market Insights'],
    isSystem: true
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
    name: 'Note',
    color: '#64748B',
    iconName: 'FileText',
    subCategories: ['Quick Thoughts', 'Architectural Specs', 'Logs'],
    isSystem: true
  }
];

const todayDate = toISODateString(new Date());
const dayName = getDayOfWeekFromDate(todayDate);

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-101',
    projectCode: 'OPT-2609-8421',
    title: 'OptimusLAB Architecture & Unified Data Model Audit',
    description: 'Perform complete code audit of the unified time-boxing state machine and buffer calculation logic.',
    dateAdded: new Date().toISOString(),
    taskDate: todayDate,
    dayOfWeek: dayName,
    priority: 'P1',
    category: 'OptimusLAB',
    subCategory: 'Automation',
    appointedMinutes: 90,
    startTime: '08:30 AM',
    endTime: '10:00 AM',
    status: 'Done',
    bufferMinutes: 15,
    recurrence: 'Daily',
    executionLogs: [
      {
        startedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        completedAt: new Date(Date.now() - 3600000 * 3.5).toISOString(),
        actualDurationMinutes: 88,
        isLateFinish: false,
        notes: 'Successfully audited buffer math and project escalation hooks.'
      }
    ],
    totalActualMinutes: 88,
    notes: 'Key findings: All Red-line indicators must dynamically track total scheduled minutes against 14-hour daily budget.',
    links: [
      { id: 'lnk-1', title: 'System Spec Doc', url: 'https://optimustime.local/docs/architecture', type: 'doc' }
    ],
    subtasks: [
      { id: 'sub-1', title: 'Verify P1-P5 duration mapping', isCompleted: true, depthLevel: 1 },
      { id: 'sub-2', title: 'Test buffer reduction from 15m to 5m on late finish', isCompleted: true, depthLevel: 1 },
      { id: 'sub-3', title: 'Audit overlap alert prompt flow', isCompleted: true, depthLevel: 1 }
    ]
  },
  {
    id: 'task-102',
    projectCode: 'OPT-2609-9130',
    title: 'VRTX Real-time Cascading Auto-Shift Engine Development',
    description: 'Implement cascading recalculation for downstream tasks when a task is delayed or prolonged.',
    dateAdded: new Date().toISOString(),
    taskDate: todayDate,
    dayOfWeek: dayName,
    priority: 'P1',
    category: 'VRTX',
    subCategory: 'Core Engine',
    appointedMinutes: 90,
    startTime: '10:15 AM',
    endTime: '11:45 AM',
    status: 'Working',
    bufferMinutes: 15,
    recurrence: 'None',
    executionLogs: [
      {
        startedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        actualDurationMinutes: 25,
        isLateFinish: false
      }
    ],
    totalActualMinutes: 25,
    notes: 'Engine automatically calculates time push and offers to move P4/P5 tasks to next day if day capacity exceeds 14 hours.',
    links: [
      { id: 'lnk-2', title: 'VRTX Core Repository', url: 'https://github.com/optimus/vrtx-core', type: 'github' }
    ],
    subtasks: [
      { id: 'sub-4', title: 'Write cascading displacement algorithm', isCompleted: true, depthLevel: 1 },
      { id: 'sub-5', title: 'Add Red-Line capacity threshold check', isCompleted: true, depthLevel: 1 },
      { id: 'sub-6', title: 'Connect audio notification bell for timer finish', isCompleted: false, depthLevel: 1 }
    ],
    isProject: true,
    escalationReason: 'Escalated to Project: Contains multi-level submodules and high complexity.'
  },
  {
    id: 'task-103',
    projectCode: 'OPT-2609-5480',
    title: 'Ashiqq Online Media Content Calendar & Release Pipeline',
    description: 'Draft weekly social media release matrix and script breakdowns for YouTube & LinkedIn.',
    dateAdded: new Date().toISOString(),
    taskDate: todayDate,
    dayOfWeek: dayName,
    priority: 'P2',
    category: 'Ashiqq Online',
    subCategory: 'Content Strategy',
    appointedMinutes: 60,
    startTime: '12:00 PM',
    endTime: '01:00 PM',
    status: 'Pending',
    bufferMinutes: 15,
    recurrence: 'Weekly',
    executionLogs: [],
    totalActualMinutes: 0,
    links: [
      { id: 'lnk-3', title: 'Media Master Sheet', url: 'https://docs.google.com/spreadsheets/d/ashiqq-online', type: 'doc' }
    ],
    subtasks: [
      { id: 'sub-7', title: 'Write episode 4 outline', isCompleted: false, depthLevel: 1 },
      { id: 'sub-8', title: 'Generate thumbnail graphic assets', isCompleted: false, depthLevel: 1 }
    ]
  },
  {
    id: 'task-104',
    projectCode: 'OPT-2609-3712',
    title: 'My Business - Q3 Financial Reconciliation & Client Invoicing',
    description: 'Review pending invoices, client SLA deliverables, and generate revenue breakdown.',
    dateAdded: new Date().toISOString(),
    taskDate: todayDate,
    dayOfWeek: dayName,
    priority: 'P2',
    category: 'My Business',
    subCategory: 'Finance',
    appointedMinutes: 60,
    startTime: '02:00 PM',
    endTime: '03:00 PM',
    status: 'Pending',
    bufferMinutes: 15,
    recurrence: 'Monthly',
    executionLogs: [],
    totalActualMinutes: 0,
    links: [],
    subtasks: [
      { id: 'sub-9', title: 'Audit invoice ledger', isCompleted: false, depthLevel: 1 },
      { id: 'sub-10', title: 'Send monthly client progress reports', isCompleted: false, depthLevel: 1 }
    ]
  },
  {
    id: 'task-105',
    projectCode: 'OPT-2609-2189',
    title: 'Research: Autonomous Agent Tool Use & Self-Reflection Benchmarks',
    description: 'Study latest research papers on cognitive architectures and benchmark token latency.',
    dateAdded: new Date().toISOString(),
    taskDate: todayDate,
    dayOfWeek: dayName,
    priority: 'P3',
    category: 'Research',
    subCategory: 'AI Models',
    appointedMinutes: 45,
    startTime: '03:30 PM',
    endTime: '04:15 PM',
    status: 'Pending',
    bufferMinutes: 15,
    recurrence: 'Selected Days',
    selectedDays: ['Mon', 'Wed', 'Fri'],
    executionLogs: [],
    totalActualMinutes: 0,
    links: [
      { id: 'lnk-4', title: 'Arxiv Paper #2026.0841', url: 'https://arxiv.org/abs/2608.0841', type: 'url' }
    ],
    subtasks: []
  },
  {
    id: 'task-106',
    projectCode: 'OPT-2609-1145',
    title: 'Personal Health & Evening High-Intensity Session',
    description: '45-minute structured cardio and strength endurance workout.',
    dateAdded: new Date().toISOString(),
    taskDate: todayDate,
    dayOfWeek: dayName,
    priority: 'P3',
    category: 'Personal',
    subCategory: 'Health & Fitness',
    appointedMinutes: 45,
    startTime: '05:00 PM',
    endTime: '05:45 PM',
    status: 'Pending',
    bufferMinutes: 15,
    recurrence: 'Daily',
    executionLogs: [],
    totalActualMinutes: 0,
    links: [],
    subtasks: []
  },
  {
    id: 'task-107',
    projectCode: 'OPT-2609-0419',
    title: 'Filter Inbox & Clean Project Workspace Cache',
    description: 'Zero inbox sweep and archive temporary artifacts.',
    dateAdded: new Date().toISOString(),
    taskDate: todayDate,
    dayOfWeek: dayName,
    priority: 'P5',
    category: 'Note',
    subCategory: 'Logs',
    appointedMinutes: 15,
    startTime: '06:15 PM',
    endTime: '06:30 PM',
    status: 'Pending',
    bufferMinutes: 5,
    recurrence: 'None',
    executionLogs: [],
    totalActualMinutes: 0,
    links: [],
    subtasks: []
  }
];

export const INITIAL_KNOWLEDGE: KnowledgeItem[] = [
  {
    id: 'kno-1',
    title: 'Time-Boxing & Scientific Capacity Red-Line Matrix',
    category: 'OptimusLAB',
    content: `# Time-Boxing Principles

1. **P1 (Must Do):** 90 Min uninterrupted deep work block.
2. **P2 (High ROI):** 60 Min core high-output delivery.
3. **P3 (Delegatable):** 45 Min structured execution.
4. **P4 (Optional):** 30 Min buffer opportunity.
5. **P5 (Noise Filter):** Minimal low-value items.

## Daily Red-Line Capacity Rule:
- 14h Work Budget Max
- 6h Sleep Minimum
- 2h Buffer/Leisure

Exceeding 14 scheduled hours triggers an immediate Red Alert in the dashboard.`,
    tags: ['Time-Boxing', 'Capacity', 'Productivity', 'P1-P5'],
    links: ['https://optimustime.local/docs/time-boxing'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'kno-2',
    title: 'VRTX Automation & Cascading Displacement Protocol',
    category: 'VRTX',
    content: `# Cascading Auto-Shift Strategy

When a task exceeds its appointed duration or is manually postponed:
1. Identify downstream tasks for the current day.
2. Calculate delta shift = (Actual Duration - Appointed Duration) + Buffer (5m if late, 15m if normal).
3. If new schedule overflows daily capacity cutoff, prompt to auto-shift P4/P5 tasks to Tomorrow's schedule.`,
    tags: ['VRTX', 'Automation', 'Algorithms', 'Reschedule'],
    links: ['https://github.com/optimus/vrtx-core'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const INITIAL_REMINDERS: Reminder[] = [
  {
    id: 'rem-1',
    taskId: 'task-102',
    title: 'VRTX Auto-Shift Engine Mid-way Review',
    date: todayDate,
    time: '11:00 AM',
    urgency: 'Critical',
    notes: 'Verify state machine transition from Working to Done.',
    isTriggered: false,
    isDismissed: false
  },
  {
    id: 'rem-2',
    taskId: 'task-104',
    title: 'Send Monthly Invoice to Enterprise Partner',
    date: todayDate,
    time: '02:30 PM',
    urgency: 'High',
    notes: 'Include payment link and breakdown report.',
    isTriggered: false,
    isDismissed: false
  }
];
