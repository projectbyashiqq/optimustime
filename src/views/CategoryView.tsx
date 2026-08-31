import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task, Category } from '../types';
import { 
  FolderKanban, 
  Tag, 
  CheckCircle2, 
  Clock, 
  Play, 
  Plus, 
  Layers, 
  Sparkles,
  Zap,
  User,
  Cpu,
  Globe,
  Briefcase,
  BookOpen,
  Bell,
  FileText,
  HelpCircle
} from 'lucide-react';

interface CategoryViewProps {
  onOpenTaskModal: (task?: Task, date?: string, startTime?: string) => void;
}

const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'Zap': return Zap;
    case 'User': return User;
    case 'Cpu': return Cpu;
    case 'Globe': return Globe;
    case 'Briefcase': return Briefcase;
    case 'BookOpen': return BookOpen;
    case 'Bell': return Bell;
    case 'FileText': return FileText;
    default: return FolderKanban;
  }
};

export const CategoryView: React.FC<CategoryViewProps> = ({ onOpenTaskModal }) => {
  const { categories, tasks, prioritySettings, startTask, completeTask, activeTaskId } = useApp();
  const [selectedCatId, setSelectedCatId] = useState<string>(categories[0]?.id || '');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('ALL');

  const currentCategory = categories.find(c => c.id === selectedCatId) || categories[0];
  
  if (!currentCategory) {
    return <div className="p-8 text-center">No categories found.</div>;
  }

  const categoryTasks = tasks.filter(t => {
    if (t.category !== currentCategory.name) return false;
    if (selectedSubCat !== 'ALL' && t.subCategory !== selectedSubCat) return false;
    return true;
  });

  const completedCount = categoryTasks.filter(t => t.status === 'Done').length;
  const totalMinutes = categoryTasks.reduce((acc, t) => acc + t.appointedMinutes, 0);
  const IconComponent = getCategoryIcon(currentCategory.iconName);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {categories.map((cat) => {
          const Icon = getCategoryIcon(cat.iconName);
          const isSelected = cat.id === selectedCatId;
          const count = tasks.filter(t => t.category === cat.name).length;

          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCatId(cat.id);
                setSelectedSubCat('ALL');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-105'
                  : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                isSelected ? 'bg-white/20 text-white' : 'bg-theme-card-hover text-theme-muted'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Category Header Card */}
      <div className="glass-panel p-6 rounded-2xl border border-theme-border relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          
          <div className="flex items-center gap-4">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg"
              style={{ backgroundColor: currentCategory.color }}
            >
              <IconComponent className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-theme-text tracking-tight">
                  {currentCategory.name}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-theme-card-hover border border-theme-border text-theme-muted font-bold">
                  {categoryTasks.length} Tasks
                </span>
              </div>
              <p className="text-xs text-theme-muted mt-0.5">
                Total Dedicated Allocation: <strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong> • {completedCount} Done
              </p>
            </div>
          </div>

          <button
            onClick={() => onOpenTaskModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule in {currentCategory.name}</span>
          </button>

        </div>
      </div>

      {/* Subcategory Filter Tabs */}
      {currentCategory.subCategories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-bold text-theme-muted uppercase tracking-wider mr-1">
            Sub-Entities:
          </span>
          <button
            onClick={() => setSelectedSubCat('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              selectedSubCat === 'ALL'
                ? 'bg-theme-text text-theme-bg shadow-sm'
                : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
            }`}
          >
            All Sub-entities
          </button>
          {currentCategory.subCategories.map((sub, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedSubCat(sub)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                selectedSubCat === sub
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categoryTasks.length === 0 ? (
          <div className="col-span-full glass-panel rounded-2xl p-12 text-center text-xs text-theme-muted">
            No tasks registered in this category/subcategory yet.
          </div>
        ) : (
          categoryTasks.map((task) => {
            const priorityMeta = prioritySettings[task.priority];
            const isDone = task.status === 'Done';
            const isWorking = task.status === 'Working';

            return (
              <div
                key={task.id}
                className="p-4 rounded-2xl bg-theme-card border border-theme-border hover:shadow-md transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded font-black text-xs"
                      style={{ backgroundColor: priorityMeta?.bgColor, color: priorityMeta?.color }}
                    >
                      {task.priority}
                    </span>
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {task.projectCode}
                    </span>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isDone ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                    isWorking ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 animate-pulse' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {task.status}
                  </span>
                </div>

                <div>
                  <h4 className={`text-base font-bold text-theme-text font-openSans leading-snug ${isDone ? 'line-through text-theme-muted opacity-75' : ''}`}>
                    {task.title}
                  </h4>
                  {task.description && (
                    <p className="text-xs text-theme-muted line-clamp-2 mt-1">
                      {task.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-theme-border text-xs">
                  <span className="font-mono text-theme-muted font-semibold">
                    {task.taskDate} • {task.startTime} ({task.appointedMinutes}m)
                  </span>

                  <div className="flex items-center gap-2">
                    {!isDone && !isWorking && (
                      <button
                        onClick={() => startTask(task.id)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1 shadow-sm"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Start</span>
                      </button>
                    )}
                    {isWorking && (
                      <button
                        onClick={() => completeTask(task.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Finish</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
