"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft, Loader2, FileSpreadsheet, Filter, Calendar as CalendarIcon, CheckCircle2, XCircle, Edit2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, Timestamp, limit, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { HRClaim, Employee } from '@/types';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Swal from 'sweetalert2';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { generateClaimPDF } from '@/components/reports/hr/ClaimReportPDF';

export default function ClaimListPage() {
    const router = useRouter();
    const { user, companyName, address, invoiceLogoUrl, companyLogoUrl } = useAuth();
    const { supervisedEmployeeIds, isSupervisor } = useSupervisorCheck(user?.email);
    const [activeTab, setActiveTab] = useState<'My Claims' | 'Claim Requests'>('My Claims');
    const [claims, setClaims] = useState<HRClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
    const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
    const [displayLimit, setDisplayLimit] = useState(12);

    const filteredClaims = React.useMemo(() => {
        let result = claims;
        if (statusFilter !== 'All') {
            result = result.filter(c => c.status === statusFilter);
        }
        if (dateRange.from && dateRange.to) {
            result = result.filter(c => {
                const claimDate = new Date(c.claimDate);
                return isWithinInterval(claimDate, {
                    start: startOfDay(dateRange.from!),
                    end: endOfDay(dateRange.to!)
                });
            });
        }
        return result;
    }, [claims, statusFilter, dateRange]);

    const totals = React.useMemo(() => {
        return filteredClaims.reduce((acc, c) => ({
            claimed: acc.claimed + (c.claimAmount || 0),
            approved: acc.approved + (c.approvedAmount || 0),
            disbursed: acc.disbursed + (c.sanctionedAmount || 0)
        }), { claimed: 0, approved: 0, disbursed: 0 });
    }, [filteredClaims]);

    const paginatedClaims = React.useMemo(() => {
        return filteredClaims.slice(0, displayLimit);
    }, [filteredClaims, displayLimit]);

    React.useEffect(() => {
        if (!user) return;

        let q;
        if (activeTab === 'My Claims') {
            q = query(
                collection(firestore, 'hr_claims'),
                where('employeeId', '==', user.uid)
            );
        } else {
            // "Claim Requests" tab for supervisors
            if (supervisedEmployeeIds.length === 0) {
                setClaims([]);
                setLoading(false);
                return;
            }
            // Firestore "in" query limited to 10/30 IDs usually, but let's assume team size is small or use chunks if needed.
            // For now, simple "in" query.
            q = query(
                collection(firestore, 'hr_claims'),
                where('employeeId', 'in', supervisedEmployeeIds)
            );
        }

        setLoading(true);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HRClaim));
            items.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
            });
            setClaims(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, activeTab, supervisedEmployeeIds]);

    // Swipe Handling
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe && activeTab === 'My Claims') {
            setActiveTab('Claim Requests');
        }
        if (isRightSwipe && activeTab === 'Claim Requests') {
            setActiveTab('My Claims');
        }
    };


    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-[5px] pb-6 relative">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors z-10 shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-bold text-white absolute inset-0 flex items-center justify-center pointer-events-none pt-[5px] pb-6">Claim</h1>
                    <div className="flex items-center">
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
                                    {['All', 'Claimed', 'Under Process', 'Approved by supervisor', 'Approved', 'Disbursed', 'Rejected'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => {
                                                setStatusFilter(status);
                                                setIsFilterSheetOpen(false);
                                            }}
                                            className={cn(
                                                "w-full px-5 py-4 rounded-2xl text-left font-bold transition-all border flex items-center justify-between",
                                                statusFilter === status
                                                    ? "bg-blue-50 text-blue-600 border-blue-200"
                                                    : "bg-white text-slate-500 border-slate-100"
                                            )}
                                        >
                                            <span>{status === 'Claimed' ? 'Pending' : status}</span>
                                            {statusFilter === status && (
                                                <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </SheetContent>
                        </Sheet>
                        <button
                            onClick={() => {
                                // For now, simple date filter logic or show a prompt
                                // In a real app, use a proper Mobile Date Range Picker
                                Swal.fire({
                                    title: 'Filter by Date',
                                    html: `
                                        <div class="flex flex-col gap-3">
                                            <input type="date" id="from-date" class="swal2-input m-0 w-full" placeholder="From Date">
                                            <input type="date" id="to-date" class="swal2-input m-0 w-full" placeholder="To Date">
                                        </div>
                                    `,
                                    showCancelButton: true,
                                    confirmButtonText: 'Apply Filter',
                                    confirmButtonColor: '#2563eb',
                                    preConfirm: () => {
                                        const from = (document.getElementById('from-date') as HTMLInputElement).value;
                                        const to = (document.getElementById('to-date') as HTMLInputElement).value;
                                        return { from, to };
                                    }
                                }).then((result) => {
                                    if (result.isConfirmed) {
                                        const { from, to } = result.value;
                                        if (from && to) {
                                            setDateRange({ from: new Date(from), to: new Date(to) });
                                        } else {
                                            setDateRange({ from: null, to: null });
                                        }
                                    }
                                });
                            }}
                            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors relative shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                        >
                            <CalendarIcon className="h-6 w-6" />
                            {dateRange.from && (
                                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-400 border-2 border-[#0a1e60] rounded-full"></span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div
                className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col relative"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >

                {/* Tabs Section */}
                <div className="bg-white px-6 pt-6 pb-2 rounded-t-[2rem] shadow-sm z-10 shrink-0">
                    <div className="flex items-center justify-between p-1 bg-slate-50 border border-slate-100 rounded-full mb-4">
                        {['My Claims', 'Claim Requests'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
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
                <div className="flex-1 overflow-y-auto px-5 py-4 pb-[120px] overscroll-contain">
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
                        <div className="space-y-4">
                            {paginatedClaims.map((claim: HRClaim) => (
                                <Card
                                    key={claim.id}
                                    onClick={() => {
                                        if (claim.status === 'Claimed' && activeTab === 'My Claims') {
                                            router.push(`/mobile/claim/create?id=${claim.id}`);
                                        }
                                    }}
                                    className={cn(
                                        "p-4 border-none shadow-sm rounded-xl bg-white relative overflow-hidden transition-all active:bg-slate-50 select-none",
                                        claim.status === 'Claimed' && activeTab === 'My Claims' ? "cursor-pointer hover:shadow-md border-l-4 border-l-blue-500" : "border-l-4 border-l-blue-400"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-blue-600">{claim.claimNo}</span>
                                                <div className="flex items-center gap-1.5">
                                                    {claim.status === 'Claimed' && activeTab === 'My Claims' && (
                                                        <Edit2 className="h-3 w-3 text-blue-400" />
                                                    )}
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            Swal.fire({
                                                                title: 'Preparing PDF...',
                                                                text: 'Please wait while we generate your report.',
                                                                allowOutsideClick: false,
                                                                didOpen: () => {
                                                                    Swal.showLoading();
                                                                }
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
                                                                Swal.close();
                                                            } catch (err) {
                                                                console.error("PDF download failed", err);
                                                                Swal.fire('Error', 'Failed to generate PDF report', 'error');
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
                                        <Badge className={cn(
                                            "text-[10px] font-bold px-2 py-0.5",
                                            claim.status === 'Approved' ? "bg-green-100 text-green-700" :
                                                claim.status === 'Rejected' ? "bg-red-100 text-red-700" :
                                                    "bg-blue-100 text-blue-700"
                                        )}>
                                            {claim.status}
                                        </Badge>
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

                                    <div className="flex flex-row items-end justify-between gap-4 mt-2 pt-2 border-t border-slate-50 overflow-x-auto no-scrollbar">
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

                                    {/* Supervisor Actions */}
                                    {activeTab === 'Claim Requests' && (claim.status === 'Claimed' || claim.status === 'Under Process' || claim.status === 'Approved by supervisor') && (
                                        <div className="mt-4 pt-4 border-t border-dashed border-slate-100 flex gap-3">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    Swal.fire({
                                                        title: 'Approve Claim?',
                                                        text: `Approve claim ${claim.claimNo} for BDT ${claim.claimAmount}?`,
                                                        icon: 'question',
                                                        showCancelButton: true,
                                                        confirmButtonText: 'Yes, Approve',
                                                        confirmButtonColor: '#059669',
                                                        cancelButtonColor: '#ef4444'
                                                    }).then(async (result) => {
                                                        if (result.isConfirmed) {
                                                            try {
                                                                await updateDoc(doc(firestore, 'hr_claims', claim.id), {
                                                                    status: 'Approved',
                                                                    updatedAt: Timestamp.now(),
                                                                    approvedAmount: claim.claimAmount // Default to full amount
                                                                });
                                                                Swal.fire({
                                                                    title: 'Approved!',
                                                                    icon: 'success',
                                                                    timer: 2000,
                                                                    showConfirmButton: false
                                                                });
                                                            } catch (err) {
                                                                Swal.fire('Error', 'Failed to update claim status', 'error');
                                                            }
                                                        }
                                                    });
                                                }}
                                                className="flex-1 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 rounded-xl h-10 font-bold"
                                            >
                                                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                                Approve
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    Swal.fire({
                                                        title: 'Reject Claim?',
                                                        text: `Reject claim ${claim.claimNo}?`,
                                                        icon: 'warning',
                                                        input: 'textarea',
                                                        inputPlaceholder: 'Reason for rejection...',
                                                        showCancelButton: true,
                                                        confirmButtonText: 'Yes, Reject',
                                                        confirmButtonColor: '#ef4444',
                                                        preConfirm: (reason) => {
                                                            if (!reason) {
                                                                Swal.showValidationMessage('Please provide a reason');
                                                                return false;
                                                            }
                                                            return reason;
                                                        }
                                                    }).then(async (result) => {
                                                        if (result.isConfirmed) {
                                                            try {
                                                                await updateDoc(doc(firestore, 'hr_claims', claim.id), {
                                                                    status: 'Rejected',
                                                                    updatedAt: Timestamp.now(),
                                                                    rejectionReason: result.value
                                                                });
                                                                Swal.fire({
                                                                    title: 'Rejected!',
                                                                    icon: 'info',
                                                                    timer: 2000,
                                                                    showConfirmButton: false
                                                                });
                                                            } catch (err) {
                                                                Swal.fire('Error', 'Failed to reject claim', 'error');
                                                            }
                                                        }
                                                    });
                                                }}
                                                className="flex-1 bg-red-50 border-red-200 text-red-700 hover:bg-red-100 rounded-xl h-10 font-bold"
                                            >
                                                <XCircle className="h-4 w-4 mr-1.5" />
                                                Reject
                                            </Button>
                                        </div>
                                    )}
                                </Card>
                            ))}

                            {/* Load More Button */}
                            {filteredClaims.length > displayLimit && (
                                <div className="pt-2 pb-6 flex justify-center">
                                    <Button
                                        onClick={() => setDisplayLimit(prev => prev + 12)}
                                        className="bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-bold rounded-2xl px-10 h-12 shadow-sm"
                                    >
                                        Load More
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

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
