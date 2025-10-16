// Unified notification service that handles all notification types
import { notificationService } from '@/lib/notifications';
import { fcmService } from '@/lib/fcmService';
import { capacitorNotifications } from '@/lib/capacitorNotifications';
import { unifiedNotifications } from '@/lib/unifiedNotifications';
import { alexaNotifications } from '@/lib/alexaNotifications';
import { Capacitor } from '@capacitor/core';

export interface NotificationPayload {
  id?: string;
  title: string;
  body: string;
  type: 'chat' | 'task' | 'comment' | 'assignment' | 'pomodoro' | 'general';
  userId?: string;
  data?: any;
  scheduledTime?: number;
  silent?: boolean;
  requireInteraction?: boolean;
}

class UnifiedNotificationService {
  private static instance: UnifiedNotificationService;
  private initialized = false;

  static getInstance(): UnifiedNotificationService {
    if (!UnifiedNotificationService.instance) {
      UnifiedNotificationService.instance = new UnifiedNotificationService();
    }
    return UnifiedNotificationService.instance;
  }

  async init() {
    if (this.initialized) return;

    try {
      // Initialize notification services based on platform
      if (Capacitor.isNativePlatform()) {
        // Native platform - initialize Capacitor notifications
        await capacitorNotifications.init();
        console.log('Capacitor notifications initialized for native platform');
      } else {
        // Web platform - initialize FCM and unified notifications
        await Promise.all([
          fcmService.init(),
          unifiedNotifications.init(),
          alexaNotifications.init()
        ]);
        console.log('Web notifications initialized for PWA');
      }

      this.initialized = true;
      console.log('Unified notification service initialized for platform:', Capacitor.getPlatform());
    } catch (error) {
      console.error('Failed to initialize unified notification service:', error);
    }
  }

  async sendNotification(payload: NotificationPayload) {
    if (!this.initialized) {
      await this.init();
    }

    try {
      // Enhanced platform detection and notification routing
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor local notifications for native mobile apps
        await this.sendCapacitorNotification(payload);
        console.log('Sent native notification:', payload.title);
      } else {
        // Use web notifications for PWA/browser
        await this.sendWebNotification(payload);
        console.log('Sent web notification:', payload.title);
      }

      // Also announce via Alexa if enabled
      alexaNotifications.send({
        title: payload.title,
        body: payload.body,
        type: payload.type as any,
        userId: payload.userId,
        data: payload.data
      });

      // Also send via FCM for background notifications (web only)
      if (!Capacitor.isNativePlatform() && (payload.type === 'chat' || payload.type === 'task')) {
        await this.sendBackgroundNotification(payload);
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  async scheduleNotification(payload: NotificationPayload, scheduledTime: number) {
    const notificationId = await unifiedNotifications.scheduleNotification({
      ...payload,
      scheduledTime
    });
    // Mirror schedule to Alexa if enabled
    alexaNotifications.schedule({
      title: payload.title,
      body: payload.body,
      type: (payload.type === 'task' ? 'reminder' : payload.type) as any,
      userId: payload.userId,
      data: payload.data,
      scheduledTime
    });
    return notificationId;
  }

  private async sendCapacitorNotification(payload: NotificationPayload) {
    try {
      await capacitorNotifications.scheduleNotification({
        id: Date.now(),
        title: payload.title,
        body: payload.body,
        sound: 'default',
        channelId: 'app_main_channel',
        extra: {
          ...payload.data,
          type: payload.type
        },
        schedule: {
          at: new Date(Date.now() + 100), // Show almost immediately
          allowWhileIdle: true
        }
      });
    } catch (error) {
      console.error('Failed to send Capacitor notification:', error);
      throw error;
    }
  }

  private async sendWebNotification(payload: NotificationPayload) {
    try {
      // Check permission first
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            console.warn('Web notification permission denied');
            return;
          }
        }
        
        if (Notification.permission === 'granted') {
          new Notification(payload.title, {
            body: payload.body,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: `${payload.type}-${Date.now()}`,
            data: {
              ...payload.data,
              type: payload.type
            },
            requireInteraction: payload.requireInteraction || false,
            silent: payload.silent || false,
            vibrate: [200, 100, 200] // Cast to any to allow vibrate property
          } as any);
        }
      }
    } catch (error) {
      console.error('Failed to send web notification:', error);
      throw error;
    }
  }

  private async sendBackgroundNotification(payload: NotificationPayload) {
    // This would trigger server-side FCM push notification
    // For now, we'll use the local notification scheduler
    if (payload.scheduledTime) {
      await this.scheduleNotification(payload, payload.scheduledTime);
    }
  }

  // Chat-specific notification methods
  async sendChatNotification(senderId: string, senderName: string, message: string, chatId: string) {
    return this.sendNotification({
      title: `New message from ${senderName}`,
      body: message.length > 100 ? `${message.substring(0, 100)}...` : message,
      type: 'chat',
      data: {
        senderId,
        chatId,
        messagePreview: message.substring(0, 50)
      },
      requireInteraction: false // Don't require interaction for chat messages
    });
  }

  // Task-specific notification methods
  async sendTaskAssignmentNotification(taskTitle: string, assignerName: string, taskId: string) {
    return this.sendNotification({
      title: 'New Task Assignment',
      body: `${assignerName} assigned you "${taskTitle}"`,
      type: 'assignment',
      data: {
        taskId,
        assignerName,
        taskTitle
      },
      requireInteraction: true
    });
  }

  // Comment-specific notification methods
  async sendCommentNotification(taskTitle: string, commenterName: string, comment: string, taskId: string) {
    return this.sendNotification({
      title: `New comment on "${taskTitle}"`,
      body: `${commenterName}: ${comment.length > 80 ? `${comment.substring(0, 80)}...` : comment}`,
      type: 'comment',
      data: {
        taskId,
        commenterName,
        commentPreview: comment.substring(0, 50)
      }
    });
  }

  // Pomodoro notifications
  async sendPomodoroNotification(type: 'work_complete' | 'break_complete', sessionCount?: number) {
    const isWorkComplete = type === 'work_complete';
    return this.sendNotification({
      title: isWorkComplete ? 'Work Session Complete!' : 'Break Time Over!',
      body: isWorkComplete 
        ? `Great focus! Time for a break. Session ${sessionCount || 1} completed.`
        : 'Ready to get back to work? Your break is over.',
      type: 'pomodoro',
      data: {
        pomodoroType: type,
        sessionCount
      },
      requireInteraction: true
    });
  }
}

export const unifiedNotificationService = UnifiedNotificationService.getInstance();