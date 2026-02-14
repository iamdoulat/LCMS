"use client";

import React, { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { format, parseISO, subDays, parse } from 'date-fns';
import { ChevronLeft, Calendar, Clock, X, Plus, ArrowLeft, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import Swal from 'sweetalert2';
import { deleteDoc, doc } from 'firebase/firestore';

interface ReconRequest {
    id: string;
    attendanceDate: string; // YYYY-MM-DD
    status: 'Pending' | 'Approved' | 'Rejected';
    requestedInTime?: string; // ISO
    requestedOutTime?: string; // ISO
    inTimeRemarks?: string;
    outTimeRemarks?: string;
    createdAt?: any;
    // Breaktime specific fields
    requestedBreakStartTime?: string; // ISO
    requestedBreakEndTime?: string; // ISO
    reason?: string;
    // Actual attendance times
    actualInTime?: string;
    actualOutTime?: string;
    employeeId?: string;
}

export default function MyReconApplicationsPage() {
    const { user } = useAuth();
    const { currentEmployeeId } = useSupervisorCheck(user?.email);
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'attendance' | 'breaktime'>('attendance');
    const [requests, setRequests] = useState<ReconRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<ReconRequest | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
    const [showFilters, setShowFilters] = useState(false);
    const [filterDays, setFilterDays] = useState<30 | 90 | 180 | 365 | 'all'>(30);

    const fetchRequests = async () => {
        if (!currentEmployeeId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setRequests([]); // Clear previous data to avoid showing stale records during/after failed fetch
        try {
            const collectionName = activeTab === 'attendance' ? 'attendance_reconciliation' : 'break_reconciliation';

            let q;
            if (filterDays !== 'all') {
                const endDate = new Date();
                const startDate = subDays(endDate, Number(filterDays));
                const startDateStr = format(startDate, 'yyyy-MM-dd');

                q = query(
                    collection(firestore, collectionName),
                    where('employeeId', '==', currentEmployeeId),
                    where('attendanceDate', '>=', startDateStr)
                );
            } else {
                q = query(
                    collection(firestore, collectionName),
                    where('employeeId', '==', currentEmployeeId)
                );
            }

            const snapshot = await getDocs(q);
            let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReconRequest));

            // Fetch actual attendance times for attendance reconciliations
            if (activeTab === 'attendance') {
                const queryIds = [currentEmployeeId, user?.uid].filter((id): id is string => !!id);
                console.log('fetchRequests: Fetching actual times for', data.length, 'requests using IDs:', queryIds);

                try {
                    // Fetch all relevant attendance records in one query
                    let attQuery = query(
                        collection(firestore, 'attendance'),
                        where('employeeId', 'in', queryIds.slice(0, 30))
                    );

                    if (filterDays !== 'all') {
                        const endDate = new Date();
                        const startDate = subDays(endDate, Number(filterDays));
                        // We go back one extra day to be safe with timezones
                        const startDateStr = format(subDays(startDate, 1), 'yyyy-MM-dd');
                        attQuery = query(attQuery, where('date', '>=', startDateStr));
                    }

                    const attSnap = await getDocs(attQuery);
                    const allAttRecords = attSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                    console.log(`fetchRequests: Found ${allAttRecords.length} attendance records total for matching`);

                    const getDhakaDateStr = (date: any) => {
                        if (!date) return '';
                        try {
                            // Handle Date object, Firestore Timestamp, or ISO string
                            const d = (date && typeof date.toDate === 'function') ? date.toDate() : new Date(date);
                            if (isNaN(d.getTime())) return '';

                            return new Intl.DateTimeFormat('en-CA', {
                                timeZone: 'Asia/Dhaka',
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                            }).format(d);
                        } catch (e) {
                            return '';
                        }
                    };

                    // Match records in memory
                    data.forEach(req => {
                        const record = allAttRecords.find(r => {
                            const recordDhakaDate = getDhakaDateStr(r.date);
                            return recordDhakaDate === req.attendanceDate;
                        });

                        if (record) {
                            req.actualInTime = record.inTime;
                            req.actualOutTime = record.outTime;
                            console.log(`fetchRequests: Matched record for ${req.attendanceDate}:`, record.inTime, record.outTime);
                        }
                    });
                } catch (e) {
                    console.error("Error fetching bulk attendance records:", e);
                }
            }

            // Apply status filter client-side
            if (statusFilter !== 'all') {
                data = data.filter(req => req.status === statusFilter);
            }

            // Client side sort by date/created
            data.sort((a, b) => {
                const dateA = a.attendanceDate || '';
                const dateB = b.attendanceDate || '';
                return dateB.localeCompare(dateA); // Desc
            });

            setRequests(data);
        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [currentEmployeeId, activeTab, filterDays, statusFilter]);

    const containerRef = usePullToRefresh(fetchRequests);

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
            // Try parsing as ISO string first
            let date = parseISO(isoString);

            // If parseISO fails, try parsing as formatted time (e.g., "09:00 AM")
            if (isNaN(date.getTime())) {
                const baseDate = new Date();
                date = parse(isoString, 'hh:mm a', baseDate);
            }

            if (isNaN(date.getTime())) return isoString;
            return format(date, 'hh:mm a');
        } catch (e) {
            return isoString;
        }
    };

    // For Modal display - date only
    const formatModalDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return format(new Date(dateStr), 'EEE, d MMM yy');
        } catch {
            return dateStr;
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved': return 'bg-emerald-100 text-emerald-600';
            case 'Rejected': return 'bg-red-100 text-red-600';
            default: return 'bg-yellow-100 text-yellow-600'; // Pending
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

    const handleDelete = async (requestId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent modal from opening

        const result = await Swal.fire({
            title: 'Delete Reconciliation?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, delete it',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                const collectionName = activeTab === 'attendance' ? 'attendance_reconciliation' : 'break_reconciliation';
                await deleteDoc(doc(firestore, collectionName, requestId));

                // Refresh the list
                await fetchRequests();

                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Reconciliation request has been deleted.',
                    timer: 2000,
                    showConfirmButton: false
                });
            } catch (error) {
                console.error('Error deleting request:', error);
                Swal.fire('Error', 'Failed to delete the request.', 'error');
            }
        }
    };

    const handleEdit = (request: ReconRequest, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent modal from opening

        if (activeTab === 'attendance') {
            router.push(`/mobile/attendance/reconciliation?date=${request.attendanceDate}&employeeId=${currentEmployeeId}&editId=${request.id}`);
        } else {
            router.push(`/mobile/attendance/breaktime-reconciliation?date=${request.attendanceDate}&editId=${request.id}`);
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
                    <h1 className="text-xl font-bold text-white ml-2 flex-1">My Recon. Application</h1>
                    <button
                        onClick={fetchRequests}
                        className="p-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d] active:scale-95"
                    >
                        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto overscroll-contain flex flex-col"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {/* Tabs */}
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

                    {/* Status Filter Tabs */}
                    <div className="flex gap-2 mb-3">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${statusFilter === 'all'
                                ? 'bg-slate-600 text-white shadow-md'
                                : 'bg-slate-100 text-slate-500'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setStatusFilter('Pending')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${statusFilter === 'Pending'
                                ? 'bg-yellow-600 text-white shadow-md'
                                : 'bg-slate-100 text-slate-500'
                                }`}
                        >
                            Pending
                        </button>
                        <button
                            onClick={() => setStatusFilter('Approved')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${statusFilter === 'Approved'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-slate-100 text-slate-500'
                                }`}
                        >
                            Approved
                        </button>
                        <button
                            onClick={() => setStatusFilter('Rejected')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${statusFilter === 'Rejected'
                                ? 'bg-red-600 text-white shadow-md'
                                : 'bg-slate-100 text-slate-500'
                                }`}
                        >
                            Rejected
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
                        </div>
                    )}
                </div>

                {/* List */}
                <div className="flex-1 px-6 pt-6 pb-[120px] space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Plus className="animate-spin text-blue-600 w-8 h-8 opacity-0" /> {/* Hack for icon, assume loader icon exists */}
                            <span className="loading loading-spinner text-primary"></span>
                        </div>
                    ) : requests.length > 0 ? (
                        requests.map((req) => (
                            <div
                                key={req.id}
                                className="bg-white p-5 rounded-2xl shadow-md border-l-4 border-emerald-500 active:scale-[0.98] transition-transform relative"
                            >
                                {/* Action Buttons - Top Right */}
                                <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                                    <button
                                        onClick={(e) => handleEdit(req, e)}
                                        disabled={req.status?.toLowerCase() !== 'pending'}
                                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${req.status?.toLowerCase() === 'pending'
                                            ? 'bg-blue-500 text-white hover:bg-blue-600 active:scale-90'
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            }`}
                                        title={req.status?.toLowerCase() === 'pending' ? 'Edit' : 'Cannot edit - not pending'}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(req.id, e)}
                                        disabled={req.status?.toLowerCase() !== 'pending'}
                                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${req.status?.toLowerCase() === 'pending'
                                            ? 'bg-red-500 text-white hover:bg-red-600 active:scale-90'
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            }`}
                                        title={req.status?.toLowerCase() === 'pending' ? 'Delete' : 'Cannot delete - not pending'}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div onClick={() => setSelectedRequest(req)} className="cursor-pointer">
                                    <div className="flex items-center gap-2 mb-2 pr-20">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(req.status)}`}>
                                            {req.status || 'Pending'}
                                        </span>
                                        {activeTab === 'attendance' && (
                                            <>
                                                {req.requestedInTime && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600">In Time</span>}
                                                {req.requestedOutTime && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600">Out Time</span>}
                                            </>
                                        )}
                                    </div>
                                    <h3 className="text-slate-800 font-bold mb-3">
                                        {activeTab === 'attendance' ? 'Attendance Reconciliation' : 'Breaktime Reconciliation'} for <span className="text-blue-600">{formatDate(req.attendanceDate)}</span>
                                    </h3>

                                    {/* Show actual requested times instead of redundant dates */}
                                    {activeTab === 'attendance' ? (
                                        <div className="flex items-center gap-4 text-xs font-semibold">
                                            {req.requestedInTime && (
                                                <div className="flex items-center gap-1.5 bg-indigo-50 py-1.5 px-3 rounded-lg">
                                                    <Clock className="w-3 h-3 text-indigo-600" />
                                                    <span className="text-indigo-600">In: {formatTime(req.requestedInTime)}</span>
                                                </div>
                                            )}
                                            {req.requestedOutTime && (
                                                <div className="flex items-center gap-1.5 bg-purple-50 py-1.5 px-3 rounded-lg">
                                                    <Clock className="w-3 h-3 text-purple-600" />
                                                    <span className="text-purple-600">Out: {formatTime(req.requestedOutTime)}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-4 text-xs font-semibold">
                                            {req.requestedBreakStartTime && (
                                                <div className="flex items-center gap-1.5 bg-yellow-50 py-1.5 px-3 rounded-lg">
                                                    <Clock className="w-3 h-3 text-yellow-600" />
                                                    <span className="text-yellow-600">Start: {formatTime(req.requestedBreakStartTime)}</span>
                                                </div>
                                            )}
                                            {req.requestedBreakEndTime && (
                                                <div className="flex items-center gap-1.5 bg-orange-50 py-1.5 px-3 rounded-lg">
                                                    <Clock className="w-3 h-3 text-orange-600" />
                                                    <span className="text-orange-600">End: {formatTime(req.requestedBreakEndTime)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-full text-slate-400 mb-2">No data to show</div>
                            {activeTab === 'breaktime' && (
                                <div className="w-full py-3 bg-red-500 text-white text-sm font-medium mt-10">
                                    Break time reconciliation data is not found.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick View Modal */}
            <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && setSelectedRequest(null)}>
                <DialogContent className="max-w-[90%] rounded-3xl p-0 overflow-hidden bg-white">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Reconciliation Details</DialogTitle>
                    </DialogHeader>
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(selectedRequest?.status || 'Pending')}`}>
                                    {selectedRequest?.status || 'Pending'}
                                </span>
                                {activeTab === 'attendance' && selectedRequest?.requestedInTime && (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600">In Time</span>
                                )}
                                {activeTab === 'attendance' && selectedRequest?.requestedOutTime && (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-600">Out Time</span>
                                )}
                            </div>
                            <button onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {activeTab === 'attendance' && selectedRequest && (
                            <div className="space-y-6">
                                {/* In Time Section */}
                                {selectedRequest.requestedInTime && (
                                    <div>
                                        <h4 className="text-sm font-bold text-blue-600 mb-3">In Time</h4>
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            <div className="bg-indigo-50 p-2 rounded-xl">
                                                <div className="text-[10px] text-indigo-400 font-semibold mb-1">Existing Time</div>
                                                <div className="text-xs font-bold text-slate-700">{formatTime(selectedRequest.actualInTime)}</div>
                                            </div>
                                            <div className="bg-indigo-50 p-2 rounded-xl">
                                                <div className="text-[10px] text-indigo-400 font-semibold mb-1">Recon. Time</div>
                                                <div className="text-xs font-bold text-slate-700">{formatTime(selectedRequest.requestedInTime)}</div>
                                            </div>
                                            <div className="bg-indigo-50 p-2 rounded-xl">
                                                <div className="text-[10px] text-indigo-400 font-semibold mb-1">Recon. Date</div>
                                                <div className="text-xs font-bold text-slate-700">{formatModalDate(selectedRequest.attendanceDate)}</div>
                                            </div>
                                        </div>
                                        <div className="text-xs">
                                            <span className="text-indigo-400 font-semibold">Remarks</span>
                                            <div className="font-bold text-slate-700 mt-0.5">{selectedRequest.inTimeRemarks || 'N/A'}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Out Time Section */}
                                {selectedRequest.requestedOutTime && (
                                    <div>
                                        <h4 className="text-sm font-bold text-purple-600 mb-3">Out Time</h4>
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            <div className="bg-purple-50 p-2 rounded-xl">
                                                <div className="text-[10px] text-purple-400 font-semibold mb-1">Existing Time</div>
                                                <div className="text-xs font-bold text-slate-700">{formatTime(selectedRequest.actualOutTime)}</div>
                                            </div>
                                            <div className="bg-purple-50 p-2 rounded-xl">
                                                <div className="text-[10px] text-purple-400 font-semibold mb-1">Recon. Time</div>
                                                <div className="text-xs font-bold text-slate-700">{formatTime(selectedRequest.requestedOutTime)}</div>
                                            </div>
                                            <div className="bg-purple-50 p-2 rounded-xl">
                                                <div className="text-[10px] text-purple-400 font-semibold mb-1">Recon. Date</div>
                                                <div className="text-xs font-bold text-slate-700">{formatModalDate(selectedRequest.attendanceDate)}</div>
                                            </div>
                                        </div>
                                        <div className="text-xs">
                                            <span className="text-purple-400 font-semibold">Remarks</span>
                                            <div className="font-bold text-slate-700 mt-0.5">{selectedRequest.outTimeRemarks || 'N/A'}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'breaktime' && selectedRequest && (
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-yellow-600 mb-3">Break Details</h4>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-yellow-50 p-3 rounded-xl">
                                            <div className="text-[10px] text-yellow-600/60 font-semibold mb-1">Requested Start</div>
                                            <div className="text-sm font-bold text-slate-700">{formatTime(selectedRequest.requestedBreakStartTime)}</div>
                                        </div>
                                        <div className="bg-orange-50 p-3 rounded-xl">
                                            <div className="text-[10px] text-orange-600/60 font-semibold mb-1">Requested End</div>
                                            <div className="text-sm font-bold text-slate-700">{formatTime(selectedRequest.requestedBreakEndTime)}</div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl">
                                        <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Reason</div>
                                        <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                                            {selectedRequest.reason || 'No reason provided'}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50/50 p-3 rounded-xl flex items-center justify-between">
                                    <div className="text-xs font-bold text-blue-600">Reconciliation Date</div>
                                    <div className="text-xs font-bold text-blue-600">{formatModalDate(selectedRequest.attendanceDate)}</div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {selectedRequest && format(new Date(), 'dd-MM-yyyy hh:mm a')}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
