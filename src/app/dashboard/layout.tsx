
"use client";

import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { AppFooter } from '@/components/layout/AppFooter';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AppSidebarNav } from '@/components/layout/AppSidebarNav';


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
            <div className="flex flex-col min-h-screen">
              <AppHeader />
              <main className="w-full flex-1 px-4 sm:px-6 lg:px-8">
                <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                  {children}
                </Suspense>
              </main>
              <AppFooter />
            </div>
          </SidebarInset>
        </div>
        <BottomNavBar />
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
