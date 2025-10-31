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
import { Plus, Edit, Trash2, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlanForm } from "./PlanForm";
import { DeleteConfirmationDialog } from "@/components/common/DeleteConfirmationDialog";
import { usePlanner } from "@/contexts/PlannerContext";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks'; // <-- I've added this plugin
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

  const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed');
  const mediumPriorityTasks = tasks.filter(t => t.priority === 'medium' && t.status !== 'completed');
  const lowPriorityTasks = tasks.filter(t => t.priority === 'low' && t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

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
              <CardDescription className="truncate">
                {plan.shortDescription || (plan.description && plan.description.length > 50 
                  ? `${plan.description.substring(0, 50)}...` 
                  : plan.description) || "No description for this plan."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">{plan.status}</Badge>
              <Button variant="outline" size="sm" onClick={() => setIsPlanFormOpen(true)}><Edit className="h-3 w-3 mr-2" /> Edit</Button>
              <Button variant="destructive-outline" size="sm" onClick={() => setIsDeletePlanOpen(true)}><Trash2 className="h-3 w-3 mr-2" /> Delete</Button>
              <Button onClick={() => setIsTaskFormOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Task</Button>
            </div>
          </div>
        </CardHeader>
        <ScrollArea className="flex-1">
          <CardContent className="p-4 space-y-6">
            <Collapsible defaultOpen={true}>
              <CollapsibleTrigger className="w-full p-2 rounded-lg hover:bg-muted/50 group">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Plan Proposal</h3>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="animate-in fade-in-0 zoom-in-95">
                <div className="prose prose-sm dark:prose-invert max-w-none p-4 border rounded-lg bg-muted/20 mt-2">
                  {plan.description ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{plan.description}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground italic">No detailed proposal has been added to this plan yet.</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

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