
"use client";

import type { PropsWithChildren } from 'react';
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebarNav } from '@/components/layout/AppSidebarNav';
import AuthGuard from '@/components/auth/AuthGuard';
import { BottomNavBar } from '@/components/layout/BottomNavBar';

export default function DashboardLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [isPrinting, setIsPrinting] = useState(false);

  // Check if the current path is a dedicated print or preview page
  const isPrintPage = pathname.includes('/preview/') || pathname.includes('/print/');

  useEffect(() => {
    const handleBeforePrint = () => {
      setIsPrinting(true);
    };
    const handleAfterPrint = () => {
      setIsPrinting(false);
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // Conditional rendering based on the printing state or dedicated print pages
  if (isPrintPage) {
    // For print pages or when the print dialog is active, render only the children
    // in a basic layout to ensure it's printable.
    return <div className="print-layout">{children}</div>;
  }

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen>
        <Sidebar collapsible="icon">
          <AppSidebarNav />
        </Sidebar>
        <SidebarInset className="flex flex-col min-h-screen">
          <AppHeader />
          <main className="flex-1 overflow-y-auto pt-4 px-6 pb-20 bg-gradient-to-br from-background to-muted noprint">
            {children}
          </main>
          <BottomNavBar />
          <footer className="py-4 px-6 text-center text-sm text-muted-foreground border-t bg-card noprint hidden md:block">
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
