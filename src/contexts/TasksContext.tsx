import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
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

interface TasksContextType {
  tasks: Task[];
  teamMembers: UserProfile[];
  loading: boolean;
  isTaskFormActive: boolean;
  setTaskFormActive: (active: boolean) => void;
  addTask: (taskData: Omit<Task, "id" | "createdAt">) => Promise<void>;
  updateTask: (taskId: string, taskData: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskStatus: (taskId: string) => Promise<void>;
  toggleTaskPriority: (taskId: string) => Promise<void>;
  updateTaskTimeSpent: (taskId: string, timeToAdd: number) => Promise<void>;
  addSubtask: (taskId: string, title: string) => Promise<void>; // New
  toggleSubtaskStatus: (taskId: string, subtaskId: string, autoSaveTimeFromTracker?: { currentSeconds: number, stopTracking: () => Promise<void> }) => Promise<void>; // New
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
    return tasksArray.sort((a, b) => {
      // Primary sort: Unread comments (true comes before false)
      const aHasUnread = hasUnreadComments(a);
      const bHasUnread = hasUnreadComments(b);
      if (aHasUnread !== bHasUnread) {
        return aHasUnread ? -1 : 1;
      }

      // If both have the same "read" status, sort by priority
      const priorityOrder = { "high": 3, "medium": 2, "low": 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }

      // If priority is the same, sort by creation date (newest first)
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

  const setupRealtimeListeners = () => {
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
        where('assignedTo', 'array-contains', user.uid), // <-- ADD THIS LINE
        orderBy('createdAt', 'desc') // Initial order for fetching, will be re-sorted locally
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
  };

  const addTask = async (taskData: Omit<Task, "id" | "createdAt">) => {
    if (!user || !userProfile) return;

    const tempId = `temp-${Date.now()}`;
    const isTeamTask = !!(userProfile.teamId && taskData.assignedTo && taskData.assignedTo.length > 0);
    
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

    setTasks(prev => sortTasks([newTask, ...prev])); // Use new sort function
    toast({ title: "Task created", description: "Your task is being saved..." });

    try {
      const { id, ...firestoreData } = newTask;
      if (!firestoreData.teamId) delete firestoreData.teamId;

      const collectionPath = isTeamTask ? `teams/${userProfile.teamId}/tasks` : `users/${user.uid}/tasks`;
      const docRef = await addDoc(collection(db, collectionPath), firestoreData);
      
      const finalTask = { ...newTask, id: docRef.id };
      setTasks(prev => sortTasks(prev.map(task => (task.id === tempId ? finalTask : task)))); // Use new sort function

      if (finalTask.dueDate) {
        notificationService.scheduleTaskReminder(finalTask, 15);
        notificationService.scheduleTaskDueNotification(finalTask);
      }

      // Send notifications to assigned users upon task creation
      if (finalTask.assignedTo && finalTask.assignedTo.length > 0) {
        const assignerName = userProfile.displayName || user.email || 'Someone';
        for (const assignedUserId of finalTask.assignedTo) {
          if (assignedUserId !== user.uid) {
            console.log('Sending task assignment notification to user:', assignedUserId);
            notificationService.handleTaskAssignment(finalTask, assignerName, assignedUserId);
          }
        }
      }
    } catch (error) {
      setTasks(prev => sortTasks(prev.filter(task => task.id !== tempId))); // Use new sort function
      console.error("Error adding task:", error);
      toast({ title: "Failed to create task", variant: "destructive" });
    }
  };

  const updateTask = async (taskId: string, taskData: Partial<Task>) => {
    if (!user || !userProfile) {
      toast({ title: "Authentication required", variant: "destructive" });
      return;
    }

    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) {
      toast({ title: "Task not found", variant: "destructive" });
      return;
    }

    const originalAssignedTo = taskToUpdate.assignedTo || [];
    const newAssignedTo = taskData.assignedTo || originalAssignedTo;
    
    const shouldBeTeamTask = !!(userProfile.teamId && newAssignedTo.length > 0);
    const targetTeamId = shouldBeTeamTask ? userProfile.teamId : null;
    const movingCollections = (taskToUpdate.teamId || null) !== targetTeamId;

    const updatedTaskForState = { ...taskToUpdate, ...taskData, teamId: targetTeamId || undefined };
    if (!updatedTaskForState.teamId) delete updatedTaskForState.teamId;

    // Perform optimistic UI update first
    setTasks(prev => sortTasks(prev.map(t => (t.id === taskId ? updatedTaskForState : t)))); // Use new sort function

    try {
      // Handle notifications for newly assigned users
      const newlyAssignedUsers = newAssignedTo.filter(userId => !originalAssignedTo.includes(userId));
      if (newlyAssignedUsers.length > 0) {
        const assignerName = userProfile.displayName || user.email || 'Someone';
        
        for (const assignedUserId of newlyAssignedUsers) {
          if (assignedUserId !== user.uid) {
            console.log('Sending task assignment notification to user:', assignedUserId);
            notificationService.handleTaskAssignment(updatedTaskForState, assignerName, assignedUserId);
          }
        }
      }

      // Persist changes to Firestore
      const cleanedTaskData: any = { ...taskData };
      Object.entries(cleanedTaskData).forEach(([key, value]) => {
        if (value === undefined) cleanedTaskData[key] = deleteField();
      });
      cleanedTaskData.teamId = targetTeamId || deleteField();
      
      if (movingCollections) {
        const currentTaskRef = doc(db, taskToUpdate.teamId ? `teams/${taskToUpdate.teamId}/tasks` : `users/${user.uid}/tasks`, taskId);
        await deleteDoc(currentTaskRef);

        const newTaskRef = doc(db, targetTeamId ? `teams/${targetTeamId}/tasks` : `users/${user.uid}/tasks`, taskId);
        const { id, ...dataForFirestore } = updatedTaskForState;
        
        // Clean undefined values for setDoc
        const cleanedData: any = {};
        Object.entries(dataForFirestore).forEach(([key, value]) => {
          if (value !== undefined) {
            cleanedData[key] = value;
          }
        });
        
        await setDoc(newTaskRef, cleanedData);
      } else {
        const taskRef = doc(db, taskToUpdate.teamId ? `teams/${taskToUpdate.teamId}/tasks` : `users/${user.uid}/tasks`, taskId);
        await updateDoc(taskRef, cleanedTaskData);
      }

      toast({ title: "Task updated", description: "Your changes have been saved." });
    } catch (error) {
      // Rollback on failure
      setTasks(prev => sortTasks(prev.map(t => (t.id === taskId ? taskToUpdate : t)))); // Use new sort function
      console.error("Error updating task:", error);
      toast({ title: "Failed to update task", variant: "destructive" });
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!user) return;
    const taskToDelete = tasks.find(t => t.id === taskId);
    if (!taskToDelete) return;

    setTasks(prev => sortTasks(prev.filter(task => task.id !== taskId))); // Use new sort function

    try {
      const taskRefPath = taskToDelete.teamId ? `teams/${taskToDelete.teamId}/tasks/${taskId}` : `users/${user.uid}/tasks/${taskId}`;
      await deleteDoc(doc(db, taskRefPath));
      
      notificationService.clearScheduledNotification(`task-reminder-${taskId}`);
      notificationService.clearScheduledNotification(`task-due-${taskId}`);
      
      toast({ title: "Task deleted", variant: "destructive" });
    } catch (error) {
      setTasks(prev => sortTasks([...prev, taskToDelete])); // Use new sort function
      console.error("Error deleting task:", error);
      toast({ title: "Failed to delete task", variant: "destructive" });
    }
  };

  const toggleTaskStatus = async (taskId: string) => {
    if (!user) return;
    const taskToToggle = tasks.find(t => t.id === taskId);
    if (!taskToToggle) return;

    const originalTask = { ...taskToToggle };
    const newStatus: Task["status"] = taskToToggle.status === "completed" ? "todo" : "completed";

    const updatedTaskForState = { ...taskToToggle, status: newStatus };
    if (newStatus === "completed") {
      updatedTaskForState.completedAt = new Date().toISOString();
    } else {
      delete updatedTaskForState.completedAt;
    }

    setTasks(prev => sortTasks(prev.map(t => (t.id === taskId ? updatedTaskForState : t)))); // Use new sort function

    try {
      if (newStatus === "completed") {
        // Play sound immediately for instant feedback
        playSound(TASK_COMPLETE_SOUND_URL);
        showConfetti();
        notificationService.showTaskCompleteNotification(taskToToggle.title);
        // Use the global notification function to avoid duplicates
        await notificationService.addInAppNotification(
          user.uid,
          "Task completed! 🎯",
          `Great job completing "${taskToToggle.title}"!`,
          'task-complete',
          { taskId, taskTitle: taskToToggle.title }
        );
      }

      const taskRefPath = taskToToggle.teamId ? `teams/${taskToToggle.teamId}/tasks/${taskId}` : `users/${user.uid}/tasks/${taskId}`;
      const updateData: any = { 
        status: newStatus, 
        completedAt: newStatus === 'completed' ? updatedTaskForState.completedAt : deleteField() 
      };
      await updateDoc(doc(db, taskRefPath), updateData);
    } catch (error) {
      setTasks(prev => sortTasks(prev.map(t => (t.id === taskId ? originalTask : t)))); // Use new sort function
      console.error("Error toggling task status:", error);
      toast({ title: "Failed to update task", variant: "destructive" });
    }
  };

  const toggleTaskPriority = async (taskId: string) => {
    if (!user) return;
    const taskToToggle = tasks.find(t => t.id === taskId);
    if (!taskToToggle) return;

    const newPriority = taskToToggle.priority === "high" ? "medium" : "high";
    setTasks(prev => sortTasks(prev.map(t => (t.id === taskId ? { ...t, priority: newPriority } : t)))); // Use new sort function

    try {
      const taskRefPath = taskToToggle.teamId ? `teams/${taskToToggle.teamId}/tasks/${taskId}` : `users/${user.uid}/tasks/${taskId}`;
      await updateDoc(doc(db, taskRefPath), { priority: newPriority });
    } catch (error) {
      setTasks(prev => sortTasks(prev.map(t => (t.id === taskId ? { ...t, priority: taskToToggle.priority } : t)))); // Use new sort function
      console.error("Error toggling task priority:", error);
      toast({ title: "Failed to update priority", variant: "destructive" });
    }
  };

  const updateTaskTimeSpent = async (taskId: string, timeToAdd: number) => {
    if (!user) return;
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    const originalTask = { ...taskToUpdate };
    const newTimeSpent = (taskToUpdate.timeSpent || 0) + timeToAdd;
    setTasks(prev => sortTasks(prev.map(t => (t.id === taskId ? { ...t, timeSpent: newTimeSpent } : t)))); // Use new sort function

    try {
      const taskRefPath = taskToUpdate.teamId ? `teams/${taskToUpdate.teamId}/tasks/${taskId}` : `users/${user.uid}/tasks/${taskId}`;
      await updateDoc(doc(db, taskRefPath), { timeSpent: newTimeSpent });
    } catch (error) {
      setTasks(prev => sortTasks(prev.map(t => (t.id === taskId ? originalTask : t)))); // Use new sort function
      console.error("Error updating task time:", error);
      throw error;
    }
  };

  // --- NEW SUBTASK FUNCTIONS ---
  const addSubtask = async (taskId: string, title: string) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSubtask: Subtask = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };

    const updatedSubtasks = [...(task.subtasks || []), newSubtask];
    await updateTask(taskId, { subtasks: updatedSubtasks });
    toast({ title: "Subtask added!" });
  };

  const toggleSubtaskStatus = async (taskId: string, subtaskId: string, autoSaveTimeFromTracker?: { currentSeconds: number, stopTracking: () => Promise<void> }) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;

    const updatedSubtasks = task.subtasks.map(sub => {
      if (sub.id === subtaskId) {
        const newCompletedStatus = !sub.isCompleted;
        let updatedTimeSpent = sub.timeSpent || 0;

        // If completing the subtask and timer is running, add the tracked time
        if (newCompletedStatus && autoSaveTimeFromTracker) {
          updatedTimeSpent += autoSaveTimeFromTracker.currentSeconds;
        }

        return {
          ...sub,
          isCompleted: newCompletedStatus,
          completedAt: newCompletedStatus ? new Date().toISOString() : undefined,
          timeSpent: updatedTimeSpent
        };
      }
      return sub;
    });

    const toggledSubtask = updatedSubtasks.find(sub => sub.id === subtaskId);

    // Stop the timer if it was running for this subtask
    if (autoSaveTimeFromTracker && toggledSubtask?.isCompleted) {
      await autoSaveTimeFromTracker.stopTracking();
    }

    // Play sound if a subtask is marked as completed
    if (toggledSubtask?.isCompleted) {
      playSound(TASK_COMPLETE_SOUND_URL);
    }

    // Check if all subtasks are now completed
    const allSubtasksCompleted = updatedSubtasks.every(sub => sub.isCompleted);

    // Scenario 1: All subtasks completed, parent task was NOT completed
    if (allSubtasksCompleted && task.status !== 'completed') {
      // Update subtasks first, then call toggleTaskStatus to mark parent as complete
      await updateTask(taskId, { subtasks: updatedSubtasks }); // Update subtasks in Firestore
      await toggleTaskStatus(taskId); // This will mark the parent task as completed and trigger notifications
      toast({ title: "Subtask updated!", description: "All subtasks completed! Parent task marked as complete." });
    }
    // Scenario 2: A subtask is uncompleted, and the parent task WAS completed
    else if (!allSubtasksCompleted && task.status === 'completed') {
      // Update subtasks first, then call toggleTaskStatus to revert parent task status
      await updateTask(taskId, { subtasks: updatedSubtasks }); // Update subtasks in Firestore
      await toggleTaskStatus(taskId); // This will mark the parent task as 'todo'
      toast({ title: "Subtask updated!", description: "Parent task status reverted to 'todo'." });
    }
    // Scenario 3: Only subtask status changes, parent task status remains the same
    else {
      await updateTask(taskId, { subtasks: updatedSubtasks });
      toast({ title: "Subtask updated!" });
    }
  };

  const deleteSubtask = async (taskId: string, subtaskId: string) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;

    const updatedSubtasks = task.subtasks.filter(sub => sub.id !== subtaskId);
    await updateTask(taskId, { subtasks: updatedSubtasks });
    toast({ title: "Subtask deleted!", variant: "destructive" });
  };

  const updateSubtaskTimeSpent = async (taskId: string, subtaskId: string, timeToAdd: number) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;

    const updatedSubtasks = task.subtasks.map(sub => {
      if (sub.id === subtaskId) {
        return { ...sub, timeSpent: (sub.timeSpent || 0) + timeToAdd };
      }
      return sub;
    });

    await updateTask(taskId, { subtasks: updatedSubtasks });
  };
  // --- END NEW SUBTASK FUNCTIONS ---

  // New function to update lastCommentedAt
  const updateTaskLastCommentedAt = async (taskId: string, timestamp: string) => {
    if (!user) return;
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    // Only update if the new timestamp is actually newer
    const currentLastCommentedAt = taskToUpdate.lastCommentedAt ? new Date(taskToUpdate.lastCommentedAt).getTime() : 0;
    const newCommentTimestamp = new Date(timestamp).getTime();

    if (newCommentTimestamp > currentLastCommentedAt) {
      setTasks(prev => sortTasks(prev.map(t => (t.id === taskId ? { ...t, lastCommentedAt: timestamp } : t))));
      try {
        const taskRefPath = taskToUpdate.teamId ? `teams/${taskToUpdate.teamId}/tasks/${taskId}` : `users/${user.uid}/tasks/${taskId}`;
        await updateDoc(doc(db, taskRefPath), { lastCommentedAt: timestamp });
      } catch (error) {
        console.error("Error updating task lastCommentedAt:", error);
      }
    }
  };

  const getTasksByDateRange = (startDate: Date, endDate: Date): Task[] => tasks.filter(task => {
    const taskDate = new Date(task.createdAt);
    return taskDate >= startDate && taskDate <= endDate;
  });

  const getTasksByStatus = (status: Task["status"]): Task[] => tasks.filter(task => task.status === status);
  const getTasksByPriority = (priority: Task["priority"]): Task[] => tasks.filter(task => task.priority === priority);

  const getTasksCompletedOnDate = (date: Date): Task[] => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    return tasks.filter(task => {
      if (task.status !== "completed" || typeof task.completedAt !== 'string') return false;
      const taskDate = new Date(task.completedAt);
      return taskDate >= startOfDay && taskDate <= endOfDay;
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
    addSubtask, // New
    toggleSubtaskStatus, // New
    deleteSubtask, // New
    updateSubtaskTimeSpent, // New
    updateTaskLastCommentedAt, // New
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