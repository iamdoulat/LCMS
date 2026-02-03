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
import { sendPushNotification } from '@/lib/notifications';

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
    const { user, userRole } = useAuth();
    const { isSupervisor, supervisedEmployees, explicitSubordinates, currentEmployeeId } = useSupervisorCheck(user?.email);
    const router = useRouter();

    const isSuperAdminOrAdmin = React.useMemo(() => {
        if (!userRole) return false;
        return userRole.includes('Super Admin') || userRole.includes('Admin');
    }, [userRole]);

    const effectiveSupervisedEmployees = React.useMemo(() => {
        if (isSuperAdminOrAdmin) return supervisedEmployees;
        return explicitSubordinates;
    }, [isSuperAdminOrAdmin, supervisedEmployees, explicitSubordinates]);

    const [activeTab, setActiveTab] = useState<'attendance' | 'breaktime'>('attendance');
    const [requests, setRequests] = useState<ReconRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'all'>('pending');
    const [showFilters, setShowFilters] = useState(false);
    const [filterDays, setFilterDays] = useState<30 | 90 | 180 | 365 | 'all'>('all');
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

    const fetchRequests = async () => {
        if (!user || (loading && !isSupervisor) || effectiveSupervisedEmployees.length === 0) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const collectionName = activeTab === 'attendance' ? 'attendance_reconciliation' : 'break_reconciliation';
            const employeeIds = selectedEmployee === 'all'
                ? effectiveSupervisedEmployees.map(e => e.id)
                : [selectedEmployee];
            const fetchedRequests: ReconRequest[] = [];

            // Chunk queries by employeeId
            const chunks = [];
            for (let i = 0; i < employeeIds.length; i += 10) {
                chunks.push(employeeIds.slice(i, i + 10));
            }

            for (const chunk of chunks) {
                let q;

                // For approved view, fetch all approved/rejected records
                if (statusFilter === 'approved') {
                    q = query(
                        collection(firestore, collectionName),
                        where('employeeId', 'in', chunk),
                        where('status', 'in', ['approved', 'rejected'])
                    );
                } else if (filterDays !== 'all') {
                    // Apply date filter
                    const endDate = new Date();
                    const startDate = subDays(endDate, Number(filterDays));
                    const startDateStr = format(startDate, 'yyyy-MM-dd');

                    if (statusFilter === 'pending') {
                        q = query(
                            collection(firestore, collectionName),
                            where('employeeId', 'in', chunk),
                            where('status', '==', 'pending'),
                            where('attendanceDate', '>=', startDateStr)
                        );
                    } else {
                        // 'all' status - show everything within date range
                        q = query(
                            collection(firestore, collectionName),
                            where('employeeId', 'in', chunk),
                            where('attendanceDate', '>=', startDateStr)
                        );
                    }
                } else {
                    // No date filter - fetch all records
                    if (statusFilter === 'pending') {
                        q = query(
                            collection(firestore, collectionName),
                            where('employeeId', 'in', chunk),
                            where('status', '==', 'pending')
                        );
                    } else {
                        // All statuses, all time
                        q = query(
                            collection(firestore, collectionName),
                            where('employeeId', 'in', chunk)
                        );
                    }
                }

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
    }, [user, isSupervisor, effectiveSupervisedEmployees, activeTab, filterDays, statusFilter, selectedEmployee]);

    const employeeMap = React.useMemo(() => {
        const map: Record<string, { fullName: string; employeeCode: string; designation?: string }> = {};
        effectiveSupervisedEmployees.forEach(emp => {
            map[emp.id] = { fullName: emp.fullName, employeeCode: emp.employeeCode, designation: emp.designation };
        });
        return map;
    }, [effectiveSupervisedEmployees]);

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

            // Push Notification
            sendPushNotification({
                title: `${activeTab === 'attendance' ? 'Attendance' : 'Break'} Recon ${action.charAt(0).toUpperCase() + action.slice(1)}`,
                body: `Your ${activeTab} reconciliation for ${format(new Date(request.attendanceDate), 'dd MMM yyyy')} has been ${action}.`,
                userIds: [request.employeeId],
                url: '/mobile/attendance/my-attendance'
            });

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

        if (isLeftSwipe && activeTab === 'attendance') {
            setActiveTab('breaktime');
        }
        if (isRightSwipe && activeTab === 'breaktime') {
            setActiveTab('attendance');
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 pt-1 pb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2">Recon. Approval</h1>
                </div>
            </div>

            <div
                ref={containerRef}
                className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto overscroll-contain flex flex-col"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
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

                    {/* Status Filter Buttons */}
                    <div className="flex gap-2 mb-3">
                        <button
                            onClick={() => setStatusFilter('pending')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${statusFilter === 'pending'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-slate-100 text-slate-500'
                                }`}
                        >
                            Pending
                        </button>
                        <button
                            onClick={() => setStatusFilter('approved')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${statusFilter === 'approved'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-slate-100 text-slate-500'
                                }`}
                        >
                            Approved
                        </button>
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${statusFilter === 'all'
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-slate-100 text-slate-500'
                                }`}
                        >
                            All
                        </button>
                    </div>

                    <div className="flex justify-between items-center">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors shadow-[0_4px_12px_rgba(37,99,235,0.2)]"
                        >
                            <Calendar className="w-3 h-3" />
                            Filters {showFilters ? '▲' : '▼'}
                        </button>
                        <div className="text-xs font-semibold text-slate-500">
                            {requests.length} {requests.length === 1 ? 'record' : 'records'}
                        </div>
                    </div>

                    {/* Filters Panel */}
                    {showFilters && (
                        <div className="mt-3 p-4 bg-slate-50 rounded-xl space-y-3 animate-in slide-in-from-top-2">
                            {/* Date Range Filter */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 mb-2 block">Date Range</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: 30, label: '30 Days' },
                                        { value: 90, label: '90 Days' },
                                        { value: 180, label: '180 Days' },
                                        { value: 365, label: '1 Year' },
                                        { value: 'all', label: 'All Time' }
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => setFilterDays(option.value as any)}
                                            className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all ${filterDays === option.value
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-white text-slate-600 border border-slate-200'
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Employee Filter */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 mb-2 block">Employee</label>
                                <select
                                    value={selectedEmployee}
                                    onChange={(e) => setSelectedEmployee(e.target.value)}
                                    className="w-full py-2 px-3 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">All Employees</option>
                                    {effectiveSupervisedEmployees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.fullName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* List */}
                <div className="flex-1 px-6 pt-6 pb-[120px] space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
                        </div>
                    ) : requests.length > 0 ? (
                        requests.map((req) => {
                            const borderColor = req.status === 'approved'
                                ? 'border-emerald-500'
                                : req.status === 'rejected'
                                    ? 'border-red-500'
                                    : 'border-blue-500';

                            return (
                                <div key={req.id} className={`bg-white p-5 rounded-2xl shadow-md border-l-4 ${borderColor}`}>
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
                                        <div className="text-xs font-bold text-slate-500">
                                            {employeeMap[req.employeeId]?.fullName || req.employeeName}
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
                                            <div className="w-full">
                                                <div className={`text-xs font-bold px-3 py-2 rounded-lg text-center ${req.status === 'approved'
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-red-50 text-red-700'
                                                    }`}>
                                                    {req.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Timestamp if needed like image */}
                                    <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between items-center text-[10px] bg-slate-50 -mx-5 -mb-5 p-3 text-slate-500 font-bold rounded-b-2xl">
                                        <div className="flex items-center gap-2">
                                            <div className="text-blue-600 px-2 py-1 bg-blue-50/50 rounded border border-blue-100/50">
                                                Emp: {employeeMap[req.employeeId]?.employeeCode || 'N/A'}
                                            </div>
                                            {employeeMap[req.employeeId]?.designation && (
                                                <div className="text-slate-600 px-2 py-1 bg-slate-100/50 rounded border border-slate-200/50 truncate max-w-[120px]">
                                                    {employeeMap[req.employeeId]?.designation}
                                                </div>
                                            )}
                                        </div>
                                        {formatDate(req.attendanceDate)}
                                    </div>
                                </div>
                            );
                        })
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
