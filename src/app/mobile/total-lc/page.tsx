"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Banknote,
    Calendar,
    Ship,
    Plane,
    ArrowLeft,
    MoreHorizontal,
    Search,
    ChevronRight,
    X,
    CalendarClock,
    Landmark,
    FileText,
    Globe,
    Link as LinkIcon,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Filter,
    Settings2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, orderBy, query, limit, startAfter, QueryDocumentSnapshot, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { format, parseISO, isValid } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import type { LCEntryDocument, LCStatus } from '@/types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const getStatusBadgeVariant = (status: LCStatus | string): string => {
    switch (status) {
        case 'Draft': return 'bg-blue-50 text-blue-600 border border-blue-100';
        case 'Shipment Pending': return 'bg-[#fbbf24]/10 text-[#f59e0b] border border-[#fbbf24]/30';
        case 'Payment Pending': return 'bg-[#ea580c]/10 text-[#ea580c] border border-[#ea580c]/30';
        case 'Payment Done': return 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30';
        case 'Shipment Done': return 'bg-[#059669]/10 text-[#059669] border border-[#059669]/30';
        default: return 'bg-slate-50 text-slate-500 border border-slate-100';
    }
};

const formatDisplayDate = (dateString?: string) => {
    if (!dateString || !isValid(parseISO(dateString))) return 'N/A';
    try {
        return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch (e) {
        return 'N/A';
    }
};

const getShipmentTermLabel = (term?: string) => {
    if (!term) return null;
    const t = term.toUpperCase();
    if (t.includes("CFR")) return "CFR";
    if (t.includes("CPT")) return "CPT";
    if (t.includes("FOB")) return "FOB";
    if (t.includes("EXW")) return "EXW";
    return term; // Fallback to original if no match
};

const countryColors = [
    { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-600', shadow: 'shadow-indigo-100' },
    { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', shadow: 'shadow-emerald-100' },
    { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', shadow: 'shadow-amber-100' },
    { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', shadow: 'shadow-rose-100' },
    { bg: 'bg-sky-50', border: 'border-sky-100', text: 'text-sky-600', shadow: 'shadow-sky-100' },
];

export default function MobileTotalLCPage() {
    const router = useRouter();
    const { userRole } = useAuth();
    const [lcs, setLcs] = useState<LCEntryDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('Shipment Pending');
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Advanced Filter State
    const [filterApplicant, setFilterApplicant] = useState<string>('All');
    const [filterBeneficiary, setFilterBeneficiary] = useState<string>('All');
    const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
    const [filterTerms, setFilterTerms] = useState<string>('All');
    const [sortBy, setSortBy] = useState<string>('Issue Date');
    const canEdit = useMemo(() => userRole?.some(role => ['Super Admin', 'Admin', 'Commercial'].includes(role)), [userRole]);

    // Pagination State
    const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchLCs = useCallback(async (isManual = false, isLoadMore = false) => {
        if (isLoadMore) setLoadingMore(true);
        else if (isManual) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const constraints: any[] = [
                collection(firestore, "lc_entries")
            ];

            if (filterStatus !== 'All') {
                constraints.push(where("status", "array-contains", filterStatus));
            }

            constraints.push(orderBy("createdAt", "desc"));
            constraints.push(limit(10));

            if (isLoadMore && lastDocRef.current) {
                constraints.push(startAfter(lastDocRef.current));
            }

            const lcQuery = query(constraints[0], ...constraints.slice(1));
            const snapshot = await getDocs(lcQuery);

            const fetchedLcs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as any)
            } as LCEntryDocument));

            if (isLoadMore) {
                setLcs(prev => [...prev, ...fetchedLcs]);
            } else {
                setLcs(fetchedLcs);
            }

            const lastVisible = snapshot.docs[snapshot.docs.length - 1];
            lastDocRef.current = (lastVisible as QueryDocumentSnapshot) || null;
            setHasMore(snapshot.docs.length === 10);

        } catch (error) {
            console.error("Error fetching LCs:", error);
        } finally {
            if (isLoadMore) setLoadingMore(false);
            else if (isManual) setTimeout(() => setIsRefreshing(false), 600);
            else setIsLoading(false);
        }
    }, [filterStatus]);
    // Note: Dependencies are empty because lastDoc is now a Ref

    useEffect(() => {
        const canView = userRole?.some(role => ['Super Admin', 'Admin', 'Commercial', 'Viewer'].includes(role));
        if (!isLoading && !canView && userRole !== null) {
            router.push('/mobile/dashboard');
            return;
        }

        fetchLCs();
    }, [userRole, router, fetchLCs]);

    const toggleCardExpansion = (id: string) => {
        setExpandedCards(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleRefresh = () => {
        fetchLCs(true);
    };

    const filteredLcs = useMemo(() => {
        return lcs.filter(lc => {
            const matchesSearch =
                (lc.documentaryCreditNumber?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (lc.applicantName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (lc.beneficiaryName?.toLowerCase().includes(searchTerm.toLowerCase()));

            const statusArray = Array.isArray(lc.status) ? lc.status : [lc.status];
            const matchesStatus = filterStatus === 'All' || statusArray.includes(filterStatus as LCStatus);

            const matchesApplicant = filterApplicant === 'All' || lc.applicantName === filterApplicant;
            const matchesBeneficiary = filterBeneficiary === 'All' || lc.beneficiaryName === filterBeneficiary;

            let matchesYear = true;
            if (filterYear !== 'All') {
                const date = lc.createdAt && (lc.createdAt as any).toDate ? (lc.createdAt as any).toDate() : new Date(lc.createdAt || '');
                matchesYear = isValid(date) && date.getFullYear().toString() === filterYear;
            }

            const matchesTerms = filterTerms === 'All' || lc.termsOfPay === filterTerms;

            return matchesSearch && matchesStatus && matchesApplicant && matchesBeneficiary && matchesYear && matchesTerms;
        }).sort((a, b) => {
            if (sortBy === 'Amount') {
                return Number(b.amount || 0) - Number(a.amount || 0);
            }
            if (sortBy === 'LC Number') {
                return (a.documentaryCreditNumber || '').localeCompare(b.documentaryCreditNumber || '');
            }
            // Default to Issue Date (createdAt) - stable Timestamp handling
            const dateA = a.createdAt && (a.createdAt as any).toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt && (b.createdAt as any).toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
        });
    }, [lcs, searchTerm, filterStatus, filterApplicant, filterBeneficiary, filterYear, filterTerms, sortBy]);

    const applicants = useMemo(() => Array.from(new Set(lcs.map(lc => lc.applicantName).filter(Boolean))), [lcs]);
    const beneficiaries = useMemo(() => Array.from(new Set(lcs.map(lc => lc.beneficiaryName).filter(Boolean))), [lcs]);
    const years = useMemo(() => Array.from({ length: 2030 - 2015 + 1 }, (_, i) => (2030 - i).toString()), []);

    const clearFilters = () => {
        setSearchTerm('');
        setFilterStatus('Shipment Pending');
        setFilterApplicant('All');
        setFilterBeneficiary('All');
        setFilterYear(new Date().getFullYear().toString());
        setFilterTerms('All');
        setSortBy('Issue Date');
    };

    const LCCardSkeleton = () => (
        <Card className="p-4 rounded-3xl border border-slate-100 shadow-sm bg-white mb-4">
            <div className="flex justify-between items-start mb-4">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-40" />
                </div>
                <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            <div className="space-y-3">
                <div className="flex justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                </div>
            </div>
        </Card>
    );

    return (
        <TooltipProvider>
            <div className="flex flex-col h-screen bg-[#0a1e60]">
                <div className="sticky top-0 z-50 bg-[#0a1e60]">
                    <div className="px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-4 flex items-center justify-between">
                        <button
                            onClick={() => router.back()}
                            className="p-2 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-all active:scale-95"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white">LC OR TT LIST</h1>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRefresh}
                                className={cn(
                                    "p-2.5 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all active:scale-90",
                                    isRefreshing && "animate-spin cursor-not-allowed"
                                )}
                                disabled={isRefreshing}
                            >
                                <RefreshCw className="h-5 w-5 opacity-90" />
                            </button>
                            <Sheet>
                                <SheetTrigger asChild>
                                    <button
                                        className="p-2.5 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all active:scale-90"
                                    >
                                        <Filter className="h-5 w-5 opacity-90" />
                                    </button>
                                </SheetTrigger>
                                <SheetContent side="bottom" className="rounded-t-[2.5rem] h-[85vh] p-0 border-none bg-white overflow-hidden">
                                    <div className="flex flex-col h-full">
                                        <div className="p-6 border-b border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 rounded-lg">
                                                    <Filter className="h-5 w-5 text-blue-600" />
                                                </div>
                                                <SheetTitle className="text-xl font-bold text-slate-800">Filter & Sort Options</SheetTitle>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
                                            {/* Search in Sheet */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">T/T OR L/C Number</label>
                                                <div className="relative">
                                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    <input
                                                        placeholder="Search by L/C No..."
                                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm outline-none"
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Applicant */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Applicant</label>
                                                <select
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none appearance-none"
                                                    value={filterApplicant}
                                                    onChange={(e) => setFilterApplicant(e.target.value)}
                                                >
                                                    <option value="All">All Applicants</option>
                                                    {applicants.map(name => <option key={name} value={name!}>{name}</option>)}
                                                </select>
                                            </div>

                                            {/* Beneficiary */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Beneficiary</label>
                                                <select
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none appearance-none"
                                                    value={filterBeneficiary}
                                                    onChange={(e) => setFilterBeneficiary(e.target.value)}
                                                >
                                                    <option value="All">All Beneficiaries</option>
                                                    {beneficiaries.map(name => <option key={name} value={name!}>{name}</option>)}
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Year</label>
                                                    <select
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none appearance-none"
                                                        value={filterYear}
                                                        onChange={(e) => setFilterYear(e.target.value)}
                                                    >
                                                        <option value="All">All Years</option>
                                                        {years.map(y => <option key={y} value={y!}>{y}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                                                    <select
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none appearance-none"
                                                        value={filterStatus}
                                                        onChange={(e) => setFilterStatus(e.target.value)}
                                                    >
                                                        <option value="All">All Status</option>
                                                        <option value="Shipment Pending">Shipment Pending</option>
                                                        <option value="Payment Pending">Payment Pending</option>
                                                        <option value="Payment Done">Payment Done</option>
                                                        <option value="Shipment Done">Shipment Done</option>
                                                        <option value="Draft">Draft</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Sort By */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort By</label>
                                                <select
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none appearance-none"
                                                    value={sortBy}
                                                    onChange={(e) => setSortBy(e.target.value)}
                                                >
                                                    <option value="Issue Date">Issue Date</option>
                                                    <option value="Amount">Amount (High to Low)</option>
                                                    <option value="LC Number">LC Number</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="p-6 bg-slate-50 mt-auto">
                                            <button
                                                onClick={clearFilters}
                                                className="w-full py-4 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm"
                                            >
                                                <X className="h-4 w-4" />
                                                Clear Filters & Sort
                                            </button>
                                        </div>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto z-10 p-4 pb-32">
                    {/* Search and Filter */}
                    <div className="mb-6 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search LC No, Applicant..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-700"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {['All', 'Draft', 'Shipment Pending', 'Payment Pending', 'Payment Done', 'Shipment Done'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                                        filterStatus === status
                                            ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                            : "bg-white text-slate-600 border border-slate-100 hover:bg-slate-50"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* List of Cards */}
                    <div className="space-y-4">
                        {isLoading ? (
                            <>
                                <LCCardSkeleton />
                                <LCCardSkeleton />
                                <LCCardSkeleton />
                            </>
                        ) : filteredLcs.length > 0 ? (
                            filteredLcs.map((lc) => (
                                <motion.div
                                    key={lc.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Card className="p-5 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 bg-white relative overflow-hidden group/card transition-all duration-300">
                                        <div className="flex justify-between items-start mb-3 relative z-10">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">LC OR TT #</span>
                                                <h3 className="text-base font-bold text-slate-800 leading-tight">
                                                    {lc.documentaryCreditNumber || 'N/A'}
                                                </h3>
                                            </div>
                                            {canEdit && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-[0_4px_10px_rgba(37,99,235,0.3)] active:scale-90 transition-transform">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 shadow-2xl border-slate-100">
                                                        <DropdownMenuItem
                                                            onClick={() => router.push(`/mobile/total-lc/${lc.id}/edit`)}
                                                            className="flex items-center gap-2.5 p-3 rounded-xl focus:bg-blue-50 focus:text-blue-600 cursor-pointer group"
                                                        >
                                                            <Settings2 className="h-4 w-4 text-slate-400 group-focus:text-blue-600" />
                                                            <span className="font-bold text-xs uppercase tracking-wider">Edit Details</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => window.open(`/dashboard/total-lc/${lc.id}/edit`, '_blank')}
                                                            className="flex items-center gap-2.5 p-3 rounded-xl focus:bg-slate-50 cursor-pointer group"
                                                        >
                                                            <Globe className="h-4 w-4 text-slate-400 group-focus:text-slate-600" />
                                                            <span className="font-bold text-xs uppercase tracking-wider">Web Version</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>

                                        {/* Amount Section */}
                                        <div className="mb-3 relative z-10 flex items-center justify-between">
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">USD</span>
                                                <div className="text-2xl font-black text-[#0a1e60] tracking-tighter">
                                                    {lc.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                                </div>
                                            </div>

                                            {lc.latestShipmentDate && (
                                                <div className="flex flex-col items-end px-3 py-1.5 bg-red-50 border border-red-100 rounded-xl">
                                                    <span className="text-[8px] font-black text-red-400 uppercase tracking-widest">LSD#</span>
                                                    <span className="text-[11px] font-black text-red-600">
                                                        {formatDisplayDate(lc.latestShipmentDate)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Dashed Separator */}
                                        <div className="border-t border-dashed border-slate-100 my-3" />

                                        {/* Info Section */}
                                        <div className="grid grid-cols-2 gap-4 mb-4 relative z-10">
                                            <div>
                                                <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Applicant</span>
                                                <p className="text-[11px] font-bold text-slate-700 line-clamp-2 leading-snug uppercase">
                                                    {lc.applicantName || 'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Beneficiary</span>
                                                <p className="text-[11px] font-bold text-slate-700 line-clamp-2 leading-snug uppercase">
                                                    {lc.beneficiaryName || 'N/A'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Status Section */}
                                        <div className="flex flex-wrap gap-2 mb-6 relative z-10">
                                            {Array.isArray(lc.status) ? (
                                                lc.status.map(s => (
                                                    <div key={s} className={cn("inline-flex items-center rounded-full px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider w-fit", getStatusBadgeVariant(s))}>
                                                        <div className="w-2 h-2 rounded-full bg-current mr-2 inline-block" />
                                                        {s}
                                                    </div>
                                                ))
                                            ) : lc.status ? (
                                                <div className={cn("inline-flex items-center rounded-full px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider w-fit", getStatusBadgeVariant(lc.status))}>
                                                    <div className="w-2 h-2 rounded-full bg-current mr-2 inline-block" />
                                                    {lc.status}
                                                </div>
                                            ) : null}
                                        </div>

                                        {/* Technical Details Accordion */}
                                        <div className="mb-6 relative z-10">
                                            <button
                                                onClick={() => toggleCardExpansion(lc.id)}
                                                className="flex items-center justify-between w-full px-4 py-2.5 bg-slate-50/80 border border-slate-100 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider">Documents Details</span>
                                                </div>
                                                {expandedCards[lc.id] ? (
                                                    <ChevronUp className="h-4 w-4 text-slate-400" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                                )}
                                            </button>

                                            {expandedCards[lc.id] && (
                                                <div className="mt-2 bg-slate-50/50 border border-slate-100/50 rounded-xl p-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="flex divide-x divide-slate-200/50">
                                                        {/* Left Column: Technical Reference */}
                                                        <div className="flex-1 pr-3 flex flex-col gap-3">
                                                            {/* PI Details */}
                                                            {lc.proformaInvoiceNumber ? (
                                                                <div className="flex flex-col gap-0.5">
                                                                    <div className="flex justify-between items-end">
                                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">PI#</span>
                                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">PI DT#</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-[10px] font-bold text-slate-600 truncate max-w-[80px]">{lc.proformaInvoiceNumber}</span>
                                                                        <span className="text-[10px] font-bold text-slate-600">{formatDisplayDate(lc.invoiceDate)}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col gap-0.5 opacity-30">
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">PI#</span>
                                                                    <span className="text-[10px] font-bold text-slate-300">N/A</span>
                                                                </div>
                                                            )}

                                                            <div className="border-t border-slate-100/50" />

                                                            {/* CI Details */}
                                                            {lc.commercialInvoiceNumber ? (
                                                                <div className="flex flex-col gap-0.5">
                                                                    <div className="flex justify-between items-end">
                                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">CI#</span>
                                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">CI DT#</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-[10px] font-bold text-slate-600 truncate max-w-[80px]">{lc.commercialInvoiceNumber}</span>
                                                                        <span className="text-[10px] font-bold text-slate-600">{formatDisplayDate(lc.commercialInvoiceDate)}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col gap-0.5 opacity-30">
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">CI#</span>
                                                                    <span className="text-[10px] font-bold text-slate-300">N/A</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Right Column: Terms & Shipment */}
                                                        <div className="flex-1 pl-3 flex flex-col gap-3">
                                                            {/* Terms of Pay */}
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Terms of Pay*</span>
                                                                <span className="text-[10px] font-bold text-slate-600 truncate">{lc.termsOfPay || 'N/A'}</span>
                                                            </div>

                                                            <div className="border-t border-slate-100/50" />

                                                            {/* Shipment Terms */}
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Shipment Terms*</span>
                                                                <span className="text-[10px] font-bold text-slate-600 truncate">{lc.shipmentTerms || 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Date Section */}
                                        <div className="flex items-center gap-6 mb-6 relative z-10 text-[10px] font-bold text-slate-400 uppercase">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5" />
                                                <span>Issued: {formatDisplayDate(lc.lcIssueDate)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5" />
                                                <span>Expires: {formatDisplayDate(lc.expireDate)}</span>
                                            </div>
                                        </div>

                                        {/* Certificate of Origin Section */}
                                        {lc.certificateOfOrigin && lc.certificateOfOrigin.length > 0 && (
                                            <div className="mb-6 relative z-10">
                                                <div className="flex flex-wrap gap-2">
                                                    {lc.certificateOfOrigin.map((country, index) => {
                                                        const style = countryColors[index % countryColors.length];
                                                        return (
                                                            <div
                                                                key={`${country}-${index}`}
                                                                className={cn(
                                                                    "inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase shadow-sm transition-all active:scale-95",
                                                                    style.bg,
                                                                    style.border,
                                                                    style.text,
                                                                    `shadow-lg ${style.shadow}/40`
                                                                )}
                                                            >
                                                                {country}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Bottom Action Bar - Dynamic & Scrollable */}
                                        <div className="flex gap-2 relative z-10 overflow-x-auto scrollbar-hide bg-slate-50/50 -mx-5 px-5 py-3 border-t border-slate-100 items-center">
                                            {/* CFR / Shipment Terms */}
                                            {lc.shipmentTerms && getShipmentTermLabel(lc.shipmentTerms) && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="bg-white border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap uppercase flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform">
                                                            {lc.shipmentMode === 'Air' ? <Plane className="h-3.5 w-3.5 text-slate-400" /> : <Ship className="h-3.5 w-3.5 text-slate-400" />}
                                                            {getShipmentTermLabel(lc.shipmentTerms)}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">Shipment Terms: {lc.shipmentTerms}</TooltipContent>
                                                </Tooltip>
                                            )}

                                            {/* ETD/ETA - Popover */}
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <div className="bg-white border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer">
                                                        <CalendarClock className="h-3.5 w-3.5 text-slate-400" /> ETD/ETA
                                                    </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-3" side="top" align="start">
                                                    <div className="space-y-2 text-xs">
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-slate-500 font-semibold uppercase">ETD:</span>
                                                            <span className="font-bold text-slate-800">{formatDisplayDate(lc.etd)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-slate-500 font-semibold uppercase">ETA:</span>
                                                            <span className="font-bold text-slate-800">{formatDisplayDate(lc.eta)}</span>
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>

                                            {/* Maturity - Popover (Dynamic) */}
                                            {lc.termsOfPay?.startsWith("Deferred") && (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <div className="bg-white border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer">
                                                            <Landmark className="h-3.5 w-3.5 text-slate-400" /> Maturity
                                                        </div>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-3" side="top">
                                                        <div className="text-xs">
                                                            <span className="text-slate-500 font-semibold uppercase block mb-1">Maturity Date:</span>
                                                            <span className="font-bold text-slate-800">{lc.paymentMaturityDate || "Not Specified"}</span>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            )}

                                            {/* DHL/FedEx Tracker (Dynamic) */}
                                            {lc.trackingCourier && lc.trackingNumber && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <a
                                                            href={lc.trackingCourier === "DHL" ? `https://www.dhl.com/bd-en/home/tracking.html?tracking-id=${encodeURIComponent(String(lc.trackingNumber || '').trim())}&submit=1` : lc.trackingCourier === "FedEx" ? `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(String(lc.trackingNumber || '').trim())}` : `https://www.ups.com/track?track=yes&trackNums=${encodeURIComponent(String(lc.trackingNumber || '').trim())}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="bg-white border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                                                        >
                                                            <Search className="h-3.5 w-3.5 text-slate-400" /> {lc.trackingCourier}
                                                        </a>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">Track Documents</TooltipContent>
                                                </Tooltip>
                                            )}

                                            {/* Vessel/Air Tracker (Dynamic) */}
                                            {(lc.vesselImoNumber || lc.flightNumber) && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <a
                                                            href={lc.shipmentMode === 'Air' && lc.flightNumber ? `https://www.flightradar24.com/data/flights/${lc.flightNumber}` : `https://www.marinetraffic.com/en/ais/details/ships/imo:${lc.vesselImoNumber}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="bg-white border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                                                        >
                                                            {lc.shipmentMode === 'Air' ? <Plane className="h-3.5 w-3.5 text-slate-400" /> : <Ship className="h-3.5 w-3.5 text-slate-400" />}
                                                            {lc.shipmentMode === 'Air' ? 'Air' : 'Vessel'}
                                                        </a>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">Track {lc.shipmentMode === 'Air' ? 'Flight' : 'Vessel'}</TooltipContent>
                                                </Tooltip>
                                            )}

                                            {/* L/C or T/T Document (Dynamic) */}
                                            {lc.finalLcUrl && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <a href={lc.finalLcUrl} target="_blank" rel="noopener noreferrer" className="bg-white border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap uppercase shadow-sm active:scale-95 transition-transform text-center min-w-[50px]">
                                                            {lc.termsOfPay === 'T/T In Advance' ? 'T/T' : 'L/C'}
                                                        </a>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">View Final {lc.termsOfPay === 'T/T In Advance' ? 'T/T' : 'L/C'}</TooltipContent>
                                                </Tooltip>
                                            )}

                                            {/* PI Document (Dynamic) */}
                                            {lc.finalPIUrl && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <a href={lc.finalPIUrl} target="_blank" rel="noopener noreferrer" className="bg-white border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap uppercase shadow-sm active:scale-95 transition-transform text-center">
                                                            PI
                                                        </a>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">View Proforma Invoice</TooltipContent>
                                                </Tooltip>
                                            )}

                                            {/* DOC Document (Dynamic) */}
                                            {lc.shippingDocumentsUrl && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <a href={lc.shippingDocumentsUrl} target="_blank" rel="noopener noreferrer" className="bg-white border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap uppercase shadow-sm active:scale-95 transition-transform text-center">
                                                            DOC
                                                        </a>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">View Shipping Docs</TooltipContent>
                                                </Tooltip>
                                            )}

                                            {/* PL Document (Dynamic) */}
                                            {lc.packingListUrl && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <a href={lc.packingListUrl} target="_blank" rel="noopener noreferrer" className="bg-white border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap uppercase shadow-sm active:scale-95 transition-transform text-center">
                                                            PL
                                                        </a>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">View Packing List</TooltipContent>
                                                </Tooltip>
                                            )}

                                            {/* OCS/PO Document (Dynamic) */}
                                            {lc.purchaseOrderUrl && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <a href={lc.purchaseOrderUrl} target="_blank" rel="noopener noreferrer" className="bg-white border border-slate-200 text-slate-500 px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap uppercase shadow-sm active:scale-95 transition-transform text-center">
                                                            OCS/PO
                                                        </a>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">View Purchase Order</TooltipContent>
                                                </Tooltip>
                                            )}

                                            {/* Shipment Flags (Always show 1st, 2nd, 3rd) */}
                                            {[
                                                { flag: lc.isFirstShipment, label: "1st", note: lc.firstShipmentNote },
                                                { flag: lc.isSecondShipment, label: "2nd", note: lc.secondShipmentNote },
                                                { flag: lc.isThirdShipment, label: "3rd", note: lc.thirdShipmentNote }
                                            ].map((shipment, idx) => (
                                                <Popover key={idx}>
                                                    <PopoverTrigger asChild>
                                                        <div
                                                            className={cn(
                                                                "h-6 w-6 rounded-full flex items-center justify-center text-[8px] font-black shadow-sm active:scale-95 transition-transform cursor-pointer shrink-0",
                                                                shipment.flag
                                                                    ? "bg-[#10b981] text-white"
                                                                    : "border-2 border-[#ef4444] text-[#ef4444] bg-white font-black"
                                                            )}
                                                        >
                                                            {shipment.label}
                                                        </div>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto max-w-[200px] p-2 text-[10px] font-medium" side="top">
                                                        <div className="space-y-1">
                                                            <p className="font-bold text-slate-500 uppercase">{shipment.label} Shipment</p>
                                                            <p className={cn("text-slate-700", !shipment.note && "italic text-slate-400")}>
                                                                {shipment.note || "No notes available"}
                                                            </p>
                                                            {shipment.flag
                                                                ? <p className="text-green-600 font-bold uppercase">● Shipment Done</p>
                                                                : <p className="text-red-500 font-bold uppercase">● Shipment Pending</p>
                                                            }
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ))}
                                        </div>
                                    </Card>
                                </motion.div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <Banknote className="h-16 w-16 mb-4 opacity-20" />
                                <p className="text-lg font-medium">No LC Records Found</p>
                                <p className="text-sm">Try adjusting your filters or search</p>
                            </div>
                        )}

                        {/* Load More Section */}
                        {hasMore && filteredLcs.length > 0 && (
                            <div className="pt-4 pb-8 flex flex-col items-center">
                                <button
                                    onClick={() => fetchLCs(false, true)}
                                    disabled={loadingMore}
                                    className="px-8 py-3 bg-blue-50 border border-blue-100 rounded-full text-blue-600 font-bold text-sm shadow-sm active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 mb-[5px]"
                                >
                                    {loadingMore ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                                            <span className="animate-pulse">Loading...</span>
                                        </>
                                    ) : (
                                        "Load More"
                                    )}
                                </button>

                            </div>
                        )}

                        {!hasMore && filteredLcs.length > 0 && (
                            <div className="py-8 text-center">
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">End of records</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </TooltipProvider >
    );
}
