"use client";

import React from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMobileSidebar } from '@/context/MobileSidebarContext';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, limit, getDocs, where, onSnapshot, doc } from 'firebase/firestore';
import { NoticeBoardSettings } from '@/types';

export function MobileHeader() {
    const { user, userRole } = useAuth();
    const { toggleSidebar } = useMobileSidebar();
    const [hasUnread, setHasUnread] = React.useState(false);
    const [profileImage, setProfileImage] = React.useState<string | undefined>(user?.photoURL || undefined);
    const [fullName, setFullName] = React.useState<string>(user?.displayName || 'Employee');

    // Listen for real-time profile image updates
    React.useEffect(() => {
        if (!user?.email) return;

        let unsubscribe: () => void;

        const setupListener = async () => {
            try {
                // Find employee doc by email
                const q = query(
                    collection(firestore, 'employees'),
                    where('email', '==', user.email),
                    limit(1)
                );

                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const empDoc = snapshot.docs[0];

                    // Set up listener on the specific employee document
                    unsubscribe = onSnapshot(doc(firestore, 'employees', empDoc.id), (doc) => {
                        if (doc.exists()) {
                            const data = doc.data();
                            if (data.photoURL) {
                                setProfileImage(data.photoURL);
                            }
                            if (data.fullName) {
                                setFullName(data.fullName);
                            }
                        }
                    });
                }
            } catch (error) {
                console.error("Error setting up profile listener:", error);
            }
        };

        setupListener();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user?.email]);

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
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleSidebar();
                        }}
                        className="text-white hover:bg-white/10 p-0 h-auto w-auto min-w-0 flex items-center justify-center"
                    >
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="!h-7 !w-7"
                        >
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="15" y2="12" />
                            <line x1="3" y1="18" x2="9" y2="18" />
                        </svg>
                    </Button>
                    <div className="flex flex-col max-w-[200px]">
                        <h1 className="text-lg font-bold leading-tight truncate">Hi, {fullName}</h1>
                        <p className="text-slate-300 text-xs">Explore the dashboard</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link href="/mobile/notifications">
                        <Button variant="ghost" className="text-white hover:bg-white/10 rounded-full h-7 w-7 p-0 relative min-w-0 flex items-center justify-center">
                            <Bell className="!h-7 !w-7" />
                            {/* Notification dot - only show if hasUnread is true */}
                            {hasUnread && (
                                <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 border border-[#0a1e60]" />
                            )}
                        </Button>
                    </Link>
                    <Link href="/mobile/profile">
                        <Avatar className="h-10 w-10 border-2 border-white/20">
                            <AvatarImage src={profileImage} />
                            <AvatarFallback className="text-slate-900">{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                    </Link>
                </div>
            </div>
        </header>
    );
}
