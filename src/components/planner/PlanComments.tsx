import { useState, useEffect, useMemo, useRef } from 'react';
import { usePlanComments } from '@/contexts/PlanCommentsContext';
import { PlanComment } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, Send, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Separator } from '@/components/ui/separator';

interface CommentItemProps {
  comment: PlanComment;
  replies: PlanComment[];
  allRepliesMap: Record<string, PlanComment[]>;
  onReply: (content: string, parentId: string) => void;
  isReply?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  hasUnseenReplies: boolean;
}

function CommentItem({ comment, replies, allRepliesMap, onReply, isReply = false, isExpanded, onToggleExpand, hasUnseenReplies }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const { user, userProfile } = useAuth();

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '';

  const handlePostReply = () => {
    if (replyContent.trim()) {
      onReply(replyContent, comment.id);
      setReplyContent('');
      setShowReplyForm(false);
    }
  };

  return (
    <div className="relative flex items-start gap-4 group">
      {!isReply && replies.length > 0 && <div className="absolute top-10 left-5 h-[calc(100%_-_2.5rem)] w-0.5 bg-border/60" />}
      
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={comment.authorAvatar} />
        <AvatarFallback>{getInitials(comment.authorName)}</AvatarFallback>
      </Avatar>

      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{comment.authorName}</span>
            <span className="text-xs text-muted-foreground">
              {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : '...'}
            </span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowReplyForm(!showReplyForm)}>
              Reply
            </Button>
          </div>
        </div>
        
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90">
          <p className="whitespace-pre-wrap">{comment.content}</p>
        </div>

        {showReplyForm && (
          <div className="mt-3 flex items-start gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={userProfile?.photoURL || ''} />
              <AvatarFallback className="text-xs">{getInitials(userProfile?.displayName || '')}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={`Reply to ${comment.authorName}...`}
                rows={2}
                className="bg-background"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowReplyForm(false)}>Cancel</Button>
                <Button size="sm" onClick={handlePostReply}>Post Reply</Button>
              </div>
            </div>
          </div>
        )}

        {replies.length > 0 && (
          <div className="mt-2">
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={onToggleExpand}>
              <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              {isExpanded ? 'Hide' : `${replies.length} ${replies.length > 1 ? 'replies' : 'reply'}`}
              {hasUnseenReplies && !isExpanded && <div className="h-2 w-2 bg-primary rounded-full ml-2" />}
            </Button>
            {isExpanded && (
              <div className="mt-3 space-y-3 pl-4 border-l-2">
                {replies.map(reply => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    replies={allRepliesMap[reply.id] || []}
                    allRepliesMap={allRepliesMap}
                    onReply={onReply}
                    isReply={true}
                    isExpanded={true} // Replies within replies are always expanded for simplicity
                    onToggleExpand={() => {}}
                    hasUnseenReplies={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PlanComments({ planId }: { planId: string }) {
  const { comments, loading, addComment, subscribeToComments } = usePlanComments();
  const { user, userProfile } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const manuallyCollapsedThreads = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = subscribeToComments(planId);
    return () => unsubscribe();
  }, [planId, subscribeToComments]);

  const { topLevelComments, repliesByParentId, threadsWithUnseenReplies } = useMemo(() => {
    const topLevel: PlanComment[] = [];
    const repliesMap: Record<string, PlanComment[]> = {};
    const unseenThreads = new Set<string>();

    comments.forEach(comment => {
      if (comment.parentId) {
        if (!repliesMap[comment.parentId]) {
          repliesMap[comment.parentId] = [];
        }
        repliesMap[comment.parentId].push(comment);
        if (comment.authorId !== user?.uid) {
          unseenThreads.add(comment.parentId);
        }
      } else {
        topLevel.push(comment);
      }
    });
    return { topLevelComments: topLevel, repliesByParentId: repliesMap, threadsWithUnseenReplies: unseenThreads };
  }, [comments, user]);

  useEffect(() => {
    setExpandedThreads(prevExpanded => {
      const newExpanded = new Set(prevExpanded);
      threadsWithUnseenReplies.forEach(threadId => {
        if (!manuallyCollapsedThreads.current.has(threadId)) {
          newExpanded.add(threadId);
        }
      });
      return newExpanded;
    });
  }, [threadsWithUnseenReplies]);

  const toggleThread = (commentId: string) => {
    setExpandedThreads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
        manuallyCollapsedThreads.current.add(commentId);
      } else {
        newSet.add(commentId);
        manuallyCollapsedThreads.current.delete(commentId);
      }
      return newSet;
    });
  };

  const handlePostComment = () => {
    if (newComment.trim()) {
      addComment(planId, newComment);
      setNewComment('');
    }
  };

  const handleReply = (content: string, parentId: string) => {
    addComment(planId, content, parentId);
  };

  const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '';

  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        Discussion ({comments.length})
      </h3>
      
      <div className="flex items-start gap-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={userProfile?.photoURL || ''} />
          <AvatarFallback>{getInitials(userProfile?.displayName || '')}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment or ask a question..."
            rows={3}
            className="bg-background"
          />
          <div className="flex justify-end">
            <Button onClick={handlePostComment} disabled={!newComment.trim()}>
              <Send className="h-4 w-4 mr-2" />
              Post Comment
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {loading && comments.length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6">
          {topLevelComments.length > 0 ? (
            topLevelComments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                replies={repliesByParentId[comment.id] || []}
                allRepliesMap={repliesByParentId}
                onReply={handleReply}
                isExpanded={expandedThreads.has(comment.id)}
                onToggleExpand={() => toggleThread(comment.id)}
                hasUnseenReplies={threadsWithUnseenReplies.has(comment.id)}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No comments yet. Be the first to start the discussion!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}