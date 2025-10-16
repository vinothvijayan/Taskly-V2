import { useEffect, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useTasks } from '../contexts/TasksContext';
import { useAuth } from '../contexts/AuthContext';

// Simplified mobile features hook
export function useMobileFeatures() {
  const { addTask } = useTasks();
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    setIsEnabled(Capacitor.isNativePlatform());
    
    if (Capacitor.isNativePlatform()) {
      setupDeepLinkHandlers();
      setupNotificationActionHandlers();
    }
  }, []);

  const setupDeepLinkHandlers = () => {
    // Handle deep link for viewing a task
    const handleDeepLinkTask = (event: CustomEvent) => {
      const { taskId } = event.detail;
      console.log('Deep link to task:', taskId);
      // Navigate to task
    };

    // Handle deep link for adding a task
    const handleDeepLinkAddTask = (event: CustomEvent) => {
      console.log('Deep link to add task');
      // Navigate to add task screen
    };

    // Handle deep link for timer
    const handleDeepLinkTimer = (event: CustomEvent) => {
      console.log('Deep link to timer');
      // Navigate to timer
    };

    // Handle quick add task from share intent
    const handleDeepLinkQuickAdd = (event: CustomEvent) => {
      const { text, url } = event.detail;
      if (user?.uid && text) {
        addTask({
          title: text,
          description: url ? `Shared from: ${url}` : undefined,
          status: 'todo' as const,
          priority: 'medium' as const,
          createdBy: user.uid
        });
      }
    };

    // Register event listeners
    window.addEventListener('deep-link-task', handleDeepLinkTask as EventListener);
    window.addEventListener('deep-link-add-task', handleDeepLinkAddTask as EventListener);
    window.addEventListener('deep-link-timer', handleDeepLinkTimer as EventListener);
    window.addEventListener('deep-link-quick-add', handleDeepLinkQuickAdd as EventListener);

    return () => {
      window.removeEventListener('deep-link-task', handleDeepLinkTask as EventListener);
      window.removeEventListener('deep-link-add-task', handleDeepLinkAddTask as EventListener);
      window.removeEventListener('deep-link-timer', handleDeepLinkTimer as EventListener);
      window.removeEventListener('deep-link-quick-add', handleDeepLinkQuickAdd as EventListener);
    };
  };

  const setupNotificationActionHandlers = () => {
    const handleNotificationAction = (event: CustomEvent) => {
      const { action, data } = event.detail;
      
      switch (action) {
        case 'complete-task':
          console.log('Complete task from notification:', data.taskId);
          break;
        case 'start-break':
          console.log('Start break from notification');
          break;
        case 'continue-work':
          console.log('Continue work from notification');
          break;
        default:
          console.log('Unknown notification action:', action);
      }
    };

    window.addEventListener('notification-action', handleNotificationAction as EventListener);

    return () => {
      window.removeEventListener('notification-action', handleNotificationAction as EventListener);
    };
  };

  const scheduleTaskReminder = useCallback(async (taskId: string, reminderTime: Date) => {
    console.log('Would schedule task reminder:', taskId, reminderTime);
    // Implementation would go here when notification system is ready
  }, []);

  const scheduleTaskAssignmentNotification = useCallback(async (task: any, assignedBy: string) => {
    console.log('Would schedule task assignment notification:', task.title, assignedBy);
    // Implementation would go here when notification system is ready
  }, []);

  const schedulePomodoroReminder = useCallback(async (sessionType: 'work' | 'break', duration: number) => {
    console.log('Would schedule pomodoro reminder:', sessionType, duration);
    // Implementation would go here when notification system is ready
  }, []);

  const showPomodoroComplete = useCallback(async (sessionType: 'work' | 'break') => {
    console.log('Would show pomodoro complete notification:', sessionType);
    // Implementation would go here when notification system is ready
  }, []);

  const showAchievement = useCallback(async (achievement: any) => {
    console.log('Would show achievement notification:', achievement);
    // Implementation would go here when notification system is ready
  }, []);

  const cancelNotification = useCallback(async (id: string) => {
    console.log('Would cancel notification:', id);
    // Implementation would go here when notification system is ready
  }, []);

  return {
    isEnabled,
    scheduleTaskReminder,
    scheduleTaskAssignmentNotification,
    schedulePomodoroReminder,
    showPomodoroComplete,
    showAchievement,
    cancelNotification,
    // Platform detection
    isAndroid: Capacitor.getPlatform() === 'android',
    isIOS: Capacitor.getPlatform() === 'ios',
    isNative: Capacitor.isNativePlatform()
  };
}