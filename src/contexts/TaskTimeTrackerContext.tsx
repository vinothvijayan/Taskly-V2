import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Task } from "@/types";
import { useTasks } from "@/contexts/TasksContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { doc, setDoc, getDoc, deleteDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

interface ActiveTrackingSession {
  taskId: string;
  taskTitle: string;
  startTime: number;
  pausedAt: number | null;
  isPaused: boolean;
  accumulatedSeconds: number;
}

interface ActiveSubtaskTrackingSession {
  taskId: string;
  subtaskId: string;
  subtaskTitle: string;
  startTime: number;
  pausedAt: number | null;
  isPaused: boolean;
  accumulatedSeconds: number;
}

const TaskTimeTrackerContext = createContext<TaskTimeTrackerContextType | undefined>(undefined);

export function TaskTimeTrackerProvider({ children }: { children: ReactNode }) {
  const [trackingTask, setTrackingTask] = useState<Task | null>(null);
  const [currentSessionElapsedSeconds, setCurrentSessionElapsedSeconds] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  const [trackingSubtask, setTrackingSubtask] = useState<{ taskId: string; subtaskId: string; subtaskTitle: string } | null>(null);
  const [currentSubtaskElapsedSeconds, setCurrentSubtaskElapsedSeconds] = useState(0);
  const [isTrackingSubtask, setIsTrackingSubtask] = useState(false);
  const [subtaskStartTime, setSubtaskStartTime] = useState<number | null>(null);

  const { user } = useAuth();
  const { updateTaskTimeSpent, updateSubtaskTimeSpent } = useTasks();
  const { toast } = useToast();

  // Restore tracking session from Firestore on mount
  useEffect(() => {
    if (!user) return;

    const sessionRef = doc(db, 'users', user.uid, 'activeTracking', 'currentSession');

    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const session = snapshot.data() as ActiveTrackingSession;

        if (!trackingTask || trackingTask.id !== session.taskId) {
          setTrackingTask({
            id: session.taskId,
            title: session.taskTitle,
          } as Task);
        }

        setIsTracking(!session.isPaused);

        if (session.isPaused && session.pausedAt) {
          setCurrentSessionElapsedSeconds(session.accumulatedSeconds);
          setStartTime(null);
        } else {
          setStartTime(session.startTime);
          const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
          setCurrentSessionElapsedSeconds(session.accumulatedSeconds + elapsed);
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Restore subtask tracking session from Firestore on mount
  useEffect(() => {
    if (!user) return;

    const subtaskSessionRef = doc(db, 'users', user.uid, 'activeTracking', 'currentSubtaskSession');

    const unsubscribe = onSnapshot(subtaskSessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const session = snapshot.data() as ActiveSubtaskTrackingSession;

        if (!trackingSubtask || trackingSubtask.subtaskId !== session.subtaskId) {
          setTrackingSubtask({
            taskId: session.taskId,
            subtaskId: session.subtaskId,
            subtaskTitle: session.subtaskTitle,
          });
        }

        setIsTrackingSubtask(!session.isPaused);

        if (session.isPaused && session.pausedAt) {
          setCurrentSubtaskElapsedSeconds(session.accumulatedSeconds);
          setSubtaskStartTime(null);
        } else {
          setSubtaskStartTime(session.startTime);
          const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
          setCurrentSubtaskElapsedSeconds(session.accumulatedSeconds + elapsed);
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Timer effect - increments elapsed seconds when tracking
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isTracking && trackingTask) {
      interval = setInterval(() => {
        setCurrentSessionElapsedSeconds(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTracking, trackingTask]);

  // Timer effect for subtasks - increments elapsed seconds when tracking
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isTrackingSubtask && trackingSubtask) {
      interval = setInterval(() => {
        setCurrentSubtaskElapsedSeconds(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTrackingSubtask, trackingSubtask]);

  const startTracking = async (task: Task) => {
    if (!user) return;

    // If already tracking a different task, stop it first
    if (trackingTask && trackingTask.id !== task.id) {
      await stopTracking();
    }

    const now = Date.now();
    const session: ActiveTrackingSession = {
      taskId: task.id,
      taskTitle: task.title,
      startTime: now,
      pausedAt: null,
      isPaused: false,
      accumulatedSeconds: 0,
    };

    try {
      const sessionRef = doc(db, 'users', user.uid, 'activeTracking', 'currentSession');
      await setDoc(sessionRef, session);

      setTrackingTask(task);
      setCurrentSessionElapsedSeconds(0);
      setIsTracking(true);
      setStartTime(now);

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'START_TIME_TRACKING',
          session
        });
      }

      toast({
        title: "Time tracking started",
        description: `Now tracking time for "${task.title}"`,
      });
    } catch (error) {
      console.error("Error starting tracking:", error);
      toast({
        title: "Failed to start tracking",
        variant: "destructive",
      });
    }
  };

  const pauseTracking = async () => {
    if (!trackingTask || !user || !startTime) return;

    try {
      const now = Date.now();
      const sessionElapsed = Math.floor((now - startTime) / 1000);
      const totalAccumulated = currentSessionElapsedSeconds;

      const sessionRef = doc(db, 'users', user.uid, 'activeTracking', 'currentSession');
      const snapshot = await getDoc(sessionRef);

      if (snapshot.exists()) {
        await setDoc(sessionRef, {
          ...snapshot.data(),
          pausedAt: now,
          isPaused: true,
          accumulatedSeconds: totalAccumulated,
        });
      }

      setIsTracking(false);
      setStartTime(null);

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'PAUSE_TIME_TRACKING'
        });
      }

      toast({
        title: "Time tracking paused",
        description: `Paused tracking for "${trackingTask.title}"`,
      });
    } catch (error) {
      console.error("Error pausing tracking:", error);
      toast({
        title: "Failed to pause tracking",
        variant: "destructive",
      });
    }
  };

  const resumeTracking = async () => {
    if (!trackingTask || !user) return;

    try {
      const now = Date.now();
      const sessionRef = doc(db, 'users', user.uid, 'activeTracking', 'currentSession');
      const snapshot = await getDoc(sessionRef);

      if (snapshot.exists()) {
        await setDoc(sessionRef, {
          ...snapshot.data(),
          startTime: now,
          pausedAt: null,
          isPaused: false,
        });
      }

      setIsTracking(true);
      setStartTime(now);

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'RESUME_TIME_TRACKING'
        });
      }

      toast({
        title: "Time tracking resumed",
        description: `Resumed tracking for "${trackingTask.title}"`,
      });
    } catch (error) {
      console.error("Error resuming tracking:", error);
      toast({
        title: "Failed to resume tracking",
        variant: "destructive",
      });
    }
  };

  const stopTracking = async () => {
    if (!trackingTask || !user) {
      setTrackingTask(null);
      setCurrentSessionElapsedSeconds(0);
      setIsTracking(false);
      setStartTime(null);
      return;
    }

    try {
      const sessionRef = doc(db, 'users', user.uid, 'activeTracking', 'currentSession');
      const snapshot = await getDoc(sessionRef);

      let finalSeconds = currentSessionElapsedSeconds;

      if (snapshot.exists() && !isTracking) {
        const session = snapshot.data() as ActiveTrackingSession;
        finalSeconds = session.accumulatedSeconds;
      } else if (startTime && isTracking) {
        const sessionElapsed = Math.floor((Date.now() - startTime) / 1000);
        const session = snapshot.exists() ? snapshot.data() as ActiveTrackingSession : null;
        const accumulated = session?.accumulatedSeconds || 0;
        finalSeconds = accumulated + sessionElapsed;
      }

      if (finalSeconds > 0) {
        await updateTaskTimeSpent(trackingTask.id, finalSeconds);
        const formattedTime = getFormattedTime(finalSeconds);

        toast({
          title: "Time tracking stopped",
          description: `Saved ${formattedTime} for "${trackingTask.title}"`,
        });
      }

      await deleteDoc(sessionRef);

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'STOP_TIME_TRACKING'
        });
      }
    } catch (error) {
      console.error("Error stopping tracking:", error);
      toast({
        title: "Failed to save time",
        description: "Could not save the tracked time. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTrackingTask(null);
      setCurrentSessionElapsedSeconds(0);
      setIsTracking(false);
      setStartTime(null);
    }
  };

  const getFormattedTime = (seconds: number): string => {
    // FIX: Add a guard clause for invalid inputs.
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      return '0s';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
    }
    return `${remainingSeconds}s`;
  };

  const startSubtaskTracking = async (taskId: string, subtaskId: string, subtaskTitle: string) => {
    if (!user) return;

    if (trackingSubtask && (trackingSubtask.taskId !== taskId || trackingSubtask.subtaskId !== subtaskId)) {
      await stopSubtaskTracking();
    }

    const now = Date.now();
    const session: ActiveSubtaskTrackingSession = {
      taskId,
      subtaskId,
      subtaskTitle,
      startTime: now,
      pausedAt: null,
      isPaused: false,
      accumulatedSeconds: 0,
    };

    try {
      const sessionRef = doc(db, 'users', user.uid, 'activeTracking', 'currentSubtaskSession');
      await setDoc(sessionRef, session);

      setTrackingSubtask({ taskId, subtaskId, subtaskTitle });
      setCurrentSubtaskElapsedSeconds(0);
      setIsTrackingSubtask(true);
      setSubtaskStartTime(now);

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'START_SUBTASK_TIME_TRACKING',
          session
        });
      }

      toast({
        title: "Time tracking started",
        description: `Now tracking time for subtask "${subtaskTitle}"`,
      });
    } catch (error) {
      console.error("Error starting subtask tracking:", error);
      toast({
        title: "Failed to start tracking",
        variant: "destructive",
      });
    }
  };

  const pauseSubtaskTracking = async () => {
    if (!trackingSubtask || !user || !subtaskStartTime) return;

    try {
      const now = Date.now();
      const sessionElapsed = Math.floor((now - subtaskStartTime) / 1000);
      const totalAccumulated = currentSubtaskElapsedSeconds;

      const sessionRef = doc(db, 'users', user.uid, 'activeTracking', 'currentSubtaskSession');
      const snapshot = await getDoc(sessionRef);

      if (snapshot.exists()) {
        await setDoc(sessionRef, {
          ...snapshot.data(),
          pausedAt: now,
          isPaused: true,
          accumulatedSeconds: totalAccumulated,
        });
      }

      setIsTrackingSubtask(false);
      setSubtaskStartTime(null);

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'PAUSE_SUBTASK_TIME_TRACKING'
        });
      }

      toast({
        title: "Time tracking paused",
        description: `Paused tracking for "${trackingSubtask.subtaskTitle}"`,
      });
    } catch (error) {
      console.error("Error pausing subtask tracking:", error);
      toast({
        title: "Failed to pause tracking",
        variant: "destructive",
      });
    }
  };

  const resumeSubtaskTracking = async () => {
    if (!trackingSubtask || !user) return;

    try {
      const now = Date.now();
      const sessionRef = doc(db, 'users', user.uid, 'activeTracking', 'currentSubtaskSession');
      const snapshot = await getDoc(sessionRef);

      if (snapshot.exists()) {
        await setDoc(sessionRef, {
          ...snapshot.data(),
          startTime: now,
          pausedAt: null,
          isPaused: false,
        });
      }

      setIsTrackingSubtask(true);
      setSubtaskStartTime(now);

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'RESUME_SUBTASK_TIME_TRACKING'
        });
      }

      toast({
        title: "Time tracking resumed",
        description: `Resumed tracking for "${trackingSubtask.subtaskTitle}"`,
      });
    } catch (error) {
      console.error("Error resuming subtask tracking:", error);
      toast({
        title: "Failed to resume tracking",
        variant: "destructive",
      });
    }
  };

  const stopSubtaskTracking = async () => {
    if (!trackingSubtask || !user) {
      setTrackingSubtask(null);
      setCurrentSubtaskElapsedSeconds(0);
      setIsTrackingSubtask(false);
      setSubtaskStartTime(null);
      return;
    }

    try {
      const sessionRef = doc(db, 'users', user.uid, 'activeTracking', 'currentSubtaskSession');
      const snapshot = await getDoc(sessionRef);

      let finalSeconds = currentSubtaskElapsedSeconds;

      if (snapshot.exists() && !isTrackingSubtask) {
        const session = snapshot.data() as ActiveSubtaskTrackingSession;
        finalSeconds = session.accumulatedSeconds;
      } else if (subtaskStartTime && isTrackingSubtask) {
        const sessionElapsed = Math.floor((Date.now() - subtaskStartTime) / 1000);
        const session = snapshot.exists() ? snapshot.data() as ActiveSubtaskTrackingSession : null;
        const accumulated = session?.accumulatedSeconds || 0;
        finalSeconds = accumulated + sessionElapsed;
      }

      if (finalSeconds > 0) {
        await updateSubtaskTimeSpent(trackingSubtask.taskId, trackingSubtask.subtaskId, finalSeconds);
        const formattedTime = getFormattedTime(finalSeconds);

        toast({
          title: "Time tracking stopped",
          description: `Saved ${formattedTime} for subtask "${trackingSubtask.subtaskTitle}"`,
        });
      }

      await deleteDoc(sessionRef);

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'STOP_SUBTASK_TIME_TRACKING'
        });
      }
    } catch (error) {
      console.error("Error stopping subtask tracking:", error);
      toast({
        title: "Failed to save time",
        description: "Could not save the tracked time. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTrackingSubtask(null);
      setCurrentSubtaskElapsedSeconds(0);
      setIsTrackingSubtask(false);
      setSubtaskStartTime(null);
    }
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