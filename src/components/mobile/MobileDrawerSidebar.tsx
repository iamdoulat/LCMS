"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useMobileSidebar } from '@/context/MobileSidebarContext';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import {
    Home, Coffee, Bell, Contact, QrCode, User,
    LogOut, Trash2, UserCheck, Lock, MessageSquareText
} from 'lucide-react';
import { Switch } from "@/components/ui/switch"
import { Button } from '@/components/ui/button';
import type { Employee } from '@/types';

export function MobileDrawerSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout, setViewMode, appVersion, userRole } = useAuth();
    const { setIsOpen } = useMobileSidebar();
    const [employee, setEmployee] = useState<Employee | null>(null);
    const hasPrivilegedRole = userRole?.some(role =>
        ['Super Admin', 'Admin', 'HR', 'Commercial', 'Service', 'Accounts', 'DemoManager', 'Viewer'].includes(role)
    );
    const isRestrictedRole = (userRole?.includes('Employee') || userRole?.includes('Supervisor')) && !hasPrivilegedRole;

    useEffect(() => {
        async function fetchEmployee() {
            if (!user?.email) return;
            try {
                const q = query(
                    collection(firestore, 'employees'),
                    where('email', '==', user.email),
                    limit(1)
                );
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    setEmployee({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Employee);
                }
            } catch (error) {
                console.error("Error fetching employee for sidebar:", error);
            }
        }
        fetchEmployee();
    }, [user]);

    // Menu Items based on the reference image
    const menuItems = [
        { href: '/mobile/dashboard', label: 'Home', icon: Home },
        { href: '/mobile/directory', label: 'Directory', icon: Contact },
        { href: '/mobile/qrcode', label: 'My QR Code', icon: QrCode },
        { href: '/mobile/profile', label: 'My Profile', icon: User },
        { href: '/mobile/notice-board', label: 'My Notice Board', icon: Bell },
        { href: '/mobile/hrm/feedback-complaint', label: 'Feedback & Complain', icon: MessageSquareText },
        { href: '/mobile/change-password', label: 'Change Password', icon: Lock },
    ];

    return (
        <div className="fixed inset-y-0 left-0 w-[60%] bg-[#4c35de] text-white z-0 flex flex-col pt-12 pb-6 px-6 overflow-y-auto shadow-2xl">
            {/* Profile Section */}
            <div className="mb-8 flex flex-col">
                <div className="h-16 w-16 rounded-xl overflow-hidden border-2 border-white mb-3">
                    <Avatar className="h-full w-full rounded-none">
                        <AvatarImage src={employee?.photoURL || user?.photoURL || undefined} className="object-cover" />
                        <AvatarFallback className="text-slate-900 rounded-none">{employee?.fullName?.charAt(0) || user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                </div>
                <h2 className="text-lg font-bold uppercase leading-tight">
                    {employee?.fullName || user?.displayName || 'MOHAMMAD DOULAT MEAH'}
                </h2>
                <p className="text-white/70 text-xs mt-1">
                    {employee?.designation || 'Manager'}, {employee?.employeeCode || '006'}
                </p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-6 pt-4">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-4 text-white hover:text-white/80 transition-all active:scale-95"
                        >
                            <div className="w-8 flex justify-center">
                                <Icon className="h-6 w-6 opacity-90" />
                            </div>
                            <span className="font-semibold text-base tracking-tight">{item.label}</span>
                        </Link>
                    )
                })}
            </nav>

            <div className="bg-white/10 rounded-lg p-1 flex items-center justify-between mt-6 mb-4 w-[160px]">
                <span className={cn(
                    "text-xs px-2 font-medium transition-colors",
                    !isRestrictedRole && "cursor-pointer",
                    pathname.includes('/mobile') ? "text-white" : "text-white/50"
                )}>
                    Mobile
                </span>
                <Switch
                    checked={!pathname.includes('/mobile')}
                    disabled={isRestrictedRole}
                    onCheckedChange={(checked) => {
                        if (checked) {
                            setViewMode('web');
                            router.push('/dashboard');
                        } else {
                            setViewMode('mobile');
                            router.push('/mobile/dashboard');
                        }
                    }}
                    className="data-[state=checked]:bg-white data-[state=unchecked]:bg-slate-400 h-5 w-9 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className={cn(
                    "text-xs px-2 font-medium transition-colors",
                    !isRestrictedRole && "cursor-pointer",
                    !pathname.includes('/mobile') ? "text-white" : "text-white/50"
                )}>
                    Web
                </span>
            </div>

            {/* Clear Cache Button */}
            <div className="mt-auto">
                <Button
                    onClick={async () => {
                        try {
                            // Clear all caches
                            if ('caches' in window) {
                                const cacheNames = await caches.keys();
                                await Promise.all(
                                    cacheNames.map(cacheName => caches.delete(cacheName))
                                );
                            }

                            // Clear localStorage
                            localStorage.clear();

                            // Clear sessionStorage
                            sessionStorage.clear();

                            // Unregister service workers
                            if ('serviceWorker' in navigator) {
                                const registrations = await navigator.serviceWorker.getRegistrations();
                                await Promise.all(
                                    registrations.map(registration => registration.unregister())
                                );
                            }

                            // Show success message and reload
                            alert('Cache cleared successfully! The app will reload.');
                            window.location.reload();
                        } catch (error) {
                            console.error('Error clearing cache:', error);
                        }
                    }}
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-white/10 hover:text-white gap-4 pl-0"
                >
                    <div className="w-8 flex justify-center">
                        <Trash2 className="h-6 w-6 opacity-90" />
                    </div>
                    <span className="font-semibold text-base tracking-tight">Clear Cache</span>
                </Button>

                <button
                    onClick={logout}
                    className="w-full bg-white rounded-full py-3 flex items-center justify-center gap-4 mt-8 transition-all active:scale-95 shadow-lg"
                >
                    <div className="flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M16 17L21 12L16 7" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M21 12H9" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span className="text-[#3b82f6] text-xl font-bold">Log out</span>
                </button>

                <div className="text-white/40 text-[10px] mt-4 text-center">
                    App Version: {appVersion || 'v1.1'}
                </div>
            </div>
        </div>
    );
}
