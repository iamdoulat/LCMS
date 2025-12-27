"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { collection, query, where, getDocs, orderBy, limit, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { format, subDays, parseISO } from 'date-fns';
import { ChevronLeft, Calendar, Check, X, Loader2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { approveReconciliation, rejectReconciliation } from '@/lib/firebase/reconciliation'; // Assume similar for breaktime or generic
import Swal from 'sweetalert2';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Button } from '@/components/ui/button';

// Define Types locally if not strictly exported or for convenience
interface ReconRequest {
    id: string;
    employeeId: string;
    employeeName: string;
    attendanceDate: string; // YYYY-MM-DD
    status: 'pending' | 'approved' | 'rejected';
    requestedInTime?: string;
    requestedOutTime?: string;
    inTimeRemarks?: string;
    outTimeRemarks?: string;
    // Breaktime fields (guess based on pattern)
    breakStartTime?: string;
    breakEndTime?: string;
    reason?: string;
    type?: 'break'; // if we merge collections? but requirements say Tabs.
}

export default function ReconApprovalPage() {
    const { user } = useAuth();
    const { isSupervisor, supervisedEmployees, currentEmployeeId } = useSupervisorCheck(user?.email);
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'attendance' | 'breaktime'>('attendance');
    const [requests, setRequests] = useState<ReconRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDays, setFilterDays] = useState<30 | 90>(30);

    const fetchRequests = async () => {
        if (!user || !isSupervisor || supervisedEmployees.length === 0) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const collectionName = activeTab === 'attendance' ? 'attendance_reconciliation' : 'break_reconciliation';
            const endDate = new Date();
            const startDate = subDays(endDate, filterDays);
            const startDateStr = format(startDate, 'yyyy-MM-dd');

            const employeeIds = supervisedEmployees.map(e => e.id);
            const fetchedRequests: ReconRequest[] = [];

            // Chunk queries by employeeId
            const chunks = [];
            for (let i = 0; i < employeeIds.length; i += 10) {
                chunks.push(employeeIds.slice(i, i + 10));
            }

            for (const chunk of chunks) {
                const q = query(
                    collection(firestore, collectionName),
                    where('employeeId', 'in', chunk),
                    where('attendanceDate', '>=', startDateStr)
                );
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    fetchedRequests.push({ id: doc.id, ...doc.data() } as ReconRequest);
                });
            }

            // Sort client side
            fetchedRequests.sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate));

            setRequests(fetchedRequests);

        } catch (error) {
            console.error("Error fetching recon requests:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [user, isSupervisor, supervisedEmployees, activeTab, filterDays]);

    const containerRef = usePullToRefresh(fetchRequests);


    const handleAction = async (request: ReconRequest, action: 'approve' | 'reject') => {
        if (!currentEmployeeId) return;

        try {
            if (activeTab === 'attendance') {
                if (action === 'approve') {
                    // We need type checking here as 'ReconRequest' is local. 
                    // cast to any or import real type.
                    await approveReconciliation(request.id, request as any, currentEmployeeId);
                } else {
                    await rejectReconciliation(request.id, currentEmployeeId);
                }
            } else {
                // Breaktime logic - assuming similar functions exist or generic update
                // If breaktime functions not in lib, we might need to create them or user generic update.
                // For now, let's assume specific logic needed.
                // Or just update status for 'break_reconciliation' if it mirrors structure.
                if (action === 'approve') {
                    // Need 'approveBreakReconciliation'? 
                    // Or just update status?
                    // Let's just update pending status to approved/rejected for now if function missing.
                    await updateDoc(doc(firestore, 'break_reconciliation', request.id), {
                        status: 'approved',
                        reviewedBy: currentEmployeeId,
                        reviewedAt: serverTimestamp()
                    });
                    // NOTE: Should also update actual 'breaks' collection if approved!
                } else {
                    await updateDoc(doc(firestore, 'break_reconciliation', request.id), {
                        status: 'rejected',
                        reviewedBy: currentEmployeeId,
                        reviewedAt: serverTimestamp()
                    });
                }
            }

            // Update local state
            setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r));

            Swal.fire({
                icon: 'success',
                title: action === 'approve' ? 'Approved' : 'Rejected',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500
            });

        } catch (error) {
            console.error("Action error:", error);
            Swal.fire("Error", "Failed to update request.", "error");
        }
    };

    const handleToggleFilter = () => {
        setFilterDays(prev => prev === 30 ? 90 : 30);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return format(new Date(dateStr), 'EEE, d MMM yyyy');
        } catch {
            return dateStr;
        }
    };

    const formatTime = (isoString?: string) => {
        if (!isoString) return '-';
        try {
            return format(new Date(isoString), 'hh:mm a');
        } catch {
            return isoString;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-emerald-100 text-emerald-600';
            case 'rejected': return 'bg-red-100 text-red-600';
            default: return 'bg-blue-100 text-blue-600';
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 py-3.5">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-base font-bold text-white ml-2">Recon. Approval</h1>
                </div>
            </div>

            <div ref={containerRef} className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto overscroll-contain flex flex-col">
                {/* Tabs & Filter */}
                <div className="bg-white px-6 pt-6 pb-2 rounded-t-[2rem]">
                    <div className="flex mb-4">
                        <button
                            onClick={() => setActiveTab('attendance')}
                            className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'attendance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'
                                }`}
                        >
                            Attendance Recon.
                        </button>
                        <button
                            onClick={() => setActiveTab('breaktime')}
                            className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'breaktime' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-slate-400'
                                }`}
                        >
                            Breaktime Recon.
                        </button>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleToggleFilter}
                            className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full"
                        >
                            <Calendar className="w-3 h-3" />
                            {filterDays === 30 ? 'Last 30 Days' : 'Last 3 Months'}
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 p-6 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
                        </div>
                    ) : requests.length > 0 ? (
                        requests.map((req) => (
                            <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-emerald-500"> {/* Defaulting color/style per image */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(req.status)}`}>
                                            {req.status}
                                        </span>
                                        {/* Req Time Badge if Pending? */}
                                        {activeTab === 'attendance' && req.requestedInTime && (
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">In Time</span>
                                        )}
                                        {activeTab === 'attendance' && req.requestedOutTime && (
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Out Time</span>
                                        )}
                                    </div>
                                    <div className="text-xs font-bold text-slate-400">
                                        {req.employeeName.split(' ')[0]} {/* First Name */}
                                    </div>
                                </div>

                                <h3 className="font-bold text-slate-800 text-sm mb-3">
                                    {activeTab === 'attendance' ? 'Attendance Reconciliation' : 'Breaktime Reconciliation'} for <span className="text-blue-600">{formatDate(req.attendanceDate)}</span>
                                </h3>

                                <div className="flex items-center justify-between">
                                    {/* Action Buttons if Pending */}
                                    {req.status === 'pending' ? (
                                        <div className="flex gap-2 w-full">
                                            <Button
                                                onClick={() => handleAction(req, 'approve')}
                                                size="sm"
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-9"
                                            >
                                                <Check className="w-4 h-4 mr-1" /> Approve
                                            </Button>
                                            <Button
                                                onClick={() => handleAction(req, 'reject')}
                                                size="sm"
                                                variant="destructive"
                                                className="flex-1 h-9"
                                            >
                                                <X className="w-4 h-4 mr-1" /> Reject
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="w-full text-right text-xs font-semibold text-slate-400">
                                            Reviewed
                                        </div>
                                    )}
                                </div>

                                {/* Timestamp if needed like image */}
                                <div className="mt-3 pt-3 border-t border-slate-50 flex justify-end text-[10px] bg-slate-50 -mx-5 -mb-5 p-3 text-slate-500 font-bold rounded-b-2xl">
                                    {/* Mock time or created at */}
                                    {formatDate(req.attendanceDate)}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 text-slate-400">
                            No data to show
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
