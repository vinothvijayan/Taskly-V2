import { createContext, useContext, useState, ReactNode } from "react"
import { Task } from "@/types"

interface TimerContextType {
  activeTask: Task | null
  isTimerRunning: boolean
  isTimerExpanded: boolean
  startTaskTimer: (task: Task) => void
  stopTimer: () => void
  toggleTimerSize: () => void
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

export function TimerProvider({ children }: { children: ReactNode }) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [isTimerExpanded, setIsTimerExpanded] = useState(true)

  const startTaskTimer = (task: Task) => {
    setActiveTask(task)
    setIsTimerRunning(true)
    setIsTimerExpanded(true)
  }

  const stopTimer = () => {
    setActiveTask(null)
    setIsTimerRunning(false)
    setIsTimerExpanded(false)
  }

  const toggleTimerSize = () => {
    setIsTimerExpanded(!isTimerExpanded)
  }

  return (
    <TimerContext.Provider
      value={{
        activeTask,
        isTimerRunning,
        isTimerExpanded,
        startTaskTimer,
        stopTimer,
        toggleTimerSize,
      }}
    >
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const context = useContext(TimerContext)
  if (context === undefined) {
    throw new Error("useTimer must be used within a TimerProvider")
  }
  return context
}