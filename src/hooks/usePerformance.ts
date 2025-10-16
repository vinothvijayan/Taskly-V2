import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Virtual scrolling hook for large lists
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop.current / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length
    );

    return {
      startIndex: Math.max(0, startIndex - overscan),
      endIndex,
      items: items.slice(
        Math.max(0, startIndex - overscan),
        endIndex
      ),
      totalHeight: items.length * itemHeight,
      offsetY: Math.max(0, startIndex - overscan) * itemHeight
    };
  }, [items, itemHeight, containerHeight, overscan]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    scrollTop.current = e.currentTarget.scrollTop;
  }, []);

  return {
    scrollElementRef,
    visibleItems,
    handleScroll
  };
}

// Debounced value hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Performance monitoring hook
export function usePerformanceMonitor() {
  const startTime = useRef<number>(Date.now());
  const renderCount = useRef<number>(0);

  useEffect(() => {
    renderCount.current += 1;
  });

  const logRenderTime = useCallback((componentName: string) => {
    const endTime = Date.now();
    const renderTime = endTime - startTime.current;
    
    if (renderTime > 16) { // Log if render takes longer than 16ms (60fps threshold)
      console.warn(`${componentName} render time: ${renderTime}ms (render #${renderCount.current})`);
    }
    
    startTime.current = endTime;
  }, []);

  const measurePerformance = useCallback((fn: () => void, label: string) => {
    const start = performance.now();
    fn();
    const end = performance.now();
    console.log(`${label} took ${end - start} milliseconds`);
  }, []);

  return {
    logRenderTime,
    measurePerformance,
    renderCount: renderCount.current
  };
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const elementRef = useRef<Element>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the element is intersecting, update state and unobserve
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.unobserve(element);
        }
      },
      options
    );

    observer.observe(element);

    return () => {
      // Make sure to unobserve on cleanup
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [options.root, options.rootMargin, options.threshold]); // Use primitives as deps

  return {
    elementRef,
    isIntersecting,
  };
}


// Memory usage tracking
export function useMemoryUsage() {
  const [memoryInfo, setMemoryInfo] = useState<any>(null);

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        setMemoryInfo((performance as any).memory);
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
}

// Memoization helper
export function useMemoizedCallback<T extends (...args: any[]) => any>(
  fn: T,
  deps: React.DependencyList
): T {
  return useCallback(fn, deps);
}

// Throttled function hook
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  const lastCall = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastCall.current >= delay) {
        lastCall.current = now;
        return fn(...args);
      } else {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          lastCall.current = Date.now();
          fn(...args);
        }, delay - (now - lastCall.current));
      }
    }) as T,
    [fn, delay]
  );
}