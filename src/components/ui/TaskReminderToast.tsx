import { Bell, Check, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Task } from '@/types';

interface TaskReminderToastProps {
  task: Task;
  onSnooze: () => void;
  onComplete: () => void;
  onDismiss: () => void;
}

export function TaskReminderToast({ task, onSnooze, onComplete, onDismiss }: TaskReminderToastProps) {
  return (
    <div className="w-full max-w-sm bg-card text-card-foreground rounded-xl shadow-lg border border-border/50 p-4 flex items-start gap-4 animate-in slide-in-from-bottom-5 fade-in-0 duration-300">
      <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
        <Bell className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 space-y-3">
        <div>
          <p className="font-semibold">Task Due: {task.title}</p>
          <p className="text-sm text-muted-foreground">Your scheduled task is now due.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onSnooze} className="flex-1">
            <Clock className="h-4 w-4 mr-2" />
            Snooze (15m)
          </Button>
          <Button size="sm" variant="focus" onClick={onComplete} className="flex-1">
            <Check className="h-4 w-4 mr-2" />
            Mark Done
          </Button>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 absolute top-2 right-2 text-muted-foreground hover:text-foreground" onClick={onDismiss}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}