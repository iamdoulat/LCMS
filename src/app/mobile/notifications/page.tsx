"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, getDocs, limit, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
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
    const [readIds, setReadIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [selectedNotification, setSelectedNotification] = useState<PushNotification | null>(null);

    useEffect(() => {
        const fetchNotifications = async () => {
            if (!user) return;

            try {
                // 1. Fetch recent notifications (fetch more to ensure we have enough after filtering)
                const q = query(collection(firestore, 'push_notifications'), orderBy('sentAt', 'desc'), limit(100));
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

                    return false;
                });

                // Keep only latest 20
                setNotifications(visibleNotifications.slice(0, 20));

                // Auto-delete excess notifications from DB
                if (visibleNotifications.length > 20) {
                    const toDelete = visibleNotifications.slice(20);
                    // Fire and forget deletion to not block UI
                    Promise.allSettled(toDelete.map(n => deleteDoc(doc(firestore, 'push_notifications', n.id))))
                        .then(() => console.log(`Deleted ${toDelete.length} excess notifications`))
                        .catch(err => console.error("Error deleting excess notifications:", err));
                }

                // 2. Fetch Read Status
                const readSnap = await getDocs(collection(firestore, `users/${user.uid}/read_notifications`));
                const readSet = new Set(readSnap.docs.map(d => d.id));
                setReadIds(readSet);

            } catch (error) {
                console.error("Error fetching notifications:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();
    }, [user, userRole]);

    const handleNotificationClick = async (notice: PushNotification) => {
        setSelectedNotification(notice);

        if (user && !readIds.has(notice.id)) {
            // Mark as read locally
            const newReadIds = new Set(readIds);
            newReadIds.add(notice.id);
            setReadIds(newReadIds);

            // Mark as read in Firestore (fire and forget)
            try {
                await setDoc(doc(firestore, `users/${user.uid}/read_notifications`, notice.id), {
                    readAt: serverTimestamp()
                });
            } catch (e) {
                console.error("Failed to mark as read:", e);
            }
        }
    };

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
                            {notifications.map((notice, idx) => {
                                const isRead = readIds.has(notice.id);
                                return (
                                    <motion.div
                                        key={notice.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        onClick={() => handleNotificationClick(notice)}
                                        className={`bg-white rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer border-l-4 flex gap-3 hover:shadow-md relative ${isRead ? 'border-slate-200' : 'border-blue-500'}`}
                                    >
                                        <div className="mt-1 relative">
                                            <div className={`p-2 rounded-full ${isRead ? 'bg-slate-100' : 'bg-blue-50'}`}>
                                                <Bell className={`h-4 w-4 ${isRead ? 'text-slate-400' : 'text-blue-600'}`} />
                                            </div>
                                            {!isRead && (
                                                <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white bg-red-500 transform translate-x-1/4 -translate-y-1/4" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1 gap-2">
                                                <h3 className={`font-semibold line-clamp-1 text-sm ${isRead ? 'text-slate-600' : 'text-slate-900'}`}>{notice.title}</h3>
                                                <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium shrink-0">
                                                    {notice.sentAt ? format(notice.sentAt.toDate(), 'dd MMM') : ''}
                                                </span>
                                            </div>
                                            <p className={`text-xs line-clamp-2 leading-relaxed ${isRead ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                                                {notice.body}
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
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
