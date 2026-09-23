import { Task, GoogleSheetsSyncConfig, PriorityLevel, TaskStatus } from '../types';
import { toISODateString } from '../utils/timeUtils';

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * =========================================================================
 *  OPTIMUSTIME — OFFICIAL GOOGLE SHEETS 2-WAY SYNC ENGINE (v1.0)
 * =========================================================================
 *  Features:
 *  1. Automatic Sheet Creation & Pro UI Styling (Frozen headers, colors, filters)
 *  2. Real-Time 2-Way Synchronization (App ⇄ Google Sheet)
 *  3. Idempotent Upserts (Matches by Task ID, prevents duplicates)
 *  4. Dropdown Data Validation for Status & Priority
 *  5. onEdit Trigger: Stamps 'Last Updated' timestamp automatically on any cell edit
 * =========================================================================
 */

const SHEET_NAME = 'OptimusTime Tasks';

const HEADERS = [
  'Task ID',               // Col 1
  'Project Code',          // Col 2
  'Title',                 // Col 3
  'Category',              // Col 4
  'Sub-Category',          // Col 5
  'Priority',              // Col 6
  'Status',                // Col 7
  'Task Date',             // Col 8
  'Start Time',            // Col 9
  'End Time',              // Col 10
  'Appointed (Min)',       // Col 11
  'Actual (Min)',          // Col 12
  'Description',           // Col 13
  'Notes',                 // Col 14
  'Recurrence',            // Col 15
  'Date Added',            // Col 16
  'Last Updated'           // Col 17
];

/**
 * Handles GET requests: Ping test or fetch all tasks
 */
function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'getTasks';

    if (action === 'ping') {
      return jsonResponse({
        status: 'success',
        message: 'OptimusTime Google Sheets Engine is online and ready!',
        timestamp: new Date().toISOString()
      });
    }

    const sheet = getOrCreateSheet();
    const tasks = readTasksFromSheet(sheet);

    return jsonResponse({
      status: 'success',
      tasks: tasks,
      totalCount: tasks.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse({
      status: 'error',
      message: err.toString()
    });
  }
}

/**
 * Handles POST requests: Push tasks, 2-way sync, or single updates
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    const action = payload.action || 'sync';
    const sheet = getOrCreateSheet();

    if (action === 'batchPush' || action === 'sync') {
      const incomingTasks = payload.tasks || [];
      const updatedCount = upsertTasks(sheet, incomingTasks);

      return jsonResponse({
        status: 'success',
        message: 'Synced ' + updatedCount + ' tasks successfully!',
        syncedCount: updatedCount,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'pull') {
      const tasks = readTasksFromSheet(sheet);
      return jsonResponse({
        status: 'success',
        tasks: tasks,
        totalCount: tasks.length,
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({
      status: 'error',
      message: 'Unknown action: ' + action
    });
  } catch (err) {
    return jsonResponse({
      status: 'error',
      message: err.toString()
    });
  }
}

/**
 * Triggers automatically when ANY user edits any cell in Google Sheets.
 * Stamps the Last Updated column (Col 17) with current ISO timestamp.
 */
function onEdit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    if (sheet.getName() !== SHEET_NAME) return;

    const row = range.getRow();
    if (row <= 1) return; // Skip header row

    // Update 'Last Updated' timestamp in Column 17
    sheet.getRange(row, 17).setValue(new Date().toISOString());
  } catch (err) {
    console.error('onEdit Error:', err);
  }
}

/**
 * Creates sheet if missing, or styles existing sheet
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    initSheetStyling(sheet);
  } else if (sheet.getLastRow() === 0) {
    initSheetStyling(sheet);
  }

  return sheet;
}

/**
 * Professional Formatting: Frozen header, midnight theme, data validations
 */
function initSheetStyling(sheet) {
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);

  // Style Header Row
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setBackground('#0F172A');
  headerRange.setFontColor('#F8FAFC');
  headerRange.setFontWeight('bold');
  headerRange.setFontFamily('Inter');
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment('center');

  // Auto-column widths
  sheet.setColumnWidth(1, 130); // Task ID
  sheet.setColumnWidth(2, 130); // Project Code
  sheet.setColumnWidth(3, 260); // Title
  sheet.setColumnWidth(4, 120); // Category
  sheet.setColumnWidth(5, 120); // Sub-Category
  sheet.setColumnWidth(6, 90);  // Priority
  sheet.setColumnWidth(7, 100); // Status
  sheet.setColumnWidth(8, 110); // Task Date
  sheet.setColumnWidth(9, 100); // Start Time
  sheet.setColumnWidth(10, 100); // End Time
  sheet.setColumnWidth(11, 110); // Appointed
  sheet.setColumnWidth(12, 100); // Actual
  sheet.setColumnWidth(13, 200); // Description
  sheet.setColumnWidth(14, 200); // Notes
  sheet.setColumnWidth(15, 110); // Recurrence
  sheet.setColumnWidth(16, 170); // Date Added
  sheet.setColumnWidth(17, 170); // Last Updated

  // Dropdown Validation for Priority (Col 6)
  const priorityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['P1', 'P2', 'P3', 'P4', 'P5'], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, 6, 999, 1).setDataValidation(priorityRule);

  // Dropdown Validation for Status (Col 7)
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Pending', 'Working', 'Done', 'Hold', 'Terminated', 'Incomplete'], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, 7, 999, 1).setDataValidation(statusRule);
}

/**
 * Upserts tasks into sheet (matches existing row by Task ID in Column 1)
 */
function upsertTasks(sheet, tasks) {
  if (!tasks || tasks.length === 0) return 0;

  const lastRow = sheet.getLastRow();
  let existingIds = [];
  if (lastRow > 1) {
    existingIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function(r) { return String(r[0]); });
  }

  const idToRowMap = {};
  for (let i = 0; i < existingIds.length; i++) {
    idToRowMap[existingIds[i]] = i + 2; // Row number in sheet
  }

  const nowIso = new Date().toISOString();
  let updatedCount = 0;

  for (let t = 0; t < tasks.length; t++) {
    const task = tasks[t];
    const taskId = String(task.id);
    const rowValues = [
      taskId,
      task.projectCode || '',
      task.title || '',
      task.category || 'DEFAULT',
      task.subCategory || '',
      task.priority || 'P3',
      task.status || 'Pending',
      task.taskDate || '',
      task.startTime || 'Anytime',
      task.endTime || 'Anytime',
      task.appointedMinutes != null ? task.appointedMinutes : 0,
      task.totalActualMinutes != null ? task.totalActualMinutes : 0,
      task.description || '',
      task.notes || '',
      task.recurrence || 'None',
      task.dateAdded || nowIso,
      nowIso
    ];

    if (idToRowMap[taskId]) {
      // Update existing row
      sheet.getRange(idToRowMap[taskId], 1, 1, HEADERS.length).setValues([rowValues]);
    } else {
      // Append new row
      sheet.appendRow(rowValues);
      idToRowMap[taskId] = sheet.getLastRow();
    }
    updatedCount++;
  }

  return updatedCount;
}

/**
 * Reads all rows from sheet into structured Task objects
 */
function readTasksFromSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const tasks = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const id = String(row[0] || '').trim();
    if (!id) continue;

    tasks.push({
      id: id,
      projectCode: String(row[1] || '').trim(),
      title: String(row[2] || '').trim(),
      category: String(row[3] || 'DEFAULT').trim(),
      subCategory: String(row[4] || '').trim(),
      priority: String(row[5] || 'P3').trim(),
      status: String(row[6] || 'Pending').trim(),
      taskDate: String(row[7] || '').trim(),
      startTime: String(row[8] || 'Anytime').trim(),
      endTime: String(row[9] || 'Anytime').trim(),
      appointedMinutes: Number(row[10]) || 0,
      totalActualMinutes: Number(row[11]) || 0,
      description: String(row[12] || '').trim(),
      notes: String(row[13] || '').trim(),
      recurrence: String(row[14] || 'None').trim(),
      dateAdded: String(row[15] || '').trim(),
      lastUpdated: String(row[16] || '').trim()
    });
  }

  return tasks;
}

/**
 * Returns JSON Output with proper CORS headers
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export interface SyncResult {
  ok: boolean;
  message: string;
  tasks?: Task[];
  syncedCount?: number;
  timestamp?: string;
}

/**
 * Test connectivity with Google Apps Script Web App
 */
export async function testGoogleSheetsConnection(webAppUrl: string): Promise<SyncResult> {
  const cleanUrl = webAppUrl.trim();
  if (!cleanUrl) {
    return { ok: false, message: 'Google Apps Script Web App URL is required.' };
  }

  try {
    const pingUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=ping`;
    const response = await fetch(pingUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}: Failed to reach Google Sheets Web App.` };
    }

    const data = await response.json();
    if (data.status === 'success') {
      return { ok: true, message: data.message || 'Connected to Google Sheets successfully!' };
    }

    return { ok: false, message: data.message || 'Received unexpected response from Google Sheets.' };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message?.includes('Failed to fetch')
        ? 'Could not connect. Ensure your Apps Script deployment has "Who has access" set to "Anyone".'
        : (err.message || 'Connection failed.')
    };
  }
}

/**
 * Push all or changed tasks from OptimusTime to Google Sheets
 */
export async function pushTasksToGoogleSheets(
  webAppUrl: string,
  tasks: Task[]
): Promise<SyncResult> {
  const cleanUrl = webAppUrl.trim();
  if (!cleanUrl) {
    return { ok: false, message: 'No Google Apps Script Web App URL configured.' };
  }

  try {
    const payload = {
      action: 'batchPush',
      tasks: tasks.map(t => ({
        id: t.id,
        projectCode: t.projectCode,
        title: t.title,
        category: t.category,
        subCategory: t.subCategory || '',
        priority: t.priority,
        status: t.status,
        taskDate: t.taskDate,
        startTime: t.startTime,
        endTime: t.endTime,
        appointedMinutes: t.appointedMinutes,
        totalActualMinutes: t.totalActualMinutes || 0,
        description: t.description || '',
        notes: t.notes || '',
        recurrence: t.recurrence || 'None',
        dateAdded: t.dateAdded
      })),
      timestamp: new Date().toISOString()
    };

    const response = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // text/plain bypasses CORS preflight in Google Apps Script
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}: Failed to push tasks to Google Sheets.` };
    }

    const data = await response.json();
    if (data.status === 'success') {
      return {
        ok: true,
        message: `Successfully pushed ${data.syncedCount || tasks.length} tasks to Google Sheets!`,
        syncedCount: data.syncedCount || tasks.length,
        timestamp: data.timestamp || new Date().toISOString()
      };
    }

    return { ok: false, message: data.message || 'Failed to sync with Google Sheets.' };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message?.includes('Failed to fetch')
        ? 'Network error. Verify your Web App deployment settings ("Who has access: Anyone").'
        : (err.message || 'Push failed.')
    };
  }
}

/**
 * Pull all tasks from Google Sheets into OptimusTime
 */
export async function pullTasksFromGoogleSheets(webAppUrl: string): Promise<SyncResult> {
  const cleanUrl = webAppUrl.trim();
  if (!cleanUrl) {
    return { ok: false, message: 'No Google Apps Script Web App URL configured.' };
  }

  try {
    const pullUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=getTasks`;
    const response = await fetch(pullUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}: Failed to pull from Google Sheets.` };
    }

    const data = await response.json();
    if (data.status === 'success' && Array.isArray(data.tasks)) {
      const parsedTasks: Task[] = data.tasks.map((raw: any) => ({
        id: String(raw.id),
        projectCode: raw.projectCode || `OPT-${toISODateString(new Date()).replace(/-/g, '').slice(2)}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: raw.title || 'Untitled Task',
        description: raw.description || '',
        dateAdded: raw.dateAdded || new Date().toISOString(),
        taskDate: raw.taskDate || toISODateString(new Date()),
        dayOfWeek: 'Monday',
        priority: (['P1', 'P2', 'P3', 'P4', 'P5'].includes(raw.priority) ? raw.priority : 'P3') as PriorityLevel,
        category: raw.category || 'DEFAULT',
        subCategory: raw.subCategory || undefined,
        appointedMinutes: Number(raw.appointedMinutes) || 30,
        startTime: raw.startTime || 'Anytime',
        endTime: raw.endTime || 'Anytime',
        hasNoTime: !raw.startTime || raw.startTime === 'Anytime' || raw.startTime === 'Free Time',
        status: (['Pending', 'Working', 'Done', 'Hold', 'Terminated', 'Incomplete'].includes(raw.status) ? raw.status : 'Pending') as TaskStatus,
        bufferMinutes: 15,
        recurrence: (['None', 'Daily', 'Selected Days', 'Weekly', 'Monthly', 'Yearly'].includes(raw.recurrence) ? raw.recurrence : 'None'),
        executionLogs: [],
        totalActualMinutes: Number(raw.totalActualMinutes) || 0,
        notes: raw.notes || '',
        links: [],
        subtasks: []
      }));

      return {
        ok: true,
        message: `Successfully pulled ${parsedTasks.length} tasks from Google Sheets!`,
        tasks: parsedTasks,
        syncedCount: parsedTasks.length,
        timestamp: data.timestamp || new Date().toISOString()
      };
    }

    return { ok: false, message: data.message || 'Invalid data returned from Google Sheets.' };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message?.includes('Failed to fetch')
        ? 'Could not pull. Check your Web App deployment settings ("Who has access: Anyone").'
        : (err.message || 'Pull failed.')
    };
  }
}

/**
 * Intelligent 2-way merge:
 * 1. Pull tasks from Google Sheets
 * 2. Merge with local tasks by Task ID
 * 3. Push merged state back to Google Sheets
 */
export async function twoWaySyncGoogleSheets(
  webAppUrl: string,
  localTasks: Task[]
): Promise<{ ok: boolean; message: string; mergedTasks?: Task[]; timestamp?: string }> {
  const pullResult = await pullTasksFromGoogleSheets(webAppUrl);
  if (!pullResult.ok || !pullResult.tasks) {
    return { ok: false, message: `Pull failed: ${pullResult.message}` };
  }

  const remoteTasks = pullResult.tasks;
  const localMap = new Map<string, Task>();
  for (const t of localTasks) {
    localMap.set(t.id, t);
  }

  for (const remote of remoteTasks) {
    if (localMap.has(remote.id)) {
      const local = localMap.get(remote.id)!;
      localMap.set(remote.id, {
        ...local,
        title: remote.title,
        priority: remote.priority,
        status: remote.status,
        category: remote.category,
        subCategory: remote.subCategory,
        taskDate: remote.taskDate,
        startTime: remote.startTime,
        endTime: remote.endTime,
        hasNoTime: remote.hasNoTime,
        appointedMinutes: remote.appointedMinutes,
        description: remote.description,
        notes: remote.notes || local.notes
      });
    } else {
      localMap.set(remote.id, remote);
    }
  }

  const mergedTasks = Array.from(localMap.values());

  const pushResult = await pushTasksToGoogleSheets(webAppUrl, mergedTasks);
  if (!pushResult.ok) {
    return {
      ok: false,
      message: `Merged locally (${mergedTasks.length} tasks), but failed to update sheet: ${pushResult.message}`,
      mergedTasks
    };
  }

  return {
    ok: true,
    message: `Two-way sync complete! ${mergedTasks.length} tasks synchronized across App & Google Sheets.`,
    mergedTasks,
    timestamp: pushResult.timestamp || new Date().toISOString()
  };
}
