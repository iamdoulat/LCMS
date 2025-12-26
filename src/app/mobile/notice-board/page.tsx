"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ChevronLeft, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { NoticeBoardSettings } from '@/types';
import { cn } from '@/lib/utils';
import DOMPurify from 'isomorphic-dompurify'; // using isomorphic-dompurify for safety

export default function MobileNoticeBoardPage() {
    const router = useRouter();
    const { userRole } = useAuth();
    const [notices, setNotices] = useState<(NoticeBoardSettings & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNotices = async () => {
            try {
                // Fetch all notices sorted by date (newest first)
                // Note: We filter by role client-side because filtering by array-contains-any client side is easier 
                // if we also want to order by date without complex composite indexes for every role combination.
                const noticesSnapshot = await getDocs(query(collection(firestore, 'site_settings'), orderBy('updatedAt', 'desc')));

                const allNotices = noticesSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as (NoticeBoardSettings & { id: string })[];

                // Filter for enabled notices that target the current user's role
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

    // Function to strip HTML for the preview
    const stripHtml = (html: string) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    };

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
                <h1 className="text-lg font-bold">Notice Board</h1>
            </header>

            {/* Content */}
            <main className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto px-4 pt-6 pb-20 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-[#0a1e60]" />
                        </div>
                    ) : notices.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            <p>No notices found.</p>
                        </div>
                    ) : (
                        notices.map((notice) => (
                            <div
                                key={notice.id}
                                onClick={() => router.push(`/mobile/notice-board/${notice.id}`)}
                                className="bg-white rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer border border-slate-100/50"
                            >
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="bg-blue-50 p-2.5 rounded-xl shrink-0">
                                        <Bell className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-slate-900 line-clamp-1">{notice.title}</h3>
                                            <div className="flex gap-1 mt-1.5">
                                                <span className="h-1.5 w-1.5 bg-slate-200 rounded-full"></span>
                                                <span className="h-1.5 w-1.5 bg-slate-200 rounded-full"></span>
                                                <span className="h-1.5 w-1.5 bg-slate-200 rounded-full"></span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                            {stripHtml(notice.content)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center">
                                    <div className="bg-slate-50 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                                        <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                                        {notice.updatedAt ? format(notice.updatedAt.toDate(), 'dd-MM-yyyy') : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
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
