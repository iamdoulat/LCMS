
"use client";

import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const AppSidebarNav = dynamic(() => import('@/components/layout/AppSidebarNav'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin" /></div>,
});


interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen flex-col bg-background">
        <div className="flex flex-1">
          <Sidebar>
            <AppSidebarNav />
          </Sidebar>
          <SidebarInset>
            <AppHeader />
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
