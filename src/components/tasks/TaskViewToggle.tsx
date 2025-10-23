import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { List, LayoutGrid } from "lucide-react";
import React from 'react';

type TaskView = 'list' | 'kanban';

interface TaskViewToggleProps {
  view: TaskView;
  onViewChange: (view: TaskView) => void;
}

const TaskViewToggle: React.FC<TaskViewToggleProps> = ({ view, onViewChange }) => {
  return (
    <ToggleGroup 
      type="single" 
      value={view} 
      onValueChange={(value) => {
        if (value) {
          onViewChange(value as TaskView);
        }
      }}
      // Use full width on mobile, justify content to the end, and auto width on desktop
      className="w-full justify-end sm:w-auto"
    >
      <ToggleGroupItem value="list" aria-label="List View">
        <List className="h-4 w-4 sm:mr-2" /> 
        {/* Show text only on larger screens */}
        <span className="hidden sm:inline">List</span>
      </ToggleGroupItem>
      
      {/* Hide Kanban option on mobile (screens smaller than sm) */}
      <ToggleGroupItem value="kanban" aria-label="Kanban View" className="hidden sm:flex">
        <LayoutGrid className="h-4 w-4 sm:mr-2" /> 
        {/* Show text only on larger screens */}
        <span className="hidden sm:inline">Kanban</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
};

export default TaskViewToggle;