"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Search,
    Filter,
    FileText,
    ClipboardList,
    Calendar,
    Building2,
    Fingerprint,
    ExternalLink,
    Loader2,
    X,
    ChevronDown,
    ShieldCheck,
    ShieldAlert,
    Download,
    FileDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, Timestamp, limit, startAfter, orderBy, QueryDocumentSnapshot } from 'firebase/firestore';
import { format, parseISO, isValid, addDays, isBefore, getYear, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

export default function ServiceReportsPage() {
    const router = useRouter();
    const [reports, setReports] = useState<InstallationReportDocument[]>([]);
    const [applicants, setApplicants] = useState<{ id: string, name: string }[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<{ id: string, name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLc, setFilterLc] = useState('');
    const [filterCi, setFilterCi] = useState('');
    const [filterApplicant, setFilterApplicant] = useState('all');
    const [filterBeneficiary, setFilterBeneficiary] = useState('all');
    const [filterYear, setFilterYear] = useState(ALL_YEARS_VALUE);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isPaginating, setIsPaginating] = useState(false);

    const fetchReports = async (isNextPage = false) => {
        if (isNextPage) setIsPaginating(true);
        else setIsLoading(true);

        try {
            const reportsCollection = collection(firestore, "installation_reports");
            let q = query(reportsCollection, orderBy("createdAt", "desc"), limit(10));

            if (isNextPage && lastVisible) {
                q = query(reportsCollection, orderBy("createdAt", "desc"), startAfter(lastVisible), limit(10));
            }

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                if (!isNextPage) setReports([]);
                setHasMore(false);
                setLastVisible(null);
                return;
            }

            const newReports = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
                    commercialInvoiceDate: data.commercialInvoiceDate instanceof Timestamp ? data.commercialInvoiceDate.toDate().toISOString() : data.commercialInvoiceDate,
                    packingListUrl: data.packingListUrl || undefined,
                } as InstallationReportDocument;
            });

            if (isNextPage) {
                setReports(prev => [...prev, ...newReports]);
            } else {
                setReports(newReports);
            }

            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === 10);

        } catch (error) {
            console.error("Error fetching reports:", error);
        } finally {
            setIsLoading(false);
            setIsPaginating(false);
        }
    };

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
                report.documentaryCreditNumber?.toLowerCase().includes(searchQuery.toLowerCase());

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

    const resetFilters = () => {
        setFilterLc('');
        setFilterCi('');
        setFilterApplicant('all');
        setFilterBeneficiary('all');
        setFilterYear(ALL_YEARS_VALUE);
    };

    const handleDownloadPdfReport = (report: InstallationReportDocument) => {
        const doc = new jsPDF();

        // Header
        doc.setFillColor(10, 30, 96); // #0a1e60
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('INSTALLATION REPORT', 105, 25, { align: 'center' });

        // Report Info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);

        const details = [
            ['Commercial Invoice:', report.commercialInvoiceNumber || 'N/A', 'Invoice Date:', report.commercialInvoiceDate ? format(parseISO(report.commercialInvoiceDate), 'PPP') : 'N/A'],
            ['L/C Number:', report.documentaryCreditNumber || 'N/A', 'Total Qty:', String(report.totalMachineQtyFromLC || 0)],
            ['Applicant:', report.applicantName || 'N/A', 'Beneficiary:', report.beneficiaryName || 'N/A'],
            ['Technician:', report.technicianName || 'N/A', 'Engineer:', report.reportingEngineerName || 'N/A'],
        ];

        autoTable(doc, {
            startY: 50,
            head: [['Field', 'Value', 'Field', 'Value']],
            body: details,
            theme: 'striped',
            headStyles: { fillColor: [10, 30, 96] },
            styles: { fontSize: 9 }
        });

        // Machine Details
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Machine Details', 14, (doc as any).lastAutoTable.finalY + 15);

        const machineItems = report.installationDetails?.map((item, index) => [
            index + 1,
            item.machineModel || 'N/A',
            item.serialNo || 'N/A',
            item.installDate ? format(parseISO(item.installDate), 'PPP') : 'N/A',
            '1 Year'
        ]) || [];

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 20,
            head: [['#', 'Model', 'Serial No', 'Install Date', 'Warranty']],
            body: machineItems,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }, // blue-500
            styles: { fontSize: 9 }
        });

        // Summary
        const finalY = (doc as any).lastAutoTable.finalY + 20;
        doc.setFontSize(12);
        doc.text(`Total Installed: ${report.totalInstalledQty || 0}`, 14, finalY);
        doc.text(`Pending: ${report.pendingQty || 0}`, 100, finalY);

        if (report.installationNotes) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('Notes:', 14, finalY + 15);
            doc.text(report.installationNotes, 14, finalY + 22, { maxWidth: 180 });
        }

        doc.save(`Installation_Report_${report.commercialInvoiceNumber || report.id}.pdf`);
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
                            <h1 className="text-2xl font-black text-white tracking-tight">Service Reports</h1>
                            <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">Installation & Warranty</p>
                        </div>
                    </div>

                    <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <SheetTrigger asChild>
                            <button className="p-2.5 bg-white/10 text-white rounded-xl active:scale-95 transition-all">
                                <Filter className="h-5 w-5" />
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-[2.5rem] p-8 max-h-[85vh] overflow-y-auto">
                            <SheetHeader className="mb-6 text-left">
                                <SheetTitle className="text-xl font-bold">Filter Reports</SheetTitle>
                                <p className="text-sm text-slate-500">Fine-tune your report view.</p>
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
                                            <SelectContent rounded-xl>
                                                {yearOptions.map(y => (
                                                    <SelectItem key={y} value={y}>{y === 'all' ? 'All Years' : y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Actions</label>
                                        <Button
                                            variant="outline"
                                            onClick={resetFilters}
                                            className="h-12 w-full rounded-2xl border-slate-200 text-slate-600 font-bold"
                                        >
                                            Reset
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Applicant</label>
                                    <Select value={filterApplicant} onValueChange={setFilterApplicant}>
                                        <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-slate-100">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent rounded-xl>
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
                                        <SelectContent rounded-xl>
                                            <SelectItem value="all">All Beneficiaries</SelectItem>
                                            {beneficiaries.map(b => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    className="w-full h-14 rounded-[1.5rem] bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg mt-4"
                                    onClick={() => setIsFilterOpen(false)}
                                >
                                    Apply Filters
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-blue-400/50" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search CI or LC number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-14 bg-white/10 border border-white/10 rounded-[1.25rem] pl-12 pr-4 text-white placeholder:text-blue-400/30 focus:ring-2 focus:ring-blue-500/50 transition-all outline-none backdrop-blur-md text-sm font-medium"
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto pb-24 shadow-inner">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                        <Loader2 className="h-10 w-10 animate-spin text-[#0a1e60]" />
                        <p className="font-bold text-sm">Fetching reports...</p>
                    </div>
                ) : filteredReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-12 text-center text-slate-400">
                        <div className="bg-slate-100 p-6 rounded-[2.5rem] mb-4">
                            <ClipboardList className="h-12 w-12 opacity-20" />
                        </div>
                        <p className="font-bold">No reports found</p>
                        <p className="text-xs mt-1">Try adjusting your filters or search query.</p>
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {filteredReports.map((report) => {
                            const today = startOfDay(new Date());
                            let expired = 0;
                            let active = 0;

                            report.installationDetails?.forEach(item => {
                                if (item.installDate) {
                                    const expiryDate = addDays(parseISO(item.installDate), 365);
                                    if (isBefore(expiryDate, today)) expired++;
                                    else active++;
                                }
                            });

                            return (
                                <div
                                    key={report.id}
                                    className="bg-white p-5 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 hover:border-slate-400 active:scale-[0.98] transition-all group relative overflow-hidden"
                                >
                                    {/* Subtle highlight */}
                                    <div className="absolute top-0 left-0 w-1 h-full bg-[#0a1e60]/20" />

                                    <div className="flex justify-between items-start mb-4" onClick={() => report.packingListUrl && window.open(report.packingListUrl, '_blank')}>
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-blue-50 rounded-2xl">
                                                <FileText className="h-6 w-6 text-[#0a1e60]" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-[#0a1e60] text-base leading-tight">
                                                    CI: {report.commercialInvoiceNumber || 'N/A'}
                                                </h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                    LC: {report.documentaryCreditNumber || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="text-right">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">Invoice Date</p>
                                                <p className="text-[10px] font-black text-slate-700 mt-1">
                                                    {report.commercialInvoiceDate ? format(parseISO(report.commercialInvoiceDate), 'MMM d, yyyy') : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Applicant</p>
                                            <p className="text-xs font-black text-slate-700 truncate">{report.applicantName || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Beneficiary</p>
                                            <p className="text-xs font-black text-slate-700 truncate">{report.beneficiaryName || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-3 border-t border-dashed border-slate-200">
                                        <div className="grid grid-cols-3 gap-2 py-3 bg-white rounded-3xl px-3 mt-1 border border-slate-200 shadow-[0_4px_12px_rgb(0,0,0,0.03)]">
                                            <div className="text-center border-r border-blue-400 last:border-0">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Total Qty</p>
                                                <p className="text-sm font-black text-[#0a1e60]">{report.totalMachineQtyFromLC || 0}</p>
                                            </div>
                                            <div className="text-center border-r border-blue-400 last:border-0">
                                                <p className="text-[10px] font-black text-blue-700 uppercase tracking-tighter mb-0.5">Installed</p>
                                                <p className="text-sm font-black text-blue-600">{report.totalInstalledQty || 0}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-rose-700 uppercase tracking-tighter mb-0.5">Pending</p>
                                                <p className={cn("text-sm font-black", Number(report.pendingQty) > 0 ? "text-rose-600" : "text-emerald-600")}>
                                                    {report.pendingQty || 0}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-1">
                                            <div className="flex-1 flex items-center justify-center bg-rose-50 py-2 rounded-xl gap-2">
                                                <ShieldAlert className="h-3 w-3 text-rose-600" />
                                                <span className="text-[10px] font-black text-rose-700">{expired} Expired sets</span>
                                            </div>
                                            <div className="flex-1 flex items-center justify-center bg-emerald-50 py-2 rounded-xl gap-2">
                                                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                                                <span className="text-[10px] font-black text-emerald-700">{active} Remaining sets</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 mt-3">
                                            <Button
                                                variant="outline"
                                                disabled={!report.packingListUrl}
                                                className={cn(
                                                    "flex-1 h-12 rounded-2xl border-emerald-600 font-black gap-2 active:scale-[0.98] transition-all shadow-[0_4px_12px_rgba(0,0,0,0.1)] group",
                                                    report.packingListUrl
                                                        ? "text-slate-900 bg-white hover:bg-emerald-50 hover:border-emerald-700 hover:text-emerald-700"
                                                        : "text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed"
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (report.packingListUrl) window.open(report.packingListUrl, '_blank');
                                                }}
                                            >
                                                <Download className={cn("h-4 w-4 shadow-sm", report.packingListUrl ? "text-blue-600 group-hover:text-emerald-600" : "text-slate-300")} />
                                                Packing List
                                            </Button>

                                            <Button
                                                variant="outline"
                                                className="flex-1 h-12 rounded-2xl border-blue-600 text-slate-900 bg-white font-black gap-2 hover:bg-blue-50 hover:border-blue-700 hover:text-blue-700 active:scale-[0.98] transition-all shadow-[0_4px_12px_rgba(0,0,0,0.1)] group"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDownloadPdfReport(report);
                                                }}
                                            >
                                                <FileDown className="h-4 w-4 text-blue-600 shadow-sm group-hover:text-blue-700" />
                                                PDF Details
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Load More Button */}
                        {hasMore && (
                            <div className="mt-8 mb-12 flex justify-center">
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
                                            Load More Reports
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {filteredReports.length > 0 && !hasMore && (
                            <p className="text-center text-slate-400 text-sm mt-8 mb-12 font-medium">
                                No more reports to load
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
