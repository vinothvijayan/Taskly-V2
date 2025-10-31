import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlanForm } from "./PlanForm";
import { Plan } from "@/types";
import { Plus, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTasks } from "@/contexts/TasksContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PlanListProps {
  plans: Plan[];
  selectedPlan: Plan | null;
  onSelectPlan: (plan: Plan) => void;
}

export function PlanList({ plans, selectedPlan, onSelectPlan }: PlanListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { teamMembers } = useTasks();

  const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '';

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
              {plans.map(plan => {
                const creator = teamMembers.find(member => member.uid === plan.createdBy);
                return (
                  <div
                    key={plan.id}
                    onClick={() => onSelectPlan(plan)}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-colors",
                      selectedPlan?.id === plan.id ? "bg-primary/10" : "hover:bg-muted/50"
                    )}
                  >
                    <h4 className="font-medium text-sm truncate">{plan.title}</h4>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground capitalize">{plan.status}</p>
                      {creator && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={creator.photoURL} />
                                <AvatarFallback className="text-xs">{getInitials(creator.displayName)}</AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Created by {creator.displayName}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <PlanForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </>
  );
}