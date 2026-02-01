"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ChevronLeft, Bell, Calendar as CalendarIcon, ArrowRight, Megaphone, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { NoticeBoardSettings } from '@/types';
import { cn } from '@/lib/utils';
import DOMPurify from 'isomorphic-dompurify';
import { motion, AnimatePresence } from 'framer-motion';

export default function MobileNoticeBoardPage() {
    const router = useRouter();
    const { userRole } = useAuth();
    const [notices, setNotices] = useState<(NoticeBoardSettings & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotices = async () => {
            try {
                const noticesSnapshot = await getDocs(query(collection(firestore, 'site_settings'), orderBy('updatedAt', 'desc')));
                const allNotices = noticesSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as (NoticeBoardSettings & { id: string })[];

                const visibleNotices = allNotices.filter(n =>
                    n.isEnabled &&
                    (!n.targetRoles || (Array.isArray(n.targetRoles) && n.targetRoles.some(role => userRole?.includes(role))))
                );

                setNotices(visibleNotices);
            } catch (error) {
                console.error("Error fetching notices:", error);
            } finally {
                setLoading(false);
            }
        };

        if (userRole) {
            fetchNotices();
        }
    }, [userRole]);

    const stripHtml = (html: string) => {
        if (typeof window === 'undefined') return "";
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60]">
            {/* Header */}
            <header className="bg-gradient-to-r from-[#0a1e60] to-[#1e3a8a] text-white px-5 pt-[calc(env(safe-area-inset-top)+10px)] pb-6 flex items-center shadow-none z-20 shrink-0">
                <button
                    onClick={() => router.back()}
                    className="p-2 mr-3 hover:bg-white/10 rounded-2xl transition-all active:scale-90"
                >
                    <ChevronLeft className="h-6 w-6" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-black tracking-tight">Notice Board</h1>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] text-blue-200 uppercase font-black tracking-widest leading-none">
                            {notices.length} Active Notices
                        </span>
                    </div>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                    <Sparkles className="h-5 w-5 text-yellow-400" />
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-hidden flex flex-col mt-2 relative">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="flex-1 overflow-y-auto px-5 pt-8 pb-32 relative z-10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl scale-150 opacity-50" />
                                <Loader2 className="h-10 w-10 animate-spin text-blue-600 relative z-10" />
                            </div>
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Updating Bulletin...</span>
                        </div>
                    ) : notices.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-3xl p-10 shadow-xl shadow-slate-200/50 text-center border border-slate-100"
                        >
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Bell className="h-10 w-10 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">All Quiet Here</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">No official notices have been posted yet. Check back soon for updates!</p>
                        </motion.div>
                    ) : (
                        <div className="space-y-6">
                            <AnimatePresence>
                                {notices.map((notice, index) => (
                                    <motion.div
                                        key={notice.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1, type: "spring", stiffness: 300, damping: 25 }}
                                        onClick={() => router.push(`/mobile/notice-board/${notice.id}`)}
                                        className="group relative bg-white rounded-[2rem] p-5 shadow-xl shadow-slate-200/40 border border-slate-100 active:scale-[0.97] transition-all cursor-pointer overflow-hidden"
                                    >
                                        {/* Status Glow */}
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-600 to-indigo-600" />

                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors shrink-0">
                                                <Megaphone className="h-6 w-6 text-blue-600 group-hover:text-white transition-colors" />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <h3 className="text-lg font-black text-slate-900 truncate tracking-tight">{notice.title}</h3>
                                                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                                                </div>

                                                <p className="text-sm text-slate-500 line-clamp-2 leading-snug mb-4 font-medium italic">
                                                    "{stripHtml(notice.content)}"
                                                </p>

                                                <div className="flex items-center justify-between mt-auto">
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                                                        <CalendarIcon className="h-3.5 w-3.5 text-blue-500" />
                                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">
                                                            {notice.updatedAt ? format((notice.updatedAt as any).toDate(), 'MMM dd, yyyy') : 'N/A'}
                                                        </span>
                                                    </div>

                                                    <div className="flex -space-x-1.5">
                                                        <div className="w-6 h-6 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-[8px] font-black text-blue-600 uppercase">
                                                            {notice.targetRoles?.[0]?.[0] || 'A'}
                                                        </div>
                                                        <div className="h-6 px-2 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">
                                                            NEW
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Interaction Hover Visual */}
                                        <div className="absolute bottom-0 right-0 w-24 h-24 bg-blue-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity -z-10 translate-x-1/2 translate-y-1/2" />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

