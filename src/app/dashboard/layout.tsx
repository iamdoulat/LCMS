
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebarNav } from '@/components/layout/AppSidebarNav';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import React from 'react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen flex-col bg-background">
        <AppHeader />
        <div className="flex flex-1">
          <Sidebar>
            <AppSidebarNav />
          </Sidebar>
          <SidebarInset>
            <main className="w-full flex-1 px-4 sm:px-6 lg:px-8">
              {children}
            </main>
          </SidebarInset>
        </div>
        <BottomNavBar />
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
