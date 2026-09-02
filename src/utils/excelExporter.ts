import * as XLSX from 'xlsx';
import { Task, PlanProjectFolder, PrioritySettings } from '../types';

export interface ExcelExportOptions {
  fileName?: string;
  includeSummarySheet?: boolean;
  includeSubtasksSheet?: boolean;
  includeExecutionLogsSheet?: boolean;
}

/**
 * Formats a subtask tree into a readable multiline text string for spreadsheet cells.
 */
function formatSubtasksAsText(subtasks: Task['subtasks'] = []): string {
  if (!subtasks || subtasks.length === 0) return 'None';
  return subtasks.map(st => {
    const statusMark = st.isCompleted ? '[✓]' : '[ ]';
    const timeMark = st.assignedTimeMin ? ` (${st.assignedTimeMin}m)` : '';
    return `${statusMark} ${st.title}${timeMark}`;
  }).join('; ');
}

/**
 * Exports all tasks with complete details into a multi-sheet Microsoft Excel (.xlsx) workbook.
 */
export function exportTasksToExcelWorkbook(
  tasks: Task[],
  planProjects: PlanProjectFolder[] = [],
  prioritySettings?: PrioritySettings,
  options: ExcelExportOptions = {}
): void {
  const wb = XLSX.utils.book_new();
  const todayStr = new Date().toISOString().slice(0, 10);
  const fileName = options.fileName || `optimustime_tasks_complete_${todayStr}.xlsx`;

  // Create Project lookup map
  const projectMap = new Map<string, PlanProjectFolder>();
  planProjects.forEach(p => projectMap.set(p.id, p));

  // --- SHEET 1: Master Tasks Matrix ---
  const masterHeaders = [
    'Task ID',
    'Project Code',
    'Title',
    'Category',
    'Sub-Category',
    'Priority Level',
    'Priority Label',
    'Status',
    'Signal vs. Noise',
    'Task Date',
    'Day of Week',
    'Start Time',
    'End Time',
    'Appointed (Min)',
    'Appointed (Hours)',
    'Buffer Time (Min)',
    'Actual Duration (Min)',
    'Start Discrepancy (Min)',
    'Mandatory Schedule',
    'Recurrence Rule',
    'Associated Plan / Project',
    'Subtasks Summary',
    'Subtasks Breakdown List',
    'Description',
    'Notes & Key Findings',
    'Links Count',
    'Links URLs',
    'Execution Sessions Count',
    'Date Created'
  ];

  const masterRows = tasks.map(t => {
    const pInfo = prioritySettings ? prioritySettings[t.priority] : null;
    const priorityLabel = pInfo ? `${pInfo.label} (${t.priority})` : t.priority;
    const plan = t.planProjectId ? projectMap.get(t.planProjectId) : null;
    const planDisplay = plan ? `${plan.title} [${plan.code}]` : 'None';
    
    const completedSubs = t.subtasks?.filter(st => st.isCompleted).length || 0;
    const totalSubs = t.subtasks?.length || 0;
    const subSummary = totalSubs > 0 ? `${completedSubs}/${totalSubs} Done` : 'No subtasks';
    const subBreakdown = formatSubtasksAsText(t.subtasks);

    const linksCount = t.links?.length || 0;
    const linksList = t.links?.map(l => `${l.title}: ${l.url}`).join(' | ') || '';

    const sessionsCount = t.executionLogs?.length || 0;
    const signalNoiseDisplay = t.signalNoise === 'noise' ? 'NOISE (Distraction)' : 'SIGNAL (High Value)';

    return [
      t.id,
      t.projectCode,
      t.title,
      t.category,
      t.subCategory || 'General',
      t.priority,
      priorityLabel,
      t.status,
      signalNoiseDisplay,
      t.taskDate,
      t.dayOfWeek,
      t.startTime || 'Not set',
      t.endTime || 'Not set',
      t.appointedMinutes || 0,
      Number(((t.appointedMinutes || 0) / 60).toFixed(2)),
      t.bufferMinutes || 0,
      t.totalActualMinutes || 0,
      t.startDiscrepancyMinutes !== undefined ? t.startDiscrepancyMinutes : 0,
      t.isMandatorySchedule ? 'Yes (Protected)' : 'No',
      t.recurrence || 'None',
      planDisplay,
      subSummary,
      subBreakdown,
      t.description || '',
      t.notes || '',
      linksCount,
      linksList,
      sessionsCount,
      t.dateAdded ? t.dateAdded.slice(0, 19).replace('T', ' ') : ''
    ];
  });

  const wsMaster = XLSX.utils.aoa_to_sheet([masterHeaders, ...masterRows]);

  // Auto-calculate column widths
  const colWidths = masterHeaders.map((header, colIdx) => {
    let maxLen = header.length;
    for (let r = 0; r < Math.min(masterRows.length, 50); r++) {
      const cellVal = masterRows[r][colIdx];
      if (cellVal !== undefined && cellVal !== null) {
        const valLen = String(cellVal).length;
        if (valLen > maxLen) maxLen = Math.min(valLen, 50);
      }
    }
    return { wch: Math.max(maxLen + 3, 12) };
  });
  wsMaster['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, wsMaster, 'All Tasks Master Matrix');

  // --- SHEET 2: Executive Summary & Metrics ---
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'Done').length;
  const workingTasks = tasks.filter(t => t.status === 'Working').length;
  const pendingTasks = tasks.filter(t => t.status === 'Pending').length;
  const holdTasks = tasks.filter(t => t.status === 'Hold').length;
  const incompleteTasks = tasks.filter(t => t.status === 'Incomplete').length;

  const totalAppointedMins = tasks.reduce((sum, t) => sum + (t.appointedMinutes || 0), 0);
  const totalActualMins = tasks.reduce((sum, t) => sum + (t.totalActualMinutes || 0), 0);
  const signalTasksCount = tasks.filter(t => t.signalNoise !== 'noise').length;
  const noiseTasksCount = tasks.filter(t => t.signalNoise === 'noise').length;

  const summaryHeaders = ['Metric Category', 'Metric Indicator', 'Value', 'Unit / Details'];
  const summaryRows = [
    ['Task Volume', 'Total Tasks In Database', totalTasks, 'Tasks'],
    ['Task Volume', 'Completed (Done)', doneTasks, `${totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0}% completion rate`],
    ['Task Volume', 'Active In-Progress (Working)', workingTasks, 'Tasks'],
    ['Task Volume', 'Scheduled (Pending)', pendingTasks, 'Tasks'],
    ['Task Volume', 'On Hold', holdTasks, 'Tasks'],
    ['Task Volume', 'Incomplete Overdue', incompleteTasks, 'Tasks'],
    ['Time Accounting', 'Total Appointed Work Target', totalAppointedMins, `${(totalAppointedMins / 60).toFixed(1)} Hours`],
    ['Time Accounting', 'Total Actual Tracked Work', totalActualMins, `${(totalActualMins / 60).toFixed(1)} Hours`],
    ['Signal vs. Noise', 'Signal Tasks (High ROI / Core Focus)', signalTasksCount, `${totalTasks > 0 ? Math.round((signalTasksCount / totalTasks) * 100) : 100}%`],
    ['Signal vs. Noise', 'Noise Filter Tasks (P5 / Low Yield)', noiseTasksCount, `${totalTasks > 0 ? Math.round((noiseTasksCount / totalTasks) * 100) : 0}%`],
    ['', '', '', ''],
    ['Priority Breakdown', 'P1 (Must Do) Tasks', tasks.filter(t => t.priority === 'P1').length, `${tasks.filter(t => t.priority === 'P1').reduce((s, t) => s + t.appointedMinutes, 0) / 60}h allocated`],
    ['Priority Breakdown', 'P2 (High ROI) Tasks', tasks.filter(t => t.priority === 'P2').length, `${tasks.filter(t => t.priority === 'P2').reduce((s, t) => s + t.appointedMinutes, 0) / 60}h allocated`],
    ['Priority Breakdown', 'P3 (Delegatable) Tasks', tasks.filter(t => t.priority === 'P3').length, `${tasks.filter(t => t.priority === 'P3').reduce((s, t) => s + t.appointedMinutes, 0) / 60}h allocated`],
    ['Priority Breakdown', 'P4 (Optional) Tasks', tasks.filter(t => t.priority === 'P4').length, `${tasks.filter(t => t.priority === 'P4').reduce((s, t) => s + t.appointedMinutes, 0) / 60}h allocated`],
    ['Priority Breakdown', 'P5 (Noise Filter) Tasks', tasks.filter(t => t.priority === 'P5').length, `${tasks.filter(t => t.priority === 'P5').reduce((s, t) => s + t.appointedMinutes, 0) / 60}h allocated`]
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  wsSummary['!cols'] = [{ wch: 22 }, { wch: 32 }, { wch: 18 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary & Metrics');

  // --- SHEET 3: Granular Subtasks Audit ---
  const subtaskHeaders = [
    'Parent Task Code',
    'Parent Task Title',
    'Subtask ID',
    'Subtask Title',
    'Status',
    'Is Completed',
    'Depth Level',
    'Assigned Duration (Min)',
    'Parent Category',
    'Parent Priority'
  ];

  const subtaskRows: any[] = [];
  tasks.forEach(t => {
    if (t.subtasks && t.subtasks.length > 0) {
      t.subtasks.forEach(st => {
        subtaskRows.push([
          t.projectCode,
          t.title,
          st.id,
          st.title,
          st.isCompleted ? 'Done' : 'Pending',
          st.isCompleted ? 'Yes' : 'No',
          st.depthLevel || 1,
          st.assignedTimeMin || 0,
          t.category,
          t.priority
        ]);
      });
    }
  });

  if (subtaskRows.length === 0) {
    subtaskRows.push(['None', 'No subtasks found in database', '', '', '', '', '', '', '', '']);
  }

  const wsSubtasks = XLSX.utils.aoa_to_sheet([subtaskHeaders, ...subtaskRows]);
  wsSubtasks['!cols'] = [
    { wch: 18 }, { wch: 35 }, { wch: 15 }, { wch: 35 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 22 },
    { wch: 18 }, { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSubtasks, 'Granular Subtasks');

  // --- SHEET 4: Execution Sessions & Logs ---
  const execHeaders = [
    'Task Code',
    'Task Title',
    'Session Started At',
    'Session Completed At',
    'Actual Duration (Min)',
    'Scheduled Start',
    'Late Start (Min)',
    'Early Start (Min)',
    'Start Discrepancy (Min)',
    'Finished Late',
    'Session Notes'
  ];

  const execRows: any[] = [];
  tasks.forEach(t => {
    if (t.executionLogs && t.executionLogs.length > 0) {
      t.executionLogs.forEach(log => {
        execRows.push([
          t.projectCode,
          t.title,
          log.startedAt ? log.startedAt.slice(0, 19).replace('T', ' ') : '',
          log.completedAt ? log.completedAt.slice(0, 19).replace('T', ' ') : '',
          log.actualDurationMinutes || 0,
          log.scheduledStartTime || t.startTime || '',
          log.lateStartMinutes || 0,
          log.earlyStartMinutes || 0,
          (log.lateStartMinutes || 0) > 0 ? `+${log.lateStartMinutes}m (Late)` : (log.earlyStartMinutes || 0) > 0 ? `-${log.earlyStartMinutes}m (Early)` : '0m (On-Time)',
          log.isLateFinish ? 'Yes' : 'No',
          log.notes || ''
        ]);
      });
    }
  });

  if (execRows.length === 0) {
    execRows.push(['None', 'No timer execution sessions logged yet', '', '', '', '', '', '', '', '', '']);
  }

  const wsExec = XLSX.utils.aoa_to_sheet([execHeaders, ...execRows]);
  wsExec['!cols'] = [
    { wch: 18 }, { wch: 35 }, { wch: 22 }, { wch: 22 },
    { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 22 }, { wch: 14 }, { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, wsExec, 'Execution Logs');

  // Write file and trigger download
  XLSX.writeFile(wb, fileName);
}

/**
 * Exports complete tasks matrix to a clean CSV formatted with UTF-8 BOM for Microsoft Excel.
 */
export function exportTasksToDetailedCSV(
  tasks: Task[],
  planProjects: PlanProjectFolder[] = [],
  prioritySettings?: PrioritySettings,
  fileName?: string
): void {
  const projectMap = new Map<string, PlanProjectFolder>();
  planProjects.forEach(p => projectMap.set(p.id, p));

  const headers = [
    'Project Code',
    'Priority',
    'Priority Label',
    'Title',
    'Category',
    'SubCategory',
    'Status',
    'Signal vs. Noise',
    'Date',
    'Day',
    'Start Time',
    'End Time',
    'Appointed Minutes',
    'Appointed Hours',
    'Buffer Minutes',
    'Actual Tracked Minutes',
    'Start Discrepancy Minutes',
    'Is Mandatory Schedule',
    'Recurrence',
    'Associated Plan or Project',
    'Subtasks Done Ratio',
    'Subtasks List',
    'Description',
    'Notes',
    'Links Count',
    'Execution Sessions Count'
  ];

  const rows = tasks.map(t => {
    const pInfo = prioritySettings ? prioritySettings[t.priority] : null;
    const priorityLabel = pInfo ? pInfo.label : t.priority;
    const plan = t.planProjectId ? projectMap.get(t.planProjectId) : null;
    const planDisplay = plan ? `${plan.title} (${plan.code})` : 'None';
    
    const completedSubs = t.subtasks?.filter(st => st.isCompleted).length || 0;
    const totalSubs = t.subtasks?.length || 0;
    const subRatio = totalSubs > 0 ? `${completedSubs}/${totalSubs}` : '0/0';
    const subList = formatSubtasksAsText(t.subtasks).replace(/"/g, '""');

    const cleanDesc = (t.description || '').replace(/"/g, '""').replace(/\n/g, ' ');
    const cleanNotes = (t.notes || '').replace(/"/g, '""').replace(/\n/g, ' ');

    return [
      t.projectCode,
      t.priority,
      `"${priorityLabel}"`,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.category}"`,
      `"${t.subCategory || 'General'}"`,
      t.status,
      t.signalNoise === 'noise' ? 'NOISE' : 'SIGNAL',
      t.taskDate,
      t.dayOfWeek,
      t.startTime || '',
      t.endTime || '',
      t.appointedMinutes || 0,
      Number(((t.appointedMinutes || 0) / 60).toFixed(2)),
      t.bufferMinutes || 0,
      t.totalActualMinutes || 0,
      t.startDiscrepancyMinutes || 0,
      t.isMandatorySchedule ? 'YES' : 'NO',
      t.recurrence || 'None',
      `"${planDisplay}"`,
      subRatio,
      `"${subList}"`,
      `"${cleanDesc}"`,
      `"${cleanNotes}"`,
      t.links?.length || 0,
      t.executionLogs?.length || 0
    ].join(',');
  });

  // UTF-8 BOM ensures Microsoft Excel on Windows parses special characters correctly
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `optimustime_tasks_complete_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
