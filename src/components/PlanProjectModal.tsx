import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PlanProjectFolder, PlanProjectType, PlanProjectStatus } from '../types';
import { toISODateString } from '../utils/timeUtils';
import { 
  X, 
  Target, 
  Briefcase, 
  Calendar, 
  Clock, 
  Tag, 
  Folder, 
  CheckCircle2, 
  AlertTriangle,
  Sparkles,
  Layers,
  FileText,
  Palette
} from 'lucide-react';

interface PlanProjectModalProps {
  folderToEdit?: PlanProjectFolder | null;
  initialType?: PlanProjectType;
  onClose: () => void;
}

const COLOR_PRESETS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#6366F1'  // Indigo
];

export const PlanProjectModal: React.FC<PlanProjectModalProps> = ({
  folderToEdit,
  initialType = 'plan',
  onClose
}) => {
  const { categories, addPlanProject, updatePlanProject } = useApp();
  const isEditing = !!folderToEdit;

  const todayStr = toISODateString(new Date());
  const defaultDeadline = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (initialType === 'plan' ? 30 : 14));
    return toISODateString(d);
  })();

  const [type, setType] = useState<PlanProjectType>(folderToEdit?.type || initialType);
  const [title, setTitle] = useState(folderToEdit?.title || '');
  const [code, setCode] = useState(
    folderToEdit?.code || `${initialType === 'plan' ? 'PLN' : 'PRJ'}-${Date.now().toString().slice(-4)}`
  );
  const [description, setDescription] = useState(folderToEdit?.description || '');
  const [category, setCategory] = useState(folderToEdit?.category || categories[0]?.name || 'VRTX');
  const [startDate, setStartDate] = useState(folderToEdit?.startDate || todayStr);
  const [endDate, setEndDate] = useState(folderToEdit?.endDate || defaultDeadline);
  const [targetHours, setTargetHours] = useState<number>(
    folderToEdit?.targetMinutes ? Math.round(folderToEdit.targetMinutes / 60) : 30
  );
  const [color, setColor] = useState(folderToEdit?.color || (initialType === 'plan' ? '#3B82F6' : '#8B5CF6'));
  const [iconName, setIconName] = useState(folderToEdit?.iconName || (initialType === 'plan' ? 'Target' : 'Briefcase'));
  const [status, setStatus] = useState<PlanProjectStatus>(folderToEdit?.status || 'active');
  const [validationError, setValidationError] = useState<string | null>(null);

  // When type toggles on new folder creation, update default prefix code
  const handleTypeToggle = (newType: PlanProjectType) => {
    setType(newType);
    if (!isEditing) {
      setCode(`${newType === 'plan' ? 'PLN' : 'PRJ'}-${Date.now().toString().slice(-4)}`);
      setColor(newType === 'plan' ? '#3B82F6' : '#8B5CF6');
      setIconName(newType === 'plan' ? 'Target' : 'Briefcase');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setValidationError('Folder Title is mandatory. Please enter a name.');
      return;
    }
    if (!startDate || !endDate) {
      setValidationError('Start Date and Strict Deadline End Date are mandatory.');
      return;
    }
    if (endDate < startDate) {
      setValidationError('Deadline End Date cannot be earlier than Start Date.');
      return;
    }

    const payload = {
      type,
      title: title.trim(),
      code: code.trim().toUpperCase() || `${type === 'plan' ? 'PLN' : 'PRJ'}-${Date.now().toString().slice(-4)}`,
      description: description.trim(),
      color,
      iconName,
      category,
      startDate,
      endDate,
      targetMinutes: targetHours > 0 ? targetHours * 60 : undefined,
      status
    };

    if (isEditing && folderToEdit) {
      updatePlanProject({
        ...folderToEdit,
        ...payload
      });
    } else {
      addPlanProject(payload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-theme-card border border-theme-border rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-8 animate-slide-up">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme-border pb-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md"
              style={{ backgroundColor: color }}
            >
              {type === 'plan' ? <Target className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-theme-text font-display">
                {isEditing ? `Edit ${type === 'plan' ? 'Plan' : 'Project'} Folder` : `Create New ${type === 'plan' ? 'Plan' : 'Project'} Folder`}
              </h2>
              <p className="text-xs text-theme-muted">
                Group tasks under a deadline-driven container with live workload tracking.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-theme-card-hover text-theme-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          
          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3 rounded-xl bg-red-100/80 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Type Toggle: PLANS vs PROJECTS */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-theme-text uppercase tracking-wider block">
              Container Type
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-theme-card-hover rounded-2xl border border-theme-border">
              <button
                type="button"
                onClick={() => handleTypeToggle('plan')}
                className={`py-2 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
                  type === 'plan'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <Target className="w-4 h-4" />
                <span>PLAN (Goal / Habit / Roadmap)</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeToggle('project')}
                className={`py-2 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
                  type === 'project'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>PROJECT (Build / Deliverable)</span>
              </button>
            </div>
          </div>

          {/* Title & Custom Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-theme-text uppercase tracking-wider block">
                Folder Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder={type === 'plan' ? 'e.g. Q4 Health & Strategic Mastery' : 'e.g. Mobile App V2 Architecture'}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-theme-text uppercase tracking-wider block">
                Folder Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-theme-text uppercase tracking-wider block">
              Vision, Scope & Objectives
            </label>
            <textarea
              rows={2}
              placeholder="Key deliverables, purpose, metrics of success..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Timeline & Strict Deadline Settings */}
          <div className="p-3.5 rounded-2xl bg-theme-card-hover border border-theme-border space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-theme-text">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span>Strict Deadline & Time Budget Tracking</span>
              </span>
              <span className="text-[10px] text-theme-muted font-mono">
                Deadline Driven
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-red-500 uppercase block mb-1">
                  Strict Deadline (End Date) *
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 rounded-xl bg-theme-card border border-red-300 dark:border-red-800 text-theme-text font-mono font-bold focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">
                  Target Budget (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={targetHours}
                  onChange={(e) => setTargetHours(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full text-xs px-2.5 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Category, Status & Color Accents */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-theme-text mb-1 block">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-theme-text mb-1 block">
                Status State
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PlanProjectStatus)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active Track</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-theme-text mb-1 block">
                Folder Accent Color
              </label>
              <div className="flex items-center gap-1.5 pt-1">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      color === c ? 'scale-125 ring-2 ring-white shadow-md' : 'hover:scale-110 opacity-80'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-theme-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-theme-muted hover:text-theme-text rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-500/25 transition-all transform active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : `Create ${type === 'plan' ? 'Plan' : 'Project'}`}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
