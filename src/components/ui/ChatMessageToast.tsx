import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageSquare, X } from "lucide-react";

interface ChatMessageToastProps {
  senderName: string;
  senderAvatarUrl?: string;
  messagePreview: string;
  onDismiss: () => void;
}

export function ChatMessageToast({
  senderName,
  senderAvatarUrl,
  messagePreview,
  onDismiss,
}: ChatMessageToastProps) {
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className="w-full max-w-sm p-4 bg-card border rounded-xl shadow-lg flex items-start gap-3"
    >
      <Avatar className="h-10 w-10 border">
        <AvatarImage src={senderAvatarUrl} />
        <AvatarFallback>{getInitials(senderName)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">{senderName}</p>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {messagePreview}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0 -mr-1 -mt-1"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}