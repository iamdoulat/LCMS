"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, ArrowLeft, Bell, Calendar as CalendarIcon, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { NoticeBoardSettings } from '@/types';
import DOMPurify from 'isomorphic-dompurify';
import { motion, AnimatePresence } from 'framer-motion';

export default function MobileNoticeDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [notice, setNotice] = useState<NoticeBoardSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotice = async () => {
            try {
                const docRef = doc(firestore, 'site_settings', params.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setNotice(docSnap.data() as NoticeBoardSettings);
                } else {
                    console.error("No such notice!");
                }
            } catch (error) {
                console.error("Error fetching notice:", error);
            } finally {
                setLoading(false);
            }
        };

        if (params.id) {
            fetchNotice();
        }
    }, [params.id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <header className="bg-gradient-to-r from-[#0a1e60] to-[#1e3a8a] text-white px-4 py-4 sticky top-0 z-10 flex items-center shadow-lg">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-bold ml-2">Office Notice</h1>
                </header>
                <div className="flex-1 flex justify-center items-center">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-10 w-10 animate-spin text-[#0a1e60]" />
                        <span className="text-sm font-medium text-slate-500">Loading notice...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!notice) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <header className="bg-[#0a1e60] text-white px-4 py-4 sticky top-0 z-10 flex items-center shadow-md">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-bold ml-2">Office Notice</h1>
                </header>
                <div className="flex-1 flex justify-center items-center text-slate-500 px-6 text-center">
                    <div>
                        <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <Bell className="h-8 w-8 text-slate-400" />
                        </div>
                        <p className="text-lg font-semibold text-slate-900">Notice not found</p>
                        <p className="text-sm">The notice you're looking for might have been removed.</p>
                        <button
                            onClick={() => router.back()}
                            className="mt-6 px-6 py-2 bg-[#0a1e60] text-white rounded-full font-medium"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const sanitizedContent = DOMPurify.sanitize(notice.content);

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60]">
            {/* Header */}
            <header className="bg-gradient-to-r from-[#0a1e60] to-[#1e3a8a] text-white px-4 py-4 flex items-center shadow-none z-20 shrink-0">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                >
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold">Notice Details</h1>
                    <p className="text-[10px] text-blue-200 uppercase tracking-widest font-semibold">Official Announcement</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <Megaphone className="h-5 w-5" />
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-hidden flex flex-col mt-2 relative">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none" />

                <div className="flex-1 overflow-y-auto px-5 pt-8 pb-20 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden"
                    >
                        {/* Ribbon / Badge */}
                        <div className="absolute top-0 right-0 overflow-hidden w-20 h-20 pointer-events-none">
                            <div className="absolute top-4 -right-8 w-32 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold py-1 text-center rotate-45 shadow-sm uppercase tracking-tighter">
                                OFFICIAL
                            </div>
                        </div>

                        {/* Title Section */}
                        <div className="mb-8">
                            <motion.h2
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2, duration: 0.4 }}
                                className="text-2xl font-extrabold text-[#0a1e60] leading-tight mb-3"
                            >
                                {notice.title}
                            </motion.h2>

                            {/* Modern Underline / Ribbon Divider */}
                            <div className="relative">
                                <div className="h-1.5 w-20 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 rounded-full" />
                                <div className="absolute -bottom-1 left-0 h-0.5 w-full bg-slate-100 rounded-full -z-10" />
                            </div>
                        </div>

                        {/* Content Section */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4, duration: 0.5 }}
                            className="text-slate-700 leading-relaxed text-base prose prose-slate max-w-none prose-sm font-medium"
                            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                        />

                        {/* Date Footer */}
                        <div className="mt-10 pt-5 border-t border-dashed border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <CalendarIcon className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Posted On</p>
                                    <p className="text-sm font-bold text-slate-700">
                                        {notice.updatedAt ? format((notice.updatedAt as any).toDate(), 'PPP') : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="h-8 w-8 bg-slate-50 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Bottom info */}
                    <p className="mt-8 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest px-10 leading-relaxed">
                        This is a system generated notice. For clarifications, please contact the administration.
                    </p>
                </div>
            </main>
        </div>
    );
}

function MegaphoneIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="m3 11 18-5v12L3 14v-3z" />
            <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </svg>
    )
}
