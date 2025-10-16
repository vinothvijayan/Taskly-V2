import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTasks } from '@/contexts/TasksContext';
import { cn } from '@/lib/utils';

export const ContributionGraph: React.FC = () => {
  const { tasks, getTasksCompletedOnDate } = useTasks();

  // Get completed tasks from the last year
  const completedTasks = tasks.filter(task => task.status === 'completed');
  const totalCompleted = completedTasks.length;

  // Generate contribution grid based on actual task completion data
  const generateContributionData = () => {
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    oneYearAgo.setDate(oneYearAgo.getDate() + 1); // Start from exactly one year ago
    
    // Find the Sunday that starts the week containing one year ago
    const startDate = new Date(oneYearAgo);
    const dayOfWeek = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    startDate.setDate(startDate.getDate() - dayOfWeek);
    
    const grid = [];
    const monthLabels = [];
    let currentMonth = -1;
    
    // Generate 53 weeks of data
    for (let week = 0; week < 53; week++) {
      const weekData = [];
      
      for (let day = 0; day < 7; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + (week * 7) + day);
        
        // Check if we've entered a new month and it's the first day of the week (Sunday)
        if (day === 0 && currentDate.getMonth() !== currentMonth) {
          currentMonth = currentDate.getMonth();
          monthLabels.push({
            month: currentDate.toLocaleDateString('en-US', { month: 'short' }),
            weekIndex: week
          });
        }
        
        // Only show data for dates up to today
        if (currentDate <= today && currentDate >= oneYearAgo) {
          const completedTasksOnDate = getTasksCompletedOnDate(currentDate);
          const taskCount = completedTasksOnDate.length;
          
          // Map task count to activity level (0-4)
          let activityLevel = 0;
          if (taskCount >= 5) activityLevel = 4;
          else if (taskCount >= 3) activityLevel = 3;
          else if (taskCount >= 2) activityLevel = 2;
          else if (taskCount >= 1) activityLevel = 1;
          
          weekData.push({
            level: activityLevel,
            count: taskCount,
            date: currentDate.toISOString().split('T')[0]
          });
        } else {
          // Future dates or dates before our range have no activity
          weekData.push({
            level: 0,
            count: 0,
            date: currentDate.toISOString().split('T')[0]
          });
        }
      }
      grid.push(weekData);
    }
    
    return { grid, monthLabels };
  };

  const { grid: contributionGrid, monthLabels } = generateContributionData();

  const getActivityColor = (level: number) => {
    switch (level) {
    case 0: return 'bg-[#F3F3F3] dark:bg-[#161B22]';
    case 1: return 'bg-[#9be9a8] dark:bg-[#0e4429]';
    case 2: return 'bg-[#40c463] dark:bg-[#006d32]';
    case 3: return 'bg-[#30a14e] dark:bg-[#26a641]';
    case 4: return 'bg-[#216e39] dark:bg-[#39d353]';
    

      default: return 'bg-muted/30 dark:bg-muted/20';
    }
  };

  const getTooltipText = (dayData: { level: number; count: number; date: string }) => {
    const date = new Date(dayData.date);
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    if (dayData.count === 0) {
      return `No tasks completed on ${formattedDate}`;
    } else if (dayData.count === 1) {
      return `1 task completed on ${formattedDate}`;
    } else {
      return `${dayData.count} tasks completed on ${formattedDate}`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-lg"></span>
          
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          <span className="text-2xl font-bold text-primary">{totalCompleted}</span> tasks completed in the last year
          <br />
          Your productivity journey visualized
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Year indicator */}
          <div className="flex justify-end">
            <span className="text-2xl font-bold text-primary">2025</span>
          </div>

          {/* Contribution grid with month labels */}
          <div className="relative">
            {/* Month labels positioned above the grid */}
            <div className="relative h-4 mb-2 hidden sm:block">
              {monthLabels.map((monthLabel, index) => (
                <div
                  key={index}
                  className="absolute text-xs text-muted-foreground"
                  style={{
                    left: `${monthLabel.weekIndex * 16 + 32}px`, // 16px per week + 32px offset for day labels
                  }}
                >
                  {monthLabel.month}
                </div>
              ))}
            </div>

            {/* Grid container - responsive sizing */}
            <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
              {/* Day labels - hide on very small screens */}
              <div className="hidden sm:flex flex-col gap-1 text-xs text-muted-foreground w-8 shrink-0">
                <div className="h-3"></div>
                <div>Mon</div>
                <div className="h-3"></div>
                <div>Wed</div>
                <div className="h-3"></div>
                <div>Fri</div>
                <div className="h-3"></div>
              </div>
              
              {/* Contribution squares - responsive sizing */}
              <div className="flex gap-[2px] min-w-max">
                {contributionGrid.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {week.map((dayData, dayIndex) => (
                      <div
                        key={dayIndex}
                        className={cn(
                          "cursor-pointer rounded-[4px]",
                          "w-3 h-3 sm:w-3.5 sm:h-3.5", // slightly bigger for readability
                          "hover:ring-1 hover:ring-primary/50 touch-manipulation",
                          getActivityColor(dayData.level)
                        )}
                        title={getTooltipText(dayData)}
                        onClick={() => {
                          // Mobile friendly tooltip alternative
                          if (window.innerWidth < 640) {
                            alert(getTooltipText(dayData));
                          }
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile month indicators */}
            <div className="sm:hidden mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{monthLabels[0]?.month || 'Jan'}</span>
              <span>{monthLabels[Math.floor(monthLabels.length / 2)]?.month || 'Jun'}</span>
              <span>{monthLabels[monthLabels.length - 1]?.month || 'Dec'}</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Learn how we count contributions</span>
            <div className="flex items-center gap-1">
              <span>Less</span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`w-3 h-3 rounded-[4px] ${getActivityColor(level)}`}
                  />
                ))}
              </div>
              <span>More</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};