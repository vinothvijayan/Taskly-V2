import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Info, Puzzle, Star, CalendarCheck2, Flame, GitFork } from "lucide-react";
import { cn } from "@/lib/utils";

const RuleSection = ({ icon: Icon, title, description, children }: { icon: React.ElementType, title: string, description: string, children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-3">
      <div className="bg-primary/10 p-2 rounded-lg">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="pl-12 space-y-2">{children}</div>
  </div>
);

const RuleItem = ({ label, value, color }: { label: string, value: string, color?: "green" | "red" | "blue" }) => (
  <div className="flex justify-between items-center text-sm">
    <span>{label}</span>
    <Badge variant="secondary" className={cn(
      color === "green" && "text-green-600 bg-green-100 border-green-200",
      color === "red" && "text-red-600 bg-red-100 border-red-200",
      color === "blue" && "text-blue-600 bg-blue-100 border-blue-200",
    )}>{value}</Badge>
  </div>
);

export function ScoringRulesModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-accent">
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            How Scoring Works
          </DialogTitle>
          <DialogDescription>
            Your score is calculated based on task complexity, priority, timeliness, and streaks.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            <RuleSection icon={Puzzle} title="Task Complexity" description="Points based on estimated time.">
              <RuleItem label="Simple (< 30m)" value="+10 pts" />
              <RuleItem label="Standard (30-90m)" value="+20 pts" />
              <RuleItem label="Complex (> 90m)" value="+30 pts" />
            </RuleSection>

            <RuleSection icon={Star} title="Priority Bonus" description="A multiplier applied to the base score.">
              <RuleItem label="High Priority" value="x 1.5" color="red" />
              <RuleItem label="Medium Priority" value="x 1.0" />
              <RuleItem label="Low Priority" value="x 0.75" />
            </RuleSection>

            <RuleSection icon={CalendarCheck2} title="Timeliness Factor" description="Bonuses for early completion, penalties for being late.">
              <RuleItem label="Early Bird (> 24h early)" value="+20%" color="green" />
              <RuleItem label="On Track (< 24h early)" value="+10%" color="green" />
              <RuleItem label="On Time (Due day)" value="+0%" />
              <RuleItem label="Slightly Late (< 24h late)" value="-25%" color="red" />
              <RuleItem label="Delayed (1-3 days late)" value="-50%" color="red" />
              <RuleItem label="Overdue (> 3 days late)" value="0 pts" color="red" />
            </RuleSection>

            <RuleSection icon={Flame} title="Daily Streak Bonus" description="Complete tasks on consecutive days for a score multiplier.">
              <RuleItem label="Warm-up (2-3 days)" value="+5%" color="blue" />
              <RuleItem label="In the Zone (4-6 days)" value="+10%" color="blue" />
              <RuleItem label="On Fire (7+ days)" value="+20%" color="blue" />
            </RuleSection>

            <RuleSection icon={GitFork} title="Progressive Tasks" description="Earn credit for making progress on larger tasks.">
              <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-2">
                <li>
                  <strong>Partial Credit:</strong> Incomplete tasks earn points based on the percentage of subtasks you've finished.
                </li>
                <li>
                  <strong>Proportional Score:</strong> Completed tasks with subtasks get a final score proportional to how many subtasks were also completed.
                </li>
              </ul>
            </RuleSection>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}