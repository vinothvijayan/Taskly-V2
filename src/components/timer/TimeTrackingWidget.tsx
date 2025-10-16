import { useState } from "react"
import { Play, Pause, Square, Clock, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useTaskTimeTracker } from "@/contexts/TaskTimeTrackerContext"
import { cn } from "@/lib/utils"

export function TimeTrackingWidget() {
  const { 
    trackingTask, 
    // FIX: Use the correct variable name from the new context
    currentSessionElapsedSeconds, 
    isTracking, 
    pauseTracking, 
    resumeTracking, 
    stopTracking, 
    getFormattedTime 
  } = useTaskTimeTracker()

  if (!trackingTask) return null

  // FIX: Use currentSessionElapsedSeconds for all calculations
  const estimatedSeconds = (trackingTask.estimatedTime || 0) * 60
  const progress = estimatedSeconds > 0 ? Math.min((currentSessionElapsedSeconds / estimatedSeconds) * 100, 100) : 0;
  const isOverEstimate = estimatedSeconds > 0 && currentSessionElapsedSeconds > estimatedSeconds;

  return (
    <Card className={cn(
      "fixed bottom-6 left-6 z-50 w-80 shadow-elegant border-2 backdrop-blur-sm transition-all duration-300",
      "border-focus/30 bg-card/95 shadow-glow animate-slide-in-right"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-focus" />
            Time Tracking
          </CardTitle>
          <Badge variant={isTracking ? "default" : "secondary"} className="text-xs">
            {isTracking ? "Active" : "Paused"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Task Info */}
        <div className="text-center">
          <h3 className="font-semibold text-sm mb-1 line-clamp-1">{trackingTask.title}</h3>
          {trackingTask.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {trackingTask.description}
            </p>
          )}
        </div>

        {/* Timer Display */}
        <div className="text-center space-y-3">
          <div className={cn(
            "text-3xl font-mono font-bold transition-colors",
            isOverEstimate ? "text-break" : "text-focus"
          )}>
            {/* FIX: Pass the correct variable to the formatter */}
            {getFormattedTime(currentSessionElapsedSeconds)}
          </div>

          {trackingTask.estimatedTime && (
            <div className="space-y-2">
              <Progress 
                value={progress} 
                className={cn(
                  "h-2 transition-colors",
                  isOverEstimate ? "[&>div]:bg-break" : "[&>div]:bg-focus"
                )}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0m</span>
                <span className={cn(
                  "font-medium",
                  isOverEstimate && "text-break"
                )}>
                  {isOverEstimate ? "Over estimate" : `Target: ${trackingTask.estimatedTime}m`}
                </span>
                <span>{trackingTask.estimatedTime}m</span>
              </div>
            </div>
          )}

          {/* Total Time Spent */}
          {trackingTask.timeSpent && trackingTask.timeSpent > 0 && (
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <div className="text-xs text-muted-foreground">Total time spent</div>
              <div className="text-sm font-semibold text-success">
                {getFormattedTime(trackingTask.timeSpent)}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-2">
          <Button
            variant={isTracking ? "outline" : "focus"}
            size="sm"
            onClick={isTracking ? pauseTracking : resumeTracking}
            className="hover-scale flex-1"
          >
            {isTracking ? (
              <Pause className="h-4 w-4 mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {isTracking ? "Pause" : "Resume"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={stopTracking}
            className="hover-scale text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}