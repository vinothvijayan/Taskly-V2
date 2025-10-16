import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { TeamMemberSelector } from "@/components/common/TeamMemberSelector"
import { Task, UserProfile } from "@/types"

interface TaskFormProps {
  task?: Task
  onSubmit: (taskData: Omit<Task, "id" | "createdAt">) => void
  onCancel: () => void
  teamMembers: UserProfile[]
}

export function TaskForm({ task, onSubmit, onCancel, teamMembers }: TaskFormProps) {
  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    priority: task?.priority || "medium" as Task["priority"],
    status: task?.status || "todo" as Task["status"],
    estimatedTime: task?.estimatedTime?.toString() || "",
    dueDate: task?.dueDate || "",
    assignedTo: task?.assignedTo || [],
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      estimatedTime: formData.estimatedTime ? parseInt(formData.estimatedTime, 10) : undefined,
      assignedTo: formData.assignedTo,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      <div>
        <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Enter task title"
          className="mt-2 transition-smooth focus:ring-2 focus:ring-primary/20"
          required
        />
      </div>

      <div>
        <Label htmlFor="description" className="text-sm font-medium">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Enter task description"
          className="mt-2 transition-smooth focus:ring-2 focus:ring-primary/20"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="priority" className="text-sm font-medium">Priority</Label>
          <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value as Task["priority"] })}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="status" className="text-sm font-medium">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as Task["status"] })}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="estimatedTime" className="text-sm font-medium">Estimated Time (minutes)</Label>
          <Input
            id="estimatedTime"
            type="number"
            value={formData.estimatedTime}
            onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })}
            placeholder="25"
            className="mt-2 transition-smooth focus:ring-2 focus:ring-primary/20"
            min="1"
          />
        </div>

        <div>
          <Label htmlFor="dueDate" className="text-sm font-medium">Due Date</Label>
          <Input
            id="dueDate"
            type="datetime-local"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            className="mt-2 transition-smooth focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {teamMembers.length > 0 && (
        <div>
          <TeamMemberSelector
            members={teamMembers}
            selectedIds={formData.assignedTo}
            onSelectionChange={(ids) => setFormData({ ...formData, assignedTo: ids })}
          />
        </div>
      )}

      <div className="flex gap-3 pt-6 border-t">
        <Button type="submit" variant="focus" className="flex-1">
          {task ? "Update Task" : "Create Task"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="hover-scale">
          Cancel
        </Button>
      </div>
    </form>
  )
}