import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlannerTaskItem } from "./PlannerTaskItem";
import { TaskForm } from "@/components/tasks/TaskForm";
import { Plan, Task } from "@/types";
import { useTasks } from "@/contexts/TasksContext";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Edit, Trash2, ChevronDown, CheckCircle2, ListTodo, Loader } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlanForm } from "./PlanForm";
import { DeleteConfirmationDialog } from "@/components/common/DeleteConfirmationDialog";
import { usePlanner } from "@/contexts/PlannerContext";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface PlanDetailViewProps {
  plan: Plan;
  tasks: Task[];
}

export function PlanDetailView({ plan, tasks }: PlanDetailViewProps) {
  const { addTask, updateTask, deleteTask, teamMembers } = useTasks();
  const { deletePlan } = usePlanner();
  const { user } = useAuth();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isPlanFormOpen, setIsPlanFormOpen] = useState(false);
  const [isDeletePlanOpen, setIsDeletePlanOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);

  const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed');
  const mediumPriorityTasks = tasks.filter(t => t.priority === 'medium' && t.status !== 'completed');
  const lowPriorityTasks = tasks.filter(t => t.priority === 'low' && t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const totalTasks = tasks.length;
  const completedTasksCount = completedTasks.length;
  const inProgressTasksCount = tasks.filter(t => t.status === 'in-progress').length;
  const todoTasksCount = tasks.filter(t => t.status === 'todo').length;
  const progress = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;

  const handleAddTask = (taskData: Omit<Task, "id" | "createdAt">) => {
    if (!user) return;
    addTask({ ...taskData, planId: plan.id, createdBy: user.uid });
    setIsTaskFormOpen(false);
  };

  const handleEditTask = (taskData: Omit<Task, "id" | "createdAt">) => {
    if (!taskToEdit) return;
    updateTask(taskToEdit.id, taskData);
    setTaskToEdit(null);
    setIsTaskFormOpen(false);
  };

  const openEditTaskForm = (task: Task) => {
    setTaskToEdit(task);
    setIsTaskFormOpen(true);
  };

  const handleDeletePlan = () => {
    deletePlan(plan.id);
    setIsDeletePlanOpen(false);
  };

  return (
    <>
      <div className="h-full flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{plan.title}</CardTitle>
              <CardDescription>
                <Badge variant="secondary" className="capitalize mt-1">{plan.status}</Badge>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsPlanFormOpen(true)}><Edit className="h-3 w-3 mr-2" /> Edit</Button>
              <Button variant="destructive-outline" size="sm" onClick={() => setIsDeletePlanOpen(true)}><Trash2 className="h-3 w-3 mr-2" /> Delete</Button>
              <Button onClick={() => setIsTaskFormOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Task</Button>
            </div>
          </div>
        </CardHeader>

        <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen} className="border-b p-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between px-2 text-muted-foreground hover:text-foreground">
              <span className="font-semibold">Plan Details</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", isDetailsOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4 animate-in fade-in-0 zoom-in-95">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm font-bold">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">To Do</p>
                <p className="text-lg font-bold flex items-center justify-center gap-2"><ListTodo className="h-4 w-4" /> {todoTasksCount}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">In Progress</p>
                <p className="text-lg font-bold flex items-center justify-center gap-2"><Loader className="h-4 w-4" /> {inProgressTasksCount}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-lg font-bold flex items-center justify-center gap-2"><CheckCircle2 className="h-4 w-4" /> {completedTasksCount}</p>
              </div>
            </div>
            {plan.description && (
              <div>
                <h4 className="text-sm font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg border">{plan.description}</p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        <ScrollArea className="flex-1">
          <CardContent className="p-4 space-y-6">
            {tasks.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <h3 className="text-lg font-semibold">No tasks in this plan yet.</h3>
                <p>Click "Add Task" to get started.</p>
              </div>
            )}
            
            {highPriorityTasks.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-destructive">High Priority</h3>
                <div className="space-y-2">
                  {highPriorityTasks.map(task => <PlannerTaskItem key={task.id} task={task} onEdit={openEditTaskForm} />)}
                </div>
              </div>
            )}
            
            {mediumPriorityTasks.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-primary">Medium Priority</h3>
                <div className="space-y-2">
                  {mediumPriorityTasks.map(task => <PlannerTaskItem key={task.id} task={task} onEdit={openEditTaskForm} />)}
                </div>
              </div>
            )}

            {lowPriorityTasks.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-muted-foreground">Low Priority</h3>
                <div className="space-y-2">
                  {lowPriorityTasks.map(task => <PlannerTaskItem key={task.id} task={task} onEdit={openEditTaskForm} />)}
                </div>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-green-600">Completed</h3>
                <div className="space-y-2">
                  {completedTasks.map(task => <PlannerTaskItem key={task.id} task={task} onEdit={openEditTaskForm} />)}
                </div>
              </div>
            )}
          </CardContent>
        </ScrollArea>
      </div>

      <Dialog open={isTaskFormOpen} onOpenChange={(open) => { if (!open) { setIsTaskFormOpen(false); setTaskToEdit(null); }}}>
        <DialogContent className="sm:max-w-[500px] p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>{taskToEdit ? "Edit Task" : "Add New Task"}</DialogTitle>
          </DialogHeader>
          <TaskForm
            task={taskToEdit || undefined}
            onSubmit={taskToEdit ? handleEditTask : handleAddTask}
            onCancel={() => { setIsTaskFormOpen(false); setTaskToEdit(null); }}
            teamMembers={teamMembers}
          />
        </DialogContent>
      </Dialog>

      <PlanForm open={isPlanFormOpen} onOpenChange={setIsPlanFormOpen} plan={plan} />

      <DeleteConfirmationDialog
        open={isDeletePlanOpen}
        onOpenChange={setIsDeletePlanOpen}
        onConfirm={handleDeletePlan}
        title="Delete Plan"
        itemName={plan.title}
        description="Are you sure you want to delete this plan? This will not delete the tasks within it."
      />
    </>
  );
}