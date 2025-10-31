import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePlanner } from "@/contexts/PlannerContext";
import { Plan } from "@/types";

interface PlanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: Plan;
}

export function PlanForm({ open, onOpenChange, plan }: PlanFormProps) {
  const { addPlan, updatePlan } = usePlanner();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Plan['status']>('Not Started');

  useEffect(() => {
    if (plan) {
      setTitle(plan.title);
      setDescription(plan.description || "");
      setStatus(plan.status);
    } else {
      setTitle("");
      setDescription("");
      setStatus("Not Started");
    }
  }, [plan, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const planData = { title, description, status };

    if (plan) {
      updatePlan(plan.id, planData);
    } else {
      addPlan(planData);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? "Edit Plan" : "Create New Plan"}</DialogTitle>
          <DialogDescription>
            {plan ? "Update the details for your team plan." : "Start a new plan for your team to collaborate on."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <Label htmlFor="plan-title">Title *</Label>
            <Input id="plan-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="plan-description">Description</Label>
            <Textarea id="plan-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="plan-status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as Plan['status'])}>
              <SelectTrigger id="plan-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Not Started">Not Started</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{plan ? "Save Changes" : "Create Plan"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}