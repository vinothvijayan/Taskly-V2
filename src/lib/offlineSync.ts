// Enhanced offline sync functionality for PWA with IndexedDB
import { indexedDBManager, OfflineTask, OfflineNote } from './indexedDB';
import { Task } from '../types';

export interface OfflineAction {
  id: string;
  type: 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK' | 'TOGGLE_STATUS' | 'CREATE_NOTE' | 'UPDATE_NOTE' | 'DELETE_NOTE';
  data: any;
  timestamp: number;
  userId: string;
  retryCount: number;
}

const SYNC_STATUS_KEY = 'taskly_sync_status';
const MAX_RETRY_ATTEMPTS = 3;

export class OfflineSync {
  private static instance: OfflineSync;
  private syncInProgress = false;
  private syncCallbacks: Array<(success: boolean) => void> = [];

  static getInstance(): OfflineSync {
    if (!OfflineSync.instance) {
      OfflineSync.instance = new OfflineSync();
    }
    return OfflineSync.instance;
  }

  async initialize(): Promise<void> {
    await indexedDBManager.init();
  }

  // Queue offline actions with IndexedDB
  async queueAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    await indexedDBManager.queueAction({
      ...action,
      timestamp: Date.now()
    });

    // Register background sync if available
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        if ('sync' in registration) {
          (registration as any).sync.register('background-sync').catch((err: any) => {
            console.log('Background sync registration failed:', err);
          });
        }
      });
    }
  }

  // Store task locally with optimistic updates
  async storeTaskLocally(task: Task, syncStatus: 'pending' | 'synced' = 'pending'): Promise<void> {
    const offlineTask: OfflineTask = {
      ...task,
      lastModified: Date.now(),
      syncStatus
    };
    await indexedDBManager.saveTask(offlineTask);
  }

  // Get all tasks from local storage
  async getLocalTasks(): Promise<OfflineTask[]> {
    return indexedDBManager.getTasks();
  }

  // Delete task locally
  async deleteTaskLocally(taskId: string): Promise<void> {
    await indexedDBManager.deleteTask(taskId);
  }

  // Get queued actions from IndexedDB
  async getQueuedActions(): Promise<OfflineAction[]> {
    return indexedDBManager.getQueuedActions();
  }

  // Clear queued actions
  async clearQueuedActions(): Promise<void> {
    await indexedDBManager.clearAllActions();
  }

  // Get sync status
  async getSyncStatus(): Promise<{ lastSync: number; pending: number; conflicted: number }> {
    const status = localStorage.getItem(SYNC_STATUS_KEY);
    const parsed = status ? JSON.parse(status) : { lastSync: 0, pending: 0 };
    const actions = await this.getQueuedActions();
    const unsynced = await indexedDBManager.getUnsyncedItems();
    
    return {
      ...parsed,
      pending: actions.length + unsynced.tasks.length + unsynced.notes.length,
      conflicted: unsynced.tasks.filter(t => t.syncStatus === 'conflict').length + 
                 unsynced.notes.filter(n => n.syncStatus === 'conflict').length
    };
  }

  // Update sync status
  async updateSyncStatus(lastSync: number): Promise<void> {
    const actions = await this.getQueuedActions();
    const status = {
      lastSync,
      pending: actions.length
    };
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
  }

  // Check if online
  isOnline(): boolean {
    return navigator.onLine;
  }

  // Enhanced sync when back online
  async syncWhenOnline(): Promise<{ success: boolean; syncedCount: number; failedCount: number }> {
    if (!this.isOnline() || this.syncInProgress) {
      return { success: false, syncedCount: 0, failedCount: 0 };
    }

    this.syncInProgress = true;
    let syncedCount = 0;
    let failedCount = 0;

    try {
      // Get all items that need syncing
      const actions = await this.getQueuedActions();
      const unsynced = await indexedDBManager.getUnsyncedItems();

      if (actions.length === 0 && unsynced.tasks.length === 0 && unsynced.notes.length === 0) {
        this.syncInProgress = false;
        return { success: true, syncedCount: 0, failedCount: 0 };
      }

      // Process queued actions first
      for (const action of actions) {
        try {
          await this.processAction(action);
          await indexedDBManager.removeAction(action.id);
          syncedCount++;
        } catch (error) {
          console.error('Failed to process action:', action, error);
          
          // Increment retry count
          const newRetryCount = action.retryCount + 1;
          if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
            // Remove action after max retries
            await indexedDBManager.removeAction(action.id);
            failedCount++;
          } else {
            await indexedDBManager.updateActionRetryCount(action.id, newRetryCount);
          }
        }
      }

      // Process unsynced tasks
      for (const task of unsynced.tasks) {
        try {
          await this.syncTask(task);
          syncedCount++;
        } catch (error) {
          console.error('Failed to sync task:', task, error);
          // Mark as conflict for manual resolution
          await indexedDBManager.saveTask({ ...task, syncStatus: 'conflict' });
          failedCount++;
        }
      }

      // Process unsynced notes
      for (const note of unsynced.notes) {
        try {
          await this.syncNote(note);
          syncedCount++;
        } catch (error) {
          console.error('Failed to sync note:', note, error);
          await indexedDBManager.saveNote({ ...note, syncStatus: 'conflict' });
          failedCount++;
        }
      }

      await this.updateSyncStatus(Date.now());
      
      // Notify callbacks
      this.syncCallbacks.forEach(callback => callback(failedCount === 0));
      
      // Show sync notification
      if (syncedCount > 0 || failedCount > 0) {
        this.showSyncNotification(
          failedCount === 0 ? 'success' : 'warning', 
          `Synced ${syncedCount} items${failedCount > 0 ? `, ${failedCount} failed` : ''}`
        );
      }

      return { success: failedCount === 0, syncedCount, failedCount };
    } catch (error) {
      console.error('Sync failed:', error);
      this.showSyncNotification('error', 'Sync failed - will retry later');
      return { success: false, syncedCount, failedCount: failedCount + 1 };
    } finally {
      this.syncInProgress = false;
    }
  }

  // Process individual action
  private async processAction(action: OfflineAction): Promise<void> {
    console.log('Processing offline action:', action);
    
    switch (action.type) {
      case 'CREATE_TASK':
        // Call Firebase/Firestore to create task
        // Implementation would depend on your Firebase setup
        break;
      case 'UPDATE_TASK':
        // Call Firebase/Firestore to update task
        break;
      case 'DELETE_TASK':
        // Call Firebase/Firestore to delete task
        break;
      case 'CREATE_NOTE':
        // Call Firebase/Firestore to create note
        break;
      case 'UPDATE_NOTE':
        // Call Firebase/Firestore to update note
        break;
      case 'DELETE_NOTE':
        // Call Firebase/Firestore to delete note
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  // Sync individual task
  private async syncTask(task: OfflineTask): Promise<void> {
    // Implementation would sync with Firebase/Firestore
    console.log('Syncing task:', task);
    // Mark as synced after successful sync
    await indexedDBManager.saveTask({ ...task, syncStatus: 'synced' });
  }

  // Sync individual note
  private async syncNote(note: OfflineNote): Promise<void> {
    // Implementation would sync with Firebase/Firestore
    console.log('Syncing note:', note);
    // Mark as synced after successful sync
    await indexedDBManager.saveNote({ ...note, syncStatus: 'synced' });
  }

  // Show sync notification
  private showSyncNotification(type: 'success' | 'error' | 'warning', message: string): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Taskly Sync', {
        body: message,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png'
      });
    }
  }

  // Register sync callback
  onSyncComplete(callback: (success: boolean) => void): void {
    this.syncCallbacks.push(callback);
  }

  // Get conflict resolution data
  async getConflicts(): Promise<{ tasks: OfflineTask[]; notes: OfflineNote[] }> {
    const unsynced = await indexedDBManager.getUnsyncedItems();
    return {
      tasks: unsynced.tasks.filter(task => task.syncStatus === 'conflict'),
      notes: unsynced.notes.filter(note => note.syncStatus === 'conflict')
    };
  }

  // Resolve conflict by choosing local or remote version
  async resolveTaskConflict(taskId: string, useLocal: boolean): Promise<void> {
    const task = await indexedDBManager.getTask(taskId);
    if (!task) return;

    if (useLocal) {
      // Keep local version and mark for sync
      await indexedDBManager.saveTask({ ...task, syncStatus: 'pending' });
    } else {
      // Mark as synced (remote version wins)
      await indexedDBManager.saveTask({ ...task, syncStatus: 'synced' });
    }
  }

  // Initialize sync listeners
  async init(): Promise<void> {
    await this.initialize();
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('Back online - starting sync...');
      this.syncWhenOnline();
    });

    window.addEventListener('offline', () => {
      console.log('Gone offline - actions will be queued');
    });

    // Sync on app startup if online
    if (this.isOnline()) {
      this.syncWhenOnline();
    }
  }
}

// Export singleton instance
export const offlineSync = OfflineSync.getInstance();