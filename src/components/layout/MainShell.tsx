import React from 'react';
import type { ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';

interface MainShellProps {
  children: ReactNode;
}

export const MainShell: React.FC<MainShellProps> = ({ children }) => {

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface antialiased">
      {/* Fixed Sidebar */}
      <AppSidebar />

      {/* Main area pushed right of sidebar */}
      <div className="pl-64">
        {/* Fixed Header */}
        <AppHeader />

        {/* Scrollable content area below fixed header */}
        <main className="w-full pt-14 bg-surface min-h-screen px-space-lg py-space-lg">
          <div className="flex flex-col w-full space-y-space-md">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
