import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ReactionToastProps {
  reactorName: string;
  reactorAvatarUrl?: string;
  taskTitle: string;
  emoji: string;
}

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

export const ReactionToast = ({ reactorName, reactorAvatarUrl, taskTitle, emoji }: ReactionToastProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="flex items-center gap-3 p-3 rounded-xl border bg-background/60 backdrop-blur-sm shadow-lg w-80"
    >
      <div className="relative">
        <Avatar className="h-10 w-10">
          <AvatarImage src={reactorAvatarUrl} />
          <AvatarFallback>{getInitials(reactorName)}</AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 text-lg leading-none">
          {emoji}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          <strong>{reactorName}</strong> reacted to an activity
        </p>
        <p className="text-xs text-muted-foreground truncate">
          Task: "{taskTitle}"
        </p>
      </div>
    </motion.div>
  );
};