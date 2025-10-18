import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  BarChart3, CheckCircle, Clock, Target, TrendingUp, Filter, Calendar as CalendarIcon,
  Plus, Search, Flame, Award, Activity, Users, UserPlus, X
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

// Custom Components
import { TaskCard } from "@/components/tasks/TaskCard";
import { MobileTaskCard } from "@/components/tasks/MobileTaskCard";
import { TaskForm } from "@/components/tasks/TaskForm";
import { ContributionGraph } from "@/components/dashboard/ContributionGraph";
import { DashboardSkeleton } from "@/components/skeletons";
import { Leaderboard } from "@/components/dashboard/Leaderboard";

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
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
    } as any,
  },
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

const FilterControls = ({ filters, setFilters, isMobile, inDrawer = false }: { filters: FilterState, setFilters: (filters: FilterState) => void, isMobile: boolean, inDrawer?: boolean }) => (
  <div className={cn("grid gap-4", inDrawer ? "grid-cols-1 p-4" : "sm:grid-cols-2 lg:grid-cols-4")}>
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input placeholder="Search tasks..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="pl-10" />
    </div>
    <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value as FilterState["status"] })}>
      <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
      <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="todo">To Do</SelectItem><SelectItem value="in-progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
    </Select>
    <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value as FilterState["priority"] })}>
      <SelectTrigger><SelectValue placeholder="Filter by priority" /></SelectTrigger>
      <SelectContent><SelectItem value="all">All Priority</SelectItem><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
    </Select>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start text-left font-normal", !filters.dateRange.from && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {filters.dateRange.from ? filters.dateRange.to ? `${format(filters.dateRange.from, "LLL dd")} - ${format(filters.dateRange.to, "LLL dd")}` : format(filters.dateRange.from, "LLL dd, y") : <span>Pick a date range</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar initialFocus mode="range" selected={filters.dateRange} onSelect={(range) => setFilters({ ...filters, dateRange: { from: range?.from, to: range?.to } })} numberOfMonths={isMobile ? 1 : 2} />
      </PopoverContent>
    </Popover>
  </div>
);

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
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
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

  const filteredTasks = tasks.filter(task => {
    if (filters.status !== "all" && task.status !== filters.status) return false;
    if (filters.priority !== "all" && task.priority !== filters.priority) return false;
    if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase()) && !task.description?.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.dateRange.from || filters.dateRange.to) {
      const taskDate = new Date(task.createdAt);
      if (filters.dateRange.from && taskDate < filters.dateRange.from) return false;
      if (filters.dateRange.to && taskDate > filters.dateRange.to) return false;
    }
    return true;
  });

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

  const clearFilters = () => {
    setFilters({ status: "all", priority: "all", dateRange: { from: undefined, to: undefined }, search: "" });
    if(isMobile) setIsFilterDrawerOpen(false);
  };
  
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.status !== "all") count++;
    if (filters.priority !== "all") count++;
    if (filters.search) count++;
    if (filters.dateRange.from) count++;
    return count;
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
            {!isMobile && (
              <Button onClick={() => setShowForm(true)} variant="focus" className="hover-scale">
                <Plus className="h-4 w-4 mr-2" /> New Task
              </Button>
            )}
          </div>
        </motion.div>

        {/* --- THIS IS THE CORRECTED & REFACTORED STATS GRID --- */}
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
        {/* --- END OF FIX --- */}

        {!isMobile && (
          <motion.div variants={itemVariants} initial="hidden" animate="visible">
            <Card className="shadow-elegant"><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Activity Overview</CardTitle></CardHeader><CardContent><ContributionGraph /></CardContent></Card>
          </motion.div>
        )}

        {/* Task Management and Team Collaboration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task Management */}
          <motion.div variants={itemVariants} initial="hidden" animate="visible" className="lg:col-span-2">
            <Card className="shadow-elegant">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Task Management</CardTitle>
                  {!isMobile && getActiveFilterCount() > 0 && <Button variant="outline" size="sm" onClick={clearFilters} className="hover-scale">Clear Filters</Button>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4 md:p-6">
                {isMobile ? (
                  <div className="flex items-center justify-between gap-2">
                     <div className="flex-1 text-sm text-muted-foreground">
                        Showing {filteredTasks.length} of {totalTasks} tasks
                     </div>
                     <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
                        <DrawerTrigger asChild>
                           <Button variant="outline" size="sm" className="shrink-0">
                              <Filter className="h-4 w-4 mr-2" />
                              <span>Filters</span>
                              {getActiveFilterCount() > 0 && <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">{getActiveFilterCount()}</Badge>}
                           </Button>
                        </DrawerTrigger>
                        <DrawerContent>
                           <DrawerHeader><DrawerTitle>Filter Tasks</DrawerTitle></DrawerHeader>
                           <FilterControls inDrawer={true} filters={filters} setFilters={setFilters} isMobile={isMobile} />
                           <DrawerFooter className="flex-row gap-2">
                              <DrawerClose asChild><Button variant="outline" className="flex-1">Close</Button></DrawerClose>
                              <Button onClick={clearFilters} variant="destructive" className="flex-1">Clear Filters</Button>
                           </DrawerFooter>
                        </DrawerContent>
                     </Drawer>
                  </div>
                ) : <FilterControls filters={filters} setFilters={setFilters} isMobile={isMobile} />}
                
                <ScrollArea className="h-[500px]">
                  {filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
                      <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">No tasks found</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-xs">{totalTasks === 0 ? "Create your first task to get started." : "Try adjusting your filters or create a new task."}</p>
                      <Button onClick={() => setShowForm(true)} variant="focus"><Plus className="h-4 w-4 mr-2" />Create Task</Button>
                    </div>
                  ) : (
                    <div className="space-y-3 pr-3">
                      <AnimatePresence>
                        {filteredTasks.map(task => (
                           <motion.div key={task.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                           {isMobile ? (
                              <MobileTaskCard key={task.id} task={task} onEdit={setEditingTask} onDelete={deleteTask} onToggleStatus={toggleTaskStatus} onTogglePriority={toggleTaskPriority} onStartTimer={handleStartTimer} assignedProfiles={getAssignedProfiles(task.assignedTo)} />
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
          </motion.div>

          {/* Team Leaderboard */}
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
    </>
  );
}