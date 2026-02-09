
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Search,
    BookOpen,
    Download,
    FileText,
    Film,
    Loader2,
    Settings,
    ChevronRight,
    Building2,
    Wrench,
    Plus,
    Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import type { MachineryCatalogue } from '@/types/warranty';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function MobileCataloguesPage() {
    const router = useRouter();
    const [catalogues, setCatalogues] = useState<MachineryCatalogue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaginating, setIsPaginating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const { userRole } = useAuth();
    const isServiceRole = React.useMemo(() => {
        return userRole?.some(role => ['Admin', 'Service', 'Super Admin', 'Supervisor'].includes(role)) ?? false;
    }, [userRole]);

    const fetchCatalogues = async (isNextPage = false) => {
        if (isNextPage) setIsPaginating(true);
        else setIsLoading(true);

        try {
            let q = query(
                collection(firestore, 'machinery_catalogues'),
                orderBy('createdAt', 'desc'),
                limit(10)
            );

            if (isNextPage && lastDoc) {
                q = query(
                    collection(firestore, 'machinery_catalogues'),
                    orderBy('createdAt', 'desc'),
                    startAfter(lastDoc),
                    limit(10)
                );
            }

            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MachineryCatalogue));

            if (isNextPage) {
                setCatalogues(prev => [...prev, ...data]);
            } else {
                setCatalogues(data);
            }

            setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
            setHasMore(querySnapshot.docs.length === 10);
        } catch (error) {
            console.error("Error fetching catalogues:", error);
        } finally {
            setIsLoading(false);
            setIsPaginating(false);
        }
    };

    useEffect(() => {
        if (!searchQuery) {
            fetchCatalogues();
        }
    }, [searchQuery]);

    const filteredCatalogues = React.useMemo(() => {
        if (!searchQuery) return catalogues;
        const lowerQuery = searchQuery.toLowerCase();
        return catalogues.filter(cat =>
            cat.title?.toLowerCase().includes(lowerQuery) ||
            cat.subtitle?.toLowerCase().includes(lowerQuery) ||
            cat.machineModels?.some(m => m.toLowerCase().includes(lowerQuery)) ||
            cat.brand?.toLowerCase().includes(lowerQuery)
        );
    }, [searchQuery, catalogues]);

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
                            <h1 className="text-2xl font-black text-white tracking-tight">Catalogues</h1>
                            <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">Technical Resources</p>
                        </div>
                    </div>

                    {isServiceRole && (
                        <button
                            onClick={() => router.push('/mobile/service/catalogues/add')}
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
                        placeholder="Search model, brand, or name..."
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
                        <p className="font-bold text-sm">Fetching catalogues...</p>
                    </div>
                ) : filteredCatalogues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-12 text-center text-slate-400">
                        <div className="bg-slate-100 p-6 rounded-[2.5rem] mb-4">
                            <BookOpen className="h-12 w-12 opacity-20" />
                        </div>
                        <p className="font-bold text-slate-600">No Catalogues Found</p>
                        <p className="text-xs mt-1">Try searching for a different model or brand.</p>
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {filteredCatalogues.map((cat) => (
                            <div
                                key={cat.id}
                                className="bg-white p-5 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 active:scale-[0.98] transition-all relative overflow-hidden flex flex-col"
                            >
                                <div className="flex gap-4">
                                    {/* Thumbnail */}
                                    <div className="w-[85px] h-[120px] bg-slate-100 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm border border-slate-100">
                                        {cat.thumbnailUrl ? (
                                            <img src={cat.thumbnailUrl} alt={cat.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <BookOpen className="h-8 w-8" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1.5 mb-1">
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none text-[9px] font-bold px-1.5 py-0">
                                                    {cat.brand}
                                                </Badge>
                                                {cat.category && (
                                                    <Badge variant="outline" className="text-[9px] text-slate-400 border-slate-200 px-1.5 py-0">
                                                        {cat.category}
                                                    </Badge>
                                                )}
                                            </div>
                                            {isServiceRole && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/mobile/service/catalogues/edit/${cat.id}`);
                                                    }}
                                                    className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:text-blue-600 active:scale-90 transition-all border border-slate-100"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <h3 className="text-sm font-black text-slate-800 line-clamp-2 leading-tight">
                                            {cat.title}
                                        </h3>
                                        <p className="text-[10px] text-slate-400 font-medium mt-1 line-clamp-1 italic">
                                            {cat.subtitle}
                                        </p>

                                        {/* Models */}
                                        <div className="mt-3 flex flex-wrap gap-1">
                                            {cat.machineModels?.slice(0, 3).map((model, idx) => (
                                                <span key={idx} className="px-1.5 py-0.5 bg-slate-50 rounded text-[8px] font-black text-slate-500 border border-slate-100 uppercase">
                                                    {model}
                                                </span>
                                            ))}
                                            {cat.machineModels && cat.machineModels.length > 3 && (
                                                <span className="text-[8px] font-bold text-slate-400 pl-1">+{cat.machineModels.length - 3}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="grid grid-cols-3 gap-2 mt-5">
                                    <a
                                        href={cat.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex flex-col items-center justify-center p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm hover:scale-[1.02] transition-transform"
                                    >
                                        <Download className="h-5 w-5 mb-1" />
                                        <span className="text-[9px] font-black uppercase">Catalogue</span>
                                    </a>
                                    <a
                                        href={cat.insManualsUrl || '#'}
                                        onClick={(e) => !cat.insManualsUrl && e.preventDefault()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-2xl border shadow-sm hover:scale-[1.02] transition-transform",
                                            cat.insManualsUrl
                                                ? "bg-amber-50 text-amber-600 border-amber-100"
                                                : "bg-slate-50 text-slate-300 border-slate-100"
                                        )}
                                    >
                                        <FileText className="h-5 w-5 mb-1" />
                                        <span className="text-[9px] font-black uppercase">Manual</span>
                                    </a>
                                    <a
                                        href={cat.videoUrl || '#'}
                                        onClick={(e) => !cat.videoUrl && e.preventDefault()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-2xl border shadow-sm hover:scale-[1.02] transition-transform",
                                            cat.videoUrl
                                                ? "bg-purple-50 text-purple-600 border-purple-100"
                                                : "bg-slate-50 text-slate-300 border-slate-100"
                                        )}
                                    >
                                        <Film className="h-5 w-5 mb-1" />
                                        <span className="text-[9px] font-black uppercase">Video</span>
                                    </a>
                                </div>
                            </div>
                        ))}

                        {/* Pagination */}
                        {!searchQuery && hasMore && (
                            <div className="py-6 flex justify-center">
                                <Button
                                    onClick={() => fetchCatalogues(true)}
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
                                            <ChevronRight className="h-5 w-5 rotate-90" />
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
