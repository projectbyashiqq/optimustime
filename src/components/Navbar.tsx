import React from 'react';
import { useApp } from '../context/AppContext';
import { ActiveTab } from '../types';
import { 
  LayoutDashboard, 
  Clock,
  ListTodo, 
  Layers,
  FolderKanban, 
  BarChart3, 
  StickyNote,
  Settings2
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, tasks, bufferNotes, planProjects } = useApp();

  const workingCount = tasks.filter(t => t.status === 'Working').length;
  const incompleteCount = tasks.filter(t => t.status === 'Incomplete').length;
  const activeNotesCount = tasks.filter(t => (t.category === 'Notes' || t.category === 'Reminder' || t.appointedMinutes === 0 || t.isAllDay) && t.status !== 'Done' && t.status !== 'Terminated').length;

  const navItems: { 
    id: ActiveTab; 
    label: string; 
    shortLabel?: string;
    icon: React.ComponentType<{ className?: string }>; 
    badge?: number | string; 
    badgeColor?: string 
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: workingCount > 0 ? workingCount : undefined, badgeColor: 'bg-emerald-500 text-white animate-pulse' },
    { id: 'time-tracker', label: '24H Tracker', shortLabel: '24H Diary', icon: Clock, badge: bufferNotes.length > 0 ? `${bufferNotes.length}` : undefined, badgeColor: 'bg-amber-500 text-white font-mono' },
    { id: 'all-tasks', label: 'All Tasks', icon: ListTodo, badge: incompleteCount > 0 ? incompleteCount : undefined, badgeColor: 'bg-red-500 text-white' },
    { id: 'plans-projects', label: 'Plans & Projects', shortLabel: 'Plans', icon: Layers, badge: planProjects.length > 0 ? planProjects.length : undefined, badgeColor: 'bg-indigo-600 text-white font-mono' },
    { id: 'categories', label: 'Categories', icon: FolderKanban },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'notes', label: 'Notes', icon: StickyNote, badge: activeNotesCount > 0 ? activeNotesCount : undefined, badgeColor: 'bg-amber-500 text-white' },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ];

  return (
    <nav className="border-b border-theme-border/60 bg-theme-card/75 backdrop-blur-xl saturate-180 sticky top-[57px] z-20 transition-colors duration-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 relative">
        <div className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto py-1.5 no-scrollbar scroll-smooth">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0 touch-manipulation cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-white/20'
                    : 'text-theme-muted hover:text-theme-text hover:bg-theme-card-hover/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-theme-muted'}`} />
                <span className="tracking-tight">
                  {item.shortLabel ? (
                    <>
                      <span className="inline lg:hidden">{item.shortLabel}</span>
                      <span className="hidden lg:inline">{item.label}</span>
                    </>
                  ) : (
                    item.label
                  )}
                </span>
                {item.badge !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${item.badgeColor || 'bg-blue-500 text-white'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
