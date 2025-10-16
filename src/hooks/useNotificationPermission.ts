// src/hooks/useNotificationPermission.ts

import { useState, useEffect, useCallback } from 'react';
import { LocalNotifications, PermissionStatus } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * A helper function to create the required notification channel for Android (API 26+).
 * This is a one-time setup operation.
 * 
 * **IMPORTANT**: Call this function once when your application starts up, for example,
 * in a `useEffect` hook inside your main `App.tsx` file.
 */
export const createNotificationChannel = async () => {
  // Notification channels are an Android-only feature.
  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: 'app_main_channel', // A unique ID for this channel. Must be used when scheduling notifications.
      name: 'Primary Notifications',
      description: 'General app notifications and reminders',
      importance: 4, // Corresponds to `Importance.HIGH`. Makes sound.
      vibration: true,
      visibility: 1, // Corresponds to `Visibility.PUBLIC`.
    });
    console.log('Android notification channel "app_main_channel" created or already exists.');
  }
};

/**
 * A React hook for managing local notification permissions in a Capacitor application.
 * It provides the current permission state and functions to request permission and
 * send a test notification, all using native-safe Capacitor APIs.
 */
export function useNotificationPermission() {
  // Use Capacitor's `PermissionState` for type safety: 'prompt', 'granted', or 'denied'.
  const [permission, setPermission] = useState<PermissionStatus>('prompt' as unknown as PermissionStatus);
  
  // This state can be used to control a custom "pre-permission" dialog in your UI.
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  // Checks the current notification permission status when the hook is first used.
  const checkPermission = useCallback(async () => {
    // This hook is designed for native platforms.
    if (!Capacitor.isNativePlatform()) return; 
    
    try {
      const result = await LocalNotifications.checkPermissions();
      setPermission(result.display as unknown as PermissionStatus);
    } catch (error) {
      console.error("Error checking notification permissions:", error);
    }
  }, []);

  // Run the initial permission check on component mount.
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  /**
   * Requests notification permission from the user. The OS will only show a
   * prompt if the permission is currently 'prompt'. If 'denied', the user
   * must enable it in the app settings.
   * @returns {Promise<boolean>} A promise that resolves to `true` if permission was granted.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;

    if (permission === ('granted' as unknown as PermissionStatus)) {
      return true;
    }
    
    // If permission is 'denied', we cannot re-prompt. The user must change it in settings.
    if (permission === ('denied' as unknown as PermissionStatus)) {
      console.warn("Notification permission is denied. User must enable it in settings.");
      return false;
    }

    try {
      const result = await LocalNotifications.requestPermissions();
      setPermission(result.display as unknown as PermissionStatus);
      return result.display === 'granted';
    } catch (error) {
      console.error("Error requesting notification permissions:", error);
      return false;
    }
  }, [permission]);

  /**
   * Schedules a test local notification to verify that the system is working.
   * Will only work if permission has been granted.
   */
  const testNotification = async () => {
    if (!Capacitor.isNativePlatform()) return;

    const currentPermissions = await LocalNotifications.checkPermissions();
    if (currentPermissions.display !== 'granted') {
      console.warn('Cannot send test notification: permission not granted.');
      // Optionally, you could trigger the permission request here again.
      // await requestPermission(); 
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Test Notification',
            body: 'If you see this, native notifications are working! 🎉',
            id: new Date().getTime(), // A unique ID for this notification
            schedule: { at: new Date(Date.now() + 1000) }, // Show in 1 second
            
            // ** IMPORTANT **: This must match the ID of the channel you created earlier.
            channelId: 'app_main_channel',
          },
        ],
      });
      console.log('Test notification scheduled successfully.');
    } catch (error) {
      console.error("Error scheduling test notification:", error);
    }
  };

  return {
    /** The current state of the notification permission: 'prompt', 'granted', or 'denied'. */
    permission,
    /** A boolean you can use to show a custom UI dialog before the native prompt. */
    showPermissionDialog,
    /** A function to manually control the `showPermissionDialog` state. */
    setShowPermissionDialog,
    /** A function to trigger the native permission prompt. */
    requestPermission,
    /** A function to send a test notification to the device. */
    testNotification,
    /** A boolean indicating if the app is running on a native platform where this hook is supported. */
    isSupported: Capacitor.isNativePlatform(),
    /** A convenience boolean that is true if the app can currently request permission. */
    canRequest: permission === ('prompt' as unknown as PermissionStatus) || permission === ('prompt-with-rationale' as unknown as PermissionStatus),
  };
}