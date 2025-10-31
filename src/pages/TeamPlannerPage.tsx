import { useState, useMemo } from "react";
import { usePlanner } from "@/contexts/PlannerContext";
import { useTasks } from "@/contexts/TasksContext";
import { PlanList } from "@/components/planner/PlanList";
import { PlanDetailView } from "@/components/planner/PlanDetailView";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import { Plan } from "@/types";
import { ClipboardList, Loader2 } from "lucide-react";

export default function TeamPlannerPage() {
  const { plans, loading: plansLoading } = usePlanner();
  const { tasks, loading: tasksLoading } = useTasks();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const tasksForSelectedPlan = useMemo(() => {
    if (!selectedPlan) return [];
    return tasks.filter(task => task.planId === selectedPlan.id);
  }, [tasks, selectedPlan]);

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
  };

  if (plansLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={25} minSize={20}>
          <PlanList
            plans={plans}
            selectedPlan={selectedPlan}
            onSelectPlan={handleSelectPlan}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={75} minSize={30}>
          {selectedPlan ? (
            <PlanDetailView plan={selectedPlan} tasks={tasksForSelectedPlan} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
              <ClipboardList className="h-16 w-16 mb-4 opacity-30" />
              <h3 className="text-xl font-semibold">Select a Plan</h3>
              <p>Choose a plan from the left panel to view its tasks, or create a new one to get started.</p>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}