import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task, TaskStatus } from '../types';
import { playNotificationChime, toISODateString, getDayOfWeekFromDate, generateProjectCode } from '../utils/timeUtils';
import { 
  Bell, 
  Plus, 
  AlertCircle, 
  Volume2, 
  CheckCircle2, 
  Trash2, 
  Calendar, 
  Sparkles, 
  Flame,
  Clock,
  RotateCcw,
  Tag,
  Check,
  Edit2
} from 'lucide-react';

interface ReminderCenterViewProps {
  onOpenTaskModal?: (task?: Task) => void;
}

export const ReminderCenterView: React.FC<ReminderCenterViewProps> = ({ onOpenTaskModal }) => {
  const { 
    tasks, 
    addTask, 
    updateTask, 
    completeTask, 
    deleteTask,
    searchQuery 
  } = useApp();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(toISODateString(new Date()));
  const [subCategory, setSubCategory] = useState('Bills & Deadlines');
  const [description, setDescription] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'COMPLETED' | 'ALL'>('ACTIVE');

  // Reminders are simply Tasks with category === 'Reminder'
  const reminderTasks = tasks.filter(t => {
    if (t.category !== 'Reminder') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchCode = t.projectCode?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCode) return false;
    }
    return true;
  });

  const activeReminders = reminderTasks.filter(t => t.status !== 'Done' && t.status !== 'Terminated');
  const completedReminders = reminderTasks.filter(t => t.status === 'Done');

  const displayedReminders = statusFilter === 'ACTIVE' 
    ? activeReminders 
    : statusFilter === 'COMPLETED' 
      ? completedReminders 
      : reminderTasks;

  const handleCreateReminderTask = () => {
    if (!title.trim()) return;

    // Full-Day P1 Reminder Task (without fixed time slot collision)
    addTask({
      projectCode: generateProjectCode(),
      title: title.trim(),
      description: description.trim(),
      taskDate: date,
      dayOfWeek: getDayOfWeekFromDate(date),
      priority: 'P1', // Automatically P1
      category: 'Reminder', // Category: Reminder
      subCategory,
      appointedMinutes: 0,
      startTime: 'All Day',
      endTime: 'All Day',
      isAllDay: true,
      status: 'Pending',
      bufferMinutes: 0,
      recurrence: 'Yearly',
      links: [],
      subtasks: []
    });

    playNotificationChime('alert');
    setTitle('');
    setDescription('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-theme-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/25">
            <Bell className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-theme-text tracking-tight font-display">
                Reminder Center
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-black flex items-center gap-1">
                <Flame className="w-3 h-3 text-red-500" />
                Auto P1 Full-Day Tasks
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                {activeReminders.length} Active
              </span>
            </div>
            <p className="text-xs text-theme-muted mt-0.5">
              Specialized View for <strong>Category: Reminder</strong> tasks. Full-day auto & P1 priority without fixed time slot conflicts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => playNotificationChime('alert')}
            className="flex items-center gap-1.5 px-3 py-2 bg-theme-card-hover border border-theme-border hover:bg-theme-border text-theme-text text-xs font-bold rounded-xl transition-colors"
            title="Test Audio Chime"
          >
            <Volume2 className="w-4 h-4 text-amber-500" />
            <span>Test Sound</span>
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New P1 Reminder</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setStatusFilter('ACTIVE')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            statusFilter === 'ACTIVE'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
          }`}
        >
          Active Reminders ({activeReminders.length})
        </button>
        <button
          onClick={() => setStatusFilter('COMPLETED')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            statusFilter === 'COMPLETED'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
          }`}
        >
          Completed ({completedReminders.length})
        </button>
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            statusFilter === 'ALL'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
          }`}
        >
          All ({reminderTasks.length})
        </button>
      </div>

      {/* Add Reminder Modal / Form */}
      {showAddForm && (
        <div className="glass-panel p-6 rounded-2xl border-2 border-amber-300 dark:border-amber-800 shadow-xl space-y-4 animate-slide-up bg-amber-50/20 dark:bg-amber-950/10">
          <div className="flex items-center justify-between border-b border-theme-border pb-3">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              Set Full-Day P1 Reminder Task
            </h3>
            <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-lg">
              Priority: P1 (Must-Do) • Full-Day (No Time Conflict)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-theme-text block mb-1">
                Reminder Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Renew cloud servers & client contract deadline..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-theme-card border border-theme-border text-theme-text font-openSans font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-theme-text block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Target Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-theme-text block mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-500" />
                SubCategory
              </label>
              <select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text font-bold"
              >
                <option value="Bills & Deadlines">Bills & Deadlines</option>
                <option value="Appointments">Appointments</option>
                <option value="Follow-ups">Follow-ups</option>
                <option value="Critical Milestones">Critical Milestones</option>
                <option value="Personal Attention">Personal Attention</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-theme-text block mb-1">
                Description / Context / Notes
              </label>
              <input
                type="text"
                placeholder="Additional instructions or external link..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs px-3.5 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-theme-border">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs font-semibold text-theme-muted hover:text-theme-text rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateReminderTask}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              Arm P1 Reminder Task
            </button>
          </div>
        </div>
      )}

      {/* Reminders List */}
      <div className="space-y-3">
        {displayedReminders.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center text-xs text-theme-muted">
            No reminder tasks found in this view.
          </div>
        ) : (
          displayedReminders.map(task => {
            const isDone = task.status === 'Done';

            return (
              <div
                key={task.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isDone
                    ? 'bg-theme-card/60 border-theme-border opacity-75'
                    : 'bg-theme-card border-amber-300/60 dark:border-amber-800/60 hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2.5 rounded-xl ${
                    isDone 
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300' 
                      : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300 shadow-sm'
                  }`}>
                    <Bell className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* P1 Badge */}
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-red-500 text-white shadow-xs">
                        P1 MUST-DO
                      </span>

                      {/* Project Code */}
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {task.projectCode}
                      </span>

                      {/* Date & Full-day */}
                      <span className="font-mono text-xs font-bold text-theme-text bg-theme-card-hover px-2 py-0.5 rounded border border-theme-border flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-theme-muted" />
                        {task.taskDate} • Full-Day
                      </span>

                      {task.subCategory && (
                        <span className="text-[11px] font-semibold text-theme-muted">
                          {task.subCategory}
                        </span>
                      )}

                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm ${
                        isDone ? 'bg-emerald-600 text-white' :
                        task.status === 'Terminated' ? 'bg-red-600 text-white' :
                        task.status === 'Hold' ? 'bg-amber-500 text-white' :
                        task.status === 'Incomplete' ? 'bg-red-600 text-white' :
                        'bg-blue-600 text-white'
                      }`}>
                        {task.status}
                      </span>
                    </div>

                    <h4 className={`text-base font-bold text-theme-text font-openSans leading-snug ${isDone ? 'line-through text-theme-muted' : ''}`}>
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="text-xs text-theme-muted">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-theme-border">
                  {isDone ? (
                    <button
                      onClick={() => updateTask({ ...task, status: 'Pending' })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-theme-card-hover hover:bg-theme-border text-theme-text text-xs font-bold transition-colors"
                      title="Reopen Reminder"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reopen</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => completeTask(task.id)}
                      className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Done</span>
                    </button>
                  )}

                  {onOpenTaskModal && (
                    <button
                      onClick={() => onOpenTaskModal(task)}
                      className="p-1.5 rounded-lg hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
                      title="Edit in Task Modal"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors"
                    title="Delete Reminder Task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
