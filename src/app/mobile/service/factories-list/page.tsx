"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Search,
    Factory as FactoryIcon,
    MapPin,
    User,
    Phone,
    FileText,
    Loader2,
    ChevronDown,
    Building2,
    Calendar,
    ArrowRight,
    Plus,
    Edit2,
    MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, limit, startAfter, Timestamp, QueryDocumentSnapshot } from 'firebase/firestore';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import type { DemoMachineFactoryDocument } from '@/types';
import Swal from 'sweetalert2';

export default function MobileFactoriesListPage() {
    const router = useRouter();
    const [factories, setFactories] = useState<DemoMachineFactoryDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaginating, setIsPaginating] = useState(false);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const { userRole } = useAuth();
    const canManageFactories = React.useMemo(() => {
        return userRole?.some((role: string) => ['Admin', 'Service', 'Super Admin'].includes(role)) ?? false;
    }, [userRole]);

    const fetchFactories = useCallback(async (isNextPage = false) => {
        if (isNextPage) setIsPaginating(true);
        else setIsLoading(true);

        try {
            const factoriesCollection = collection(firestore, "demo_machine_factories");
            let q = query(factoriesCollection, orderBy("createdAt", "desc"), limit(10));

            if (isNextPage && lastVisible) {
                q = query(factoriesCollection, orderBy("createdAt", "desc"), startAfter(lastVisible), limit(10));
            }

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                if (!isNextPage) setFactories([]);
                setHasMore(false);
                setLastVisible(null);
                return;
            }

            const newFactories = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                } as DemoMachineFactoryDocument;
            });

            if (isNextPage) {
                setFactories(prev => [...prev, ...newFactories]);
            } else {
                setFactories(newFactories);
            }

            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === 10);

        } catch (error) {
            console.error("Error fetching factories:", error);
        } finally {
            setIsLoading(false);
            setIsPaginating(false);
        }
    }, [lastVisible]);

    useEffect(() => {
        fetchFactories();
    }, []);

    const filteredFactories = factories.filter(factory =>
        !searchQuery ||
        factory.factoryName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        factory.factoryLocation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        factory.groupName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatShortDate = (dateInput?: any) => {
        if (!dateInput) return 'N/A';
        let date: Date;
        if (dateInput instanceof Timestamp) date = dateInput.toDate();
        else if (typeof dateInput === 'string') date = parseISO(dateInput);
        else date = new Date(dateInput);

        return isValid(date) ? format(date, 'MMM d, yyyy') : 'N/A';
    };

    const handleShowNote = (factoryName: string, note: string) => {
        Swal.fire({
            title: `<div class="text-[#0a1e60] font-black text-xl mb-2">${factoryName}</div>`,
            html: `
                <div class="text-left p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Factory Note</p>
                    <p class="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">${note}</p>
                </div>
            `,
            showConfirmButton: true,
            confirmButtonText: 'Got it',
            confirmButtonColor: '#0a1e60',
            buttonsStyling: true,
            customClass: {
                popup: 'rounded-[2.5rem] border-none shadow-2xl',
                confirmButton: 'rounded-2xl px-8 py-3 font-bold text-sm'
            },
            showClass: {
                popup: 'animate__animated animate__fadeInUp animate__faster'
            },
            hideClass: {
                popup: 'animate__animated animate__fadeOutDown animate__faster'
            }
        });
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
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
                            <h1 className="text-2xl font-black text-white tracking-tight">Factory List</h1>
                            <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">Demo Machine Directory</p>
                        </div>
                    </div>
                    {canManageFactories && (
                        <button
                            onClick={() => router.push('/mobile/service/factories-list/add')}
                            className="p-3 bg-white/10 text-white rounded-2xl active:scale-95 transition-all backdrop-blur-md border border-white/10"
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
                        placeholder="Search factory, location or group..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-14 bg-white/10 border border-white/10 rounded-[1.25rem] pl-12 pr-4 text-white placeholder:text-blue-400/30 focus:ring-2 focus:ring-blue-500/50 transition-all outline-none backdrop-blur-md text-sm font-medium"
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto pb-24 shadow-inner mt-2">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="relative">
                            <div className="h-16 w-16 border-4 border-blue-100 border-t-[#0a1e60] rounded-full animate-spin" />
                            <FactoryIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-[#0a1e60]" />
                        </div>
                        <p className="text-slate-500 font-black animate-pulse">Fetching factories...</p>
                    </div>
                ) : filteredFactories.length === 0 ? (
                    <div className="mx-6 mt-12 flex flex-col items-center justify-center p-12 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-sm text-center">
                        <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <FactoryIcon className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">No Factories Found</h3>
                        <p className="text-slate-500 font-medium">Try adjusting your search terms.</p>
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {filteredFactories.map((factory) => (
                            <div
                                key={factory.id}
                                className="bg-white p-5 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 hover:border-[#0a1e60]/20 active:scale-[0.98] transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <FactoryIcon size={80} className="text-[#0a1e60]" />
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100/50 shadow-sm group-hover:scale-110 transition-transform">
                                            <FactoryIcon className="h-6 w-6 text-[#0a1e60]" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-[#0a1e60] text-base leading-tight">
                                                {factory.factoryName || 'N/A'}
                                            </h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                {factory.groupName || 'No Group'}
                                            </p>
                                        </div>
                                    </div>
                                    {canManageFactories && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/mobile/service/factories-list/edit/${factory.id}`);
                                            }}
                                            className="relative z-10 bg-blue-50 text-[#0a1e60] p-2.5 rounded-xl active:scale-90 transition-all shadow-sm border border-blue-100"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 p-1.5 bg-slate-100 rounded-lg">
                                            <MapPin className="h-3.5 w-3.5 text-slate-500" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Location</p>
                                            <p className="text-xs font-black text-slate-700 leading-relaxed">
                                                {factory.factoryLocation || 'N/A'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 p-1.5 bg-slate-100 rounded-lg">
                                                <User className="h-3.5 w-3.5 text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Contact</p>
                                                <p className="text-xs font-black text-slate-700 truncate max-w-[100px]">
                                                    {factory.contactPerson || 'N/A'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 p-1.5 bg-slate-100 rounded-lg">
                                                <Phone className="h-3.5 w-3.5 text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Cell</p>
                                                {factory.cellNumber ? (
                                                    <div className="space-y-2">
                                                        <a href={`tel:${factory.cellNumber}`} className="text-xs font-black text-blue-600 hover:underline block">
                                                            {factory.cellNumber}
                                                        </a>
                                                        <a
                                                            href={`https://wa.me/${factory.cellNumber.replace(/\D/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 text-green-600 rounded-lg border border-green-100 active:scale-90 transition-all shadow-sm text-xs font-bold"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <MessageCircle className="h-3.5 w-3.5" />
                                                            WhatsApp
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs font-black text-slate-700">N/A</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-dashed border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3 w-3 text-slate-400" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                                            Added: {formatShortDate(factory.createdAt)}
                                        </span>
                                    </div>
                                    {factory.note && (
                                        <button
                                            onClick={() => handleShowNote(factory.factoryName || 'N/A', factory.note!)}
                                            className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full border border-amber-100 active:scale-95 transition-all shadow-sm"
                                        >
                                            <FileText className="h-3 w-3 text-amber-600" />
                                            <span className="text-[9px] font-black text-amber-700 uppercase tracking-tighter">View Note</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Load More Button */}
                        {hasMore && (
                            <div className="mt-8 mb-12 flex justify-center">
                                <Button
                                    onClick={() => fetchFactories(true)}
                                    disabled={isPaginating}
                                    className="h-14 px-8 rounded-2xl bg-[#0a1e60] text-white font-black shadow-xl hover:bg-blue-900 active:scale-95 transition-all gap-3"
                                >
                                    {isPaginating ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Loading More...
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="h-5 w-5" />
                                            Load More Factories
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {!hasMore && filteredFactories.length > 0 && (
                            <p className="text-center text-slate-400 text-xs mt-8 mb-12 font-bold uppercase tracking-widest">
                                End of List
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
}
