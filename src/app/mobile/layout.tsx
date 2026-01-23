"use client";

import React from 'react';
import { MobileSidebarProvider, useMobileSidebar } from '@/context/MobileSidebarContext';
import { BreakTimeProvider } from '@/context/BreakTimeContext';
import { MobileDrawerSidebar } from '@/components/mobile/MobileDrawerSidebar';
import { MobileNavbar } from '@/components/mobile/MobileNavbar';
import { InstallPrompt } from '@/components/mobile/InstallPrompt';
import { cn } from '@/lib/utils';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

function MobileLayoutContent({ children }: { children: React.ReactNode }) {
    const { isOpen, toggleSidebar } = useMobileSidebar();
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading, userRole, viewMode } = useAuth();

    // If login page, maybe don't show the sidebar logic? 
    // But wrapper is fine, just contents might handle it.
    const isLoginPage = pathname === '/mobile/login';

    React.useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        };

        const handleDragStart = (e: DragEvent) => {
            e.preventDefault();
        };

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('dragstart', handleDragStart);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('dragstart', handleDragStart);
        };
    }, []);

    // Pages that need the dark blue background to match the header (filling status bar area)
    const isDarkHeaderPage = [
        '/mobile/dashboard',
        '/mobile/notifications',
        '/mobile/directory',
        '/mobile/notice-board',
        '/mobile/attendance/my-attendance',
        '/mobile/attendance/team-attendance',
        '/mobile/attendance/reconciliation/my-applications',
        '/mobile/attendance/reconciliation/approval',
        '/mobile/attendance/remote-approval',
        '/mobile/visit',
        '/mobile/leave/calendar',
        '/mobile/leave/applications',
        '/mobile/leave/subordinate',
        '/mobile/approve',
        '/mobile/service',
        '/mobile/qrcode',
        '/mobile/payroll',
        '/mobile/profile',
        '/mobile/project-management'
    ].some(path => pathname?.startsWith(path));

    React.useEffect(() => {
        if (!loading && !isLoginPage) {
            if (!user) {
                router.replace('/mobile/login');
            } else {
                const isEmployee = userRole?.includes('Employee');
                if (!isEmployee && viewMode !== 'mobile') {
                    router.replace('/dashboard');
                }
            }
        }
    }, [user, loading, router, isLoginPage, userRole, viewMode]);

    if (loading && !isLoginPage) return null;
    if (!user && !isLoginPage) return null;

    if (isLoginPage) return <>{children}</>;

    return (
        <div
            className="fixed inset-0 bg-[#0a1e60] overflow-hidden select-none overscroll-none touch-none"
            style={{
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none'
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* The Sidebar (Backend) */}
            <MobileDrawerSidebar />

            {/* The Main Content (Foreground) */}
            <div
                className={cn(
                    "relative z-10 transition-transform duration-300 ease-out flex flex-col h-full w-full",
                    isDarkHeaderPage ? "bg-[#0a1e60]" : "bg-slate-50",
                    isOpen ? "translate-x-[49%] scale-[0.85] rounded-l-[2.5rem] overflow-hidden shadow-2xl" : "translate-x-0 scale-100 rounded-none shadow-none"
                )}
                style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transformStyle: 'preserve-3d',
                    WebkitTransformStyle: 'preserve-3d',
                }}
            >
                {/* Content */}
                <main className="flex-1 relative overflow-hidden flex flex-col">
                    {children}
                    {/* Overlay to catch clicks when sidebar is open, but allow header interaction (z-50 > z-40) */}
                    {isOpen && (
                        <div
                            className="absolute inset-0 z-40"
                            onClick={toggleSidebar}
                        />
                    )}
                </main>

                {/* Bottom Navbar - usually stays with content or fixed? 
                    In reference, it seems to move with the dashboard (white card).
                    So we place it inside this wrapper.
                */}
                <div className="sticky bottom-0 z-50">
                    <MobileNavbar />
                </div>
            </div>

            {/* PWA Install Prompt */}
            <InstallPrompt />

            {/* Overlay to darken/disable interaction if desired, but 3D effect usually just slides. 
            The pointer-events-none on the active content handles the "don't click links while open" part.
        */}
        </div>
    );
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
    return (
        <MobileSidebarProvider>
            <BreakTimeProvider>
                <MobileLayoutContent>{children}</MobileLayoutContent>
            </BreakTimeProvider>
        </MobileSidebarProvider>
    );
}
