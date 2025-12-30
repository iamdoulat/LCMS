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
        <div className="flex flex-col h-screen bg-[#020617] relative overflow-hidden">
            {/* Ultra-Modern Background Elements */}
            <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[10%] right-[-30%] w-[100%] h-[50%] bg-purple-600/20 rounded-full blur-[140px] pointer-events-none" />

            {/* Header - Glassmorphic */}
            <header className="px-6 py-8 flex items-center justify-between z-30 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl text-white active:scale-90 transition-all shadow-xl"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tighter">Bulletin</h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Official Feed</p>
                    </div>
                </div>

                <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Bell className="h-6 w-6 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#020617] rounded-full animate-pulse" />
                </div>
            </header>

            {/* Feature Banner - Glass Card */}
            <div className="px-6 mb-8 z-20">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-2xl relative overflow-hidden"
                >
                    <div className="relative z-10">
                        <h2 className="text-xl font-black text-white mb-2 flex items-center gap-2">
                            Stay Updated <Sparkles className="h-5 w-5 text-yellow-400" />
                        </h2>
                        <p className="text-xs text-white/50 font-medium max-w-[80%] leading-relaxed">
                            Check the latest announcements and stay in the loop with your team.
                        </p>
                    </div>
                    {/* Decorative mega phone in the corner */}
                    <Megaphone className="absolute -bottom-4 -right-4 h-24 w-24 text-white/5 -rotate-12" />
                </motion.div>
            </div>

            {/* List Content */}
            <main className="flex-1 px-6 pb-32 overflow-y-auto space-y-6 z-20">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                        <span className="text-xs font-black text-white/30 uppercase tracking-widest">Syncing Feed...</span>
                    </div>
                ) : notices.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                            <Bell className="h-8 w-8 text-white/20" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">Clear Horizon</h3>
                        <p className="text-xs text-white/40">No new updates at the moment.</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {notices.map((notice, index) => (
                            <motion.div
                                key={notice.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => router.push(`/mobile/notice-board/${notice.id}`)}
                                className="group relative"
                            >
                                <div className="p-6 rounded-[2.2rem] bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-all active:scale-[0.97] cursor-pointer shadow-2xl overflow-hidden">
                                    {/* Neon Accent */}
                                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 via-indigo-500 to-purple-500" />

                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center shadow-lg">
                                                <Megaphone className="h-5 w-5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-black text-white tracking-tight">{notice.title}</h3>
                                                <p className="text-[10px] font-black text-white/30 uppercase tracking-tighter">Announced</p>
                                            </div>
                                        </div>
                                        <div className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-tighter">
                                            NEW
                                        </div>
                                    </div>

                                    <p className="text-sm text-white/60 line-clamp-2 leading-relaxed mb-6 font-medium">
                                        {stripHtml(notice.content)}
                                    </p>

                                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className="h-3.5 w-3.5 text-blue-400" />
                                            <span className="text-[10px] font-black text-white/40 uppercase tracking-tighter">
                                                {notice.updatedAt ? format((notice.updatedAt as any).toDate(), 'MMM dd, yyyy') : 'N/A'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="flex -space-x-2">
                                                {(notice.targetRoles || ['All']).slice(0, 3).map((role, i) => (
                                                    <div key={i} className="w-6 h-6 rounded-full border border-[#020617] bg-slate-800 flex items-center justify-center text-[8px] font-black text-white">
                                                        {role[0].toUpperCase()}
                                                    </div>
                                                ))}
                                            </div>
                                            <ArrowRight className="h-4 w-4 text-white/20 group-hover:text-blue-400 transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )
                }
            </main>

            {/* Bottom Floating Bar Styling */}
            <div className="fixed bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#020617] to-transparent pointer-events-none z-10" />
        </div>
    );
}

