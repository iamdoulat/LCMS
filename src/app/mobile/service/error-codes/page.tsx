
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Search,
    FileCode,
    AlertCircle,
    Wrench,
    Download,
    ChevronDown,
    ChevronUp,
    FileText,
    Loader2,
    Settings,
    ShieldAlert,
    Plus,
    Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import type { ErrorCodeRecord } from '@/types/warranty';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

export default function MobileErrorCodesPage() {
    const router = useRouter();
    const [errorRecords, setErrorRecords] = useState<ErrorCodeRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaginating, setIsPaginating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const { userRole } = useAuth();
    const isServiceRole = React.useMemo(() => {
        return userRole?.some(role => ['Admin', 'Service', 'Super Admin'].includes(role)) ?? false;
    }, [userRole]);

    const fetchErrorCodes = async (isNextPage = false) => {
        if (isNextPage) setIsPaginating(true);
        else setIsLoading(true);

        try {
            let q = query(
                collection(firestore, 'error_codes'),
                orderBy('createdAt', 'desc'),
                limit(10)
            );

            if (isNextPage && lastDoc) {
                q = query(
                    collection(firestore, 'error_codes'),
                    orderBy('createdAt', 'desc'),
                    startAfter(lastDoc),
                    limit(10)
                );
            }

            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ErrorCodeRecord));

            if (isNextPage) {
                setErrorRecords(prev => [...prev, ...data]);
            } else {
                setErrorRecords(data);
            }

            setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
            setHasMore(querySnapshot.docs.length === 10);
        } catch (error) {
            console.error("Error fetching error codes:", error);
        } finally {
            setIsLoading(false);
            setIsPaginating(false);
        }
    };

    useEffect(() => {
        if (!searchQuery) {
            fetchErrorCodes();
        }
    }, [searchQuery]);

    const filteredRecords = React.useMemo(() => {
        if (!searchQuery) return errorRecords;
        const lowerQuery = searchQuery.toLowerCase();
        return errorRecords.filter(rec =>
            rec.errorCode?.toLowerCase().includes(lowerQuery) ||
            rec.machineModel?.toLowerCase().includes(lowerQuery) ||
            rec.brand?.toLowerCase().includes(lowerQuery) ||
            rec.problem?.toLowerCase().includes(lowerQuery) ||
            rec.solution?.toLowerCase().includes(lowerQuery)
        );
    }, [searchQuery, errorRecords]);

    const toggleExpand = (id: string) => {
        setExpandedCard(expandedCard === id ? null : id);
    };

    return (
        <div className="flex flex-col h-full bg-[#0a1e60]">
            {/* Header */}
            <div className="sticky top-0 z-50 px-4 pt-4 pb-6 bg-[#0a1e60]">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-950/50 to-transparent pointer-events-none" />
                <div className="relative flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-3 bg-white/10 text-white rounded-2xl active:scale-95 transition-all backdrop-blur-md border border-white/10"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight">Error Codes</h1>
                            <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">Troubleshooting Hub</p>
                        </div>
                    </div>

                    {isServiceRole && (
                        <button
                            onClick={() => router.push('/mobile/service/error-codes/add')}
                            className="p-3 bg-blue-600 text-white rounded-2xl active:scale-95 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.25)] border border-blue-500/50"
                        >
                            <Plus className="h-6 w-6" />
                        </button>
                    )}
                </div>

                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-blue-400/50" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search code, model, or brand..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-14 bg-white/10 border border-white/10 rounded-[1.25rem] pl-12 pr-4 text-white placeholder:text-blue-400/30 focus:ring-2 focus:ring-blue-500/50 transition-all outline-none backdrop-blur-md text-sm font-medium"
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto pb-32 shadow-inner">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                        <Loader2 className="h-10 w-10 animate-spin text-[#0a1e60]" />
                        <p className="font-bold text-sm">Loading database...</p>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-12 text-center text-slate-400">
                        <div className="bg-slate-100 p-6 rounded-[2.5rem] mb-4">
                            <FileCode className="h-12 w-12 opacity-20" />
                        </div>
                        <p className="font-bold text-slate-600">No Records Found</p>
                        <p className="text-xs mt-1">Try a different error code or machine model.</p>
                    </div>
                ) : (
                    <div className="p-4 space-y-5">
                        {filteredRecords.map((rec) => (
                            <div
                                key={rec.id}
                                className="bg-white rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 overflow-hidden flex flex-col group transition-all"
                            >
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="h-14 w-14 rounded-[1.5rem] bg-rose-50 flex items-center justify-center text-rose-500 shadow-sm border border-rose-100/50">
                                                <FileCode className="h-7 w-7" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <Badge variant="secondary" className="bg-rose-100/50 text-rose-600 border-none text-[8px] font-black px-1.5 py-0 uppercase">
                                                            CODE: {rec.errorCode}
                                                        </Badge>
                                                        <span className="text-[10px] font-bold text-slate-400">{rec.brand}</span>
                                                    </div>
                                                    {isServiceRole && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                router.push(`/mobile/service/error-codes/edit/${rec.id}`);
                                                            }}
                                                            className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:text-blue-600 active:scale-90 transition-all border border-slate-100"
                                                        >
                                                            <Edit3 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                                <h3 className="text-sm font-black text-slate-800 leading-tight">
                                                    {rec.machineModel}
                                                </h3>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Problem */}
                                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 mb-2">
                                        <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block flex items-center gap-1.5">
                                            <AlertCircle className="h-3 w-3 text-rose-500" /> Identified Problem
                                        </Label>
                                        <p className="text-slate-700 text-xs font-semibold leading-relaxed italic border-l-2 border-rose-200 pl-3">
                                            "{rec.problem}"
                                        </p>
                                    </div>

                                    {/* Expandable Solution */}
                                    <div className={cn(
                                        "transition-all duration-300 overflow-hidden",
                                        expandedCard === rec.id ? "max-h-[800px] opacity-100 mt-4 mb-2" : "max-h-0 opacity-0"
                                    )}>
                                        <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-1.5">
                                            <Wrench className="h-3 w-3 text-emerald-500" /> Suggested Solution
                                        </Label>
                                        <div className="bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100/50 text-slate-800 text-xs leading-relaxed whitespace-pre-wrap font-medium">
                                            {rec.solution}
                                        </div>

                                        {rec.fileUrl && (
                                            <a
                                                href={rec.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center w-full mt-4 h-14 rounded-2xl bg-[#0a1e60] text-white font-black text-xs gap-3 shadow-lg shadow-blue-900/10 active:scale-[0.98] transition-all"
                                            >
                                                <Download className="h-4 w-4" /> Download Guide
                                            </a>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => toggleExpand(rec.id)}
                                    className={cn(
                                        "w-full py-4 flex items-center justify-center text-slate-500 font-bold text-xs gap-2 border-t border-slate-100 transition-all",
                                        expandedCard === rec.id ? "bg-slate-50 text-[#0a1e60]" : "bg-white hover:bg-slate-50/50"
                                    )}
                                >
                                    {expandedCard === rec.id ? (
                                        <>Hide Solution <ChevronUp className="h-4 w-4" /></>
                                    ) : (
                                        <>View Solution <ChevronDown className="h-4 w-4" /></>
                                    )}
                                </button>
                            </div>
                        ))}

                        {/* Pagination */}
                        {!searchQuery && hasMore && (
                            <div className="py-6 flex justify-center">
                                <Button
                                    onClick={() => fetchErrorCodes(true)}
                                    disabled={isPaginating}
                                    className="h-14 px-8 rounded-2xl bg-[#0a1e60] text-white font-black shadow-lg hover:bg-blue-900 active:scale-95 transition-all gap-3"
                                >
                                    {isPaginating ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="h-5 w-5" />
                                            Load More
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
