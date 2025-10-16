import { useState, useEffect, useRef } from "react"
import { 
  Play, 
  Pause, 
  RotateCcw, 
  X, 
  Maximize, 
  Minimize, 
  Clock,
  CheckCircle
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useTimer } from "@/contexts/TimerContext"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { notificationService } from "@/lib/notifications"
import { playSound, TIMER_COMPLETE_SOUND_URL } from "@/lib/utils"

export function FloatingTimer() {
  const { activeTask, isTimerExpanded, toggleTimerSize, stopTimer } = useTimer()
  const [sessionType, setSessionType] = useState<"focus" | "break">("focus")
  const [timeLeft, setTimeLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const { toast } = useToast()

  const intervalRef = useRef<NodeJS.Timeout>()

  const settings = {
    shortBreak: 5,
    longBreak: 15,
    sessionsUntilLongBreak: 4
  }

  // Initialize timer with task estimated time
  useEffect(() => {
    if (activeTask && sessionType === "focus") {
      const focusTime = activeTask.estimatedTime || 25
      setTimeLeft(focusTime * 60)
    } else if (sessionType === "break") {
      const isLongBreak = sessionCount % settings.sessionsUntilLongBreak === 0 && sessionCount > 0
      setTimeLeft(isLongBreak ? settings.longBreak * 60 : settings.shortBreak * 60)
    }
  }, [activeTask, sessionType, sessionCount])

  const totalTime = sessionType === "focus" 
    ? (activeTask?.estimatedTime || 25) * 60 
    : (sessionCount % settings.sessionsUntilLongBreak === 0 && sessionCount > 0)
      ? settings.longBreak * 60
      : settings.shortBreak * 60

  const progress = ((totalTime - timeLeft) / totalTime) * 100

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
      
      if (timeLeft === 0 && isRunning) {
        setIsRunning(false)
        
        if (sessionType === "focus") {
          setSessionCount(prev => prev + 1)
          setSessionType("break")
          playSound(TIMER_COMPLETE_SOUND_URL)
          notificationService.showPomodoroNotification('focus-complete', sessionCount + 1)
          toast({
            title: "Focus session completed! 🎉",
            description: "Time for a break. Great work!",
          })
        } else {
          setSessionType("focus")
          playSound(TIMER_COMPLETE_SOUND_URL)
          notificationService.showPomodoroNotification('break-complete')
          toast({
            title: "Break time over! ⚡",
            description: "Ready to focus again?",
          })
        }
      }
    }

    return () => clearInterval(intervalRef.current)
  }, [isRunning, timeLeft, sessionType, sessionCount, toast])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const handleStartPause = () => {
    setIsRunning(!isRunning)
  }

  const handleReset = () => {
    setIsRunning(false)
    const focusTime = activeTask?.estimatedTime || 25
    setTimeLeft(sessionType === "focus" ? focusTime * 60 : settings.shortBreak * 60)
  }

  const handleComplete = () => {
    toast({
      title: "Task completed! 🎯",
      description: `"${activeTask?.title}" has been marked as complete.`,
    })
    stopTimer()
  }

  if (!activeTask) return null

  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50 transition-all duration-300 ease-in-out",
      isTimerExpanded ? "w-96 h-auto" : "w-72 h-20"
    )}>
      <Card className={cn(
        "shadow-elegant border-2 backdrop-blur-sm transition-all duration-300",
        sessionType === "focus" 
          ? "border-focus/30 bg-card/95" 
          : "border-break/30 bg-card/95",
        isTimerExpanded && "shadow-glow"
      )}>
        <CardContent className="p-4">
          {isTimerExpanded ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-focus" />
                  <Badge variant={sessionType === "focus" ? "default" : "secondary"}>
                    {sessionType === "focus" ? "Focus" : "Break"}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-7 w-7"
                    onClick={toggleTimerSize}
                  >
                    <Minimize className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-7 w-7 hover:text-destructive"
                    onClick={stopTimer}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Task Info */}
              <div className="text-center">
                <h3 className="font-semibold text-sm mb-1">{activeTask.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {activeTask.description}
                </p>
              </div>

              {/* Timer Display */}
              <div className="text-center space-y-3">
                <div className={cn(
                  "text-4xl font-mono font-bold transition-colors",
                  sessionType === "focus" ? "text-focus" : "text-break"
                )}>
                  {formatTime(timeLeft)}
                </div>

                <Progress 
                  value={progress} 
                  className={cn(
                    "h-2 transition-colors",
                    sessionType === "focus" ? "[&>div]:bg-focus" : "[&>div]:bg-break"
                  )}
                />
              </div>

              {/* Controls */}
              <div className="flex justify-center gap-2">
                <Button
                  variant={sessionType === "focus" ? "focus" : "break"}
                  size="sm"
                  onClick={handleStartPause}
                  className="hover-scale flex-1"
                >
                  {isRunning ? (
                    <Pause className="h-4 w-4 mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {isRunning ? "Pause" : "Start"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="hover-scale"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>

                {sessionType === "focus" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleComplete}
                    className="hover-scale text-success hover:text-success"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 text-center text-xs">
                <div>
                  <div className="font-semibold text-focus">Sessions</div>
                  <div className="text-lg font-bold">{sessionCount}</div>
                </div>
                <div>
                  <div className="font-semibold text-break">Next Break</div>
                  <div className="text-lg font-bold">
                    {settings.sessionsUntilLongBreak - (sessionCount % settings.sessionsUntilLongBreak)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Minimized view
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "text-lg font-mono font-bold",
                  sessionType === "focus" ? "text-focus" : "text-break"
                )}>
                  {formatTime(timeLeft)}
                </div>
                <Badge variant="secondary" className="text-xs">
                  {activeTask.title.slice(0, 12)}...
                </Badge>
              </div>
              
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleStartPause}
                >
                  {isRunning ? (
                    <Pause className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-7 w-7"
                  onClick={toggleTimerSize}
                >
                  <Maximize className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}