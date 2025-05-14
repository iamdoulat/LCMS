
"use client"; // Make this a client component to use AuthGuard

import type { PropsWithChildren } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebarNav } from '@/components/layout/AppSidebarNav';
import AuthGuard from '@/components/auth/AuthGuard';
// Toaster removed from here as it's now in RootLayout

export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <SidebarProvider defaultOpen>
        <Sidebar>
          <AppSidebarNav />
        </Sidebar>
        <SidebarInset className="flex flex-col">
          <AppHeader />
          <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-background to-muted"> {/* Ensure main has a background */}
            {children}
          </main>
          {/* Toaster removed from here, it's now in RootLayout */}
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
