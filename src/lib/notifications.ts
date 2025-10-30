import { toast } from 'sonner';
import { addMinutes, addDays } from 'date-fns';
import { pwaNotificationScheduler } from './notificationScheduler';
import { TaskReminderToast } from '@/components/ui/TaskReminderToast';
import { Task } from '@/types';

export type AssignmentNotificationType = 'single' | 'bulk' | 'none';

// Global reference to addNotification function
let globalAddNotification: ((notification: any, targetUserId?: string) => Promise<void>) | null = null;

export const setGlobalAddNotification = (addNotificationFn: (notification: any, targetUserId?: string) => Promise<void>) => {
  globalAddNotification = addNotificationFn;
};

export class NotificationService {
  private static instance: NotificationService;
  private permission: NotificationPermission = 'default';

  private constructor() {
    this.checkPermission();
    this.setupServiceWorker();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async addInAppNotification(
    userId: string, 
    title: string, 
    body: string, 
    type: 'task-assignment' | 'task-complete' | 'pomodoro-complete' | 'team-request' | 'general' | 'chat', // Added 'chat'
    data?: any
  ) {
    if (globalAddNotification) {
      try {
        await globalAddNotification({
          title,
          body,
          type,
          read: false,
          data: data || {}
        }, userId);
        console.log("In-app notification added:", { title, body, type });
      } catch (error) {
        console.error("Failed to add in-app notification:", error);
      }
    } else {
      console.warn("Global addNotification function not available");
    }
  }

  private checkPermission() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  private async setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // Register service worker for background notifications
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
      } catch (error) {
        console.warn('Service Worker registration failed:', error);
      }
    }
  }

  public async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    const permission = await Notification.requestPermission();
    this.permission = permission;
    return permission === 'granted';
  }

  public async showNotification(title: string, options?: NotificationOptions): Promise<Notification | null> {
    if (this.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    const defaultOptions: NotificationOptions = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'mindmeld-notification',
      requireInteraction: false,
      silent: false,
      ...options
    };

    try {
      // Check if actions are supported in this environment
      const actionsSupported = 'serviceWorker' in navigator && 'actions' in Notification.prototype;
      if (actionsSupported && (defaultOptions as any).actions && (defaultOptions as any).actions.length > 0) {
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, defaultOptions);
            return null; // Service Worker notifications don't return a Notification object
          } catch (error) {
            console.warn('Service Worker notification failed, falling back to basic notification:', error);
            // Fall back to basic notification without actions
            const { actions, ...basicOptions } = defaultOptions as any;
            const notification = new Notification(title, basicOptions);
            
            if (!basicOptions.requireInteraction) {
              setTimeout(() => {
                notification.close();
              }, 5000);
            }
            
            return notification;
          }
        } else {
          // Service Worker not available, use basic notification without actions
          const { actions, ...basicOptions } = defaultOptions as any;
          const notification = new Notification(title, basicOptions);
          
          if (!basicOptions.requireInteraction) {
            setTimeout(() => {
              notification.close();
            }, 5000);
          }
          
          return notification;
        }
      } else {
        // No actions, use standard notification
        const notification = new Notification(title, defaultOptions);
        
        // Auto-close after 5 seconds unless requireInteraction is true
        if (!defaultOptions.requireInteraction) {
          setTimeout(() => {
            notification.close();
          }, 5000);
        }
        
        return notification;
      }
    } catch (error) {
      console.error('Failed to show notification:', error);
      return null;
    }
  }

  public showActionableTaskReminder(task: Task) {
    toast.custom((t) => (
      <TaskReminderToast
        task={task}
        onSnooze={() => {
          window.dispatchEvent(new CustomEvent('snooze-task', { detail: { taskId: task.id, minutes: 15 } }));
          toast.info(`Task "${task.title}" snoozed for 15 minutes.`);
          toast.dismiss(t);
        }}
        onComplete={() => {
          window.dispatchEvent(new CustomEvent('complete-task-from-toast', { detail: { taskId: task.id } }));
          toast.success(`Task "${task.title}" marked as complete.`);
          toast.dismiss(t);
        }}
        onDismiss={() => toast.dismiss(t)}
      />
    ), {
      duration: 60000, // 1 minute
    });
  }

  public async scheduleActionableReminder(task: any) {
    if (!task.dueDate) return;

    const dueDate = new Date(task.dueDate);
    const now = new Date();

    // Don't schedule reminders for tasks already past due
    if (dueDate <= now) return;

    const notificationId = `actionable-reminder-${task.id}`;

    console.log(`[1/5] scheduleActionableReminder: Scheduling toast reminder for task "${task.title}"`);
    console.log(`   - Reminder will fire at due time: ${dueDate.toLocaleString()}`);

    await pwaNotificationScheduler.cancelNotification(notificationId);

    await pwaNotificationScheduler.scheduleNotification({
        id: notificationId,
        title: `Reminder: ${task.title}`,
        body: `This task is now due.`,
        scheduledTime: dueDate.getTime(),
        data: { type: 'actionable-task-reminder', task }
    });
  }

  public showPomodoroNotification(type: 'focus-complete' | 'break-complete', sessionCount?: number) {
    const notifications = {
      'focus-complete': {
        title: '🎉 Focus Session Complete!',
        body: `Great work! Time for a well-deserved break. Sessions completed: ${sessionCount || 0}`,
        actions: [
          { action: 'start-break', title: '☕ Start Break' },
          { action: 'continue', title: '🔄 Continue Working' }
        ]
      },
      'break-complete': {
        title: '⚡ Break Time Over!',
        body: 'Ready to focus again? Let\'s get back to work!',
        actions: [
          { action: 'start-focus', title: '🎯 Start Focus' },
          { action: 'extend-break', title: '⏰ Extend Break' }
        ]
      }
    };

    const notification = notifications[type];
    this.showNotification(notification.title, {
      body: notification.body,
      tag: `pomodoro-${type}`,
      requireInteraction: true,
      ...(('serviceWorker' in navigator) && { actions: notification.actions })
    } as any);
  }

  public showTaskCompleteNotification(taskTitle: string) {
    this.showNotification('🎯 Task Completed!', {
      body: `Great job completing "${taskTitle}"!`,
      tag: 'task-complete',
      ...(('serviceWorker' in navigator) && { actions: [
        { action: 'view-stats', title: '📊 View Stats' },
        { action: 'next-task', title: '➡️ Next Task' }
      ] })
    } as any);
  }

  public showTaskAssignmentNotification(task: any, assignerName: string, currentUserId: string) {
    if (!task.assignedTo || !task.assignedTo.includes(currentUserId)) {
      return;
    }

    this.addInAppNotification(
      currentUserId,
      `New Task Assignment`,
      `${assignerName} assigned "${task.title}" to you`,
      'task-assignment',
      {
        taskId: task.id,
        taskTitle: task.title,
        assignerName: assignerName,
        priority: task.priority
      }
    );

    const priorityEmoji = task.priority === 'high' ? '🔥' : task.priority === 'medium' ? '⚡' : '📝';
    const dueDateText = task.dueDate ? ` (Due: ${new Date(task.dueDate).toLocaleDateString()})` : '';
    
    this.showNotification(`${priorityEmoji} New Task Assignment`, {
      body: `${assignerName} assigned "${task.title}" to you${dueDateText}`,
      tag: `task-assignment-${task.id}`,
      requireInteraction: true,
      ...(('serviceWorker' in navigator) && { actions: [
        { action: 'start-task', title: '▶️ Start Now' },
        { action: 'view-task', title: '👁️ View Details' },
        { action: 'mark-progress', title: '🔄 Mark In Progress' }
      ] }),
      data: { 
        taskId: task.id, 
        type: 'assignment',
        priority: task.priority,
        assignerName: assignerName
      }
    } as any);
  }

  public showBulkAssignmentNotification(taskCount: number, assignerName: string) {
    this.showNotification('📋 Multiple Task Assignments', {
      body: `${assignerName} assigned ${taskCount} tasks to you`,
      tag: 'bulk-assignment',
      requireInteraction: true,
      ...(('serviceWorker' in navigator) && { actions: [
        { action: 'view-all-tasks', title: '📋 View All Tasks' },
        { action: 'prioritize', title: '🎯 Help Me Prioritize' }
      ] }),
      data: { 
        type: 'bulk-assignment',
        taskCount: taskCount,
        assignerName: assignerName
      }
    } as any);
  }

  public showSmartTaskSuggestion(task: any, reason: string) {
    this.showNotification('🤖 AI Task Suggestion', {
      body: `Based on your schedule, I suggest working on "${task.title}" now. ${reason}`,
      tag: `ai-suggestion-${task.id}`,
      ...(('serviceWorker' in navigator) && { actions: [
        { action: 'start-suggested', title: '🚀 Start Now' },
        { action: 'schedule-later', title: '⏰ Schedule Later' },
        { action: 'dismiss-suggestion', title: '❌ Not Now' }
      ] }),
      data: { 
        taskId: task.id, 
        type: 'ai-suggestion',
        reason: reason
      }
    } as any);
  }

  public showTeamCollaborationUpdate(teamMemberName: string, action: string, taskTitle: string) {
    const actionEmojis: { [key: string]: string } = {
      'started': '▶️',
      'completed': '✅',
      'commented': '💬',
      'updated': '📝'
    };

    this.showNotification(`${actionEmojis[action] || '📋'} Team Update`, {
      body: `${teamMemberName} ${action} "${taskTitle}"`,
      tag: `team-update-${Date.now()}`,
      ...(('serviceWorker' in navigator) && { actions: [
        { action: 'view-task', title: '👁️ View Task' },
        { action: 'send-message', title: '💬 Send Message' }
      ] }),
      data: { 
        type: 'team-collaboration',
        action: action,
        teamMemberName: teamMemberName
      }
    } as any);
  }

  public showWorkloadBalanceAlert(currentTasks: number, suggestedAction: string) {
    this.showNotification('⚖️ Workload Balance Alert', {
      body: `You have ${currentTasks} active tasks. ${suggestedAction}`,
      tag: 'workload-balance',
      ...(('serviceWorker' in navigator) && { actions: [
        { action: 'auto-prioritize', title: '🤖 Auto-Prioritize' },
        { action: 'delegate-tasks', title: '👥 Delegate Tasks' },
        { action: 'schedule-break', title: '☕ Schedule Break' }
      ] }),
      data: { 
        type: 'workload-balance',
        currentTasks: currentTasks
      }
    } as any);
  }

  private pendingAssignments = new Map<string, { count: number; timeout: NodeJS.Timeout }>();

  public handleTaskAssignment(task: any, assignerName: string, currentUserId: string): AssignmentNotificationType {
    if (!task.assignedTo || !task.assignedTo.includes(currentUserId)) {
      return 'none';
    }

    const assignerKey = `${assignerName}-${currentUserId}`;
    
    if (this.pendingAssignments.has(assignerKey)) {
      const pending = this.pendingAssignments.get(assignerKey)!;
      clearTimeout(pending.timeout);
      
      const newCount = pending.count + 1;
      
      if (newCount >= 3) {
        this.showBulkAssignmentNotification(newCount, assignerName);
        this.pendingAssignments.delete(assignerKey);
        return 'bulk';
      }
      
      const timeout = setTimeout(() => {
        this.pendingAssignments.delete(assignerKey);
      }, 30000);
      
      this.pendingAssignments.set(assignerKey, { count: newCount, timeout });
    } else {
      const timeout = setTimeout(() => {
        this.pendingAssignments.delete(assignerKey);
      }, 30000);
      
      this.pendingAssignments.set(assignerKey, { count: 1, timeout });
    }

    this.showTaskAssignmentNotification(task, assignerName, currentUserId);
    return 'single';
  }
  public showDailyMotivation() {
    const motivationalMessages = [
      "Ready to crush your goals today? 💪",
      "Every small step counts towards your success! 🌟",
      "Focus on progress, not perfection! 🎯",
      "You've got this! Let's make today productive! 🚀",
      "Time to turn your dreams into achievements! ✨"
    ];

    const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
    
    this.showNotification('🌅 Good Morning!', {
      body: randomMessage,
      tag: 'daily-motivation'
    });
  }

  public async clearScheduledNotification(notificationId: string) {
    await pwaNotificationScheduler.cancelNotification(notificationId);
  }

  public async clearAllScheduledNotifications() {
    const allPending = await pwaNotificationScheduler.getAllPendingNotifications();
    for (const notif of allPending) {
      await pwaNotificationScheduler.cancelNotification(notif.id);
    }
  }

  public getScheduledNotificationsCount(): number {
    // This is now an async operation, but for simplicity, we'll return 0.
    // A more complex implementation would be needed to get a live count.
    return 0;
  }

  public isPermissionGranted(): boolean {
    return this.permission === 'granted';
  }

  public showDailySummary(stats: {
    tasksCompleted: number;
    focusTime: number;
    sessionsCompleted: number;
  }) {
    const { tasksCompleted, focusTime, sessionsCompleted } = stats;
    
    this.showNotification('📊 Daily Summary', {
      body: `Today: ${tasksCompleted} tasks completed, ${focusTime}min focused, ${sessionsCompleted} sessions`,
      tag: 'daily-summary',
      requireInteraction: false
    });
  }

  public showWeeklyGoalReminder() {
    this.showNotification('🎯 Weekly Goals Check-in', {
      body: 'How are you progressing with your weekly goals? Take a moment to review!',
      tag: 'weekly-goals',
      ...(('serviceWorker' in navigator) && { actions: [
        { action: 'review-goals', title: '📋 Review Goals' },
        { action: 'update-goals', title: '✏️ Update Goals' }
      ] })
    } as any);
  }
}

export const notificationService = NotificationService.getInstance();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { action, data } = event.data;
    
    switch (action) {
      case 'notification-click':
        console.log('Notification clicked:', data);
        break;
      case 'notification-action':
        console.log('Notification action:', data);
        break;
    }
  });
}