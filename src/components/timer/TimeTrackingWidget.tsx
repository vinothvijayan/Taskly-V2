import { Play, Pause, Square } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTaskTimeTracker } from "@/contexts/TaskTimeTrackerContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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

  if (!trackingTask) return null;

  const estimatedSeconds = (trackingTask.estimatedTime || 0) * 60;
  const totalTimeSpent = (trackingTask.timeSpent || 0) + currentSessionElapsedSeconds;
  const progress = estimatedSeconds > 0 ? Math.min((totalTimeSpent / estimatedSeconds) * 100, 100) : 0;

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
            {/* Status Indicator & Play/Pause */}
            <div className="flex-shrink-0">
              <Button
                variant={isTracking ? "focus" : "outline"}
                size="icon"
                onClick={isTracking ? pauseTracking : resumeTracking}
                className="h-9 w-9 rounded-full"
              >
                {isTracking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            </div>

            {/* Task Info & Timer */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{trackingTask.title}</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono text-primary font-semibold">
                  {getFormattedTime(currentSessionElapsedSeconds)}
                </p>
                {trackingTask.timeSpent && trackingTask.timeSpent > 0 && (
                   <p className="text-xs text-muted-foreground">(Total: {getFormattedTime(totalTimeSpent)})</p>
                )}
              </div>
            </div>

            {/* Stop Button */}
            <div className="flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={stopTracking}
                className="h-9 w-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Square className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          {trackingTask.estimatedTime && (
            <div className="mt-2 relative h-1 w-full bg-muted rounded-full overflow-hidden">
              <motion.div
                className="absolute top-0 left-0 h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}