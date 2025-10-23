import React from 'react';
import { Clock } from 'lucide-react';
import TaskCard from './TaskCard';

// Placeholder data matching the screenshot style
const mockCompletedTasks = [
  { id: '8', title: 'meeting with 1 client', description: null, isCompleted: true, subtaskCount: 0, timeSpent: null, dueDate: '2 days ago', isUrgent: false, commentCount: 0 },
];

const CompletedTasksSection: React.FC = () => {
  return (
    <div className="w-full mt-8">
      
      {/* Header matching the screenshot: Green background, rounded pill shape */}
      <div className="flex items-center justify-between bg-green-600/90 text-white rounded-full py-2 px-4 mb-6 shadow-md">
        <h2 className="text-base font-semibold flex items-center">
          <Clock className="h-4 w-4 mr-2" />
          Completed
        </h2>
        <span className="text-sm font-bold bg-white/20 rounded-full px-2 py-0.5">
          {mockCompletedTasks.length}
        </span>
      </div>
      
      {/* Task List */}
      <div className="space-y-4">
        {mockCompletedTasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
};

export default CompletedTasksSection;