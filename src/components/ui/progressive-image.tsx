import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  lowQualitySrc?: string;
  className?: string;
  containerClassName?: string;
  blur?: boolean;
}

export function ProgressiveImage({ 
  src, 
  alt, 
  lowQualitySrc,
  className,
  containerClassName,
  blur = true,
  ...props 
}: ProgressiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-hidden", containerClassName)}
    >
      {/* Low quality placeholder */}
      {lowQualitySrc && isInView && !isLoaded && (
        <img
          src={lowQualitySrc}
          alt={alt}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            blur && "blur-sm scale-110",
            className
          )}
        />
      )}

      {/* Loading skeleton */}
      {!isInView && (
        <Skeleton className="w-full h-full absolute inset-0" />
      )}

      {/* High quality image */}
      {isInView && (
        <img
          ref={imgRef}
          src={hasError ? '/placeholder.svg' : src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-500",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          {...props}
        />
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-xs text-muted-foreground">Failed to load</span>
        </div>
      )}
    </div>
  );
}