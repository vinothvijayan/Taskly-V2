import { useState, useMemo } from "react";
import { useTasks } from "@/contexts/TasksContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Award, Medal, TrendingUp, Clock, CheckSquare, CheckCircle2 } from "lucide-react";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { LeaderboardSkeleton } from "@/components/skeletons";
import { calculateUserScoreForPeriod } from "@/lib/scoring";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type TimeFrame = "day" | "week" | "month";

interface ScoreData {
  userId: string;
  name: string;
  avatarUrl?: string;
  score: number;
  tasksCompleted: number; // Total items
  mainTasksCompleted: number;
  subtasksCompleted: number;
  totalTimeSpent: number;
}

const getRankIcon = (rank: number) => {
  if (rank === 0) return <Crown className="h-5 w-5 text-yellow-400" />;
  if (rank === 1) return <Award className="h-5 w-5 text-gray-400" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-orange-400" />;
  return <span className="text-sm font-bold w-5 text-center">{rank + 1}</span>;
};

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `~1m`;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
};

export function Leaderboard() {
  const { tasks, teamMembers, loading } = useTasks();
  const { userProfile } = useAuth();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("week");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const leaderboardData = useMemo((): ScoreData[] => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = endOfDay(now);

    if (timeFrame === "day") {
      startDate = startOfDay(now);
    } else if (timeFrame === "week") {
      startDate = startOfWeek(now);
    } else { // month
      startDate = startOfMonth(now);
    }

    const scores = teamMembers.map(member => {
      const allMemberTasks = tasks.filter(task => task.createdBy === member.uid);
      
      const score = calculateUserScoreForPeriod(allMemberTasks, startDate, endDate);

      const mainTasksInPeriod = allMemberTasks.filter(task => {
        if (task.status !== "completed" || !task.completedAt) return false;
        const completedDate = new Date(task.completedAt as string);
        return completedDate >= startDate && completedDate <= endDate;
      });
      const mainTasksCompletedCount = mainTasksInPeriod.length;

      let subtasksCompletedCount = 0;
      allMemberTasks.forEach(task => {
        task.subtasks?.forEach(subtask => {
          if (subtask.isCompleted && subtask.completedAt) {
            const completedDate = new Date(subtask.completedAt);
            if (completedDate >= startDate && completedDate <= endDate) {
              subtasksCompletedCount++;
            }
          }
        });
      });

      const mainTaskTime = mainTasksInPeriod.reduce((total, task) => total + (task.timeSpent || 0), 0);
      
      let subtaskTime = 0;
      allMemberTasks.forEach(task => {
        task.subtasks?.forEach(subtask => {
          if (subtask.isCompleted && subtask.completedAt) {
            const completedDate = new Date(subtask.completedAt);
            if (completedDate >= startDate && completedDate <= endDate) {
              subtaskTime += subtask.timeSpent || 0;
            }
          }
        });
      });
      const totalTimeSpent = mainTaskTime + subtaskTime;

      return {
        userId: member.uid,
        name: member.displayName || member.email,
        avatarUrl: member.photoURL,
        score: score,
        tasksCompleted: mainTasksCompletedCount + subtasksCompletedCount,
        mainTasksCompleted: mainTasksCompletedCount,
        subtasksCompleted: subtasksCompletedCount,
        totalTimeSpent: totalTimeSpent,
      };
    });

    return scores.sort((a, b) => b.score - a.score);
  }, [tasks, teamMembers, timeFrame]);

  if (loading) {
    return <LeaderboardSkeleton />;
  }

  if (teamMembers.length <= 1) {
    return null;
  }

  return (
    <Card className="shadow-elegant">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Team Leaderboard
          </CardTitle>
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            {(["day", "week", "month"] as TimeFrame[]).map((frame) => (
              <Button
                key={frame}
                size="sm"
                variant={timeFrame === frame ? "default" : "ghost"}
                onClick={() => setTimeFrame(frame)}
                className="capitalize text-xs h-7 px-2"
              >
                {frame}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AnimatePresence>
          <motion.ul
            key={timeFrame}
            className="space-y-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { staggerChildren: 0.07 } }}
          >
            {leaderboardData.length > 0 ? leaderboardData.slice(0, 5).map((user, index) => (
              <Collapsible asChild key={user.userId} open={expandedId === user.userId} onOpenChange={() => setExpandedId(expandedId === user.userId ? null : user.userId)}>
                <motion.li
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-lg transition-colors",
                    user.userId === userProfile?.uid && "bg-primary/10"
                  )}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center gap-4 p-2 rounded-lg">
                      <div className="w-6 flex items-center justify-center">{getRankIcon(index)}</div>
                      <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback className="bg-muted text-xs">
                          {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-medium text-sm truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{user.tasksCompleted} items</span>
                          {user.totalTimeSpent > 0 && (
                            <>
                              <span className="text-muted-foreground/50">•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(user.totalTimeSpent)}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <Badge variant="secondary" className="font-bold text-base px-3 py-1 rounded-full">
                        {user.score}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pl-12 pr-4 pb-2"
                    >
                      <div className="bg-muted/50 p-3 rounded-md border space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground">Performance Breakdown</h4>
                        <div className="flex justify-between items-center text-sm">
                          <span className="flex items-center gap-2"><CheckSquare className="h-4 w-4" /> Main Tasks</span>
                          <span className="font-bold">{user.mainTasksCompleted}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Subtasks</span>
                          <span className="font-bold">{user.subtasksCompleted}</span>
                        </div>
                      </div>
                    </motion.div>
                  </CollapsibleContent>
                </motion.li>
              </Collapsible>
            )) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No completed tasks for this period yet.</p>
              </div>
            )}
          </motion.ul>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}