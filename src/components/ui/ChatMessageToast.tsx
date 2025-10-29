import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X, MessageSquare, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

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
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className="flex items-center gap-4 p-4 bg-background/80 backdrop-blur-lg border border-border/50 rounded-xl shadow-elegant w-full max-w-lg"
    >
      <div className="relative">
        <Avatar className="h-10 w-10 border-2 border-background">
          <AvatarImage src={senderAvatarUrl} />
          <AvatarFallback>{getInitials(senderName)}</AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5 border-2 border-background">
          <MessageSquare className="h-3 w-3 text-primary-foreground" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{senderName}</p>
        <p className="text-sm text-muted-foreground truncate">{messagePreview}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="secondary" className="h-8 px-3 text-xs" onClick={onDismiss}>
          View
          <ArrowRight className="h-3 w-3 ml-1.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}