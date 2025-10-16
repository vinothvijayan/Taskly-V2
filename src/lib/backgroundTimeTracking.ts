export const registerBackgroundTimeSync = () => {
  if ('serviceWorker' in navigator && 'sync' in (self as any).registration) {
    navigator.serviceWorker.ready.then((registration: any) => {
      return registration.sync.register('time-tracking-sync');
    }).catch((error: any) => {
      console.error('Background sync registration failed:', error);
    });
  }
};

export const setupTimeTrackingSync = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'TIME_TRACKING_UPDATE') {
        window.dispatchEvent(new CustomEvent('time-tracking-sync', {
          detail: event.data.session
        }));
      }
    });
  }
};

export const notifyServiceWorkerOfTracking = (session: any) => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'START_TIME_TRACKING',
      session
    });
  }
};

export const notifyServiceWorkerStopTracking = () => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'STOP_TIME_TRACKING'
    });
  }
};
