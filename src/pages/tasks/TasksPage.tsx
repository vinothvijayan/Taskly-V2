import React, { useState } from 'react';
import TaskViewToggle from '@/components/tasks/TaskViewToggle';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import ActiveTasksSection from '@/components/tasks/ActiveTasksSection';
import CompletedTasksSection from '@/components/tasks/CompletedTasksSection';

type TaskView = 'list' | 'kanban';

// --- Dedicated List View Component ---
const TaskListView = () => (
  // On small screens (mobile), stack vertically (flex-col) with space-y-6.
  // On medium screens and up (md:), use a grid layout (grid-cols-2) with gap-6.
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
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


const TasksPage = () => {
  // Initialize view state. Defaulting to 'list' for mobile compatibility.
  const [view, setView] = useState<TaskView>('list');

  // If the user switches to kanban on a small screen, we force it back to list 
  // because the kanban toggle is hidden on mobile.
  const handleViewChange = (newView: TaskView) => {
    // Simple check to ensure we don't switch to kanban if the screen is small
    // (though TaskViewToggle already handles hiding the button, this is a safeguard)
    if (newView === 'kanban' && window.innerWidth < 640) { // 640px is Tailwind's 'sm' breakpoint
      setView('list');
    } else {
      setView(newView);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-3 sm:space-y-0">
        
        <h1 className="text-3xl font-bold">Tasks</h1>
        
        {/* Controls: View Toggle and Add Button */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          
          {/* Task View Toggle (Wider on mobile, aligned right) */}
          <div className="flex-grow sm:flex-grow-0">
            <TaskViewToggle view={view} onViewChange={handleViewChange} />
          </div>
          
          {/* Add Task Button */}
          <Button className="flex-shrink-0">
            <Plus className="h-4 w-4 sm:mr-2" />
            {/* Use full text on desktop, abbreviated on mobile */}
            <span className="hidden sm:inline">Add Task</span>
            <span className="inline sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {view === 'list' && <TaskListView />}
      {view === 'kanban' && <KanbanView />}
      
    </div>
  );
};

export default TasksPage;