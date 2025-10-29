import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  BarChart3, CheckCircle, Clock, Target, TrendingUp, Filter, Calendar as CalendarIcon,
  Plus, Search, Flame, Award, Activity, Users, UserPlus, X, CheckSquare, ListChecks // ADDED ListChecks
} from "lucide-react";

import { useTasks } from "@/contexts/TasksContext";
import { useTimer } from "@/contexts/TimerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Task, UserProfile } from "@/types";

// Shadcn UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Custom Components
import { TaskCard } from "@/components/tasks/TaskCard";
import { MobileTaskCard } from "@/components/tasks/MobileTaskCard";
import { TaskForm } from "@/components/tasks/TaskForm";
import { ContributionGraph } from "@/components/dashboard/ContributionGraph";
import { DashboardSkeleton } from "@/components/skeletons";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { TeamActivityFeed } from "@/components/dashboard/TeamActivityFeed"; // <-- NEW IMPORT

interface FilterState {
  status: "all" | Task["status"];
  priority: "all" | Task["priority"];
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  search: string;
}

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

// Removed FilterControls as they are now only needed on TasksPage

export default function DashboardPage() {
  const {
    tasks, teamMembers, setTaskFormActive, addTask, updateTask, deleteTask,
    toggleTaskStatus, toggleTaskPriority, getTotalTasksCount, getCompletedTasksCount,
    getActiveTasksCount, getCurrentStreak, getLongestStreak, loading: tasksLoading
  } = useTasks();

  const { startTaskTimer } = useTimer();
  const { user, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  // Simplified filter state for dashboard view
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    priority: "all",
    dateRange: { from: undefined, to: undefined },
    search: "",
  });

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

  // Filter tasks for the current user's active list (top 5)
  const myActiveTasks = useMemo(() => {
    return tasks
      .filter(task => task.status !== 'completed' && task.createdBy === user?.uid)
      .slice(0, 5);
  }, [tasks, user?.uid]);

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

  const handleStartTimer = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) startTaskTimer(task);
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask(taskId);
  };

  const handleToggleStatus = (taskId: string) => {
    toggleTaskStatus(taskId);
  };

  const getAssignedProfiles = (assignedToUids?: string[]): UserProfile[] => {
    if (!assignedToUids || assignedToUids.length === 0) return [];
    return assignedToUids.map(uid => teamMembers.find(member => member.uid === uid)).filter((profile): profile is UserProfile => profile !== undefined);
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (showForm || editingTask) {
    return (
      <div className="container max-w-2xl mx-auto p-4 sm:p-6">
        <TaskForm
          task={editingTask}
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

        {/* Stats Grid */}
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

        {!isMobile && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Card className="shadow-elegant"><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Activity Overview</CardTitle></CardHeader><CardContent><ContributionGraph /></CardContent></Card>
          </motion.div>
        )}

        {/* Task Management, Activity Feed, and Leaderboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: My Active Tasks & Team Activity Feed */}
          <motion.div variants={itemVariants} initial="hidden" animate="visible" className="lg:col-span-2 space-y-6">
            
            {/* My Active Tasks */}
            <Card className="shadow-elegant">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-primary" />
                    My Top Active Tasks
                  </CardTitle>
                  <Button variant="link" size="sm" onClick={() => navigate('/tasks')}>
                    View All ({activeTasks})
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <ScrollArea className="h-[300px]">
                  {myActiveTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
                      <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">You're all caught up!</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-xs">Time to create a new task or start a focus session.</p>
                      <Button onClick={() => setShowForm(true)} variant="focus"><Plus className="h-4 w-4 mr-2" />Create Task</Button>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-3">
                      <AnimatePresence>
                        {myActiveTasks.map(task => (
                           <motion.div key={task.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                           {isMobile ? (
                              <MobileTaskCard key={task.id} task={task} onEdit={setEditingTask} onDelete={deleteTask} onToggleStatus={handleToggleStatus} onTogglePriority={toggleTaskPriority} onStartTimer={handleStartTimer} assignedProfiles={getAssignedProfiles(task.assignedTo)} />
                           ) : (
                              <TaskCard key={task.id} task={task} onEdit={setEditingTask} onDelete={deleteTask} onToggleStatus={toggleTaskStatus} onTogglePriority={toggleTaskPriority} onStartTimer={handleStartTimer} assignedProfiles={getAssignedProfiles(task.assignedTo)} />
                           )}
                           </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
            
            {/* Team Activity Feed */}
            <TeamActivityFeed />
            
          </motion.div>

          {/* Right Column: Team Leaderboard */}
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Leaderboard />
          </motion.div>
        </div>
      </div>
      
      {/* Mobile Floating Action Button (FAB) */}
      {isMobile && (
        <AnimatePresence>
          {!showForm && !editingTask && (
            <motion.div
              initial={{ scale: 0, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, y: 100 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="fixed bottom-6 right-6 z-50"
            >
              <Button onClick={() => setShowForm(true)} variant="focus" size="icon" className="h-14 w-14 rounded-full shadow-lg shadow-primary/30">
                <Plus className="h-6 w-6" />
                <span className="sr-only">Create New Task</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
      
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