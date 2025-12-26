"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, ChevronLeft, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { NoticeBoardSettings } from '@/types';
import DOMPurify from 'isomorphic-dompurify';

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
                <header className="bg-[#0a1e60] text-white px-4 py-4 sticky top-0 z-10 flex items-center shadow-md">
                    <button onClick={() => router.back()} className="p-1 mr-4 hover:bg-white/10 rounded-full transition-colors">
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-bold">Office Notice</h1>
                </header>
                <div className="flex-1 flex justify-center items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#0a1e60]" />
                </div>
            </div>
        );
    }

    if (!notice) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <header className="bg-[#0a1e60] text-white px-4 py-4 sticky top-0 z-10 flex items-center shadow-md">
                    <button onClick={() => router.back()} className="p-1 mr-4 hover:bg-white/10 rounded-full transition-colors">
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-bold">Office Notice</h1>
                </header>
                <div className="flex-1 flex justify-center items-center text-slate-500">
                    <p>Notice not found.</p>
                </div>
            </div>
        );
    }

    const sanitizedContent = DOMPurify.sanitize(notice.content);

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60]">
            {/* Header */}
            <header className="bg-[#0a1e60] text-white px-4 py-4 flex items-center shadow-none z-10 shrink-0">
                <button
                    onClick={() => router.back()}
                    className="p-1 mr-4 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ChevronLeft className="h-6 w-6" />
                </button>
                <h1 className="text-lg font-bold">Office Notice</h1>
            </header>

            {/* Content */}
            <main className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto px-4 pt-6 pb-20">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100/50">
                        <h2 className="text-xl font-bold text-[#0a1e60] mb-4">{notice.title}</h2>
                        <div
                            className="text-slate-600 leading-relaxed text-sm mb-6 prose prose-slate max-w-none prose-sm"
                            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                        />

                        {/* Footer / Signature placeholder based on image */}
                        <div className="mt-8 mb-6">
                            <p className="text-slate-900 font-semibold text-sm">HR Department</p>
                            <p className="text-slate-500 text-sm">Smart Solution</p>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <div className="bg-slate-50 text-slate-600 text-xs font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-2">
                                <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                                {notice.updatedAt ? format(notice.updatedAt.toDate(), 'dd-MM-yyyy') : 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function CalendarIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
            <path d="M8 14h.01" />
            <path d="M12 14h.01" />
            <path d="M16 14h.01" />
            <path d="M8 18h.01" />
            <path d="M12 18h.01" />
            <path d="M16 18h.01" />
        </svg>
    )
}
