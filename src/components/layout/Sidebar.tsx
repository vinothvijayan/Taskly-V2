"use client";

import React from "react";
import { Link } from "react-router-dom";
import { Home, Settings, Bot, LayoutDashboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const NavLink: React.FC<NavLinkProps> = ({ to, icon, label, onClick }) => (
  <Button
    asChild
    variant="ghost"
    className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    onClick={onClick}
  >
    <Link to={to} className="flex items-center gap-3">
      {icon}
      {label}
    </Link>
  </Button>
);

const SidebarContent: React.FC<{ onLinkClick?: () => void }> = ({ onLinkClick }) => (
  <ScrollArea className="h-full py-4">
    <div className="flex flex-col gap-2 px-4">
      <h2 className="mb-4 text-lg font-semibold text-sidebar-primary">Dyad App</h2>
      <NavLink to="/" icon={<Home className="h-5 w-5" />} label="Dashboard" onClick={onLinkClick} />
      <NavLink to="/ai-features" icon={<Bot className="h-5 w-5" />} label="AI Features" onClick={onLinkClick} />
      <NavLink to="/settings" icon={<Settings className="h-5 w-5" />} label="Settings" onClick={onLinkClick} />
    </div>
  </ScrollArea>
);

const Sidebar: React.FC = () => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleLinkClick = () => {
    if (isMobile) {
      setIsOpen(false);
    }
  };

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50 md:hidden">
            <LayoutDashboard className="h-6 w-6" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar-background border-r border-sidebar-border">
          <SidebarContent onLinkClick={handleLinkClick} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 border-r bg-sidebar-background border-sidebar-border">
      <SidebarContent />
    </aside>
  );
};

export default Sidebar;