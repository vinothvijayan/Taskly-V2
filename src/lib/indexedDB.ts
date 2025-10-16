// IndexedDB wrapper for offline data storage
import { FieldValue } from "firebase/firestore"; // Import FieldValue

export interface OfflineTask {
  id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "completed";
  dueDate?: string;
  estimatedTime?: number;
  completedTime?: number;
  completedAt?: string | FieldValue; // Allow FieldValue
  timeSpent?: number;
  teamId?: string;
  assignedTo?: string[];
  createdBy?: string;
  createdAt: string;
  lastModified: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
}

export interface OfflineNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  lastModified: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
}

export interface OfflineAction {
  id: string;
  type: 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK' | 'TOGGLE_STATUS' | 'CREATE_NOTE' | 'UPDATE_NOTE' | 'DELETE_NOTE';
  data: any;
  timestamp: number;
  userId: string;
  retryCount: number;
}

class IndexedDBManager {
  private static instance: IndexedDBManager;
  private db: IDBDatabase | null = null;
  private dbName = 'TasklyOfflineDB';
  private version = 1;

  static getInstance(): IndexedDBManager {
    if (!IndexedDBManager.instance) {
      IndexedDBManager.instance = new IndexedDBManager();
    }
    return IndexedDBManager.instance;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Tasks store
        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('status', 'status', { unique: false });
          taskStore.createIndex('priority', 'priority', { unique: false });
          taskStore.createIndex('lastModified', 'lastModified', { unique: false });
          taskStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Notes store
        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('lastModified', 'lastModified', { unique: false });
          noteStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Offline actions queue
        if (!db.objectStoreNames.contains('offlineActions')) {
          const actionStore = db.createObjectStore('offlineActions', { keyPath: 'id' });
          actionStore.createIndex('timestamp', 'timestamp', { unique: false });
          actionStore.createIndex('type', 'type', { unique: false });
        }

        // User data store
        if (!db.objectStoreNames.contains('userData')) {
          db.createObjectStore('userData', { keyPath: 'key' });
        }

        // Scheduled notifications store
        if (!db.objectStoreNames.contains('scheduledNotifications')) {
          const notificationStore = db.createObjectStore('scheduledNotifications', { keyPath: 'id' });
          notificationStore.createIndex('status', 'status', { unique: false });
          notificationStore.createIndex('scheduledTime', 'scheduledTime', { unique: false });
          notificationStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    if (!this.db) {
      await this.init();
    }
    
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }

    // Check if the object store exists
    if (!this.db.objectStoreNames.contains(storeName)) {
      throw new Error(`Object store '${storeName}' does not exist`);
    }

    const transaction = this.db.transaction([storeName], mode);
    return transaction.objectStore(storeName);
  }

  // Task operations
  async saveTasks(tasks: OfflineTask[]): Promise<void> {
    const store = await this.getStore('tasks', 'readwrite');
    const promises = tasks.map(task => {
      return new Promise<void>((resolve, reject) => {
        const request = store.put({ ...task, lastModified: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
    await Promise.all(promises);
  }

  async saveTask(task: OfflineTask): Promise<void> {
    const store = await this.getStore('tasks', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ ...task, lastModified: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTasks(): Promise<OfflineTask[]> {
    const store = await this.getStore('tasks');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getTask(id: string): Promise<OfflineTask | undefined> {
    const store = await this.getStore('tasks');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTask(id: string): Promise<void> {
    const store = await this.getStore('tasks', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Note operations
  async saveNote(note: OfflineNote): Promise<void> {
    const store = await this.getStore('notes', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ ...note, lastModified: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getNotes(): Promise<OfflineNote[]> {
    const store = await this.getStore('notes');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteNote(id: string): Promise<void> {
    const store = await this.getStore('notes', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Offline actions queue
  async queueAction(action: Omit<OfflineAction, 'id' | 'retryCount'>): Promise<void> {
    const store = await this.getStore('offlineActions', 'readwrite');
    const actionWithId: OfflineAction = {
      ...action,
      id: crypto.randomUUID(),
      retryCount: 0
    };
    return new Promise((resolve, reject) => {
      const request = store.put(actionWithId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getQueuedActions(): Promise<OfflineAction[]> {
    const store = await this.getStore('offlineActions');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const actions = request.result.sort((a, b) => a.timestamp - b.timestamp);
        resolve(actions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeAction(id: string): Promise<void> {
    const store = await this.getStore('offlineActions', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateActionRetryCount(id: string, retryCount: number): Promise<void> {
    const store = await this.getStore('offlineActions', 'readwrite');
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const action = getRequest.result;
        if (action) {
          action.retryCount = retryCount;
          const putRequest = store.put(action);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async clearAllActions(): Promise<void> {
    const store = await this.getStore('offlineActions', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // User data operations
  async setUserData(key: string, value: any): Promise<void> {
    const store = await this.getStore('userData', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUserData(key: string): Promise<any> {
    const store = await this.getStore('userData');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  // Utility methods
  async getTasksByStatus(status: string): Promise<OfflineTask[]> {
    const store = await this.getStore('tasks');
    const index = store.index('status');
    return new Promise((resolve, reject) => {
      const request = index.getAll(status);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedItems(): Promise<{ tasks: OfflineTask[]; notes: OfflineNote[]; actions: OfflineAction[] }> {
    const [tasks, notes, actions] = await Promise.all([
      this.getTasks(),
      this.getNotes(),
      this.getQueuedActions()
    ]);

    return {
      tasks: tasks.filter(task => task.syncStatus !== 'synced'),
      notes: notes.filter(note => note.syncStatus !== 'synced'),
      actions
    };
  }

  async clearDatabase(): Promise<void> {
    const stores = ['tasks', 'notes', 'offlineActions', 'userData'];
    const promises = stores.map(async (storeName) => {
      const store = await this.getStore(storeName, 'readwrite');
      return new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
    await Promise.all(promises);
  }
}

export const indexedDBManager = IndexedDBManager.getInstance();