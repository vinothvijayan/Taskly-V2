import React, { useState } from 'react';
import TaskViewToggle from '@/components/tasks/TaskViewToggle';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

type TaskView = 'list' | 'kanban';

// --- Placeholder Components (Replace with actual implementation later) ---
const TaskListView = () => (
  <div className="p-4 border border-dashed rounded-lg mt-4 min-h-[300px] flex items-center justify-center bg-card text-card-foreground">
    <p className="text-muted-foreground">Task List View Content goes here.</p>
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

  return (
    <div className="container mx-auto p-4 sm:p-6">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-3 sm:space-y-0">
        
        <h1 className="text-3xl font-bold">Tasks</h1>
        
        {/* Controls: View Toggle and Add Button */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          
          {/* Task View Toggle (Wider on mobile, aligned right) */}
          <div className="flex-grow sm:flex-grow-0">
            <TaskViewToggle view={view} onViewChange={setView} />
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