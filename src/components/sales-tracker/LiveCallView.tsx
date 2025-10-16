import React, { useState } from 'react';
import { Contact, CallLog } from "@/lib/sales-tracker-data";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, User, Clock, Info, ChevronsRight, Users, PhoneOff, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContactDetailPanel } from './ContactDetailPanel';
import { Button } from '@/components/ui/button';

interface LiveCallData {
  status: 'countdown' | 'calling';
  currentContact: Contact;
  nextContact?: Contact;
  queuePosition: string;
}

interface LiveCallViewProps {
  liveCallData: LiveCallData | null;
  onUpdateCallLogMessage: (contactId: string, callLogIndex: string, newMessage: string) => Promise<void>;
  onMarkAsSent: (contactId: string) => Promise<void>;
  onFinishSession: () => Promise<void>;
}

export const LiveCallView: React.FC<LiveCallViewProps> = ({ liveCallData, onUpdateCallLogMessage, onMarkAsSent, onFinishSession }) => {
  const [isFinishing, setIsFinishing] = useState(false);

  if (!liveCallData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <Phone className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <h3 className="text-xl font-semibold">No Active Call</h3>
          <p className="text-sm">Live call details will appear here when a call is initiated from the Sales Dialer app.</p>
        </div>
      </div>
    );
  }

  const { status, currentContact, nextContact, queuePosition } = liveCallData;
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  const handleFinishClick = async () => {
    setIsFinishing(true);
    await onFinishSession();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left Column: Live Call Status */}
      <div className="flex flex-col items-center justify-center">
        <Card className="w-full max-w-md shadow-2xl border-2 border-red-500 animate-pulse-glow-destructive">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 text-red-500">
              <div className="h-3 w-3 rounded-full bg-red-500 animate-ping"></div>
              <CardTitle className="text-2xl font-bold">Live Call in Progress</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4 p-4 rounded-lg bg-muted/30">
              <Badge variant={status === 'calling' ? 'destructive' : 'secondary'} className="animate-pulse">
                {status === 'calling' ? 'Calling Now' : 'Countdown...'}
              </Badge>
              <Avatar className="h-24 w-24 border-4 border-muted">
                <AvatarFallback className="text-3xl">{getInitials(currentContact.name)}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold text-center">{currentContact.name}</h2>
                <p className="text-lg text-muted-foreground text-center">{currentContact.phone}</p>
              </div>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ChevronsRight className="h-4 w-4 text-muted-foreground" />
                    Up Next
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {nextContact ? (
                    <div>
                      <p className="font-medium">{nextContact.name}</p>
                      <p className="text-sm text-muted-foreground">{nextContact.phone}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Last contact in the queue.</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Queue Position
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{queuePosition}</p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={handleFinishClick}
              disabled={isFinishing}
            >
              {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneOff className="mr-2 h-4 w-4" />}
              Finish Session
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Right Column: Contact Details */}
      <div className="h-full overflow-hidden rounded-lg border bg-background shadow-sm">
        <ContactDetailPanel contact={currentContact} onUpdateCallLogMessage={onUpdateCallLogMessage} onMarkAsSent={onMarkAsSent} />
      </div>
    </div>
  );
};