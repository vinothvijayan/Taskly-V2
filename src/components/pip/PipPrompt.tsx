import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PictureInPicture } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTaskTimeTracker } from '@/contexts/TaskTimeTrackerContext';
import { usePictureInPicture } from '@/hooks/usePictureInPicture';
import { useTasks } from '@/contexts/TasksContext';
import { PipWidget } from './PipWidget';

export function PipPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const { isTracking, trackingTask, isTracking: isTimerRunning, currentSessionElapsedSeconds, pauseTracking, resumeTracking, stopTracking, getFormattedTime, startTracking } = useTaskTimeTracker();
  const { tasks, toggleTaskStatus } = useTasks();
  const { isPipSupported, openPipWindow, closePipWindow } = usePictureInPicture();

  useEffect(() => {
    if (!isTracking || !isPipSupported) {
      setIsVisible(false);
      return;
    }

    const handleMouseLeave = () => setIsVisible(true);
    const handleMouseEnter = () => setIsVisible(false);

    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    document.documentElement.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      document.documentElement.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [isTracking, isPipSupported]);

  const handlePopOut = () => {
    openPipWindow(
      <PipWidget
        tasks={tasks}
        onToggleStatus={toggleTaskStatus}
        onClose={closePipWindow}
        trackingTask={trackingTask}
        isTracking={isTimerRunning}
        currentSessionElapsedSeconds={currentSessionElapsedSeconds}
        onPlayPause={isTimerRunning ? pauseTracking : resumeTracking}
        onStop={() => { stopTracking(); closePipWindow(); }}
        getFormattedTime={getFormattedTime}
        onStartTracking={startTracking}
      />,
      { width: 350, height: 500 }
    );
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <motion.div
      initial={{ y: '-100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '-100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
    >
      <Button
        onClick={handlePopOut}
        className="shadow-lg bg-background/80 backdrop-blur-sm border border-border hover:bg-accent"
      >
        <PictureInPicture className="h-4 w-4 mr-2" />
        Open Timer in Picture-in-Picture
      </Button>
    </motion.div>
  );
}