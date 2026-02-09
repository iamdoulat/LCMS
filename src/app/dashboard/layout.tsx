
"use client";

import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { AppFooter } from '@/components/layout/AppFooter';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import React from 'react';
import { AppSidebarNav } from '@/components/layout/AppSidebarNav';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';


interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, loading, userRole, viewMode } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if ((userRole?.includes('Employee') || userRole?.includes('Supervisor')) && viewMode !== 'web') {
        router.replace('/mobile/dashboard');
      }
    }
  }, [user, loading, router, userRole, viewMode]);

  if (loading) return null; // Or a loading spinner
  if (!user) return null;

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
