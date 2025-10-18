import { useState, useCallback } from 'react';
import { CheckSquare, ArrowDownLeftFromSquare, Play, Pause, Square, List, Timer, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Task } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TASK_COMPLETE_SOUND_URL } from '@/lib/utils';

interface PipWidgetProps {
  tasks: Task[];
  onToggleStatus: (taskId: string, options?: { playSound?: boolean }) => void;
  onClose: () => void;
  onAddTask: (taskData: { title: string }) => void;
  // Timer props
  trackingTask: Task | null;
  isTracking: boolean;
  currentSessionElapsedSeconds: number;
  onPlayPause: () => void;
  onStop: () => void;
  getFormattedTime: (seconds: number) => string;
  onStartTracking: (task: Task) => void;
}

export const PipWidget = ({
  tasks,
  onToggleStatus,
  onClose,
  onAddTask,
  trackingTask,
  isTracking,
  currentSessionElapsedSeconds,
  onPlayPause,
  onStop,
  getFormattedTime,
  onStartTracking,
}: PipWidgetProps) => {
  const [isTaskListVisible, setIsTaskListVisible] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const todoTasks = tasks.filter(t => t.status !== 'completed');

  const playSoundInPip = useCallback((url: string) => {
    try {
      const audio = new window.Audio(url);
      audio.play().catch(e => console.error("PiP audio play failed:", e));
    } catch (error) {
      console.error("PiP sound playback failed:", error);
    }
  }, []);

  const handleToggleStatusWithSound = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const isCompleting = task?.status !== 'completed';
    onToggleStatus(taskId, { playSound: false });
    if (isCompleting) {
      playSoundInPip(TASK_COMPLETE_SOUND_URL);
    }
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    onAddTask({ title: newTaskTitle.trim() });
    setNewTaskTitle('');
  };

  return (
    <div className="h-full w-full bg-gray-900 text-gray-100 font-sans flex flex-col p-3 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between mb-2 flex-shrink-0">
        <h1 className="text-sm font-bold flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          Taskly Widget
        </h1>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => setIsTaskListVisible(prev => !prev)} className="h-7 w-7 text-gray-400 hover:bg-gray-700">
            <List className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-gray-400 hover:bg-gray-700" title="Return to App">
            <ArrowDownLeftFromSquare className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-300",
        !isTaskListVisible && "justify-center"
      )}>
        {/* Timer and Controls Section */}
        {trackingTask && (
          <motion.div
            layout
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="mb-3 p-3 rounded-lg bg-gray-800 border border-gray-700 flex-shrink-0"
          >
            <div className="flex items-center gap-3">
              <Button
                variant="default"
                size="icon"
                onClick={onPlayPause}
                className="h-9 w-9 rounded-full flex-shrink-0 gradient-primary text-primary-foreground shadow-lg"
              >
                {isTracking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-400">Timing Task:</p>
                <p className="text-sm font-medium truncate" title={trackingTask.title}>{trackingTask.title}</p>
              </div>
              <p className="text-lg font-mono text-primary font-semibold">
                {getFormattedTime(currentSessionElapsedSeconds)}
              </p>
              <Button variant="ghost" size="icon" onClick={onStop} className="h-8 w-8 rounded-full text-gray-400 hover:bg-destructive/20 hover:text-destructive">
                <Square className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Task List Section (Collapsible) */}
        <AnimatePresence>
          {isTaskListVisible && (
            <motion.div
              key="task-list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <p className="text-xs font-semibold text-gray-400 mb-2 px-1 flex-shrink-0">Today's Tasks</p>
              <div className="flex-1 overflow-y-auto pr-1">
                <ul className="space-y-1">
                  {todoTasks.length > 0 ? todoTasks.map(task => (
                    <li key={task.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-800 transition-colors group">
                      <Checkbox
                        id={`pip-task-${task.id}`}
                        checked={task.status === 'completed'}
                        onCheckedChange={() => handleToggleStatusWithSound(task.id)}
                        className="border-gray-500 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <label htmlFor={`pip-task-${task.id}`} className="text-sm flex-1 truncate cursor-pointer">
                        {task.title}
                      </label>
                      {trackingTask?.id !== task.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onStartTracking(task)}
                          className="h-7 w-7 text-gray-400 hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          title={`Start tracking "${task.title}"`}
                        >
                          <Timer className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  )) : (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No active tasks.</p>
                    </div>
                  )}
                </ul>
              </div>
              {/* Add Task Input Section */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700 flex-shrink-0">
                <Input
                  placeholder="Add a new task..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                  className="h-8 text-xs bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:ring-primary"
                />
                <Button
                  size="icon"
                  onClick={handleAddTask}
                  disabled={!newTaskTitle.trim()}
                  className="h-8 w-8 flex-shrink-0 gradient-primary text-primary-foreground"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};