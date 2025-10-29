import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Send, Users, MessageCircle, MoreVertical, Phone, Video, Info } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useTasks } from "@/contexts/TasksContext"
import { cn } from "@/lib/utils"
import { format, isToday, isYesterday } from "date-fns"
import { useSidebar } from "@/components/ui/sidebar";
interface Message {
  id: string
  content: string
  senderId: string
  senderName: string
  senderAvatar?: string
  timestamp: Date
  type: "text" | "system"
}

interface TeamChatProps {
  className?: string
}

export function TeamChat({ className }: TeamChatProps) {
  const { user, userProfile } = useAuth()
  const { teamMembers } = useTasks()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [onlineMembers] = useState(new Set(["user1", "user2"]))
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Mock messages for demo
  useEffect(() => {
    const mockMessages: Message[] = [
      {
        id: "1",
        content: "Hey team! Just finished the dashboard redesign. Would love to get your feedback!",
        senderId: "user1",
        senderName: "Alice Johnson",
        senderAvatar: "https://images.unsplash.com/photo-1494790108755-2616b612b77c?w=50&h=50&fit=crop&crop=face",
        timestamp: new Date(Date.now() - 3600000),
        type: "text"
      },
      {
        id: "2",
        content: "Looks amazing! The new color scheme really makes the data pop. 🎨",
        senderId: "user2",
        senderName: "Bob Smith",
        senderAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face",
        timestamp: new Date(Date.now() - 3300000),
        type: "text"
      },
      {
        id: "3",
        content: "Thanks Bob! I'm particularly happy with how the charts turned out. The animations feel smooth and informative.",
        senderId: "user1",
        senderName: "Alice Johnson",
        senderAvatar: "https://images.unsplash.com/photo-1494790108755-2616b612b77c?w=50&h=50&fit=crop&crop=face",
        timestamp: new Date(Date.now() - 3000000),
        type: "text"
      },
      {
        id: "4",
        content: "Should we schedule a design review meeting for tomorrow?",
        senderId: user?.uid || "current-user",
        senderName: userProfile?.displayName || "You",
        senderAvatar: userProfile?.photoURL,
        timestamp: new Date(Date.now() - 1800000),
        type: "text"
      }
    ]
    setMessages(mockMessages)
  }, [user, userProfile])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = () => {
    if (!newMessage.trim() || !user) return

    const message: Message = {
      id: Date.now().toString(),
      content: newMessage.trim(),
      senderId: user.uid,
      senderName: userProfile?.displayName || "You",
      senderAvatar: userProfile?.photoURL,
      timestamp: new Date(),
      type: "text"
    }

    setMessages(prev => [...prev, message])
    setNewMessage("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatMessageTime = (timestamp: Date) => {
    if (isToday(timestamp)) {
      return format(timestamp, "HH:mm")
    } else if (isYesterday(timestamp)) {
      return `Yesterday ${format(timestamp, "HH:mm")}`
    } else {
      return format(timestamp, "MMM dd, HH:mm")
    }
  }

  const groupedMessages = messages.reduce((groups: Message[][], message, index) => {
    const prevMessage = messages[index - 1]
    const shouldGroup = prevMessage && 
      prevMessage.senderId === message.senderId &&
      message.timestamp.getTime() - prevMessage.timestamp.getTime() < 5 * 60 * 1000 // 5 minutes

    if (shouldGroup) {
      groups[groups.length - 1].push(message)
    } else {
      groups.push([message])
    }

    return groups
  }, [])

  return (
    <Card className={cn("flex flex-col h-full shadow-elegant", className)}>
      {/* Header */}
      <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-accent/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Team Chat</CardTitle>
              <p className="text-sm text-muted-foreground">
                {teamMembers.length} members
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="hover-scale">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hover-scale">
              <Video className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hover-scale">
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {groupedMessages.map((messageGroup, groupIndex) => (
              <div key={groupIndex} className="space-y-1">
                {messageGroup.map((message, messageIndex) => {
                  const isCurrentUser = message.senderId === user?.uid
                  const isFirstInGroup = messageIndex === 0

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3",
                        isCurrentUser && "flex-row-reverse"
                      )}
                    >
                      {isFirstInGroup && !isCurrentUser && (
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={message.senderAvatar} />
                            <AvatarFallback className="text-xs">
                              {message.senderName.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          {onlineMembers.has(message.senderId) && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-success border-2 border-background rounded-full" />
                          )}
                        </div>
                      )}
                      {!isFirstInGroup && !isCurrentUser && (
                        <div className="w-8" />
                      )}

                      <div className={cn(
                        "flex flex-col max-w-[70%]",
                        isCurrentUser && "items-end"
                      )}>
                        {isFirstInGroup && (
                          <div className={cn(
                            "flex items-center gap-2 mb-1",
                            isCurrentUser && "flex-row-reverse"
                          )}>
                            <span className="text-sm font-medium">
                              {isCurrentUser ? "You" : message.senderName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatMessageTime(message.timestamp)}
                            </span>
                          </div>
                        )}

                        <div className={cn(
                          "rounded-lg px-3 py-2 transition-smooth",
                          isCurrentUser 
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!newMessage.trim()}
            className="hover-scale"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}