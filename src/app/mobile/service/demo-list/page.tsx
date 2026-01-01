"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Search,
    Filter,
    Loader2,
    X,
    ChevronDown,
    Wrench,
    Building2,
    User,
    ClipboardList,
    AlertTriangle,
    Info,
    Image as ImageIcon,
    ExternalLink,
    FileEdit,
    Trash2,
    Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, Timestamp, limit, startAfter, QueryDocumentSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Swal from 'sweetalert2';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { DemoMachineDocument, DemoMachineStatusOption } from '@/types';
import { demoMachineOwnerOptions, demoMachineStatusOptions } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import Image from 'next/image';

const ALL_STATUSES_VALUE = "__ALL_STATUSES__";
const ALL_OWNERS_VALUE = "__ALL_OWNERS__";

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

export default function MobileDemoListPage() {
    const router = useRouter();
    const [machines, setMachines] = useState<DemoMachineDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaginating, setIsPaginating] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>(ALL_STATUSES_VALUE);
    const [filterOwner, setFilterOwner] = useState<string>(ALL_OWNERS_VALUE);

    const fetchMachines = useCallback(async (isNextPage = false) => {
        if (isNextPage) setIsPaginating(true);
        else setIsLoading(true);

        try {
            const machinesCollection = collection(firestore, "demo_machines");
            const batchSize = 10;
            let q = query(machinesCollection, orderBy("createdAt", "desc"), limit(batchSize));

            if (isNextPage && lastVisible) {
                q = query(machinesCollection, orderBy("createdAt", "desc"), startAfter(lastVisible), limit(batchSize));
            }

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                if (!isNextPage) setMachines([]);
                setHasMore(false);
                setLastVisible(null);
                return;
            }

            const fetchedBatch = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
                    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
                } as DemoMachineDocument;
            });

            if (isNextPage) {
                setMachines(prev => [...prev, ...fetchedBatch]);
            } else {
                setMachines(fetchedBatch);
            }

            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === batchSize);

        } catch (error) {
            console.error("Error fetching demo machines:", error);
        } finally {
            setIsLoading(false);
            setIsPaginating(false);
        }
    }, [lastVisible]);

    useEffect(() => {
        fetchMachines();
    }, []);

    const filteredMachines = useMemo(() => {
        return machines.filter(m => {
            const matchesSearch = !searchQuery ||
                (m.machineModel?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (m.machineBrand?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (m.machineOwner?.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus = filterStatus === ALL_STATUSES_VALUE || m.currentStatus === filterStatus;
            const matchesOwner = filterOwner === ALL_OWNERS_VALUE || m.machineOwner === filterOwner;

            return matchesSearch && matchesStatus && matchesOwner;
        });
    }, [machines, searchQuery, filterStatus, filterOwner]);

    const getStatusStyles = (status?: DemoMachineStatusOption) => {
        switch (status) {
            case 'Available':
                return { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600' };
            case 'Allocated':
                return { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600' };
            case 'Maintenance Mode':
                return { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600' };
            default:
                return { bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-600' };
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
                            <h1 className="text-2xl font-black text-white tracking-tight">Demo List</h1>
                            <p className="text-[10px] font-bold text-teal-400/80 uppercase tracking-[0.2em]">Service & Support</p>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push('/mobile/service/demo-list/add')}
                        className="p-3 bg-white/10 text-white rounded-2xl active:scale-95 transition-all backdrop-blur-md border border-white/10"
                    >
                        <Plus className="h-6 w-6" />
                    </button>

                    <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <SheetTrigger asChild>
                            <button className="p-3 bg-white/10 text-white rounded-2xl active:scale-95 transition-all backdrop-blur-md border border-white/10">
                                <Filter className="h-6 w-6" />
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-[2.5rem] p-8 max-h-[85vh] overflow-y-auto border-none">
                            <SheetHeader className="mb-6 text-left">
                                <SheetTitle className="text-xl font-black text-[#0a1e60]">Filter Machines</SheetTitle>
                                <p className="text-sm text-slate-500 font-medium">Refine your demo machine search.</p>
                            </SheetHeader>

                            <div className="space-y-6 pb-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Status</label>
                                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                                        <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-slate-100 font-bold">
                                            <SelectValue placeholder="All Statuses" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>
                                            {demoMachineStatusOptions.map(opt => (
                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Machine Owner</label>
                                    <Select value={filterOwner} onValueChange={setFilterOwner}>
                                        <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-slate-100 font-bold">
                                            <SelectValue placeholder="All Owners" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_OWNERS_VALUE}>All Owners</SelectItem>
                                            {demoMachineOwnerOptions.map(opt => (
                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    className="w-full h-14 rounded-2xl bg-[#0a1e60] hover:bg-blue-900 text-white font-black text-lg shadow-xl active:scale-95 transition-all mt-4"
                                    onClick={() => setIsFilterOpen(false)}
                                >
                                    Apply Filters
                                </Button>

                                <Button
                                    variant="ghost"
                                    className="w-full h-12 text-slate-400 font-black hover:text-slate-600"
                                    onClick={() => {
                                        setFilterStatus(ALL_STATUSES_VALUE);
                                        setFilterOwner(ALL_OWNERS_VALUE);
                                    }}
                                >
                                    Reset Filters
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-teal-400/50" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search model, brand or owner..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-14 bg-white/10 border border-white/10 rounded-[1.25rem] pl-12 pr-4 text-white placeholder:text-teal-400/30 focus:ring-2 focus:ring-teal-500/50 transition-all outline-none backdrop-blur-md text-sm font-medium shadow-inner"
                    />
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto pb-32 shadow-inner">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="relative">
                            <div className="h-16 w-16 border-4 border-blue-100 border-t-[#0a1e60] rounded-full animate-spin" />
                            <SewingMachine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-[#0a1e60]" />
                        </div>
                        <p className="text-slate-500 font-black animate-pulse">Fetching demo machines...</p>
                    </div>
                ) : filteredMachines.length === 0 ? (
                    <div className="mx-6 mt-12 flex flex-col items-center justify-center p-12 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-sm text-center">
                        <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <SewingMachine className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">No Machines Found</h3>
                        <p className="text-slate-500 font-medium">Try adjusting your filters or search terms.</p>
                    </div>
                ) : (
                    <div className="px-5 pt-8 space-y-5">
                        {filteredMachines.map((machine) => {
                            const statusStyle = getStatusStyles(machine.currentStatus);
                            return (
                                <div
                                    key={machine.id}
                                    className="bg-white p-5 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 hover:border-slate-400 active:scale-[0.98] transition-all group relative overflow-hidden"
                                >
                                    {/* Subtle highlight */}
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-[#0a1e60]/10" />

                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100/50 shadow-sm">
                                                <SewingMachine className="h-6 w-6 text-[#0a1e60]" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-[#0a1e60] text-base leading-tight">
                                                    {machine.machineModel || 'N/A'}
                                                </h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                    {machine.machineBrand || 'Unknown Brand'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className={cn(
                                            "px-3 py-1.5 rounded-xl border flex items-center gap-2 shadow-sm font-black text-[9px]",
                                            statusStyle.bg, statusStyle.border, statusStyle.text
                                        )}>
                                            <div className={cn("h-1.5 w-1.5 rounded-full", statusStyle.text.replace('text-', 'bg-'))} />
                                            <span>{machine.currentStatus || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 mb-4">
                                        <div className="flex-1 space-y-3 bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-100">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <User className="h-3 w-3 text-slate-400" />
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Machine Owner</p>
                                                    </div>
                                                    <p className="text-xs font-black text-slate-700">{machine.machineOwner || 'N/A'}</p>
                                                </div>
                                                <div className="space-y-1 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <ClipboardList className="h-3 w-3 text-slate-400" />
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Serial No</p>
                                                    </div>
                                                    <p className="text-xs font-black text-slate-700">{machine.machineSerial || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {machine.imageUrl && (
                                            <div className="relative h-20 w-20 rounded-[1.5rem] overflow-hidden border border-slate-200 shadow-sm flex-shrink-0">
                                                <Image
                                                    src={machine.imageUrl}
                                                    alt={machine.machineModel || 'Demo machine'}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between gap-3 pt-4 border-t border-dashed border-slate-100">
                                        <Button
                                            className="flex-1 h-12 rounded-2xl bg-emerald-500 hover:bg-blue-600 active:bg-blue-700 text-white font-black text-xs gap-2 shadow-lg transition-all"
                                            onClick={() => router.push(`/mobile/service/demo-list/edit/${machine.id}`)}
                                        >
                                            <FileEdit className="h-4 w-4" />
                                            Edit Machine
                                        </Button>
                                        <Button
                                            className="flex-1 h-12 rounded-2xl bg-emerald-500 hover:bg-blue-600 active:bg-blue-700 text-white font-black text-xs gap-2 shadow-lg transition-all"
                                            onClick={() => {/* View logic or other action */ }}
                                        >
                                            <Info className="h-4 w-4" />
                                            Details
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}

                        {hasMore && (
                            <div className="mt-8 mb-4 flex justify-center">
                                <Button
                                    onClick={() => fetchMachines(true)}
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
                                            Load More Machines
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
