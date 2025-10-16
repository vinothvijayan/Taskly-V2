// Pull-to-refresh component for mobile task lists
import { ReactNode, useRef } from 'react';
import { usePullToRefresh } from '../../hooks/useTouchGestures';
import { RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isRefreshing, pullDistance, progress } = usePullToRefresh(onRefresh, containerRef);

  return (
    <div 
      ref={containerRef}
      className={cn("relative h-full touch-pan-y", className)}
    >
      {/* Pull indicator */}
      <div 
        className={cn(
          "absolute top-0 left-0 right-0 flex items-center justify-center transition-transform duration-200 bg-background/80 backdrop-blur-sm border-b z-10",
          pullDistance > 0 ? "translate-y-0" : "-translate-y-full"
        )}
        style={{ 
          height: `${Math.min(pullDistance, 80)}px`,
          transform: `translateY(${Math.min(pullDistance - 80, 0)}px)`
        }}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw 
            className={cn(
              "h-4 w-4 transition-transform",
              isRefreshing && "animate-spin",
              progress >= 1 && !isRefreshing && "text-primary"
            )}
            style={{ 
              transform: `rotate(${progress * 180}deg)` 
            }}
          />
          <span>
            {isRefreshing 
              ? "Refreshing..." 
              : progress >= 1 
                ? "Release to refresh" 
                : "Pull to refresh"
            }
          </span>
        </div>
      </div>

      {/* Content with padding to account for pull indicator */}
      <div 
        className="h-full overflow-y-auto"
        style={{ 
          transform: `translateY(${Math.min(pullDistance, 80)}px)`,
          transition: pullDistance === 0 ? 'transform 0.2s ease-out' : 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
}