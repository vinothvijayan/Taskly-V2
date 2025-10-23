import React from 'react';
import { CheckSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ActiveTasksSection: React.FC = () => {
  return (
    <div className="p-4 border rounded-lg bg-card shadow-sm h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <CheckSquare className="h-5 w-5 mr-2 text-primary" />
          Active Tasks <span className="ml-2 text-sm font-normal text-muted-foreground">(14)</span>
        </h2>
        <Button variant="ghost" size="sm" className="text-sm">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      
      {/* Placeholder for task items */}
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-3 border rounded-md bg-background hover:bg-accent transition-colors">
            <p className="font-medium">Task Item {i}: Check posters for hype loop screems</p>
            <div className="text-sm text-muted-foreground mt-1">
              <span className="mr-3">🕒 0m</span>
              <span>✓ Subtasks (2)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActiveTasksSection;