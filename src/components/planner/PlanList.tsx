import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlanForm } from "./PlanForm";
import { Plan } from "@/types";
import { Plus, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanListProps {
  plans: Plan[];
  selectedPlan: Plan | null;
  onSelectPlan: (plan: Plan) => void;
}

export function PlanList({ plans, selectedPlan, onSelectPlan }: PlanListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <>
      <Card className="h-full flex flex-col border-0 shadow-none rounded-none">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Team Plans
            </CardTitle>
            <Button size="icon" variant="ghost" onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {plans.map(plan => (
                <div
                  key={plan.id}
                  onClick={() => onSelectPlan(plan)}
                  className={cn(
                    "p-3 rounded-lg cursor-pointer transition-colors",
                    selectedPlan?.id === plan.id ? "bg-primary/10" : "hover:bg-muted/50"
                  )}
                >
                  <h4 className="font-medium text-sm truncate">{plan.title}</h4>
                  <p className="text-xs text-muted-foreground capitalize">{plan.status}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <PlanForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </>
  );
}