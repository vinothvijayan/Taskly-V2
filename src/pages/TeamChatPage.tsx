import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/contexts/TasksContext";
import { useTeamChat } from "@/contexts/TeamChatContext";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeGestures, useHapticFeedback } from "@/hooks/useTouchGestures";
import { rtdb } from "@/lib/firebase";
import { ref, push, onValue, off, serverTimestamp, query, orderByChild, limitToLast } from "firebase/database";
import { notificationService } from "@/lib/notifications";
import { ChatMessage, ChatRoom, UserProfile } from "@/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare,
  Send,
  Users,
  Clock,
  Loader2,
  User,
  Check,
  CheckCheck,
  Circle,
  ArrowLeft,
  Search,
  Plus,
  Copy,
  Reply
} from "lucide-react";

export default function TeamChatPage() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { teamMembers, addTask } = useTasks();
  const { onlineStatus, markChatAsRead, markMessagesAsReadBatch, unreadCounts } = useTeamChat();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // CHANGE #1: Import `setOpen` for sidebar control
  const { setChatOpenMobile, setOpen } = useSidebar();
  
  const { impact } = useHapticFeedback();
  
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [readByOther, setReadByOther] = useState<Record<string, boolean>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRoomRef = useRef<any>(null);
  const messageStatusRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);


  // CHANGE #2: Add useEffect to collapse the sidebar on page load
  useEffect(() => {
    if (setOpen) {
      if (window.innerWidth >= 768) {
        setOpen(false);
      } else {
        setOpen(true);
        }
    }
  }, [setOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Set up real-time listener for messages when a user is selected
  useEffect(() => {
    if (selectedUser && user) {
      console.time('Chat Load Time');
      setupChatListener(selectedUser.uid);
    }
    
    return () => {
      if (chatRoomRef.current) { try { off(chatRoomRef.current); } catch (e) { console.warn(e); } }
      if (messageStatusRef.current) { try { off(messageStatusRef.current); } catch (e) { console.warn(e); } }
    };
  }, [selectedUser, user]);

  // Focus input when chat is opened
  useEffect(() => {
    if (selectedUser && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedUser]);

  const generateChatRoomId = (userId1: string, userId2: string): string => [userId1, userId2].sort().join('_');

  const setupChatListener = (otherUserId: string) => {
    if (!user) return;
    setLoading(true);
    const chatRoomId = generateChatRoomId(user.uid, otherUserId);
    const messagesQuery = query(ref(rtdb, `chats/${chatRoomId}/messages`), orderByChild('timestamp'), limitToLast(50));
    chatRoomRef.current = messagesQuery;
    onValue(messagesQuery, (snapshot) => {
      if (!isMountedRef.current) return;
      const data = snapshot.val();
      if (data) {
        const messagesList: ChatMessage[] = Object.entries(data).map(([key, value]: any) => ({ id: key, ...value }));
        messagesList.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(messagesList);
        console.timeEnd('Chat Load Time');
        setupMessageStatusListener(otherUserId);
        const messageIds = messagesList.map(msg => msg.id);
        markMessagesAsReadBatch(chatRoomId, messageIds).catch(e => console.warn(e));
      } else {
        setMessages([]);
        console.timeEnd('Chat Load Time');
        setupMessageStatusListener(otherUserId);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to chat messages:", error);
      if (isMountedRef.current) {
        toast({ title: "Chat connection error", variant: "destructive" });
        setLoading(false);
      }
    });
  };

  const setupMessageStatusListener = (otherUserId: string) => {
    if (!user) return;
    const chatRoomId = generateChatRoomId(user.uid, otherUserId);
    messageStatusRef.current = ref(rtdb, `messageStatus/${chatRoomId}`);
    onValue(messageStatusRef.current, (snapshot) => {
      if (!isMountedRef.current) return;
      const data = snapshot.val();
      const readMap: Record<string, boolean> = {};
      if (data) {
        Object.entries(data).forEach(([messageId, userStatuses]: [string, any]) => {
          if (userStatuses && userStatuses[otherUserId]) readMap[messageId] = true;
        });
      }
      setReadByOther(readMap);
    });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !user || !userProfile) return;
    const messageContent = newMessage.trim();
    setNewMessage("");
    setSending(true);
    try {
      const chatRoomId = generateChatRoomId(user.uid, selectedUser.uid);
      const messagesRef = ref(rtdb, `chats/${chatRoomId}/messages`);
      const messageData: Omit<ChatMessage, 'id'> = { senderId: user.uid, senderName: userProfile.displayName || user.email || 'Unknown', senderEmail: user.email || '', message: messageContent, timestamp: Date.now(), type: 'text' };
      await push(messagesRef, messageData);
      const chatRoomInfoRef = ref(rtdb, `chatRooms/${chatRoomId}`);
      push(chatRoomInfoRef, { participants: [user.uid, selectedUser.uid], lastActivity: serverTimestamp(), lastMessage: messageData }).catch(e => console.warn(e));
      notificationService.addInAppNotification(selectedUser.uid, `New message from ${messageData.senderName}`, messageData.message.substring(0, 50), 'chat', { chatRoomId, senderId: user.uid, senderName: messageData.senderName }).catch(e => console.warn(e));
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageContent);
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const getMessageTickIcon = (message: ChatMessage) => {
    if (message.senderId !== user?.uid) return null;
    return readByOther[message.id] ? <CheckCheck className="h-3 w-3 text-sky-500" /> : <Check className="h-3 w-3 text-muted-foreground/70" />;
  };
  const formatMessageTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const getInitials = (name?: string, email?: string) => name?.trim() ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : email?.split('@')[0].slice(0, 2).toUpperCase() || "U";
  const formatLastSeen = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };
  const isUserOnline = (userId: string) => onlineStatus[userId]?.online || false;
  const getUserLastSeen = (userId: string) => onlineStatus[userId]?.lastSeen || Date.now();
  const groupedMessages = () => {
    const groups: Array<{ type: 'date' | 'message', data: any }> = [];
    let currentDate = '';
    messages.forEach((message, index) => {
      const messageDate = new Date(message.timestamp).toDateString();
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        const now = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        let dateLabel = new Date(message.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        if (messageDate === now) dateLabel = 'Today';
        else if (messageDate === yesterday) dateLabel = 'Yesterday';
        groups.push({ type: 'date', data: dateLabel });
      }
      const isGrouped = message.senderId === messages[index - 1]?.senderId && (message.timestamp - messages[index - 1]?.timestamp) < 300000;
      groups.push({ type: 'message', data: { ...message, isFirstInGroup: !isGrouped, isLastInGroup: index === messages.length - 1 || messages[index + 1]?.senderId !== message.senderId || (messages[index + 1]?.timestamp - message.timestamp) >= 300000 } });
    });
    return groups;
  };
  const filteredMembers = teamMembers.filter(m => m.uid !== user?.uid && (m.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || m.email.toLowerCase().includes(searchTerm.toLowerCase())));
  const handleSelectUser = (member: UserProfile) => { setSelectedUser(member); setShowChat(true); setChatOpenMobile(true); };
  const handleBackToList = () => { setShowChat(false); setSelectedUser(null); setChatOpenMobile(false); };
  const createTaskFromMessage = async (message: ChatMessage) => {
    try {
      impact('light');
      const taskData = { title: message.message.substring(0, 50) + (message.message.length > 50 ? '...' : ''), description: `Created from chat message by ${message.senderName}:\n\n"${message.message}"`, priority: 'medium' as const, status: 'todo' as const, assignedTo: [] };
      await addTask(taskData);
      toast({ title: "Task created! 📝" });
    } catch (error) {
      console.error("Error creating task from message:", error);
      toast({ title: "Error creating task", variant: "destructive" });
    }
  };
  const copyMessage = (message: ChatMessage) => navigator.clipboard.writeText(message.message).then(() => toast({ title: "Copied" })).catch(() => toast({ title: "Error", variant: "destructive" }));
  const replyToMessage = (message: ChatMessage) => { setNewMessage(`@${message.senderName}: "${message.message.substring(0, 30)}..."\n\n`); inputRef.current?.focus(); };
  useEffect(() => () => { isMountedRef.current = false; }, []);

  return (
    <div className="h-full w-full bg-background flex overflow-hidden min-h-0">
      {isMobile ? (
        <>
          {!showChat ? (
            <div className="flex-1 flex flex-col w-full min-h-0">
              <div className="bg-[#008069] text-white px-4 py-4 flex items-center gap-3 shadow-lg z-20 sticky top-0 pt-safe">
                <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-white hover:bg-white/10 -ml-2">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-semibold">Chats</h1>
              </div>
              <div className="px-4 py-3 border-b bg-white dark:bg-background shadow-sm z-10 sticky top-[72px]">
                <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search chats..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 border-0 bg-muted/30 rounded-xl" /></div>
              </div>
              <ScrollArea className="flex-1">
                <div className="divide-y divide-border/50">
                  {filteredMembers.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-30" /><p className="text-sm">No team members</p></div>
                  ) : (
                    filteredMembers.map((member) => {
                      const chatRoomId = user ? generateChatRoomId(user.uid, member.uid) : '';
                      const unreadCount = unreadCounts[chatRoomId] || 0;
                      return (
                        <div key={member.uid} className="px-4 py-4 hover:bg-muted/30 cursor-pointer transition-colors active:bg-muted/50" onClick={() => handleSelectUser(member)}>
                          <div className="flex items-center gap-3"><Avatar className="h-14 w-14 ring-2 ring-background shadow-sm"><AvatarImage src={member.photoURL || ""} /><AvatarFallback className="bg-primary/10 text-primary font-semibold">{getInitials(member.displayName, member.email)}</AvatarFallback></Avatar><div className="flex-1 min-w-0"><div className="flex items-center justify-between mb-1"><p className="font-semibold truncate text-foreground">{member.displayName || "Team Member"}</p></div><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground truncate">{isUserOnline(member.uid) ? <span className="text-green-600 font-medium">Online</span> : `Last seen ${formatLastSeen(getUserLastSeen(member.uid))}`}</p>{unreadCount > 0 && <Badge className="bg-[#25D366] text-white text-xs px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">{unreadCount}</Badge>}</div></div></div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            selectedUser && (
              <div className="flex-1 flex flex-col w-full min-h-0 overflow-hidden">
                <div className="bg-[#008069] text-white px-4 py-4 flex items-center gap-3 shadow-lg z-20"><Button variant="ghost" size="icon" onClick={handleBackToList} className="text-white hover:bg-white/10 -ml-2"><ArrowLeft className="h-5 w-5" /></Button><Avatar className="h-11 w-11 ring-2 ring-white/20"><AvatarImage src={selectedUser.photoURL || ""} /><AvatarFallback className="bg-white/20 text-white font-semibold">{getInitials(selectedUser.displayName, selectedUser.email)}</AvatarFallback></Avatar><div className="flex-1"><p className="font-semibold">{selectedUser.displayName || "Team Member"}</p><p className="text-sm text-white/80">{isUserOnline(selectedUser.uid) ? "Online" : `Last seen ${formatLastSeen(getUserLastSeen(selectedUser.uid))}`}</p></div></div>
                <div className="flex-1 whatsapp-wallpaper overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-1 pb-16">
                      {loading ? (<div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : groupedMessages().length === 0 ? (<div className="text-center py-16 text-muted-foreground"><MessageSquare className="h-16 w-16 mx-auto mb-6 opacity-30" /><p className="text-base">Start a conversation</p></div>) : (groupedMessages().map((item, index) => {
                        if (item.type === 'date') return <div key={`date-${index}`} className="flex justify-center my-6"><div className="bg-white/90 dark:bg-muted/90 text-xs px-4 py-2 rounded-full text-muted-foreground shadow-sm">{item.data}</div></div>;
                        const message = item.data;
                        const isMyMessage = message.senderId === user?.uid;
                        const MessageBubble = () => {
                          const swipeRef = useSwipeGestures({ onSwipeRight: !isMyMessage ? () => createTaskFromMessage(message) : undefined, onSwipeLeft: isMyMessage ? () => createTaskFromMessage(message) : undefined }, { threshold: 80, velocityThreshold: 0.2 });
                          return <DropdownMenu><DropdownMenuTrigger asChild><div ref={swipeRef as React.RefObject<HTMLDivElement>} className={cn("max-w-[85%] px-4 py-3 text-sm break-words shadow-sm cursor-pointer", isMyMessage ? "bg-[#DCF8C6] text-black dark:bg-emerald-900/50 dark:text-white" : "bg-white text-black dark:bg-muted dark:text-foreground", message.isFirstInGroup && message.isLastInGroup ? "rounded-lg" : message.isFirstInGroup ? (isMyMessage ? "rounded-t-lg rounded-bl-lg rounded-br-md" : "rounded-t-lg rounded-br-lg rounded-bl-md") : message.isLastInGroup ? (isMyMessage ? "rounded-b-lg rounded-tl-lg rounded-tr-md" : "rounded-b-lg rounded-tr-lg rounded-tl-md") : (isMyMessage ? "rounded-l-lg rounded-tr-md rounded-br-md" : "rounded-r-lg rounded-tl-md rounded-bl-md"))}><p className="leading-relaxed">{message.message}</p><div className="flex items-center justify-end gap-1 mt-1"><span className="text-xs opacity-70">{formatMessageTime(message.timestamp)}</span>{isMyMessage && getMessageTickIcon(message)}</div></div></DropdownMenuTrigger><DropdownMenuContent className="w-48 bg-background border shadow-lg z-50"><DropdownMenuItem onClick={() => createTaskFromMessage(message)}><Plus className="mr-2 h-4 w-4" />Create Task</DropdownMenuItem><DropdownMenuItem onClick={() => copyMessage(message)}><Copy className="mr-2 h-4 w-4" />Copy Message</DropdownMenuItem><DropdownMenuItem onClick={() => replyToMessage(message)}><Reply className="mr-2 h-4 w-4" />Reply</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
                        };
                        return <div key={message.id} className={cn("flex mb-1", isMyMessage ? "justify-end" : "justify-start")}><MessageBubble /></div>;
                      }))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>
                <div className="bg-background border-t px-4 py-3 shadow-lg z-10"><div className="flex gap-2"><Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleKeyDown} ref={inputRef} placeholder="Type a message" autoFocus className="flex-1 rounded-full border-0 bg-muted/30" /><Button onClick={sendMessage} disabled={!newMessage.trim() || sending} size="icon" className="rounded-full bg-[#25D366] hover:bg-[#20B358] text-white shadow-md">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div></div>
              </div>
            )
          )}
        </>
      ) : (
        <div className="flex w-full">
          <div className="w-1/3 border-r border-border flex flex-col">
            <div className="bg-[#008069] text-white px-4 py-4 shadow-lg z-10 flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-white hover:bg-white/10 -ml-2"><ArrowLeft className="h-5 w-5" /></Button>
              <h1 className="text-xl font-semibold">Chats</h1>
            </div>
            <div className="px-4 py-3 border-b bg-white dark:bg-background shadow-sm z-10">
              <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search chats..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 border-0 bg-muted/30 rounded-xl" /></div>
            </div>
            <ScrollArea className="flex-1">
              <div className="divide-y divide-border/50">
                {filteredMembers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-30" /><p className="text-sm">No team members</p></div>
                ) : (
                  filteredMembers.map((member) => {
                    const chatRoomId = user ? generateChatRoomId(user.uid, member.uid) : '';
                    const unreadCount = unreadCounts[chatRoomId] || 0;
                    return (
                      <div key={member.uid} className={cn("px-4 py-4 cursor-pointer transition-colors", selectedUser?.uid === member.uid ? "bg-muted/70" : "hover:bg-muted/30")} onClick={() => handleSelectUser(member)}>
                        <div className="flex items-center gap-3"><Avatar className="h-14 w-14 ring-2 ring-background shadow-sm"><AvatarImage src={member.photoURL || ""} /><AvatarFallback className="bg-primary/10 text-primary font-semibold">{getInitials(member.displayName, member.email)}</AvatarFallback></Avatar><div className="flex-1 min-w-0"><div className="flex items-center justify-between mb-1"><p className="font-semibold truncate text-foreground">{member.displayName || "Team Member"}</p></div><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground truncate">{isUserOnline(member.uid) ? <span className="text-green-600 font-medium">Online</span> : `Last seen ${formatLastSeen(getUserLastSeen(member.uid))}`}</p>{unreadCount > 0 && <Badge className="bg-[#25D366] text-white text-xs px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">{unreadCount}</Badge>}</div></div></div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
          </div>
          <div className="flex-1 flex flex-col min-h-0">
            {selectedUser ? (
              <>
                <div className="bg-[#008069] text-white px-4 py-4 flex items-center gap-3 shadow-lg z-20 sticky top-0"><Avatar className="h-11 w-11 ring-2 ring-white/20"><AvatarImage src={selectedUser.photoURL || ""} /><AvatarFallback className="bg-white/20 text-white font-semibold">{getInitials(selectedUser.displayName, selectedUser.email)}</AvatarFallback></Avatar><div className="flex-1"><p className="font-semibold">{selectedUser.displayName || "Team Member"}</p><p className="text-sm text-white/80">{isUserOnline(selectedUser.uid) ? "Online" : `Last seen ${formatLastSeen(getUserLastSeen(selectedUser.uid))}`}</p></div></div>
                <div className="flex-1 whatsapp-wallpaper overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-6 space-y-1">
                      {loading ? (<div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : groupedMessages().length === 0 ? (<div className="text-center py-16 text-muted-foreground"><MessageSquare className="h-16 w-16 mx-auto mb-6 opacity-30" /><p className="text-base">Start a conversation</p></div>) : (groupedMessages().map((item, index) => {
                        if (item.type === 'date') return <div key={`date-${index}`} className="flex justify-center my-6"><div className="bg-white/90 dark:bg-muted/90 text-xs px-4 py-2 rounded-full text-muted-foreground shadow-sm">{item.data}</div></div>;
                        const message = item.data;
                        const isMyMessage = message.senderId === user?.uid;
                        const MessageBubble = () => {
                          const swipeRef = useSwipeGestures({ onSwipeRight: !isMyMessage ? () => createTaskFromMessage(message) : undefined, onSwipeLeft: isMyMessage ? () => createTaskFromMessage(message) : undefined }, { threshold: 80, velocityThreshold: 0.2 });
                          return <DropdownMenu><DropdownMenuTrigger asChild><div ref={swipeRef as React.RefObject<HTMLDivElement>} className={cn("max-w-[75%] px-4 py-3 text-sm break-words shadow-sm cursor-pointer", isMyMessage ? "bg-[#DCF8C6] text-black dark:bg-emerald-900/50 dark:text-white" : "bg-white text-black dark:bg-muted dark:text-foreground", message.isFirstInGroup && message.isLastInGroup ? "rounded-lg" : message.isFirstInGroup ? (isMyMessage ? "rounded-t-lg rounded-bl-lg rounded-br-md" : "rounded-t-lg rounded-br-lg rounded-bl-md") : message.isLastInGroup ? (isMyMessage ? "rounded-b-lg rounded-tl-lg rounded-tr-md" : "rounded-b-lg rounded-tr-lg rounded-tl-md") : (isMyMessage ? "rounded-l-lg rounded-tr-md rounded-br-md" : "rounded-r-lg rounded-tl-md rounded-bl-md"))}><p className="leading-relaxed">{message.message}</p><div className="flex items-center justify-end gap-1 mt-1"><span className="text-xs opacity-70">{formatMessageTime(message.timestamp)}</span>{isMyMessage && getMessageTickIcon(message)}</div></div></DropdownMenuTrigger><DropdownMenuContent className="w-48 bg-background border shadow-lg z-50"><DropdownMenuItem onClick={() => createTaskFromMessage(message)}><Plus className="mr-2 h-4 w-4" />Create Task</DropdownMenuItem><DropdownMenuItem onClick={() => copyMessage(message)}><Copy className="mr-2 h-4 w-4" />Copy Message</DropdownMenuItem><DropdownMenuItem onClick={() => replyToMessage(message)}><Reply className="mr-2 h-4 w-4" />Reply</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
                        };
                        return <div key={message.id} className={cn("flex mb-1", isMyMessage ? "justify-end" : "justify-start")}><MessageBubble /></div>;
                      }))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>
                <div className="bg-background border-t px-6 py-4 shadow-lg z-10">
                  <div className="flex gap-3"><Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleKeyDown} ref={inputRef} placeholder="Type a message" autoFocus className="flex-1 rounded-full border-0 bg-muted/30" /><Button onClick={sendMessage} disabled={!newMessage.trim() || sending} size="icon" className="rounded-full bg-[#25D366] hover:bg-[#20B358] text-white shadow-md">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center whatsapp-wallpaper">
                <div className="text-center space-y-6 p-8 bg-white/80 dark:bg-muted/80 rounded-2xl shadow-lg backdrop-blur-sm">
                  <MessageSquare className="h-20 w-20 mx-auto text-muted-foreground/30" />
                  <div><h3 className="text-xl font-semibold mb-2">Select a chat</h3><p className="text-sm text-muted-foreground">Choose a team member to start messaging</p></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}