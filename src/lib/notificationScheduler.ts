// src/lib/PwaNotificationScheduler.ts
// This is your original PWA-focused scheduler, optimized for web browsers.

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

class PwaNotificationScheduler {
  private static instance: PwaNotificationScheduler;
  private checkInterval: number | null = null;

  static getInstance(): PwaNotificationScheduler {
    if (!PwaNotificationScheduler.instance) {
      PwaNotificationScheduler.instance = new PwaNotificationScheduler();
    }
    return PwaNotificationScheduler.instance;
  }

  async init(): Promise<void> {
    await indexedDBManager.init();
    this.startScheduleChecker();
    await this.checkMissedNotifications();
    console.log("PWA Notification Scheduler Initialized.");
  }

  async scheduleNotification(notification: Omit<ScheduledNotification, 'id' | 'createdAt' | 'status'>): Promise<string> {
    const scheduledNotification: ScheduledNotification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      status: 'pending'
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
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = window.setInterval(() => this.checkDueNotifications(), 30000);
  }

  private async checkDueNotifications(): Promise<void> {
    try {
      if (typeof indexedDBManager.getStore !== 'function') return;
      const pendingNotifications = await this.getAllPendingNotifications();
      const now = Date.now();
      for (const notification of pendingNotifications) {
        if (notification.scheduledTime <= now) {
          await this.deliverNotification(notification.id);
        }
      }
    } catch (error) {
      console.error('Error checking due notifications:', error);
    }
  }

  private async checkMissedNotifications(): Promise<void> {
    try {
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
          body: `You had ${missedCount} missed notification${missedCount > 1 ? 's' : ''} while you were away.`,
          icon: '/icon-192x192.png',
          tag: 'missed-notifications'
        });
      }
    } catch (error) {
      console.error('Error checking missed notifications:', error);
    }
  }

  private async deliverNotification(id: string): Promise<void> {
    try {
      const notification = await this.getScheduledNotification(id);
      if (!notification || notification.status !== 'pending') return;

      if (Date.now() - notification.scheduledTime > 60 * 60 * 1000) {
        notification.status = 'expired';
        await this.saveScheduledNotification(notification);
        return;
      }
      
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', options: { ...notification } });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, { ...notification });
      }

      notification.status = 'delivered';
      await this.saveScheduledNotification(notification);
    } catch (error) {
      console.error('Error delivering notification:', error);
    }
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Export a singleton instance for the PWA context
export const pwaNotificationScheduler = PwaNotificationScheduler.getInstance();