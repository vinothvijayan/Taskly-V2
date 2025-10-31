import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface CommentToastProps {
  authorName: string;
  authorAvatar?: string;
  commentPreview: string;
  onDismiss: () => void;
}

export function CommentToast({ authorName, authorAvatar, commentPreview, onDismiss }: CommentToastProps) {
  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '';

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg shadow-lg bg-card border border-border w-80">
      <Avatar className="h-9 w-9">
        <AvatarImage src={authorAvatar} />
        <AvatarFallback>{getInitials(authorName)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{authorName}</p>
        <p className="text-sm text-muted-foreground truncate">
          {commentPreview}
        </p>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2 -mt-1" onClick={onDismiss}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}