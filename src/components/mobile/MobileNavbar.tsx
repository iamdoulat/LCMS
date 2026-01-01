"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, ClipboardList, Calendar, Wallet, Banknote, Wrench } from 'lucide-react';

export function MobileNavbar() {
    const pathname = usePathname();

    const navItems = [
        { href: '/mobile/dashboard', label: 'Home', icon: Home },
        { href: '/mobile/attendance', label: 'Attendance', icon: ClipboardList },
        { href: '/mobile/leave', label: 'Leave', icon: Calendar },
        { href: '/mobile/payroll', label: 'Payroll', icon: Banknote },
        { href: '/mobile/service', label: 'Service', icon: Wrench },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-[#0a1e60] text-white h-[94px] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.2)] z-50 rounded-t-[20px]">
            <div className="relative h-full flex justify-around items-center px-4">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="relative flex flex-col items-center justify-center flex-1"
                        >
                            {/* Active state: elevated circle with label and curve background */}
                            {isActive && (
                                <>
                                    {/* SVG Curve Background - The "Hump" */}
                                    <div className="absolute -top-[55px] left-1/2 -translate-x-1/2 w-[125px] h-[62px] flex justify-center items-end pointer-events-none z-0">
                                        <svg width="100%" height="100%" viewBox="0 0 100 50" preserveAspectRatio="none" className="drop-shadow-sm">
                                            <path d="M0 50 C20 50 20 10 50 10 C80 10 80 50 100 50 V51 H0 Z" fill="#0a1e60" />
                                        </svg>
                                    </div>

                                    {/* Elevated circular background */}
                                    <div className="absolute -top-[57px] flex flex-col items-center animate-in zoom-in-95 duration-300 z-10">
                                        <div className="bg-[#3b82f6] rounded-full p-5 shadow-lg ring-4 ring-[#0a1e60]">
                                            <Icon className="h-8 w-8 text-white" />
                                        </div>
                                        <span className="text-sm font-medium text-white mt-1 whitespace-nowrap drop-shadow-md">
                                            {item.label}
                                        </span>
                                    </div>
                                </>
                            )}

                            {/* Inactive state: regular icon */}
                            {!isActive && (
                                <div className="flex flex-col items-center gap-1.5 transition-all duration-200 hover:text-white/80">
                                    <Icon className="h-[26px] w-[26px] text-white/60" />
                                    <span className="text-sm font-medium text-white/60">
                                        {item.label}
                                    </span>
                                </div>
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>

    );
}
