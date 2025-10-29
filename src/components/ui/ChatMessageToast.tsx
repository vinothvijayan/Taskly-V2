import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, X } from 'lucide-react';
import { Button } from './button';

interface ChatMessageToastProps {
  senderName: string;
  senderAvatarUrl?: string;
  messagePreview: string;
  onDismiss: () => void;
}

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

export const ChatMessageToast = ({ senderName, senderAvatarUrl, messagePreview, onDismiss }: ChatMessageToastProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="flex items-center gap-3 p-3 rounded-xl border bg-background/60 backdrop-blur-sm shadow-lg w-96"
    >
      <div className="relative">
        <Avatar className="h-10 w-10">
          <AvatarImage src={senderAvatarUrl} />
          <AvatarFallback>{getInitials(senderName)}</AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 text-lg leading-none">
          <MessageSquare className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          New message from <strong>{senderName}</strong>
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {messagePreview}
        </p>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onDismiss}>
        <X className="h-4 w-4" />
      </Button>
    </motion.div>
  );
};