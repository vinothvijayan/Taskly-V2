import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { TaskCard } from "@/components/tasks/TaskCard"
import { MobileTaskCard } from "@/components/tasks/MobileTaskCard"
import { TaskForm } from "@/components/tasks/TaskForm"
import { FloatingActionButton } from "@/components/tasks/FloatingActionButton"
import { TopPerformer } from "@/components/tasks/TopPerformer"

import { AnimatedContainer, StaggeredList } from "@/components/ui/smooth-transitions"
import { useTasks } from "@/contexts/TasksContext"
import { useTimer } from "@/contexts/TimerContext"
import { useOfflineSync } from "@/hooks/useOfflineSync"
import { useIsMobile } from "@/hooks/use-mobile"
import { useState, useEffect, useCallback, useMemo } from "react"
import { CheckSquare, Clock } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Task, UserProfile } from "@/types"
import { cn } from "@/lib/utils"
import { TasksPageSkeleton } from "@/components/skeletons"

export default function TasksPage() {
  const { tasks, teamMembers, addTask, updateTask, deleteTask, toggleTaskStatus, toggleTaskPriority, setTaskFormActive, loading } = useTasks()
  const { startTaskTimer } = useTimer()
  const { user, userProfile } = useAuth()
  const { createTaskOffline, updateTaskOffline, deleteTaskOffline, toggleTaskStatusOffline, getLocalTasks } = useOfflineSync()
  const isMobile = useIsMobile()
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [quickTaskTitle, setQuickTaskTitle] = useState("")
  

  // Manage form active state for real-time updates
  useEffect(() => {
    const isFormActive = !!editingTask;
    setTaskFormActive(isFormActive);
    
    return () => {
      // Cleanup: ensure form is marked as inactive when component unmounts
      setTaskFormActive(false);
    };
  }, [editingTask, setTaskFormActive]);

  // Memoized filtered tasks for better performance
  const { todoTasks, completedTasks } = useMemo(() => ({
    todoTasks: tasks.filter(task => task.status !== "completed"),
    completedTasks: tasks.filter(task => task.status === "completed")
  }), [tasks])

  const handleCreateTask = async (taskData: Omit<Task, "id" | "createdAt">) => {
    if (!user?.uid) return;
    
    if (navigator.onLine) {
      addTask({ ...taskData, createdBy: user.uid });
    } else {
      await createTaskOffline(taskData, user.uid);
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
    
    const taskData = {
      title: quickTaskTitle.trim(),
      priority: "medium" as const,
      status: "todo" as const,
      createdBy: user.uid,
    };
    
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
    if (e.key === "Enter") {
      handleQuickAddTask()
    }
  }

  const getAssignedProfiles = (assignedToUids?: string[]): UserProfile[] => {
    if (!assignedToUids || assignedToUids.length === 0) return [];
    return assignedToUids
      .map(uid => teamMembers.find(member => member.uid === uid))
      .filter((profile): profile is UserProfile => profile !== undefined);
  };


  // Quick capture handler for FAB
  const handleQuickCapture = useCallback(async (taskData: any) => {
    if (!user?.uid) return;
    
    const fullTaskData = {
      ...taskData,
      status: "todo" as const,
      createdBy: user.uid,
    };
    
    if (navigator.onLine) {
      addTask({ ...fullTaskData, createdAt: new Date().toISOString() });
    } else {
      await createTaskOffline(fullTaskData, user.uid);
    }
  }, [user?.uid, addTask, createTaskOffline]);

  if (loading) {
    return <TasksPageSkeleton />;
  }

  return (
    <>
      <div className="relative h-full flex flex-col">
        <div className="h-full overflow-y-auto scrollbar-hide touch-pan-y">
          <div className="container max-w-7xl mx-auto p-4 md:p-6 flex flex-col flex-1 min-h-0">
            {/* Header - Responsive */}
            <div className={cn(
              "text-center space-y-2",
              isMobile ? "mb-4 px-2" : "mb-6"
            )}>
              <div className="flex items-center justify-center gap-4">
                <h1 className={cn(
                  "font-bold bg-gradient-to-r from-primary to-focus bg-clip-text text-transparent",
                  isMobile ? "text-2xl" : "text-3xl md:text-4xl"
                )}>
                  My Day
                </h1>
                {!isMobile && <TopPerformer />}
              </div>
              <p className={cn(
                "text-muted-foreground",
                isMobile ? "text-sm px-4" : "text-base md:text-lg"
              )}>
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            </div>

            {/* Mobile/Desktop Layout Switch */}
            {isMobile ? (
              /* Mobile Single Column Layout */
              <div className="flex-1 min-h-0 overflow-hidden">
                <div className="space-y-4 pb-24 px-2">
                  {/* Active Tasks */}
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20 mx-1">
                      <CheckSquare className="h-5 w-5 text-primary" />
                      <h2 className="text-base font-semibold text-primary">Active Tasks</h2>
                      <div className="ml-auto bg-primary text-primary-foreground px-2.5 py-1 rounded-full text-xs font-bold shadow-sm">
                        {todoTasks.length}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {todoTasks.length === 0 ? (
                        <div className="text-center py-12 space-y-3 mx-2">
                          <div className="h-20 w-20 bg-gradient-to-br from-primary/10 to-focus/10 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                            <CheckSquare className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-muted-foreground mb-2">
                              No tasks yet
                            </h3>
                            <p className="text-sm text-muted-foreground px-4">
                              Tap the + button to add your first task
                            </p>
                          </div>
                        </div>
                      ) : (
                        <StaggeredList>
                          {todoTasks.map(task => (
                            <MobileTaskCard
                              key={task.id}
                              task={task}
                              onEdit={setEditingTask}
                              onDelete={handleDeleteTask}
                              onToggleStatus={handleToggleStatus}
                              onTogglePriority={toggleTaskPriority}
                              onStartTimer={handleStartTimer}
                              assignedProfiles={getAssignedProfiles(task.assignedTo)}
                            />
                          ))}
                        </StaggeredList>
                      )}
                    </div>
                  </div>
                  
                  {/* Completed Tasks */}
                  {completedTasks.length > 0 && (
                    <div className="flex flex-col space-y-4 pt-6">
                      <div className="flex items-center gap-3 px-3 py-2 bg-gradient-to-r from-success/5 to-success/10 rounded-xl border border-success/20">
                        <Clock className="h-5 w-5 text-success" />
                        <h2 className="text-lg font-semibold text-success">Completed</h2>
                        <div className="ml-auto bg-success text-success-foreground px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                          {completedTasks.length}
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        {completedTasks.map(task => (
                          <MobileTaskCard
                            key={task.id}
                            task={task}
                            onEdit={setEditingTask}
                            onDelete={handleDeleteTask}
                            onToggleStatus={handleToggleStatus}
                            onTogglePriority={toggleTaskPriority}
                            onStartTimer={handleStartTimer}
                            assignedProfiles={getAssignedProfiles(task.assignedTo)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Desktop Two Column Layout */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
                {/* Active Tasks Column */}
                <div className="flex flex-col space-y-4 flex-1 min-h-0 px-2">
                  <div className="flex items-center gap-2 px-2">
                    <CheckSquare className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">My Tasks</h2>
                    <div className="ml-auto bg-primary/10 text-primary px-2 py-1 rounded-full text-sm font-medium">
                      {todoTasks.length}
                    </div>
                  </div>
                  
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-2 pr-2">
                      {todoTasks.length === 0 ? (
                        <div className="text-center py-12 space-y-3 mx-2">
                          <div className="h-20 w-20 bg-gradient-to-br from-primary/10 to-focus/10 rounded-2xl flex items-center justify-center mx-auto shadow-elegant">
                            <CheckSquare className="h-10 w-10 text-muted-foreground/50" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-muted-foreground mb-2">
                              No tasks yet
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Add your first task below to get started
                            </p>
                          </div>
                        </div>
                      ) : (
                        todoTasks.map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onEdit={setEditingTask}
                            onDelete={handleDeleteTask}
                            onToggleStatus={handleToggleStatus}
                            onTogglePriority={toggleTaskPriority}
                            onStartTimer={handleStartTimer}
                            assignedProfiles={getAssignedProfiles(task.assignedTo)}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Completed Tasks Column */}
                <div className="flex flex-col space-y-4 flex-1 min-h-0 px-2">
                  <div className="flex items-center gap-2 px-2">
                    <Clock className="h-5 w-5 text-success" />
                    <h2 className="text-xl font-semibold">Completed</h2>
                    <div className="ml-auto bg-success/10 text-success px-2 py-1 rounded-full text-sm font-medium">
                      {completedTasks.length}
                    </div>
                  </div>
                  
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-2 pr-2">
                      {completedTasks.length === 0 ? (
                        <div className="text-center py-16 space-y-4">
                          <div className="h-20 w-20 bg-gradient-to-br from-success/10 to-success/20 rounded-2xl flex items-center justify-center mx-auto shadow-elegant">
                            <Clock className="h-10 w-10 text-muted-foreground/50" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-muted-foreground mb-2">
                              No completed tasks
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Completed tasks will appear here
                            </p>
                          </div>
                        </div>
                      ) : (
                        completedTasks.map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onEdit={setEditingTask}
                            onDelete={handleDeleteTask}
                            onToggleStatus={handleToggleStatus}
                            onTogglePriority={toggleTaskPriority}
                            onStartTimer={handleStartTimer}
                            assignedProfiles={getAssignedProfiles(task.assignedTo)}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Quick Add Bar - Only show on desktop */}
        {!isMobile && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-6">
            <div className="flex items-center gap-3 bg-card/90 backdrop-blur-lg rounded-xl border-2 border-primary/20 shadow-elegant shadow-glow p-4 transition-smooth ring-2 ring-primary/30 hover:ring-primary/40">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-smooth hover:scale-110 shrink-0"
                onClick={handleQuickAddTask}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Input
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add a task"
                className="border-none shadow-none focus-visible:ring-0 bg-transparent text-base placeholder:text-muted-foreground/70 flex-1 focus:placeholder:text-muted-foreground/50"
              />
              {quickTaskTitle.trim() && (
                <Button
                  onClick={handleQuickAddTask}
                  variant="focus"
                  size="sm"
                  className="hover-scale shadow-md"
                >
                  Add
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Mobile Floating Action Button */}
        {isMobile && (
          <FloatingActionButton onCreateTask={handleQuickCapture} />
        )}
      </div>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="sm:max-w-[500px] shadow-elegant">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              Edit Task
            </DialogTitle>
            <DialogDescription>
              Make changes to your task here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {editingTask && (
            <TaskForm
              task={editingTask}
              onSubmit={handleEditTask}
              onCancel={() => setEditingTask(null)}
              teamMembers={teamMembers}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}