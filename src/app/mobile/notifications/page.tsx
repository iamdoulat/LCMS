"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ChevronLeft, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from 'framer-motion';

interface PushNotification {
    id: string;
    title: string;
    body: string;
    sentAt: any; // Timestamp
    targetRoles?: string[];
    userIds?: string[];
}

export default function MobileNotificationsPage() {
    const router = useRouter();
    const { userRole, user } = useAuth();
    const [notifications, setNotifications] = useState<PushNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedNotification, setSelectedNotification] = useState<PushNotification | null>(null);

    useEffect(() => {
        const fetchNotifications = async () => {
            if (!user) return;

            try {
                // Fetch recent notifications
                const q = query(collection(firestore, 'push_notifications'), orderBy('sentAt', 'desc'), limit(20)); // Limit if needed
                const snapshot = await getDocs(q);
                const allNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PushNotification[];

                // Filter logic
                const visibleNotifications = allNotifications.filter(n => {
                    // Check if targeted by User ID
                    if (n.userIds && Array.isArray(n.userIds)) {
                        if (n.userIds.includes(user.uid)) return true;
                    }

                    // Check if targeted by Role
                    if (n.targetRoles && Array.isArray(n.targetRoles)) {
                        if (userRole && n.targetRoles.some(role => userRole.includes(role as any))) return true;
                    }

                    // Fallback: If no targets specified, maybe show to all? 
                    // Or strictly hide. Let's assume strict targeting based on our Send API.
                    // If both are empty/null, it might be an orphaned record or "All". 
                    // Our API saves targetRoles for "All", so role check covers it.
                    return false;
                });

                setNotifications(visibleNotifications);

                // Mark latest as seen (optional, logic remains similar)
                if (visibleNotifications.length > 0) {
                    localStorage.setItem('mobile_last_seen_notice_id', visibleNotifications[0].id);
                }

            } catch (error) {
                console.error("Error fetching notifications:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();
    }, [user, userRole]);

    const NotificationSkeleton = () => (
        <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-slate-200 flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-start">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-10" />
                        </div>
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-5/6" />
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60]">
            {/* Header */}
            <header className="bg-[#0a1e60] text-white px-4 pt-1 pb-6 flex items-center z-10 shrink-0">
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => router.back()}
                    className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                >
                    <ChevronLeft className="h-6 w-6" />
                </motion.button>
                <h1 className="text-xl font-bold ml-2">Notifications</h1>
            </header>

            {/* Content */}
            <main className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto px-4 pt-8 pb-20 space-y-3 overscroll-contain">
                    {loading ? (
                        <NotificationSkeleton />
                    ) : notifications.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-20 text-slate-500"
                        >
                            <div className="bg-slate-100 p-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                                <Bell className="h-10 w-10 text-slate-400" />
                            </div>
                            <p className="font-medium">No new notifications</p>
                            <p className="text-xs text-slate-400 mt-1">We'll let you know when something comes up!</p>
                        </motion.div>
                    ) : (
                        <AnimatePresence>
                            {notifications.map((notice, idx) => (
                                <motion.div
                                    key={notice.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => setSelectedNotification(notice)}
                                    className="bg-white rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer border-l-4 border-blue-500 flex gap-3 hover:shadow-md"
                                >
                                    <div className="mt-1">
                                        <div className="bg-blue-50 p-2 rounded-full">
                                            <Bell className="h-4 w-4 text-blue-600" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-semibold text-slate-900 line-clamp-1 text-sm">{notice.title}</h3>
                                            <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2 font-medium">
                                                {notice.sentAt ? format(notice.sentAt.toDate(), 'dd MMM') : ''}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed opacity-80">
                                            {notice.body}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </main>

            <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
                <DialogContent className="w-[90%] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedNotification?.title}</DialogTitle>
                        <DialogDescription>
                            {selectedNotification?.sentAt ? format(selectedNotification.sentAt.toDate(), "PPP p") : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {selectedNotification?.body}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
