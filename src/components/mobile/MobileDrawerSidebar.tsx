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
    LogOut, Trash2, UserCheck, Lock
} from 'lucide-react';
import { Switch } from "@/components/ui/switch"
import { Button } from '@/components/ui/button';
import type { Employee } from '@/types';

export function MobileDrawerSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout, setViewMode } = useAuth();
    const { setIsOpen } = useMobileSidebar();
    const [employee, setEmployee] = useState<Employee | null>(null);

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

            {/* Mobile/Web Mode Switch */}
            <div className="bg-white/10 rounded-lg p-1 flex items-center justify-between mt-6 mb-4 w-[160px]">
                <span className={cn("text-xs px-2 font-medium cursor-pointer transition-colors", pathname.includes('/mobile') ? "text-white" : "text-white/50")}>Mobile</span>
                <Switch
                    checked={!pathname.includes('/mobile')}
                    onCheckedChange={(checked) => {
                        if (checked) {
                            setViewMode('web');
                            router.push('/dashboard');
                        } else {
                            setViewMode('mobile');
                            router.push('/mobile/dashboard');
                        }
                    }}
                    className="data-[state=checked]:bg-white data-[state=unchecked]:bg-slate-400 h-5 w-9"
                />
                <span className={cn("text-xs px-2 font-medium cursor-pointer transition-colors", !pathname.includes('/mobile') ? "text-white" : "text-white/50")}>Web</span>
            </div>

            {/* Clear Cache Button */}
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
                        alert('Failed to clear cache. Please try again.');
                    }
                }}
                className="bg-white/10 text-white hover:bg-white/20 w-full rounded-xl flex items-center justify-start gap-3 h-12 px-4 mb-3"
            >
                <Trash2 className="h-5 w-5" />
                <span className="font-bold">Clear Cache</span>
            </Button>

            {/* Logout Button */}
            <Button
                onClick={() => logout()}
                className="bg-white text-[#4c35de] hover:bg-white/90 w-full rounded-xl flex items-center justify-start gap-3 h-12 px-4 shadow-lg"
            >
                <LogOut className="h-5 w-5 rotate-180" />
                <span className="font-bold">Log out</span>
            </Button>

            <p className="text-white/40 text-[10px] mt-4 text-center">Version v1.1</p>
        </div>
    );
}
