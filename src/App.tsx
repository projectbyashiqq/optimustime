import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Navbar } from './components/Navbar';
import { ActiveTaskBanner } from './components/ActiveTaskBanner';
import { TaskModal } from './components/TaskModal';
import { BufferNoteModal } from './components/BufferNoteModal';
import { RecurringDeleteModal } from './components/RecurringDeleteModal';
import { RecurringManagerModal } from './components/RecurringManagerModal';
import { EmergencyBufferModal } from './components/EmergencyBufferModal';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { DashboardView } from './views/DashboardView';
import { TimeTracker24View } from './views/TimeTracker24View';
import { AllTasksView } from './views/AllTasksView';
import { PlansProjectsView } from './views/PlansProjectsView';
import { CategoryView } from './views/CategoryView';
import { AnalyticsView } from './views/AnalyticsView';
import { NotesView } from './views/NotesView';
import { AdminSettingsView } from './views/AdminSettingsView';
import { LoginGate } from './components/LoginGate';
import { Task } from './types';

export const AppContent: React.FC = () => {
  const { activeTab, isAuthenticated } = useApp();

  // If user is locked out / unauthenticated, display Login Gate
  if (!isAuthenticated) {
    return <LoginGate />;
  }

  // Task Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>(undefined);
  const [modalInitialStartTime, setModalInitialStartTime] = useState<string | undefined>(undefined);
  const [modalInitialProjectCode, setModalInitialProjectCode] = useState<string | undefined>(undefined);
  const [modalInitialCategory, setModalInitialCategory] = useState<string | undefined>(undefined);
  const [modalInitialPlanProjectId, setModalInitialPlanProjectId] = useState<string | undefined>(undefined);
  const [isRecurringManagerOpen, setIsRecurringManagerOpen] = useState(false);

  const handleOpenTaskModal = (
    task?: Task, 
    date?: string, 
    startTime?: string,
    projectCode?: string,
    category?: string,
    planProjectId?: string
  ) => {
    setTaskToEdit(task || null);
    setModalInitialDate(date);
    setModalInitialStartTime(startTime);
    setModalInitialProjectCode(projectCode);
    setModalInitialCategory(category);
    setModalInitialPlanProjectId(planProjectId);
    setIsTaskModalOpen(true);
  };

  const handleCloseTaskModal = () => {
    setIsTaskModalOpen(false);
    setTaskToEdit(null);
    setModalInitialDate(undefined);
    setModalInitialStartTime(undefined);
    setModalInitialProjectCode(undefined);
    setModalInitialCategory(undefined);
    setModalInitialPlanProjectId(undefined);
  };

  return (
    <div className="min-h-screen flex flex-col bg-theme-bg text-theme-text transition-colors duration-200">
      
      {/* Top Header Protocol */}
      <Header onOpenNewTaskModal={() => handleOpenTaskModal()} />

      {/* Main Navigation Bar */}
      <Navbar />

      {/* Persistent Active Working Task Banner */}
      <ActiveTaskBanner />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-3 pb-6">
        {activeTab === 'dashboard' && (
          <DashboardView onOpenTaskModal={handleOpenTaskModal} />
        )}
        {activeTab === 'time-tracker' && (
          <TimeTracker24View onOpenTaskModal={handleOpenTaskModal} />
        )}
        {activeTab === 'all-tasks' && (
          <AllTasksView onOpenTaskModal={handleOpenTaskModal} />
        )}
        {activeTab === 'plans-projects' && (
          <PlansProjectsView onOpenTaskModal={handleOpenTaskModal} />
        )}
        {activeTab === 'categories' && (
          <CategoryView onOpenTaskModal={handleOpenTaskModal} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsView />
        )}
        {activeTab === 'notes' && (
          <NotesView onOpenTaskModal={handleOpenTaskModal} />
        )}
        {activeTab === 'settings' && (
          <AdminSettingsView />
        )}
      </main>

      {/* Task Creation & Edit Modal */}
      {isTaskModalOpen && (
        <TaskModal
          taskToEdit={taskToEdit}
          initialDate={modalInitialDate}
          initialStartTime={modalInitialStartTime}
          initialProjectCode={modalInitialProjectCode}
          initialCategory={modalInitialCategory}
          initialPlanProjectId={modalInitialPlanProjectId}
          onClose={handleCloseTaskModal}
        />
      )}

      {/* Buffer Status & Free-Time Note Modal */}
      <BufferNoteModal />

      {/* Emergency Buffer & Cascading Day Reschedule Modal */}
      <EmergencyBufferModal />

      {/* Recurring Task Deletion Choice Modal */}
      <RecurringDeleteModal />

      {/* 100% System Backup & Data Recovery Hub Modal */}
      <BackupRestoreModal />

      {/* Recurring Tasks & Schedules Manager Hub Modal */}
      {isRecurringManagerOpen && (
        <RecurringManagerModal
          isOpen={isRecurringManagerOpen}
          onClose={() => setIsRecurringManagerOpen(false)}
          onOpenTaskModal={handleOpenTaskModal}
        />
      )}

      {/* Bottom Footer info */}
      <footer className="border-t border-theme-border py-4 text-center text-xs text-theme-muted">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>OPTIMUSTIME • Unified Scientific Time-Boxing & Capacity Engine</span>
          <span className="font-mono text-[11px]">System Status: Operational • All Engines Active</span>
        </div>
      </footer>

    </div>
  );
};

export const App: React.FC = () => {
  return <AppContent />;
};

export default App;
