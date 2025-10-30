import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  doc,
  getDoc,
  query,
  orderBy,
  where,
  deleteField,
  setDoc,
  onSnapshot,
  Unsubscribe,
  FieldValue // Import FieldValue
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Task, Subtask } from "@/types"; // Import Subtask
import { useToast } from "@/hooks/use-toast";
import { notificationService } from "@/lib/notifications";
import { useSound } from "@/hooks/useSound";
import { TASK_COMPLETE_SOUND_URL } from "@/lib/utils";
import { UserProfile, Team } from "@/types";
import { useNotifications } from "@/contexts/NotificationsContext";
import { hasUnreadComments } from '@/lib/viewedTimestamps';
import { useConfetti } from '@/contexts/ConfettiContext';
import { startOfDay, isSameDay, endOfDay, addMinutes, addDays } from "date-fns";
import { Capacitor } from '@capacitor/core';
import { capacitorNotifications } from '@/lib/capacitorNotifications';

interface TasksContextType {
  tasks: Task[];
  teamMembers: UserProfile[];
  loading: boolean;
  isTaskFormActive: boolean;
  setTaskFormActive: (active: boolean) => void;
  addTask: (taskData: Omit<Task, "id" | "createdAt">) => Promise<void>;
  updateTask: (taskId: string, taskData: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskStatus: (taskId: string, options?: { playSound?: boolean }) => Promise<void>;
  toggleTaskPriority: (taskId: string) => Promise<void>;
  updateTaskTimeSpent: (taskId: string, timeToAdd: number) => Promise<void>;
  addSubtask: (taskId: string, title: string) => Promise<void>; // New
  toggleSubtaskStatus: (taskId: string, subtaskId: string, autoSaveTimeFromTracker?: { stopTracking: () => Promise<void> }) => Promise<void>; // Modified
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>; // New
  updateSubtaskTimeSpent: (taskId: string, subtaskId: string, timeToAdd: number) => Promise<void>; // New
  updateTaskLastCommentedAt: (taskId: string, timestamp: string) => Promise<void>; // New
  getTasksByDateRange: (startDate: Date, endDate: Date) => Task[];
  getTasksByStatus: (status: Task["status"]) => Task[];
  getTasksByPriority: (priority: Task["priority"]) => Task[];
  getTasksCompletedOnDate: (date: Date) => Task[];
  getTotalTasksCount: () => number;
  getCompletedTasksCount: () => number;
  getActiveTasksCount: () => number;
  getCurrentStreak: () => number;
  getLongestStreak: () => number;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export function TasksContextProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTaskFormActive, setIsTaskFormActive] = useState(false);
  const { user, userProfile } = useAuth();
  const { addNotification } = useNotifications();
  const { toast } = useToast();
  const { playSound, preloadCommonSounds } = useSound();
  const { showConfetti } = useConfetti();

  // Helper for consistent task sorting
  const sortTasks = (tasksArray: Task[]): Task[] => {
    const getDueDateCategory = (task: Task): number => {
      if (!task.dueDate) {
        return 4; // No due date, lowest priority
      }
      const dueDate = startOfDay(new Date(task.dueDate));
      const today = startOfDay(new Date());

      if (dueDate < today) {
        return 1; // Overdue, highest priority
      }
      if (isSameDay(dueDate, today)) {
        return 2; // Due today
      }
      return 3; // Due in the future
    };

    return tasksArray.sort((a, b) => {
      // 1. Sort by Due Date Category (Overdue > Today > Future > No Date)
      const aDueDateCategory = getDueDateCategory(a);
      const bDueDateCategory = getDueDateCategory(b);
      if (aDueDateCategory !== bDueDateCategory) {
        return aDueDateCategory - bDueDateCategory;
      }

      // If tasks are due in the future, sort by soonest due date
      if (aDueDateCategory === 3 && a.dueDate && b.dueDate) {
        const aDueDate = new Date(a.dueDate).getTime();
        const bDueDate = new Date(b.dueDate).getTime();
        if (aDueDate !== bDueDate) {
          return aDueDate - bDueDate;
        }
      }

      // 2. Sort by Unread comments (true comes before false)
      const aHasUnread = hasUnreadComments(a);
      const bHasUnread = hasUnreadComments(b);
      if (aHasUnread !== bHasUnread) {
        return aHasUnread ? -1 : 1;
      }

      // 3. Sort by priority (high > medium > low)
      const priorityOrder = { "high": 3, "medium": 2, "low": 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }

      // 4. Sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  // CRITICAL FIX: Correctly handle listener cleanup to prevent memory leaks
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (user && userProfile) {
      unsubscribe = setupRealtimeListeners();
      preloadCommonSounds(); // Preload sounds when user logs in
    } else {
      setTasks([]);
      setTeamMembers([]);
      setLoading(false);
    }
    
    // This cleanup function will run when the component unmounts or dependencies change
    return () => {
      if (unsubscribe) {
        console.log("Cleaning up all real-time listeners.");
        unsubscribe();
      }
    };
  }, [user, userProfile, preloadCommonSounds]);

  const setupRealtimeListeners = useCallback(() => {
    if (!user || !userProfile) return;

    setLoading(true);
    const unsubscribeFunctions: Unsubscribe[] = [];
    
    const personalTasksQuery = query(
      collection(db, 'users', user.uid, 'tasks'),
      orderBy('createdAt', 'desc') // Initial order for fetching, will be re-sorted locally
    );
    
    const personalTasksUnsubscribe = onSnapshot(personalTasksQuery, (snapshot) => {
      const personalTasks: Task[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      
      setTasks(prevTasks => {
        const teamTasks = prevTasks.filter(task => task.teamId);
        const allTasks = [...personalTasks, ...teamTasks];
        return sortTasks(allTasks); // Use new sort function
      });
      setLoading(false);
    }, (error) => {
      console.error("Error in personal tasks listener:", error);
      toast({ title: "Connection error", description: "Lost connection to personal tasks.", variant: "destructive" });
      setLoading(false);
    });
    unsubscribeFunctions.push(personalTasksUnsubscribe);
    
    if (userProfile.teamId) {
      const teamTasksQuery = query(
        collection(db, 'teams', userProfile.teamId, 'tasks'),
        orderBy('createdAt', 'desc') // Re-sort locally
      );
      
      const teamTasksUnsubscribe = onSnapshot(teamTasksQuery, (snapshot) => {
        const teamTasks: Task[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        
        setTasks(prevTasks => {
          const personalTasks = prevTasks.filter(task => !task.teamId);
          const allTasks = [...personalTasks, ...teamTasks];
          return sortTasks(allTasks); // Use new sort function
        });
      }, (error) => {
        console.error("Error in team tasks listener:", error);
        toast({ title: "Team connection error", description: "Lost connection to team tasks.", variant: "destructive" });
      });
      unsubscribeFunctions.push(teamTasksUnsubscribe);

      const teamDocRef = doc(db, 'teams', userProfile.teamId);
      const teamMembersUnsubscribe = onSnapshot(teamDocRef, async (teamDoc) => {
        if (teamDoc.exists()) {
          const teamData = teamDoc.data() as Team;
          const memberUids = teamData.memberIds || [];
          if (memberUids.length > 0) {
            const memberDocsPromises = memberUids.map(uid => getDoc(doc(db, 'users', uid)));
            const memberDocsSnaps = await Promise.all(memberDocsPromises);
            const fetchedMembers = memberDocsSnaps.filter(snap => snap.exists()).map(snap => snap.data() as UserProfile);
            setTeamMembers(fetchedMembers);
          } else {
            setTeamMembers([]);
          }
        } else {
          setTeamMembers([]);
        }
      }, (error) => {
        console.error("Error in team members listener:", error);
        setTeamMembers([]);
      });
      unsubscribeFunctions.push(teamMembersUnsubscribe);
    } else {
      setTeamMembers([]);
    }
    
    // Return a single function that unsubscribes from all listeners
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [user, userProfile, toast]);

  const addTask = useCallback(async (taskData: Omit<Task, "id" | "createdAt">) => {
    if (!user || !userProfile) return;

    const tempId = `temp-${Date.now()}`;
    const isTeamTask = !!userProfile.teamId;
    
    const newTask: Task = {
      ...taskData,
      id: tempId,
      assignedTo: taskData.assignedTo || [],
      teamId: isTeamTask ? userProfile.teamId : undefined,
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
      status: 'todo',
      priority: taskData.priority || 'medium',
      subtasks: taskData.subtasks || [], // Initialize subtasks
    };

    setTasks(prev => sortTasks([newTask, ...prev]));
    toast({ title: "Task created", description: "Your task is being saved..." });

    try {
      const { id, ...firestoreData } = newTask;
      if (!firestoreData.teamId) delete firestoreData.teamId;

      const collectionPath = isTeamTask ? `teams/${userProfile.teamId}/tasks` : `users/${user.uid}/tasks`;
      const docRef = await addDoc(collection(db, collectionPath), firestoreData);
      
      const finalTask = { ...newTask, id: docRef.id };
      setTasks(prev => sortTasks(prev.map(task => (task.id === tempId ? finalTask : task))));

      if (isTeamTask) {
        const { logActivity } = await import('@/lib/activityLogger');
        logActivity(
          userProfile.teamId!,
          'TASK_CREATED',
          { uid: user.uid, displayName: userProfile.displayName || user.email!, photoURL: userProfile.photoURL },
          { task: { id: docRef.id, title: finalTask.title } }
        );
      }

      if (finalTask.dueDate) {
        if (Capacitor.isNativePlatform()) {
          capacitorNotifications.scheduleTaskReminder(finalTask.id, finalTask.title, `Your task is due now.`, new Date(finalTask.dueDate));
        } else {
          notificationService.scheduleTaskReminder(finalTask, 15);
          notificationService.scheduleTaskDueNotification(finalTask);
        }
      }

      if (finalTask.assignedTo && finalTask.assignedTo.length > 0) {
        const assignerName = userProfile.displayName || user.email || 'Someone';
        for (const assignedUserId of finalTask.assignedTo) {
          if (assignedUserId !== user.uid) {
            notificationService.handleTaskAssignment(finalTask, assignerName, assignedUserId);
          }
        }
      }
    } catch (error) {
      setTasks(prev => sortTasks(prev.filter(task => task.id !== tempId)));
      console.error("Error adding task:", error);
      toast({ title: "Failed to create task", variant: "destructive" });
    }
  }, [user, userProfile, toast]);

  const updateTask = useCallback(async (taskId: string, taskData: Partial<Task>) => {
    if (!user || !userProfile) {
      toast({ title: "Authentication required", variant: "destructive" });
      return;
    }

    let originalTask: Task | undefined;
    let updatedTaskForState: Task | undefined;

    setTasks(prevTasks => {
      originalTask = prevTasks.find(t => t.id === taskId);
      if (!originalTask) return prevTasks;

      const newAssignedTo = taskData.assignedTo || originalTask.assignedTo || [];
      const shouldBeTeamTask = !!(userProfile.teamId && newAssignedTo.length > 0);
      const targetTeamId = shouldBeTeamTask ? userProfile.teamId : null;

      updatedTaskForState = { ...originalTask, ...taskData, teamId: targetTeamId || undefined };
      if (!updatedTaskForState.teamId) delete updatedTaskForState.teamId;

      return sortTasks(prevTasks.map(t => (t.id === taskId ? updatedTaskForState! : t)));
    });

    if (!originalTask || !updatedTaskForState) return;

    try {
      const originalAssignedTo = originalTask.assignedTo || [];
      const newAssignedTo = updatedTaskForState.assignedTo || [];
      const newlyAssignedUsers = newAssignedTo.filter(userId => !originalAssignedTo.includes(userId));

      if (newlyAssignedUsers.length > 0) {
        const assignerName = userProfile.displayName || user.email || 'Someone';
        for (const assignedUserId of newlyAssignedUsers) {
          if (assignedUserId !== user.uid) {
            notificationService.handleTaskAssignment(updatedTaskForState, assignerName, assignedUserId);
          }
        }
      }

      const movingCollections = (originalTask.teamId || null) !== (updatedTaskForState.teamId || null);
      
      const dataForFirestore: { [key: string]: any } = { ...taskData };

      if ('estimatedTime' in dataForFirestore) {
        const estTime = Number(dataForFirestore.estimatedTime);
        if (isNaN(estTime) || estTime <= 0) {
          dataForFirestore.estimatedTime = deleteField();
        } else {
          dataForFirestore.estimatedTime = estTime;
        }
      }

      if (dataForFirestore.dueDate === '') {
        dataForFirestore.dueDate = deleteField();
      }

      if ('completedAt' in taskData && taskData.completedAt === undefined && taskData.status !== 'completed') {
        dataForFirestore.completedAt = deleteField();
      }

      dataForFirestore.teamId = updatedTaskForState.teamId || deleteField();
      
      if (movingCollections) {
        const currentTaskRef = doc(db, originalTask.teamId ? `teams/${originalTask.teamId}/tasks` : `users/${user.uid}/tasks`, taskId);
        await deleteDoc(currentTaskRef);
        const newTaskRef = doc(db, updatedTaskForState.teamId ? `teams/${updatedTaskForState.teamId}/tasks` : `users/${user.uid}/tasks`, taskId);
        const { id, ...dataForFirestoreWithMove } = updatedTaskForState;
        
        Object.keys(dataForFirestoreWithMove).forEach(key => {
            if (dataForFirestoreWithMove[key as keyof typeof dataForFirestoreWithMove] === undefined) {
                delete dataForFirestoreWithMove[key as keyof typeof dataForFirestoreWithMove];
            }
        });

        await setDoc(newTaskRef, dataForFirestoreWithMove);
      } else {
        const taskRef = doc(db, originalTask.teamId ? `teams/${originalTask.teamId}/tasks` : `users/${user.uid}/tasks`, taskId);
        await updateDoc(taskRef, dataForFirestore);
      }

      const dueDateChanged = 'dueDate' in taskData && originalTask.dueDate !== taskData.dueDate;
      const statusChangedToCompleted = 'status' in taskData && taskData.status === 'completed';

      // Universal reminder handling
      if (dueDateChanged || statusChangedToCompleted) {
        if (Capacitor.isNativePlatform()) {
          await capacitorNotifications.cancelTaskReminder(taskId);
        } else {
          notificationService.clearScheduledNotification(`task-reminder-${taskId}`);
          notificationService.clearScheduledNotification(`task-due-${taskId}`);
        }
      }

      if (dueDateChanged && !statusChangedToCompleted && updatedTaskForState.dueDate) {
        if (Capacitor.isNativePlatform()) {
          await capacitorNotifications.scheduleTaskReminder(taskId, updatedTaskForState.title, 'Your task is due now.', new Date(updatedTaskForState.dueDate));
        } else {
          notificationService.scheduleTaskReminder(updatedTaskForState, 15);
          notificationService.scheduleTaskDueNotification(updatedTaskForState);
        }
      }

      toast({ title: "Task updated", description: "Your changes have been saved." });
    } catch (error) {
      setTasks(prev => sortTasks(prev.map(t => (t.id === taskId ? originalTask! : t))));
      console.error("Error updating task:", error);
      toast({ title: "Failed to update task", variant: "destructive" });
    }
  }, [user, userProfile, toast]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!user) return;
    
    let taskToDelete: Task | undefined;
    setTasks(prev => {
      taskToDelete = prev.find(t => t.id === taskId);
      return sortTasks(prev.filter(task => task.id !== taskId));
    });

    if (!taskToDelete) return;

    try {
      const taskRefPath = taskToDelete.teamId ? `teams/${taskToDelete.teamId}/tasks/${taskId}` : `users/${user.uid}/tasks/${taskId}`;
      await deleteDoc(doc(db, taskRefPath));
      
      if (Capacitor.isNativePlatform()) {
        await capacitorNotifications.cancelTaskReminder(taskId);
      } else {
        notificationService.clearScheduledNotification(`task-reminder-${taskId}`);
        notificationService.clearScheduledNotification(`task-due-${taskId}`);
      }
      
      toast({ title: "Task deleted", variant: "destructive" });
    } catch (error) {
      setTasks(prev => sortTasks([...prev, taskToDelete!]));
      console.error("Error deleting task:", error);
      toast({ title: "Failed to delete task", variant: "destructive" });
    }
  }, [user, toast]);

  const toggleTaskStatus = useCallback(async (taskId: string, options?: { playSound?: boolean }) => {
    if (!user || !userProfile) return;

    let originalTask: Task | undefined;
    let updatedTaskForState: Task | undefined;

    setTasks(prev => {
      originalTask = prev.find(t => t.id === taskId);
      if (!originalTask) return prev;

      const newStatus: Task["status"] = originalTask.status === "completed" ? "todo" : "completed";
      updatedTaskForState = { ...originalTask, status: newStatus };
      if (newStatus === "completed") {
        updatedTaskForState.completedAt = new Date().toISOString();
      } else {
        delete updatedTaskForState.completedAt;
      }
      return sortTasks(prev.map(t => (t.id === taskId ? updatedTaskForState! : t)));
    });

    if (!originalTask || !updatedTaskForState) return;

    try {
      if (updatedTaskForState.status === "completed") {
        if (options?.playSound !== false) playSound(TASK_COMPLETE_SOUND_URL);
        showConfetti();
        notificationService.showTaskCompleteNotification(originalTask.title);
        await addNotification(
          { title: "Task completed! 🎯", body: `Great job completing "${originalTask.title}"!`, type: 'task-complete', read: false, data: { taskId, taskTitle: originalTask.title } },
          user.uid
        );

        if (originalTask.teamId) {
          const { logActivity } = await import('@/lib/activityLogger');
          logActivity(
            originalTask.teamId,
            'TASK_COMPLETED',
            { uid: user.uid, displayName: userProfile.displayName || user.email!, photoURL: userProfile.photoURL },
            { task: { id: originalTask.id, title: originalTask.title } }
          );
        }
        if (Capacitor.isNativePlatform()) {
          await capacitorNotifications.cancelTaskReminder(taskId);
        }
      }

      const taskRefPath = originalTask.teamId ? `teams/${originalTask.teamId}/tasks/${taskId}` : `users/${user.uid}/tasks/${taskId}`;
      const updateData: any = { 
        status: updatedTaskForState.status, 
        completedAt: updatedTaskForState.status === 'completed' ? updatedTaskForState.completedAt : deleteField() 
      };
      await updateDoc(doc(db, taskRefPath), updateData);
    } catch (error) {
      setTasks(prev => sortTasks(prev.map(t => (t.id === taskId ? originalTask! : t))));
      console.error("Error toggling task status:", error);
      toast({ title: "Failed to update task", variant: "destructive" });
    }
  }, [user, userProfile, playSound, showConfetti, addNotification, toast]);

  const toggleTaskPriority = useCallback(async (taskId: string) => {
    if (!user) return;
    
    let originalTask: Task | undefined;
    setTasks(prev => {
      originalTask = prev.find(t => t.id === taskId);
      if (!originalTask) return prev;
      const newPriority = originalTask.priority === "high" ? "medium" : "high";
      return sortTasks(prev.map(t => (t.id === taskId ? { ...t, priority: newPriority } : t)));
    });

    if (!originalTask) return;

    try {
      const taskRefPath = originalTask.teamId ? `teams/${originalTask.teamId}/tasks/${taskId}` : `users/${user.uid}/tasks/${taskId}`;
      await updateDoc(doc(db, taskRefPath), { priority: originalTask.priority === "high" ? "medium" : "high" });
    } catch (error) {
      setTasks(prev => sortTasks(prev.map(t => (t.id === taskId ? originalTask! : t))));
      console.error("Error toggling task priority:", error);
      toast({ title: "Failed to update priority", variant: "destructive" });
    }
  }, [user, toast]);

  const updateTaskTimeSpent = useCallback(async (taskId: string, timeToAdd: number) => {
    if (!user) return;
    
    let originalTask: Task | undefined;
    setTasks(prev => {
      originalTask = prev.find(t => t.id === taskId);
      if (!originalTask) return prev;
      const newTimeSpent = (originalTask.timeSpent || 0) + timeToAdd;
      return sortTasks(prev.map(t => (t.id === taskId ? { ...t, timeSpent: newTimeSpent } : t)));
    });

    if (!originalTask) return;

    try {
      const taskRefPath = originalTask.teamId ? `teams/${originalTask.teamId}/tasks/${taskId}` : `users/${user.uid}/tasks/${taskId}`;
      await updateDoc(doc(db, taskRefPath), { timeSpent: (originalTask.timeSpent || 0) + timeToAdd });
    } catch (error) {
      setTasks(prev => sortTasks(prev.map(t => (t.id === taskId ? originalTask! : t))));
      console.error("Error updating task time:", error);
      throw error;
    }
  }, [user]);

  const addSubtask = useCallback(async (taskId: string, title: string) => {
    const newSubtask: Subtask = { id: `sub-${Date.now()}`, title, isCompleted: false, createdAt: new Date().toISOString() };
    await updateTask(taskId, { subtasks: [...(tasks.find(t => t.id === taskId)?.subtasks || []), newSubtask] });
    toast({ title: "Subtask added!" });
  }, [updateTask, tasks, toast]);

  const toggleSubtaskStatus = useCallback(async (taskId: string, subtaskId: string, autoSaveTimeFromTracker?: { stopTracking: () => Promise<void> }) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;

    if (autoSaveTimeFromTracker) {
      await autoSaveTimeFromTracker.stopTracking();
    }

    const updatedSubtasks = task.subtasks.map(sub => {
      if (sub.id === subtaskId) {
        const isCompleting = !sub.isCompleted;
        if (isCompleting) playSound(TASK_COMPLETE_SOUND_URL);
        return { ...sub, isCompleted: isCompleting, completedAt: isCompleting ? new Date().toISOString() : undefined };
      }
      return sub;
    });

    const allSubtasksCompleted = updatedSubtasks.every(sub => sub.isCompleted);
    if (allSubtasksCompleted && task.status !== 'completed') {
      await updateTask(taskId, { subtasks: updatedSubtasks });
      await toggleTaskStatus(taskId);
      toast({ title: "Subtask updated!", description: "All subtasks completed! Parent task marked as complete." });
    } else if (!allSubtasksCompleted && task.status === 'completed') {
      await updateTask(taskId, { subtasks: updatedSubtasks });
      await toggleTaskStatus(taskId);
      toast({ title: "Subtask updated!", description: "Parent task status reverted to 'todo'." });
    } else {
      await updateTask(taskId, { subtasks: updatedSubtasks });
      toast({ title: "Subtask updated!" });
    }
  }, [tasks, updateTask, toggleTaskStatus, playSound, toast]);

  const deleteSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    const updatedSubtasks = task.subtasks.filter(sub => sub.id !== subtaskId);
    await updateTask(taskId, { subtasks: updatedSubtasks });
    toast({ title: "Subtask deleted!", variant: "destructive" });
  }, [tasks, updateTask, toast]);

  const updateSubtaskTimeSpent = useCallback(async (taskId: string, subtaskId: string, timeToAdd: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    const updatedSubtasks = task.subtasks.map(sub => sub.id === subtaskId ? { ...sub, timeSpent: (sub.timeSpent || 0) + timeToAdd } : sub);
    await updateTask(taskId, { subtasks: updatedSubtasks });
  }, [tasks, updateTask]);

  const updateTaskLastCommentedAt = useCallback(async (taskId: string, timestamp: string) => {
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;
    const currentLastCommentedAt = taskToUpdate.lastCommentedAt ? new Date(taskToUpdate.lastCommentedAt).getTime() : 0;
    const newCommentTimestamp = new Date(timestamp).getTime();
    if (newCommentTimestamp > currentLastCommentedAt) {
      await updateTask(taskId, { lastCommentedAt: timestamp });
    }
  }, [tasks, updateTask]);

  const getTasksByDateRange = (startDate: Date, endDate: Date): Task[] => tasks.filter(task => {
    const taskDate = new Date(task.createdAt);
    return taskDate >= startDate && taskDate <= endDate;
  });

  const getTasksByStatus = (status: Task["status"]): Task[] => tasks.filter(task => task.status === status);
  const getTasksByPriority = (priority: Task["priority"]): Task[] => tasks.filter(task => task.priority === priority);

  const getTasksCompletedOnDate = (date: Date): Task[] => {
    const start = startOfDay(date);
    const end = endOfDay(date);
    return tasks.filter(task => {
      if (task.status !== "completed" || typeof task.completedAt !== 'string') return false;
      const taskDate = new Date(task.completedAt);
      return taskDate >= start && taskDate <= end;
    });
  };

  const getTotalTasksCount = (): number => tasks.length;
  const getCompletedTasksCount = (): number => tasks.filter(task => task.status === "completed").length;
  const getActiveTasksCount = (): number => tasks.filter(task => task.status !== "completed").length;

  const getCurrentStreak = (): number => {
    if (tasks.length === 0) return 0;
    let streak = 0;
    let currentDate = new Date();
    while (getTasksCompletedOnDate(currentDate).length > 0) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    return streak;
  };

  const getLongestStreak = (): number => {
    if (tasks.length === 0) return 0;
    const completedDates = [...new Set(tasks.filter(t => t.status === 'completed' && typeof t.completedAt === 'string').map(t => new Date(t.completedAt as string).setHours(0, 0, 0, 0)))].sort((a,b) => a - b);
    if (completedDates.length === 0) return 0;
    
    let longestStreak = 0;
    let currentStreak = 1; // Start with 1 if there's at least one completed task

    for (let i = 1; i < completedDates.length; i++) {
        const dayInMillis = 86400000;
        if (completedDates[i] - completedDates[i - 1] === dayInMillis) {
            currentStreak++;
        } else {
            longestStreak = Math.max(longestStreak, currentStreak);
            currentStreak = 1;
        }
    }
    return Math.max(longestStreak, currentStreak);
  };
  
  // This useEffect hook is now placed after updateTask is defined.
  useEffect(() => {
    const handleSnooze = (event: CustomEvent) => {
        const { taskId, minutes } = event.detail;
        const task = tasks.find(t => t.id === taskId);
        if (task && task.dueDate) {
            const newDueDate = addMinutes(new Date(task.dueDate), minutes);
            updateTask(taskId, { dueDate: newDueDate.toISOString() });
        }
    };

    const handleReschedule = (event: CustomEvent) => {
        const { taskId, days } = event.detail;
        const task = tasks.find(t => t.id === taskId);
        if (task && task.dueDate) {
            const newDueDate = addDays(new Date(task.dueDate), days);
            updateTask(taskId, { dueDate: newDueDate.toISOString() });
        }
    };

    window.addEventListener('snooze-task', handleSnooze as EventListener);
    window.addEventListener('reschedule-task', handleReschedule as EventListener);

    return () => {
        window.removeEventListener('snooze-task', handleSnooze as EventListener);
        window.removeEventListener('reschedule-task', handleReschedule as EventListener);
    };
  }, [tasks, updateTask]);

  // Effect to schedule reminders for existing tasks on initial load
  useEffect(() => {
    if (!loading && tasks.length > 0) {
      console.log('[Reminder] Initializing reminders for existing tasks...');
      notificationService.scheduleRecurringReminders(tasks);
    }
  }, [loading, tasks]); // Run when loading is finished and tasks are available

  const value = {
    tasks,
    teamMembers,
    loading,
    isTaskFormActive,
    setTaskFormActive: setIsTaskFormActive,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    toggleTaskPriority,
    updateTaskTimeSpent,
    addSubtask,
    toggleSubtaskStatus,
    deleteSubtask,
    updateSubtaskTimeSpent,
    updateTaskLastCommentedAt,
    getTasksByDateRange,
    getTasksByStatus,
    getTasksByPriority,
    getTasksCompletedOnDate,
    getTotalTasksCount,
    getCompletedTasksCount,
    getActiveTasksCount,
    getCurrentStreak,
    getLongestStreak,
  };

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (context === undefined) {
    throw new Error("useTasks must be used within a TasksContextProvider");
  }
  return context;
}