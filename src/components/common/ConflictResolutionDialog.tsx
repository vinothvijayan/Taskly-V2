// Dialog for resolving sync conflicts
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { AlertTriangle, Clock, User } from 'lucide-react';
import { OfflineTask } from '../../lib/indexedDB';
import { useOfflineSync } from '../../hooks/useOfflineSync';

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: { tasks: OfflineTask[]; notes: any[] };
}

export function ConflictResolutionDialog({ 
  open, 
  onOpenChange, 
  conflicts 
}: ConflictResolutionDialogProps) {
  const { resolveConflict } = useOfflineSync();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolveConflict = async (taskId: string, useLocal: boolean) => {
    setResolvingId(taskId);
    try {
      await resolveConflict(taskId, useLocal);
      // Remove resolved conflict from list
      conflicts.tasks = conflicts.tasks.filter(task => task.id !== taskId);
      
      // Close dialog if no more conflicts
      if (conflicts.tasks.length === 0 && conflicts.notes.length === 0) {
        onOpenChange(false);
      }
    } finally {
      setResolvingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Sync Conflicts Detected
          </DialogTitle>
          <DialogDescription>
            The following items have conflicts between your local changes and server data. 
            Choose which version to keep.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {conflicts.tasks.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Task Conflicts</h3>
              <div className="space-y-3">
                {conflicts.tasks.map((task) => (
                  <Card key={task.id} className="border-warning/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{task.title}</CardTitle>
                        <Badge variant="outline" className="text-warning border-warning">
                          Conflict
                        </Badge>
                      </div>
                      {task.description && (
                        <CardDescription>{task.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Local Version */}
                        <div className="p-3 border rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4" />
                            <span className="font-medium">Your Changes</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Status:</span>
                              <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                                {task.status}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Priority:</span>
                              <Badge variant={task.priority === 'high' ? 'destructive' : 'outline'}>
                                {task.priority}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Modified: {formatDate(new Date(task.lastModified).toISOString())}</span>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleResolveConflict(task.id, true)}
                            disabled={resolvingId === task.id}
                            className="w-full mt-3"
                            variant="outline"
                          >
                            {resolvingId === task.id ? 'Resolving...' : 'Keep My Changes'}
                          </Button>
                        </div>

                        {/* Server Version Placeholder */}
                        <div className="p-3 border rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="font-medium">Server Version</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="text-muted-foreground">
                              Server data would be displayed here in a real implementation
                            </div>
                          </div>
                          <Button
                            onClick={() => handleResolveConflict(task.id, false)}
                            disabled={resolvingId === task.id}
                            className="w-full mt-3"
                            variant="outline"
                          >
                            {resolvingId === task.id ? 'Resolving...' : 'Use Server Version'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {conflicts.notes.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Note Conflicts</h3>
              <div className="text-muted-foreground">
                Note conflict resolution would be implemented here
              </div>
            </div>
          )}

          {conflicts.tasks.length === 0 && conflicts.notes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No conflicts to resolve</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}