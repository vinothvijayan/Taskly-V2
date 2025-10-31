import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlannerTaskItem } from "./PlannerTaskItem";
import { TaskForm } from "@/components/tasks/TaskForm";
import { Plan, Task } from "@/types";
import { useTasks } from "@/contexts/TasksContext";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Edit, Trash2, ChevronDown, Bold, Heading2, Heading3, Heading4, List as ListIcon, Sparkles, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlanForm } from "./PlanForm";
import { DeleteConfirmationDialog } from "@/components/common/DeleteConfirmationDialog";
import { usePlanner } from "@/contexts/PlannerContext";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface PlanDetailViewProps {
  plan: Plan;
  tasks: Task[];
}

export function PlanDetailView({ plan, tasks }: PlanDetailViewProps) {
  const { addTask, updateTask, deleteTask, teamMembers } = useTasks();
  const { deletePlan, updatePlan } = usePlanner();
  const { user } = useAuth();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isPlanFormOpen, setIsPlanFormOpen] = useState(false);
  const [isDeletePlanOpen, setIsDeletePlanOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const { toast } = useToast();
  
  // State for inline editing the description
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(plan.description || "");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSaveDescription = () => {
    updatePlan(plan.id, { description: editedDescription });
    setIsEditingDescription(false);
  };

  const handleCancelEditDescription = () => {
    setEditedDescription(plan.description || "");
    setIsEditingDescription(false);
  };

  const handleEditDescriptionClick = () => {
    setEditedDescription(plan.description || "");
    setIsEditingDescription(true);
  };

  const handleEnhanceText = async () => {
    if (!editedDescription.trim()) {
      toast({ title: "Nothing to enhance", description: "Please write some text first.", variant: "destructive" });
      return;
    }
    setIsEnhancing(true);
    try {
      const GEMINI_API_KEY = "AIzaSyCugeQ0xzwciuQcWwIH14YB54EqVXgTX1Q";
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        You are an expert editor. Please proofread and reformat the following text to improve its clarity, grammar, and structure.
        - Ensure the output is clean, professional Markdown.
        - Correct any spelling or grammatical errors.
        - Organize the content logically with appropriate headings (like ## or ###) and bulleted lists (using -) if it improves readability.
        - Do not add any new information or change the core meaning of the text.
        - Return only the enhanced text, with no introductory phrases like "Here is the enhanced text:".

        Here is the text to enhance:
        ---
        ${editedDescription}
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      setEditedDescription(text);

      toast({ title: "Text Enhanced!", description: "Your proposal has been improved by AI." });
    } catch (error: any) {
      console.error("Error enhancing text with Gemini:", error);
      toast({ title: "Enhancement Failed", description: error.message || "An error occurred while contacting the AI.", variant: "destructive" });
    } finally {
      setIsEnhancing(false);
    }
  };

  const applyMarkdown = (syntax: 'bold' | 'h2' | 'h3' | 'h4' | 'list') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editedDescription.substring(start, end);
    let newText = '';
    let cursorOffset = 0;

    switch (syntax) {
      case 'bold':
        newText = `**${selectedText}**`;
        cursorOffset = 2;
        break;
      case 'h2':
        newText = `## ${selectedText}`;
        break;
      case 'h3':
        newText = `### ${selectedText}`;
        break;
      case 'h4':
        newText = `#### ${selectedText}`;
        break;
      case 'list':
        const lines = selectedText.split('\n');
        newText = lines.map(line => `- ${line}`).join('\n');
        break;
    }

    const updatedDescription = 
        editedDescription.substring(0, start) + 
        newText + 
        editedDescription.substring(end);
    
    setEditedDescription(updatedDescription);

    textarea.focus();
    setTimeout(() => {
      textarea.setSelectionRange(start + cursorOffset, end + cursorOffset + (newText.length - selectedText.length - (cursorOffset * 2)));
    }, 0);
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
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 group">
                <CollapsibleTrigger className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">Plan Proposal</h3>
                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </div>
                </CollapsibleTrigger>
                {!isEditingDescription && (
                  <Button variant="ghost" size="sm" onClick={handleEditDescriptionClick}>
                    <Edit className="h-3 w-3 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
              <CollapsibleContent className="animate-in fade-in-0 zoom-in-95">
                {isEditingDescription ? (
                  <div className="p-4 border-t space-y-2">
                    <TooltipProvider>
                      <div className="flex items-center gap-1 border rounded-md p-1 bg-background">
                        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" onClick={() => applyMarkdown('bold')}><Bold className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Bold</p></TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" onClick={() => applyMarkdown('h2')}><Heading2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Heading 2</p></TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" onClick={() => applyMarkdown('h3')}><Heading3 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Heading 3</p></TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" onClick={() => applyMarkdown('h4')}><Heading4 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Heading 4</p></TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" onClick={() => applyMarkdown('list')}><ListIcon className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Bullet List</p></TooltipContent></Tooltip>
                        <div className="border-l h-6 mx-2" />
                        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" onClick={handleEnhanceText} disabled={isEnhancing}>{isEnhancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-purple-500" />}</Button></TooltipTrigger><TooltipContent><p>Enhance with AI</p></TooltipContent></Tooltip>
                      </div>
                    </TooltipProvider>
                    <Textarea
                      ref={textareaRef}
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      rows={15}
                      className="mt-2 font-mono"
                      placeholder="Write your proposal here. Use the toolbar or Markdown syntax."
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <Button variant="ghost" onClick={handleCancelEditDescription}>Cancel</Button>
                      <Button onClick={handleSaveDescription}>Save Changes</Button>
                    </div>
                  </div>
                ) : (
                  <div className="prose dark:prose-invert max-w-none p-4 border-t rounded-lg bg-muted/20 mt-2">
                    {plan.description ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan.description}</ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground italic">No detailed proposal has been added to this plan yet.</p>
                    )}
                  </div>
                )}
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