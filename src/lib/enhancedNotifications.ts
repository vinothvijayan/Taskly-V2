// Enhanced notification service with rich notifications and action buttons
import { pwaNotificationScheduler } from './notificationScheduler';

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface RichNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  actions?: NotificationAction[];
  data?: any;
  image?: string;
  vibrate?: number[];
}

export interface NotificationCategory {
  id: string;
  name: string;
  description: string;
  defaultActions: NotificationAction[];
}

class EnhancedNotificationService {
  private static instance: EnhancedNotificationService;
  private notificationCategories: Map<string, NotificationCategory> = new Map();
  private scheduledNotifications: Map<string, number> = new Map();

  static getInstance(): EnhancedNotificationService {
    if (!EnhancedNotificationService.instance) {
      EnhancedNotificationService.instance = new EnhancedNotificationService();
    }
    return EnhancedNotificationService.instance;
  }

  constructor() {
    this.initializeCategories();
    this.setupServiceWorkerMessageListener();
  }

  private initializeCategories() {
    // Task-related notifications
    this.notificationCategories.set('task-reminder', {
      id: 'task-reminder',
      name: 'Task Reminders',
      description: 'Reminders for upcoming tasks',
      defaultActions: [
        { action: 'complete', title: 'Mark Complete', icon: '/icons/check.png' },
        { action: 'snooze', title: 'Snooze 10min', icon: '/icons/snooze.png' },
        { action: 'view', title: 'View Task', icon: '/icons/eye.png' }
      ]
    });

    this.notificationCategories.set('task-assignment', {
      id: 'task-assignment',
      name: 'Task Assignments',
      description: 'New tasks assigned to you',
      defaultActions: [
        { action: 'accept', title: 'Accept', icon: '/icons/check.png' },
        { action: 'view', title: 'View Details', icon: '/icons/eye.png' }
      ]
    });

    this.notificationCategories.set('pomodoro-complete', {
      id: 'pomodoro-complete',
      name: 'Pomodoro Complete',
      description: 'Pomodoro session completed',
      defaultActions: [
        { action: 'start-break', title: 'Start Break', icon: '/icons/pause.png' },
        { action: 'continue', title: 'Continue Working', icon: '/icons/play.png' }
      ]
    });

    this.notificationCategories.set('achievement', {
      id: 'achievement',
      name: 'Achievements',
      description: 'Achievement unlocked notifications',
      defaultActions: [
        { action: 'share', title: 'Share', icon: '/icons/share.png' },
        { action: 'view', title: 'View Progress', icon: '/icons/trophy.png' }
      ]
    });
  }

  private setupServiceWorkerMessageListener() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent) {
    if (event.data.type === 'NOTIFICATION_ACTION') {
      this.handleNotificationAction(event.data.action, event.data.notificationData);
    }
  }

  private handleNotificationAction(action: string, data: any) {
    switch (action) {
      case 'complete':
        this.handleCompleteTask(data.taskId);
        break;
      case 'snooze':
        this.handleSnoozeTask(data.taskId, data.duration || 10);
        break;
      case 'view':
        this.handleViewTask(data.taskId);
        break;
      case 'start-break':
        this.handleStartBreak();
        break;
      case 'continue':
        this.handleContinueWork();
        break;
      case 'accept':
        this.handleAcceptTask(data.taskId);
        break;
      case 'share':
        this.handleShareAchievement(data.achievement);
        break;
      default:
        console.log('Unknown notification action:', action);
    }
  }

  private handleCompleteTask(taskId: string) {
    // Dispatch event to complete task
    window.dispatchEvent(new CustomEvent('notification-action', {
      detail: { action: 'complete-task', taskId }
    }));
  }

  private handleSnoozeTask(taskId: string, minutes: number) {
    // Schedule notification for later
    const snoozeTime = Date.now() + (minutes * 60 * 1000);
    this.scheduleNotification(taskId, snoozeTime, {
      title: 'Task Reminder (Snoozed)',
      body: 'Your snoozed task is ready',
      tag: `task-snooze-${taskId}`,
      data: { taskId, type: 'task-reminder' }
    });
  }

  private handleViewTask(taskId: string) {
    // Open app to specific task
    const url = `${window.location.origin}/tasks?task=${taskId}`;
    if (typeof self !== 'undefined' && 'clients' in self && 'openWindow' in (self as any).clients) {
      // This would be called from service worker context
      ((self as any).clients as any).openWindow(url);
    } else {
      window.open(url, '_blank');
    }
  }

  private handleStartBreak() {
    window.dispatchEvent(new CustomEvent('notification-action', {
      detail: { action: 'start-break' }
    }));
  }

  private handleContinueWork() {
    window.dispatchEvent(new CustomEvent('notification-action', {
      detail: { action: 'continue-work' }
    }));
  }

  private handleAcceptTask(taskId: string) {
    window.dispatchEvent(new CustomEvent('notification-action', {
      detail: { action: 'accept-task', taskId }
    }));
  }

  private handleShareAchievement(achievement: any) {
    if (navigator.share) {
      navigator.share({
        title: 'Achievement Unlocked!',
        text: `I just unlocked: ${achievement.title}`,
        url: window.location.origin
      });
    }
  }

  async requestPermission(userInitiated = false): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.info('Notification permission denied - in-app notifications will still work');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      console.info('Notifications are blocked - in-app notifications will still work');
      return 'denied';
    }

    // Only request permission if user initiated or during user interaction
    if (!userInitiated && !this.isUserInteraction()) {
      console.info('Deferring notification permission request until user interaction');
      return 'default';
    }

    try {
      const permission = await Notification.requestPermission();
      console.info(`Notification permission: ${permission}`);
      return permission;
    } catch (error) {
      console.warn('Failed to request notification permission:', error);
      return 'denied';
    }
  }

  private isUserInteraction(): boolean {
    // Check if this is called during a user interaction
    return document.hasFocus() && (Date.now() - this.lastUserActivity) < 1000;
  }

  private lastUserActivity = Date.now();

  async showRichNotification(
    categoryId: string, 
    options: RichNotificationOptions
  ): Promise<void> {
    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      console.info('Browser notification not available - in-app notifications will still work');
      // Could add in-app notification fallback here
      return;
    }

    const category = this.notificationCategories.get(categoryId);
    const actions = options.actions || category?.defaultActions || [];

    // Mobile-optimized notification options
    const mobileOptimizedOptions = {
      ...options,
      actions: this.isMobile() ? actions.slice(0, 2) : actions.slice(0, 3),
      badge: options.badge || '/icon-192x192.png',
      icon: options.icon || '/icon-192x192.png',
      vibrate: this.getOptimizedVibration(options.vibrate),
      timestamp: Date.now(),
      silent: options.silent || false,
      requireInteraction: this.isMobile() ? false : (options.requireInteraction || false)
    };

    // Show notification via service worker for rich features
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          options: mobileOptimizedOptions
        });
      } catch (error) {
        console.warn('Service worker notification failed, using fallback:', error);
        this.showFallbackNotification(mobileOptimizedOptions);
      }
    } else {
      this.showFallbackNotification(mobileOptimizedOptions);
    }
  }

  private showFallbackNotification(options: any): void {
    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon,
        badge: options.badge,
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction,
        silent: options.silent
      });

      // Auto-close on mobile to prevent notification buildup
      if (this.isMobile() && !options.requireInteraction) {
        setTimeout(() => notification.close(), 5000);
      }
    } catch (error) {
      console.warn('Failed to show fallback notification:', error);
    }
  }

  private isMobile(): boolean {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           ('ontouchstart' in window) ||
           (window.screen.width <= 768);
  }

  private getOptimizedVibration(customPattern?: number[]): number[] {
    if (!this.isMobile() || !('vibrate' in navigator)) {
      return [];
    }
    
    // Use custom pattern or optimized default
    return customPattern || [200, 100, 200];
  }

  scheduleNotification(
    id: string, 
    timestamp: number, 
    options: RichNotificationOptions
  ): Promise<string> {
    const delay = timestamp - Date.now();
    if (delay <= 0) {
      this.showRichNotification('task-reminder', options);
      return Promise.resolve(id);
    }

    // Use persistent scheduler for better reliability
    return pwaNotificationScheduler.scheduleNotification({
      title: options.title,
      body: options.body,
      icon: options.icon,
      badge: options.badge,
      tag: options.tag,
      data: options.data,
      scheduledTime: timestamp,
      requireInteraction: options.requireInteraction,
      silent: options.silent,
      vibrate: options.vibrate,
      actions: options.actions
    });
  }

  async cancelScheduledNotification(id: string): Promise<void> {
    // Cancel from persistent scheduler
    await pwaNotificationScheduler.cancelNotification(id);
    
    // Cancel from memory if exists
    if (this.scheduledNotifications.has(id)) {
      window.clearTimeout(this.scheduledNotifications.get(id)!);
      this.scheduledNotifications.delete(id);
    }
  }

  // Notification for task reminders
  async showTaskReminder(task: any, dueIn: number): Promise<void> {
    const timeText = dueIn < 60 ? `${dueIn} minutes` : `${Math.round(dueIn / 60)} hours`;
    
    await this.showRichNotification('task-reminder', {
      title: 'Task Due Soon',
      body: `"${task.title}" is due in ${timeText}`,
      tag: `task-reminder-${task.id}`,
      requireInteraction: true,
      data: { taskId: task.id, type: 'task-reminder' },
      vibrate: [200, 100, 200, 100, 200]
    });
  }

  // Notification for task assignments
  async showTaskAssignment(task: any, assigner: string): Promise<void> {
    await this.showRichNotification('task-assignment', {
      title: 'New Task Assigned',
      body: `${assigner} assigned you: "${task.title}"`,
      tag: `task-assignment-${task.id}`,
      requireInteraction: true,
      data: { taskId: task.id, type: 'task-assignment' },
      vibrate: [100, 50, 100]
    });
  }

  // Notification for pomodoro completion
  async showPomodoroComplete(sessionType: 'work' | 'break', nextAction: string): Promise<void> {
    await this.showRichNotification('pomodoro-complete', {
      title: `${sessionType === 'work' ? 'Work' : 'Break'} Session Complete`,
      body: `Great job! Ready for your ${nextAction}?`,
      tag: 'pomodoro-complete',
      requireInteraction: true,
      data: { type: 'pomodoro-complete', sessionType, nextAction },
      vibrate: [300, 100, 300]
    });
  }

  // Notification for achievements
  async showAchievement(achievement: any): Promise<void> {
    await this.showRichNotification('achievement', {
      title: 'Achievement Unlocked! 🎉',
      body: achievement.description,
      tag: `achievement-${achievement.id}`,
      requireInteraction: false,
      data: { achievement, type: 'achievement' },
      vibrate: [100, 50, 100, 50, 100, 50, 200]
    });
  }

  // Daily summary notification
  async showDailySummary(completedTasks: number, streak: number): Promise<void> {
    await this.showRichNotification('achievement', {
      title: 'Daily Summary',
      body: `You completed ${completedTasks} tasks today! Current streak: ${streak} days`,
      tag: 'daily-summary',
      requireInteraction: false,
      data: { type: 'daily-summary', completedTasks, streak }
    });
  }

  // Group notifications by category
  async updateBadgeCount(count: number): Promise<void> {
    if ('navigator' in window && 'setAppBadge' in navigator) {
      try {
        if (count > 0) {
          await (navigator as any).setAppBadge(count);
        } else {
          await (navigator as any).clearAppBadge();
        }
      } catch (error) {
        console.warn('Failed to update app badge:', error);
      }
    }
  }
}

export const enhancedNotificationService = EnhancedNotificationService.getInstance();