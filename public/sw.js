// Enhanced Service Worker for PWA with offline functionality
const CACHE_NAME = 'taskly-v1';
const STATIC_CACHE = 'taskly-static-v1';
const DYNAMIC_CACHE = 'taskly-dynamic-v1';

// Critical assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/sounds/iphone_ding.mp3',
  '/sounds/ting.mp3'
];

// Dynamic assets to cache on first request
const CACHE_STRATEGIES = {
  images: 'cache-first',
  api: 'network-first',
  static: 'cache-first'
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)),
      self.skipWaiting()
    ])
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
      await self.clients.claim();
      
      // Check for and restart any active timers
      const [session, subtaskSession] = await Promise.all([
        manageSession(TIMER_SESSION_KEY, 'get'),
        manageSession(SUBTASK_TIMER_SESSION_KEY, 'get')
      ]);
      if ((session && !session.isPaused) || (subtaskSession && !subtaskSession.isPaused)) {
        runTimer();
      }
    })()
  );
});


// Firebase Cloud Messaging (FCM) support
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
if (typeof firebase !== 'undefined') {
  firebase.initializeApp({
    apiKey: "AIzaSyCmioywtCMDFJjDvq8bF0_NBZJC5nyVPYo",
    authDomain: "huddlely.firebaseapp.com",
    projectId: "huddlely",
    storageBucket: "huddlely.firebasestorage.app",
    messagingSenderId: "788189911710",
    appId: "1:788189911710:web:3fd75fade0c56164d5b98f"
  });

  const messaging = firebase.messaging();

  // Handle background messages
  messaging.onBackgroundMessage((payload) => {
    console.log('Background message received:', payload);
    
    const notificationTitle = payload.notification?.title || 'New Notification';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: payload.notification?.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: payload.data?.type || 'general',
      data: payload.data,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'view', title: 'View', icon: '/icon-192x192.png' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// --- NEW: BACKGROUND TIME TRACKING LOGIC ---

let timerInterval = null;
const TIMER_SESSION_KEY = 'currentSession';
const SUBTASK_TIMER_SESSION_KEY = 'currentSubtaskSession';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TasklyOfflineDB', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // No onupgradeneeded here, it's handled by the main app
  });
}

async function manageSession(key, action, data = null) {
  const db = await openDB();
  const transaction = db.transaction(['activeTimerSession'], 'readwrite');
  const store = transaction.objectStore('activeTimerSession');
  
  return new Promise((resolve, reject) => {
    let request;
    if (action === 'get') {
      request = store.get(key);
    } else if (action === 'set') {
      request = store.put({ id: key, ...data });
    } else if (action === 'delete') {
      request = store.delete(key);
    } else {
      return reject('Invalid action');
    }
    
    transaction.oncomplete = () => {
      resolve(request.result || null);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

function runTimer() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(async () => {
    const [session, subtaskSession] = await Promise.all([
      manageSession(TIMER_SESSION_KEY, 'get'),
      manageSession(SUBTASK_TIMER_SESSION_KEY, 'get')
    ]);

    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });

    if (session && !session.isPaused) {
      const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
      const totalElapsed = session.accumulatedSeconds + elapsed;
      
      clients.forEach(client => {
        client.postMessage({
          type: 'TIME_TRACKING_UPDATE',
          payload: {
            type: 'task',
            isTracking: true,
            currentSessionElapsedSeconds: totalElapsed,
            taskId: session.taskId
          }
        });
      });
    }
    
    if (subtaskSession && !subtaskSession.isPaused) {
      const elapsed = Math.floor((Date.now() - subtaskSession.startTime) / 1000);
      const totalElapsed = subtaskSession.accumulatedSeconds + elapsed;
      
      clients.forEach(client => {
        client.postMessage({
          type: 'TIME_TRACKING_UPDATE',
          payload: {
            type: 'subtask',
            isTrackingSubtask: true,
            currentSubtaskElapsedSeconds: totalElapsed,
            taskId: subtaskSession.taskId,
            subtaskId: subtaskSession.subtaskId
          }
        });
      });
    }

    if ((!session || session.isPaused) && (!subtaskSession || subtaskSession.isPaused)) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }, 1000);
}

async function handleTimeTrackingMessage(data) {
  const { type, session } = data;
  const key = session.subtaskId ? SUBTASK_TIMER_SESSION_KEY : TIMER_SESSION_KEY;

  switch (type) {
    case 'START_TIME_TRACKING':
    case 'START_SUBTASK_TIME_TRACKING':
      await manageSession(key, 'set', session);
      if (!timerInterval) runTimer();
      break;
    
    case 'PAUSE_TIME_TRACKING':
    case 'PAUSE_SUBTASK_TIME_TRACKING': {
      const existingSession = await manageSession(key, 'get');
      if (existingSession && !existingSession.isPaused) {
        const elapsed = Math.floor((Date.now() - existingSession.startTime) / 1000);
        await manageSession(key, 'set', {
          ...existingSession,
          isPaused: true,
          pausedAt: Date.now(),
          accumulatedSeconds: existingSession.accumulatedSeconds + elapsed
        });
      }
      break;
    }
      
    case 'RESUME_TIME_TRACKING':
    case 'RESUME_SUBTASK_TIME_TRACKING': {
      const existingSession = await manageSession(key, 'get');
      if (existingSession && existingSession.isPaused) {
        await manageSession(key, 'set', {
          ...existingSession,
          isPaused: false,
          startTime: Date.now(),
          pausedAt: null
        });
        if (!timerInterval) runTimer();
      }
      break;
    }
      
    case 'STOP_TIME_TRACKING':
    case 'STOP_SUBTASK_TIME_TRACKING': {
      const existingSession = await manageSession(key, 'get');
      if (existingSession) {
        const elapsed = existingSession.isPaused ? 0 : Math.floor((Date.now() - existingSession.startTime) / 1000);
        const finalSeconds = existingSession.accumulatedSeconds + elapsed;

        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        clients.forEach(client => {
          client.postMessage({
            type: 'TIME_TRACKING_STOPPED',
            payload: {
              type: session.subtaskId ? 'subtask' : 'task',
              taskId: existingSession.taskId,
              subtaskId: existingSession.subtaskId,
              finalSeconds: finalSeconds
            }
          });
        });
        
        await manageSession(key, 'delete');
      }
      break;
    }
  }
}

// =========================================================================
// === UPDATED MESSAGE LISTENER FOR APP UPDATES AND NOTIFICATIONS ===
// =========================================================================
self.addEventListener('message', (event) => {
  // Handle the 'SKIP_WAITING' message from the main application to activate the new SW
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Service Worker received SKIP_WAITING message. Activating new version.');
    self.skipWaiting();
    return; // Stop further execution for this message type
  }

  // Handle background time tracking messages
  if (event.data && event.data.type && event.data.type.startsWith('TIME_TRACKING_')) {
    handleTimeTrackingMessage(event.data);
    return;
  }

  // Handle the 'SHOW_NOTIFICATION' message from the main application
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { options } = event.data;
    
    // Show notification with mobile optimizations
    self.registration.showNotification(options.title, {
      body: options.body,
      icon: options.icon || '/icon-192x192.png',
      badge: options.badge || '/icon-192x192.png',
      tag: options.tag,
      data: options.data,
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false,
      vibrate: options.vibrate || [200, 100, 200],
      actions: options.actions || [],
      image: options.image,
      timestamp: Date.now()
    }).catch(error => {
      console.error('Failed to show notification:', error);
    });
  }
});
// =========================================================================

// Enhanced fetch event with smart caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Handle different types of requests
  if (url.pathname.startsWith('/api/') || url.hostname.includes('firestore') || url.hostname.includes('firebase')) {
    // API requests - network first with cache fallback
    event.respondWith(networkFirstStrategy(request));
  } else if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) {
    // Images - cache first
    event.respondWith(cacheFirstStrategy(request));
  } else if (STATIC_ASSETS.includes(url.pathname)) {
    // Static assets - cache first
    event.respondWith(cacheFirstStrategy(request));
  } else {
    // Other requests - stale while revalidate
    event.respondWith(staleWhileRevalidateStrategy(request));
  }
});

// Caching strategies
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// Push event for notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from Taskly',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/favicon.ico'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/favicon.ico'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Taskly', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Handle notification action clicks
  if (event.action) {
    // Send action to main thread
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          // Focus existing window and send message
          clients[0].focus();
          clients[0].postMessage({
            type: 'NOTIFICATION_ACTION',
            action: event.action,
            notificationData: event.notification.data
          });
        } else {
          // Open new window
          self.clients.openWindow('/').then(client => {
            if (client) {
              // Send message once window loads
              client.postMessage({
                type: 'NOTIFICATION_ACTION',
                action: event.action,
                notificationData: event.notification.data
              });
            }
          });
        }
      })
    );
  } else {
    // Default click - open app
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  }

  // Send general notification click event
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          action: 'notification-click',
          data: event.notification.data,
          actionClicked: event.action
        });
      });
    })
  );
});

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      checkScheduledNotifications()
    );
  } else if (event.tag === 'notification-sync') {
    event.waitUntil(
      checkScheduledNotifications()
    );
  }
});

// Check for scheduled notifications in IndexedDB
async function checkScheduledNotifications() {
  try {
    // Open IndexedDB
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('TasklyOfflineDB', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Get scheduled notifications
    const transaction = db.transaction(['scheduledNotifications'], 'readwrite');
    const store = transaction.objectStore('scheduledNotifications');
    const index = store.index('status');
    
    const pendingNotifications = await new Promise((resolve, reject) => {
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const now = Date.now();
    
    for (const notification of pendingNotifications) {
      if (notification.scheduledTime <= now) {
        // Show notification
        await self.registration.showNotification(notification.title, {
          body: notification.body,
          icon: notification.icon || '/icon-192x192.png',
          badge: notification.badge || '/icon-192x192.png',
          tag: notification.tag || `notification-${notification.id}`,
          data: notification.data,
          requireInteraction: notification.requireInteraction || false,
          silent: notification.silent || false,
          vibrate: notification.vibrate || [200, 100, 200],
          actions: notification.actions || [],
          timestamp: Date.now()
        });

        // Mark as delivered
        notification.status = 'delivered';
        await new Promise((resolve, reject) => {
          const updateRequest = store.put(notification);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        });
      }
    }
    
    db.close();
  } catch (error) {
    console.error('Error checking scheduled notifications:', error);
  }
}