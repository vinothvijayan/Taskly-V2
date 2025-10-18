import { useState, useEffect, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { PipWidget } from '@/components/pip/PipWidget';
import { useTasks } from '@/contexts/TasksContext';
import { useTaskTimeTracker } from '@/contexts/TaskTimeTrackerContext';

// Define the custom window type to include our React root
interface PipWindow extends Window {
  reactRoot?: Root;
}

export function usePipWidgetManager() {
  const [isPipSupported, setIsPipSupported] = useState(false);
  const [isPipOpen, setIsPipOpen] = useState(false);
  const [pipWindow, setPipWindow] = useState<PipWindow | null>(null);
  
  // Get data from contexts to pass to the widget
  const tasksContext = useTasks();
  const timeTrackerContext = useTaskTimeTracker();

  useEffect(() => {
    setIsPipSupported('documentPictureInPicture' in window);
  }, []);

  const closePip = useCallback(() => {
    if (pipWindow) {
      pipWindow.reactRoot?.unmount();
      pipWindow.close();
      setPipWindow(null);
      setIsPipOpen(false);
    }
  }, [pipWindow]);

  const openPip = useCallback(async () => {
    if (!isPipSupported || isPipOpen) return;

    try {
      const newPipWindow: PipWindow = await (window as any).documentPictureInPicture.requestWindow({
        width: 320,
        height: 480,
      });

      // --- THIS IS THE FIX ---
      // Copy all <link rel="stylesheet"> tags from the main document to the PiP window
      const stylesheets = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'));
      stylesheets.forEach(link => {
        const newLink = newPipWindow.document.createElement('link');
        newLink.rel = 'stylesheet';
        newLink.href = link.href;
        newPipWindow.document.head.appendChild(newLink);
      });

      // Also, let's add a basic body style to ensure a good starting point
      const style = newPipWindow.document.createElement('style');
      style.textContent = `
        body { margin: 0; overflow: hidden; }
        #root { height: 100vh; width: 100vw; }
      `;
      newPipWindow.document.head.appendChild(style);
      // --- END OF FIX ---

      const mountPoint = newPipWindow.document.createElement('div');
      mountPoint.id = 'root';
      newPipWindow.document.body.appendChild(mountPoint);

      const reactRoot = createRoot(mountPoint);
      
      const pipContent = (
        <PipWidget
          tasks={tasksContext.tasks}
          onToggleStatus={tasksContext.toggleTaskStatus}
          onClose={closePip}
          onAddTask={tasksContext.addTask}
          trackingTask={timeTrackerContext.trackingTask}
          isTracking={timeTrackerContext.isTracking}
          currentSessionElapsedSeconds={timeTrackerContext.currentSessionElapsedSeconds}
          onPlayPause={() => {
            if (timeTrackerContext.isTracking) {
              timeTrackerContext.pauseTracking();
            } else {
              timeTrackerContext.resumeTracking();
            }
          }}
          onStop={timeTrackerContext.stopTracking}
          getFormattedTime={timeTrackerContext.getFormattedTime}
          onStartTracking={timeTrackerContext.startTracking}
        />
      );

      reactRoot.render(pipContent);
      newPipWindow.reactRoot = reactRoot;

      setPipWindow(newPipWindow);
      setIsPipOpen(true);

      newPipWindow.addEventListener('pagehide', () => {
        if (newPipWindow.reactRoot) {
          newPipWindow.reactRoot.unmount();
        }
        setPipWindow(null);
        setIsPipOpen(false);
      });
    } catch (error) {
      console.error("Error opening Picture-in-Picture window:", error);
    }
  }, [isPipSupported, isPipOpen, tasksContext, timeTrackerContext, closePip]);

  useEffect(() => {
    if (isPipOpen && pipWindow?.reactRoot) {
      const pipContent = (
        <PipWidget
          tasks={tasksContext.tasks}
          onToggleStatus={tasksContext.toggleTaskStatus}
          onClose={closePip}
          onAddTask={tasksContext.addTask}
          trackingTask={timeTrackerContext.trackingTask}
          isTracking={timeTrackerContext.isTracking}
          currentSessionElapsedSeconds={timeTrackerContext.currentSessionElapsedSeconds}
          onPlayPause={() => {
            if (timeTrackerContext.isTracking) {
              timeTrackerContext.pauseTracking();
            } else {
              timeTrackerContext.resumeTracking();
            }
          }}
          onStop={timeTrackerContext.stopTracking}
          getFormattedTime={timeTrackerContext.getFormattedTime}
          onStartTracking={timeTrackerContext.startTracking}
        />
      );
      pipWindow.reactRoot.render(pipContent);
    }
  }, [isPipOpen, pipWindow, tasksContext, timeTrackerContext, closePip]);

  return { isPipSupported, isPipOpen, openPip, closePip };
}