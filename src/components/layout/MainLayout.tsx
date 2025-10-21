"use client";

import React from "react";
import Sidebar from "./Sidebar";
import { MadeWithDyad } from "@/components/made-with-dyad";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <div className="flex-1 p-4 md:p-8">
          {children}
        </div>
        <MadeWithDyad />
      </main>
    </div>
  );
};

export default MainLayout;