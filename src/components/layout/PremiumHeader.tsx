import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Search, Command, User, Settings, LogOut, Menu, X,
  LayoutDashboard, CheckSquare, Users, Calendar, NotebookText, BarChart3, Mic, PictureInPicture
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EnhancedNotificationBell } from "@/components/common/EnhancedNotificationBell";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePipWidgetManager } from '@/hooks/usePipWidgetManager.tsx';

const navLinks = [
  { href: "/tasks", label: "Tasks", icon: <CheckSquare className="h-5 w-5" /> },
  { href: "/team-chat", label: "Team Chat", icon: <Users className="h-5 w-5" /> },
  { href: "/meetly", label: "Meetly", icon: <Mic className="h-5 w-5" /> },
  { href: "/calendar", label: "Calendar", icon: <Calendar className="h-5 w-5" /> },
  { href: "/notes", label: "Notes", icon: <NotebookText className="h-5 w-5" /> },
  { href: "/analytics", label: "Analytics", icon: <BarChart3 className="h-5 w-5" /> },
];

export function PremiumHeader({ mobileTrigger }: { mobileTrigger?: React.ReactNode }) {
  const { user, userProfile, signOutUser } = useAuth();
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();
  const { isPipSupported, isPipOpen, openPip } = usePipWidgetManager();

  const getPageTitle = () => {
    const path = location.pathname;
    const pageMap: { [key: string]: string } = {
      "/": "Dashboard",
      "/tasks": "Tasks",
      "/timer": "Timer",
      "/chat": "AI Coach",
      "/team-chat": "Team Chat",
      "/meetly": "Meetly",
      "/calendar": "Calendar",
      "/notes": "Notes",
      "/analytics": "Analytics",
      "/profile": "Profile",
    };
    return pageMap[path] || "Dashboard";
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log("Searching for:", searchQuery);
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email.split('@')[0].slice(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 pt-safe">
      <div className="flex h-14 items-center px-4">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {isMobile && mobileTrigger ? (
            mobileTrigger
          ) : (
            <SidebarTrigger className="flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-background hover:bg-accent transition-colors">
              {state === "expanded" ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </SidebarTrigger>
          )}
          
          <div className="hidden md:flex items-center gap-2 text-sm">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              Workspace
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{getPageTitle()}</span>
          </div>
        </div>

        {/* Center Icon Navigation for Desktop */}
        <TooltipProvider delayDuration={0}>
          <nav className="hidden md:flex items-center gap-1 ml-6">
            {navLinks.map((link) => (
              <Tooltip key={link.href}>
                <TooltipTrigger asChild>
                  <Link
                    to={link.href}
                    aria-label={link.label}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent",
                      location.pathname.startsWith(link.href)
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {link.icon}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{link.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </nav>
        </TooltipProvider>

        {/* Right Section Group (pushed to the right) */}
        <div className="ml-auto flex items-center gap-4">
          {/* Search Bar */}
          <div className="w-full max-w-xs">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-sm text-muted-foreground hover:bg-muted"
                >
                  <Search className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Search everything...</span>
                  <span className="sm:hidden">Search...</span>
                  <div className="ml-auto hidden sm:flex items-center gap-1">
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground opacity-100">
                      <Command className="h-3 w-3" />
                      K
                    </kbd>
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="center">
                <form onSubmit={handleSearch} className="p-4">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search tasks, notes, messages..."
                      className="border-0 shadow-none focus-visible:ring-0"
                      autoFocus
                    />
                  </div>
                </form>
              </PopoverContent>
            </Popover>
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-2">
            {isPipSupported && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={openPip}
                      className={cn(
                        "relative hover-scale transition-smooth h-9 w-9",
                        isPipOpen && "text-primary bg-primary/10"
                      )}
                    >
                      <PictureInPicture className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isPipOpen ? "Close Widget" : "Open Task Widget"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <EnhancedNotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={userProfile?.photoURL || user?.photoURL || ""} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(userProfile?.displayName, user?.email)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {userProfile?.displayName && (
                      <p className="font-medium">{userProfile.displayName}</p>
                    )}
                    {user?.email && (
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={signOutUser}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}