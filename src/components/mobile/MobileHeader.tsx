"use client";

import React from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMobileSidebar } from '@/context/MobileSidebarContext';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, limit, getDocs, where, onSnapshot, doc } from 'firebase/firestore';
import { NoticeBoardSettings } from '@/types';

export function MobileHeader() {
    const { user, userRole, companyLogoUrl } = useAuth();
    const pathname = usePathname();
    const { toggleSidebar } = useMobileSidebar();
    const isDashboard = pathname === '/mobile/dashboard';
    const [hasUnread, setHasUnread] = React.useState(false);
    const [profileImage, setProfileImage] = React.useState<string | undefined>(user?.photoURL || undefined);
    const [fullName, setFullName] = React.useState<string>(user?.displayName || 'Employee');

    // Send company logo to service worker for notifications
    React.useEffect(() => {
        if (companyLogoUrl && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
                registration.active?.postMessage({
                    type: 'SET_COMPANY_LOGO',
                    logoUrl: companyLogoUrl
                });
            });
        }
    }, [companyLogoUrl]);

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
            if (!user || !userRole) return;

            try {
                // 1. Fetch recent notifications (last 20 to keep it light)
                const q = query(
                    collection(firestore, 'push_notifications'),
                    orderBy('sentAt', 'desc'),
                    limit(20)
                );
                const snapshot = await getDocs(q);

                // 2. Filter visible notifications for this user
                const visibleIds = snapshot.docs
                    .filter(doc => {
                        const n = doc.data();

                        // Check if targeted by User ID
                        if (n.userIds && Array.isArray(n.userIds) && n.userIds.includes(user.uid)) return true;

                        // Check if targeted by Role
                        if (n.targetRoles && Array.isArray(n.targetRoles)) {
                            if (userRole && n.targetRoles.some((role: any) => userRole.includes(role))) return true;
                        }

                        return false;
                    })
                    .map(doc => doc.id);

                if (visibleIds.length === 0) {
                    setHasUnread(false);
                    return;
                }

                // 3. Fetch Read Status for this user
                const readSnap = await getDocs(collection(firestore, `users/${user.uid}/read_notifications`));
                const readSet = new Set(readSnap.docs.map(d => d.id));

                // 4. Check if ANY visible notification is NOT in readSet
                const unreadCount = visibleIds.filter(id => !readSet.has(id)).length;
                const anyUnread = unreadCount > 0;
                setHasUnread(anyUnread);

                // Set PWA App Badge
                if ('setAppBadge' in navigator) {
                    if (unreadCount > 0) {
                        navigator.setAppBadge(unreadCount).catch(e => console.error("Badge error:", e));
                    } else {
                        navigator.clearAppBadge().catch(e => console.error("Badge clear error:", e));
                    }
                }

            } catch (error) {
                console.error("Error checking notifications:", error);
            }
        };

        checkUnreadNotices();

        // Re-check periodically or on focus could be added here
        const interval = setInterval(checkUnreadNotices, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, [user, userRole]);

    return (
        <header
            className="sticky top-0 z-50 bg-[#0a1e60] text-white px-4 pt-[env(safe-area-inset-top)] pb-6 relative transition-all duration-300"
            style={{
                paddingTop: isDashboard ? 'calc(env(safe-area-inset-top) + 20px)' : undefined
            }}
        >
            {/* Status bar filler for Android/Hairlines - ensures no white gap during scroll/pull */}
            <div className="absolute top-[-100px] left-0 right-0 h-[100px] bg-[#0a1e60] -z-10 pointer-events-none" />

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
