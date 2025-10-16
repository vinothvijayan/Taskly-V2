import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PomodoroTimer } from "@/components/timer/PomodoroTimer"
import { Badge } from "@/components/ui/badge"
import { Clock, Target, TrendingUp } from "lucide-react"

export default function TimerPage() {
  const [todayStats, setTodayStats] = useState({
    focusSessions: 3,
    totalFocusTime: 75, // minutes
    tasksCompleted: 2,
    currentStreak: 5 // days
  })

  const handleTimerComplete = (sessionType: "focus" | "break", duration: number) => {
    if (sessionType === "focus") {
      setTodayStats(prev => ({
        ...prev,
        focusSessions: prev.focusSessions + 1,
        totalFocusTime: prev.totalFocusTime + duration
      }))
    }
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Focus Timer</h1>
        <p className="text-muted-foreground">
          Use the Pomodoro Technique to boost your productivity
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PomodoroTimer onTimerComplete={handleTimerComplete} />
        </div>

        <div className="space-y-4">
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-lg">Today's Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-focus" />
                  <span className="text-sm">Focus Sessions</span>
                </div>
                <Badge variant="secondary">{todayStats.focusSessions}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-break" />
                  <span className="text-sm">Focus Time</span>
                </div>
                <Badge variant="secondary">{todayStats.totalFocusTime}m</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-sm">Streak</span>
                </div>
                <Badge variant="secondary">{todayStats.currentStreak} days</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-lg">Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• Take breaks to maintain focus quality</li>
                <li>• Use breaks for light stretching or walking</li>
                <li>• Turn off notifications during focus sessions</li>
                <li>• Stay hydrated throughout your work</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}