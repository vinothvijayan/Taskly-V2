import React from 'react';
import { Clock } from 'lucide-react';

const CompletedTasksSection: React.FC = () => {
  return (
    <div className="p-4 border rounded-lg bg-card shadow-sm h-full">
      <div className="flex items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Clock className="h-5 w-5 mr-2 text-green-500" />
          Completed <span className="ml-2 text-sm font-normal text-muted-foreground">(8)</span>
        </h2>
      </div>
      
      {/* Placeholder for completed task items */}
      <div className="space-y-3">
        {[4, 5].map(i => (
          <div key={i} className="p-3 border rounded-md bg-background opacity-70">
            <p className="font-medium line-through text-muted-foreground">Completed Task Item {i}: Meet with client</p>
            <div className="text-sm text-muted-foreground mt-1">
              <span>📅 Oct 23</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompletedTasksSection;