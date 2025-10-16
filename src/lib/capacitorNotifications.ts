// Native notification service using Capacitor
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export interface CapacitorNotificationOptions {
  id: number;
  title: string;
  body: string;
  schedule?: {
    at: Date;
    allowWhileIdle?: boolean;
    repeats?: boolean;
  };
  sound?: string;
  iconColor?: string;
  smallIcon?: string;
  largeIcon?: string;
  extra?: any;
  channelId?: string;
  ongoing?: boolean;
  autoCancel?: boolean;
  group?: string;
  groupSummary?: boolean;
}

class CapacitorNotificationService {
  private static instance: CapacitorNotificationService;
  private isInitialized = false;

  static getInstance(): CapacitorNotificationService {
    if (!CapacitorNotificationService.instance) {
      CapacitorNotificationService.instance = new CapacitorNotificationService();
    }
    return CapacitorNotificationService.instance;
  }

  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Not running on native platform, skipping Capacitor notifications');
      return;
    }

    try {
      // Request permissions
      const permResult = await LocalNotifications.requestPermissions();
      if (permResult.display !== 'granted') {
        console.warn('Notification permissions not granted');
        return;
      }

      // Create notification channels (Android)
      if (Capacitor.getPlatform() === 'android') {
        await LocalNotifications.createChannel({
          id: 'task-reminders',
          name: 'Task Reminders',
          description: 'Notifications for task reminders',
          importance: 4,
          visibility: 1,
          sound: 'beep.wav',
          vibration: true,
          lights: true,
          lightColor: '#488AFF'
        });

        await LocalNotifications.createChannel({
          id: 'pomodoro',
          name: 'Pomodoro Timer',
          description: 'Notifications for pomodoro sessions',
          importance: 4,
          visibility: 1,
          sound: 'ding.wav',
          vibration: true,
          lights: true,
          lightColor: '#FF6B6B'
        });
      }

      // Setup action listeners
      await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        this.handleNotificationAction(notification);
      });

      // Setup received listener
      await LocalNotifications.addListener('localNotificationReceived', (notification) => {
        console.log('Notification received:', notification);
      });

      // Handle app state changes
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          // App became active, check for any pending notifications
          this.handleAppResumed();
        }
      });

      this.isInitialized = true;
      console.log('Capacitor notifications initialized');
    } catch (error) {
      console.error('Failed to initialize Capacitor notifications:', error);
    }
  }

  private handleNotificationAction(notification: any): void {
    const { actionId, notification: notif } = notification;
    
    console.log('Notification action:', actionId, notif);
    
    // Dispatch custom event for the app to handle
    window.dispatchEvent(new CustomEvent('capacitor-notification-action', {
      detail: {
        actionId,
        notificationId: notif.id,
        data: notif.extra
      }
    }));
  }

  private async handleAppResumed(): Promise<void> {
    try {
      // Get pending notifications
      const pending = await LocalNotifications.getPending();
      console.log('Pending notifications:', pending.notifications.length);
      
      // Get delivered notifications
      const delivered = await LocalNotifications.getDeliveredNotifications();
      console.log('Delivered notifications:', delivered.notifications.length);
    } catch (error) {
      console.error('Error checking notifications on resume:', error);
    }
  }

  async scheduleNotification(options: CapacitorNotificationOptions): Promise<void> {
    if (!this.isInitialized || !Capacitor.isNativePlatform()) {
      console.warn('Capacitor notifications not available, falling back to web notifications');
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [options]
      });
      console.log('Notification scheduled:', options.id);
    } catch (error) {
      console.error('Failed to schedule notification:', error);
    }
  }

  async cancelNotification(id: number): Promise<void> {
    if (!this.isInitialized || !Capacitor.isNativePlatform()) {
      return;
    }

      try {
        await LocalNotifications.cancel({
          notifications: [{ id: id }]
        });
      console.log('Notification cancelled:', id);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    if (!this.isInitialized || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map(n => ({ id: n.id }))
        });
      }
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  async getPendingNotifications(): Promise<any[]> {
    if (!this.isInitialized || !Capacitor.isNativePlatform()) {
      return [];
    }

    try {
      const result = await LocalNotifications.getPending();
      return result.notifications;
    } catch (error) {
      console.error('Failed to get pending notifications:', error);
      return [];
    }
  }

  // Convenience methods for common notification types
  async scheduleTaskReminder(taskId: string, title: string, body: string, dueDate: Date): Promise<void> {
    const notificationId = this.generateNotificationId(taskId);
    
    await this.scheduleNotification({
      id: notificationId,
      title,
      body,
      schedule: {
        at: dueDate,
        allowWhileIdle: true
      },
      channelId: 'task-reminders',
      iconColor: '#488AFF',
      extra: {
        taskId,
        type: 'task-reminder'
      }
    });
  }

  async schedulePomodoroComplete(sessionType: 'work' | 'break'): Promise<void> {
    const notificationId = Date.now();
    
    await this.scheduleNotification({
      id: notificationId,
      title: `${sessionType === 'work' ? 'Work' : 'Break'} Session Complete`,
      body: `Great job! Time for your ${sessionType === 'work' ? 'break' : 'next work session'}.`,
      schedule: {
        at: new Date(Date.now() + 100), // Show almost immediately
        allowWhileIdle: true
      },
      channelId: 'pomodoro',
      iconColor: '#FF6B6B',
      extra: {
        type: 'pomodoro-complete',
        sessionType
      }
    });
  }

  async cancelTaskReminder(taskId: string): Promise<void> {
    const notificationId = this.generateNotificationId(taskId);
    await this.cancelNotification(notificationId);
  }

  private generateNotificationId(taskId: string): number {
    // Generate a consistent numeric ID from string task ID
    let hash = 0;
    for (let i = 0; i < taskId.length; i++) {
      const char = taskId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Check if native notifications are available
  isNativeNotificationsAvailable(): boolean {
    return this.isInitialized && Capacitor.isNativePlatform();
  }
}

export const capacitorNotifications = CapacitorNotificationService.getInstance();