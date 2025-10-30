import { ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar"
import { AppSidebar, SidebarNavContent } from "./AppSidebar"
import { PremiumHeader } from "./PremiumHeader"
import { TimerProvider, useTimer } from "@/contexts/TimerContext"
import { FloatingTimer } from "@/components/timer/FloatingTimer"
import { TimeTrackingWidget } from "@/components/timer/TimeTrackingWidget"
import { TeamChatProvider } from "@/contexts/TeamChatContext"
import { OfflineIndicator } from "@/components/common/OfflineIndicator"
import { PerformanceMonitor } from "@/components/performance/PerformanceMonitor"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"

interface AppLayoutProps {
  children: ReactNode
}

function AppLayoutContent({ children }: AppLayoutProps) {
  const { isTimerRunning } = useTimer()
  const { isChatOpenMobile, state, setState } = useSidebar()
  const location = useLocation()
  const isMobile = useIsMobile()
  
  // Mobile Layout with properly structured Sheet
  if (isMobile) {
    return (
      <Sheet open={state === 'expanded'} onOpenChange={(open) => setState(open ? 'expanded' : 'collapsed')}>
        <div 
          className="h-screen flex flex-col w-full overflow-hidden bg-gradient-to-br from-background via-background to-muted/20"
          style={{ "--app-header-offset": "3.5rem" } as React.CSSProperties}
        >
          <PremiumHeader mobileTrigger={
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-background hover:bg-accent transition-colors">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
          } />
          <main className={cn(
            "flex-1 transition-smooth overflow-y-auto min-h-0 touch-pan-y relative min-w-0 h-full",
            "pt-0",
            location.pathname === "/" && "scrollbar-hide"
          )}>
            {children}
          </main>
        </div>
        <SheetContent side="left" className="w-64 p-0 border-r-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Main Navigation</SheetTitle>
            <SheetDescription>Navigate through the main sections of the Taskly application.</SheetDescription>
          </SheetHeader>
          <SidebarNavContent onLinkClick={() => setState('collapsed')} collapsed={false} isMobile={isMobile} />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop Layout
  return (
    <div 
      className="h-screen flex flex-col w-full overflow-hidden bg-gradient-to-br from-background via-background to-muted/20"
      style={{ "--app-header-offset": "3.5rem" } as React.CSSProperties}
    >
      <PremiumHeader />
      <OfflineIndicator />
      
      <div className="flex flex-1 overflow-hidden items-start">
        <AppSidebar className={cn(
          "hidden md:flex",
          "transition-all duration-300",
          !isMobile && isChatOpenMobile && "hidden lg:flex"
        )} />
        
        <main className={cn(
          "flex-1 transition-smooth overflow-y-auto min-h-0 touch-pan-y relative min-w-0 h-full",
          "pt-0",
        )}>
          {children}
        </main>
      </div>
      
      <FloatingTimer />
      <TimeTrackingWidget />
      <PerformanceMonitor />
    </div>
  )
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <TimerProvider>
      <TeamChatProvider>
        <SidebarProvider>
          <AppLayoutContent>{children}</AppLayoutContent>
        </SidebarProvider>
      </TeamChatProvider>
    </TimerProvider>
  )
}