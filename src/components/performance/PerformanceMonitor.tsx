import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePerformanceMonitor } from '@/hooks/usePerformance';

interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  loadTime: number;
  renderTime: number;
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    memoryUsage: 0,
    loadTime: 0,
    renderTime: 0
  });
  const [isVisible, setIsVisible] = useState(false);
  const { measurePerformance } = usePerformanceMonitor();

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV === 'development') {
      setIsVisible(true);
    }

    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrame: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        
        setMetrics(prev => ({
          ...prev,
          fps,
          loadTime: Math.round(performance.now()),
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
        }));
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      animationFrame = requestAnimationFrame(measureFPS);
    };

    if (isVisible) {
      animationFrame = requestAnimationFrame(measureFPS);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return 'bg-green-500';
    if (fps >= 45) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-64 bg-background/90 backdrop-blur-sm border shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">FPS:</span>
            <Badge 
              variant="outline" 
              className={`${getFPSColor(metrics.fps)} text-white border-none`}
            >
              {metrics.fps}
            </Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Memory:</span>
            <Badge variant="outline">
              {formatBytes(metrics.memoryUsage)}
            </Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Load:</span>
            <Badge variant="outline">
              {metrics.loadTime}ms
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}