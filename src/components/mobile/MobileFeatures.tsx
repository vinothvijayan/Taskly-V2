// React component for install prompt and app shortcuts
import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  Download, 
  Plus, 
  Timer, 
  Calendar, 
  StickyNote, 
  Smartphone,
  X,
  ExternalLink
} from 'lucide-react';
import { mobileShortcutsService } from '../../lib/mobileShortcuts';
import { enhancedNotificationService } from '../../lib/enhancedNotifications';
import { cn } from '../../lib/utils';

interface InstallPromptProps {
  className?: string;
}

export function InstallPrompt({ className }: InstallPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsInstalled(isStandalone);

    const handleInstallAvailable = () => {
      if (!isStandalone) {
        setShowPrompt(true);
      }
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
    };

    window.addEventListener('app-install-available', handleInstallAvailable);
    window.addEventListener('app-installed', handleInstalled);

    // Setup install prompt
    mobileShortcutsService.setupInstallPrompt();

    return () => {
      window.removeEventListener('app-install-available', handleInstallAvailable);
      window.removeEventListener('app-installed', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const installed = await mobileShortcutsService.promptInstall();
      if (installed) {
        setIsInstalled(true);
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <Card className={cn("border-primary/20 bg-gradient-to-r from-primary/5 to-focus/5", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Install Taskly</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Install the app for the best mobile experience with offline support and quick access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3 text-green-500" />
            <span>Works offline</span>
          </div>
          <div className="flex items-center gap-1">
            <Timer className="h-3 w-3 text-blue-500" />
            <span>Quick shortcuts</span>
          </div>
          <div className="flex items-center gap-1">
            <Plus className="h-3 w-3 text-purple-500" />
            <span>Add to home screen</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-orange-500" />
            <span>Push notifications</span>
          </div>
        </div>
        
        <Button 
          onClick={handleInstall} 
          disabled={isInstalling}
          className="w-full"
        >
          {isInstalling ? 'Installing...' : 'Install App'}
        </Button>
      </CardContent>
    </Card>
  );
}

interface AppShortcutsProps {
  className?: string;
}

export function AppShortcuts({ className }: AppShortcutsProps) {
  const shortcuts = mobileShortcutsService.getAppShortcuts();

  const getShortcutIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'add task':
        return <Plus className="h-5 w-5" />;
      case 'start timer':
        return <Timer className="h-5 w-5" />;
      case "today's tasks":
        return <Calendar className="h-5 w-5" />;
      case 'quick note':
        return <StickyNote className="h-5 w-5" />;
      default:
        return <ExternalLink className="h-5 w-5" />;
    }
  };

  const handleShortcutClick = (url: string) => {
    // Handle shortcut navigation
    const urlObj = new URL(url, window.location.origin);
    window.location.href = urlObj.href;
  };

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-medium text-muted-foreground">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        {shortcuts.map((shortcut) => (
          <Button
            key={shortcut.name}
            variant="outline"
            onClick={() => handleShortcutClick(shortcut.url)}
            className="h-auto p-3 flex flex-col items-center gap-2 text-center"
          >
            {getShortcutIcon(shortcut.name)}
            <span className="text-xs">{shortcut.short_name || shortcut.name}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

interface NotificationSettingsProps {
  className?: string;
}

export function NotificationSettings({ className }: NotificationSettingsProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    setPermission(Notification.permission);
    
    // Get notification categories
    const notificationCategories = [
      { id: 'task-reminder', name: 'Task Reminders', enabled: true },
      { id: 'task-assignment', name: 'Task Assignments', enabled: true },
      { id: 'pomodoro-complete', name: 'Pomodoro Complete', enabled: true },
      { id: 'achievement', name: 'Achievements', enabled: true }
    ];
    setCategories(notificationCategories);
  }, []);

  const handleRequestPermission = async () => {
    const newPermission = await enhancedNotificationService.requestPermission();
    setPermission(newPermission);
  };

  const toggleCategory = (categoryId: string) => {
    setCategories(categories.map(cat => 
      cat.id === categoryId ? { ...cat, enabled: !cat.enabled } : cat
    ));
  };

  const testNotification = async () => {
    await enhancedNotificationService.showTaskReminder(
      { id: 'test', title: 'Sample Task' },
      30
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Notification Settings</CardTitle>
        <CardDescription>
          Manage your notification preferences and permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Permission Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm">Permission Status</span>
          <div className="flex items-center gap-2">
            <Badge variant={permission === 'granted' ? 'default' : 'destructive'}>
              {permission}
            </Badge>
            {permission !== 'granted' && (
              <Button size="sm" onClick={handleRequestPermission}>
                Enable
              </Button>
            )}
          </div>
        </div>

        {/* Notification Categories */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Notification Types</h4>
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between">
              <span className="text-sm">{category.name}</span>
              <Button
                variant={category.enabled ? "default" : "outline"}
                size="sm"
                onClick={() => toggleCategory(category.id)}
              >
                {category.enabled ? 'On' : 'Off'}
              </Button>
            </div>
          ))}
        </div>

        {/* Test Notification */}
        {permission === 'granted' && (
          <Button variant="outline" onClick={testNotification} className="w-full">
            Test Notification
          </Button>
        )}
      </CardContent>
    </Card>
  );
}