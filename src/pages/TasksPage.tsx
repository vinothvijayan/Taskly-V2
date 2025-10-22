import { Plus, CheckSquare, Clock, ChevronLeft, ChevronRight, Search, List, LayoutGrid } from "lucide-react";
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
import { KanbanBoard } from "@/components/tasks/KanbanBoard"; // Import KanbanBoard
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
import { motion, AnimatePresence } from "framer-motion";

export default function TasksPage() {
  const { tasks, teamMembers, addTask, updateTask, deleteTask, toggleTaskStatus, toggleTaskPriority, setTaskFormActive, loading } = useTasks();
  const { startTaskTimer } = useTimer();
  const { user } = useAuth();
  const { createTaskOffline, updateTaskOffline, deleteTaskOffline, toggleTaskStatusOffline } = useOfflineSync();
  const isMobile = useIsMobile();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');

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

    return {
      todoTasks: allTodoTasks,
      completedTasks: allCompletedTasks
    };
  }, [tasks, currentDate]);

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

  const handleTaskStatusChangeFromKanban = (taskId: string, newStatus: Task['status']) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus) {
      updateTask(taskId, { status: newStatus, completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined });
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
          <div className="flex justify-end w-48 items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              <Button size="sm" variant={viewMode === 'list' ? 'default' : 'ghost'} onClick={() => setViewMode('list')} className="h-7 px-2"><List className="h-4 w-4" /></Button>
              <Button size="sm" variant={viewMode === 'board' ? 'default' : 'ghost'} onClick={() => setViewMode('board')} className="h-7 px-2"><LayoutGrid className="h-4 w-4" /></Button>
            </div>
            <TopPerformer />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {viewMode === 'list' ? (
            <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border shadow-sm">
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
          ) : (
            <KanbanBoard
              tasks={tasks}
              teamMembers={teamMembers}
              onEdit={setEditingTask}
              onDelete={handleDeleteTask}
              onStartTimer={handleStartTimer}
              onTaskStatusChange={handleTaskStatusChangeFromKanban}
            />
          )}
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