import { useParams, useNavigate } from "react-router-dom";
import { useTasks } from "@/contexts/TasksContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChevronLeft,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { useStopwatch } from "react-timer-hook";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function TaskPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { getTaskById, updateTask, deleteTask } = useTasks();

  const task = getTaskById(taskId || "");

  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  // Main task stopwatch
  const {
    seconds,
    minutes,
    hours,
    isRunning,
    start,
    pause,
    reset,
    totalSeconds,
  } = useStopwatch({ autoStart: false });

  // Subtask stopwatches
  const subtaskStopwatches = useMemo(() => {
    if (!task || !task.subtasks) return {};
    return task.subtasks.reduce((acc, subtask) => {
      acc[subtask.id] = new (useStopwatch as any)({ autoStart: false });
      return acc;
    }, {} as { [key: string]: ReturnType<typeof useStopwatch> });
  }, [task]);


  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isRunning || Object.values(subtaskStopwatches).some(s => s.isRunning)) {
        const confirmationMessage = "A timer is running. Are you sure you want to leave? The time will not be saved.";
        event.returnValue = confirmationMessage;
        return confirmationMessage;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRunning, subtaskStopwatches]);


  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        updateTask(task!.id, {
          ...task!,
          timeSpent: (task!.timeSpent || 0) + 1,
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning, task, updateTask]);

  // Effect for subtask timers
  useEffect(() => {
    const runningSubtaskTimers = Object.entries(subtaskStopwatches).filter(
      ([, stopwatch]) => stopwatch.isRunning
    );

    if (runningSubtaskTimers.length > 0) {
      const interval = setInterval(() => {
        runningSubtaskTimers.forEach(([subtaskId, stopwatch]) => {
          const updatedSubtasks = task?.subtasks?.map(sub => {
            if (sub.id === subtaskId) {
              return { ...sub, timeSpent: (sub.timeSpent || 0) + 1 };
            }
            return sub;
          });
          if (task && updatedSubtasks) {
            updateTask(task.id, { ...task, subtasks: updatedSubtasks });
          }
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [subtaskStopwatches, task, updateTask]);


  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-2xl font-semibold mb-2">Task not found</h2>
        <p className="text-muted-foreground mb-4">
          The task you are looking for does not exist.
        </p>
        <Button onClick={() => navigate("/")}>Go Back to Dashboard</Button>
      </div>
    );
  }

  const subtasksCompletion =
    task.subtasks && task.subtasks.length > 0
      ? (task.subtasks.filter(s => s.isCompleted).length /
        task.subtasks.length) *
      100
      : 0;

  const formatTime = (h: number, m: number, s: number) => {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(
      2,
      "0"
    )}:${String(s).padStart(2, "0")}`;
  };

  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim() === "") return;
    const newSubtask = {
      id: `subtask-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      isCompleted: false,
      timeSpent: 0,
    };
    const updatedSubtasks = [...(task.subtasks || []), newSubtask];
    updateTask(task.id, { ...task, subtasks: updatedSubtasks });
    setNewSubtaskTitle("");
  };

  const handleToggleSubtask = (subtaskId: string) => {
    if (!task) return;

    const stopwatch = subtaskStopwatches[subtaskId];
    let timeToAdd = 0;

    // If a timer is running for this subtask, capture its time before toggling.
    if (stopwatch && stopwatch.isRunning) {
      timeToAdd = stopwatch.totalSeconds;
      stopwatch.pause();
      stopwatch.reset(undefined, false); // Reset without auto-starting
    }

    const updatedSubtasks = task.subtasks?.map(sub => {
      if (sub.id === subtaskId) {
        const isCompleting = !sub.isCompleted;
        return {
          ...sub,
          isCompleted: isCompleting,
          completedAt: isCompleting ? new Date() : undefined,
          timeSpent: (sub.timeSpent || 0) + timeToAdd,
        };
      }
      return sub;
    });

    updateTask(task.id, { ...task, subtasks: updatedSubtasks });
  };


  const handleDeleteSubtask = (subtaskId: string) => {
    if (!task) return;
    const updatedSubtasks = task.subtasks?.filter(sub => sub.id !== subtaskId);
    updateTask(task.id, { ...task, subtasks: updatedSubtasks });
  };

  const handleTimerToggle = () => {
    if (isRunning) {
      pause();
    } else {
      // Pause all subtask timers if the main one starts
      Object.values(subtaskStopwatches).forEach(s => s.pause());
      start();
    }
  };

  const handleSubtaskTimerToggle = (subtaskId: string) => {
    const stopwatch = subtaskStopwatches[subtaskId];
    if (stopwatch) {
      if (stopwatch.isRunning) {
        stopwatch.pause();
      } else {
        // Pause main timer and other subtask timers
        pause();
        Object.entries(subtaskStopwatches).forEach(([id, s]) => {
          if (id !== subtaskId) s.pause();
        });
        stopwatch.start();
      }
    }
  };

  const handleResetTimer = () => {
    pause();
    updateTask(task.id, { ...task, timeSpent: 0 });
    reset(undefined, false);
  };

  const handleResetSubtaskTimer = (subtaskId: string) => {
    const stopwatch = subtaskStopwatches[subtaskId];
    if (stopwatch) {
      stopwatch.pause();
      stopwatch.reset(undefined, false);
      const updatedSubtasks = task.subtasks?.map(sub => {
        if (sub.id === subtaskId) {
          return { ...sub, timeSpent: 0 };
        }
        return sub;
      });
      updateTask(task.id, { ...task, subtasks: updatedSubtasks });
    }
  };

  const handleDeleteTask = () => {
    if (window.confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
      deleteTask(task.id);
      navigate("/");
    }
  };

  const formatTimeSpent = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${h > 0 ? `${h}h ` : ""}${m > 0 ? `${m}m ` : ""}${s}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="container max-w-4xl mx-auto p-4 md:p-6"
    >
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-4"
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <Card className="shadow-lg rounded-2xl">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl font-bold">{task.title}</CardTitle>
              <CardDescription className="mt-1">
                Created on {format(new Date(task.createdAt), "PPP")}
              </CardDescription>
            </div>
            <Badge
              variant={
                task.priority === "high"
                  ? "destructive"
                  : task.priority === "medium"
                    ? "default"
                    : "secondary"
              }
              className="capitalize"
            >
              {task.priority} Priority
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Timer Section */}
          <div className="p-6 rounded-lg bg-muted/50 border text-center">
            <p className="text-sm font-medium text-muted-foreground">
              TOTAL TIME SPENT
            </p>
            <div className="text-6xl font-bold my-2 text-primary tracking-tighter">
              {formatTimeSpent(task.timeSpent || 0)}
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button
                size="icon"
                onClick={handleTimerToggle}
                className={cn(
                  "rounded-full h-12 w-12 transition-all",
                  isRunning ? "bg-orange-500 hover:bg-orange-600" : "bg-primary hover:bg-primary/90"
                )}
              >
                {isRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={handleResetTimer}
                className="rounded-full h-12 w-12"
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Subtasks Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center">
              Subtasks
              <Badge variant="secondary" className="ml-2">
                {task.subtasks?.filter(s => s.isCompleted).length || 0} / {task.subtasks?.length || 0}
              </Badge>
            </h3>
            {task.subtasks && task.subtasks.length > 0 && (
              <div className="space-y-1">
                <Progress value={subtasksCompletion} className="h-2" />
              </div>
            )}
            <div className="space-y-3">
              <AnimatePresence>
                {task.subtasks?.map(subtask => (
                  <motion.div
                    key={subtask.id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors",
                      subtask.isCompleted ? "bg-muted/40" : "bg-muted/20"
                    )}
                  >
                    <Checkbox
                      id={`subtask-${subtask.id}`}
                      checked={subtask.isCompleted}
                      onCheckedChange={() => handleToggleSubtask(subtask.id)}
                      className="rounded-full"
                    />
                    <label
                      htmlFor={`subtask-${subtask.id}`}
                      className={cn(
                        "flex-1 text-sm font-medium cursor-pointer",
                        subtask.isCompleted && "line-through text-muted-foreground"
                      )}
                    >
                      {subtask.title}
                    </label>

                    {!subtask.isCompleted && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-24 text-right">
                          {formatTimeSpent(subtask.timeSpent || 0)}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full"
                          onClick={() => handleSubtaskTimerToggle(subtask.id)}
                        >
                          {subtaskStopwatches[subtask.id]?.isRunning ? (
                            <Pause className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Play className="h-4 w-4 text-primary" />
                          )}
                        </Button>
                      </div>
                    )}
                    {subtask.isCompleted && (
                      <span className="text-xs font-mono text-muted-foreground w-24 text-right">
                        {formatTimeSpent(subtask.timeSpent || 0)}
                      </span>
                    )}

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteSubtask(subtask.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a new subtask..."
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                onKeyPress={e => e.key === "Enter" && handleAddSubtask()}
              />
              <Button onClick={handleAddSubtask}>
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button variant="destructive" onClick={handleDeleteTask}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Task
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}