import { Play, Pause, Square, PictureInPicture, ArrowDownLeftFromSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTaskTimeTracker } from "@/contexts/TaskTimeTrackerContext";
import { usePictureInPicture } from "@/hooks/usePictureInPicture";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect } from "react";

// A smaller, dedicated UI component for the PiP window, styled to match the user's reference
const PipTimeTrackerUI = ({
  taskTitle,
  isTracking,
  currentSessionElapsedSeconds,
  onPlayPause,
  onStop,
  onPopIn,
  getFormattedTime,
}: any) => (
  <div className="p-3 h-full w-full flex items-center gap-3 bg-background text-foreground font-sans">
    <Button
      variant="default"
      size="icon"
      onClick={onPlayPause}
      className="h-10 w-10 rounded-full flex-shrink-0 gradient-primary text-primary-foreground shadow-lg"
    >
      {isTracking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
    </Button>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate" title={taskTitle}>{taskTitle}</p>
      <p className="text-sm font-mono text-primary font-semibold">
        {getFormattedTime(currentSessionElapsedSeconds)}
      </p>
    </div>
    <div className="flex items-center flex-shrink-0">
      <Button variant="ghost" size="icon" onClick={onStop} className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
        <Square className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onPopIn} className="h-9 w-9 rounded-lg text-muted-foreground">
        <ArrowDownLeftFromSquare className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

export function TimeTrackingWidget() {
  const { 
    trackingTask, 
    currentSessionElapsedSeconds, 
    isTracking, 
    pauseTracking, 
    resumeTracking, 
    stopTracking, 
    getFormattedTime 
  } = useTaskTimeTracker();
  
  const { isPipSupported, isPipOpen, pipWindow, openPipWindow, closePipWindow } = usePictureInPicture();

  // This effect now correctly re-renders the content inside the existing PiP window
  useEffect(() => {
    if (isPipOpen && pipWindow?.reactRoot && trackingTask) {
      pipWindow.reactRoot.render(
        <PipTimeTrackerUI
          taskTitle={trackingTask.title}
          isTracking={isTracking}
          currentSessionElapsedSeconds={currentSessionElapsedSeconds}
          onPlayPause={isTracking ? pauseTracking : resumeTracking}
          onStop={handleStopAndClose}
          onPopIn={closePipWindow}
          getFormattedTime={getFormattedTime}
        />
      );
    }
  }, [isPipOpen, pipWindow, trackingTask, isTracking, currentSessionElapsedSeconds]);

  if (!trackingTask) {
    if (isPipOpen) closePipWindow();
    return null;
  }

  const calculateProgress = () => {
    const estimatedSeconds = (trackingTask.estimatedTime || 0) * 60;
    const totalTimeSpent = (trackingTask.timeSpent || 0) + currentSessionElapsedSeconds;
    return estimatedSeconds > 0 ? Math.min((totalTimeSpent / estimatedSeconds) * 100, 100) : 0;
  };

  const handlePopOut = () => {
    openPipWindow(
      <PipTimeTrackerUI
        taskTitle={trackingTask.title}
        isTracking={isTracking}
        currentSessionElapsedSeconds={currentSessionElapsedSeconds}
        onPlayPause={isTracking ? pauseTracking : resumeTracking}
        onStop={handleStopAndClose}
        onPopIn={closePipWindow}
        getFormattedTime={getFormattedTime}
      />,
      { width: 320, height: 72 }
    );
  };

  const handleStopAndClose = () => {
    stopTracking();
    closePipWindow();
  };

  // If the PiP window is open, don't render the widget in the main app
  if (isPipOpen) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="fixed bottom-6 left-6 z-50"
    >
      <Card className={cn(
        "w-72 shadow-elegant border backdrop-blur-sm bg-card/80 transition-all duration-300",
        isTracking ? "border-primary/30" : "border-border"
      )}>
        <div className="p-3">
          <div className="flex items-center gap-3">
            <Button variant={isTracking ? "focus" : "outline"} size="icon" onClick={isTracking ? pauseTracking : resumeTracking} className="h-9 w-9 rounded-full">
              {isTracking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{trackingTask.title}</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono text-primary font-semibold">{getFormattedTime(currentSessionElapsedSeconds)}</p>
                {trackingTask.timeSpent && trackingTask.timeSpent > 0 && (<p className="text-xs text-muted-foreground">(Total: {getFormattedTime((trackingTask.timeSpent || 0) + currentSessionElapsedSeconds)})</p>)}
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center">
              {isPipSupported && (
                <Button variant="ghost" size="icon" onClick={handlePopOut} className="h-9 w-9 rounded-full text-muted-foreground">
                  <PictureInPicture className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={stopTracking} className="h-9 w-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Square className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {trackingTask.estimatedTime && (
            <div className="mt-2 relative h-1 w-full bg-muted rounded-full overflow-hidden">
              <motion.div className="absolute top-0 left-0 h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${calculateProgress()}%` }} transition={{ duration: 0.5, ease: "easeInOut" }} />
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}