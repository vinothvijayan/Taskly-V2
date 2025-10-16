import { useState } from "react";
import { format } from "date-fns";
import { useTasks } from "@/contexts/TasksContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ContributionGraph } from "@/components/dashboard/ContributionGraph";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  Target,
  Clock,
  CheckCircle,
  Calendar as CalendarIcon,
  Flame,
  Award,
  Timer,
  Zap,
  Activity,
  Download,
} from "lucide-react";
import { motion } from "framer-motion";
import { Task } from "@/types";
import { exportDailyReportToPDF } from "@/lib/pdfExport";
import { Button } from "@/components/ui/button";
import { AnalyticsPageSkeleton } from "@/components/skeletons";

export default function AnalyticsPage() {
  const {
    tasks,
    getTotalTasksCount,
    getCompletedTasksCount,
    getCurrentStreak,
    getLongestStreak,
    getTasksByStatus,
    getTasksByPriority,
    getTasksCompletedOnDate,
    loading
  } = useTasks();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Overall Stats
  const totalTasks = getTotalTasksCount();
  const completedTasks = getCompletedTasksCount();
  const currentStreak = getCurrentStreak();
  const longestStreak = getLongestStreak();
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const todoTasks = getTasksByStatus("todo").length;
  const inProgressTasks = getTasksByStatus("in-progress").length;
  const highPriorityTasks = getTasksByPriority("high").length;
  const mediumPriorityTasks = getTasksByPriority("medium").length;
  const lowPriorityTasks = getTasksByPriority("low").length;

  // Daily Report Stats
  const dailyTasks = selectedDate ? getTasksCompletedOnDate(selectedDate) : [];

  // Get completed subtasks for the selected date
  const getCompletedSubtasksOnDate = (date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const completedSubtasksData: Array<{
      subtask: any;
      parentTask: Task;
      completionPercentage: number;
    }> = [];

    tasks.forEach(task => {
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(subtask => {
          if (subtask.isCompleted && subtask.completedAt) {
            const completedDate = new Date(subtask.completedAt);
            if (completedDate >= startOfDay && completedDate <= endOfDay) {
              const totalSubtasks = task.subtasks?.length || 1;
              const completedCount = task.subtasks?.filter(s => s.isCompleted).length || 0;
              const completionPercentage = Math.round((completedCount / totalSubtasks) * 100);

              completedSubtasksData.push({
                subtask,
                parentTask: task,
                completionPercentage
              });
            }
          }
        });
      }
    });

    return completedSubtasksData;
  };

  const dailyCompletedSubtasks = selectedDate ? getCompletedSubtasksOnDate(selectedDate) : [];

  // Calculate total time including subtask time
  const dailyTimeSpent =
    dailyTasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0) +
    dailyCompletedSubtasks.reduce((sum, item) => sum + (item.subtask.timeSpent || 0), 0);

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${seconds}s`;
  };

  const getTopTasksByTime = () => {
    return tasks
      .filter(t => t.timeSpent && t.timeSpent > 0)
      .sort((a, b) => (b.timeSpent || 0) - (a.timeSpent || 0))
      .slice(0, 5);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 } as any,
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.4, ease: [0.4, 0, 0.2, 1] } as any,
    }),
  };

  const handleExportPDF = () => {
    if (!selectedDate) return;

    exportDailyReportToPDF({
      date: selectedDate,
      completedTasks: dailyTasks,
      completedSubtasks: dailyCompletedSubtasks,
      totalTimeSpent: dailyTimeSpent,
    });
  };

  if (loading) {
    return <AnalyticsPageSkeleton />;
  }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-2"
      >
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          Analytics
        </h1>
        <p className="text-muted-foreground">
          Detailed insights into your productivity and task management
        </p>
      </motion.div>

      {/* Daily Report Section */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div variants={itemVariants} custom={0}>
          <Card className="shadow-md rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                Select a Date
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-lg border shadow-sm"
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} custom={1} className="lg:col-span-2">
          <Card className="shadow-md rounded-2xl min-h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Report for {selectedDate ? format(selectedDate, "PPP") : "..."}
                </CardTitle>
                {(dailyTasks.length > 0 || dailyCompletedSubtasks.length > 0) && (
                  <Button
                    onClick={handleExportPDF}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export PDF
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {dailyTasks.length === 0 && dailyCompletedSubtasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground h-full flex flex-col justify-center items-center">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">No tasks or subtasks completed on this day.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <p className="text-sm font-medium text-muted-foreground">Items Completed</p>
                      <p className="text-3xl font-bold text-primary">{dailyTasks.length + dailyCompletedSubtasks.length}</p>
                    </div>
                    <div className="p-4 bg-focus/5 rounded-lg border border-focus/20">
                      <p className="text-sm font-medium text-muted-foreground">Total Focus Time</p>
                      <p className="text-3xl font-bold text-focus">{formatTime(dailyTimeSpent)}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Completed Items:</h4>
                    <ScrollArea className="h-[200px] pr-3">
                      <ul className="space-y-2">
                        {dailyTasks.map(task => (
                          <li key={task.id} className="space-y-1">
                            <div className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded-md">
                              <span className="truncate">{task.title}</span>
                              <Badge variant={
                                task.priority === "high" ? "destructive" :
                                task.priority === "medium" ? "default" : "secondary"
                              }>{task.priority}</Badge>
                            </div>
                            {task.subtasks && task.subtasks.some(s => s.timeSpent && s.timeSpent > 0) && (
                              <ul className="ml-4 space-y-1">
                                {task.subtasks.map((subtask, idx) => (
                                  subtask.timeSpent && subtask.timeSpent > 0 && (
                                    <li key={idx} className="flex items-center justify-between text-xs p-2 bg-primary/5 rounded-md border border-primary/20">
                                      <span className="truncate text-muted-foreground">
                                        <span className="font-medium">Subtask:</span> {subtask.title}
                                      </span>
                                      <Badge variant="secondary" className="ml-2 text-xs">
                                        {formatTime(subtask.timeSpent)}
                                      </Badge>
                                    </li>
                                  )
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                        {dailyCompletedSubtasks.map((item, idx) => (
                          <li key={`subtask-${idx}`} className="space-y-1">
                            <div className="flex items-center justify-between text-sm p-2 bg-success/10 rounded-md border border-success/30">
                              <div className="flex-1 truncate">
                                <div className="font-medium text-success">✓ Subtask: {item.subtask.title}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Parent: {item.parentTask.title} • Progress: {item.completionPercentage}%
                                </div>
                              </div>
                              {item.subtask.timeSpent && item.subtask.timeSpent > 0 && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {formatTime(item.subtask.timeSpent)}
                                </Badge>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <Separator />

      {/* Contribution Graph */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible" custom={2}>
        <ContributionGraph />
      </motion.div>

      <Separator />

      <h2 className="text-2xl font-bold text-center text-muted-foreground pt-4">Overall Statistics</h2>

      {/* Key Metrics */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          { label: "Total Tasks", value: totalTasks, icon: Target, color: "text-primary", bg: "bg-primary/10" },
          { label: "Completion Rate", value: `${completionRate}%`, icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
          { label: "Current Streak", value: currentStreak, icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10" },
          { label: "Best Streak", value: longestStreak, icon: Award, color: "text-purple-500", bg: "bg-purple-500/10" }
        ].map((item, i) => (
          <motion.div key={i} variants={itemVariants} custom={i}>
            <Card className="shadow-md hover:shadow-lg transition-shadow rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                  </div>
                  <div className={`h-12 w-12 ${item.bg} rounded-xl flex items-center justify-center`}>
                    <item.icon className={`h-6 w-6 ${item.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Task Breakdown + Priority */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <motion.div variants={itemVariants} custom={0}>
          <Card className="shadow-md rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Task Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "To Do", value: todoTasks, color: "bg-muted", percent: totalTasks > 0 ? Math.round((todoTasks / totalTasks) * 100) : 0 },
                { label: "In Progress", value: inProgressTasks, color: "bg-focus", percent: totalTasks > 0 ? Math.round((inProgressTasks / totalTasks) * 100) : 0 },
                { label: "Completed", value: completedTasks, color: "bg-success", percent: completionRate },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 ${s.color} rounded-full`} />
                    <span className="text-sm">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{s.value}</span>
                    <Badge variant="secondary">{s.percent}%</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} custom={1}>
          <Card className="shadow-md rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Priority Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "High Priority", value: highPriorityTasks, color: "bg-destructive", percent: totalTasks > 0 ? Math.round((highPriorityTasks / totalTasks) * 100) : 0, badge: "destructive" },
                { label: "Medium Priority", value: mediumPriorityTasks, color: "bg-break", percent: totalTasks > 0 ? Math.round((mediumPriorityTasks / totalTasks) * 100) : 0, badge: "secondary" },
                { label: "Low Priority", value: lowPriorityTasks, color: "bg-success", percent: totalTasks > 0 ? Math.round((lowPriorityTasks / totalTasks) * 100) : 0, badge: "secondary" },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 ${p.color} rounded-full`} />
                    <span className="text-sm">{p.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.value}</span>
                    <Badge variant={p.badge as any}>{p.percent}%</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}