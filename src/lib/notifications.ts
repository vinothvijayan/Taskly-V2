export type AssignmentNotificationType = 'single' | 'bulk' | 'none';

// Global reference to addNotification function
let globalAddNotification: ((notification: any, targetUserId?: string) => Promise<void>) | null = null;

export const setGlobalAddNotification = (addNotificationFn: (notification: any, targetUserId?: string) => Promise<void>) => {
  globalAddNotification = addNotificationFn;
};

export class NotificationService {
  private static instance: NotificationService;
  private permission: NotificationPermission = 'default';
  private scheduledNotifications = new Map<string, NodeJS.Timeout>();

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

  public scheduleTaskReminder(task: any, minutesBefore: number = 15) {
    if (!task.dueDate) return;

    const dueDate = new Date(task.dueDate);
    const reminderTime = new Date(dueDate.getTime() - (minutesBefore * 60 * 1000));
    const now = new Date();

    if (reminderTime <= now) return; // Don't schedule past reminders

    const timeUntilReminder = reminderTime.getTime() - now.getTime();
    const notificationId = `task-reminder-${task.id}`;

    // Clear existing reminder if any
    this.clearScheduledNotification(notificationId);

    const timeoutId = setTimeout(() => {
      this.showNotification(`📋 Task Reminder: ${task.title}`, {
        body: `Due in ${minutesBefore} minutes: ${task.description || 'No description'}`,
        icon: '/favicon.ico',
        tag: notificationId,
        data: { taskId: task.id, type: 'reminder' },
        ...(('serviceWorker' in navigator) && { actions: [
          { action: 'start', title: '▶️ Start Now' },
          { action: 'snooze', title: '⏰ Snooze 5min' }
        ] })
      } as any);
      
      this.scheduledNotifications.delete(notificationId);

      // Alexa mirror for reminder
      import('./alexaNotifications').then(({ alexaNotifications }) => {
        alexaNotifications.send({
          title: 'Task Reminder',
          body: `${task.title} is due in ${minutesBefore} minutes`,
          type: 'reminder',
          data: { taskId: task.id }
        });
      });
    }, timeUntilReminder);

    this.scheduledNotifications.set(notificationId, timeoutId);
  }

  public scheduleTaskDueNotification(task: any) {
    if (!task.dueDate) return;

    const dueDate = new Date(task.dueDate);
    const now = new Date();

    if (dueDate <= now) return; // Don't schedule past notifications

    const timeUntilDue = dueDate.getTime() - now.getTime();
    const notificationId = `task-due-${task.id}`;

    // Clear existing notification if any
    this.clearScheduledNotification(notificationId);

    const timeoutId = setTimeout(() => {
      this.showNotification(`🚨 Task Due Now: ${task.title}`, {
        body: `This task is now due: ${task.description || 'No description'}`,
        icon: '/favicon.ico',
        tag: notificationId,
        data: { taskId: task.id, type: 'due' },
        requireInteraction: true,
        ...(('serviceWorker' in navigator) && { actions: [
          { action: 'complete', title: '✅ Mark Complete' },
          { action: 'extend', title: '⏰ Extend Deadline' }
        ] })
      } as any);
      
      this.scheduledNotifications.delete(notificationId);

      // Alexa mirror for due
      import('./alexaNotifications').then(({ alexaNotifications }) => {
        alexaNotifications.send({
          title: 'Task Due Now',
          body: `${task.title} is due now`,
          type: 'reminder',
          data: { taskId: task.id }
        });
      });
    }, timeUntilDue);

    this.scheduledNotifications.set(notificationId, timeoutId);
  }

  public showPomodoroNotification(type: 'focus-complete' | 'break-complete', sessionCount?: number) {
    // Removed: Redundant in-app notification call
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
    // Removed: Redundant in-app notification call
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
    // Check if the current user is among the newly assigned users
    if (!task.assignedTo || !task.assignedTo.includes(currentUserId)) {
      return;
    }

    // Add in-app notification
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

    // Alexa mirror (speech/webhook)
    import('./alexaNotifications').then(({ alexaNotifications }) => {
      alexaNotifications.send({
        title: 'New Task Assignment',
        body: `${assignerName} assigned ${task.title} to you${dueDateText ? ', due ' + new Date(task.dueDate).toLocaleString() : ''}`,
        type: 'assignment',
        data: { taskId: task.id, priority: task.priority }
      });
    });
  }

  public showBulkAssignmentNotification(taskCount: number, assignerName: string) {
    // Note: For bulk notifications, we'll need the current user ID
    // This will be handled by the calling context
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

  // Enhanced method to handle assignment notifications with bulk detection
  private pendingAssignments = new Map<string, { count: number; timeout: NodeJS.Timeout }>();

  public handleTaskAssignment(task: any, assignerName: string, currentUserId: string): AssignmentNotificationType {
    console.log('=== ASSIGNMENT NOTIFICATION DEBUG ===');
    console.log('Task assignedTo:', task.assignedTo);
    console.log('Current user ID:', currentUserId);
    console.log('Assigner name:', assignerName);
    
    // Check if the current user is among the newly assigned users
    if (!task.assignedTo || !task.assignedTo.includes(currentUserId)) {
      console.log('Current user not assigned to this task');
      return 'none';
    }

    console.log('Current user IS assigned to this task');

    const assignerKey = `${assignerName}-${currentUserId}`;
    
    // Check for bulk assignments (multiple assignments from same person within 30 seconds)
    if (this.pendingAssignments.has(assignerKey)) {
      const pending = this.pendingAssignments.get(assignerKey)!;
      clearTimeout(pending.timeout);
      
      const newCount = pending.count + 1;
      
      // If we reach 3 or more assignments, show bulk notification
      if (newCount >= 3) {
        console.log('Showing bulk assignment notification for', newCount, 'tasks');
        this.showBulkAssignmentNotification(newCount, assignerName);
        this.pendingAssignments.delete(assignerKey);
        return 'bulk';
      }
      
      // Update the pending count and reset timer
      const timeout = setTimeout(() => {
        this.pendingAssignments.delete(assignerKey);
      }, 30000); // 30 seconds window for bulk detection
      
      this.pendingAssignments.set(assignerKey, { count: newCount, timeout });
    } else {
      // First assignment from this person, start the bulk detection timer
      const timeout = setTimeout(() => {
        this.pendingAssignments.delete(assignerKey);
      }, 30000);
      
      this.pendingAssignments.set(assignerKey, { count: 1, timeout });
    }

    // Show individual assignment notification
    console.log('Showing single assignment notification');
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

  public scheduleRecurringReminders(tasks: any[]) {
    // Clear all existing reminders
    this.clearAllScheduledNotifications();

    // Schedule reminders for all tasks with due dates
    tasks.forEach(task => {
      if (task.dueDate && task.status !== 'completed') {
        this.scheduleTaskReminder(task, 15); // 15 minutes before
        this.scheduleTaskReminder(task, 60); // 1 hour before
        this.scheduleTaskDueNotification(task);
      }
    });
  }

  public clearScheduledNotification(notificationId: string) {
    const timeoutId = this.scheduledNotifications.get(notificationId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.scheduledNotifications.delete(notificationId);
    }
  }

  public clearAllScheduledNotifications() {
    this.scheduledNotifications.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.scheduledNotifications.clear();
  }

  public getScheduledNotificationsCount(): number {
    return this.scheduledNotifications.size;
  }

  public isPermissionGranted(): boolean {
    return this.permission === 'granted';
  }

  // Daily productivity summary
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

  // Weekly goal reminder
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

// Service Worker message handling
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { action, data } = event.data;
    
    switch (action) {
      case 'notification-click':
        // Handle notification click actions
        console.log('Notification clicked:', data);
        break;
      case 'notification-action':
        // Handle notification action button clicks
        console.log('Notification action:', data);
        break;
    }
  });
}