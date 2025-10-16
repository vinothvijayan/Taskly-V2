// Touch gesture hooks for mobile interactions
import { useState, useRef, useEffect } from 'react';

export interface SwipeGestureConfig {
  threshold?: number;
  velocityThreshold?: number;
  preventDefaultTouchmoveEvent?: boolean;
  trackMouse?: boolean;
  ignoreTapFromInteractive?: boolean;
}

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
}

export function useSwipeGestures(
  handlers: SwipeHandlers,
  config: SwipeGestureConfig = {}
) {
  const {
    threshold = 100,
    velocityThreshold = 0.3,
    preventDefaultTouchmoveEvent = false,
    trackMouse = false,
    ignoreTapFromInteractive = true,
  } = config;

  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const startTarget = useRef<EventTarget | null>(null);
  const elementRef = useRef<HTMLElement>(null);

  const isInteractiveElement = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof Element)) return false;
    
    return !!target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"], [data-swipe-ignore]');
  };

  const handleStart = (clientX: number, clientY: number, target?: EventTarget) => {
    setStartPos({ x: clientX, y: clientY });
    setStartTime(Date.now());
    startTarget.current = target || null;
  };

  const handleEnd = (clientX: number, clientY: number) => {
    if (!startPos) return;

    const deltaX = clientX - startPos.x;
    const deltaY = clientY - startPos.y;
    const deltaTime = Date.now() - startTime;
    const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime;

    // Check for tap (small movement and quick)
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && deltaTime < 300) {
      // Only trigger tap if not started on an interactive element
      if (!ignoreTapFromInteractive || !isInteractiveElement(startTarget.current)) {
        handlers.onTap?.();
      }
      setStartPos(null);
      startTarget.current = null;
      return;
    }

    // Check for swipe gestures - trigger on distance OR velocity
    const hasDistanceThreshold = Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold;
    const hasVelocityThreshold = velocity > velocityThreshold;
    
    if (hasDistanceThreshold || hasVelocityThreshold) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) > threshold * 0.5) { // Lower threshold for more responsive swipes
          if (deltaX > 0) {
            handlers.onSwipeRight?.();
          } else {
            handlers.onSwipeLeft?.();
          }
        }
      } else {
        // Vertical swipe
        if (Math.abs(deltaY) > threshold * 0.5) {
          if (deltaY > 0) {
            handlers.onSwipeDown?.();
          } else {
            handlers.onSwipeUp?.();
          }
        }
      }
    }

    setStartPos(null);
    startTarget.current = null;
  };

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Touch events
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY, e.target);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (preventDefaultTouchmoveEvent) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      handleEnd(touch.clientX, touch.clientY);
    };

    // Mouse events (optional)
    const handleMouseDown = (e: MouseEvent) => {
      if (trackMouse) {
        handleStart(e.clientX, e.clientY, e.target);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (trackMouse) {
        handleEnd(e.clientX, e.clientY);
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefaultTouchmoveEvent });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    if (trackMouse) {
      element.addEventListener('mousedown', handleMouseDown);
      element.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      
      if (trackMouse) {
        element.removeEventListener('mousedown', handleMouseDown);
        element.removeEventListener('mouseup', handleMouseUp);
      }
    };
  }, [handlers, threshold, velocityThreshold, preventDefaultTouchmoveEvent, trackMouse, ignoreTapFromInteractive]);

  return elementRef;
}

// Pull to refresh hook
export function usePullToRefresh(onRefresh: () => Promise<void>, containerRef?: React.RefObject<HTMLElement>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const refreshThreshold = 80;

  const handleTouchStart = (e: TouchEvent) => {
    const container = containerRef?.current;
    const scrollTop = container ? container.scrollTop : window.scrollY;
    
    if (scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    const container = containerRef?.current;
    const scrollTop = container ? container.scrollTop : window.scrollY;
    
    if (scrollTop === 0 && !isRefreshing) {
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - startY.current);
      
      if (distance > 0) {
        e.preventDefault();
        setPullDistance(Math.min(distance, refreshThreshold * 1.5));
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= refreshThreshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  };

  useEffect(() => {
    const target = containerRef?.current || document;
    
    target.addEventListener('touchstart', handleTouchStart, { passive: true });
    target.addEventListener('touchmove', handleTouchMove, { passive: false });
    target.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      target.removeEventListener('touchstart', handleTouchStart);
      target.removeEventListener('touchmove', handleTouchMove);
      target.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, containerRef]);

  return {
    isRefreshing,
    pullDistance,
    progress: Math.min(pullDistance / refreshThreshold, 1)
  };
}

// Haptic feedback utility
export function useHapticFeedback() {
  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const impact = (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 50
    };
    vibrate(patterns[style]);
  };

  const notification = (type: 'success' | 'warning' | 'error' = 'success') => {
    const patterns = {
      success: [100, 50, 100],
      warning: [100, 100, 100],
      error: [200, 100, 200]
    };
    vibrate(patterns[type]);
  };

  const selection = () => {
    vibrate(10);
  };

  return {
    vibrate,
    impact,
    notification,
    selection
  };
}