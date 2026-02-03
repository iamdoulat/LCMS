"use client";

import React, { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { format, parseISO, subDays } from 'date-fns';
import { ChevronLeft, Calendar, Clock, X, Plus, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface ReconRequest {
    id: string;
    attendanceDate: string; // YYYY-MM-DD
    status: 'Pending' | 'Approved' | 'Rejected';
    requestedInTime?: string; // ISO
    requestedOutTime?: string; // ISO
    inTimeRemarks?: string;
    outTimeRemarks?: string;
    createdAt?: any;
    // Breaktime specific fields (guess)
    breakStartTime?: string;
    breakEndTime?: string;
    reason?: string;
}

export default function MyReconApplicationsPage() {
    const { user } = useAuth();
    const { currentEmployeeId } = useSupervisorCheck(user?.email);
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'attendance' | 'breaktime'>('attendance');
    const [requests, setRequests] = useState<ReconRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<ReconRequest | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [filterDays, setFilterDays] = useState<30 | 90 | 180 | 365 | 'all'>('all');

    const fetchRequests = async () => {
        if (!currentEmployeeId) {
            setLoading(false);
            return;
        }

        setLoading(true);
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
            return format(new Date(isoString), 'hh:mm a');
        } catch {
            return 'Invalid Time';
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

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 pt-1 pb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2 flex-1">My Recon. Application</h1>


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
                                onClick={() => setSelectedRequest(req)}
                                className="bg-white p-5 rounded-2xl shadow-md border-l-4 border-emerald-500 cursor-pointer active:scale-[0.98] transition-transform"
                            >
                                <div className="flex items-center gap-2 mb-2">
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
                                <div className="flex items-center justify-end text-xs font-semibold text-slate-500 bg-slate-50 py-1.5 px-3 rounded-lg inline-flex ml-auto w-fit">
                                    <Calendar className="w-3 h-3 mr-1.5" />
                                    {/* Showing Created Date or Attendance Date again? Image shows "09-02-2025 06:12 PM", looks like submitted time */}
                                    {/* If createdAt is timestamp, convert. If not available, use current? */}
                                    {/* Mocking generic formatted date for now if createdAt missing */}
                                    {formatDate(req.attendanceDate)}
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
                                                <div className="text-xs font-bold text-slate-700">--:-- --</div>
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
                                                <div className="text-xs font-bold text-slate-700">--:-- --</div>
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
