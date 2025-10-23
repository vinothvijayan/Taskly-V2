import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, ChevronRight, Menu, Bell, Search } from 'lucide-react';
import ActiveTasksSection from '@/components/tasks/ActiveTasksSection';
import CompletedTasksSection from '@/components/tasks/CompletedTasksSection';

type TaskView = 'list' | 'kanban';

// --- Dedicated List View Component (Always stacked for My Day) ---
const TaskListView = () => (
  <div className="mt-4 pb-20"> {/* pb-20 to make space for the FAB */}
    <ActiveTasksSection />
    <CompletedTasksSection />
  </div>
);

const KanbanView = () => (
  <div className="p-4 border border-dashed rounded-lg mt-4 min-h-[300px] flex items-center justify-center bg-card text-card-foreground">
    <p className="text-muted-foreground">Kanban Board Content goes here.</p>
  </div>
);
// -----------------------------------------------------------------------

// Helper function to format date (using a simple placeholder for now)
const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};


const TasksPage = () => {
  // We will assume 'list' view is the 'My Day' view for now.
  const [view, setView] = useState<TaskView>('list');
  const [currentDate, setCurrentDate] = useState(new Date());

  const handlePreviousDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  // Placeholder for user initial (V)
  const userInitial = 'V'; 

  return (
    <div className="container mx-auto p-0 sm:p-6">
      
      {/* Top Navigation Bar (Mobile Look) */}
      <header className="p-4 sm:p-0 sm:hidden bg-background border-b border-border/50">
        <div className="flex justify-between items-center">
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon">
              <Search className="h-6 w-6" />
            </Button>
            <Button variant="ghost" size="icon">
              <Bell className="h-6 w-6" />
            </Button>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
              {userInitial}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area - Responsive Padding */}
      <div className="p-4 sm:p-0 sm:container sm:mx-auto">
        
        {/* My Day Header and Date Navigation */}
        <div className="mb-6 mt-4">
          <h1 className="text-3xl font-bold mb-1">My Day</h1>
          
          <div className="flex items-center justify-between text-muted-foreground">
            <Button variant="ghost" size="icon" onClick={handlePreviousDay}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <p className="text-base font-medium">
              {formatDate(currentDate)}
            </p>
            <Button variant="ghost" size="icon" onClick={handleNextDay}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Task Content */}
        {view === 'list' && <TaskListView />}
        {view === 'kanban' && <KanbanView />}
      </div>
      
      {/* Floating Action Button (FAB) */}
      <Button 
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>
      
    </div>
  );
};

export default TasksPage;