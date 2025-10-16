// src/lib/unifiedNotifications.ts
// Notification scheduler with IndexedDB persistence for PWA

import { indexedDBManager } from './indexedDB';

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  scheduledTime: number;
  createdAt: number;
  status: 'pending' | 'delivered' | 'expired';
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  actions?: { action: string; title: string; icon?: string }[];
}

class NotificationScheduler {
  private static instance: NotificationScheduler;
  private checkInterval: number | null = null;

  static getInstance(): NotificationScheduler {
    if (!NotificationScheduler.instance) {
      NotificationScheduler.instance = new NotificationScheduler();
    }
    return NotificationScheduler.instance;
  }

  async init(): Promise<void> {
    await indexedDBManager.init();
    this.startScheduleChecker();
    await this.checkMissedNotifications();
  }

  async scheduleNotification(notification: Omit<ScheduledNotification, 'id' | 'createdAt' | 'status'>): Promise<string> {
    const scheduledNotification: ScheduledNotification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      status: 'pending',
    };

    await this.saveScheduledNotification(scheduledNotification);

    const timeDiff = notification.scheduledTime - Date.now();
    if (timeDiff <= 5 * 60 * 1000 && timeDiff > 0) {
      setTimeout(() => this.deliverNotification(scheduledNotification.id), timeDiff);
    }

    return scheduledNotification.id;
  }

  async cancelNotification(id: string): Promise<void> {
    const notification = await this.getScheduledNotification(id);
    if (notification) {
      notification.status = 'expired';
      await this.saveScheduledNotification(notification);
    }
  }

  private async saveScheduledNotification(notification: ScheduledNotification): Promise<void> {
    const store = await indexedDBManager.getStore('scheduledNotifications', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(notification);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getScheduledNotification(id: string): Promise<ScheduledNotification | null> {
    const store = await indexedDBManager.getStore('scheduledNotifications');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllPendingNotifications(): Promise<ScheduledNotification[]> {
    const store = await indexedDBManager.getStore('scheduledNotifications');
    const index = store.index('status');
    return new Promise((resolve, reject) => {
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private startScheduleChecker(): void {
    this.checkInterval = window.setInterval(() => this.checkDueNotifications(), 30000);
  }

  private async checkDueNotifications(): Promise<void> {
    if (!this.isDatabaseReady()) return;

    const pendingNotifications = await this.getAllPendingNotifications();
    const now = Date.now();

    for (const notification of pendingNotifications) {
      if (notification.scheduledTime <= now) {
        await this.deliverNotification(notification.id);
      }
    }
  }

  private isDatabaseReady(): boolean {
    try {
      return indexedDBManager && typeof indexedDBManager.getStore === 'function';
    } catch {
      return false;
    }
  }

  private async checkMissedNotifications(): Promise<void> {
    const pendingNotifications = await this.getAllPendingNotifications();
    const now = Date.now();
    let missedCount = 0;

    for (const notification of pendingNotifications) {
      if (notification.scheduledTime <= now) {
        await this.deliverNotification(notification.id);
        missedCount++;
      }
    }

    if (missedCount > 0 && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Taskly - Missed Notifications', {
        body: `You had ${missedCount} missed notification${missedCount > 1 ? 's' : ''} while the app was closed.`,
        icon: '/icon-192x192.png',
        tag: 'missed-notifications',
      });
    }
  }

  private async deliverNotification(id: string): Promise<void> {
    const notification = await this.getScheduledNotification(id);
    if (!notification || notification.status !== 'pending') return;

    const timeDiff = Date.now() - notification.scheduledTime;
    if (timeDiff > 60 * 60 * 1000) {
      notification.status = 'expired';
      await this.saveScheduledNotification(notification);
      return;
    }

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        options: {
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/icon-192x192.png',
          badge: notification.badge || '/icon-192x192.png',
          tag: notification.tag || `notification-${id}`,
          data: notification.data,
          requireInteraction: notification.requireInteraction,
          silent: notification.silent,
          vibrate: notification.vibrate || [200, 100, 200],
          actions: notification.actions,
        },
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.body,
        icon: notification.icon || '/icon-192x192.png',
        tag: notification.tag || `notification-${id}`,
        data: notification.data,
        requireInteraction: notification.requireInteraction,
        silent: notification.silent,
      });
    }

    notification.status = 'delivered';
    await this.saveScheduledNotification(notification);
  }

  async getNotificationHistory(): Promise<ScheduledNotification[]> {
    const store = await indexedDBManager.getStore('scheduledNotifications');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
      request.onerror = () => reject(request.error);
    });
  }

  async clearExpiredNotifications(): Promise<void> {
    const notifications = await this.getNotificationHistory();
    const expired = notifications.filter(n => n.status === 'expired' || n.status === 'delivered');

    const store = await indexedDBManager.getStore('scheduledNotifications', 'readwrite');
    for (const notification of expired) {
      if (Date.now() - notification.createdAt > 7 * 24 * 60 * 60 * 1000) {
        store.delete(notification.id);
      }
    }
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Export with the name your App.tsx expects
export const unifiedNotifications = NotificationScheduler.getInstance();
