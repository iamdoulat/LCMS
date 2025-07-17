
import type { PropsWithChildren } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebarNav } from '@/components/layout/AppSidebarNav';
import AuthGuard from '@/components/auth/AuthGuard';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { cn } from '@/lib/utils';

// This is now a server component by default, which is more performant.
// The client-side logic for checking print pages has been removed and
// is now handled by Next.js routing with dedicated layout files.
export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <SidebarProvider defaultOpen>
        <Sidebar collapsible="icon" className="noprint">
          <AppSidebarNav />
        </Sidebar>
        <SidebarInset className={cn("flex flex-col min-h-screen")}>
            <div className="noprint">
              <AppHeader />
            </div>
            <main className="flex-1 overflow-y-auto pt-4 px-6 pb-20 bg-gradient-to-br from-background to-muted">
              {children}
            </main>
            <div className="noprint">
              <BottomNavBar />
              <footer className="py-4 px-6 text-center text-sm text-muted-foreground border-t bg-card hidden md:block">
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
            </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
