import { useState, useEffect, useRef } from "react"
import { Play, Pause, RotateCcw, Settings } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Task } from "@/types"
import { cn } from "@/lib/utils"
import { notificationService } from "@/lib/notifications"
import { playSound, TIMER_COMPLETE_SOUND_URL } from "@/lib/utils"

interface PomodoroTimerProps {
  task?: Task
  onTimerComplete?: (sessionType: "focus" | "break", duration: number) => void
}

export function PomodoroTimer({ task, onTimerComplete }: PomodoroTimerProps) {
  const [sessionType, setSessionType] = useState<"focus" | "break">("focus")
  const [timeLeft, setTimeLeft] = useState(25 * 60) // 25 minutes in seconds
  const [isRunning, setIsRunning] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  
  const [settings, setSettings] = useState({
    focusTime: 25,
    shortBreak: 5,
    longBreak: 15,
    sessionsUntilLongBreak: 4
  })

  const intervalRef = useRef<NodeJS.Timeout>()

  const totalTime = sessionType === "focus" 
    ? settings.focusTime * 60 
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
        // Session completed
        setIsRunning(false)
        onTimerComplete?.(sessionType, totalTime / 60)
        
        // Show notification
        playSound(TIMER_COMPLETE_SOUND_URL)
        if (sessionType === "focus") {
          notificationService.showPomodoroNotification('focus-complete', sessionCount + 1)
        } else {
          notificationService.showPomodoroNotification('break-complete')
        }
        
        if (sessionType === "focus") {
          setSessionCount(prev => prev + 1)
          setSessionType("break")
          const isLongBreak = (sessionCount + 1) % settings.sessionsUntilLongBreak === 0
          setTimeLeft(isLongBreak ? settings.longBreak * 60 : settings.shortBreak * 60)
        } else {
          setSessionType("focus")
          setTimeLeft(settings.focusTime * 60)
        }
      }
    }

    return () => clearInterval(intervalRef.current)
  }, [isRunning, timeLeft, sessionType, sessionCount, settings, onTimerComplete, totalTime])

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
    setTimeLeft(sessionType === "focus" ? settings.focusTime * 60 : settings.shortBreak * 60)
  }

  const getSessionBadgeVariant = () => {
    if (sessionType === "focus") return "default"
    return sessionCount % settings.sessionsUntilLongBreak === 0 && sessionCount > 0 ? "destructive" : "secondary"
  }

  const getSessionLabel = () => {
    if (sessionType === "focus") return "Focus Session"
    return sessionCount % settings.sessionsUntilLongBreak === 0 && sessionCount > 0 ? "Long Break" : "Short Break"
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>Pomodoro Timer</span>
            <Badge variant={getSessionBadgeVariant()}>
              {getSessionLabel()}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        {task && (
          <p className="text-sm text-muted-foreground">
            Working on: <span className="font-medium">{task.title}</span>
          </p>
        )}
      </CardHeader>

      <CardContent>
        <div className="text-center space-y-6">
          <div className={cn(
            "text-6xl font-mono font-bold transition-smooth",
            sessionType === "focus" ? "text-focus" : "text-break"
          )}>
            {formatTime(timeLeft)}
          </div>

          <Progress 
            value={progress} 
            className="h-2"
          />

          <div className="flex justify-center gap-3">
            <Button
              variant={sessionType === "focus" ? "focus" : "break"}
              size="lg"
              onClick={handleStartPause}
              className="hover-scale"
            >
              {isRunning ? (
                <Pause className="h-5 w-5 mr-2" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              {isRunning ? "Pause" : "Start"}
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={handleReset}
              className="hover-scale"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              Reset
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-focus">Sessions Completed</div>
              <div className="text-2xl font-bold">{sessionCount}</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-break">Next Break In</div>
              <div className="text-2xl font-bold">
                {settings.sessionsUntilLongBreak - (sessionCount % settings.sessionsUntilLongBreak)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}