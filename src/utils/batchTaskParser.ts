import * as XLSX from 'xlsx';
import { PriorityLevel, TaskStatus, RecurrenceType, PlanProjectFolder } from '../types';
import { 
  addMinutesToTime, 
  formatMinutesTo12Hour, 
  parse12HourToMinutes, 
  toISODateString 
} from './timeUtils';

export function addDaysToDate(dateStr: string, days: number): string {
  if (!dateStr || days === 0) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + days);
    return toISODateString(d);
  }
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toISODateString(d);
}

export interface BatchDefaults {
  taskDate: string;
  dateMode?: 'same' | 'spread';
  tasksPerDay?: number;
  priority: PriorityLevel;
  category: string;
  appointedMinutes: number;
  timeMode: 'sequence' | 'anytime' | 'fixed';
  sequenceStartTime: string; // e.g. "09:00 AM"
  status: TaskStatus;
  planProjectId?: string;
  planProjects?: PlanProjectFolder[];
}

export interface BatchTaskItem {
  id?: string;
  title: string;
  description: string;
  notes?: string;
  priority: PriorityLevel;
  taskDate: string;
  startTime: string;
  endTime: string;
  appointedMinutes: number;
  category: string;
  subCategory?: string;
  status: TaskStatus;
  hasNoTime: boolean;
  recurrence?: RecurrenceType;
  planProjectId?: string;
  selectedDays?: string[];
}

/**
 * Normalizes priority text (e.g. "p1", "P1 - Critical", "Priority 2", "High") into PriorityLevel
 */
export function normalizePriority(raw: any, fallback: PriorityLevel = 'P3'): PriorityLevel {
  if (!raw) return fallback;
  const s = String(raw).trim().toUpperCase();
  if (s.startsWith('P1') || s.includes('CRITICAL') || s.includes('URGENT') || s === '1') return 'P1';
  if (s.startsWith('P2') || s.includes('HIGH') || s === '2') return 'P2';
  if (s.startsWith('P3') || s.includes('MEDIUM') || s === '3') return 'P3';
  if (s.startsWith('P4') || s.includes('LOW') || s === '4') return 'P4';
  if (s.startsWith('P5') || s.includes('NOISE') || s.includes('TRIVIAL') || s === '5') return 'P5';
  return fallback;
}

/**
 * Normalizes status text into TaskStatus
 */
export function normalizeStatus(raw: any, fallback: TaskStatus = 'Pending'): TaskStatus {
  if (!raw) return fallback;
  const s = String(raw).trim().toLowerCase();
  if (s === 'done' || s === 'completed') return 'Done';
  if (s === 'working' || s === 'in progress' || s === 'active') return 'Working';
  if (s === 'hold' || s === 'paused' || s === 'on hold') return 'Hold';
  if (s === 'reschedule' || s === 'rescheduled') return 'Reschedule';
  if (s === 'terminated' || s === 'cancelled' || s === 'canceled') return 'Terminated';
  if (s === 'incomplete') return 'Incomplete';
  return 'Pending';
}

/**
 * Converts Excel serial numbers or standard date strings into YYYY-MM-DD
 */
export function normalizeDate(raw: any, fallbackDate: string): string {
  if (!raw) return fallbackDate;
  if (typeof raw === 'number') {
    // Excel date serial number
    const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return toISODateString(date);
    }
  }
  const s = String(raw).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  const parts = s.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-M-D
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    if (parts[2].length === 4) {
      // DD-MM-YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return toISODateString(parsed);
  }
  return fallbackDate;
}

/**
 * Normalizes time format (e.g. "9:00", "09:00 AM", "14:30", "Anytime")
 */
export function normalizeTime(raw: any, fallbackTime: string): string {
  if (!raw) return fallbackTime;
  if (typeof raw === 'number') {
    // Excel time fraction (e.g. 0.375 = 9:00 AM)
    const totalMinutes = Math.round(raw * 24 * 60);
    return formatMinutesTo12Hour(totalMinutes);
  }
  const s = String(raw).trim();
  if (s.toLowerCase() === 'anytime' || s.toLowerCase() === 'free time' || s.toLowerCase() === 'no time') {
    return 'Anytime';
  }
  const mins = parse12HourToMinutes(s);
  return formatMinutesTo12Hour(mins);
}

/**
 * Parses minutes / duration from raw input (e.g. 60, "30m", "1.5h", "90 min")
 */
export function normalizeMinutes(raw: any, fallback: number = 60): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (typeof raw === 'number') return Math.max(5, Math.round(raw));
  const s = String(raw).trim().toLowerCase();
  
  // "1.5h", "2h", "2 hours"
  const hourMatch = s.match(/^([\d.]+)\s*(h|hr|hour|hours)$/);
  if (hourMatch) {
    const val = parseFloat(hourMatch[1]);
    if (!isNaN(val)) return Math.max(5, Math.round(val * 60));
  }
  
  // "45m", "45min", "45 minutes"
  const minMatch = s.match(/^(\d+)\s*(m|min|mins|minutes)?$/);
  if (minMatch) {
    const val = parseInt(minMatch[1], 10);
    if (!isNaN(val)) return Math.max(5, val);
  }
  
  const num = parseInt(s, 10);
  return isNaN(num) || num <= 0 ? fallback : num;
}

/**
 * Clean markdown bullet point marks from start of line
 */
function cleanBullet(line: string): string {
  return line
    .replace(/^(\s*[-*•]\s*(\[[ xX]?\])?\s*)/, '') // remove -, *, •, [ ], [x]
    .replace(/^\s*\d+[\.\)]\s*/, '') // remove 1., 2), etc.
    .trim();
}

/**
 * Parses multi-line pasted text into an array of BatchTaskItems.
 * Supports:
 * - Simple line-by-line task titles
 * - Delimited lines: Title | Priority | AppointedMinutes | Category | Date | StartTime | PlanOrProject | Description
 */
export function parseMultiLineText(rawText: string, defaults: BatchDefaults): BatchTaskItem[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  let currentSequenceMinutes = parse12HourToMinutes(defaults.sequenceStartTime || '09:00 AM');
  let lastCalculatedDate = defaults.taskDate;

  return lines.map((line, index) => {
    // Determine if line is delimited by | or tab
    const isPipeDelimited = line.includes('|');
    const isTabDelimited = line.includes('\t');
    
    let title = '';
    let priority = defaults.priority;
    let appointedMinutes = defaults.appointedMinutes;
    let category = defaults.category;
    let taskDate = defaults.taskDate;

    if (defaults.dateMode === 'spread') {
      const dayOffset = Math.floor(index / Math.max(1, defaults.tasksPerDay || 1));
      taskDate = addDaysToDate(defaults.taskDate, dayOffset);
    }

    let customStartTime: string | null = null;
    let description = '';
    let planProjectId = defaults.planProjectId;

    if (isPipeDelimited || isTabDelimited) {
      const parts = (isPipeDelimited ? line.split('|') : line.split('\t')).map(p => p.trim());
      title = cleanBullet(parts[0] || '');
      
      if (parts[1]) priority = normalizePriority(parts[1], defaults.priority);
      if (parts[2]) appointedMinutes = normalizeMinutes(parts[2], defaults.appointedMinutes);
      if (parts[3]) category = parts[3] || defaults.category;
      if (parts[4]) taskDate = normalizeDate(parts[4], taskDate);
      if (parts[5]) customStartTime = parts[5];
      
      // Check if parts[6] matches a Plan/Project code or title
      if (parts[6]) {
        const pTerm = parts[6].toLowerCase();
        const matchedPlan = defaults.planProjects?.find(p => 
          p.code.toLowerCase() === pTerm ||
          p.title.toLowerCase() === pTerm ||
          p.id === parts[6]
        );
        if (matchedPlan) {
          planProjectId = matchedPlan.id;
          if (!parts[3]) category = matchedPlan.category;
          if (parts[7]) description = parts.slice(7).join(' | ');
        } else {
          description = parts.slice(6).join(' | ');
        }
      }
    } else {
      title = cleanBullet(line);
    }

    if (!title) {
      title = 'Untitled Task';
    }

    // Reset sequence minutes if date shifted to a new day
    if (taskDate !== lastCalculatedDate) {
      currentSequenceMinutes = parse12HourToMinutes(defaults.sequenceStartTime || '09:00 AM');
      lastCalculatedDate = taskDate;
    }

    // Determine Start & End Times
    let startTime = '09:00 AM';
    let endTime = '10:00 AM';
    let hasNoTime = false;

    if (defaults.timeMode === 'anytime' || customStartTime === 'Anytime') {
      startTime = 'Anytime';
      endTime = 'Anytime';
      hasNoTime = true;
    } else if (customStartTime) {
      startTime = normalizeTime(customStartTime, '09:00 AM');
      endTime = addMinutesToTime(startTime, appointedMinutes);
    } else if (defaults.timeMode === 'sequence') {
      startTime = formatMinutesTo12Hour(currentSequenceMinutes);
      endTime = formatMinutesTo12Hour(currentSequenceMinutes + appointedMinutes);
      currentSequenceMinutes = (currentSequenceMinutes + appointedMinutes) % 1440;
    } else {
      // Fixed time
      startTime = defaults.sequenceStartTime || '09:00 AM';
      endTime = addMinutesToTime(startTime, appointedMinutes);
    }

    return {
      title,
      description,
      priority,
      appointedMinutes,
      category: category || 'General',
      taskDate,
      startTime,
      endTime,
      status: defaults.status || 'Pending',
      hasNoTime,
      planProjectId
    };
  });
}

/**
 * Fuzzy matches row keys from an Excel or CSV object.
 */
function findValueByAliases(row: Record<string, any>, aliases: string[]): any {
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key of rowKeys) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanKey === cleanAlias || cleanKey.includes(cleanAlias)) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
          return row[key];
        }
      }
    }
  }
  return undefined;
}

/**
 * Parses an Excel Workbook object (from XLSX.read) into BatchTaskItem list.
 */
export function parseWorkbook(wb: XLSX.WorkBook, defaults: BatchDefaults): BatchTaskItem[] {
  // Find the most relevant sheet
  const sheetNames = wb.SheetNames;
  if (!sheetNames || sheetNames.length === 0) return [];

  const targetSheetName = 
    sheetNames.find(n => /master|task|matrix|todo|list/i.test(n)) || 
    sheetNames[0];

  const sheet = wb.Sheets[targetSheetName];
  if (!sheet) return [];

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rawRows || rawRows.length === 0) return [];

  let currentSequenceMinutes = parse12HourToMinutes(defaults.sequenceStartTime || '09:00 AM');
  let lastCalculatedDate = defaults.taskDate;

  const items: BatchTaskItem[] = [];

  rawRows.forEach((row, rowIndex) => {
    // Extract title
    const rawTitle = findValueByAliases(row, ['title', 'task', 'task name', 'subject', 'item', 'name']);
    if (!rawTitle || String(rawTitle).trim() === '') {
      return; // Skip empty rows
    }
    const title = cleanBullet(String(rawTitle).trim());

    // Extract priority
    const rawPriority = findValueByAliases(row, ['priority level', 'priority', 'priority label', 'level']);
    const priority = normalizePriority(rawPriority, defaults.priority);

    // Extract Plan / Project
    const rawProject = findValueByAliases(row, [
      'associated plan / project',
      'plan / project',
      'plan project',
      'plan',
      'project',
      'project code',
      'folder',
      'planproject'
    ]);
    let planProjectId = defaults.planProjectId;
    let matchedCategoryFromProject: string | undefined;

    if (rawProject && defaults.planProjects) {
      const pStr = String(rawProject).trim().toLowerCase();
      const match = defaults.planProjects.find(p => 
        p.code.toLowerCase() === pStr ||
        p.title.toLowerCase() === pStr ||
        pStr.includes(p.code.toLowerCase()) ||
        pStr.includes(p.title.toLowerCase()) ||
        p.id === String(rawProject).trim()
      );
      if (match) {
        planProjectId = match.id;
        matchedCategoryFromProject = match.category;
      }
    }

    // Extract category
    const rawCategory = findValueByAliases(row, ['category', 'project folder', 'type', 'tag']);
    const category = rawCategory 
      ? String(rawCategory).trim() 
      : (matchedCategoryFromProject || defaults.category);

    // Extract subcategory
    const rawSubCategory = findValueByAliases(row, ['sub category', 'subcategory', 'sub-category']);
    const subCategory = rawSubCategory ? String(rawSubCategory).trim() : undefined;

    // Extract appointed minutes
    const rawMinutes = findValueByAliases(row, [
      'appointed min', 
      'appointed (min)', 
      'appointed minutes', 
      'minutes', 
      'duration', 
      'time min', 
      'appointed (hours)'
    ]);
    const appointedMinutes = normalizeMinutes(rawMinutes, defaults.appointedMinutes);

    // Extract date
    const rawDate = findValueByAliases(row, ['task date', 'date', 'scheduled date', 'due date', 'day']);
    let fallbackDate = defaults.taskDate;
    if (!rawDate && defaults.dateMode === 'spread') {
      const dayOffset = Math.floor(rowIndex / Math.max(1, defaults.tasksPerDay || 1));
      fallbackDate = addDaysToDate(defaults.taskDate, dayOffset);
    }
    const taskDate = normalizeDate(rawDate, fallbackDate);

    // Extract status
    const rawStatus = findValueByAliases(row, ['status', 'state']);
    const status = normalizeStatus(rawStatus, defaults.status);

    // Extract description & notes
    const rawDesc = findValueByAliases(row, ['description', 'details', 'desc']);
    const description = rawDesc ? String(rawDesc).trim() : '';

    const rawNotes = findValueByAliases(row, ['notes & key findings', 'notes', 'memo', 'findings']);
    const notes = rawNotes ? String(rawNotes).trim() : undefined;

    // Reset sequence minutes if date shifted
    if (taskDate !== lastCalculatedDate) {
      currentSequenceMinutes = parse12HourToMinutes(defaults.sequenceStartTime || '09:00 AM');
      lastCalculatedDate = taskDate;
    }

    // Extract times
    const rawStartTime = findValueByAliases(row, ['start time', 'start', 'from']);
    const rawEndTime = findValueByAliases(row, ['end time', 'end', 'to']);

    let startTime = '09:00 AM';
    let endTime = '10:00 AM';
    let hasNoTime = false;

    if (
      (rawStartTime && String(rawStartTime).toLowerCase() === 'anytime') ||
      defaults.timeMode === 'anytime'
    ) {
      startTime = 'Anytime';
      endTime = 'Anytime';
      hasNoTime = true;
    } else if (rawStartTime) {
      startTime = normalizeTime(rawStartTime, '09:00 AM');
      endTime = rawEndTime ? normalizeTime(rawEndTime, addMinutesToTime(startTime, appointedMinutes)) : addMinutesToTime(startTime, appointedMinutes);
    } else if (defaults.timeMode === 'sequence') {
      startTime = formatMinutesTo12Hour(currentSequenceMinutes);
      endTime = formatMinutesTo12Hour(currentSequenceMinutes + appointedMinutes);
      currentSequenceMinutes = (currentSequenceMinutes + appointedMinutes) % 1440;
    } else {
      startTime = defaults.sequenceStartTime || '09:00 AM';
      endTime = addMinutesToTime(startTime, appointedMinutes);
    }

    items.push({
      title,
      description,
      notes,
      priority,
      appointedMinutes,
      category: category || 'General',
      subCategory,
      taskDate,
      startTime,
      endTime,
      status,
      hasNoTime,
      planProjectId
    });
  });

  return items;
}

/**
 * Parses an Excel or CSV File instance directly.
 */
export async function parseSpreadsheetFile(file: File, defaults: BatchDefaults): Promise<BatchTaskItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  return parseWorkbook(wb, defaults);
}

/**
 * Generates and triggers download for a clean, fully-featured Batch Task Template.
 */
export function downloadBatchTemplate(format: 'csv' | 'xlsx', defaultDate?: string): void {
  const todayStr = defaultDate || toISODateString(new Date());

  const sampleRows = [
    {
      'Title': 'Deep Work: Core Engine Architecture Review',
      'Priority': 'P1',
      'Category': 'Engineering',
      'Associated Plan / Project': 'PRJ-VRTX',
      'Task Date': todayStr,
      'Start Time': '09:00 AM',
      'Appointed (Min)': 90,
      'Status': 'Pending',
      'Description': 'Deep focus session on data flow and state synchronization.',
      'Notes': 'Avoid notifications during this block.'
    },
    {
      'Title': 'Team Sprint Alignment & Sync',
      'Priority': 'P2',
      'Category': 'Meetings',
      'Associated Plan / Project': 'PLN-2026-01',
      'Task Date': todayStr,
      'Start Time': '11:00 AM',
      'Appointed (Min)': 45,
      'Status': 'Pending',
      'Description': 'Review blockers and weekly milestones.',
      'Notes': 'Share progress slides beforehand.'
    },
    {
      'Title': 'Code Review & Pull Requests',
      'Priority': 'P3',
      'Category': 'Engineering',
      'Associated Plan / Project': 'PRJ-VRTX',
      'Task Date': todayStr,
      'Start Time': '02:00 PM',
      'Appointed (Min)': 60,
      'Status': 'Pending',
      'Description': 'Check performance and type safety in new PRs.',
      'Notes': ''
    },
    {
      'Title': 'Inbox Zero & Communication Catch-up',
      'Priority': 'P4',
      'Category': 'Operations',
      'Associated Plan / Project': '',
      'Task Date': todayStr,
      'Start Time': '04:30 PM',
      'Appointed (Min)': 30,
      'Status': 'Pending',
      'Description': 'Process client emails and team messages.',
      'Notes': ''
    },
    {
      'Title': 'Evening Walk & Reflection',
      'Priority': 'P5',
      'Category': 'Personal',
      'Associated Plan / Project': '',
      'Task Date': todayStr,
      'Start Time': 'Anytime',
      'Appointed (Min)': 45,
      'Status': 'Pending',
      'Description': 'Non-work recharge session.',
      'Notes': ''
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 42 }, // Title
    { wch: 10 }, // Priority
    { wch: 16 }, // Category
    { wch: 26 }, // Associated Plan / Project
    { wch: 14 }, // Task Date
    { wch: 12 }, // Start Time
    { wch: 16 }, // Appointed (Min)
    { wch: 12 }, // Status
    { wch: 40 }, // Description
    { wch: 30 }, // Notes
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Batch Tasks Template');

  const fileName = `optimustime_batch_task_template.${format}`;
  XLSX.writeFile(wb, fileName, { bookType: format });
}
