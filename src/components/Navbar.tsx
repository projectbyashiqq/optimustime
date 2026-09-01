import React from 'react';
import { useApp } from '../context/AppContext';
import { ActiveTab } from '../types';
import { 
  LayoutDashboard, 
  ListTodo, 
  FolderKanban, 
  Layers, 
  BarChart3, 
  BookOpen, 
  FileText,
  Bell, 
  Settings2,
  Flame,
  AlertCircle
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, tasks, reminders, knowledge } = useApp();

  const workingCount = tasks.filter(t => t.status === 'Working').length;
  const incompleteCount = tasks.filter(t => t.status === 'Incomplete').length;
  const pendingRemindersCount = reminders.filter(r => !r.isDismissed).length;
  const escalatedProjectsCount = tasks.filter(t => t.isProject).length;

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number; badgeColor?: string }[] = [
    { id: 'dashboard', label: 'Daily Dashboard', icon: LayoutDashboard, badge: workingCount > 0 ? workingCount : undefined, badgeColor: 'bg-emerald-500 text-white animate-pulse' },
    { id: 'all-tasks', label: 'All Tasks', icon: ListTodo, badge: incompleteCount > 0 ? incompleteCount : undefined, badgeColor: 'bg-red-500 text-white' },
    { id: 'categories', label: 'Categories Hub', icon: FolderKanban },
    { id: 'projects', label: 'Projects & Hierarchy', icon: Layers, badge: escalatedProjectsCount > 0 ? escalatedProjectsCount : undefined, badgeColor: 'bg-purple-500 text-white' },
    { id: 'analytics', label: 'Analytics & Accuracy', icon: BarChart3 },
    { id: 'knowledge', label: 'Notes & Knowledge', icon: FileText, badge: knowledge.length > 0 ? knowledge.length : undefined, badgeColor: 'bg-indigo-500 text-white' },
    { id: 'reminders', label: 'Reminder Center', icon: Bell, badge: pendingRemindersCount > 0 ? pendingRemindersCount : undefined, badgeColor: 'bg-amber-500 text-white' },
    { id: 'settings', label: 'Admin Settings', icon: Settings2 },
  ];

  return (
    <nav className="border-b border-theme-border bg-theme-card/60 backdrop-blur-md sticky top-[61px] z-20 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-1 overflow-x-auto py-2 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-theme-muted hover:text-theme-text hover:bg-theme-card-hover'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-theme-muted'}`} />
                <span>{item.label}</span>
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
