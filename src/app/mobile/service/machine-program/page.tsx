"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Search,
    FileCode,
    Factory as FactoryIcon,
    Laptop,
    Hash,
    CalendarDays,
    Loader2,
    ChevronDown,
    User,
    Phone,
    FileText,
    Edit2,
    Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, limit, startAfter, Timestamp, QueryDocumentSnapshot } from 'firebase/firestore';
import { format, parseISO, isValid, getYear, isBefore, isAfter, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import type { DemoMachineApplicationDocument } from '@/types';

type ApplicationStatus = "Upcoming" | "Overdue";

const getApplicationStatus = (deliveryDate?: string | null): ApplicationStatus | null => {
    if (!deliveryDate) return null;
    try {
        const delivery = startOfDay(parseISO(deliveryDate));
        const today = startOfDay(new Date());

        if (!isValid(delivery)) return null;

        if (isBefore(delivery, today)) return "Overdue";
        if (isAfter(delivery, today)) return "Upcoming";
        return null; // Today is neither upcoming nor overdue
    } catch {
        return null;
    }
};

const SewingMachine = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M3 21h18" />
        <path d="M6 21V7c0-1.1.9-2 2-2h11a2 2 0 0 1 2 2v5" />
        <path d="M10 5v4" />
        <path d="M15 5v4" />
        <path d="M12 12h5a2 2 0 0 1 2 2v3" />
        <circle cx="9" cy="12" r="1" />
    </svg>
);

export default function MobileMachineProgramPage() {
    const router = useRouter();
    const [applications, setApplications] = useState<DemoMachineApplicationDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaginating, setIsPaginating] = useState(false);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Upcoming' | 'Overdue'>('All');

    const fetchApplications = useCallback(async (isNextPage = false) => {
        if (isNextPage) setIsPaginating(true);
        else setIsLoading(true);

        try {
            const applicationsCollection = collection(firestore, "demo_machine_applications");
            let q = query(applicationsCollection, orderBy("createdAt", "desc"), limit(10));

            if (isNextPage && lastVisible) {
                q = query(applicationsCollection, orderBy("createdAt", "desc"), startAfter(lastVisible), limit(10));
            }

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                if (!isNextPage) setApplications([]);
                setHasMore(false);
                setLastVisible(null);
                return;
            }

            const newApplications = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    deliveryDate: data.deliveryDate instanceof Timestamp ? data.deliveryDate.toDate().toISOString() : data.deliveryDate,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                } as DemoMachineApplicationDocument;
            });

            if (isNextPage) {
                setApplications(prev => [...prev, ...newApplications]);
            } else {
                setApplications(newApplications);
            }

            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === 10);

        } catch (error) {
            console.error("Error fetching machine programs:", error);
        } finally {
            setIsLoading(false);
            setIsPaginating(false);
        }
    }, [lastVisible]);

    useEffect(() => {
        fetchApplications();
    }, []);

    const filteredApplications = applications.filter(app => {
        // Search filter
        const matchesSearch = !searchQuery ||
            app.factoryName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            app.appliedMachines?.some(m =>
                m.machineModel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.machineBrand?.toLowerCase().includes(searchQuery.toLowerCase())
            );

        // Status filter
        if (statusFilter === 'All') return matchesSearch;

        const status = getApplicationStatus(app.deliveryDate);
        if (statusFilter === 'Upcoming') return matchesSearch && status === 'Upcoming';
        if (statusFilter === 'Overdue') return matchesSearch && status === 'Overdue';

        return matchesSearch;
    });

    const formatYear = (dateString?: string | null): string => {
        if (!dateString) return 'N/A';
        try {
            const date = parseISO(dateString);
            return isValid(date) ? getYear(date).toString() : 'N/A';
        } catch {
            return 'N/A';
        }
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
                            <h1 className="text-2xl font-black text-white tracking-tight">Machine Program</h1>
                            <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">Demo Applications</p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push('/mobile/service/machine-program/add')}
                        className="p-3 bg-white/10 text-white rounded-2xl active:scale-95 transition-all backdrop-blur-md border border-white/10"
                    >
                        <Plus className="h-6 w-6" />
                    </button>
                </div>

                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-blue-400/50" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search factory, model or brand..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-14 bg-white/10 border border-white/10 rounded-[1.25rem] pl-12 pr-4 text-white placeholder:text-blue-400/30 focus:ring-2 focus:ring-blue-500/50 transition-all outline-none backdrop-blur-md text-sm font-medium"
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mt-4">
                    {(['All', 'Upcoming', 'Overdue'] as const).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setStatusFilter(filter)}
                            className={`flex-1 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${statusFilter === filter
                                    ? 'bg-white text-[#0a1e60] shadow-lg'
                                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                                }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto pb-24 shadow-inner mt-2">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="relative">
                            <div className="h-16 w-16 border-4 border-blue-100 border-t-[#0a1e60] rounded-full animate-spin" />
                            <FileCode className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-[#0a1e60]" />
                        </div>
                        <p className="text-slate-500 font-black animate-pulse">Fetching programs...</p>
                    </div>
                ) : filteredApplications.length === 0 ? (
                    <div className="mx-6 mt-12 flex flex-col items-center justify-center p-12 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-sm text-center">
                        <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <FileCode className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">No Programs Found</h3>
                        <p className="text-slate-500 font-medium">Try adjusting your search terms.</p>
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {filteredApplications.map((app) => {
                            const mainMachine = app.appliedMachines?.[0];
                            const status = getApplicationStatus(app.deliveryDate);
                            return (
                                <div
                                    key={app.id}
                                    className="bg-white p-5 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 hover:border-[#0a1e60]/20 active:scale-[0.98] transition-all group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <FileCode size={80} className="text-[#0a1e60]" />
                                    </div>

                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100/50 shadow-sm group-hover:scale-110 transition-transform">
                                                <FactoryIcon className="h-6 w-6 text-[#0a1e60]" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-black text-[#0a1e60] text-base leading-tight">
                                                        {app.factoryName || 'N/A'}
                                                    </h3>
                                                    {status && (
                                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${status === 'Overdue'
                                                            ? 'bg-red-50 text-red-600 border border-red-200'
                                                            : 'bg-blue-50 text-blue-600 border border-blue-200'
                                                            }`}>
                                                            {status}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                    {app.appliedMachines.length > 1 ? `${app.appliedMachines.length} Machines` : 'Single Machine'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/mobile/service/machine-program/edit/${app.id}`);
                                            }}
                                            className="relative z-10 bg-blue-50 text-[#0a1e60] p-2.5 rounded-xl active:scale-90 transition-all shadow-sm border border-blue-100"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {/* Machine Details */}
                                        {app.appliedMachines?.map((machine, index) => (
                                            <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl">
                                                <div className="mt-0.5 p-1.5 bg-white rounded-lg border border-slate-200">
                                                    <SewingMachine className="h-3.5 w-3.5 text-slate-500" />
                                                </div>
                                                <div className="flex-1 grid grid-cols-2 gap-2">
                                                    <div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Model</p>
                                                        <p className="text-xs font-black text-slate-700">{machine.machineModel || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Brand</p>
                                                        <p className="text-xs font-black text-slate-700">{machine.machineBrand || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Additional Details */}
                                        <div className="mt-4 pt-4 border-t border-dashed border-slate-200 space-y-2">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                                                    <div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Challan</p>
                                                        <p className="text-xs font-black text-slate-700">{app.challanNo || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                                                    <div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Period</p>
                                                        <p className="text-xs font-black text-slate-700">{app.demoPeriodDays || '0'} Day(s)</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex items-center gap-2">
                                                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                                                    <div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">Delivery</p>
                                                        <p className="text-xs font-black text-slate-700">
                                                            {app.deliveryDate ? format(parseISO(app.deliveryDate), 'MMM d, yyyy') : 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                                                    <div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">Est. Return</p>
                                                        <p className="text-xs font-black text-slate-700">
                                                            {app.estReturnDate ? format(parseISO(app.estReturnDate), 'MMM d, yyyy') : 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-dashed border-slate-100">
                                                <div className="grid grid-cols-2 gap-3 mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-3.5 w-3.5 text-slate-400" />
                                                        <div>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">Incharge</p>
                                                            <p className="text-xs font-black text-slate-700">{app.factoryInchargeName || 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                                                        <div>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">Cell</p>
                                                            {app.inchargeCell ? (
                                                                <a href={`tel:${app.inchargeCell}`} className="text-xs font-black text-blue-600 hover:underline">
                                                                    {app.inchargeCell}
                                                                </a>
                                                            ) : (
                                                                <p className="text-xs font-black text-slate-700">N/A</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <User className="h-3.5 w-3.5 text-slate-400" />
                                                    <div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">Delivery Person</p>
                                                        <p className="text-xs font-black text-slate-700">{app.deliveryPersonName || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                {app.notes && (
                                                    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                                                        <p className="text-[9px] font-bold text-amber-600 uppercase leading-none mb-1.5">Results After Test</p>
                                                        <p className="text-xs text-slate-700 leading-relaxed">{app.notes}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Load More Button */}
                        {hasMore && (
                            <div className="mt-8 mb-12 flex justify-center">
                                <Button
                                    onClick={() => fetchApplications(true)}
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
                                            Load More Programs
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {!hasMore && filteredApplications.length > 0 && (
                            <p className="text-center text-slate-400 text-xs mt-8 mb-12 font-bold uppercase tracking-widest">
                                End of List
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
