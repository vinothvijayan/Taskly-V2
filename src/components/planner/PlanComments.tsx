import { useState, useEffect, useMemo } from 'react';
import { usePlanComments } from '@/contexts/PlanCommentsContext';
import { PlanComment } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CommentItemProps {
  comment: PlanComment;
  replies: PlanComment[];
  allRepliesMap: Record<string, PlanComment[]>;
  onReply: (content: string, parentId: string) => void;
}

function CommentItem({ comment, replies, allRepliesMap, onReply }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '';

  const handlePostReply = () => {
    if (replyContent.trim()) {
      onReply(replyContent, comment.id);
      setReplyContent('');
      setShowReplyForm(false);
    }
  };

  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-9 w-9">
        <AvatarImage src={comment.authorAvatar} />
        <AvatarFallback>{getInitials(comment.authorName)}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">{comment.authorName}</span>
            <span className="text-xs text-muted-foreground">
              {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : '...'}
            </span>
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
        </div>
        <div className="mt-1">
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowReplyForm(!showReplyForm)}>
            Reply
          </Button>
        </div>
        {showReplyForm && (
          <div className="mt-2 space-y-2">
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder={`Reply to ${comment.authorName}...`}
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowReplyForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handlePostReply}>Post</Button>
            </div>
          </div>
        )}
        {replies.length > 0 && (
          <div className="mt-3 space-y-3 pl-4 border-l-2">
            {replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                replies={allRepliesMap[reply.id] || []}
                allRepliesMap={allRepliesMap}
                onReply={onReply}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PlanComments({ planId }: { planId: string }) {
  const { comments, loading, addComment, subscribeToComments } = usePlanComments();
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToComments(planId);
    return () => unsubscribe();
  }, [planId, subscribeToComments]);

  const { topLevelComments, repliesByParentId } = useMemo(() => {
    const topLevel: PlanComment[] = [];
    const repliesMap: Record<string, PlanComment[]> = {};

    comments.forEach(comment => {
      if (comment.parentId) {
        if (!repliesMap[comment.parentId]) {
          repliesMap[comment.parentId] = [];
        }
        repliesMap[comment.parentId].push(comment);
      } else {
        topLevel.push(comment);
      }
    });
    return { topLevelComments: topLevel, repliesByParentId: repliesMap };
  }, [comments]);

  const handlePostComment = () => {
    if (newComment.trim()) {
      addComment(planId, newComment);
      setNewComment('');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        Discussion
      </h3>
      {loading && comments.length === 0 ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          {topLevelComments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={repliesByParentId[comment.id] || []}
              allRepliesMap={repliesByParentId}
              onReply={addComment}
            />
          ))}
        </div>
      )}
      <div className="flex items-start gap-3 pt-4 border-t">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment or ask a question..."
          rows={3}
        />
        <Button onClick={handlePostComment} disabled={!newComment.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}