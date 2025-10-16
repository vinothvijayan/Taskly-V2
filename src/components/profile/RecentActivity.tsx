import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTasks } from '@/contexts/TasksContext';
import { CheckCircle2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function RecentActivity() {
  const { tasks } = useTasks();

  const completedTasks = useMemo(() => {
    return tasks
      .filter(task => task.status === 'completed' && typeof task.completedAt === 'string') // Ensure completedAt is a string
      .sort((a, b) => {
        // This sort is now safe because of the filter above
        return new Date(b.completedAt as string).getTime() - new Date(a.completedAt as string).getTime();
      })
      .slice(0, 5);
  }, [tasks]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {completedTasks.length > 0 ? (
          <ul className="space-y-4">
            {completedTasks.map(task => (
              <li key={task.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Clock className="mr-1.5 h-3 w-3" />
                    {/* Also ensure completedAt is a string before using it here */}
                    {typeof task.completedAt === 'string' &&
                      formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent completed tasks.
          </p>
        )}
      </CardContent>
    </Card>
  );
}