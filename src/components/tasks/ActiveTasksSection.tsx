import React from 'react';
import { CheckSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TaskCard from './TaskCard';

// Placeholder data matching the screenshot style
const mockTasks = [
  { id: '1', title: 'Fix the mall\'s screen', description: null, isCompleted: false, subtaskCount: 2, timeSpent: null, dueDate: '2 days ago', isUrgent: false, commentCount: 0 },
  { id: '2', title: 'Sidharth send him a mail', description: 'Send the mail today', isCompleted: false, subtaskCount: 0, timeSpent: '1m', dueDate: '2 days ago', isUrgent: true, commentCount: 0 },
  { id: '3', title: 'AI Feature for hype loop', description: null, isCompleted: false, subtaskCount: 2, timeSpent: null, dueDate: null, isUrgent: false, commentCount: 0 },
  { id: '4', title: 'Brandist - send the details', description: null, isCompleted: false, subtaskCount: 0, timeSpent: null, dueDate: null, isUrgent: false, commentCount: 0 },
  { id: '5', title: 'santhosh, talk to him for the details', description: null, isCompleted: false, subtaskCount: 1, timeSpent: '0m', dueDate: null, isUrgent: false, commentCount: 0 },
  { id: '6', title: 'porur tolll internet fixing', description: null, isCompleted: false, subtaskCount: 2, timeSpent: '0m', dueDate: null, isUrgent: false, commentCount: 0 },
  { id: '7', title: 'Onboard fries land', description: null, isCompleted: false, subtaskCount: 0, timeSpent: '0m', dueDate: null, isUrgent: false, commentCount: 0 },
];

const ActiveTasksSection: React.FC = () => {
  return (
    <div className="w-full">
      
      {/* Header matching the screenshot: Blue background, rounded pill shape */}
      <div className="flex items-center justify-between bg-blue-600/90 text-white rounded-full py-2 px-4 mb-6 shadow-md">
        <h2 className="text-base font-semibold flex items-center">
          <CheckSquare className="h-4 w-4 mr-2" />
          Active Tasks
        </h2>
        <span className="text-sm font-bold bg-white/20 rounded-full px-2 py-0.5">
          {mockTasks.length}
        </span>
      </div>
      
      {/* Task List */}
      <div className="space-y-4">
        {mockTasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
      
      {/* Floating Action Button (FAB) - We'll handle this in TasksPage for global placement */}
    </div>
  );
};

export default ActiveTasksSection;