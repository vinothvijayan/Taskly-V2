import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Smartphone, Info } from "lucide-react";
import { enhancedNotificationService } from "@/lib/enhancedNotifications";

interface NotificationPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPermissionResult: (granted: boolean) => void;
}

export function NotificationPermissionDialog({ 
  open, 
  onOpenChange, 
  onPermissionResult 
}: NotificationPermissionDialogProps) {
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const permission = await enhancedNotificationService.requestPermission(true);
      const granted = permission === 'granted';
      onPermissionResult(granted);
      onOpenChange(false);
    } catch (error) {
      console.error('Permission request failed:', error);
      onPermissionResult(false);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    onPermissionResult(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle>Enable Notifications</DialogTitle>
          <DialogDescription className="text-left space-y-2">
            <p>Get notified about:</p>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Service reminders and maintenance alerts
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Upcoming bill due dates
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Important apartment updates
              </li>
            </ul>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
            <Smartphone className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">Mobile Tip:</p>
              <p>Notifications work best when you add this app to your home screen.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p>You can always change notification settings later in your browser or device settings.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="flex-1"
            >
              <BellOff className="mr-2 h-4 w-4" />
              Not Now
            </Button>
            <Button
              onClick={handleRequestPermission}
              disabled={isRequesting}
              className="flex-1"
            >
              <Bell className="mr-2 h-4 w-4" />
              {isRequesting ? 'Requesting...' : 'Enable'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}