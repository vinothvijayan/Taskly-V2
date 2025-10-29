import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Task } from "@/types";
import { useTasks } from "@/contexts/TasksContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface TaskTimeTrackerContextType {
  trackingTask: Task | null;
  currentSessionElapsedSeconds: number;
  isTracking: boolean;
  startTracking: (task: Task) => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  stopTracking: () => void;
  getFormattedTime: (seconds: number) => string;
  trackingSubtask: { taskId: string; subtaskId: string; subtaskTitle: string } | null;
  currentSubtaskElapsedSeconds: number;
  isTrackingSubtask: boolean;
  startSubtaskTracking: (taskId: string, subtaskId: string, subtaskTitle: string) => void;
  pauseSubtaskTracking: () => void;
  resumeSubtaskTracking: () => void;
  stopSubtaskTracking: () => void;
}

const TaskTimeTrackerContext = createContext<TaskTimeTrackerContextType | undefined>(undefined);

export function TaskTimeTrackerProvider({ children }: { children: ReactNode }) {
  const [trackingTask, setTrackingTask] = useState<Task | null>(null);
  const [currentSessionElapsedSeconds, setCurrentSessionElapsedSeconds] = useState(0);
  const [isTracking, setIsTracking] = useState(false);

  const [trackingSubtask, setTrackingSubtask] = useState<{ taskId: string; subtaskId: string; subtaskTitle: string } | null>(null);
  const [currentSubtaskElapsedSeconds, setCurrentSubtaskElapsedSeconds] = useState(0);
  const [isTrackingSubtask, setIsTrackingSubtask] = useState(false);

  const { user } = useAuth();
  const { updateTaskTimeSpent, updateSubtaskTimeSpent, getTaskById } = useTasks();
  const { toast } = useToast();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'TIME_TRACKING_UPDATE') {
        const { payload } = event.data;
        if (payload.type === 'task') {
          setIsTracking(payload.isTracking);
          setCurrentSessionElapsedSeconds(payload.currentSessionElapsedSeconds);
          if (!trackingTask || trackingTask.id !== payload.taskId) {
            const task = getTaskById(payload.taskId);
            setTrackingTask(task || { id: payload.taskId, title: 'Loading...' } as Task);
          }
        } else if (payload.type === 'subtask') {
          setIsTrackingSubtask(payload.isTrackingSubtask);
          setCurrentSubtaskElapsedSeconds(payload.currentSubtaskElapsedSeconds);
          if (!trackingSubtask || trackingSubtask.subtaskId !== payload.subtaskId) {
            setTrackingSubtask({ taskId: payload.taskId, subtaskId: payload.subtaskId, subtaskTitle: 'Loading...' });
          }
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [getTaskById, trackingTask, trackingSubtask]);

  const postToServiceWorker = (type: string, session: any) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type, session });
    } else {
      console.warn('Service worker not available to handle time tracking.');
      toast({ title: "Offline Timer Unavailable", description: "Could not connect to background service.", variant: "destructive" });
    }
  };

  const startTracking = async (task: Task) => {
    if (trackingTask) await stopTracking();
    if (trackingSubtask) await stopSubtaskTracking();

    const session = {
      taskId: task.id,
      taskTitle: task.title,
      startTime: Date.now(),
      isPaused: false,
      accumulatedSeconds: 0,
    };
    postToServiceWorker('START_TIME_TRACKING', session);
    
    setTrackingTask(task);
    setCurrentSessionElapsedSeconds(0);
    setIsTracking(true);
    toast({ title: "Time tracking started", description: `Now tracking time for "${task.title}"` });
  };

  const pauseTracking = () => {
    if (!trackingTask) return;
    postToServiceWorker('PAUSE_TIME_TRACKING', { taskId: trackingTask.id });
    setIsTracking(false);
    toast({ title: "Time tracking paused" });
  };

  const resumeTracking = () => {
    if (!trackingTask) return;
    postToServiceWorker('RESUME_TIME_TRACKING', { taskId: trackingTask.id });
    setIsTracking(true);
    toast({ title: "Time tracking resumed" });
  };

  const stopTracking = async () => {
    if (!trackingTask) return;
    
    const finalSeconds = currentSessionElapsedSeconds;
    postToServiceWorker('STOP_TIME_TRACKING', { taskId: trackingTask.id });

    if (finalSeconds > 0) {
      await updateTaskTimeSpent(trackingTask.id, finalSeconds);
      toast({ title: "Time saved!", description: `Saved ${getFormattedTime(finalSeconds)} for "${trackingTask.title}"` });
    }

    setTrackingTask(null);
    setCurrentSessionElapsedSeconds(0);
    setIsTracking(false);
  };

  const startSubtaskTracking = async (taskId: string, subtaskId: string, subtaskTitle: string) => {
    if (trackingTask) await stopTracking();
    if (trackingSubtask) await stopSubtaskTracking();

    const session = {
      taskId,
      subtaskId,
      subtaskTitle,
      startTime: Date.now(),
      isPaused: false,
      accumulatedSeconds: 0,
    };
    postToServiceWorker('START_SUBTASK_TIME_TRACKING', session);

    setTrackingSubtask({ taskId, subtaskId, subtaskTitle });
    setCurrentSubtaskElapsedSeconds(0);
    setIsTrackingSubtask(true);
    toast({ title: "Subtask tracking started", description: `Now tracking "${subtaskTitle}"` });
  };

  const pauseSubtaskTracking = () => {
    if (!trackingSubtask) return;
    postToServiceWorker('PAUSE_SUBTASK_TIME_TRACKING', { ...trackingSubtask });
    setIsTrackingSubtask(false);
  };

  const resumeSubtaskTracking = () => {
    if (!trackingSubtask) return;
    postToServiceWorker('RESUME_SUBTASK_TIME_TRACKING', { ...trackingSubtask });
    setIsTrackingSubtask(true);
  };

  const stopSubtaskTracking = async () => {
    if (!trackingSubtask) return;

    const finalSeconds = currentSubtaskElapsedSeconds;
    postToServiceWorker('STOP_SUBTASK_TIME_TRACKING', { ...trackingSubtask });

    if (finalSeconds > 0) {
      await updateSubtaskTimeSpent(trackingSubtask.taskId, trackingSubtask.subtaskId, finalSeconds);
      toast({ title: "Time saved!", description: `Saved ${getFormattedTime(finalSeconds)} for subtask` });
    }

    setTrackingSubtask(null);
    setCurrentSubtaskElapsedSeconds(0);
    setIsTrackingSubtask(false);
  };

  const getFormattedTime = (seconds: number): string => {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    if (minutes > 0) return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
    return `${remainingSeconds}s`;
  };

  const value = {
    trackingTask,
    currentSessionElapsedSeconds,
    isTracking,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    getFormattedTime,
    trackingSubtask,
    currentSubtaskElapsedSeconds,
    isTrackingSubtask,
    startSubtaskTracking,
    pauseSubtaskTracking,
    resumeSubtaskTracking,
    stopSubtaskTracking,
  };

  return (
    <TaskTimeTrackerContext.Provider value={value}>
      {children}
    </TaskTimeTrackerContext.Provider>
  );
}

export function useTaskTimeTracker() {
  const context = useContext(TaskTimeTrackerContext);
  if (context === undefined) {
    throw new Error("useTaskTimeTracker must be used within a TaskTimeTrackerProvider");
  }
  return context;
}