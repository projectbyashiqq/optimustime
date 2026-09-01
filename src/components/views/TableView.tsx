import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Task, PriorityLevel, TaskStatus } from '../../types';
import { 
  toISODateString, 
  parse12HourToMinutes, 
  isTaskScheduledForDate, 
  isTaskInRunningSlot,
  isTaskPastDue,
  findSimultaneousTasks,
  getDayOfWeekFromDate
} from '../../utils/timeUtils';
import { 
  Table as TableIcon, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Play, 
  Pause, 
  CheckCircle2, 
  Check, 
  Edit2, 
  Trash2, 
  Clock, 
  Calendar, 
  Plus, 
  SlidersHorizontal, 
  Download, 
  Zap, 
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Lock
} from 'lucide-react';

interface TableViewProps {
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
  onOpenRescheduleModal?: (task: Task) => void;
}

type SortField = 'priority' | 'projectCode' | 'title' | 'category' | 'taskDate' | 'startTime' | 'appointedMinutes' | 'status' | 'totalActualMinutes';
type SortDirection = 'asc' | 'desc';

export const TableView: React.FC<TableViewProps> = ({
  onOpenTaskModal,
  onOpenRescheduleModal
}) => {
  const { 
    tasks, 
    categories, 
    prioritySettings, 
    capacitySettings,
    startTask, 
    pauseTask, 
    completeTask, 
    updateTask, 
    deleteTask,
    requestDeleteTask,
    searchQuery,
    setSearchQuery
  } = useApp();

  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'THIS_MONTH'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<SortField>('taskDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [localSearch, setLocalSearch] = useState<string>('');

  const todayStr = toISODateString(new Date());

  // Handle Column Header Sort Toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.status === 'Terminated') return false;

      // Date Filter
      if (dateFilter === 'TODAY' && !isTaskScheduledForDate(task, todayStr)) return false;
      if (dateFilter === 'TOMORROW') {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        if (!isTaskScheduledForDate(task, toISODateString(d))) return false;
      }
      if (dateFilter === 'THIS_WEEK') {
        const now = new Date();
        let inWeek = false;
        for (let i = 0; i < 7; i++) {
          const d = new Date(now);
          d.setDate(now.getDate() + i);
          if (isTaskScheduledForDate(task, toISODateString(d))) {
            inWeek = true;
            break;
          }
        }
        if (!inWeek) return false;
      }
      if (dateFilter === 'THIS_MONTH') {
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!task.taskDate.startsWith(currentYearMonth)) return false;
      }

      // Category Filter
      if (selectedCategory !== 'ALL' && task.category !== selectedCategory) return false;

      // Priority Filter
      if (selectedPriority !== 'ALL' && task.priority !== selectedPriority) return false;

      // Status Filter
      if (selectedStatus !== 'ALL' && task.status !== selectedStatus) return false;

      // Search Query Filter
      const q = (localSearch || searchQuery || '').toLowerCase();
      if (q) {
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchCode = task.projectCode.toLowerCase().includes(q);
        const matchCat = task.category.toLowerCase().includes(q);
        const matchDesc = (task.description || '').toLowerCase();
        if (!matchTitle && !matchCode && !matchCat && !matchDesc) return false;
      }

      return true;
    });
  }, [tasks, dateFilter, selectedCategory, selectedPriority, selectedStatus, localSearch, searchQuery, todayStr]);

  // Sort Tasks
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'priority': {
          const pWeight: Record<PriorityLevel, number> = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };
          comparison = (pWeight[a.priority] || 9) - (pWeight[b.priority] || 9);
          break;
        }
        case 'projectCode':
          comparison = a.projectCode.localeCompare(b.projectCode);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'taskDate':
          comparison = a.taskDate.localeCompare(b.taskDate);
          break;
        case 'startTime':
          comparison = parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime);
          break;
        case 'appointedMinutes':
          comparison = a.appointedMinutes - b.appointedMinutes;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'totalActualMinutes':
          comparison = (a.totalActualMinutes || 0) - (b.totalActualMinutes || 0);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredTasks, sortField, sortDirection]);

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTaskIds(sortedTasks.map(t => t.id));
    } else {
      setSelectedTaskIds([]);
    }
  };

  const handleToggleSelectTask = (id: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Bulk actions
  const handleBulkComplete = () => {
    selectedTaskIds.forEach(id => completeTask(id));
    setSelectedTaskIds([]);
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedTaskIds.length} selected tasks?`)) {
      selectedTaskIds.forEach(id => deleteTask(id));
      setSelectedTaskIds([]);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Project Code', 'Priority', 'Title', 'Category', 'SubCategory', 'Date', 'Day', 'Start Time', 'End Time', 'Duration (Min)', 'Status', 'Actual Time (Min)', 'Recurrence'];
    const rows = sortedTasks.map(t => [
      t.projectCode,
      t.priority,
      `"${t.title.replace(/"/g, '""')}"`,
      t.category,
      t.subCategory || '',
      t.taskDate,
      t.dayOfWeek,
      t.startTime,
      t.endTime,
      t.appointedMinutes,
      t.status,
      t.totalActualMinutes || 0,
      t.recurrence
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `optimustime_tasks_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Summary Metrics
  const totalAllocatedMins = useMemo(() => {
    return sortedTasks.reduce((acc, t) => acc + t.appointedMinutes, 0);
  }, [sortedTasks]);

  const completedCount = useMemo(() => {
    return sortedTasks.filter(t => t.status === 'Done').length;
  }, [sortedTasks]);

  const overdueCount = useMemo(() => {
    return sortedTasks.filter(t => t.status === 'Incomplete').length;
  }, [sortedTasks]);

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* Table Top Controls & Stats */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-theme-border space-y-4">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <TableIcon className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-black text-theme-text flex items-center gap-2">
                <span>Unified Tasks Data Table</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  {sortedTasks.length} Rows
                </span>
              </h3>
              <p className="text-xs text-theme-muted">
                {Math.floor(totalAllocatedMins / 60)}h {totalAllocatedMins % 60}m Total Time • {completedCount} Done
                {overdueCount > 0 && <span className="text-red-500 font-bold ml-1.5">• {overdueCount} Overdue/Incomplete</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input
                type="text"
                placeholder="Search code, title, category..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-xs font-bold text-theme-text hover:bg-theme-border flex items-center gap-1.5 transition-colors"
              title="Export filtered records to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => onOpenTaskModal()}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>New Task</span>
            </button>
          </div>

        </div>

        {/* Multi-Dimensional Filter Row */}
        <div className="pt-3 border-t border-theme-border flex items-center justify-between gap-3 flex-wrap">
          
          {/* Quick Date Horizons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-xs font-bold text-theme-muted uppercase tracking-wider mr-1">Horizon:</span>
            {[
              { id: 'ALL', label: 'All Dates' },
              { id: 'TODAY', label: 'Today' },
              { id: 'TOMORROW', label: 'Tomorrow' },
              { id: 'THIS_WEEK', label: 'This Week' },
              { id: 'THIS_MONTH', label: 'This Month' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  dateFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-theme-card-hover text-theme-muted hover:text-theme-text border border-theme-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category & Status Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text font-medium"
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as any)}
              className="text-xs px-2.5 py-1 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text font-medium"
            >
              <option value="ALL">All Priorities (P1-P5)</option>
              {(['P1', 'P2', 'P3', 'P4', 'P5'] as PriorityLevel[]).map(p => (
                <option key={p} value={p}>{p} - {prioritySettings[p]?.label}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="text-xs px-2.5 py-1 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Working">Working</option>
              <option value="Done">Done</option>
              <option value="Hold">Hold</option>
              <option value="Incomplete">Incomplete / Overdue</option>
              <option value="Reschedule">Reschedule</option>
            </select>
          </div>

        </div>

      </div>

      {/* Bulk Action Bar (when rows are selected) */}
      {selectedTaskIds.length > 0 && (
        <div className="glass-panel p-3 px-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-400 flex items-center justify-between gap-3 animate-slide-up">
          <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Check className="w-4 h-4" />
            {selectedTaskIds.length} tasks selected
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkComplete}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
            >
              Mark Selected Done
            </button>

            <button
              onClick={handleBulkDelete}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm"
            >
              Delete Selected
            </button>

            <button
              onClick={() => setSelectedTaskIds([])}
              className="px-2 py-1 text-xs text-theme-muted hover:text-theme-text"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Main Responsive Data Table Container */}
      <div className="glass-panel rounded-3xl border border-theme-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left border-collapse text-xs">
            
            {/* Sticky Table Header */}
            <thead className="bg-theme-card-hover/90 backdrop-blur sticky top-0 z-10 border-b border-theme-border text-theme-muted uppercase tracking-wider font-mono text-[11px] select-none">
              <tr>
                <th className="p-3.5 pl-4 w-10">
                  <input
                    type="checkbox"
                    checked={sortedTasks.length > 0 && selectedTaskIds.length === sortedTasks.length}
                    onChange={handleSelectAll}
                    className="rounded border-theme-border text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>

                <th 
                  onClick={() => handleSort('priority')} 
                  className="p-3.5 cursor-pointer hover:text-theme-text transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Priority</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('projectCode')} 
                  className="p-3.5 cursor-pointer hover:text-theme-text transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Code</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('title')} 
                  className="p-3.5 min-w-[220px] cursor-pointer hover:text-theme-text transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Task Title</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('category')} 
                  className="p-3.5 cursor-pointer hover:text-theme-text transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Category</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('taskDate')} 
                  className="p-3.5 cursor-pointer hover:text-theme-text transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Date & Day</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('startTime')} 
                  className="p-3.5 cursor-pointer hover:text-theme-text transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Scheduled Slot</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('appointedMinutes')} 
                  className="p-3.5 cursor-pointer hover:text-theme-text transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Duration</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('status')} 
                  className="p-3.5 cursor-pointer hover:text-theme-text transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>

                <th className="p-3.5 pr-4 text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-theme-border/60 font-medium">
              {sortedTasks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-theme-muted">
                    <TableIcon className="w-8 h-8 mx-auto opacity-40 mb-2" />
                    <p className="font-bold text-sm text-theme-text">No tasks found matching your filter</p>
                    <p className="text-xs mt-1">Try broadening your search query or horizon settings.</p>
                  </td>
                </tr>
              ) : (
                sortedTasks.map((task) => {
                  const isDone = task.status === 'Done';
                  const isWorking = task.status === 'Working';
                  const isIncomplete = task.status === 'Incomplete';
                  const isSelected = selectedTaskIds.includes(task.id);
                  const pMeta = prioritySettings[task.priority];

                  return (
                    <tr
                      key={task.id}
                      onClick={() => onOpenTaskModal(task)}
                      className={`cursor-pointer transition-colors group ${
                        isSelected
                          ? 'bg-blue-500/10'
                          : isDone
                          ? 'bg-emerald-500/[0.02] hover:bg-emerald-500/[0.06]'
                          : isWorking
                          ? 'bg-blue-500/[0.05] hover:bg-blue-500/[0.09]'
                          : isIncomplete
                          ? 'bg-rose-500/[0.04] hover:bg-rose-500/[0.08]'
                          : 'hover:bg-theme-card-hover/80'
                      }`}
                    >
                      {/* Select Checkbox */}
                      <td 
                        className="p-3.5 pl-4"
                        onClick={(e) => { e.stopPropagation(); handleToggleSelectTask(task.id); }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-theme-border text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Priority Badge */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span 
                          className="px-2 py-0.5 rounded font-black text-[10px] font-mono shadow-xs inline-block"
                          style={{ backgroundColor: pMeta?.bgColor, color: pMeta?.color }}
                        >
                          {task.priority}
                        </span>
                      </td>

                      {/* Code */}
                      <td className="p-3.5 font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {task.isMandatorySchedule && (
                            <span title="Mandatory Fixed Schedule" className="inline-flex">
                              <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                            </span>
                          )}
                          <span>{task.projectCode}</span>
                        </div>
                      </td>

                      {/* Title & Subtasks */}
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          <span className={`font-bold text-xs block ${isDone ? 'line-through text-theme-muted' : 'text-theme-text'}`}>
                            {task.title}
                          </span>
                          {(task.subtasks || []).length > 0 && (
                            <span className="text-[10px] text-theme-muted font-mono block">
                              {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length} Subtasks
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-3.5 whitespace-nowrap text-theme-muted">
                        <span className="font-semibold text-theme-text">{task.category}</span>
                        {task.subCategory && (
                          <span className="text-[11px] text-theme-muted block">{task.subCategory}</span>
                        )}
                      </td>

                      {/* Date & Day */}
                      <td className="p-3.5 whitespace-nowrap font-mono text-theme-muted">
                        <div className="flex items-center gap-1.5">
                          <span className={task.taskDate === todayStr ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-theme-text'}>
                            {task.taskDate}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-theme-card-hover border border-theme-border">
                            {task.dayOfWeek.slice(0, 3)}
                          </span>
                        </div>
                      </td>

                      {/* Scheduled Slot */}
                      <td className="p-3.5 whitespace-nowrap font-mono text-[11px] font-bold text-theme-text">
                        <div className="flex items-center gap-1.5">
                          <span>{task.startTime} - {task.endTime}</span>
                          {task.isMandatorySchedule && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800" title="Mandatory Schedule (Locked)">
                              FIXED
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="p-3.5 whitespace-nowrap text-right font-mono font-bold text-theme-muted">
                        {task.appointedMinutes}m
                      </td>

                      {/* Status */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                          isDone ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          isWorking ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 animate-pulse' :
                          isIncomplete ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' :
                          task.status === 'Hold' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                          'bg-theme-card-hover text-theme-muted'
                        }`}>
                          {task.status}
                        </span>
                      </td>

                      {/* Action Controls */}
                      <td 
                        className="p-3.5 pr-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {!isDone && (
                            isWorking ? (
                              <button
                                onClick={() => pauseTask(task.id)}
                                className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white"
                                title="Pause Timer"
                              >
                                <Pause className="w-3 h-3" />
                              </button>
                            ) : (
                              <button
                                onClick={() => startTask(task.id)}
                                className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                                title="Start Timer"
                              >
                                <Play className="w-3 h-3" />
                              </button>
                            )
                          )}

                          {!isDone ? (
                            <button
                              onClick={() => completeTask(task.id)}
                              className="p-1.5 rounded-lg border border-theme-border hover:bg-emerald-50 hover:text-emerald-600 text-theme-muted transition-colors"
                              title="Mark Complete"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          ) : (
                            <button
                              onClick={() => updateTask({ ...task, status: 'Pending' })}
                              className="p-1.5 rounded-lg text-emerald-500 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100"
                              title="Reopen"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onOpenTaskModal(task)}
                            className="p-1.5 rounded-lg border border-theme-border hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>

                          <button
                            onClick={() => requestDeleteTask(task, task.taskDate)}
                            className="p-1.5 rounded-lg border border-theme-border hover:bg-rose-50 hover:text-rose-600 text-theme-muted transition-colors"
                            title="Delete Task / Occurrence"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
