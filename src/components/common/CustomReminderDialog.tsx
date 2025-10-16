import { useState } from 'react';
import { Clock, Calendar, AlertCircle, Zap, Coffee, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { TimePickerSelect } from '@/components/ui/time-picker';

interface CustomReminderDialogProps {
  onCreateReminder: (reminder: {
    title: string;
    duration: number;
    type: string;
    description?: string;
    startTime?: string;
  }) => void;
  children: React.ReactNode;
}

const reminderTypes = [
  { value: 'focus', label: 'Focus Session', icon: Brain, color: 'bg-blue-500' },
  { value: 'meeting', label: 'Meeting', icon: Calendar, color: 'bg-green-500' },
  { value: 'break', label: 'Break', icon: Coffee, color: 'bg-amber-500' },
  { value: 'urgent', label: 'Urgent Task', icon: AlertCircle, color: 'bg-red-500' },
  { value: 'other', label: 'Other', icon: Zap, color: 'bg-purple-500' },
];

const quickDurations = [15, 30, 45, 60, 90, 120];

export function CustomReminderDialog({ onCreateReminder, children }: CustomReminderDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState('');
  const [type, setType] = useState('focus');
  const [startTime, setStartTime] = useState('');
  const [useQuickDuration, setUseQuickDuration] = useState(true);

  const handleSubmit = () => {
    if (!title.trim()) return;

    const finalDuration = useQuickDuration ? duration : parseInt(customDuration) || 30;

    onCreateReminder({
      title: title.trim(),
      duration: finalDuration,
      type,
      description: description.trim() || undefined,
      startTime: startTime || undefined,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setDuration(30);
    setCustomDuration('');
    setType('focus');
    setStartTime('');
    setUseQuickDuration(true);
    setOpen(false);
  };

  const selectedType = reminderTypes.find(t => t.value === type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Create Custom Reminder
          </DialogTitle>
          <DialogDescription>
            Create a custom reminder for a focus session, meeting, or break.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-5 py-4">
          {/* Reminder Type */}
          <div className="space-y-3">
            <Label>Reminder Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {reminderTypes.map((reminderType) => {
                const Icon = reminderType.icon;
                return (
                  <Button
                    key={reminderType.value}
                    type="button"
                    variant={type === reminderType.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setType(reminderType.value)}
                    className="h-auto p-3 flex flex-col items-center gap-1"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{reminderType.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What would you like to be reminded about?"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any additional notes..."
              rows={2}
            />
          </div>

          {/* Duration */}
          <div className="space-y-3">
            <Label>Duration</Label>
            
            {/* Quick Duration Buttons */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="quick-duration"
                  checked={useQuickDuration}
                  onChange={() => setUseQuickDuration(true)}
                  className="w-4 h-4"
                />
                <Label htmlFor="quick-duration" className="cursor-pointer">Quick Select</Label>
              </div>
              
              {useQuickDuration && (
                <div className="grid grid-cols-3 gap-2">
                  {quickDurations.map((dur) => (
                    <Button
                      key={dur}
                      type="button"
                      variant={duration === dur ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDuration(dur)}
                    >
                      {dur}m
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Duration */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="custom-duration"
                  checked={!useQuickDuration}
                  onChange={() => setUseQuickDuration(false)}
                  className="w-4 h-4"
                />
                <Label htmlFor="custom-duration" className="cursor-pointer">Custom Duration</Label>
              </div>
              
              {!useQuickDuration && (
                <div className="flex items-center gap-2">
                  <Input
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    placeholder="30"
                    type="number"
                    min="1"
                    max="480"
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              )}
            </div>
          </div>

          {/* Start Time (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="startTime">Start Time (Optional)</Label>
            <TimePickerSelect
              value={startTime}
              onChange={setStartTime}
              placeholder="Leave empty for next available slot"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to schedule for the next available time slot
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!title.trim()}
          >
            Create Reminder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}