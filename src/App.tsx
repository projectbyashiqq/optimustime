import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Navbar } from './components/Navbar';
import { ActiveTaskBanner } from './components/ActiveTaskBanner';
import { TaskModal } from './components/TaskModal';
import { DashboardView } from './views/DashboardView';
import { AllTasksView } from './views/AllTasksView';
import { CategoryView } from './views/CategoryView';
import { ProjectManagementView } from './views/ProjectManagementView';
import { AnalyticsView } from './views/AnalyticsView';
import { KnowledgeHubView } from './views/KnowledgeHubView';
import { ReminderCenterView } from './views/ReminderCenterView';
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

  const handleOpenTaskModal = (task?: Task, date?: string, startTime?: string) => {
    setTaskToEdit(task || null);
    setModalInitialDate(date);
    setModalInitialStartTime(startTime);
    setIsTaskModalOpen(true);
  };

  const handleCloseTaskModal = () => {
    setIsTaskModalOpen(false);
    setTaskToEdit(null);
    setModalInitialDate(undefined);
    setModalInitialStartTime(undefined);
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView onOpenTaskModal={handleOpenTaskModal} />
        )}
        {activeTab === 'all-tasks' && (
          <AllTasksView onOpenTaskModal={handleOpenTaskModal} />
        )}
        {activeTab === 'categories' && (
          <CategoryView onOpenTaskModal={handleOpenTaskModal} />
        )}
        {activeTab === 'projects' && (
          <ProjectManagementView />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsView />
        )}
        {activeTab === 'knowledge' && (
          <KnowledgeHubView />
        )}
        {activeTab === 'reminders' && (
          <ReminderCenterView onOpenTaskModal={handleOpenTaskModal} />
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
          onClose={handleCloseTaskModal}
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
