import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCog, Loader2, LogIn, LogOut, AlertTriangle, CheckCircle } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile } from "@/types";
import { useToast } from "@/hooks/use-toast";

export default function AdminUserManagementPage() {
  const { user, userProfile, impersonateUser, stopImpersonating, loading: authLoading, isImpersonating, updateUserProfile } = useAuth();
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const currentImpersonatedUser = allUsers.find(u => u.uid === user?.uid);

  useEffect(() => {
    if (isImpersonating && userProfile) {
        setImpersonatingId(userProfile.uid);
    } else {
        setImpersonatingId(null);
    }

    if (userProfile?.role === 'superadmin') {
      fetchAllUsers();
    } else if (userProfile) {
      setAllUsers([userProfile]);
      setLoadingUsers(false);
    }
  }, [userProfile, isImpersonating]);

  const fetchAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const usersCollectionRef = collection(db, 'users');
      const q = query(usersCollectionRef);
      const snapshot = await getDocs(q);
      
      const usersList = snapshot.docs.map(doc => doc.data() as UserProfile);
      setAllUsers(usersList);
    } catch (error) {
      console.error("Error fetching all users:", error);
      toast({ title: "Error", description: "Failed to load user list.", variant: "destructive" });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleImpersonate = async (targetUser: UserProfile) => {
    if (!userProfile || userProfile.role !== 'superadmin') {
      toast({ title: "Permission Denied", description: "Only Superadmins can impersonate.", variant: "destructive" });
      return;
    }
    if (targetUser.uid === user?.uid) return;

    setImpersonatingId(targetUser.uid);
    try {
      await impersonateUser(targetUser.uid);
      toast({ title: "Impersonation Started", description: `Now logged in as ${targetUser.displayName || targetUser.email}.`, duration: 5000 });
      navigate('/');
    } catch (error) {
      console.error("Impersonation failed:", error);
      setImpersonatingId(null);
      toast({ title: "Impersonation Failed", description: "Could not switch user context.", variant: "destructive" });
    }
  };

  const handleStopImpersonating = async () => {
    try {
      await stopImpersonating();
      toast({ title: "Impersonation Ended", description: "Welcome back, Admin.", duration: 5000 });
      navigate('/admin/users');
    } catch (error) {
      console.error("Revert failed:", error);
      toast({ title: "Revert Failed", description: "Could not revert to admin account.", variant: "destructive" });
    }
  };

  const handleUpdateRole = async (targetUid: string, newRole: UserProfile['role']) => {
    if (!userProfile || userProfile.role !== 'superadmin') {
      toast({ title: "Permission Denied", description: "Only Superadmins can change roles.", variant: "destructive" });
      return;
    }
    
    if (targetUid === user?.uid && !isImpersonating) {
        toast({ title: "Action Blocked", description: "Cannot change your own role while logged in as yourself.", variant: "warning" });
        return;
    }

    try {
      await updateUserProfile({ role: newRole }, targetUid);
      
      // Manually update the local state list to reflect the change immediately
      setAllUsers(prev => prev.map(u => u.uid === targetUid ? { ...u, role: newRole } : u));
      
      toast({ title: "Role Updated", description: `${targetUid} is now a ${newRole}.`, duration: 3000 });
    } catch (error) {
      console.error("Role update failed:", error);
      toast({ title: "Update Failed", description: "Could not update user role.", variant: "destructive" });
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email.split('@')[0].slice(0, 2).toUpperCase();
    return "U";
  };

  if (authLoading || loadingUsers) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (userProfile?.role !== 'superadmin') {
    return (
      <div className="container max-w-4xl mx-auto p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You must be a Superadmin to access this page.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCog className="h-8 w-8 text-primary" />
            User Management
          </h1>
          <p className="text-muted-foreground">
            View all users and manage impersonation sessions.
          </p>
        </div>
        {isImpersonating && (
          <Card className="bg-destructive/10 border-destructive/50 shadow-md">
            <CardContent className="p-3 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">IMPERSONATING</p>
                <p className="text-muted-foreground">Logged in as: {currentImpersonatedUser?.displayName || currentImpersonatedUser?.email}</p>
              </div>
              <Button onClick={handleStopImpersonating} variant="destructive" size="sm" className="ml-4">
                <LogOut className="h-4 w-4 mr-2" />
                Revert to Admin
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="text-lg">All Application Users ({allUsers.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Avatar</TableHead>
                  <TableHead>Name / Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Team ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map((targetUser) => (
                  <TableRow key={targetUser.uid}>
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={targetUser.photoURL} />
                        <AvatarFallback className="text-xs bg-muted">
                          {getInitials(targetUser.displayName, targetUser.email)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{targetUser.displayName || 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">{targetUser.email}</p>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={targetUser.role || 'user'}
                        onValueChange={(newRole) => handleUpdateRole(targetUser.uid, newRole as UserProfile['role'])}
                        disabled={!userProfile || userProfile.role !== 'superadmin' || targetUser.uid === user?.uid}
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="superadmin">Superadmin</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                        {targetUser.teamId || 'None'}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      {user?.uid === targetUser.uid ? (
                        <Badge className="bg-primary/10 text-primary">
                          <CheckCircle className="h-3 w-3 mr-1" /> Current User
                        </Badge>
                      ) : (
                        <Button
                          onClick={() => handleImpersonate(targetUser)}
                          disabled={isImpersonating}
                          variant="outline"
                          size="sm"
                        >
                          <LogIn className="h-4 w-4 mr-2" />
                          Login as User
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}