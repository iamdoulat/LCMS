"use client";

import React from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMobileSidebar } from '@/context/MobileSidebarContext';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react'; // Need Menu icon manually now
import Link from 'next/link';

import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { NoticeBoardSettings } from '@/types';

export function MobileHeader() {
    const { user, userRole } = useAuth();
    const { toggleSidebar } = useMobileSidebar();
    const [hasUnread, setHasUnread] = React.useState(false);

    React.useEffect(() => {
        const checkUnreadNotices = async () => {
            if (!userRole) return;

            try {
                const q = query(
                    collection(firestore, 'site_settings'),
                    orderBy('updatedAt', 'desc'),
                    limit(1)
                );
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    const notice = doc.data() as NoticeBoardSettings;
                    const noticeId = doc.id;

                    // Check if notice targets user
                    const isTargeted = notice.isEnabled &&
                        (!notice.targetRoles || (Array.isArray(notice.targetRoles) && notice.targetRoles.some(role => userRole.includes(role))));

                    if (isTargeted) {
                        const lastSeenId = localStorage.getItem('mobile_last_seen_notice_id');
                        if (lastSeenId !== noticeId) {
                            setHasUnread(true);
                        }
                    }
                }
            } catch (error) {
                console.error("Error checking notifications:", error);
            }
        };

        checkUnreadNotices();
    }, [userRole]);

    return (
        <header className="sticky top-0 z-50 bg-[#0a1e60] text-white px-4 py-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleSidebar();
                        }}
                        className="text-white hover:bg-white/10"
                    >
                        <Menu className="h-10 w-10" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold leading-tight">Hi, {user?.displayName || 'Employee'}</h1>
                        <p className="text-slate-300 text-xs">Explore the dashboard</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link href="/mobile/notifications">
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full h-12 w-12 relative">
                            <Bell className="h-9 w-9" />
                            {/* Notification dot - only show if hasUnread is true */}
                            {hasUnread && (
                                <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-[#0a1e60]" />
                            )}
                        </Button>
                    </Link>
                    <Link href="/mobile/profile">
                        <Avatar className="h-10 w-10 border-2 border-white/20">
                            <AvatarImage src={user?.photoURL || undefined} />
                            <AvatarFallback className="text-slate-900">{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                    </Link>
                </div>
            </div>
        </header>
    );
}
