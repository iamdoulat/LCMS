"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ChevronLeft, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { NoticeBoardSettings } from '@/types';
import DOMPurify from 'isomorphic-dompurify';
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from 'framer-motion';

export default function MobileNotificationsPage() {
    const router = useRouter();
    const { userRole } = useAuth();
    const [notices, setNotices] = useState<(NoticeBoardSettings & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotices = async () => {
            try {
                const noticesSnapshot = await getDocs(query(collection(firestore, 'site_settings'), orderBy('updatedAt', 'desc')));
                const allNotices = noticesSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as (NoticeBoardSettings & { id: string })[];

                // Filter for enabled notices that target the current user's role
                const visibleNotices = allNotices.filter(n =>
                    n.isEnabled &&
                    (!n.targetRoles || (Array.isArray(n.targetRoles) && n.targetRoles.some(role => userRole?.includes(role))))
                );

                setNotices(visibleNotices);

                // Mark latest notice as seen
                if (visibleNotices.length > 0) {
                    localStorage.setItem('mobile_last_seen_notice_id', visibleNotices[0].id);
                }
            } catch (error) {
                console.error("Error fetching notifications:", error);
            } finally {
                setLoading(false);
            }
        };

        if (userRole) {
            fetchNotices();
        }
    }, [userRole]);

    const stripHtml = (html: string) => {
        try {
            const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
            return clean || "";
        } catch (e) {
            return "";
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
                    ) : notices.length === 0 ? (
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
                            {notices.map((notice, idx) => (
                                <motion.div
                                    key={notice.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => router.push(`/mobile/notice-board/${notice.id}`)}
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
                                                {notice.updatedAt ? format(notice.updatedAt.toDate(), 'dd MMM') : ''}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed opacity-80">
                                            {stripHtml(notice.content)}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </main>
        </div>
    );
}
