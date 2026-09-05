import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { ActiveTab } from '../types';
import { isNoteCategory, isReminderCategory } from '../utils/timeUtils';
import { 
  LayoutDashboard, 
  Clock, 
  ListTodo, 
  Layers, 
  FolderKanban, 
  BarChart3, 
  StickyNote, 
  Settings2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, tasks, bufferNotes, planProjects } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const workingCount = tasks.filter(t => t.status === 'Working').length;
  const incompleteCount = tasks.filter(t => t.status === 'Incomplete').length;
  const activeNotesCount = tasks.filter(t => (isNoteCategory(t.category) || isReminderCategory(t.category) || t.appointedMinutes === 0 || t.isAllDay) && t.status !== 'Done' && t.status !== 'Terminated').length;

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

  // Check scroll boundary state for left/right mobile visual indicators
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

  // Smoothly center the active tab inside the mobile/tablet scrollable viewport
  useEffect(() => {
    if (activeBtnRef.current) {
      activeBtnRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [activeTab]);

  const scrollByAmount = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <nav className="border-b border-theme-border/60 bg-theme-card/85 dark:bg-slate-900/85 backdrop-blur-xl saturate-180 sticky top-[57px] z-20 transition-colors duration-200 shadow-2xs select-none">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 relative">
        
        {/* Left Scroll Indicator / Quick Jump (Mobile/Tablet) */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-1 pr-4 bg-gradient-to-r from-theme-card dark:from-slate-900 to-transparent pointer-events-none">
            <button
              onClick={() => scrollByAmount(-180)}
              className="pointer-events-auto p-1 rounded-full bg-theme-card-hover border border-theme-border/80 text-theme-muted hover:text-theme-text shadow-xs transition-all active:scale-90"
              title="Scroll left"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Scrollable Container with Smooth Touch Ergonomics */}
        <div 
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto py-1.5 no-scrollbar scroll-smooth touch-pan-x overscroll-x-contain"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                ref={isActive ? activeBtnRef : undefined}
                onClick={() => {
                  setActiveTab(item.id);
                }}
                className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0 touch-manipulation cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-white/20'
                    : 'text-theme-muted hover:text-theme-text hover:bg-theme-card-hover/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-theme-muted'}`} />
                <span className="tracking-tight">
                  {item.shortLabel ? (
                    <>
                      <span className="inline md:hidden">{item.shortLabel}</span>
                      <span className="hidden md:inline">{item.label}</span>
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

        {/* Right Scroll Indicator / Quick Jump (Mobile/Tablet) */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pr-1 pl-4 bg-gradient-to-l from-theme-card dark:from-slate-900 to-transparent pointer-events-none">
            <button
              onClick={() => scrollByAmount(180)}
              className="pointer-events-auto p-1 rounded-full bg-theme-card-hover border border-theme-border/80 text-theme-muted hover:text-theme-text shadow-xs transition-all active:scale-90"
              title="Scroll right"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}

      </div>
    </nav>
  );
};
