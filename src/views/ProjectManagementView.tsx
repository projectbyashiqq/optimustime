import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task, SubTask } from '../types';
import { 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  FolderGit2, 
  Plus, 
  Check, 
  CornerDownRight, 
  Flame, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  FileCode,
  Tag
} from 'lucide-react';

export const ProjectManagementView: React.FC = () => {
  const { tasks, addSubTask, toggleSubTask, escalateToProject, completeTask, startTask } = useApp();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [newSubtaskInput, setNewSubtaskInput] = useState<{ [taskId: string]: string }>({});

  // Filter tasks that are escalated to projects or have subtasks
  const projectTasks = tasks.filter(t => t.isProject || t.subtasks.length > 0);

  const activeProject = projectTasks.find(p => p.id === selectedProjectId) || projectTasks[0];

  const handleAddSub = (taskId: string) => {
    const text = newSubtaskInput[taskId];
    if (!text || !text.trim()) return;
    addSubTask(taskId, text.trim());
    setNewSubtaskInput({ ...newSubtaskInput, [taskId]: '' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-theme-border relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/25">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-theme-text tracking-tight">
                  Project Escalation & Hierarchy Hub
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">
                  {projectTasks.length} Active Projects
                </span>
              </div>
              <p className="text-xs text-theme-muted mt-0.5">
                Multi-level task breakdown engine with auto project code allocation and hierarchy analytics.
              </p>
            </div>
          </div>
        </div>
      </div>

      {projectTasks.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-500 mx-auto flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-theme-text">No Multi-Level Projects Yet</h4>
          <p className="text-xs text-theme-muted max-w-sm mx-auto">
            When you add multiple sub-tasks or complex scopes to any task, the engine automatically escalates it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Projects Sidebar List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider">
              Escalated Projects
            </h3>
            {projectTasks.map((proj) => {
              const isSelected = activeProject?.id === proj.id;
              const completedSubtasks = proj.subtasks.filter(s => s.isCompleted).length;
              const totalSub = proj.subtasks.length;
              const percent = totalSub > 0 ? Math.round((completedSubtasks / totalSub) * 100) : 0;

              return (
                <div
                  key={proj.id}
                  onClick={() => setSelectedProjectId(proj.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-400 dark:border-purple-800 shadow-md ring-1 ring-purple-500/20'
                      : 'bg-theme-card border-theme-border hover:bg-theme-card-hover'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                      {proj.projectCode}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-theme-card-hover border border-theme-border text-theme-muted">
                      {proj.category}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-theme-text mt-1 line-clamp-1">
                    {proj.title}
                  </h4>

                  {/* Micro Progress */}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[11px] text-theme-muted font-medium">
                      <span>Sub-task Progress</span>
                      <span>{completedSubtasks}/{totalSub} ({percent}%)</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-purple-600 h-full rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Project Deep Dive & Hierarchy Tree */}
          {activeProject && (
            <div className="lg:col-span-2 space-y-5">
              <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4">
                
                <div className="flex items-start justify-between gap-3 border-b border-theme-border pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                        {activeProject.projectCode}
                      </span>
                      <span className="text-xs text-theme-muted font-semibold">
                        {activeProject.category} {activeProject.subCategory ? `• ${activeProject.subCategory}` : ''}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-theme-text mt-2">
                      {activeProject.title}
                    </h3>
                    {activeProject.description && (
                      <p className="text-xs text-theme-muted mt-1 leading-relaxed">
                        {activeProject.description}
                      </p>
                    )}
                  </div>

                  <span className={`text-xs font-bold px-3 py-1 rounded-xl ${
                    activeProject.status === 'Done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950' :
                    activeProject.status === 'Working' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 animate-pulse' :
                    'bg-purple-100 text-purple-700 dark:bg-purple-950'
                  }`}>
                    {activeProject.status}
                  </span>
                </div>

                {/* Subtask Hierarchy Tree */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-500" />
                      Multi-Level Sub-Task Breakdown
                    </h4>
                    <span className="text-[11px] text-theme-muted">
                      Check off completed modules
                    </span>
                  </div>

                  {/* Add subtask bar */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add high-level deliverable or subtask..."
                      value={newSubtaskInput[activeProject.id] || ''}
                      onChange={(e) => setNewSubtaskInput({ ...newSubtaskInput, [activeProject.id]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddSub(activeProject.id); }}
                      className="flex-1 text-xs px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <button
                      onClick={() => handleAddSub(activeProject.id)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                    >
                      Add Module
                    </button>
                  </div>

                  {/* Tree List */}
                  <div className="space-y-2 pt-2">
                    {activeProject.subtasks.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => toggleSubTask(activeProject.id, st.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          st.isCompleted
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 opacity-75'
                            : 'bg-theme-card-hover border-theme-border hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                            st.isCompleted
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-theme-border bg-theme-card'
                          }`}>
                            {st.isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className={`text-xs font-semibold ${st.isCompleted ? 'line-through text-theme-muted' : 'text-theme-text'}`}>
                            {st.title}
                          </span>
                        </div>

                        <span className="text-[10px] font-mono text-theme-muted bg-theme-card px-2 py-0.5 rounded border border-theme-border">
                          Level {st.depthLevel}
                        </span>
                      </div>
                    ))}
                  </div>

                </div>

                {/* Execution Logs & Analytics for this project */}
                <div className="pt-4 border-t border-theme-border space-y-2">
                  <h4 className="text-xs font-bold text-theme-muted uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                    Project Execution Timeline & Logs
                  </h4>

                  {activeProject.executionLogs.length === 0 ? (
                    <p className="text-xs text-theme-muted italic">
                      No live timer sessions recorded for this project yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {activeProject.executionLogs.map((log, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-theme-card-hover border border-theme-border">
                          <span className="font-mono text-theme-muted">
                            Started: {new Date(log.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="font-bold text-theme-text">
                            {log.actualDurationMinutes} min duration {log.isLateFinish ? '(Delayed +5m Buffer)' : '(Normal +15m Buffer)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
