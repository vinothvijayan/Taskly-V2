import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Loader2, X, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useHapticFeedback } from "@/hooks/useTouchGestures"

interface Message {
  id: string
  content: string
  sender: "user" | "bot"
  timestamp: Date
}

interface MobileChatWindowProps {
  className?: string
}

export function MobileChatWindow({ className }: MobileChatWindowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm your AI task assistant. I can help you manage your tasks, suggest optimal focus times, and answer questions about your productivity. How can I help you today?",
      sender: "bot",
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { impact } = useHapticFeedback()

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    impact('light')
    
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)

    // Simulate AI response delay
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: generateAIResponse(inputValue),
        sender: "bot",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, botResponse])
      setIsLoading(false)
      impact('light')
    }, 1000 + Math.random() * 2000)
  }

  const generateAIResponse = (userInput: string): string => {
    const input = userInput.toLowerCase()
    
    if (input.includes("task") || input.includes("todo")) {
      return "I can help you manage your tasks! You can create new tasks with priorities, set estimated focus times, and I'll suggest the best times to work on them based on your schedule."
    }
    
    if (input.includes("focus") || input.includes("pomodoro") || input.includes("timer")) {
      return "Great! The Pomodoro Technique is excellent for productivity. I recommend starting with 25-minute focus sessions followed by 5-minute breaks. After 4 sessions, take a longer 15-30 minute break."
    }
    
    if (input.includes("calendar") || input.includes("schedule")) {
      return "Once you connect your Google Calendar, I'll be able to analyze your schedule and suggest optimal times for focused work sessions. I can also help schedule your tasks around your existing meetings."
    }
    
    if (input.includes("analytics") || input.includes("progress")) {
      return "I can provide insights on your productivity patterns, including your most productive hours, average focus session length, and task completion rates. This helps optimize your work schedule."
    }
    
    return "I understand you're asking about productivity and task management. I'm here to help you optimize your workflow, manage your tasks efficiently, and maintain good focus habits. What specific aspect would you like to explore?"
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const toggleChat = () => {
    setIsOpen(!isOpen)
    impact('medium')
  }

  return (
    <>
      {/* Floating Chat Button */}
      <Button
        onClick={toggleChat}
        className={cn(
          "fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground",
          "md:hidden", // Only show on mobile
          className
        )}
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>

      {/* Mobile Chat Window - Optimized for mobile screen */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-background md:hidden">
          <div className="flex flex-col h-full">
            {/* Header - Compact */}
            <div className="flex items-center justify-between p-3 border-b bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <Bot className="h-3.5 w-3.5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-semibold text-sm">AI Assistant</h2>
                  <p className="text-xs text-muted-foreground">Online</p>
                </div>
              </div>
              <Button
                onClick={toggleChat}
                variant="ghost"
                size="icon"
                className="h-7 w-7"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Messages - Optimized scrolling */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto px-3 pb-safe">
                <div className="space-y-2 py-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-2 animate-fade-in",
                        message.sender === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.sender === "bot" && (
                        <Avatar className="h-6 w-6 mt-1 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            <Bot className="h-3 w-3" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm transition-smooth",
                          message.sender === "user"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        )}
                      >
                        {message.content}
                      </div>
                      
                      {message.sender === "user" && (
                        <Avatar className="h-6 w-6 mt-1 shrink-0">
                          <AvatarFallback className="bg-secondary text-xs">
                            <User className="h-3 w-3" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex gap-2 animate-fade-in">
                      <Avatar className="h-6 w-6 mt-1 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <Bot className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted rounded-lg rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Input - Compact and accessible */}
            <div className="p-3 border-t bg-card/50 backdrop-blur-sm">
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="flex-1 rounded-full text-sm h-9"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  size="icon"
                  className="rounded-full h-9 w-9 shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}