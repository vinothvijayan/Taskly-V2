import { useEffect, useRef } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  CheckSquare,
  Timer,
  MessageSquare,
  Calendar,
  BarChart3,
  FileText,
  Users as TeamChatIcon,
  Mic,
  Phone,
  DollarSign,
  Zap,
  ChevronRight
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useTeamChat } from "@/contexts/TeamChatContext"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { useIsMobile } from "@/hooks/use-mobile"

const navItems = [
  { title: "Dashboard", url: "/", icon: BarChart3 },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Team Chat", url: "/team-chat", icon: TeamChatIcon },
  { title: "Meetly", url: "/meetly", icon: Mic },
  {
    title: "Sales",
    icon: DollarSign,
    adminOnly: true,
    subItems: [
      { title: "Call Tracker", url: "/sales-tracker", icon: Phone },
      { title: "Opportunities", url: "/sales-opportunity", icon: Zap },
    ],
  },
  { title: "Focus Timer", url: "/timer", icon: Timer },
  { title: "AI Assistant", url: "/chat", icon: MessageSquare },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Notes", url: "/notes", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
]

export const SidebarNavContent = ({ onLinkClick, collapsed }: { onLinkClick?: () => void, collapsed: boolean }) => {
  const { totalUnreadCount } = useTeamChat();
  const location = useLocation();
  const currentPath = location.pathname;
  const { userProfile } = useAuth();

  const visibleItems = navItems.filter(item => !item.adminOnly || userProfile?.role === 'admin');

  const isActive = (path: string) => {
    if (path === "/" && currentPath === "/") return true;
    if (path !== "/" && currentPath.startsWith(path)) return true;
    return false;
  };

  const getNavClasses = (path: string) => {
    return isActive(path)
      ? "bg-primary/10 text-primary font-semibold"
      : "hover:bg-accent/50 text-muted-foreground hover:text-foreground";
  };

  const getNavClassesForParent = (subItems: any[]) => {
    const isChildActive = subItems.some(item => isActive(item.url));
    return isChildActive
      ? "bg-primary/10 text-primary font-semibold"
      : "hover:bg-accent/50 text-muted-foreground hover:text-foreground";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center p-4 border-b border-border/50">
        {!collapsed ? (
          <div className="flex items-center gap-3 w-full px-2">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 h-10 w-10 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
              <CheckSquare className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground tracking-tight truncate">
                Taskly
              </h1>

            </div>
          </div>
        ) : (
          <div className="gradient-primary h-9 w-9 rounded-lg flex items-center justify-center shadow-md">
            <CheckSquare className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      <SidebarContent className="px-3 flex-1 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : "px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider"}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                item.subItems ? (
                  <Collapsible key={item.title} defaultOpen={item.subItems.some(sub => isActive(sub.url))}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className={cn(
                          "w-full rounded-lg transition-all duration-200 group h-10",
                          getNavClassesForParent(item.subItems)
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          {!collapsed && (
                            <span className="text-sm truncate flex-1 text-left">{item.title}</span>
                          )}
                        </div>
                        {!collapsed && (
                          <ChevronRight className="h-4 w-4 flex-shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className={cn("space-y-1 mt-1", collapsed && "hidden")}>
                        {item.subItems.map(subItem => (
                          <SidebarMenuItem key={subItem.title}>
                            <NavLink to={subItem.url} className="block" onClick={onLinkClick}>
                              <SidebarMenuButton
                                className={cn(
                                  "w-full rounded-lg transition-all duration-200 pl-11 h-9",
                                  getNavClasses(subItem.url)
                                )}
                              >
                                <subItem.icon className="h-4 w-4 flex-shrink-0" />
                                {!collapsed && (
                                  <span className="text-sm truncate ml-3 flex-1 text-left">{subItem.title}</span>
                                )}
                              </SidebarMenuButton>
                            </NavLink>
                          </SidebarMenuItem>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <NavLink to={item.url} className="block" onClick={onLinkClick}>
                      <SidebarMenuButton
                        className={cn(
                          "w-full rounded-lg transition-all duration-200 group relative h-10",
                          getNavClasses(item.url)
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          {!collapsed && (
                            <span className="text-sm truncate flex-1 text-left">{item.title}</span>
                          )}
                        </div>
                        {item.url === "/team-chat" && totalUnreadCount > 0 && !collapsed && (
                          <Badge
                            variant="destructive"
                            className="h-5 min-w-[20px] flex items-center justify-center px-1.5 text-xs font-semibold flex-shrink-0"
                          >
                            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </NavLink>
                  </SidebarMenuItem>
                )
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </div>
  );
};

export function AppSidebar({ className }: { className?: string }) {
  const { state, setState } = useSidebar();
  const location = useLocation();
  const isMobile = useIsMobile();
  const collapseTimer = useRef<NodeJS.Timeout | null>(null);
  const expandTimer = useRef<NodeJS.Timeout | null>(null);
  const collapsed = state === "collapsed";

  const handleMouseEnter = () => {
    if (!isMobile) {
      if (collapseTimer.current) {
        clearTimeout(collapseTimer.current);
        collapseTimer.current = null;
      }
      expandTimer.current = setTimeout(() => {
        setState("expanded");
      }, 5000);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      if (expandTimer.current) {
        clearTimeout(expandTimer.current);
        expandTimer.current = null;
      }
      collapseTimer.current = setTimeout(() => {
        setState("collapsed");
      }, 2000);
    }
  };

  useEffect(() => {
    if (location.pathname === '/sales-tracker') {
      const timer = setTimeout(() => {
        if (!isMobile) setState('collapsed');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, setState, isMobile]);

  if (isMobile) {
    return null;
  }

  return (
    <Sidebar
      className={cn(
        "border-r border-border bg-background transition-all duration-300 ease-in-out h-full",
        collapsed ? "w-16" : "w-64",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarNavContent collapsed={collapsed} />
    </Sidebar>
  );
}