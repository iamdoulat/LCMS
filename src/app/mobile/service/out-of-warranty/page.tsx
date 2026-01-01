"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Search,
    Filter,
    ShieldOff,
    AlertTriangle,
    Loader2,
    X,
    ChevronDown,
    ShieldAlert,
    Download,
    FileDown,
    Calendar,
    User,
    Building2,
    Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, limit, startAfter, Timestamp, QueryDocumentSnapshot } from 'firebase/firestore';
import { format, parseISO, isValid, addDays, differenceInDays, isBefore } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import type { InstallationReportDocument } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

interface OutOfWarrantyMachine {
    reportId: string;
    applicantName: string;
    beneficiaryName: string;
    commercialInvoiceNumber?: string;
    machineModel: string;
    serialNo: string;
    installDate: string; // ISO string
    warrantyExpiryDate: string; // ISO string
    daysExpired: number;
}

export default function MobileOutOfWarrantyPage() {
    const router = useRouter();
    const [machines, setMachines] = useState<OutOfWarrantyMachine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaginating, setIsPaginating] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [filterApplicant, setFilterApplicant] = useState('');
    const [filterBeneficiary, setFilterBeneficiary] = useState('');
    const [filterModel, setFilterModel] = useState('');
    const [filterSerial, setFilterSerial] = useState('');

    const fetchOutOfWarrantyData = useCallback(async (isNextPage = false) => {
        if (isNextPage) setIsPaginating(true);
        else setIsLoading(true);

        try {
            const reportsCollection = collection(firestore, "installation_reports");
            const batchSize = 50;
            let currentLastVisible = isNextPage ? lastVisible : null;
            let gatheredMachines: OutOfWarrantyMachine[] = [];
            const today = new Date();
            let hasMoreData = true;

            // Loop until we have at least 10 machines OR we run out of reports
            while (gatheredMachines.length < 10 && hasMoreData) {
                let q = query(reportsCollection, orderBy("createdAt", "desc"), limit(batchSize));
                if (currentLastVisible) {
                    q = query(reportsCollection, orderBy("createdAt", "desc"), startAfter(currentLastVisible), limit(batchSize));
                }

                const snapshot = await getDocs(q);
                if (snapshot.empty) {
                    hasMoreData = false;
                    break;
                }

                currentLastVisible = snapshot.docs[snapshot.docs.length - 1];

                snapshot.docs.forEach(docSnap => {
                    const report = { id: docSnap.id, ...docSnap.data() } as InstallationReportDocument;
                    report.installationDetails?.forEach(detail => {
                        if (detail.installDate) {
                            const installDateObj = parseISO(detail.installDate);
                            if (isValid(installDateObj)) {
                                const expiryDate = addDays(installDateObj, 365);
                                if (isBefore(expiryDate, today)) {
                                    const daysExpired = differenceInDays(today, expiryDate);
                                    gatheredMachines.push({
                                        reportId: report.id,
                                        applicantName: report.applicantName || 'N/A',
                                        beneficiaryName: report.beneficiaryName || 'N/A',
                                        commercialInvoiceNumber: report.commercialInvoiceNumber,
                                        machineModel: detail.machineModel,
                                        serialNo: detail.serialNo,
                                        installDate: detail.installDate,
                                        warrantyExpiryDate: expiryDate.toISOString(),
                                        daysExpired,
                                    });
                                }
                            }
                        }
                    });
                });

                if (snapshot.docs.length < batchSize) {
                    hasMoreData = false;
                }
            }

            if (isNextPage) {
                setMachines(prev => [...prev, ...gatheredMachines]);
            } else {
                setMachines(gatheredMachines);
            }

            setLastVisible(currentLastVisible);
            setHasMore(hasMoreData);

        } catch (error) {
            console.error("Error fetching out-of-warranty reports:", error);
        } finally {
            setIsLoading(false);
            setIsPaginating(false);
        }
    }, [lastVisible]);

    useEffect(() => {
        fetchOutOfWarrantyData();
    }, []);

    const filteredMachines = useMemo(() => {
        return machines.filter(m => {
            const matchesSearch = !searchQuery ||
                m.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.serialNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.machineModel.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesApplicant = !filterApplicant || m.applicantName.toLowerCase().includes(filterApplicant.toLowerCase());
            const matchesBeneficiary = !filterBeneficiary || m.beneficiaryName.toLowerCase().includes(filterBeneficiary.toLowerCase());
            const matchesModel = !filterModel || m.machineModel.toLowerCase().includes(filterModel.toLowerCase());
            const matchesSerial = !filterSerial || m.serialNo.toLowerCase().includes(filterSerial.toLowerCase());

            return matchesSearch && matchesApplicant && matchesBeneficiary && matchesModel && matchesSerial;
        });
    }, [machines, searchQuery, filterApplicant, filterBeneficiary, filterModel, filterSerial]);

    const handleDownloadPdf = (machine: OutOfWarrantyMachine) => {
        const doc = new jsPDF();

        doc.setFontSize(22);
        doc.setTextColor(190, 18, 60); // rose-700
        doc.text("EXPIRED WARRANTY REPORT", 105, 20, { align: "center" });

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 105, 28, { align: "center" });

        autoTable(doc, {
            startY: 40,
            head: [['Field', 'Details']],
            body: [
                ['Applicant Name', machine.applicantName],
                ['Beneficiary Name', machine.beneficiaryName],
                ['Commercial Invoice', machine.commercialInvoiceNumber || 'N/A'],
                ['Machine Model', machine.machineModel],
                ['Serial Number', machine.serialNo],
                ['Installation Date', format(parseISO(machine.installDate), 'PPP')],
                ['Warranty Expiry', format(parseISO(machine.warrantyExpiryDate), 'PPP')],
                ['Status', `Expired (${machine.daysExpired} Days Ago)`],
            ],
            theme: 'striped',
            headStyles: { fillColor: [190, 18, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 5 },
            columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' } }
        });

        doc.save(`Expired_Warranty_${machine.serialNo}.pdf`);
    };

    return (
        <div className="flex flex-col h-screen bg-rose-950 overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-rose-950 px-4 pt-2 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full active:bg-white/10 transition-colors text-white"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white ml-2 text-shadow-sm flex items-center gap-2">
                            Out of Warranty
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
                                <SheetTitle className="text-xl font-bold">Filter Machines</SheetTitle>
                                <p className="text-sm text-slate-500">Find specific out-of-warranty machines.</p>
                            </SheetHeader>

                            <div className="space-y-4 pb-8">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Applicant Name</label>
                                    <Input
                                        placeholder="Search applicant..."
                                        value={filterApplicant}
                                        onChange={(e) => setFilterApplicant(e.target.value)}
                                        className="h-12 rounded-2xl bg-slate-50 border-slate-100"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Beneficiary Name</label>
                                    <Input
                                        placeholder="Search beneficiary..."
                                        value={filterBeneficiary}
                                        onChange={(e) => setFilterBeneficiary(e.target.value)}
                                        className="h-12 rounded-2xl bg-slate-50 border-slate-100"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Machine Model</label>
                                    <Input
                                        placeholder="Search model..."
                                        value={filterModel}
                                        onChange={(e) => setFilterModel(e.target.value)}
                                        className="h-12 rounded-2xl bg-slate-50 border-slate-100"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Serial Number</label>
                                    <Input
                                        placeholder="Search serial..."
                                        value={filterSerial}
                                        onChange={(e) => setFilterSerial(e.target.value)}
                                        className="h-12 rounded-2xl bg-slate-50 border-slate-100"
                                    />
                                </div>

                                <Button
                                    className="w-full h-14 rounded-[1.5rem] bg-rose-700 hover:bg-rose-800 text-white font-bold text-lg mt-4 shadow-lg active:scale-[0.98] transition-all"
                                    onClick={() => setIsFilterOpen(false)}
                                >
                                    Apply Filters
                                </Button>

                                <Button
                                    variant="ghost"
                                    className="w-full h-10 text-slate-400 font-bold"
                                    onClick={() => {
                                        setFilterApplicant('');
                                        setFilterBeneficiary('');
                                        setFilterModel('');
                                        setFilterSerial('');
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
                        placeholder="Search Serial, Model or Applicant..."
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
                            <div className="h-16 w-16 border-4 border-rose-100 border-t-rose-700 rounded-full animate-spin" />
                            <ShieldOff className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-rose-700" />
                        </div>
                        <p className="text-slate-500 font-bold animate-pulse">Checking expired warranties...</p>
                    </div>
                ) : filteredMachines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-sm px-6 text-center">
                        <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <ShieldOff className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">No Machines Found</h3>
                        <p className="text-slate-500 font-medium">Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredMachines.map((machine, index) => (
                            <div
                                key={`${machine.reportId}-${machine.serialNo}-${index}`}
                                className="bg-white p-5 rounded-[2.5rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] border-2 border-rose-700/5 hover:border-rose-700/20 active:scale-[0.98] transition-all group relative overflow-hidden"
                            >
                                {/* Side Accent */}
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-700/10" />

                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 bg-rose-50 rounded-2xl flex items-center justify-center border border-rose-100 shadow-sm group-hover:scale-110 transition-transform">
                                            <SewingMachine className="h-6 w-6 text-rose-700" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 text-lg leading-none mb-1">{machine.machineModel}</h3>
                                            <div className="flex items-center gap-1.5">
                                                <Hash className="h-3 w-3 text-slate-400" />
                                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{machine.serialNo}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1.5 rounded-xl border flex items-center gap-2 shadow-sm font-black text-[10px] bg-rose-50 border-rose-100 text-rose-600">
                                        <ShieldAlert className="h-3 w-3" />
                                        <span>Expired</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-5 bg-slate-50/50 p-4 rounded-2xl">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <Building2 className="h-3 w-3 text-slate-400" />
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Applicant</p>
                                        </div>
                                        <p className="text-xs font-black text-slate-700 line-clamp-1">{machine.applicantName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <User className="h-3 w-3 text-slate-400" />
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Beneficiary</p>
                                        </div>
                                        <p className="text-xs font-black text-slate-700 line-clamp-1">{machine.beneficiaryName}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-4 pt-4 border-t border-dashed border-slate-100">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-rose-400 uppercase">Expired On</span>
                                        <span className="text-[11px] font-black text-rose-700">{format(parseISO(machine.warrantyExpiryDate), 'MMM d, yyyy')}</span>
                                    </div>
                                    <Button
                                        className="h-11 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-black text-xs gap-2 px-6 shadow-md active:scale-95 transition-all group"
                                        onClick={() => handleDownloadPdf(machine)}
                                    >
                                        <FileDown className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                        Download Pdf Report
                                    </Button>
                                </div>
                            </div>
                        ))}

                        {hasMore && (
                            <div className="mt-8 mb-4 flex justify-center">
                                <Button
                                    onClick={() => fetchOutOfWarrantyData(true)}
                                    disabled={isPaginating}
                                    className="h-14 px-8 rounded-2xl bg-rose-700 text-white font-black shadow-lg hover:bg-rose-800 active:scale-95 transition-all gap-3"
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
