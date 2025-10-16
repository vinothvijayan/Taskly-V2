import { useState } from 'react';
import { X, Plus, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Attendee {
  email: string;
  displayName?: string;
}

interface AttendeeSelectorProps {
  attendees: Attendee[];
  onAttendeesChange: (attendees: Attendee[]) => void;
  label?: string;
}

export function AttendeeSelector({
  attendees,
  onAttendeesChange,
  label = "Attendees"
}: AttendeeSelectorProps) {
  const [emailInput, setEmailInput] = useState('');

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const addAttendee = () => {
    if (!emailInput.trim()) return;
    
    const email = emailInput.trim().toLowerCase();
    
    if (!isValidEmail(email)) {
      return;
    }

    if (attendees.some(attendee => attendee.email === email)) {
      return;
    }

    onAttendeesChange([...attendees, { email }]);
    setEmailInput('');
  };

  const removeAttendee = (emailToRemove: string) => {
    onAttendeesChange(attendees.filter(attendee => attendee.email !== emailToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAttendee();
    }
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      
      <div className="flex gap-2">
        <Input
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter email address"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addAttendee}
          disabled={!emailInput.trim() || !isValidEmail(emailInput.trim())}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {attendees.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attendees.map((attendee) => (
            <Badge
              key={attendee.email}
              variant="secondary"
              className="flex items-center gap-1 px-2 py-1"
            >
              <Mail className="h-3 w-3" />
              <span className="text-xs">{attendee.email}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto w-auto p-0 hover:bg-transparent"
                onClick={() => removeAttendee(attendee.email)}
              >
                <X className="h-3 w-3 hover:text-destructive" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}