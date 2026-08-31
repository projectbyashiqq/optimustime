import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Task, 
  PriorityLevel, 
  TaskStatus, 
  RecurrenceType, 
  TaskLink, 
  SubTask 
} from '../types';
import { 
  generateProjectCode, 
  addMinutesToTime, 
  diffTimeInMinutes, 
  toISODateString, 
  getDayOfWeekFromDate,
  SHORT_DAYS
} from '../utils/timeUtils';
import { ConflictModal } from './ConflictModal';
import { TimePicker } from './TimePicker';
import { 
  X, 
  Clock, 
  Calendar, 
  Tag, 
  Folder, 
  Layers, 
  Link as LinkIcon, 
  Plus, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  CornerDownRight
} from 'lucide-react';

interface TaskModalProps {
  taskToEdit?: Task | null;
  initialDate?: string;
  initialStartTime?: string;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  taskToEdit,
  initialDate,
  initialStartTime,
  onClose
}) => {
  const { 
    categories, 
    prioritySettings, 
    addTask, 
    updateTask, 
    detectConflicts, 
    cascadeShiftDownstream,
    linkSimultaneousTasks 
  } = useApp();

  const isEditing = !!taskToEdit;

  // Form State
  const [projectCode, setProjectCode] = useState(taskToEdit?.projectCode || generateProjectCode());
  const [title, setTitle] = useState(taskToEdit?.title || '');
  const [description, setDescription] = useState(taskToEdit?.description || '');
  const [taskDate, setTaskDate] = useState(taskToEdit?.taskDate || initialDate || toISODateString(new Date()));
  const [priority, setPriority] = useState<PriorityLevel>(taskToEdit?.priority || 'P1');
  const [category, setCategory] = useState(taskToEdit?.category || categories[0]?.name || 'VRTX');
  const [subCategory, setSubCategory] = useState(taskToEdit?.subCategory || '');
  
  const defaultMin = prioritySettings[taskToEdit?.priority || 'P1']?.defaultMinutes ?? 90;
  const [appointedMinutes, setAppointedMinutes] = useState<number>(taskToEdit?.appointedMinutes ?? defaultMin);
  
  const [startTime, setStartTime] = useState<string>(taskToEdit?.startTime || initialStartTime || '09:00 AM');
  const [endTime, setEndTime] = useState<string>(
    taskToEdit?.endTime || addMinutesToTime(taskToEdit?.startTime || initialStartTime || '09:00 AM', taskToEdit?.appointedMinutes ?? defaultMin)
  );
  
  const [status, setStatus] = useState<TaskStatus>(taskToEdit?.status || 'Pending');
  const [recurrence, setRecurrence] = useState<RecurrenceType>(taskToEdit?.recurrence || 'None');
  const [selectedDays, setSelectedDays] = useState<string[]>(taskToEdit?.selectedDays || []);
  const [notes, setNotes] = useState(taskToEdit?.notes || '');
  const [links, setLinks] = useState<TaskLink[]>(taskToEdit?.links || []);
  const [subtasks, setSubtasks] = useState<SubTask[]>(taskToEdit?.subtasks || []);
  
  // Link Input fields
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  
  // Subtask Input fields
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  
  // Conflict state
  const [conflictingTasks, setConflictingTasks] = useState<Task[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Auto calculate day of week
  const dayOfWeek = getDayOfWeekFromDate(taskDate);

  // Update subcategories when category changes
  const currentCategoryObj = categories.find(c => c.name === category);
  useEffect(() => {
    if (currentCategoryObj && currentCategoryObj.subCategories.length > 0 && !subCategory) {
      setSubCategory(currentCategoryObj.subCategories[0]);
    }
  }, [category, currentCategoryObj, subCategory]);

  // When priority changes, update appointed time if user hasn't explicitly customized
  const handlePriorityChange = (newPriority: PriorityLevel) => {
    setPriority(newPriority);
    const newMinutes = prioritySettings[newPriority]?.defaultMinutes ?? 60;
    setAppointedMinutes(newMinutes);
    setEndTime(addMinutesToTime(startTime, newMinutes));
  };

  // When start time changes, recompute end time
  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    setEndTime(addMinutesToTime(newStart, appointedMinutes));
  };

  // When appointed minutes changes, recompute end time
  const handleMinutesChange = (newMins: number) => {
    setAppointedMinutes(newMins);
    setEndTime(addMinutesToTime(startTime, newMins));
  };

  // Add Link
  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return;
    const newLink: TaskLink = {
      id: `lnk-${Date.now()}`,
      title: newLinkTitle.trim() || newLinkUrl.trim(),
      url: newLinkUrl.trim(),
      type: 'url'
    };
    setLinks([...links, newLink]);
    setNewLinkTitle('');
    setNewLinkUrl('');
  };

  // Remove Link
  const handleRemoveLink = (linkId: string) => {
    setLinks(links.filter(l => l.id !== linkId));
  };

  // Add Subtask
  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSub: SubTask = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      isCompleted: false,
      depthLevel: 1,
      subtasks: []
    };
    setSubtasks([...subtasks, newSub]);
    setNewSubtaskTitle('');
  };

  // Toggle Day Selection for Recurrence
  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // Submission with conflict detection check
  const handleSave = (forceNoConflictCheck = false) => {
    if (!title.trim()) return;

    if (!forceNoConflictCheck) {
      const conflicts = detectConflicts(taskDate, startTime, endTime, taskToEdit?.id);
      if (conflicts.length > 0) {
        setConflictingTasks(conflicts);
        setShowConflictModal(true);
        return;
      }
    }

    const payload = {
      projectCode: projectCode.trim() || generateProjectCode(),
      title: title.trim(),
      description: description.trim(),
      taskDate,
      dayOfWeek,
      priority,
      category,
      subCategory,
      appointedMinutes,
      startTime,
      endTime,
      status,
      bufferMinutes: 15,
      recurrence,
      selectedDays: recurrence === 'Selected Days' ? selectedDays : [],
      notes,
      links,
      subtasks,
      isProject: subtasks.length >= 4 || taskToEdit?.isProject,
      escalationReason: subtasks.length >= 4 ? 'Auto-Escalated to Project: Contains multiple subtasks' : taskToEdit?.escalationReason
    };

    if (isEditing && taskToEdit) {
      updateTask({
        ...taskToEdit,
        ...payload
      });
    } else {
      addTask(payload);
    }

    onClose();
  };

  // Resolve conflict via Auto-Shift (Places after work time + break time)
  const handleResolveWithAutoShift = (newCalculatedStartTime: string) => {
    const newEnd = addMinutesToTime(newCalculatedStartTime, appointedMinutes);
    // Cascade shift any downstream tasks starting at or after the new start time forward
    cascadeShiftDownstream(taskDate, newCalculatedStartTime, appointedMinutes + 15, taskToEdit?.id);
    setShowConflictModal(false);

    const payload = {
      projectCode: projectCode.trim() || generateProjectCode(),
      title: title.trim(),
      description: description.trim(),
      taskDate,
      dayOfWeek,
      priority,
      category,
      subCategory,
      appointedMinutes,
      startTime: newCalculatedStartTime,
      endTime: newEnd,
      status,
      bufferMinutes: 15,
      recurrence,
      selectedDays: recurrence === 'Selected Days' ? selectedDays : [],
      notes,
      links,
      subtasks,
      isProject: subtasks.length >= 4 || taskToEdit?.isProject,
      escalationReason: subtasks.length >= 4 ? 'Auto-Escalated to Project: Contains multiple subtasks' : taskToEdit?.escalationReason
    };

    if (isEditing && taskToEdit) {
      updateTask({
        ...taskToEdit,
        ...payload
      });
    } else {
      addTask(payload);
    }

    onClose();
  };

  // Resolve conflict via Simultaneous
  const handleResolveWithSimultaneous = () => {
    setShowConflictModal(false);
    const saved = handleSave(true);
    if (conflictingTasks.length > 0 && taskToEdit) {
      linkSimultaneousTasks(taskToEdit.id, conflictingTasks[0].id);
    }
  };

  const priorityMeta = prioritySettings[priority];

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
        <div className="bg-theme-card border border-theme-border rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-8 animate-slide-up">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-theme-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-theme-text">
                  {isEditing ? 'Edit Task Matrix' : 'Create New Scheduled Task'}
                </h2>
                <div className="flex items-center gap-2 text-xs text-theme-muted">
                  <span>Code:</span>
                  <input
                    type="text"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-transparent border-b border-dashed border-blue-400 focus:outline-none text-xs w-32"
                    title="Unique Project Code (Custom Editable)"
                  />
                  <span>• {dayOfWeek}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-theme-card-hover text-theme-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            
            {/* Title & Description */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-theme-text uppercase tracking-wider">
                Task Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. OptimusLAB Unified Architecture Audit..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-theme-text uppercase tracking-wider">
                Description & Custom Writing
              </label>
              <textarea
                rows={2}
                placeholder="Detailed objectives, expected outcomes, or context..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Priority Level Matrix (P1-P5) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-theme-text uppercase tracking-wider">
                  Priority Level Protocol (P1-P5)
                </label>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                  Auto-Duration: {priorityMeta?.defaultMinutes ?? 0}m
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {(['P1', 'P2', 'P3', 'P4', 'P5'] as PriorityLevel[]).map((p) => {
                  const meta = prioritySettings[p];
                  const isSelected = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePriorityChange(p)}
                      className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                        isSelected
                          ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20'
                          : 'border-theme-border hover:bg-theme-card-hover'
                      }`}
                      style={{
                        backgroundColor: isSelected ? meta.bgColor : undefined,
                        borderColor: isSelected ? meta.color : undefined
                      }}
                    >
                      <span className="text-xs font-black" style={{ color: meta.color }}>
                        {p}
                      </span>
                      <span className="text-[10px] font-bold text-theme-text truncate w-full">
                        {meta.label}
                      </span>
                      <span className="text-[9px] text-theme-muted font-mono">
                        {meta.defaultMinutes}m
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date & Time Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-theme-card-hover border border-theme-border">
              <div>
                <label className="text-[11px] font-bold text-theme-text flex items-center gap-1 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  Task Date
                </label>
                <input
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-theme-card border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <TimePicker
                  label="Start Time (12h Clock)"
                  value={startTime}
                  onChange={handleStartTimeChange}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-theme-text flex items-center justify-between mb-1">
                  <span>Appointed (Min)</span>
                  <span className="text-[10px] text-theme-muted">End: {endTime}</span>
                </label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={appointedMinutes}
                  onChange={(e) => handleMinutesChange(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-theme-card border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                />
              </div>
            </div>

            {/* Category & SubCategory */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-theme-text flex items-center gap-1 mb-1.5">
                  <Folder className="w-3.5 h-3.5 text-blue-500" />
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    const catObj = categories.find(c => c.name === e.target.value);
                    setSubCategory(catObj?.subCategories[0] || '');
                  }}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-theme-text flex items-center gap-1 mb-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  SubCategory
                </label>
                <select
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {currentCategoryObj?.subCategories.map((sub, idx) => (
                    <option key={idx} value={sub}>
                      {sub}
                    </option>
                  ))}
                  <option value="">(None)</option>
                </select>
              </div>
            </div>

            {/* Recurrence & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-theme-text mb-1.5 block">
                  Event Recurrence
                </label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="None">None (One-time)</option>
                  <option value="Daily">Daily</option>
                  <option value="Selected Days">Selected Days</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-theme-text mb-1.5 block">
                  Status State
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="Pending">Pending</option>
                  <option value="Working">Working</option>
                  <option value="Done">Done</option>
                  <option value="Hold">Hold</option>
                  <option value="Terminated">Terminated</option>
                  <option value="Reschedule">Reschedule</option>
                  <option value="Incomplete">Incomplete</option>
                </select>
              </div>
            </div>

            {/* Selected Days Selector */}
            {recurrence === 'Selected Days' && (
              <div className="p-3 rounded-xl bg-theme-card-hover border border-theme-border space-y-1.5 animate-fade-in">
                <label className="text-xs font-bold text-theme-text">
                  Choose Days of Week:
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {SHORT_DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedDays.includes(d)
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-theme-card text-theme-muted hover:bg-theme-border'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-tasks & Multi-level Escalation */}
            <div className="space-y-2 pt-1 border-t border-theme-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-500" />
                  Sub-tasks & Multi-Level Project Escalation
                </label>
                {subtasks.length >= 4 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Auto-Escalating to Project
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add sub-task..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  className="px-3 py-1.5 bg-theme-card-hover hover:bg-theme-border border border-theme-border rounded-lg text-xs font-bold text-theme-text flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {subtasks.length > 0 && (
                <div className="space-y-1.5 mt-2 bg-theme-card-hover p-2.5 rounded-xl border border-theme-border max-h-32 overflow-y-auto">
                  {subtasks.map((st, idx) => (
                    <div key={st.id || idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-theme-card border border-theme-border">
                      <span className="text-theme-text font-medium flex items-center gap-1.5">
                        <CornerDownRight className="w-3 h-3 text-purple-500" />
                        {st.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSubtasks(subtasks.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unified Links & Docs */}
            <div className="space-y-2 pt-1 border-t border-theme-border">
              <label className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
                Unified Links & Document IDs
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Doc / URL Title..."
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  className="w-1/3 text-xs px-3 py-1.5 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none"
                />
                <input
                  type="url"
                  placeholder="https://..."
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="px-3 py-1.5 bg-theme-card-hover hover:bg-theme-border border border-theme-border rounded-lg text-xs font-bold text-theme-text"
                >
                  Attach
                </button>
              </div>

              {links.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {links.map((lnk) => (
                    <span key={lnk.id} className="inline-flex items-center gap-1.5 text-xs bg-theme-card border border-theme-border px-2.5 py-1 rounded-lg text-theme-text">
                      <LinkIcon className="w-3 h-3 text-blue-500" />
                      <a href={lnk.url} target="_blank" rel="noreferrer" className="hover:underline font-medium text-blue-600 dark:text-blue-400">
                        {lnk.title}
                      </a>
                      <button type="button" onClick={() => handleRemoveLink(lnk.id)} className="text-red-500 hover:text-red-700 ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Notes Management */}
            <div className="space-y-1.5 pt-1 border-t border-theme-border">
              <label className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                Notes & Knowledge Base Link
              </label>
              <textarea
                rows={2}
                placeholder="Key insights, technical findings or checklists..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between border-t border-theme-border pt-4">
            <div className="text-xs text-theme-muted">
              Auto-Buffer: <strong className="text-theme-text">15m</strong> (5m on delay)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-theme-muted hover:text-theme-text rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/25 transition-all transform active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isEditing ? 'Save Changes' : 'Schedule Task'}</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Conflict Resolution Modal */}
      {showConflictModal && (
        <ConflictModal
          conflictingTasks={conflictingTasks}
          pendingTaskTitle={title || 'New Task'}
          appointedMinutes={appointedMinutes}
          onAutoShift={handleResolveWithAutoShift}
          onSimultaneous={handleResolveWithSimultaneous}
          onCancel={() => setShowConflictModal(false)}
        />
      )}
    </>
  );
};
