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
                <h1 className="text-lg font-bold">Notifications</h1>
            </header>

            {/* Content */}
            <main className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto px-4 pt-6 pb-20 space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-[#0a1e60]" />
                        </div>
                    ) : notices.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            <div className="bg-slate-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                                <Bell className="h-8 w-8 text-slate-400" />
                            </div>
                            <p>No new notifications</p>
                        </div>
                    ) : (
                        notices.map((notice) => (
                            <div
                                key={notice.id}
                                onClick={() => router.push(`/mobile/notice-board/${notice.id}`)}
                                className="bg-white rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer border-l-4 border-blue-500 flex gap-3"
                            >
                                <div className="mt-1">
                                    <div className="bg-blue-50 p-2 rounded-full">
                                        <Bell className="h-4 w-4 text-blue-600" />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-semibold text-slate-900 line-clamp-1 text-sm">{notice.title}</h3>
                                        <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                            {notice.updatedAt ? format(notice.updatedAt.toDate(), 'dd MMM') : ''}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                        {stripHtml(notice.content)}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
