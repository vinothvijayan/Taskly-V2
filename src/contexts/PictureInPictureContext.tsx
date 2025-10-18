import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { usePictureInPicture } from '@/hooks/usePictureInPicture';
import { useTasks } from '@/contexts/TasksContext';
import { useTaskTimeTracker } from '@/contexts/TaskTimeTrackerContext';
import { PipWidget } from '@/components/pip/PipWidget';

// Define the context type
interface PictureInPictureContextType {
  isPipSupported: boolean;
  isPipOpen: boolean;
  openPip: () => void;
  closePip: () => void;
}

const PictureInPictureContext = createContext<PictureInPictureContextType | undefined>(undefined);

export function PictureInPictureProvider({ children }: { children: ReactNode }) {
  const { isPipSupported, isPipOpen, pipWindow, openPipWindow, closePipWindow } = usePictureInPicture();
  
  // Get data from other contexts that the PiP widget needs
  const { tasks, addTask, toggleTaskStatus } = useTasks();
  const timeTracker = useTaskTimeTracker();

  // This effect is the source of truth for keeping the PiP window updated
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
      // The content is now defined here, not at the call site
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

  const value = {
    isPipSupported,
    isPipOpen,
    openPip,
    closePip: closePipWindow,
  };

  return (
    <PictureInPictureContext.Provider value={value}>
      {children}
    </PictureInPictureContext.Provider>
  );
}

export function usePip() {
  const context = useContext(PictureInPictureContext);
  if (context === undefined) {
    throw new Error('usePip must be used within a PictureInPictureProvider');
  }
  return context;
}