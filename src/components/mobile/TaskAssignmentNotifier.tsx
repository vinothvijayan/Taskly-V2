// src/components/TaskAssignmentNotifier.tsx

import { useEffect, useState } from 'react';
import { useTasks } from '@/contexts/TasksContext';
import { useAuth } from '@/contexts/AuthContext';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// --- Placeholder Type ---
// Make sure this matches your actual Task type definition from '../../types' or wherever it lives.
export interface Task {
  id: string;
  title: string;
  assignedTo?: string[];
  createdAt?: string | Date; // Can be string (from Firestore) or Date object
}
// --- End Placeholder Type ---

/**
 * A headless component that monitors for new task assignments and sends a native
 * local notification to the user.
 */
export function TaskAssignmentNotifier() {
  const { tasks } = useTasks();
  const { user } = useAuth();
  
  // State to keep track of tasks we've already notified the user about
  // This is crucial to prevent sending the same notification multiple times.
  const [notifiedTaskIds, setNotifiedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkForNewAssignments = async () => {
      // 1. Guard Clauses: Exit early if conditions aren't met.
      if (!user) {
        return;
      }

      // 2. Check for notification permission before doing any work (only for native platforms).
      if (Capacitor.isNativePlatform()) {
        const permissionStatus = await LocalNotifications.checkPermissions();
        if (permissionStatus.display !== 'granted') {
          console.log('Native notification permission not granted, skipping native assignment check.');
          return;
        }
      }

      // 3. Filter to find only the tasks that need a notification.
      const newTasksToNotify = tasks.filter(task => {
        const isAssigned = task.assignedTo?.includes(user.uid);
        // Ensure createdAt exists before using it
        const isRecent = task.createdAt && (Date.now() - new Date(task.createdAt).getTime() < 300000); // Within last 5 minutes
        const hasNotBeenNotified = !notifiedTaskIds.has(task.id);
        
        return isAssigned && isRecent && hasNotBeenNotified;
      });

      // 4. If there are no new tasks, we're done.
      if (newTasksToNotify.length === 0) {
        return;
      }

      console.log(`Found ${newTasksToNotify.length} new task(s) to notify about.`);

      // 5. Prepare the notification objects for the Capacitor plugin.
      if (Capacitor.isNativePlatform()) {
        // Native notifications for Capacitor
        const notifications = newTasksToNotify.map(task => ({
          id: Math.floor(Math.random() * 1000000),
          title: 'New Task Assigned',
          body: `You have been assigned: "${task.title}"`,
          schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
          channelId: 'app_main_channel',
          extra: {
            taskId: task.id,
            type: 'task_assignment'
          }
        }));

        try {
          await LocalNotifications.schedule({ notifications });
          console.log('Native task assignment notifications scheduled successfully');
        } catch (error) {
          console.error('Failed to schedule native notifications:', error);
        }
      } else {
        // Web notifications for PWA
        for (const task of newTasksToNotify) {
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Task Assigned', {
                body: `You have been assigned: "${task.title}"`,
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                tag: `task-assignment-${task.id}`,
                data: {
                  taskId: task.id,
                  type: 'task_assignment'
                },
                requireInteraction: true,
                vibrate: [200, 100, 200] // Cast to any to allow vibrate property
              } as any);
            }
          } catch (error) {
            console.error('Failed to show web notification:', error);
          }
        }
      }

      // 6. Update state to prevent duplicates regardless of platform
      setNotifiedTaskIds(prevIds => {
        const newIds = new Set(prevIds);
        newTasksToNotify.forEach(task => newIds.add(task.id));
        return newIds;
      });
    };

    checkForNewAssignments();
  }, [tasks, user, notifiedTaskIds]); // Effect dependencies

  // This is a utility component, so it renders nothing.
  return null;
}