import { ReactNode } from 'react';
import { useIntersectionObserver } from '@/hooks/usePerformance';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyLoaderProps {
  children: ReactNode;
  height?: number;
  className?: string;
  fallback?: ReactNode;
  threshold?: number;
  rootMargin?: string;
}

export function LazyLoader({ 
  children, 
  height = 200, 
  className,
  fallback,
  threshold = 0.1,
  rootMargin = '50px'
}: LazyLoaderProps) {
  const { elementRef, isIntersecting } = useIntersectionObserver({
    threshold,
    rootMargin
  });

  return (
    <div 
      ref={elementRef as any} 
      className={className}
      style={{ minHeight: isIntersecting ? 'auto' : height }}
    >
      {isIntersecting ? (
        children
      ) : (
        fallback || <Skeleton className="w-full h-full" style={{ height }} />
      )}
    </div>
  );
}

// Pre-built lazy components
export function LazyTaskList({ tasks, renderTask }: { 
  tasks: any[]; 
  renderTask: (task: any) => ReactNode; 
}) {
  return (
    <div className="space-y-3">
      {tasks.map((task, index) => (
        <LazyLoader 
          key={task.id} 
          height={120}
          threshold={0.1}
          rootMargin="100px"
        >
          {renderTask(task)}
        </LazyLoader>
      ))}
    </div>
  );
}

export function LazyChart({ children }: { children: ReactNode }) {
  return (
    <LazyLoader 
      height={300}
      threshold={0.2}
      fallback={
        <div className="w-full h-[300px] bg-muted rounded-lg animate-pulse flex items-center justify-center">
          <span className="text-muted-foreground">Loading chart...</span>
        </div>
      }
    >
      {children}
    </LazyLoader>
  );
}