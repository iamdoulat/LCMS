
"use client";

import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { AppFooter } from '@/components/layout/AppFooter';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import React from 'react';
import { AppSidebarNav } from '@/components/layout/AppSidebarNav';
import { ErrorBoundary } from '@/components/ErrorBoundary';


interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <AppSidebarNav />
        </Sidebar>
        <SidebarInset className="flex flex-col w-full max-w-none">
          <AppHeader />
          <ErrorBoundary>
            <main className="flex-1 w-full max-w-none">
              {children}
            </main>
          </ErrorBoundary>
          <AppFooter />
        </SidebarInset>
        <BottomNavBar />
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
