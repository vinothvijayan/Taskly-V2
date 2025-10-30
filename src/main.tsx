import './lib/console'; // <-- ADD THIS LINE TO DISABLE LOGS
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Capacitor } from '@capacitor/core';

// Detect if we're running in a native Capacitor environment
const isNative = Capacitor.isNativePlatform();

// Initialize React app immediately
createRoot(document.getElementById("root")!).render(<App />);

// --- HELPER FUNCTION FOR SERVICE WORKER UPDATE ---
// This function handles the logic for prompting the user to update.
const handleServiceWorkerUpdate = (registration: ServiceWorkerRegistration) => {
  registration.onupdatefound = () => {
    const newWorker = registration.installing;
    if (newWorker) {
      newWorker.onstatechange = () => {
        // A new service worker has been installed and is now waiting to activate.
        // This is the perfect time to prompt the user to get the new version.
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // You can replace this simple confirm dialog with a more elegant UI,
          // like a toast notification with a refresh button.
          if (confirm("A new version of the app is available. Reload?")) {
            // Send a message to the new service worker, telling it to activate immediately.
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      };
    }
  };
};


// Initialize services asynchronously after React has started
const initializeServices = async () => {
  if (!isNative) {
    // Register service worker for PWA functionality (web only)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          
          // --- NEW: SETUP UPDATE AND RELOAD LOGIC ---
          // 1. Listen for updates to the service worker.
          handleServiceWorkerUpdate(registration);

          // 2. Listen for when the service worker controller changes.
          // This fires after the new worker has activated (via skipWaiting).
          // We reload the page to ensure the user gets the new assets.
          navigator.serviceWorker.oncontrollerchange = () => {
            window.location.reload();
          };
          // --- END OF NEW LOGIC ---

          
          // Dynamic imports to avoid loading web-specific code in native
          const [offlineSyncModule, schedulerModule, notificationsModule] = await Promise.all([
            import('./lib/offlineSync'),
            import('./lib/notificationScheduler'),
            import('./lib/unifiedNotifications')
          ]);
          
          // Initialize offline sync only (notifications handled in App.tsx)
          await offlineSyncModule.offlineSync.init();
          
          // Setup message listener for service worker communication
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'NOTIFICATION_ACTION') {
              // Handle notification actions
              window.dispatchEvent(new CustomEvent('notification-action', {
                detail: {
                  action: event.data.action,
                  data: event.data.notificationData
                }
              }));
            }
          });
        } catch (registrationError) {
          console.log('SW registration failed: ', registrationError);
        }
      });

      // Track user activity for better permission timing (your original code, unchanged)
      let lastActivity = Date.now();
      ['click', 'keydown', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, () => {
          lastActivity = Date.now();
        }, { passive: true });
      });
    }
  } else {
    // Native environment initialization
    // Notification initialization is handled in App.tsx to avoid conflicts
  }
};

// Start service initialization
initializeServices();