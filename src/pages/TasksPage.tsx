import { Plus, CheckSquare, Clock, ChevronLeft, ChevronRight, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { TaskCard } from "@/components/tasks/TaskCard";
import { MobileTaskCard } from "@/components/tasks/MobileTaskCard";
import { TaskForm } from "@/components/tasks/TaskForm";
import { FloatingActionButton } from "@/components/tasks/FloatingActionButton";
import { TopPerformer } from "@/components/tasks/TopPerformer";
import { useTasks } from "@/contexts/TasksContext";
import { useTimer } from "@/contexts/TimerContext";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Task, UserProfile } from "@/types";
import { cn } from "@/lib/utils";
import { TasksPageSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { addDays, subDays, format, isToday, isYesterday, isTomorrow, isSameDay, startOfDay } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { motion, AnimatePresence } from "framer-motion";

interface FilterState {
  status: "all" | "todo" | "in-progress";
  priority: "all" | Task["priority"];
  search: string;
}

export default function TasksPage() {
  const { tasks, teamMembers, addTask, updateTask, deleteTask, toggleTaskStatus, toggleTaskPriority, setTaskFormActive, loading } = useTasks();
  const { startTaskTimer } = useTimer();
  const { user } = useAuth();
  const { createTaskOffline, updateTaskOffline, deleteTaskOffline, toggleTaskStatusOffline } = useOfflineSync();
  const isMobile = useIsMobile();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    priority: "all",
    search: "",
  });

  useEffect(() => {
    const isFormActive = !!editingTask;
    setTaskFormActive(isFormActive);
    return () => setTaskFormActive(false);
  }, [editingTask, setTaskFormActive]);

  const handlePrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));

  const getHeaderTitle = () => {
    if (isToday(currentDate)) return "My Day";
    if (isYesterday(currentDate)) return "Yesterday";
    if (isTomorrow(currentDate)) return "Tomorrow";
    return format(currentDate, "EEEE");
  };

  const { todoTasks, completedTasks } = useMemo(() => {
    const tasksForSelectedDate = tasks.filter(task => {
      const isCompletedOnDate = task.completedAt && isSameDay(new Date(task.completedAt as string), currentDate);
      if (isCompletedOnDate) {
        return true;
      }

      if (!isToday(currentDate)) {
        return task.dueDate && isSameDay(new Date(task.dueDate), currentDate) && task.status !== 'completed';
      }

      if (task.status === 'completed') return false;

      if (task.dueDate && isSameDay(new Date(task.dueDate), currentDate)) {
        return true;
      }
      if (task.dueDate && new Date(task.dueDate) < startOfDay(new Date())) {
        return true;
      }
      if (!task.dueDate) {
        return true;
      }

      return false;
    });

    const allTodoTasks = tasksForSelectedDate.filter(task => task.status !== 'completed');
    const allCompletedTasks = tasksForSelectedDate.filter(task => task.status === 'completed');

    const filteredTodo = allTodoTasks.filter(task => {
      if (filters.status !== "all" && task.status !== filters.status) return false;
      if (filters.priority !== "all" && task.priority !== filters.priority) return false;
      if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase()) && !task.description?.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });

    const filteredCompleted = allCompletedTasks.filter(task => {
      if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase()) && !task.description?.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });

    return {
      todoTasks: filteredTodo,
      completedTasks: filteredCompleted
    };
  }, [tasks, currentDate, filters]);

  const handleCreateTask = async (taskData: Omit<Task, "id" | "createdAt">) => {
    if (!user?.uid) return;
    const taskPayload = { ...taskData, createdBy: user.uid, dueDate: taskData.dueDate || format(currentDate, 'yyyy-MM-dd') };
    if (navigator.onLine) {
      addTask(taskPayload);
    } else {
      await createTaskOffline(taskPayload, user.uid);
    }
    setEditingTask(null);
  };

  const handleEditTask = async (taskData: Omit<Task, "id" | "createdAt">) => {
    if (!editingTask || !user?.uid) return;
    if (navigator.onLine) {
      updateTask(editingTask.id, taskData);
    } else {
      await updateTaskOffline(editingTask.id, taskData, user.uid);
    }
    setEditingTask(null);
  };

  const handleQuickAddTask = async () => {
    if (!quickTaskTitle.trim() || !user?.uid) return;
    const taskData = { title: quickTaskTitle.trim(), priority: "medium" as const, status: "todo" as const, createdBy: user.uid, dueDate: format(currentDate, 'yyyy-MM-dd') };
    if (navigator.onLine) {
      addTask(taskData);
    } else {
      await createTaskOffline(taskData, user.uid);
    }
    setQuickTaskTitle("");
  };

  const handleStartTimer = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) startTaskTimer(task);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user?.uid) return;
    if (navigator.onLine) {
      deleteTask(taskId);
    } else {
      await deleteTaskOffline(taskId, user.uid);
    }
  };

  const handleToggleStatus = async (taskId: string) => {
    if (!user?.uid) return;
    if (navigator.onLine) {
      toggleTaskStatus(taskId);
    } else {
      await toggleTaskStatusOffline(taskId, user.uid);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleQuickAddTask();
  };

  const getAssignedProfiles = (assignedToUids?: string[]): UserProfile[] => {
    if (!assignedToUids || assignedToUids.length === 0) return [];
    return assignedToUids.map(uid => teamMembers.find(member => member.uid === uid)).filter((profile): profile is UserProfile => profile !== undefined);
  };

  const handleQuickCapture = useCallback(async (taskData: any) => {
    if (!user?.uid) return;
    const fullTaskData = { ...taskData, status: "todo" as const, createdBy: user.uid, dueDate: format(currentDate, 'yyyy-MM-dd') };
    if (navigator.onLine) {
      addTask({ ...fullTaskData, createdAt: new Date().toISOString() });
    } else {
      await createTaskOffline(fullTaskData, user.uid);
    }
  }, [user?.uid, addTask, createTaskOffline, currentDate]);

  if (loading) {
    return <TasksPageSkeleton />;
  }

  if (isMobile) {
    return (
      <>
        <div className="h-full overflow-y-auto scrollbar-hide touch-pan-y">
          <div className="container max-w-7xl mx-auto p-4 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-center space-x-2 text-center mb-4 px-2">
              <Button variant="ghost" size="icon" onClick={handlePrevDay} className="h-12 w-12 rounded-full">
                <ChevronLeft className="h-7 w-7" strokeWidth={2.5} />
              </Button>
              <div className="space-y-1 flex-1">
                <h1 className="font-bold bg-gradient-to-r from-primary to-focus bg-clip-text text-transparent text-2xl">
                  {getHeaderTitle()}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {format(currentDate, 'EEEE, MMMM d')}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleNextDay} className="h-12 w-12 rounded-full">
                <ChevronRight className="h-7 w-7" strokeWidth={2.5} />
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="space-y-4 pb-24 px-2">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20 mx-1">
                    <CheckSquare className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold text-primary">Active Tasks</h2>
                    <div className="ml-auto bg-primary text-primary-foreground px-2.5 py-1 rounded-full text-xs font-bold shadow-sm">{todoTasks.length}</div>
                  </div>
                  <div className="space-y-3">
                    {todoTasks.length === 0 && completedTasks.length === 0 ? (
                      <div className="text-center py-12 space-y-3 mx-2">
                        <div className="h-20 w-20 bg-gradient-to-br from-primary/10 to-focus/10 rounded-2xl flex items-center justify-center mx-auto shadow-lg"><CheckSquare className="h-8 w-8 text-muted-foreground/50" /></div>
                        <div><h3 className="text-lg font-medium text-muted-foreground mb-2">No tasks for this day</h3><p className="text-sm text-muted-foreground px-4">Tap the + button to add a task</p></div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <AnimatePresence>
                          {todoTasks.map(task => (
                            <motion.div key={task.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                              <MobileTaskCard key={task.id} task={task} onEdit={setEditingTask} onDelete={handleDeleteTask} onToggleStatus={handleToggleStatus} onTogglePriority={toggleTaskPriority} onStartTimer={handleStartTimer} assignedProfiles={getAssignedProfiles(task.assignedTo)} />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
                {completedTasks.length > 0 && (
                  <div className="flex flex-col space-y-4 pt-6">
                    <div className="flex items-center gap-3 px-3 py-2 bg-gradient-to-r from-success/5 to-success/10 rounded-xl border border-success/20"><Clock className="h-5 w-5 text-success" /><h2 className="text-lg font-semibold text-success">Completed</h2><div className="ml-auto bg-success text-success-foreground px-3 py-1 rounded-full text-sm font-bold shadow-sm">{completedTasks.length}</div></div>
                    <div className="space-y-4">{completedTasks.map(task => <MobileTaskCard key={task.id} task={task} onEdit={setEditingTask} onDelete={handleDeleteTask} onToggleStatus={handleToggleStatus} onTogglePriority={toggleTaskPriority} onStartTimer={handleStartTimer} assignedProfiles={getAssignedProfiles(task.assignedTo)} />)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <FloatingActionButton onCreateTask={handleQuickCapture} />
        <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
          <DialogContent className="sm:max-w-[500px] shadow-elegant"><DialogHeader><DialogTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5 text-primary" />Edit Task</DialogTitle><DialogDescription>Make changes to your task here. Click save when you're done.</DialogDescription></DialogHeader>{editingTask && <TaskForm task={editingTask} onSubmit={handleEditTask} onCancel={() => setEditingTask(null)} teamMembers={teamMembers} />}</DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="w-48" />
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handlePrevDay} className="rounded-full h-10 w-10">
              <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
            </Button>
            <div className="text-center">
              <h1 className="text-3xl font-bold">{getHeaderTitle()}</h1>
              <p className="text-muted-foreground">{format(currentDate, 'EEEE, MMMM d')}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleNextDay} className="rounded-full h-10 w-10">
              <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
            </Button>
          </div>
          <div className="flex justify-end w-48">
            <TopPerformer />
          </div>
        </div>
        <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border shadow-sm">
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="flex flex-col h-full">
              <div className="p-4 border-b space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Active Tasks</h2>
                    <Badge variant="secondary">{todoTasks.length}</Badge>
                  </div>
                  <div className="flex items-center gap-2 w-full max-w-xs bg-muted/50 rounded-lg px-3">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <Input value={quickTaskTitle} onChange={(e) => setQuickTaskTitle(e.target.value)} onKeyPress={handleKeyPress} placeholder="Add a new task..." className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative col-span-3 sm:col-span-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search tasks..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="pl-10" />
                  </div>
                  <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value as FilterState["status"] })}>
                    <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value as FilterState["priority"] })}>
                    <SelectTrigger><SelectValue placeholder="Filter by priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <ScrollArea className="flex-1"><div className="p-4 space-y-2">{todoTasks.length > 0 || completedTasks.length > 0 ? todoTasks.map(task => <TaskCard key={task.id} task={task} onEdit={setEditingTask} onDelete={handleDeleteTask} onToggleStatus={handleToggleStatus} onTogglePriority={toggleTaskPriority} onStartTimer={handleStartTimer} assignedProfiles={getAssignedProfiles(task.assignedTo)} />) : <div className="text-center py-16 text-muted-foreground"><p>No tasks for this day.</p></div>}</div></ScrollArea>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={30}>
            <div className="flex flex-col h-full">
              <div className="p-4 border-b flex items-center justify-between"><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-success" /><h2 className="text-lg font-semibold">Completed</h2></div><Badge variant="secondary">{completedTasks.length}</Badge></div>
              <ScrollArea className="flex-1"><div className="p-4 space-y-2">{completedTasks.length > 0 ? completedTasks.map(task => <TaskCard key={task.id} task={task} onEdit={setEditingTask} onDelete={handleDeleteTask} onToggleStatus={handleToggleStatus} onTogglePriority={toggleTaskPriority} onStartTimer={handleStartTimer} assignedProfiles={getAssignedProfiles(task.assignedTo)} />) : <div className="text-center py-16 text-muted-foreground"><p>No completed tasks for this day.</p></div>}</div></ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="sm:max-w-[500px] shadow-elegant"><DialogHeader><DialogTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5 text-primary" />Edit Task</DialogTitle><DialogDescription>Make changes to your task here. Click save when you're done.</DialogDescription></DialogHeader>{editingTask && <TaskForm task={editingTask} onSubmit={handleEditTask} onCancel={() => setEditingTask(null)} teamMembers={teamMembers} />}</DialogContent>
      </Dialog>
    </>
  );
}