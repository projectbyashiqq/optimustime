import { 
  Task, 
  Category, 
  CapacitySettings, 
  PrioritySettings, 
  Reminder, 
  KnowledgeItem, 
  ThemeName, 
  BufferStatusNote, 
  BufferCategoryItem, 
  EmergencyCategoryItem, 
  PlanProjectFolder, 
  DefaultTaskSettings, 
  SecuritySettings, 
  CloudSyncConfig, 
  LifeEventLog 
} from '../types';

export interface FullBackupPayload {
  schemaVersion: '2.0.0';
  systemIdentifier: 'OPTIMUSTIME_COMPLETE_SYSTEM_BACKUP';
  backupType: 'FULL_SYSTEM_BACKUP';
  exportedAt: string;
  metadata: {
    app: 'OptimusTime';
    title: 'OptimusTime Unified Time-Boxing & Life Diary System Backup';
    user: string;
    totalRecords: number;
    counts: {
      tasks: number;
      bufferNotes: number;
      planProjects: number;
      categories: number;
      bufferCategories: number;
      emergencyCategories: number;
      knowledge: number;
      reminders: number;
      auditLogs: number;
    };
  };
  data: {
    tasks: Task[];
    bufferNotes: BufferStatusNote[];
    planProjects: PlanProjectFolder[];
    categories: Category[];
    bufferCategories: BufferCategoryItem[];
    emergencyCategories: EmergencyCategoryItem[];
    knowledge: KnowledgeItem[];
    reminders: Reminder[];
    auditLogs: LifeEventLog[];
  };
  settings: {
    capacitySettings: CapacitySettings;
    prioritySettings: PrioritySettings;
    defaultTaskSettings: DefaultTaskSettings;
    securitySettings: SecuritySettings;
    cloudSyncConfig: CloudSyncConfig;
    theme: ThemeName;
  };
}

export interface SettingsBackupPayload {
  schemaVersion: '2.0.0';
  systemIdentifier: 'OPTIMUSTIME_SETTINGS_BACKUP';
  backupType: 'SETTINGS_ONLY_BACKUP';
  exportedAt: string;
  metadata: {
    app: 'OptimusTime';
    title: 'OptimusTime System Configuration & Settings Backup';
    user: string;
    counts: {
      categories: number;
      bufferCategories: number;
      emergencyCategories: number;
    };
  };
  categories: Category[];
  bufferCategories: BufferCategoryItem[];
  emergencyCategories: EmergencyCategoryItem[];
  settings: {
    capacitySettings: CapacitySettings;
    prioritySettings: PrioritySettings;
    defaultTaskSettings: DefaultTaskSettings;
    securitySettings: SecuritySettings;
    cloudSyncConfig: CloudSyncConfig;
    theme: ThemeName;
  };
}

export interface BackupValidationResult {
  isValid: boolean;
  type: 'FULL_SYSTEM_BACKUP' | 'SETTINGS_ONLY_BACKUP' | 'LEGACY_V1' | 'INVALID';
  schemaVersion: string;
  exportedAt?: string;
  user?: string;
  summary: {
    tasksCount: number;
    bufferNotesCount: number;
    planProjectsCount: number;
    categoriesCount: number;
    bufferCategoriesCount: number;
    emergencyCategoriesCount: number;
    knowledgeCount: number;
    remindersCount: number;
    auditLogsCount: number;
    hasSettings: boolean;
    hasSecurity: boolean;
    hasCapacity: boolean;
    hasPriorities: boolean;
  };
  parsedData: any;
  error?: string;
}

const ROLLBACK_KEY = 'optimustime_pre_restore_snapshot';

/**
 * Creates a complete 100% full system backup including all tasks, journals, categories, and settings.
 */
export function createFullSystemBackup(contextState: {
  tasks: Task[];
  bufferNotes: BufferStatusNote[];
  planProjects: PlanProjectFolder[];
  categories: Category[];
  bufferCategories: BufferCategoryItem[];
  emergencyCategories: EmergencyCategoryItem[];
  knowledge: KnowledgeItem[];
  reminders: Reminder[];
  auditLogs: LifeEventLog[];
  capacitySettings: CapacitySettings;
  prioritySettings: PrioritySettings;
  defaultTaskSettings: DefaultTaskSettings;
  securitySettings: SecuritySettings;
  cloudSyncConfig: CloudSyncConfig;
  theme: ThemeName;
}): string {
  const counts = {
    tasks: contextState.tasks.length,
    bufferNotes: contextState.bufferNotes.length,
    planProjects: contextState.planProjects.length,
    categories: contextState.categories.length,
    bufferCategories: contextState.bufferCategories.length,
    emergencyCategories: contextState.emergencyCategories.length,
    knowledge: contextState.knowledge.length,
    reminders: contextState.reminders.length,
    auditLogs: contextState.auditLogs.length
  };

  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

  const payload: FullBackupPayload = {
    schemaVersion: '2.0.0',
    systemIdentifier: 'OPTIMUSTIME_COMPLETE_SYSTEM_BACKUP',
    backupType: 'FULL_SYSTEM_BACKUP',
    exportedAt: new Date().toISOString(),
    metadata: {
      app: 'OptimusTime',
      title: 'OptimusTime Unified Time-Boxing & Life Diary System Backup',
      user: contextState.securitySettings.username || 'Master Admin',
      totalRecords,
      counts
    },
    data: {
      tasks: contextState.tasks,
      bufferNotes: contextState.bufferNotes,
      planProjects: contextState.planProjects,
      categories: contextState.categories,
      bufferCategories: contextState.bufferCategories,
      emergencyCategories: contextState.emergencyCategories,
      knowledge: contextState.knowledge,
      reminders: contextState.reminders,
      auditLogs: contextState.auditLogs
    },
    settings: {
      capacitySettings: contextState.capacitySettings,
      prioritySettings: contextState.prioritySettings,
      defaultTaskSettings: contextState.defaultTaskSettings,
      securitySettings: contextState.securitySettings,
      cloudSyncConfig: contextState.cloudSyncConfig,
      theme: contextState.theme
    }
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Creates a configuration & settings only backup bundle.
 */
export function createSettingsOnlyBackup(contextState: {
  categories: Category[];
  bufferCategories: BufferCategoryItem[];
  emergencyCategories: EmergencyCategoryItem[];
  capacitySettings: CapacitySettings;
  prioritySettings: PrioritySettings;
  defaultTaskSettings: DefaultTaskSettings;
  securitySettings: SecuritySettings;
  cloudSyncConfig: CloudSyncConfig;
  theme: ThemeName;
}): string {
  const payload: SettingsBackupPayload = {
    schemaVersion: '2.0.0',
    systemIdentifier: 'OPTIMUSTIME_SETTINGS_BACKUP',
    backupType: 'SETTINGS_ONLY_BACKUP',
    exportedAt: new Date().toISOString(),
    metadata: {
      app: 'OptimusTime',
      title: 'OptimusTime System Configuration & Settings Backup',
      user: contextState.securitySettings.username || 'Master Admin',
      counts: {
        categories: contextState.categories.length,
        bufferCategories: contextState.bufferCategories.length,
        emergencyCategories: contextState.emergencyCategories.length
      }
    },
    categories: contextState.categories,
    bufferCategories: contextState.bufferCategories,
    emergencyCategories: contextState.emergencyCategories,
    settings: {
      capacitySettings: contextState.capacitySettings,
      prioritySettings: contextState.prioritySettings,
      defaultTaskSettings: contextState.defaultTaskSettings,
      securitySettings: contextState.securitySettings,
      cloudSyncConfig: contextState.cloudSyncConfig,
      theme: contextState.theme
    }
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Validates and inspects an incoming backup JSON before restoring.
 */
export function validateBackupBundle(jsonString: string): BackupValidationResult {
  try {
    const raw = JSON.parse(jsonString);

    // Case 1: OptimusTime V2.0 Full System Backup
    if (raw.systemIdentifier === 'OPTIMUSTIME_COMPLETE_SYSTEM_BACKUP' && raw.data) {
      return {
        isValid: true,
        type: 'FULL_SYSTEM_BACKUP',
        schemaVersion: raw.schemaVersion || '2.0.0',
        exportedAt: raw.exportedAt,
        user: raw.metadata?.user,
        summary: {
          tasksCount: raw.data.tasks?.length || 0,
          bufferNotesCount: raw.data.bufferNotes?.length || 0,
          planProjectsCount: raw.data.planProjects?.length || 0,
          categoriesCount: raw.data.categories?.length || 0,
          bufferCategoriesCount: raw.data.bufferCategories?.length || 0,
          emergencyCategoriesCount: raw.data.emergencyCategories?.length || 0,
          knowledgeCount: raw.data.knowledge?.length || 0,
          remindersCount: raw.data.reminders?.length || 0,
          auditLogsCount: raw.data.auditLogs?.length || 0,
          hasSettings: Boolean(raw.settings),
          hasSecurity: Boolean(raw.settings?.securitySettings),
          hasCapacity: Boolean(raw.settings?.capacitySettings),
          hasPriorities: Boolean(raw.settings?.prioritySettings)
        },
        parsedData: raw
      };
    }

    // Case 2: OptimusTime V2.0 Settings Only Backup
    if (raw.systemIdentifier === 'OPTIMUSTIME_SETTINGS_BACKUP' && raw.settings) {
      return {
        isValid: true,
        type: 'SETTINGS_ONLY_BACKUP',
        schemaVersion: raw.schemaVersion || '2.0.0',
        exportedAt: raw.exportedAt,
        user: raw.metadata?.user,
        summary: {
          tasksCount: 0,
          bufferNotesCount: 0,
          planProjectsCount: 0,
          categoriesCount: raw.categories?.length || 0,
          bufferCategoriesCount: raw.bufferCategories?.length || 0,
          emergencyCategoriesCount: raw.emergencyCategories?.length || 0,
          knowledgeCount: 0,
          remindersCount: 0,
          auditLogsCount: 0,
          hasSettings: true,
          hasSecurity: Boolean(raw.settings?.securitySettings),
          hasCapacity: Boolean(raw.settings?.capacitySettings),
          hasPriorities: Boolean(raw.settings?.prioritySettings)
        },
        parsedData: raw
      };
    }

    // Case 3: Legacy V1 Backup (flat bundle)
    if (raw.tasks || raw.categories || raw.capacitySettings) {
      return {
        isValid: true,
        type: 'LEGACY_V1',
        schemaVersion: raw.version || '1.0.0',
        exportedAt: raw.exportedAt,
        summary: {
          tasksCount: raw.tasks?.length || 0,
          bufferNotesCount: raw.bufferNotes?.length || 0,
          planProjectsCount: raw.planProjects?.length || 0,
          categoriesCount: raw.categories?.length || 0,
          bufferCategoriesCount: raw.bufferCategories?.length || 0,
          emergencyCategoriesCount: raw.emergencyCategories?.length || 0,
          knowledgeCount: raw.knowledge?.length || 0,
          remindersCount: raw.reminders?.length || 0,
          auditLogsCount: raw.auditLogs?.length || 0,
          hasSettings: Boolean(raw.capacitySettings || raw.prioritySettings),
          hasSecurity: Boolean(raw.securitySettings),
          hasCapacity: Boolean(raw.capacitySettings),
          hasPriorities: Boolean(raw.prioritySettings)
        },
        parsedData: raw
      };
    }

    return {
      isValid: false,
      type: 'INVALID',
      schemaVersion: 'Unknown',
      summary: {
        tasksCount: 0,
        bufferNotesCount: 0,
        planProjectsCount: 0,
        categoriesCount: 0,
        bufferCategoriesCount: 0,
        emergencyCategoriesCount: 0,
        knowledgeCount: 0,
        remindersCount: 0,
        auditLogsCount: 0,
        hasSettings: false,
        hasSecurity: false,
        hasCapacity: false,
        hasPriorities: false
      },
      parsedData: null,
      error: 'Unrecognized JSON format. File does not contain valid OptimusTime backup structures.'
    };
  } catch (e: any) {
    return {
      isValid: false,
      type: 'INVALID',
      schemaVersion: 'Unknown',
      summary: {
        tasksCount: 0,
        bufferNotesCount: 0,
        planProjectsCount: 0,
        categoriesCount: 0,
        bufferCategoriesCount: 0,
        emergencyCategoriesCount: 0,
        knowledgeCount: 0,
        remindersCount: 0,
        auditLogsCount: 0,
        hasSettings: false,
        hasSecurity: false,
        hasCapacity: false,
        hasPriorities: false
      },
      parsedData: null,
      error: `Malformed JSON: ${e.message || 'Syntax error'}`
    };
  }
}

/**
 * Downloads a backup payload as a JSON file.
 */
export function triggerBackupDownload(jsonString: string, filename: string): void {
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Saves a pre-restore rollback snapshot in localStorage so the user can easily undo any mistake.
 */
export function saveRollbackSnapshot(currentBackupJson: string): void {
  try {
    const snapshot = {
      savedAt: new Date().toISOString(),
      backupJson: currentBackupJson
    };
    localStorage.setItem(ROLLBACK_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('Failed to save rollback snapshot', e);
  }
}

/**
 * Retrieves the latest rollback snapshot if available.
 */
export function getRollbackSnapshot(): { savedAt: string; backupJson: string } | null {
  try {
    const raw = localStorage.getItem(ROLLBACK_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Clears the rollback snapshot.
 */
export function clearRollbackSnapshot(): void {
  try {
    localStorage.removeItem(ROLLBACK_KEY);
  } catch (e) {
    // ignore
  }
}
