"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/contexts/TasksContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/common/DeleteConfirmationDialog";
import { Loader2, Shield, Trash2 } from "lucide-react";

const SettingsPage = () => {
  const { userProfile } = useAuth();
  const { resetAllLeaderboardScores } = useTasks();
  const [isResetting, setIsResetting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const handleResetConfirm = async () => {
    setIsResetDialogOpen(false);
    setIsResetting(true);
    await resetAllLeaderboardScores();
    setIsResetting(false);
  };

  return (
    <>
      <div className="container max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Manage your application and account settings.
            </p>
          </div>

          {/* Admin-only section */}
          {userProfile?.role === 'admin' && (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Shield className="h-5 w-5" />
                  Admin Controls
                </CardTitle>
                <CardDescription className="text-destructive/80">
                  These are destructive actions. Please proceed with caution.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-background p-4">
                  <div>
                    <h3 className="font-semibold">Reset Leaderboard</h3>
                    <p className="text-sm text-muted-foreground">
                      This will reset all `timeSpent` data for all tasks and subtasks in your team, effectively resetting all scores to zero. This action cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setIsResetDialogOpen(true)}
                    disabled={isResetting}
                  >
                    {isResetting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Reset Scores
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Placeholder for other settings */}
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                More settings will be available here in the future.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Profile, notifications, and theme settings can be managed on your <a href="/profile" className="text-primary underline">Profile page</a>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <DeleteConfirmationDialog
        open={isResetDialogOpen}
        onOpenChange={setIsResetDialogOpen}
        onConfirm={handleResetConfirm}
        title="Reset Leaderboard Scores?"
        description="Are you sure you want to reset all scores for your team? This will set all time spent on tasks to zero and cannot be undone."
      />
    </>
  );
};

export default SettingsPage;