import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatMessage, Attachment } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, Loader2, Circle, FileText, AlertCircle } from 'lucide-react';
import { rtdb } from '@/lib/firebase';
import { ref, onValue, off, query, orderByChild, limitToLast } from 'firebase/database';
import { cn } from '@/lib/utils';

const formatFileSize = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface PipChatViewProps {
  teamMembers: UserProfile[];
  onlineStatus: { [userId: string]: { online: boolean; lastSeen: number } };
  unreadCounts: { [chatRoomId: string]: number };
  userProfile: UserProfile | null;
  onSendMessage: (receiverId: string, content: string) => Promise<void>;
}

export const PipChatView: React.FC<PipChatViewProps> = ({
  teamMembers,
  onlineStatus,
  unreadCounts,
  userProfile,
  onSendMessage,
}) => {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '';

  const generateChatRoomId = (userId1: string, userId2: string): string => [userId1, userId2].sort().join('_');

  useEffect(() => {
    if (!selectedUser || !userProfile) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const chatRoomId = generateChatRoomId(userProfile.uid, selectedUser.uid);
    const messagesQuery = query(ref(rtdb, `chats/${chatRoomId}/messages`), orderByChild('timestamp'), limitToLast(20));

    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      const data = snapshot.val();
      const messagesList: ChatMessage[] = data ? Object.values(data) : [];
      messagesList.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(messagesList);
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [selectedUser, userProfile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    await onSendMessage(selectedUser.uid, newMessage.trim());
    setNewMessage('');
  };

  if (!selectedUser) {
    return (
      <div className="h-full flex flex-col">
        <p className="text-xs font-semibold text-gray-400 mb-2 px-1 flex-shrink-0">Team Members</p>
        <div className="flex-1 overflow-y-auto pr-1">
          <ul className="space-y-1">
            {teamMembers.filter(m => m.uid !== userProfile?.uid).map(member => {
              const chatRoomId = userProfile ? generateChatRoomId(userProfile.uid, member.uid) : '';
              const unreadCount = unreadCounts[chatRoomId] || 0;
              return (
                <li key={member.uid} onClick={() => setSelectedUser(member)} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-800 transition-colors cursor-pointer">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.photoURL} />
                      <AvatarFallback className="text-xs">{getInitials(member.displayName)}</AvatarFallback>
                    </Avatar>
                    {onlineStatus[member.uid]?.online && (
                      <Circle className="h-2.5 w-2.5 fill-green-500 stroke-green-500 absolute bottom-0 right-0" />
                    )}
                  </div>
                  <span className="text-sm flex-1 truncate">{member.displayName}</span>
                  {unreadCount > 0 && <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">{unreadCount}</Badge>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-2 mb-2 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)} className="h-7 w-7 text-gray-400 hover:bg-gray-700">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-semibold truncate">{selectedUser.displayName}</p>
      </header>
      <div className="flex-1 overflow-y-auto pr-1 mb-2">
        {loadingMessages ? (
          <div className="flex items-center justify-center h-full text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex", msg.senderId === userProfile?.uid ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-lg text-sm",
                  msg.senderId === userProfile?.uid ? "bg-primary text-primary-foreground" : "bg-gray-700",
                  (msg.type === 'media' && !msg.message) ? "p-0.5 bg-transparent" : "px-2 py-1"
                )}>
                  {msg.type === 'media' && msg.attachments && (
                    <div className="space-y-1">
                      {msg.attachments.map(att => (
                        <div key={att.id}>
                          {att.type === 'image' && (
                            <div className="relative">
                              <img src={att.status === 'uploading' ? att.previewUrl : att.url} className="rounded-md max-w-full h-auto" alt={att.fileName || 'Image'} />
                              {att.status === 'uploading' && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader2 className="h-4 w-4 animate-spin text-white" /></div>}
                              {att.status === 'failed' && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><AlertCircle className="h-4 w-4 text-destructive" /></div>}
                            </div>
                          )}
                          {att.type === 'document' && (
                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-black/20 rounded-md">
                              <FileText className="h-5 w-5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{att.fileName}</p>
                                {att.fileSize && <p className="text-[10px] text-gray-400">{formatFileSize(att.fileSize)}</p>}
                              </div>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.message && (
                    <p className={cn(msg.type === 'media' && "mt-1 px-1.5 pb-0.5")}>{msg.message}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Input
          placeholder="Message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          className="h-8 text-xs bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:ring-primary"
        />
        <Button size="icon" onClick={handleSendMessage} disabled={!newMessage.trim()} className="h-8 w-8 flex-shrink-0 gradient-primary text-primary-foreground">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};