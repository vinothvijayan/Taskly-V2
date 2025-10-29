import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  BarChart3, CheckCircle, Clock, Target, TrendingUp, Filter, Calendar as CalendarIcon,
  Plus, Search, Flame, Award, Activity, Users, UserPlus, X, CheckSquare // <-- ADDED CheckSquare
} from "lucide-react";

import { useTasks } from "@/contexts/TasksContext";
import { useTimer } from "@/contexts/TimerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import { Task, UserProfile } from "@/types";

// Shadcn UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"; // <-- ADDED IMPORTS

// Custom Components
import { TaskForm } from "@/components/tasks/TaskForm";
import { ContributionGraph } from "@/components/dashboard/ContributionGraph";
import { DashboardSkeleton } from "@/components/skeletons";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { TeamActivityFeed } from "@/components/dashboard/TeamActivityFeed";

// Animation Variants for Framer Motion
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    } as any,
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
    } as any,
  }),
};

const StatCard = ({ title, value, icon: Icon, colorClass, bgColorClass }: any) => (
  <motion.div variants={itemVariants}>
    <Card className="shadow-elegant overflow-hidden">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn("text-xl sm:text-2xl font-bold", colorClass)}>{value}</p>
        </div>
        <div className={cn("h-10 w-10 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center", bgColorClass)}>
          <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6", colorClass)} />
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

export default function DashboardPage() {
  const {
    tasks, teamMembers, setTaskFormActive, addTask, updateTask,
    getTotalTasksCount, getCompletedTasksCount,
    getActiveTasksCount, getCurrentStreak, getLongestStreak, loading: tasksLoading
  } = useTasks();

  const { user, userProfile, loading: authLoading } = useAuth();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const isFormActive = showForm || !!editingTask;
    setTaskFormActive(isFormActive);
    return () => setTaskFormActive(false);
  }, [showForm, editingTask, setTaskFormActive]);

  const isLoading = tasksLoading || authLoading;

  const totalTasks = getTotalTasksCount();
  const completedTasks = getCompletedTasksCount();
  const activeTasks = getActiveTasksCount();
  const currentStreak = getCurrentStreak();
  const longestStreak = getLongestStreak();
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleCreateTask = (taskData: Omit<Task, "id" | "createdAt">) => {
    const newTaskData: any = {
      ...taskData,
      createdBy: user?.uid || null,
    };

    if (newTaskData.estimatedTime === undefined) {
      delete newTaskData.estimatedTime;
    }
    addTask(newTaskData);
    setShowForm(false);
  };

  const handleEditTask = (taskData: Omit<Task, "id" | "createdAt">) => {
    if (!editingTask) return;
    updateTask(editingTask.id, taskData);
    setEditingTask(null);
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (showForm || editingTask) {
    return (
      <div className="container max-w-2xl mx-auto p-4 sm:p-6">
        <TaskForm
          task={editingTask || undefined}
          onSubmit={editingTask ? handleEditTask : handleCreateTask}
          onCancel={() => { setShowForm(false); setEditingTask(null); }}
          teamMembers={teamMembers}
        />
      </div>
    );
  }

  return (
    <>
      <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {userProfile?.displayName || user?.email}!</p>
            </div>
            <Button 
              onClick={() => setShowForm(true)} 
              variant="focus" 
              className="hover-scale hidden md:flex"
            >
              <Plus className="h-4 w-4 mr-2" /> New Task
            </Button>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
        >
          <StatCard title="Total Tasks" value={totalTasks} icon={Target} colorClass="text-primary" bgColorClass="bg-primary/10" />
          <StatCard title="Completed" value={completedTasks} icon={CheckCircle} colorClass="text-success" bgColorClass="bg-success/10" />
          <StatCard title="Active Tasks" value={activeTasks} icon={Clock} colorClass="text-focus" bgColorClass="bg-focus/10" />
          <StatCard title="Completion Rate" value={`${completionRate}%`} icon={TrendingUp} colorClass="text-break" bgColorClass="bg-break/10" />
          <StatCard title="Current Streak" value={`${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}`} icon={Flame} colorClass="text-orange-500" bgColorClass="bg-orange-500/10" />
          <StatCard title="Longest Streak" value={`${longestStreak} ${longestStreak === 1 ? 'day' : 'days'}`} icon={Award} colorClass="text-purple-500" bgColorClass="bg-purple-500/10" />
        </motion.div>

        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card className="shadow-elegant"><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Activity Overview</CardTitle></CardHeader><CardContent><ContributionGraph /></CardContent></Card>
        </motion.div>

        {/* Team Activity and Leaderboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Activity Feed */}
          <motion.div variants={itemVariants} initial="hidden" animate="visible" className="lg:col-span-2">
            <TeamActivityFeed />
          </motion.div>

          {/* Team Leaderboard */}
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Leaderboard />
          </motion.div>
        </div>
      </div>
      
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="sm:max-w-[500px] shadow-elegant max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              Edit Task
            </DialogTitle>
            <DialogDescription>
              Make changes to your task here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {editingTask && <TaskForm task={editingTask} onSubmit={handleEditTask} onCancel={() => setEditingTask(null)} teamMembers={teamMembers} />}
        </DialogContent>
      </Dialog>
    </>
  );
}