"use client";

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft, Loader2, FileSpreadsheet, Filter, Calendar as CalendarIcon, Edit2, Download, MessageSquare, Trash2, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, Timestamp, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { HRClaim, Employee, HRClaimStatus } from '@/types';

import { format, isWithinInterval, startOfDay, endOfDay, getYear, isValid, parseISO } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Calendar } from "@/components/ui/calendar";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

import { generateClaimPDF } from '@/components/reports/hr/ClaimReportPDF';
import { getDynamicYearRange } from '@/lib/date-utils';

const ClaimStopwatch = React.memo(({ claim }: { claim: HRClaim }) => {
    const [timeLeft, setTimeLeft] = useState<string>('--:--');
    const timerExpiredRef = useRef(false);
    
    React.useEffect(() => {
        if (claim.status !== 'Claimed') return;
        timerExpiredRef.current = false;

        const updateTimer = () => {
            const now = Date.now();
            const timestamp = claim.updatedAt || claim.createdAt;
            const referenceDate = timestamp?.toDate ? timestamp.toDate() : (timestamp?.seconds ? new Date(timestamp.seconds * 1000) : null);
            
            if (!referenceDate) return;

            const diff = (15 * 60 * 1000) - (now - referenceDate.getTime());
            
            if (diff <= 0) {
                setTimeLeft('00:00');
                timerExpiredRef.current = true;
                // Don't call updateDoc here — the auto-approval useEffect handles it
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [claim.id, claim.status, claim.updatedAt, claim.createdAt]);

    if (claim.status !== 'Claimed') return null;

    return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50/50 rounded-lg border border-blue-100/50 min-w-fit shadow-sm">
            <Timer className="h-3 w-3 text-blue-500 animate-pulse" />
            <span className="text-[10px] font-bold text-blue-600 font-mono tracking-tighter">{timeLeft}</span>
        </div>
    );
});
ClaimStopwatch.displayName = 'ClaimStopwatch';

export default function ClaimListPage() {
    const router = useRouter();
    const { user, companyName, address, invoiceLogoUrl, companyLogoUrl, userRole, operationStartDate } = useAuth();
    const { toast } = useToast();
    const { supervisedEmployeeIds, isSupervisor, isDelegate } = useSupervisorCheck(user?.email);
    const [activeTab, setActiveTab] = useState<'My Claims' | 'Claim Requests'>('My Claims');
    const [claims, setClaims] = useState<HRClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
    const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
    const [filterYear, setFilterYear] = useState<string>('2026');
    const [isDateSheetOpen, setIsDateSheetOpen] = useState(false);
    const [displayLimit, setDisplayLimit] = useState(10);
    const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string; claimNo: string }>({ open: false, id: '', claimNo: '' });
    const autoApprovalProcessed = useRef<Set<string>>(new Set());

    const yearOptions = React.useMemo(() => {
        const dynamicYears = getDynamicYearRange(operationStartDate);
        return ['All', ...dynamicYears];
    }, [operationStartDate]);

    const isAdmin = React.useMemo(() => {
        if (!userRole) return false;
        const privilegedRoles = ["Super Admin", "Admin", "HR", "Supervisor"];
        return userRole.some(role => privilegedRoles.includes(role)) || isSupervisor || isDelegate;
    }, [userRole, isSupervisor, isDelegate]);

    const filteredClaims = React.useMemo(() => {
        let result = claims;
        if (statusFilter !== 'All') {
            result = result.filter(c => c.status === statusFilter);
        }

        // Year Filter and Date Range
        result = result.filter(c => {
            if (!c.claimDate) return false;

            // Robust date parsing (matches dashboard)
            let claimDate: Date;
            if ((c.claimDate as any) instanceof Timestamp) {
                claimDate = (c.claimDate as any).toDate();
            } else if (typeof c.claimDate === 'string') {
                claimDate = parseISO(c.claimDate);
            } else {
                return false;
            }

            if (!isValid(claimDate)) return false;

            // 1. Year Filter
            const yearMatch = filterYear === 'All' ? true : getYear(claimDate) === parseInt(filterYear);
            if (!yearMatch) return false;

            // 2. Custom Date Range Filter
            if (dateRange.from && dateRange.to) {
                return isWithinInterval(claimDate, {
                    start: startOfDay(dateRange.from),
                    end: endOfDay(dateRange.to)
                });
            }

            return true;
        });

        return result;
    }, [claims, statusFilter, dateRange, filterYear]);

    const totals = React.useMemo(() => {
        return filteredClaims.reduce((acc, c) => ({
            claimed: acc.claimed + (c.status !== 'Rejected' ? (c.claimAmount || 0) : 0),
            approved: acc.approved + (c.approvedAmount || 0),
            disbursed: acc.disbursed + (c.sanctionedAmount || 0)
        }), { claimed: 0, approved: 0, disbursed: 0 });
    }, [filteredClaims]);

    const paginatedClaims = React.useMemo(() => {
        return filteredClaims.slice(0, displayLimit);
    }, [filteredClaims, displayLimit]);

    // Stable ref for toast to avoid re-subscribing onSnapshot on every render
    const toastRef = useRef(toast);
    toastRef.current = toast;

    // Stable ref for supervisedEmployeeIds to avoid re-subscribing when array reference changes
    const supervisedIdsRef = useRef(supervisedEmployeeIds);
    supervisedIdsRef.current = supervisedEmployeeIds;

    // Stable key for supervisedEmployeeIds — only changes when actual IDs change
    const supervisedIdsKey = React.useMemo(() => supervisedEmployeeIds.join(','), [supervisedEmployeeIds]);

    React.useEffect(() => {
        if (!user) return;

        const currentSupervisedIds = supervisedIdsRef.current;

        let q;
        if (activeTab === 'My Claims') {
            q = query(
                collection(firestore, 'hr_claims'),
                where('employeeId', '==', user.uid)
            );
        } else {
            // "Claim Requests" tab for supervisors
            if (isAdmin) {
                // Admins see all claims (no limit to ensure accurate totals)
                q = query(
                    collection(firestore, 'hr_claims')
                );
            } else {
                if (currentSupervisedIds.length === 0) {
                    setClaims([]);
                    setLoading(false);
                    return;
                }

                if (currentSupervisedIds.length > 30) {
                    // Firestore "in" limit is 30. Fetch all and filter in memory.
                    q = query(
                        collection(firestore, 'hr_claims')
                    );
                } else {
                    q = query(
                        collection(firestore, 'hr_claims'),
                        where('employeeId', 'in', currentSupervisedIds)
                    );
                }
            }
        }

        setLoading(true);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HRClaim));

            if (activeTab === 'Claim Requests' && !isAdmin && supervisedIdsRef.current.length > 30) {
                items = items.filter(item => supervisedIdsRef.current.includes(item.employeeId));
            }

            items.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
            });
            setClaims(items);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching claims:", error);
            toastRef.current({
                title: "Error",
                description: "Failed to load claims. Please try again.",
                variant: "destructive"
            });
            setLoading(false);
        });

        return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid, activeTab, isAdmin, supervisedIdsKey]);




    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-[5px] pb-6 relative">
                    <div className="flex items-center gap-3 z-10">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white tracking-wide">Claim</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Native Select for Year Filter */}
                        <div className="relative z-10 shadow-[0_4px_12px_rgba(0,0,0,0.4)] rounded-full bg-[#1a2b6d]">
                            <select
                                value={filterYear}
                                onChange={(e) => {
                                    setFilterYear(e.target.value);
                                    setDisplayLimit(10);
                                }}
                                className="appearance-none bg-transparent text-white font-bold text-sm px-4 py-2 pr-8 rounded-full border-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                            >
                                {yearOptions.map(year => (
                                    <option key={year} value={year} className="text-slate-800">{year === 'All' ? 'All Years' : year}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 1L5 5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                        </div>

                        <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                            <SheetTrigger asChild>
                                <button className="p-2 text-white hover:bg-white/10 rounded-full transition-colors relative shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]">
                                    <Filter className="h-6 w-6" />
                                    {statusFilter !== 'All' && (
                                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-400 border-2 border-[#0a1e60] rounded-full"></span>
                                    )}
                                </button>
                            </SheetTrigger>
                            <SheetContent side="bottom" className="rounded-t-[2rem] px-6 pb-12 bg-white">
                                <SheetHeader className="mb-6">
                                    <SheetTitle className="text-xl font-bold text-slate-800">Filter by Status</SheetTitle>
                                </SheetHeader>
                                <div className="grid grid-cols-1 gap-3">
                                    {['All', 'Claimed', 'Approved', 'Disbursed', 'Rejected'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => {
                                                setStatusFilter(status);
                                                setDisplayLimit(10);
                                                setIsFilterSheetOpen(false);
                                            }}
                                            className={cn(
                                                "w-full px-5 py-4 rounded-2xl text-left font-bold transition-all border flex items-center justify-between",
                                                statusFilter === status
                                                    ? "bg-blue-50 text-blue-600 border-blue-200"
                                                    : "bg-white text-slate-500 border-slate-100"
                                            )}
                                        >
                                            <span>{status}</span>
                                            {statusFilter === status && (
                                                <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </SheetContent>
                        </Sheet>
                        <Sheet open={isDateSheetOpen} onOpenChange={setIsDateSheetOpen}>
                            <SheetTrigger asChild>
                                <button className="p-2 text-white hover:bg-white/10 rounded-full transition-colors relative shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]">
                                    <CalendarIcon className="h-6 w-6" />
                                    {dateRange.from && (
                                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-400 border-2 border-[#0a1e60] rounded-full"></span>
                                    )}
                                </button>
                            </SheetTrigger>
                            <SheetContent side="bottom" className="rounded-t-[2rem] px-6 pb-12 bg-white max-h-[90vh] overflow-y-auto w-full max-w-md mx-auto">
                                <SheetHeader className="mb-6 mt-4">
                                    <SheetTitle className="text-xl font-bold text-slate-800 text-center">Filter by Date</SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-col items-center justify-center w-full">
                                    <div className="bg-white rounded-xl border border-slate-100 p-2 shadow-sm">
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={dateRange?.from || (filterYear && filterYear !== 'All' ? new Date(parseInt(filterYear), new Date().getMonth(), 1) : new Date())}
                                            selected={dateRange as any}
                                            onSelect={(range) => {
                                                setDateRange(range as any || { from: null, to: null });
                                                setDisplayLimit(10);
                                            }}
                                            numberOfMonths={1}
                                            className="mx-auto"
                                        />
                                    </div>
                                    <div className="flex gap-4 w-full mt-8">
                                        <Button 
                                            variant="outline" 
                                            className="flex-1 rounded-xl py-6 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                                            onClick={() => {
                                                setDateRange({ from: null, to: null });
                                                setDisplayLimit(10);
                                                setIsDateSheetOpen(false);
                                            }}
                                        >
                                            Clear
                                        </Button>
                                        <Button 
                                            className="flex-1 rounded-xl py-6 bg-blue-600 hover:bg-blue-700 text-white font-bold h-auto shadow-[0_4px_12px_rgba(37,99,235,0.3)]"
                                            onClick={() => {
                                                setIsDateSheetOpen(false);
                                            }}
                                        >
                                            Apply Filter
                                        </Button>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>

            <div
                className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col relative"
            >

                {/* Tabs Section */}
                <div className="bg-white px-6 pt-6 pb-2 rounded-t-[2rem] shadow-sm z-10 shrink-0">
                    <div className="flex items-center justify-between p-1 bg-slate-50 border border-slate-100 rounded-full mb-4">
                        {['My Claims', 'Claim Requests'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => { setActiveTab(tab as any); setDisplayLimit(10); }}
                                className={cn(
                                    "flex-1 py-2.5 text-sm font-bold transition-all duration-200 rounded-full",
                                    activeTab === tab
                                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-100'
                                        : 'text-slate-400 hover:text-slate-600'
                                )}
                            >
                                <span className="flex items-center justify-center gap-2">
                                    {activeTab === tab && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                    )}
                                    {tab}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Stats Summary Area */}
                    {!loading && filteredClaims.length > 0 && (
                        <div className="grid grid-cols-3 gap-3 mb-2 px-1">
                            <div className="bg-blue-50/50 p-2 rounded-xl flex flex-col items-center border border-blue-100/50 shadow-sm">
                                <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">Claimed</span>
                                <span className="text-xs font-bold text-blue-700 font-mono">৳{totals.claimed.toLocaleString()}</span>
                            </div>
                            <div className="bg-emerald-50/50 p-2 rounded-xl flex flex-col items-center border border-emerald-100/50 shadow-sm">
                                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Disbursed</span>
                                <span className="text-xs font-bold text-emerald-700 font-mono">৳{totals.disbursed.toLocaleString()}</span>
                            </div>
                            <div className="bg-green-50/50 p-2 rounded-xl flex flex-col items-center border border-green-100/50 shadow-sm">
                                <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider">Approved</span>
                                <span className="text-xs font-bold text-green-700 font-mono">৳{totals.approved.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>


                {/* Main Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 pb-[160px] overscroll-contain">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                            <p>Loading claims...</p>
                        </div>
                    ) : filteredClaims.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <FileSpreadsheet className="h-16 w-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium">No {statusFilter !== 'All' ? statusFilter : ''} claims</p>
                        </div>
                    ) : (
                        <div className="space-y-4" style={{ contain: 'layout style' }}>
                            {paginatedClaims.map((claim: HRClaim) => (
                                <Card
                                    key={claim.id}
                                    onClick={() => {
                                        if (claim.status === 'Claimed' && activeTab === 'My Claims') {
                                            router.push(`/mobile/claim/create?id=${claim.id}`);
                                        } else if (activeTab === 'Claim Requests' && claim.status === 'Claimed') {
                                            router.push(`/mobile/claim/create?id=${claim.id}&source=requests`);
                                        }
                                    }}
                                    className={cn(
                                        "p-4 border-none shadow-sm rounded-xl bg-white relative overflow-hidden active:bg-slate-50 select-none",
                                        (claim.status === 'Claimed' && activeTab === 'My Claims') || (activeTab === 'Claim Requests' && claim.status === 'Claimed') ? "cursor-pointer hover:shadow-md border-l-4 border-l-blue-500" : "border-l-4 border-l-blue-400"
                                    )}
                                    style={{ contain: 'content', willChange: 'auto' }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-blue-600">{claim.claimNo}</span>
                                                <div className="flex items-center gap-3 grayscale-[0.2]">
                                                    {((claim.status === 'Claimed' && activeTab === 'My Claims') || 
                                                      (activeTab === 'Claim Requests' && claim.status === 'Claimed')) && (
                                                        <Edit2 className="h-3 w-3 text-blue-400" />
                                                    )}
                                                    {((activeTab === 'My Claims' && claim.status === 'Claimed') || (activeTab === 'Claim Requests' && isAdmin)) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setConfirmDelete({
                                                                    open: true,
                                                                    id: claim.id,
                                                                    claimNo: claim.claimNo
                                                                });
                                                            }}
                                                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-all border border-red-100/50 shadow-sm flex items-center gap-1"
                                                            title="Delete Claim"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                            <span className="text-[10px] font-bold">Delete</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                                toast({
                                                                    title: "PDF",
                                                                    description: "Preparing PDF Report...",
                                                                });

                                                                try {
                                                                    const companyProfile = {
                                                                        companyName: companyName || '',
                                                                        address: address || '',
                                                                        companyLogoUrl: companyLogoUrl || '',
                                                                        invoiceLogoUrl: invoiceLogoUrl || ''
                                                                    };

                                                                    // Fetch full employee data for better report
                                                                    const empSnap = await getDoc(doc(firestore, 'employees', claim.employeeId));
                                                                    const employee = empSnap.exists() ? empSnap.data() as Employee : undefined;

                                                                    await generateClaimPDF(claim, employee, companyProfile, true);
                                                                    toast({
                                                                        title: "Success",
                                                                        description: "PDF Report generated.",
                                                                    });
                                                                } catch (err) {
                                                                    console.error("PDF download failed", err);
                                                                    toast({
                                                                        title: "Error",
                                                                        description: "Failed to generate PDF report",
                                                                        variant: "destructive"
                                                                    });
                                                                }
                                                        }}
                                                        className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all border border-blue-100/50 shadow-sm flex items-center gap-1"
                                                        title="Download Double Page PDF"
                                                    >
                                                        <Download className="h-3 w-3" />
                                                        <span className="text-[10px] font-bold">PDF</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <span className="text-sm font-bold text-slate-800">{claim.employeeName}</span>
                                            <span className="text-[10px] font-bold text-slate-400">{claim.employeeCode}</span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <Badge className={cn(
                                                "text-[10px] font-bold px-2 py-0.5",
                                                claim.status === 'Approved' ? "bg-green-100 text-green-700" :
                                                    claim.status === 'Rejected' ? "bg-red-100 text-red-700" :
                                                        "bg-blue-100 text-blue-700"
                                            )}>
                                                {claim.status}
                                            </Badge>
                                            {claim.status === 'Disbursed' && (claim.remainingAmount || 0) > 0 && (
                                                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 shadow-sm whitespace-nowrap">
                                                    Due: ৳{claim.remainingAmount?.toLocaleString()}
                                                </span>
                                            )}
                                            <ClaimStopwatch claim={claim} />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-[11px] text-slate-500 mb-3">
                                        <div className="flex items-center gap-1">
                                            <span className="font-semibold text-slate-400">Date:</span>
                                            <span>{format(new Date(claim.claimDate), 'dd MMM yyyy')}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="font-semibold text-slate-400">Branch:</span>
                                            <span>{claim.branch || '-'}</span>
                                        </div>
                                    </div>

                                    {/* Claim Categories */}
                                    {claim.claimCategories && claim.claimCategories.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            {claim.claimCategories.map((cat, idx) => (
                                                <span
                                                    key={idx}
                                                    className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100/60"
                                                >
                                                    {cat}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex flex-row items-end justify-between gap-4 mt-2 pt-2 border-t border-slate-50 flex-wrap">
                                        <div className="flex flex-col items-start min-w-[90px]">
                                            <span className="text-[10px] text-slate-400">Claim Amount</span>
                                            <span className="text-sm font-bold text-blue-600">৳{claim.claimAmount.toLocaleString()}</span>
                                            {(claim.advancedAmount || 0) > 0 ? (
                                                <span className="text-[8px] text-slate-400 mt-0.5">(Net Case)</span>
                                            ) : null}
                                        </div>

                                        <div className="flex flex-row items-end gap-3 ml-auto">
                                            {(claim.advancedAmount || 0) > 0 && (
                                                <div className="flex flex-col items-center min-w-fit">
                                                    <span className="text-[10px] text-amber-600 font-bold mb-0.5">Advance</span>
                                                    <div className="bg-amber-500 text-white px-2.5 py-1 rounded-full shadow-sm shadow-amber-100 flex items-center justify-center min-w-[60px]">
                                                        <span className="text-xs font-bold">৳{claim.advancedAmount?.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {(claim.sanctionedAmount || 0) > 0 && (
                                                <div className="flex flex-col items-center min-w-fit">
                                                    <span className="text-[10px] text-emerald-600 font-bold mb-0.5">Disbursed</span>
                                                    <div className="bg-emerald-500 text-white px-2.5 py-1 rounded-full shadow-sm shadow-emerald-100 flex items-center justify-center min-w-[60px]">
                                                        <span className="text-xs font-bold">৳{claim.sanctionedAmount?.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex flex-col items-center min-w-fit">
                                                <span className="text-[10px] text-slate-400">Approved</span>
                                                <div className="bg-emerald-500 text-white px-2.5 py-1 rounded-full shadow-sm shadow-emerald-100 flex items-center justify-center min-w-[60px] mt-0.5">
                                                    <span className="text-xs font-bold">৳{(claim.approvedAmount || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {(claim.supervisorComments || claim.details?.some(d => d.supervisorComment)) && (
                                        <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100/50">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <MessageSquare className="h-3 w-3 text-amber-600" />
                                                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Supervisor Comments</span>
                                            </div>
                                            <div className="space-y-2">
                                                {claim.supervisorComments && (
                                                    <p className="text-[11px] text-slate-600 font-semibold leading-relaxed border-b border-amber-100/50 pb-1.5 mb-1.5">
                                                        {claim.supervisorComments}
                                                    </p>
                                                )}
                                                <div className="space-y-2">
                                                    {claim.details?.map((detail, dIdx) => detail.supervisorComment && (
                                                        <div key={detail.id || dIdx} className="flex flex-col gap-0.5">
                                                            <span className="text-[9px] font-bold text-amber-600/80 uppercase tracking-tight">{detail.categoryName}</span>
                                                            <p className="text-[11px] text-slate-600 font-semibold leading-relaxed">
                                                                {detail.supervisorComment}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}


                                </Card>
                            ))}

                            {/* Load More Button */}
                            {filteredClaims.length > displayLimit && (
                                <div className="pt-6 pb-28 flex justify-center">
                                    <Button
                                        onClick={() => setDisplayLimit(prev => prev + 10)}
                                        className="bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-bold rounded-2xl px-10 h-12 shadow-sm"
                                    >
                                        Load More ({filteredClaims.length - displayLimit} remaining)
                                    </Button>
                                </div>
                            )}

                            {/* Bottom spacing when all loaded */}
                            {filteredClaims.length <= displayLimit && (
                                <div className="pb-28" />
                            )}
                        </div>
                    )}
                </div>


                {/* Delete Confirmation Dialog */}
                <ConfirmDialog
                    isOpen={confirmDelete.open}
                    onOpenChange={(open) => setConfirmDelete(prev => ({ ...prev, open }))}
                    title="Delete Claim?"
                    description={`Are you sure you want to delete claim ${confirmDelete.claimNo}? This action cannot be undone.`}
                    variant="destructive"
                    confirmText="Delete"
                    onConfirm={async () => {
                        try {
                            await deleteDoc(doc(firestore, 'hr_claims', confirmDelete.id));
                            toast({
                                title: "Deleted",
                                description: "Claim has been removed successfully.",
                            });
                            setConfirmDelete(prev => ({ ...prev, open: false }));
                        } catch (err) {
                            console.error("Delete failed in Firestore:", err);
                            toast({
                                title: "Error",
                                description: `Failed to delete claim: ${err instanceof Error ? err.message : 'Unknown error'}`,
                                variant: "destructive"
                            });
                        }
                    }}
                />

                {/* Floating Action Button */}
                {activeTab === 'My Claims' && (
                    <Button
                        className="absolute bottom-[110px] right-6 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-xl flex items-center justify-center z-50 transition-transform active:scale-95 text-white"
                        onClick={() => {
                            router.push('/mobile/claim/create');
                        }}
                    >
                        <Plus className="h-8 w-8" />
                    </Button>
                )}
            </div>
        </div >
    );
}
