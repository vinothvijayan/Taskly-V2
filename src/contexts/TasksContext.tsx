import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
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
  FieldValue,
  writeBatch
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
import { startOfDay, isSameDay, endOfDay } from "date-fns";

interface TasksContextType {
  tasks: Task[]; // Tasks for the current user (personal + assigned)
  allTeamAndPersonalTasks: Task[]; // All tasks for leaderboard
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
  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtaskStatus: (taskId: string, subtaskId: string, autoSaveTimeFromTracker?: { currentSeconds: number, stopTracking: () => Promise<void> }) => Promise<void>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  updateSubtaskTimeSpent: (taskId: string, subtaskId: string, timeToAdd: number) => Promise<void>;
  updateTaskLastCommentedAt: (taskId: string, timestamp: string) => Promise<void>;
  resetAllLeaderboardScores: () => Promise<void>;
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
  const [personalTasks, setPersonalTasks] = useState<Task[]>([]);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTaskFormActive, setIsTaskFormActive] = useState(false);
  const { user, userProfile } = useAuth();
  const { addNotification } = useNotifications();
  const { toast } = useToast();
  const { playSound, preloadCommonSounds } = useSound();
  const { showConfetti } = useConfetti();

  const sortTasks = (tasksArray: Task[]): Task[] => {
    const getDueDateCategory = (task: Task): number => {
      if (!task.dueDate) return 4;
      const dueDate = startOfDay(new Date(task.dueDate));
      const today = startOfDay(new Date());
      if (dueDate < today) return 1;
      if (isSameDay(dueDate, today)) return 2;
      return 3;
    };
    return tasksArray.sort((a, b) => {
      const aDueDateCategory = getDueDateCategory(a);
      const bDueDateCategory = getDueDateCategory(b);
      if (aDueDateCategory !== bDueDateCategory) return aDueDateCategory - bDueDateCategory;
      if (aDueDateCategory === 3 && a.dueDate && b.dueDate) {
        const aDueDate = new Date(a.dueDate).getTime();
        const bDueDate = new Date(b.dueDate).getTime();
        if (aDueDate !== bDueDate) return aDueDate - bDueDate;
      }
      const aHasUnread = hasUnreadComments(a);
      const bHasUnread = hasUnreadComments(b);
      if (aHasUnread !== bHasUnread) return aHasUnread ? -1 : 1;
      const priorityOrder = { "high": 3, "medium": 2, "low": 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[b.priority] - priorityOrder[a.priority];
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (user && userProfile) {
      unsubscribe = setupRealtimeListeners();
      preloadCommonSounds();
    } else {
      setPersonalTasks([]);
      setTeamTasks([]);
      setTeamMembers([]);
      setLoading(false);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, userProfile, preloadCommonSounds]);

  const setupRealtimeListeners = useCallback(() => {
    if (!user || !userProfile) return;

    setLoading(true);
    const unsubscribeFunctions: Unsubscribe[] = [];

    const personalTasksQuery = query(collection(db, 'users', user.uid, 'tasks'));
    const personalTasksUnsubscribe = onSnapshot(personalTasksQuery, (snapshot) => {
      const tasks: Task[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setPersonalTasks(tasks);
      setLoading(false);
    }, (error) => {
      console.error("Error in personal tasks listener:", error);
      toast({ title: "Connection error", description: "Lost connection to personal tasks.", variant: "destructive" });
      setLoading(false);
    });
    unsubscribeFunctions.push(personalTasksUnsubscribe);

    if (userProfile.teamId) {
      const teamTasksQuery = query(collection(db, 'teams', userProfile.teamId, 'tasks'));
      const teamTasksUnsubscribe = onSnapshot(teamTasksQuery, (snapshot) => {
        const tasks: Task[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        setTeamTasks(tasks);
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
      setTeamTasks([]);
      setTeamMembers([]);
    }

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [user, userProfile, toast]);

  const tasksForCurrentUser = useMemo(() => {
    if (!user) return [];
    const myTeamTasks = teamTasks.filter(task => task.assignedTo?.includes(user.uid) || task.createdBy === user.uid);
    return sortTasks([...personalTasks, ...myTeamTasks]);
  }, [personalTasks, teamTasks, user]);

  const allTeamAndPersonalTasks = useMemo(() => {
    return [...personalTasks, ...teamTasks];
  }, [personalTasks, teamTasks]);

  const addTask = useCallback(async (taskData: Omit<Task, "id" | "createdAt">) => {
    if (!user || !userProfile) return;
    const isTeamTask = !!(userProfile.teamId && taskData.assignedTo && taskData.assignedTo.length > 0);
    const newTask: Omit<Task, 'id'> = {
      ...taskData,
      assignedTo: taskData.assignedTo || [],
      teamId: isTeamTask ? userProfile.teamId : undefined,
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
      status: 'todo',
      priority: taskData.priority || 'medium',
      subtasks: taskData.subtasks || [],
    };
    toast({ title: "Task created", description: "Your task is being saved..." });
    try {
      const collectionPath = isTeamTask ? `teams/${userProfile.teamId}/tasks` : `users/${user.uid}/tasks`;
      const docRef = await addDoc(collection(db, collectionPath), newTask);
      if (newTask.dueDate) {
        notificationService.scheduleTaskReminder({ ...newTask, id: docRef.id }, 15);
        notificationService.scheduleTaskDueNotification({ ...newTask, id: docRef.id });
      }
      if (newTask.assignedTo && newTask.assignedTo.length > 0) {
        const assignerName = userProfile.displayName || user.email || 'Someone';
        for (const assignedUserId of newTask.assignedTo) {
          if (assignedUserId !== user.uid) {
            notificationService.handleTaskAssignment({ ...newTask, id: docRef.id }, assignerName, assignedUserId);
          }
        }
      }
    } catch (error) {
      console.error("Error adding task:", error);
      toast({ title: "Failed to create task", variant: "destructive" });
    }
  }, [user, userProfile, toast]);

  const updateTask = useCallback(async (taskId: string, taskData: Partial<Task>) => {
    if (!user || !userProfile) return;
    const originalTask = [...personalTasks, ...teamTasks].find(t => t.id === taskId);
    if (!originalTask) return;
    try {
      const newAssignedTo = taskData.assignedTo || originalTask.assignedTo || [];
      const shouldBeTeamTask = !!(userProfile.teamId && newAssignedTo.length > 0);
      const targetTeamId = shouldBeTeamTask ? userProfile.teamId : null;
      const updatedTask = { ...originalTask, ...taskData, teamId: targetTeamId || undefined };
      const movingCollections = (originalTask.teamId || null) !== (updatedTask.teamId || null);
      const cleanedTaskData: any = { ...taskData, teamId: updatedTask.teamId || deleteField() };
      if (movingCollections) {
        const currentTaskRef = doc(db, originalTask.teamId ? `teams/${originalTask.teamId}/tasks` : `users/${user.uid}/tasks`, taskId);
        await deleteDoc(currentTaskRef);
        const newTaskRef = doc(db, updatedTask.teamId ? `teams/${updatedTask.teamId}/tasks` : `users/${user.uid}/tasks`, taskId);
        const { id, ...dataForFirestore } = updatedTask;
        await setDoc(newTaskRef, dataForFirestore);
      } else {
        const taskRef = doc(db, originalTask.teamId ? `teams/${originalTask.teamId}/tasks` : `users/${user.uid}/tasks`, taskId);
        await updateDoc(taskRef, cleanedTaskData);
      }
      toast({ title: "Task updated", description: "Your changes have been saved." });
    } catch (error) {
      console.error("Error updating task:", error);
      toast({ title: "Failed to update task", variant: "destructive" });
    }
  }, [user, userProfile, personalTasks, teamTasks, toast]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!user) return;
    const taskToDelete = [...personalTasks, ...teamTasks].find(t => t.id === taskId);
    if (!taskToDelete) return;
    try {
      const taskRefPath = taskToDelete.teamId ? `teams/${taskToDelete.teamId}/tasks/${taskId}` : `users/${user.uid}/tasks/${taskId}`;
      await deleteDoc(doc(db, taskRefPath));
      notificationService.clearScheduledNotification(`task-reminder-${taskId}`);
      notificationService.clearScheduledNotification(`task-due-${taskId}`);
      toast({ title: "Task deleted", variant: "destructive" });
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({ title: "Failed to delete task", variant: "destructive" });
    }
  }, [user, personalTasks, teamTasks, toast]);

  const toggleTaskStatus = useCallback(async (taskId: string, options?: { playSound?: boolean }) => {
    if (!user) return;
    const originalTask = [...personalTasks, ...teamTasks].find(t => t.id === taskId);
    if (!originalTask) return;
    const newStatus: Task["status"] = originalTask.status === "completed" ? "todo" : "completed";
    const completedAt = newStatus === "completed" ? new Date().toISOString() : deleteField();
    try {
      if (newStatus === "completed") {
        if (options?.playSound !== false) playSound(TASK_COMPLETE_SOUND_URL);
        showConfetti();
        notificationService.showTaskCompleteNotification(originalTask.title);
        await addNotification({ title: "Task completed! 🎯", body: `Great job completing "${originalTask.title}"!`, type: 'task-complete', read: false, data: { taskId, taskTitle: originalTask.title } }, user.uid);
      }
      const taskRefPath = originalTask.teamId ? `teams/${originalTask.teamId}/tasks/${taskId}` : `users/${user.uid}/tasks/${taskId}`;
      await updateDoc(doc(db, taskRefPath), { status: newStatus, completedAt });
    } catch (error) {
      console.error("Error toggling task status:", error);
      toast({ title: "Failed to update task", variant: "destructive" });
    }
  }, [user, personalTasks, teamTasks, playSound, showConfetti, addNotification, toast]);

  const toggleTaskPriority = useCallback(async (taskId: string) => {
    if (!user) return;
    const originalTask = [...personalTasks, ...teamTasks].find(t => t.id === taskId);
    if (!originalTask) return;
    const newPriority = originalTask.priority === "high" ? "medium" : "high";
    try {
      const taskRefPath = originalTask.teamId ? `teams/${originalTask.teamId}/tasks/${taskId}` : `users/${user.uid}/tasks/${taskId}`;
      await updateDoc(doc(db, taskRefPath), { priority: newPriority });
    } catch (error) {
      console.error("Error toggling task priority:", error);
      toast({ title: "Failed to update priority", variant: "destructive" });
    }
  }, [user, personalTasks, teamTasks, toast]);

  const updateTaskTimeSpent = useCallback(async (taskId: string, timeToAdd: number) => {
    if (!user) return;
    const originalTask = [...personalTasks, ...teamTasks].find(t => t.id === taskId);
    if (!originalTask) return;
    try {
      const taskRefPath = originalTask.teamId ? `teams/${originalTask.teamId}/tasks/${taskId}` : `users/${user.uid}/tasks/${taskId}`;
      await updateDoc(doc(db, taskRefPath), { timeSpent: (originalTask.timeSpent || 0) + timeToAdd });
    } catch (error) {
      console.error("Error updating task time:", error);
      throw error;
    }
  }, [user, personalTasks, teamTasks]);

  const addSubtask = useCallback(async (taskId: string, title: string) => {
    const task = [...personalTasks, ...teamTasks].find(t => t.id === taskId);
    if (!task) return;
    const newSubtask: Subtask = { id: `sub-${Date.now()}`, title, isCompleted: false, createdAt: new Date().toISOString() };
    await updateTask(taskId, { subtasks: [...(task.subtasks || []), newSubtask] });
    toast({ title: "Subtask added!" });
  }, [updateTask, personalTasks, teamTasks, toast]);

  const toggleSubtaskStatus = useCallback(async (taskId: string, subtaskId: string, autoSaveTimeFromTracker?: { currentSeconds: number, stopTracking: () => Promise<void> }) => {
    const task = [...personalTasks, ...teamTasks].find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    let timeToAdd = 0;
    if (autoSaveTimeFromTracker) {
      const subtask = task.subtasks.find(s => s.id === subtaskId);
      if (subtask && !subtask.isCompleted) {
        timeToAdd = autoSaveTimeFromTracker.currentSeconds;
        await autoSaveTimeFromTracker.stopTracking();
      }
    }
    const updatedSubtasks = task.subtasks.map(sub => {
      if (sub.id === subtaskId) {
        const isCompleting = !sub.isCompleted;
        if (isCompleting) playSound(TASK_COMPLETE_SOUND_URL);
        return { ...sub, isCompleted: isCompleting, completedAt: isCompleting ? new Date().toISOString() : undefined, timeSpent: (sub.timeSpent || 0) + timeToAdd };
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
  }, [personalTasks, teamTasks, updateTask, toggleTaskStatus, playSound, toast]);

  const deleteSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    const task = [...personalTasks, ...teamTasks].find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    const updatedSubtasks = task.subtasks.filter(sub => sub.id !== subtaskId);
    await updateTask(taskId, { subtasks: updatedSubtasks });
    toast({ title: "Subtask deleted!", variant: "destructive" });
  }, [personalTasks, teamTasks, updateTask, toast]);

  const updateSubtaskTimeSpent = useCallback(async (taskId: string, subtaskId: string, timeToAdd: number) => {
    const task = [...personalTasks, ...teamTasks].find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    const updatedSubtasks = task.subtasks.map(sub => sub.id === subtaskId ? { ...sub, timeSpent: (sub.timeSpent || 0) + timeToAdd } : sub);
    await updateTask(taskId, { subtasks: updatedSubtasks });
  }, [personalTasks, teamTasks, updateTask]);

  const updateTaskLastCommentedAt = useCallback(async (taskId: string, timestamp: string) => {
    const taskToUpdate = [...personalTasks, ...teamTasks].find(t => t.id === taskId);
    if (!taskToUpdate) return;
    const currentLastCommentedAt = taskToUpdate.lastCommentedAt ? new Date(taskToUpdate.lastCommentedAt).getTime() : 0;
    const newCommentTimestamp = new Date(timestamp).getTime();
    if (newCommentTimestamp > currentLastCommentedAt) {
      await updateTask(taskId, { lastCommentedAt: timestamp });
    }
  }, [personalTasks, teamTasks, updateTask]);

  const resetAllLeaderboardScores = useCallback(async () => {
    if (!user || !userProfile || userProfile.role !== 'admin') {
        toast({ title: "Permission Denied", description: "Only admins can reset the leaderboard.", variant: "destructive" });
        return;
    }
    const teamId = userProfile.teamId;
    if (!teamId) {
        toast({ title: "No Team Found", description: "You must be in a team to reset a leaderboard.", variant: "destructive" });
        return;
    }
    toast({ title: "Resetting scores...", description: "This may take a moment." });
    try {
        const batch = writeBatch(db);
        const teamTasksRef = collection(db, 'teams', teamId, 'tasks');
        const tasksSnapshot = await getDocs(teamTasksRef);
        if (tasksSnapshot.empty) {
            toast({ title: "No tasks to reset." });
            return;
        }
        tasksSnapshot.forEach(taskDoc => {
            const taskData = taskDoc.data() as Task;
            const updatedSubtasks = taskData.subtasks?.map(sub => ({ ...sub, timeSpent: 0 })) || [];
            batch.update(taskDoc.ref, { timeSpent: 0, subtasks: updatedSubtasks });
        });
        await batch.commit();
        toast({ title: "Leaderboard Reset!", description: "All team scores have been reset to zero." });
    } catch (error) {
        console.error("Error resetting leaderboard scores:", error);
        toast({ title: "Reset Failed", description: "An error occurred while resetting scores.", variant: "destructive" });
    }
  }, [user, userProfile, toast]);

  const getTasksByDateRange = (startDate: Date, endDate: Date): Task[] => allTeamAndPersonalTasks.filter(task => {
    const taskDate = new Date(task.createdAt);
    return taskDate >= startDate && taskDate <= endDate;
  });

  const getTasksByStatus = (status: Task["status"]): Task[] => allTeamAndPersonalTasks.filter(task => task.status === status);
  const getTasksByPriority = (priority: Task["priority"]): Task[] => allTeamAndPersonalTasks.filter(task => task.priority === priority);

  const getTasksCompletedOnDate = (date: Date): Task[] => {
    const start = startOfDay(date);
    const end = endOfDay(date);
    return allTeamAndPersonalTasks.filter(task => {
      if (task.status !== "completed" || typeof task.completedAt !== 'string') return false;
      const taskDate = new Date(task.completedAt);
      return taskDate >= start && taskDate <= end;
    });
  };

  const getTotalTasksCount = (): number => allTeamAndPersonalTasks.length;
  const getCompletedTasksCount = (): number => allTeamAndPersonalTasks.filter(task => task.status === "completed").length;
  const getActiveTasksCount = (): number => allTeamAndPersonalTasks.filter(task => task.status !== "completed").length;

  const getCurrentStreak = (): number => {
    if (allTeamAndPersonalTasks.length === 0) return 0;
    let streak = 0;
    let currentDate = new Date();
    while (getTasksCompletedOnDate(currentDate).length > 0) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    return streak;
  };

  const getLongestStreak = (): number => {
    if (allTeamAndPersonalTasks.length === 0) return 0;
    const completedDates = [...new Set(allTeamAndPersonalTasks.filter(t => t.status === 'completed' && typeof t.completedAt === 'string').map(t => new Date(t.completedAt as string).setHours(0, 0, 0, 0)))].sort((a,b) => a - b);
    if (completedDates.length === 0) return 0;
    let longestStreak = 0;
    let currentStreak = 1;
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
  
  const value = {
    tasks: tasksForCurrentUser,
    allTeamAndPersonalTasks,
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
    resetAllLeaderboardScores,
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