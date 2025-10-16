import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Animation variants
const fadeInOut = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

const slideInOut = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 }
};

const scaleInOut = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

const slideUpDown = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

// Transition configurations
const defaultTransition = {
  duration: 0.2
};

const slowTransition = {
  duration: 0.3
};

interface AnimatedContainerProps {
  children: ReactNode;
  className?: string;
  variant?: 'fade' | 'slide' | 'scale' | 'slideUp';
  duration?: 'fast' | 'normal' | 'slow';
  delay?: number;
}

export function AnimatedContainer({ 
  children, 
  className, 
  variant = 'fade',
  duration = 'normal',
  delay = 0
}: AnimatedContainerProps) {
  const variants = {
    fade: fadeInOut,
    slide: slideInOut,
    scale: scaleInOut,
    slideUp: slideUpDown
  };

  const transitions = {
    fast: { duration: 0.15 },
    normal: defaultTransition,
    slow: slowTransition
  };

  return (
    <motion.div
      className={className}
      variants={variants[variant]}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ ...transitions[duration], delay }}
    >
      {children}
    </motion.div>
  );
}

interface StaggeredListProps {
  children: ReactNode[];
  className?: string;
  staggerDelay?: number;
}

export function StaggeredList({ children, className, staggerDelay = 0.1 }: StaggeredListProps) {
  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: staggerDelay
          }
        }
      }}
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          variants={fadeInOut}
          transition={defaultTransition}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        className={cn("w-full", className)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={defaultTransition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

interface SlideOverProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function SlideOver({ children, isOpen, onClose, className }: SlideOverProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={cn(
              "fixed top-0 right-0 h-full bg-background border-l shadow-lg z-50",
              className
            )}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={defaultTransition}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface FadeTransitionProps {
  show: boolean;
  children: ReactNode;
  className?: string;
}

export function FadeTransition({ show, children, className }: FadeTransitionProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={className}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={defaultTransition}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Layout animations
export function LayoutContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      layout
      className={className}
      transition={defaultTransition}
    >
      {children}
    </motion.div>
  );
}

// Hover animations
export function HoverScale({ children, className, scale = 1.02 }: { 
  children: ReactNode; 
  className?: string; 
  scale?: number;
}) {
  return (
    <motion.div
      className={className}
      whileHover={{ scale }}
      transition={defaultTransition}
    >
      {children}
    </motion.div>
  );
}

// Tap animations
export function TapScale({ children, className, scale = 0.98 }: { 
  children: ReactNode; 
  className?: string; 
  scale?: number;
}) {
  return (
    <motion.div
      className={className}
      whileTap={{ scale }}
      transition={defaultTransition}
    >
      {children}
    </motion.div>
  );
}