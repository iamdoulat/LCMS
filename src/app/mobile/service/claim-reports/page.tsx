"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Search,
    Filter,
    ListChecks,
    Loader2,
    X,
    ChevronDown,
    FileText,
    Mail,
    User,
    Building2,
    Hash,
    MoreHorizontal,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
    Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type { ClaimReportDocument, SupplierDocument, ClaimStatus } from '@/types';
import { claimStatusOptions } from '@/types';

const ALL_STATUSES_VALUE = "__ALL_STATUSES_CLAIM__";

export default function MobileClaimReportsPage() {
    const router = useRouter();
    const [reports, setReports] = useState<ClaimReportDocument[]>([]);
    const [suppliers, setSuppliers] = useState<{ id: string, name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaginating, setIsPaginating] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [filterClaimNo, setFilterClaimNo] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('');
    const [filterStatus, setFilterStatus] = useState<ClaimStatus | ''>('');

    const fetchInitialData = async () => {
        try {
            const suppliersSnap = await getDocs(collection(firestore, "suppliers"));
            const fetchedSuppliers = suppliersSnap.docs.map(d => ({
                id: d.id,
                name: (d.data() as SupplierDocument).beneficiaryName || 'Unnamed'
            }));
            setSuppliers(fetchedSuppliers);
        } catch (error) {
            console.error("Error fetching suppliers:", error);
        }
    };

    const fetchReports = useCallback(async (isNextPage = false) => {
        if (isNextPage) setIsPaginating(true);
        else setIsLoading(true);

        try {
            const reportsCollection = collection(firestore, "claim_reports");
            const batchSize = 10;
            let q = query(reportsCollection, orderBy("claimDate", "desc"), limit(batchSize));

            if (isNextPage && lastVisible) {
                q = query(reportsCollection, orderBy("claimDate", "desc"), startAfter(lastVisible), limit(batchSize));
            }

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                if (!isNextPage) setReports([]);
                setHasMore(false);
                setLastVisible(null);
                return;
            }

            const fetchedBatch = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            } as ClaimReportDocument));

            if (isNextPage) {
                setReports(prev => [...prev, ...fetchedBatch]);
            } else {
                setReports(fetchedBatch);
            }

            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === batchSize);

        } catch (error) {
            console.error("Error fetching claim reports:", error);
        } finally {
            setIsLoading(false);
            setIsPaginating(false);
        }
    }, [lastVisible]);

    useEffect(() => {
        fetchInitialData();
        fetchReports();
    }, []);

    const filteredReports = useMemo(() => {
        return reports.filter(r => {
            const matchesSearch = !searchQuery ||
                r.claimNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.supplierName?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesClaimNo = !filterClaimNo || r.claimNumber.toLowerCase().includes(filterClaimNo.toLowerCase());
            const matchesSupplier = !filterSupplier || r.supplierName?.toLowerCase().includes(filterSupplier.toLowerCase());
            const matchesStatus = !filterStatus || r.status === filterStatus;

            return matchesSearch && matchesClaimNo && matchesSupplier && matchesStatus;
        });
    }, [reports, searchQuery, filterClaimNo, filterSupplier, filterStatus]);

    const handleViewUrl = (url: string | undefined | null) => {
        if (url && url.trim() !== "") {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    const getStatusStyles = (status: ClaimStatus) => {
        switch (status) {
            case 'Pending':
                return { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', icon: <Clock className="h-3 w-3" /> };
            case 'Complete':
                return { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', icon: <CheckCircle2 className="h-3 w-3" /> };
            case 'Rejected':
                return { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', icon: <AlertCircle className="h-3 w-3" /> };
            default:
                return { bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-600', icon: <Clock className="h-3 w-3" /> };
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#042f2e] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#042f2e] px-4 pt-2 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full active:bg-white/10 transition-colors text-white"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white ml-2 text-shadow-sm flex items-center gap-2">
                            Claim Reports
                        </h1>
                    </div>

                    <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <SheetTrigger asChild>
                            <button className="p-2.5 bg-white/10 text-white rounded-xl active:scale-95 transition-all">
                                <Filter className="h-5 w-5" />
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-[2.5rem] p-8 max-h-[85vh] overflow-y-auto border-none">
                            <SheetHeader className="mb-6 text-left">
                                <SheetTitle className="text-xl font-bold">Filter Claims</SheetTitle>
                                <p className="text-sm text-slate-500">Search and sort through claim reports.</p>
                            </SheetHeader>

                            <div className="space-y-4 pb-8">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Claim Number</label>
                                    <Input
                                        placeholder="Search claim no..."
                                        value={filterClaimNo}
                                        onChange={(e) => setFilterClaimNo(e.target.value)}
                                        className="h-12 rounded-2xl bg-slate-50 border-slate-100"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Supplier</label>
                                    <Select
                                        value={filterSupplier}
                                        onValueChange={setFilterSupplier}
                                    >
                                        <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-100">
                                            <SelectValue placeholder="All Suppliers" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value=" ">All Suppliers</SelectItem>
                                            {suppliers.map(s => (
                                                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Status</label>
                                    <Select
                                        value={filterStatus || ALL_STATUSES_VALUE}
                                        onValueChange={(v) => setFilterStatus(v === ALL_STATUSES_VALUE ? '' : v as ClaimStatus)}
                                    >
                                        <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-100">
                                            <SelectValue placeholder="All Statuses" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>
                                            {claimStatusOptions.map(s => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    className="w-full h-14 rounded-[1.5rem] bg-[#042f2e] hover:bg-teal-900 text-white font-bold text-lg mt-4 shadow-lg active:scale-[0.98] transition-all"
                                    onClick={() => setIsFilterOpen(false)}
                                >
                                    Apply Filters
                                </Button>

                                <Button
                                    variant="ghost"
                                    className="w-full h-10 text-slate-400 font-bold"
                                    onClick={() => {
                                        setFilterClaimNo('');
                                        setFilterSupplier('');
                                        setFilterStatus('');
                                    }}
                                >
                                    Reset Filters
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                    <input
                        type="text"
                        placeholder="Search Claim No, Supplier or Customer..."
                        className="w-full bg-white/10 border-white/20 text-white placeholder:text-white/40 pl-12 pr-4 py-3 rounded-2xl focus:outline-none focus:bg-white/20 transition-all text-sm shadow-inner"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto px-4 pt-8 pb-32">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="relative">
                            <div className="h-16 w-16 border-4 border-teal-100 border-t-[#042f2e] rounded-full animate-spin" />
                            <ListChecks className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-[#042f2e]" />
                        </div>
                        <p className="text-slate-500 font-bold animate-pulse">Loading claim reports...</p>
                    </div>
                ) : filteredReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-sm px-6 text-center">
                        <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <ListChecks className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">No Reports Found</h3>
                        <p className="text-slate-500 font-medium">Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredReports.map((report) => {
                            const statusStyle = getStatusStyles(report.status);
                            return (
                                <div
                                    key={report.id}
                                    className="bg-white p-5 rounded-[2.5rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] border-2 border-[#042f2e]/5 hover:border-[#042f2e]/20 active:scale-[0.98] transition-all group relative overflow-hidden"
                                >
                                    {/* Side Accent */}
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-[#042f2e]/10" />

                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-10 w-10 bg-teal-50 rounded-xl flex items-center justify-center border border-teal-100 shadow-sm transition-transform">
                                                <ListChecks className="h-5 w-5 text-[#042f2e]" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 text-base leading-tight mb-0.5">{report.claimNumber}</h3>
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar days className="h-2.5 w-2.5 text-slate-400" />
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                                        {report.claimDate ? format(parseISO(report.claimDate), 'MMM d, yyyy') : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <div className={cn(
                                                "px-2 py-1 rounded-lg border flex items-center gap-1 shadow-sm font-black text-[9px]",
                                                statusStyle.bg, statusStyle.border, statusStyle.text
                                            )}>
                                                {statusStyle.icon}
                                                <span>{report.status}</span>
                                            </div>
                                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded-md max-w-[100px]">
                                                <User className="h-2.5 w-2.5 text-slate-400 flex-shrink-0" />
                                                <p className="text-[9px] font-black text-slate-600 truncate">{report.preparedBy}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-1 mb-0.5">
                                                <Building2 className="h-2.5 w-2.5 text-slate-400" />
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Supplier</p>
                                            </div>
                                            <p className="text-xs font-black text-slate-700 line-clamp-1">{report.supplierName}</p>
                                        </div>
                                        <div className="space-y-0.5 text-right">
                                            <div className="flex items-center justify-end gap-1 mb-0.5">
                                                <Hash className="h-2.5 w-2.5 text-slate-400" />
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Qty (Claim/Pend)</p>
                                            </div>
                                            <p className="text-xs font-black text-slate-700">{report.claimQty} / {report.pendingQty}</p>
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-1 mb-0.5">
                                                <Users className="h-2.5 w-2.5 text-slate-400" />
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Customer</p>
                                            </div>
                                            <p className="text-xs font-black text-slate-700 line-clamp-1">{report.customerName || 'N/A'}</p>
                                        </div>
                                        <div className="flex flex-col items-end justify-end">
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-50 rounded-lg border border-rose-100 shadow-sm">
                                                <Mail className="h-2.5 w-2.5 text-rose-500" />
                                                <span className="text-[9px] font-black text-rose-700 uppercase tracking-tighter mr-0.5">Resent</span>
                                                <div className="bg-rose-500 text-white text-[9px] font-black h-4 min-w-[16px] px-1 flex items-center justify-center rounded-sm">
                                                    {report.emailResentCount}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 pt-4 border-t border-dashed border-slate-100">
                                        <Button
                                            variant="outline"
                                            className="flex-1 h-11 rounded-xl border-teal-600 text-[#042f2e] bg-white font-black text-xs gap-2 hover:bg-teal-50 hover:border-teal-700 hover:text-teal-700 active:scale-95 transition-all shadow-sm group"
                                            disabled={!report.emailsViewUrl}
                                            onClick={() => handleViewUrl(report.emailsViewUrl)}
                                        >
                                            <Mail className="h-4 w-4 text-teal-600 group-hover:scale-110 transition-transform" />
                                            Email View
                                        </Button>
                                        <Button
                                            className="flex-1 h-11 rounded-xl bg-[#042f2e] hover:bg-teal-900 text-white font-black text-xs gap-2 shadow-md active:scale-95 transition-all group"
                                            disabled={!report.claimReportUrl}
                                            onClick={() => handleViewUrl(report.claimReportUrl)}
                                        >
                                            <FileText className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                            XLS Report
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}

                        {hasMore && (
                            <div className="mt-8 mb-4 flex justify-center">
                                <Button
                                    onClick={() => fetchReports(true)}
                                    disabled={isPaginating}
                                    className="h-14 px-8 rounded-2xl bg-[#042f2e] text-white font-black shadow-lg hover:bg-teal-900 active:scale-95 transition-all gap-3"
                                >
                                    {isPaginating ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Loading More...
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="h-5 w-5" />
                                            Load More Reports
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

function Users({ className }: { className?: string }) {
    return (
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
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}

function Calendar({ days, className }: { days?: boolean, className?: string }) {
    return (
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
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
            {days && <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />}
        </svg>
    );
}
