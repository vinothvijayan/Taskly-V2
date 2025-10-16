import React, { useState } from 'react';
import { TaskComment } from '@/types';
import { useComments } from '@/contexts/CommentsContext';
import { useAuth } from '@/contexts/AuthContext';
import { CommentForm } from './CommentForm';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CommentItemProps {
  comment: TaskComment;
}

export function CommentItem({ comment }: CommentItemProps) {
  const { deleteComment } = useComments();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const isOwner = user?.uid === comment.userId;

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const distance = formatDistanceToNow(date, { addSuffix: true });
    
    // Custom formatting for better UX
    if (distance.includes('less than a minute')) return 'Just now';
    if (distance.includes('about a minute')) return '1 minute ago';
    return distance;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this comment?')) {
      await deleteComment(comment.id, comment.taskId);
    }
  };

  const handleEditComplete = () => {
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="border rounded-lg p-3 bg-muted/20">
        <CommentForm
          taskId={comment.taskId}
          initialContent={comment.content}
          isEditing={true}
          commentId={comment.id}
          onCommentAdded={handleEditComplete}
          onCancel={handleEditCancel}
        />
      </div>
    );
  }

  return (
    <div className="flex gap-3 group">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={comment.userPhotoURL} alt={comment.userDisplayName} />
        <AvatarFallback className="text-xs">
          {getInitials(comment.userDisplayName)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{comment.userDisplayName}</span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(comment.createdAt)}
          </span>
          {comment.isEdited && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}
          
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        <div className="text-sm whitespace-pre-wrap break-words">
          {comment.content}
        </div>
      </div>
    </div>
  );
}