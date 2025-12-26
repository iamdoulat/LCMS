"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useMobileSidebar } from '@/context/MobileSidebarContext';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Home, Coffee, Bell, Contact, QrCode, User,
    MessageSquare, Lock, LogOut
} from 'lucide-react';
import { Switch } from "@/components/ui/switch"
import { Button } from '@/components/ui/button';

export function MobileDrawerSidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { setIsOpen } = useMobileSidebar();

    // Menu Items based on the reference image
    const menuItems = [
        { href: '/mobile/dashboard', label: 'Home', icon: Home },
        { href: '/mobile/break', label: 'Break Time', icon: Coffee },
        { href: '/mobile/attendance-reminder', label: 'Attendance Reminder', icon: Bell }, // "Attendance Reminder"
        { href: '/mobile/directory', label: 'Directory', icon: Contact },
        { href: '/mobile/qrcode', label: 'My QR Code', icon: QrCode },
        { href: '/mobile/profile', label: 'My Profile', icon: User },
        { href: '/mobile/notice-board', label: 'My Notice Board', icon: Bell }, // Duplicate icon, maybe MessageSquare or distinct Bell
        { href: '/mobile/change-password', label: 'Change Password', icon: Lock },
    ];

    return (
        <div className="fixed inset-y-0 left-0 w-[49%] bg-[#4c35de] text-white z-0 flex flex-col pt-12 pb-6 px-6 overflow-y-auto">
            {/* Profile Section */}
            <div className="mb-8 flex flex-col">
                <div className="h-16 w-16 rounded-xl overflow-hidden border-2 border-white mb-3">
                    <Avatar className="h-full w-full rounded-none">
                        <AvatarImage src={user?.photoURL || undefined} className="object-cover" />
                        <AvatarFallback className="text-slate-900 rounded-none">{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                </div>
                <h2 className="text-lg font-bold uppercase leading-tight">
                    {user?.displayName || 'MOHAMMAD DOULAT MEAH'}
                </h2>
                <p className="text-white/70 text-xs mt-1">
                    Manager (Commercial & Supplychain), 006
                </p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-4">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    // For reference image, items are just white text/icons.
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-4 text-white hover:text-white/80 transition-colors"
                        >
                            <Icon className="h-5 w-5" />
                            <span className="font-medium text-sm">{item.label}</span>
                        </Link>
                    )
                })}
            </nav>

            {/* Time Format Switch */}
            <div className="bg-white/10 rounded-lg p-1 flex items-center justify-between mt-6 mb-4 w-[160px]">
                <span className="text-xs px-2">12h</span>
                <Switch className="data-[state=checked]:bg-white data-[state=unchecked]:bg-slate-400 h-5 w-9" />
                <span className="text-xs px-2">24h</span>
            </div>

            {/* Logout Button */}
            <Button
                onClick={() => logout()}
                className="bg-white text-[#4c35de] hover:bg-white/90 w-full rounded-xl flex items-center justify-start gap-3 h-12 px-4 shadow-lg"
            >
                <LogOut className="h-5 w-5 rotate-180" /> {/* Icon rotated to look like 'exit' left */}
                <span className="font-bold">Log out</span>
            </Button>

            <p className="text-white/40 text-[10px] mt-4 text-center">Version 22.0.19</p>
        </div>
    );
}
