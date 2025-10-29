import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, Users, Check, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export function TeamManagementCard() {
  const { userProfile, sendTeamRequest, fetchReceivedTeamRequests, acceptTeamRequest, declineTeamRequest } = useAuth();
  const { teamMembers } = useTasks();
  const { toast } = useToast();

  const [inviteEmail, setInviteEmail] = useState('');
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userProfile?.teamId) {
      fetchRequests();
    }
  }, [userProfile]);

  const fetchRequests = async () => {
    try {
      const requests = await fetchReceivedTeamRequests();
      setPendingRequests(requests);
    } catch (error) {
      console.error("Failed to fetch team requests:", error);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsLoading(true);
    try {
      await sendTeamRequest(inviteEmail.trim());
      setInviteEmail('');
      toast({ title: "Invite Sent!", description: `A team invitation has been sent to ${inviteEmail.trim()}.` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (requestId: string, senderId: string) => {
    setIsLoading(true);
    try {
      await acceptTeamRequest(requestId, senderId);
      // The context will update teamId, which will re-render this component
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async (requestId: string) => {
    setIsLoading(true);
    try {
      await declineTeamRequest(requestId);
      fetchRequests(); // Re-fetch requests after declining one
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email.split('@')[0].slice(0, 2).toUpperCase();
    }
    return '??';
  };

  if (userProfile?.teamId) {
    // User is in a team
    return (
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Your Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {teamMembers.map(member => (
              <div key={member.uid} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.photoURL || ""} />
                  <AvatarFallback className="text-xs">{getInitials(member.displayName, member.email)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{member.displayName}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-4 border-t">
            <label htmlFor="invite-email" className="text-sm font-medium">Invite a new member</label>
            <div className="flex gap-2">
              <Input id="invite-email" placeholder="colleague@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              <Button onClick={handleSendInvite} disabled={isLoading || !inviteEmail.trim()} size="icon">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // User is not in a team
  return (
    <Card className="shadow-elegant">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Join or Create a Team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {pendingRequests.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Pending Invitations</h4>
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
                <div>
                  <p className="text-sm font-medium">{req.senderName}</p>
                  <p className="text-xs text-muted-foreground">{req.senderEmail}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" className="h-8 w-8 text-green-500 hover:bg-green-500/10" onClick={() => handleAccept(req.id, req.senderId)} disabled={isLoading}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={() => handleDecline(req.id)} disabled={isLoading}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="invite-email-create" className="text-sm font-medium">Invite a colleague to start a team</label>
          <div className="flex gap-2">
            <Input id="invite-email-create" placeholder="colleague@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <Button onClick={handleSendInvite} disabled={isLoading || !inviteEmail.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Send Invite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Sending an invite will create a new team with you and the invitee.</p>
        </div>
      </CardContent>
    </Card>
  );
}