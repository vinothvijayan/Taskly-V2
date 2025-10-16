// App shortcuts and deep linking for mobile features
export interface AppShortcut {
  name: string;
  short_name?: string;
  description?: string;
  url: string;
  icons?: Array<{
    src: string;
    sizes: string;
    type?: string;
  }>;
}

export interface DeepLinkRoute {
  pattern: string;
  handler: (params: URLSearchParams, path: string) => void;
}

class MobileShortcutsService {
  private static instance: MobileShortcutsService;
  private deepLinkRoutes: DeepLinkRoute[] = [];

  static getInstance(): MobileShortcutsService {
    if (!MobileShortcutsService.instance) {
      MobileShortcutsService.instance = new MobileShortcutsService();
    }
    return MobileShortcutsService.instance;
  }

  constructor() {
    this.setupDeepLinkRoutes();
    this.handleInitialLoad();
  }

  private setupDeepLinkRoutes() {
    // Register deep link handlers
    this.registerDeepLink('/tasks', this.handleTasksDeepLink.bind(this));
    this.registerDeepLink('/timer', this.handleTimerDeepLink.bind(this));
    this.registerDeepLink('/quick-add', this.handleQuickAddDeepLink.bind(this));
    this.registerDeepLink('/notes', this.handleNotesDeepLink.bind(this));
  }

  private handleInitialLoad() {
    // Handle deep link on app startup
    const urlParams = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    
    // Check if this is a deep link
    if (urlParams.has('action') || urlParams.has('task') || urlParams.has('timer')) {
      this.processDeepLink(urlParams, path);
    }
  }

  registerDeepLink(pattern: string, handler: (params: URLSearchParams, path: string) => void) {
    this.deepLinkRoutes.push({ pattern, handler });
  }

  processDeepLink(params: URLSearchParams, path: string) {
    const route = this.deepLinkRoutes.find(route => 
      path.startsWith(route.pattern) || route.pattern === '*'
    );

    if (route) {
      route.handler(params, path);
    }
  }

  // Deep link handlers
  private handleTasksDeepLink(params: URLSearchParams, path: string) {
    const taskId = params.get('task');
    const action = params.get('action');

    if (taskId) {
      // Navigate to specific task
      window.dispatchEvent(new CustomEvent('deep-link-task', {
        detail: { taskId, action }
      }));
    } else if (action === 'add') {
      // Open task creation
      window.dispatchEvent(new CustomEvent('deep-link-add-task', {
        detail: { focusMode: true }
      }));
    }
  }

  private handleTimerDeepLink(params: URLSearchParams, path: string) {
    const action = params.get('action');
    const taskId = params.get('task');
    const duration = params.get('duration');

    window.dispatchEvent(new CustomEvent('deep-link-timer', {
      detail: { action, taskId, duration }
    }));
  }

  private handleQuickAddDeepLink(params: URLSearchParams, path: string) {
    const text = params.get('text');
    const mode = params.get('mode') || 'text';

    window.dispatchEvent(new CustomEvent('deep-link-quick-add', {
      detail: { text, mode }
    }));
  }

  private handleNotesDeepLink(params: URLSearchParams, path: string) {
    const noteId = params.get('note');
    const action = params.get('action');

    window.dispatchEvent(new CustomEvent('deep-link-notes', {
      detail: { noteId, action }
    }));
  }

  // App shortcuts management
  getAppShortcuts(): AppShortcut[] {
    return [
      {
        name: "Add Task",
        short_name: "Add Task",
        description: "Quickly add a new task",
        url: "/tasks?action=add",
        icons: [
          {
            src: "/icons/add-task.png",
            sizes: "96x96",
            type: "image/png"
          }
        ]
      },
      {
        name: "Start Timer",
        short_name: "Timer",
        description: "Start a pomodoro timer",
        url: "/timer?action=start",
        icons: [
          {
            src: "/icons/timer.png",
            sizes: "96x96",
            type: "image/png"
          }
        ]
      },
      {
        name: "Today's Tasks",
        short_name: "Today",
        description: "View today's tasks",
        url: "/tasks?filter=today",
        icons: [
          {
            src: "/icons/today.png",
            sizes: "96x96",
            type: "image/png"
          }
        ]
      },
      {
        name: "Quick Note",
        short_name: "Note",
        description: "Add a quick note",
        url: "/notes?action=add",
        icons: [
          {
            src: "/icons/note.png",
            sizes: "96x96",
            type: "image/png"
          }
        ]
      }
    ];
  }

  // Update manifest with shortcuts
  updateManifestShortcuts() {
    const shortcuts = this.getAppShortcuts();
    
    // Create dynamic manifest update
    const manifestUpdate = {
      shortcuts: shortcuts.map(shortcut => ({
        name: shortcut.name,
        short_name: shortcut.short_name,
        description: shortcut.description,
        url: shortcut.url,
        icons: shortcut.icons
      }))
    };

    // Store in session for service worker access
    sessionStorage.setItem('app-shortcuts', JSON.stringify(manifestUpdate));
  }

  // Handle external share intents
  handleShareIntent() {
    if ('navigator' in window && 'share' in navigator) {
      // Handle Web Share Target API
      const urlParams = new URLSearchParams(window.location.search);
      const sharedTitle = urlParams.get('title');
      const sharedText = urlParams.get('text');
      const sharedUrl = urlParams.get('url');

      if (sharedTitle || sharedText || sharedUrl) {
        const taskText = [sharedTitle, sharedText, sharedUrl].filter(Boolean).join(' - ');
        
        window.dispatchEvent(new CustomEvent('shared-content', {
          detail: { 
            title: sharedTitle,
            text: sharedText,
            url: sharedUrl,
            taskText
          }
        }));
      }
    }
  }

  // Widget-like functionality for quick access
  getQuickAccessData() {
    return new Promise((resolve) => {
      // Get recent data for widget display
      const data = {
        todayTasks: this.getTodayTasksCount(),
        activeTimer: this.getActiveTimer(),
        recentNotes: this.getRecentNotes(),
        upcomingDeadlines: this.getUpcomingDeadlines()
      };
      resolve(data);
    });
  }

  private getTodayTasksCount(): number {
    // This would integrate with your task context
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const today = new Date().toDateString();
    return tasks.filter((task: any) => 
      !task.completed && 
      (!task.dueDate || new Date(task.dueDate).toDateString() <= today)
    ).length;
  }

  private getActiveTimer(): any | null {
    const timerData = localStorage.getItem('active-timer');
    return timerData ? JSON.parse(timerData) : null;
  }

  private getRecentNotes(): any[] {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    return notes.slice(0, 3); // Get 3 most recent notes
  }

  private getUpcomingDeadlines(): any[] {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    return tasks.filter((task: any) => 
      task.dueDate && 
      !task.completed &&
      new Date(task.dueDate) <= next24Hours
    ).slice(0, 3);
  }

  // Background app refresh
  scheduleBackgroundRefresh() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        return (registration as any).sync.register('background-refresh');
      }).catch(error => {
        console.warn('Background sync not supported:', error);
      });
    }
  }

  // Install prompt handling
  private deferredPrompt: any = null;

  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      this.deferredPrompt = e;
      
      // Show install button/banner
      window.dispatchEvent(new CustomEvent('app-install-available'));
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.deferredPrompt = null;
      
      // Analytics or user feedback
      window.dispatchEvent(new CustomEvent('app-installed'));
    });
  }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    // Show the install prompt
    this.deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await this.deferredPrompt.userChoice;
    
    // Optionally, send analytics event with outcome of user choice
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, throw it away
    this.deferredPrompt = null;
    
    return outcome === 'accepted';
  }
}

export const mobileShortcutsService = MobileShortcutsService.getInstance();