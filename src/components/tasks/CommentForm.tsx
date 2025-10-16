import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useComments } from '@/contexts/CommentsContext';
import { Send, X } from 'lucide-react';

interface CommentFormProps {
  taskId: string;
  initialContent?: string;
  isEditing?: boolean;
  commentId?: string;
  onCommentAdded?: () => void;
  onCancel?: () => void;
}

export function CommentForm({ 
  taskId, 
  initialContent = '', 
  isEditing = false, 
  commentId,
  onCommentAdded,
  onCancel 
}: CommentFormProps) {
  const { addComment, updateComment } = useComments();
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxLength = 1000;
  const remainingChars = maxLength - content.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isEditing && commentId) {
        await updateComment(commentId, taskId, content);
      } else {
        await addComment(taskId, content);
      }
      
      setContent('');
      onCommentAdded?.();
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === 'Escape') {
      onCancel?.();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment... (Ctrl+Enter to submit)"
          className="min-h-[80px] resize-none pr-16"
          maxLength={maxLength}
          autoFocus
        />
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          {remainingChars}
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">

        </div>
        
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
          
          <Button
            type="submit"
            size="sm"
            disabled={!content.trim() || isSubmitting || remainingChars < 0}
          >
            <Send className="h-4 w-4 mr-1" />
            {isSubmitting ? 'Posting...' : isEditing ? 'Update' : 'Comment'}
          </Button>
        </div>
      </div>
    </form>
  );
}
