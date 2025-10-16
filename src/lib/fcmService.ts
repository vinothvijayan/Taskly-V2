import { getMessaging, getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { messaging } from './firebase';

class FCMService {
  private messaging: any = null;
  private vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

  async init() {
    try {
      if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        console.warn('FCM not supported in this browser');
        return;
      }

      // Use the already initialized messaging instance
      this.messaging = messaging;

      await this.requestPermission();
      this.setupMessageListener();
    } catch (error) {
      console.error('Failed to initialize FCM:', error);
    }
  }

  async requestPermission(): Promise<string | null> {
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Wait for service worker to be ready
        const registration = await navigator.serviceWorker.ready;
        
        const token = await getToken(this.messaging, {
          vapidKey: this.vapidKey,
          serviceWorkerRegistration: registration
        });
        
        if (token) {
          console.log('FCM token received:', token);
          return token;
        } else {
          console.warn('No FCM token available');
          return null;
        }
      } else {
        console.warn('Notification permission denied');
        return null;
      }
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      throw error;
    }
  }

  setupMessageListener() {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload: MessagePayload) => {
      console.log('Message received:', payload);
      
      // Handle foreground messages
      if (payload.notification) {
        const { title, body, icon } = payload.notification;
        
        if ('serviceWorker' in navigator && 'showNotification' in ServiceWorkerRegistration.prototype) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title || 'New Message', {
              body: body || '',
              icon: icon || '/icon-192x192.png',
              badge: '/icon-192x192.png',
              tag: 'fcm-message',
              requireInteraction: false,
              silent: false
            });
          });
        }
      }
    });
  }

  async getToken(): Promise<string | null> {
    if (!this.messaging) {
      await this.init();
    }
    
    try {
      const registration = await navigator.serviceWorker.ready;
      return await getToken(this.messaging, {
        vapidKey: this.vapidKey,
        serviceWorkerRegistration: registration
      });
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  }
}

export const fcmService = new FCMService();
export default fcmService;