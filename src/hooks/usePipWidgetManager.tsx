import { useEffect } from 'react';
import { usePictureInPicture } from '@/hooks/usePictureInPicture';
import { useTasks } from '@/contexts/TasksContext';
import { useTaskTimeTracker } from '@/contexts/TaskTimeTrackerContext';
import { PipWidget } from '@/components/pip/PipWidget';

export function usePipWidgetManager() {
  const { isPipSupported, isPipOpen, pipWindow, openPipWindow, closePipWindow } = usePictureInPicture();
  
  const { tasks, addTask, toggleTaskStatus } = useTasks();
  const timeTracker = useTaskTimeTracker();

  // This effect is the core of the real-time update logic.
  // It listens for changes in tasks or timer state and re-renders the PiP content.
  useEffect(() => {
    if (isPipOpen && pipWindow?.reactRoot) {
      pipWindow.reactRoot.render(
        <PipWidget
          tasks={tasks}
          onToggleStatus={toggleTaskStatus}
          onClose={closePipWindow}
          onAddTask={(taskData) => addTask({ ...taskData, priority: 'medium', status: 'todo' })}
          trackingTask={timeTracker.trackingTask}
          isTracking={timeTracker.isTracking}
          currentSessionElapsedSeconds={timeTracker.currentSessionElapsedSeconds}
          onPlayPause={timeTracker.isTracking ? timeTracker.pauseTracking : timeTracker.resumeTracking}
          onStop={timeTracker.stopTracking}
          getFormattedTime={timeTracker.getFormattedTime}
          onStartTracking={timeTracker.startTracking}
        />
      );
    }
  }, [
    isPipOpen, pipWindow, tasks, toggleTaskStatus, closePipWindow, addTask,
    timeTracker.trackingTask, timeTracker.isTracking, timeTracker.currentSessionElapsedSeconds,
    timeTracker.pauseTracking, timeTracker.resumeTracking, timeTracker.stopTracking,
    timeTracker.getFormattedTime, timeTracker.startTracking
  ]);

  const openPip = () => {
    if (isPipOpen) {
      closePipWindow();
    } else {
      // The initial render is also handled here, passing all current data.
      openPipWindow(
        <PipWidget
          tasks={tasks}
          onToggleStatus={toggleTaskStatus}
          onClose={closePipWindow}
          onAddTask={(taskData) => addTask({ ...taskData, priority: 'medium', status: 'todo' })}
          trackingTask={timeTracker.trackingTask}
          isTracking={timeTracker.isTracking}
          currentSessionElapsedSeconds={timeTracker.currentSessionElapsedSeconds}
          onPlayPause={timeTracker.isTracking ? timeTracker.pauseTracking : timeTracker.resumeTracking}
          onStop={timeTracker.stopTracking}
          getFormattedTime={timeTracker.getFormattedTime}
          onStartTracking={timeTracker.startTracking}
        />,
        { width: 350, height: 500 }
      );
    }
  };

  return {
    isPipSupported,
    isPipOpen,
    openPip,
    closePip: closePipWindow,
  };
}