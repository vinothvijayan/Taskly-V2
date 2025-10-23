import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { MoreVertical, MessageSquare, Zap, ChevronDown, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Placeholder types for demonstration
interface Task {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  subtaskCount: number;
  timeSpent?: string;
  dueDate?: string;
  isUrgent: boolean;
  commentCount: number;
}

// Placeholder data
const mockTask: Task = {
  id: '1',
  title: 'Fix the mall\'s screen',
  description: 'Check posters for hype loop screems',
  isCompleted: false,
  subtaskCount: 2,
  timeSpent: '0m',
  dueDate: '2 days ago',
  isUrgent: true,
  commentCount: 0,
};

interface TaskCardProps {
  task: Task;
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  
  // Helper for badges
  const Badge: React.FC<{ icon: React.ReactNode, text: string, color?: string }> = ({ icon, text, color = 'text-muted-foreground' }) => (
    <div className={`flex items-center text-xs ${color}`}>
      {icon}
      <span className="ml-1">{text}</span>
    </div>
  );

  return (
    <div className="bg-card text-card-foreground rounded-xl shadow-lg p-4 border border-border/50">
      <div className="flex items-start justify-between">
        
        {/* Left Section: Checkbox and Title/Description */}
        <div className="flex items-start flex-grow mr-4">
          <Checkbox 
            checked={task.isCompleted} 
            className="mt-1 h-5 w-5 rounded-full border-gray-600 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <div className="ml-4">
            <p className={`text-base font-medium ${task.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {task.description}
              </p>
            )}
            
            {/* Badges/Tags Row */}
            <div className="flex items-center space-x-3 mt-2">
              {task.dueDate && (
                <Badge 
                  icon={<Calendar className="h-3 w-3" />} 
                  text={task.dueDate} 
                  color={task.isCompleted ? 'text-muted-foreground' : 'text-red-500'}
                />
              )}
              {task.timeSpent && (
                <Badge 
                  icon={<Clock className="h-3 w-3" />} 
                  text={task.timeSpent} 
                />
              )}
            </div>
          </div>
        </div>
        
        {/* Right Section: Icons and Menu */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          {task.commentCount > 0 && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
          {task.isUrgent && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-500">
              <Zap className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Subtasks Toggle */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <Button variant="ghost" className="p-0 h-auto text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4 mr-1" />
          Subtasks ({task.subtaskCount})
        </Button>
      </div>
    </div>
  );
};

export default TaskCard;