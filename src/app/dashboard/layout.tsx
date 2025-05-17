
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
        <SidebarInset className="flex flex-col min-h-screen"> {/* Ensure SidebarInset takes full height */}
          <AppHeader />
          <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-background to-muted"> {/* Ensure main has a background */}
            {children}
          </main>
          <footer className="py-4 px-6 text-center text-sm text-muted-foreground border-t bg-card">
            © 2025 - Designed and Developed by{' '}
            <a
              href="https://vcard.mddoulat.com/iamdoulat"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-primary hover:underline"
            >
              Doulat
            </a>{' '}
            v1.0
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
