"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Search,
    Filter,
    PackageSearch,
    AlertTriangle,
    Info,
    Loader2,
    ChevronDown,
    FileText,
    ExternalLink,
    X,
    ClipboardList,
    Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, limit, startAfter, Timestamp, QueryDocumentSnapshot } from 'firebase/firestore';
import { format, parseISO, isValid, getYear } from 'date-fns';
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
import type { InstallationReportDocument, CustomerDocument, SupplierDocument } from '@/types';

const ALL_YEARS_VALUE = "all";
const currentYear = new Date().getFullYear();
const yearOptions = [ALL_YEARS_VALUE, ...Array.from({ length: 10 }, (_, i) => (currentYear - i).toString())];

export default function MobileMissingFoundPage() {
    const router = useRouter();
    const [reports, setReports] = useState<InstallationReportDocument[]>([]);
    const [applicants, setApplicants] = useState<{ id: string, name: string }[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<{ id: string, name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaginating, setIsPaginating] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLc, setFilterLc] = useState('');
    const [filterCi, setFilterCi] = useState('');
    const [filterApplicant, setFilterApplicant] = useState('all');
    const [filterBeneficiary, setFilterBeneficiary] = useState('all');
    const [filterYear, setFilterYear] = useState(ALL_YEARS_VALUE);

    const formatDisplayDate = (dateString?: string | null): string => {
        if (!dateString) return 'N/A';
        try {
            const date = parseISO(dateString);
            return isValid(date) ? format(date, 'MMM d, yyyy') : 'N/A';
        } catch (e) {
            return 'N/A';
        }
    };

    const fetchReports = useCallback(async (isNextPage = false) => {
        if (isNextPage) setIsPaginating(true);
        else setIsLoading(true);

        try {
            const reportsCollection = collection(firestore, "installation_reports");
            let q = query(reportsCollection, orderBy("createdAt", "desc"), limit(50));

            if (isNextPage && lastVisible) {
                q = query(reportsCollection, orderBy("createdAt", "desc"), startAfter(lastVisible), limit(50));
            }

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                if (!isNextPage) setReports([]);
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
                    commercialInvoiceDate: data.commercialInvoiceDate instanceof Timestamp ? data.commercialInvoiceDate.toDate().toISOString() : data.commercialInvoiceDate,
                } as InstallationReportDocument;
            });

            // Filter for unresolved missing/found issues
            const issuesOnly = fetchedBatch.filter(report =>
                (report.missingItemInfo && report.missingItemInfo.trim() !== "" && !report.missingItemsIssueResolved) ||
                (report.extraFoundInfo && report.extraFoundInfo.trim() !== "" && !report.extraItemsIssueResolved)
            );

            if (isNextPage) {
                setReports(prev => [...prev, ...issuesOnly]);
            } else {
                setReports(issuesOnly);
            }

            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === 50);

        } catch (error) {
            console.error("Error fetching missing/found reports:", error);
        } finally {
            setIsLoading(false);
            setIsPaginating(false);
        }
    }, [lastVisible]);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                // Fetch basic data (Applicants/Beneficiaries)
                const customersSnap = await getDocs(collection(firestore, "customers"));
                setApplicants(customersSnap.docs.map(d => ({
                    id: d.id,
                    name: (d.data() as CustomerDocument).applicantName || 'Unnamed'
                })));

                const suppliersSnap = await getDocs(collection(firestore, "suppliers"));
                setBeneficiaries(suppliersSnap.docs.map(d => ({
                    id: d.id,
                    name: (d.data() as SupplierDocument).beneficiaryName || 'Unnamed'
                })));

                // Fetch initial reports batch
                await fetchReports();
            } catch (error) {
                console.error("Error in initial fetch:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    const filteredReports = useMemo(() => {
        return reports.filter(report => {
            const matchesSearch = !searchQuery ||
                report.commercialInvoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                report.applicantName?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesLc = !filterLc || report.documentaryCreditNumber?.toLowerCase().includes(filterLc.toLowerCase());
            const matchesCi = !filterCi || report.commercialInvoiceNumber?.toLowerCase().includes(filterCi.toLowerCase());
            const matchesApplicant = filterApplicant === 'all' || report.applicantId === filterApplicant;
            const matchesBeneficiary = filterBeneficiary === 'all' || report.beneficiaryId === filterBeneficiary;
            const matchesYear = filterYear === ALL_YEARS_VALUE || (
                report.commercialInvoiceDate && getYear(parseISO(report.commercialInvoiceDate)).toString() === filterYear
            );

            return matchesSearch && matchesLc && matchesCi && matchesApplicant && matchesBeneficiary && matchesYear;
        });
    }, [reports, searchQuery, filterLc, filterCi, filterApplicant, filterBeneficiary, filterYear]);

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60] px-4 pt-2 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full active:bg-white/10 transition-colors text-white"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white ml-2">Missing & Found</h1>
                    </div>

                    <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <SheetTrigger asChild>
                            <button className="p-2.5 bg-white/10 text-white rounded-xl active:scale-95 transition-all">
                                <Filter className="h-5 w-5" />
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-[2.5rem] p-8 max-h-[85vh] overflow-y-auto border-none">
                            <SheetHeader className="mb-6 text-left">
                                <SheetTitle className="text-xl font-bold">Filter Issues</SheetTitle>
                                <p className="text-sm text-slate-500">Search for specific records.</p>
                            </SheetHeader>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">L/C Number</label>
                                    <Input
                                        placeholder="Enter L/C number..."
                                        value={filterLc}
                                        onChange={(e) => setFilterLc(e.target.value)}
                                        className="h-12 rounded-2xl bg-slate-50 border-slate-100"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">C.I. Number</label>
                                    <Input
                                        placeholder="Enter C.I. number..."
                                        value={filterCi}
                                        onChange={(e) => setFilterCi(e.target.value)}
                                        className="h-12 rounded-2xl bg-slate-50 border-slate-100"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Year</label>
                                        <Select value={filterYear} onValueChange={setFilterYear}>
                                            <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-100">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {yearOptions.map(y => (
                                                    <SelectItem key={y} value={y}>{y === 'all' ? 'All Years' : y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Applicant</label>
                                    <Select value={filterApplicant} onValueChange={setFilterApplicant}>
                                        <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-100">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="all">All Applicants</SelectItem>
                                            {applicants.map(a => (
                                                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Beneficiary</label>
                                    <Select value={filterBeneficiary} onValueChange={setFilterBeneficiary}>
                                        <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-100">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="all">All Beneficiaries</SelectItem>
                                            {beneficiaries.map(b => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    className="w-full h-14 rounded-[1.5rem] bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg mt-4"
                                    onClick={() => setIsFilterOpen(false)}
                                >
                                    Apply Filters
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                {/* Quick Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                    <input
                        type="text"
                        placeholder="Search CI # or Applicant..."
                        className="w-full bg-white/10 border-white/20 text-white placeholder:text-white/40 pl-12 pr-4 py-3 rounded-2xl focus:outline-none focus:bg-white/20 transition-all text-sm"
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
                            <div className="h-16 w-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                            <PackageSearch className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-blue-600" />
                        </div>
                        <p className="text-slate-500 font-bold animate-pulse">Scanning for issues...</p>
                    </div>
                ) : filteredReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-sm px-6 text-center">
                        <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                            <PackageSearch className="h-10 w-10 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">All Clear!</h3>
                        <p className="text-slate-500 font-medium">No unresolved missing or extra items found at the moment.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredReports.map((report) => (
                            <div
                                key={report.id}
                                className="bg-white p-5 rounded-[2.5rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] border-2 border-emerald-600/20 hover:border-emerald-600 active:scale-[0.98] transition-all group relative overflow-hidden"
                            >
                                {/* Side Accent */}
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-600/20" />

                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-inner group-hover:scale-110 transition-transform">
                                            <PackageSearch className="h-6 w-6 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 text-lg leading-none mb-1">C.I.: {report.commercialInvoiceNumber}</h3>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">L/C: {report.documentaryCreditNumber}</p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2 shadow-sm">
                                        <Calendar className="h-3 w-3 text-slate-400" />
                                        <span className="text-[10px] font-black text-slate-600">{formatDisplayDate(report.commercialInvoiceDate)}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-5">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Applicant</p>
                                        <p className="text-xs font-black text-slate-700 line-clamp-1">{report.applicantName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Beneficiary</p>
                                        <p className="text-xs font-black text-slate-700 line-clamp-1">{report.beneficiaryName}</p>
                                    </div>
                                </div>

                                {/* Issue Details */}
                                <div className="space-y-3 pt-4 border-t border-dashed border-slate-100">
                                    {report.missingItemInfo && !report.missingItemsIssueResolved && (
                                        <div className="bg-rose-50/50 rounded-2xl p-4 border border-rose-100 shadow-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertTriangle className="h-4 w-4 text-rose-600" />
                                                <h4 className="text-[11px] font-black text-rose-700 uppercase tracking-wider">Missing & Short Shipment</h4>
                                            </div>
                                            <p className="text-xs font-medium text-rose-900 leading-relaxed line-clamp-3">
                                                {report.missingItemInfo}
                                            </p>
                                        </div>
                                    )}

                                    {report.extraFoundInfo && !report.extraItemsIssueResolved && (
                                        <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 shadow-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Info className="h-4 w-4 text-blue-600" />
                                                <h4 className="text-[11px] font-black text-blue-700 uppercase tracking-wider">Extra Found & Return</h4>
                                            </div>
                                            <p className="text-xs font-medium text-blue-900 leading-relaxed line-clamp-3">
                                                {report.extraFoundInfo}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Load More Button */}
                        {hasMore && (
                            <div className="mt-8 mb-4 flex justify-center">
                                <Button
                                    onClick={() => fetchReports(true)}
                                    disabled={isPaginating}
                                    className="h-14 px-8 rounded-2xl bg-[#0a1e60] text-white font-black shadow-lg hover:bg-blue-900 active:scale-95 transition-all gap-3"
                                >
                                    {isPaginating ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Loading More...
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

