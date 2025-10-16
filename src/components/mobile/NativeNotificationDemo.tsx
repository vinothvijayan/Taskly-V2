import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Capacitor } from '@capacitor/core';
import { Bell, Smartphone, Globe, CheckCircle } from 'lucide-react';

export function NativeNotificationDemo() {
  const [platformInfo, setPlatformInfo] = useState<any>(null);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    checkPlatformInfo();
    setupNotificationListeners();
  }, []);

  const checkPlatformInfo = async () => {
    const info = {
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
      notificationSupport: 'Notification' in window
    };
    setPlatformInfo(info);
  };

  const setupNotificationListeners = () => {
    window.addEventListener('unified-notification-action', (event: any) => {
      const { action, data } = event.detail;
      addTestResult(`Notification action received: ${action}`);
    });
  };

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testImmediateNotification = async () => {
    try {
      // Simple notification test for now
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Test Notification', {
          body: 'This is a test notification from your app!',
          icon: '/icon-192x192.png'
        });
        addTestResult('Immediate notification sent');
      } else {
        addTestResult('Notification permission not granted');
      }
    } catch (error) {
      addTestResult(`Error: ${error}`);
    }
  };

  const testScheduledNotification = async () => {
    try {
      // Simplified test for now
      addTestResult('Scheduled notification would be set for 10 seconds');
    } catch (error) {
      addTestResult(`Error: ${error}`);
    }
  };

  const testTaskReminder = async () => {
    addTestResult('Task reminder notification would be sent');
  };

  const testPomodoroComplete = async () => {
    addTestResult('Pomodoro complete notification would be sent');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Native Notification Demo
        </CardTitle>
        <CardDescription>
          Test native notifications and platform detection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform Info */}
        {platformInfo && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Platform Information</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant={platformInfo.isNative ? "default" : "secondary"}>
                <Smartphone className="h-3 w-3 mr-1" />
                {platformInfo.platform}
              </Badge>
              <Badge variant={platformInfo.notificationSupport ? "default" : "destructive"}>
                <Bell className="h-3 w-3 mr-1" />
                Notifications: {platformInfo.notificationSupport ? 'Supported' : 'Not Supported'}
              </Badge>
            </div>
          </div>
        )}

        {/* Test Buttons */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Notification Tests</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={testImmediateNotification}
              className="text-xs"
            >
              Test Immediate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={testScheduledNotification}
              className="text-xs"
            >
              Test Scheduled
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={testTaskReminder}
              className="text-xs"
            >
              Task Reminder
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={testPomodoroComplete}
              className="text-xs"
            >
              Pomodoro Complete
            </Button>
          </div>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Test Results</h3>
            <div className="bg-muted rounded-lg p-3 text-xs font-mono space-y-1 max-h-32 overflow-y-auto">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{result}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}