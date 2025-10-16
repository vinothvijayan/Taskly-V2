import React, { useState, useEffect, useRef } from 'react';
import { useComments } from '@/contexts/CommentsContext';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface TaskCommentsProps {
  taskId: string;
  className?: string;
  isExpanded: boolean; // Now controls content visibility, not component mounting
  onToggleExpanded: () => void; // Still used for the parent's state
}

export function TaskComments({ taskId, className, isExpanded, onToggleExpanded }: TaskCommentsProps) {
  const { 
    comments, 
    commentCounts, 
    loading, 
    subscribeToTaskComments, 
    unsubscribeFromTaskComments 
  } = useComments();
  
  const [showCommentForm, setShowCommentForm] = useState(false);
  
  // A ref to manage the unsubscribe timer, preventing re-renders
  const unsubscribeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const taskComments = comments[taskId] || [];
  const commentCount = commentCounts[taskId] || 0;
  // Only show the main "Loading..." text on the very first fetch
  const isLoading = loading[taskId] === true && taskComments.length === 0;

  // Proactive Subscription: This useEffect will now always run when TaskComments is mounted.
  useEffect(() => {
    // When the component mounts or the taskId changes, clear any pending unsubscription plan.
    if (unsubscribeTimerRef.current) {
      clearTimeout(unsubscribeTimerRef.current);
    }
    
    // Subscribe to comments for this task.
    const unsubscribe = subscribeToTaskComments(taskId);
    
    // When the component unmounts, perform a final cleanup.
    return () => {
      if (unsubscribe) {
        unsubscribeFromTaskComments(taskId);
      }
    };
  }, [taskId, subscribeToTaskComments, unsubscribeFromTaskComments]);
  
  // Delayed Unsubscription: This prevents re-fetching if the user quickly toggles the comment section.
  useEffect(() => {
    if (isExpanded) {
      // If the user expands the comments, cancel any pending plan to unsubscribe.
      if (unsubscribeTimerRef.current) {
        clearTimeout(unsubscribeTimerRef.current);
        unsubscribeTimerRef.current = null;
      }
    } else {
      // If the user collapses the comments, plan to unsubscribe in 30 seconds.
      // If they re-open within that time, the plan will be cancelled.
      unsubscribeTimerRef.current = setTimeout(() => {
        unsubscribeFromTaskComments(taskId);
      }, 30000); // 30 seconds
    }
  }, [isExpanded, taskId, unsubscribeFromTaskComments]);

  const handleCommentAdded = () => {
    setShowCommentForm(false); // Hide form after successful submission
  };

  return (
    <div className={cn("w-full pt-0", className)}>
      {/* Animated Content Section */}
      <AnimatePresence initial={false}>
        {isExpanded && ( // This now controls the visibility of the content within the mounted component
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
            className="overflow-hidden"
          >
            <Card className="mt-1 border-none shadow-none bg-transparent">
              <CardContent className="py-1 px-2 space-y-3"> {/* Changed p-0 to py-1 px-2 */}
                {/* Add Comment Button or Form */}
                {!showCommentForm ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowCommentForm(true)}
                    className="w-full justify-start text-muted-foreground h-9 rounded-md border-dashed hover:border-primary/50 hover:text-primary transition-colors"
                    size="sm"
                  >
                    <MessageCircle className="h-3 w-3 mr-2" />
                    Write a comment...
                  </Button>
                ) : (
                  <CommentForm
                    taskId={taskId}
                    onCommentAdded={handleCommentAdded}
                    onCancel={() => setShowCommentForm(false)}
                  />
                )}

                {/* Loading State or Comments List */}
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading comments...</span>
                  </div>
                ) : (
                  taskComments.length > 0 && (
                    <div className="space-y-3 border-t border-border/50 pt-2"> {/* Changed pt-3 to pt-2 */}
                      {taskComments.map((comment) => (
                        <CommentItem key={comment.id} comment={comment} />
                      ))}
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}