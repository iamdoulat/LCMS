"use client";

import React from 'react';
import { MobileSidebarProvider, useMobileSidebar } from '@/context/MobileSidebarContext';
import { MobileDrawerSidebar } from '@/components/mobile/MobileDrawerSidebar';
import { MobileNavbar } from '@/components/mobile/MobileNavbar';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

function MobileLayoutContent({ children }: { children: React.ReactNode }) {
    const { isOpen, toggleSidebar } = useMobileSidebar();
    const pathname = usePathname();

    // If login page, maybe don't show the sidebar logic? 
    // But wrapper is fine, just contents might handle it.
    const isLoginPage = pathname === '/mobile/login';

    if (isLoginPage) return <>{children}</>;

    return (
        <div className="relative min-h-screen bg-[#4c35de] overflow-hidden">
            {/* The Sidebar (Backend) */}
            <MobileDrawerSidebar />

            {/* The Main Content (Foreground) */}
            <div
                className={cn(
                    "relative z-10 transition-transform duration-300 ease-out min-h-screen bg-slate-50 flex flex-col",
                    isOpen ? "translate-x-[49%] scale-[0.85] rounded-l-[2.5rem] overflow-hidden shadow-2xl h-screen" : "translate-x-0 scale-100 rounded-none shadow-none"
                )}
            >
                {/* Content */}
                <main className="flex-1 relative">
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

            {/* Overlay to darken/disable interaction if desired, but 3D effect usually just slides. 
            The pointer-events-none on the active content handles the "don't click links while open" part.
        */}
        </div>
    );
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
    return (
        <MobileSidebarProvider>
            <MobileLayoutContent>{children}</MobileLayoutContent>
        </MobileSidebarProvider>
    );
}
