// Custom hook for offline sync functionality
import { useState, useEffect, useCallback } from 'react';
import { offlineSync } from '../lib/offlineSync';
import { indexedDBManager, OfflineTask } from '../lib/indexedDB';
import { Task } from '../types';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: number;
  pending: number;
  conflicted: number;
}

export function useOfflineSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSync: 0,
    pending: 0,
    conflicted: 0
  });

  const updateSyncStatus = useCallback(async () => {
    const status = await offlineSync.getSyncStatus();
    setSyncStatus(prev => ({
      ...prev,
      ...status
    }));
  }, []);

  useEffect(() => {
    let mounted = true;

    const handleOnline = async () => {
      if (!mounted) return;
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      await updateSyncStatus();
    };

    const handleOffline = () => {
      if (!mounted) return;
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    // Initial status update
    updateSyncStatus();

    // Set up event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic sync status updates
    const interval = setInterval(updateSyncStatus, 5000);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [updateSyncStatus]);

  const manualSync = useCallback(async () => {
    if (!syncStatus.isOnline || syncStatus.isSyncing) return;

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    try {
      const result = await offlineSync.syncWhenOnline();
      await updateSyncStatus();
      return result;
    } finally {
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, [syncStatus.isOnline, syncStatus.isSyncing, updateSyncStatus]);

  const createTaskOffline = useCallback(async (task: Omit<Task, 'id' | 'createdAt'>, userId: string) => {
    const taskWithId: Task = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      subtasks: task.subtasks || [], // Ensure subtasks are initialized
    };

    // Store locally immediately (optimistic update)
    await offlineSync.storeTaskLocally(taskWithId, 'pending');

    // Queue for sync when online
    if (!syncStatus.isOnline) {
      await offlineSync.queueAction({
        type: 'CREATE_TASK',
        data: taskWithId,
        userId
      });
    }

    await updateSyncStatus();
    return taskWithId;
  }, [syncStatus.isOnline, updateSyncStatus]);

  const updateTaskOffline = useCallback(async (taskId: string, updates: Partial<Task>, userId: string) => {
    // Get current task from local storage
    const existingTask = await indexedDBManager.getTask(taskId);
    if (!existingTask) return null;

    const updatedTask: OfflineTask = {
      ...existingTask,
      ...updates,
      lastModified: Date.now(),
      syncStatus: 'pending'
    };

    // Store locally immediately
    await indexedDBManager.saveTask(updatedTask);

    // Queue for sync when online
    if (!syncStatus.isOnline) {
      await offlineSync.queueAction({
        type: 'UPDATE_TASK',
        data: { id: taskId, updates },
        userId
      });
    }

    await updateSyncStatus();
    return updatedTask;
  }, [syncStatus.isOnline, updateSyncStatus]);

  const deleteTaskOffline = useCallback(async (taskId: string, userId: string) => {
    // Remove from local storage immediately
    await indexedDBManager.deleteTask(taskId);

    // Queue for sync when online
    if (!syncStatus.isOnline) {
      await offlineSync.queueAction({
        type: 'DELETE_TASK',
        data: { id: taskId },
        userId
      });
    }

    await updateSyncStatus();
  }, [syncStatus.isOnline, updateSyncStatus]);

  const toggleTaskStatusOffline = useCallback(async (taskId: string, userId: string) => {
    const existingTask = await indexedDBManager.getTask(taskId);
    if (!existingTask) return null;

    const newStatus = existingTask.status === 'completed' ? 'todo' : 'completed';
    const updatedTask: OfflineTask = {
      ...existingTask,
      status: newStatus,
      completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
      lastModified: Date.now(),
      syncStatus: 'pending'
    };

    await indexedDBManager.saveTask(updatedTask);

    if (!syncStatus.isOnline) {
      await offlineSync.queueAction({
        type: 'TOGGLE_STATUS',
        data: { id: taskId, status: newStatus },
        userId
      });
    }

    await updateSyncStatus();
    return updatedTask;
  }, [syncStatus.isOnline, updateSyncStatus]);

  const getLocalTasks = useCallback(async () => {
    return indexedDBManager.getTasks();
  }, []);

  const getConflicts = useCallback(async () => {
    return offlineSync.getConflicts();
  }, []);

  const resolveConflict = useCallback(async (taskId: string, useLocal: boolean) => {
    await offlineSync.resolveTaskConflict(taskId, useLocal);
    await updateSyncStatus();
  }, [updateSyncStatus]);

  return {
    syncStatus,
    manualSync,
    createTaskOffline,
    updateTaskOffline,
    deleteTaskOffline,
    toggleTaskStatusOffline,
    getLocalTasks,
    getConflicts,
    resolveConflict,
    updateSyncStatus
  };
}