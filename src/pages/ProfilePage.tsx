import { useState } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
}
from "@/components/ui/select";
import {
  User,
  Mail,
  Phone,
  Shield,
  Bell,
  Palette,
  Globe,
  Calendar,
  Loader2,
  CheckCircle,
  AlertCircle,
  Settings as SettingsIcon,
  Users,
  UserPlus,
  Check,
  X,
  Activity,
  UserMinus
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "@/components/ui/use-toast";

const profileSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
});

const preferencesSchema = z.object({
  notifications: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().optional(),
});

export default function ProfilePage() {
  const {
    user,
    userProfile,
    updateUserProfile,
    sendVerificationEmail,
    sendTeamRequest,
    fetchReceivedTeamRequests,
    acceptTeamRequest,
    declineTeamRequest,
    fetchTeamMembers,
    loading
  } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [teamRequestEmail, setTeamRequestEmail] = useState("");
  const [teamRequests, setTeamRequests] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    if (user) {
      loadTeamRequests();
      loadTeamMembers();
    }
  }, [user, userProfile?.teamId]);

  const loadTeamRequests = async () => {
    if (!user) return;
    const requests = await fetchReceivedTeamRequests();
    setTeamRequests(requests);
  };

  const loadTeamMembers = async () => {
    if (!user || !userProfile?.teamId) {
      setTeamMembers([]);
      return;
    }
    const members = await fetchTeamMembers();
    setTeamMembers(members);
  };

  const handleSendTeamRequest = async () => {
    if (!teamRequestEmail.trim()) return;

    const emails = teamRequestEmail
      .split(',')
      .map(email => email.trim())
      .filter(email => z.string().email().safeParse(email).success);

    if (emails.length === 0) {
      toast({
        title: "Invalid Email",
        description: "Please provide at least one valid email address.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingRequest(true);

      const results = await Promise.allSettled(
        emails.map(email => sendTeamRequest(email))
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      if (successful > 0) {
        toast({
          title: `Team requests sent!`,
          description: `Successfully sent ${successful} request${successful !== 1 ? 's' : ''}${failed > 0 ? `. ${failed} failed.` : '.'}`,
        });
      } else {
         toast({
          title: "Failed to send requests",
          description: "Please check the email addresses and try again.",
          variant: "destructive",
        });
      }

      setTeamRequestEmail("");
    } catch (error: any) {
      console.error('Error sending team request:', error);
       toast({
        title: "An error occurred",
        description: error.message || "Could not send team requests.",
        variant: "destructive",
      });
    } finally {
      setSendingRequest(false);
    }
  };

  const handleAcceptRequest = async (requestId: string, senderId: string) => {
    try {
      await acceptTeamRequest(requestId, senderId);
      await loadTeamRequests();
      await loadTeamMembers();
      toast({ title: "Team request accepted!", description: "You've joined a new team." });
    } catch (error: any) {
      console.error('Error accepting request:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await declineTeamRequest(requestId);
      await loadTeamRequests();
      toast({ title: "Request declined." });
    } catch (error: any) {
      console.error('Error declining request:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSetRole = async (newRole: UserProfile['role']) => {
    try {
      await updateUserProfile({ role: newRole });
      toast({ title: "Role Updated", description: `Your role is now set to ${newRole}.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to set role.", variant: "destructive" });
    }
  };

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: userProfile?.displayName || "",
      email: user?.email || "",
    },
    values: {
      displayName: userProfile?.displayName || "",
      email: user?.email || "",
    }
  });

  const preferencesForm = useForm<z.infer<typeof preferencesSchema>>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      notifications: userProfile?.preferences?.notifications ?? true,
      theme: (userProfile?.preferences?.theme || theme || 'system') as 'light' | 'dark' | 'system',
      language: userProfile?.preferences?.language || 'en',
    },
     values: {
      notifications: userProfile?.preferences?.notifications ?? true,
      theme: (userProfile?.preferences?.theme || theme || 'system') as 'light' | 'dark' | 'system',
      language: userProfile?.preferences?.language || 'en',
    }
  });

  const handleProfileUpdate = async (values: z.infer<typeof profileSchema>) => {
    try {
      await updateUserProfile({ displayName: values.displayName });
      setIsEditing(false);
      toast({ title: "Profile updated successfully!" });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handlePreferencesUpdate = async (values: z.infer<typeof preferencesSchema>) => {
    try {
      if (values.theme) setTheme(values.theme);

      const preferences = {
        notifications: values.notifications ?? userProfile?.preferences?.notifications ?? true,
        theme: values.theme ?? userProfile?.preferences?.theme ?? 'system' as const,
        language: values.language ?? userProfile?.preferences?.language ?? 'en',
      };

      await updateUserProfile({ preferences });
      toast({ title: "Preferences saved!" });
    } catch (error: any) {
      console.error('Error updating preferences:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSendVerification = async () => {
    try {
      await sendVerificationEmail();
      toast({ title: "Verification email sent!", description: "Check your inbox to verify your email address." });
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email
        .split('@')[0]
        .slice(0, 2)
        .toUpperCase();
    }
    return '??';
  };

  if (!user || !userProfile) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-elegant lg:col-span-1">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src={userProfile.photoURL || ""} alt={userProfile.displayName || ""} />
              <AvatarFallback className="text-3xl">
                {getInitials(userProfile.displayName, userProfile.email)}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-semibold">{userProfile.displayName}</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {userProfile.email}
            </p>

            <div className="mt-4">
              {user.emailVerified ? (
                <Badge variant="secondary" className="border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                <div className="flex flex-col items-center gap-2">
                    <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Not Verified
                    </Badge>
                    <Button
                        variant="link"
                        className="h-auto p-0 text-xs"
                        onClick={handleSendVerification}
                        disabled={loading}
                    >
                        Resend verification email
                    </Button>
                </div>
              )}
            </div>

            <Separator className="my-6" />

            <div className="w-full text-left space-y-4">
                <h3 className="text-sm font-medium text-center mb-2 uppercase tracking-wider text-muted-foreground">Account Status</h3>
                <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" /> Team Status
                    </span>
                    <span className="font-medium">
                        {userProfile.teamId ? "In a Team" : "No Team"}
                    </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                     <span className="flex items-center gap-2 text-muted-foreground">
                        <Shield className="h-4 w-4" /> Account
                    </span>
                    <span className="font-medium capitalize">
                        {userProfile.role || 'user'}
                    </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                     <span className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" /> Joined
                    </span>
                     <span className="font-medium">
                        {user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'N/A'}
                     </span>
                </div>
            </div>
            
            {/* Superadmin Role Management Section */}
            {userProfile.role === 'superadmin' && (
                <div className="w-full mt-6 pt-4 border-t border-dashed space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2 text-destructive">
                        <UserCog className="h-4 w-4" /> Superadmin Controls
                    </h4>
                    <p className="text-xs text-muted-foreground">
                        You currently have full application access. Revert your role if no longer needed.
                    </p>
                    <Button 
                        onClick={() => handleSetRole('admin')} 
                        variant="destructive" 
                        className="w-full bg-red-600 hover:bg-red-700"
                    >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Revert to Admin Role
                    </Button>
                </div>
            )}
            {/* End Superadmin Role Management Section */}

            {/* Temporary Superadmin Button (Only visible if not already superadmin) */}
            {userProfile.role !== 'superadmin' && (
                <div className="w-full mt-6 pt-4 border-t border-dashed">
                    <Button 
                        onClick={() => handleSetRole('superadmin')} 
                        variant="destructive" 
                        className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                        Set Role to Superadmin (Test)
                    </Button>
                </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-elegant">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Basic Information
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-4">
                    <FormField
                      control={profileForm.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="your@email.com" {...field} disabled />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground">
                            Email cannot be changed for security reasons.
                          </p>
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={loading} variant="focus">
                      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Save Changes"}
                    </Button>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Display Name</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {userProfile.displayName || "Not set"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Email Address</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {userProfile.email}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...preferencesForm}>
                <form onSubmit={preferencesForm.handleSubmit(handlePreferencesUpdate)} className="space-y-6">
                  <FormField
                    control={preferencesForm.control}
                    name="notifications"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="flex items-center gap-2 text-base">
                            <Bell className="h-4 w-4" />
                            Push Notifications
                          </FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Receive notifications for tasks and reminders.
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={preferencesForm.control}
                    name="theme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Palette className="h-4 w-4" />
                          Theme
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select theme" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={preferencesForm.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Language
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Español</SelectItem>
                            <SelectItem value="fr">Français</SelectItem>
                            <SelectItem value="de">Deutsch</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={loading} variant="focus">
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Save Preferences"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Collaboration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {userProfile?.teamId ? (
                  <>
                    <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="font-medium text-green-600 dark:text-green-400">You're part of a team!</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium">Team Members</Label>
                          <div className="mt-2 space-y-2">
                            {teamMembers.map((member) => (
                              <div key={member.uid} className="flex items-center gap-3 p-2 bg-background/50 rounded-lg">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={member.photoURL || ""} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(member.displayName, member.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{member.displayName || "User"}</p>
                                  <p className="text-xs text-muted-foreground">{member.email}</p>
                                </div>
                                {member.uid === user?.uid && (
                                  <Badge variant="secondary" className="text-xs">You</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label htmlFor="teamRequestEmail" className="text-sm font-medium">
                        Invite More Members
                      </Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          id="teamRequestEmail"
                          type="text"
                          placeholder="colleague1@example.com, colleague2@example.com"
                          value={teamRequestEmail}
                          onChange={(e) => setTeamRequestEmail(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && handleSendTeamRequest()}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleSendTeamRequest}
                          disabled={!teamRequestEmail.trim() || sendingRequest}
                          variant="focus"
                          className="hover-scale"
                        >
                          {sendingRequest ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserPlus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Send collaboration requests (separate multiple emails with commas).
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <Label htmlFor="teamRequestEmail" className="text-sm font-medium">
                      Invite Team Member
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="teamRequestEmail"
                        type="text"
                        placeholder="colleague1@example.com, colleague2@example.com"
                        value={teamRequestEmail}
                        onChange={(e) => setTeamRequestEmail(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSendTeamRequest()}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSendTeamRequest}
                        disabled={!teamRequestEmail.trim() || sendingRequest}
                        variant="focus"
                        className="hover-scale"
                      >
                        {sendingRequest ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Send a request to start a team or join an existing one.
                    </p>
                  </div>
                )}

                {teamRequests.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Pending Requests</Label>
                    <div className="mt-2 space-y-2">
                      {teamRequests.map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(request.senderName, request.senderEmail)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{request.senderName || "User"}</p>
                              <p className="text-xs text-muted-foreground">{request.senderEmail}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleAcceptRequest(request.id, request.senderId)}
                              disabled={loading}
                              className="h-8 w-8 hover-scale text-green-500 hover:bg-green-500/10 hover:border-green-500/20"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleDeclineRequest(request.id)}
                              disabled={loading}
                              className="h-8 w-8 hover-scale text-red-500 hover:bg-red-500/10 hover:border-red-500/20"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}