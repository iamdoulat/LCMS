"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ChevronLeft, MapPin, Map as MapIcon, ArrowRight, Loader2, Calendar, Check, X, ArrowLeft, Filter, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MultipleCheckInOutRecord } from '@/types/checkInOut';
import { Button } from '@/components/ui/button';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { updateCheckInOutStatus } from '@/lib/firebase/checkInOut';
import Swal from 'sweetalert2';
import { sendPushNotification } from '@/lib/notifications';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

interface UnifiedApprovalRecord extends MultipleCheckInOutRecord {
    source: 'multiple' | 'daily';
    employeeCode?: string;
    displayTime?: string;
}

export default function RemoteAttendanceApprovalPage() {
    const { user, userRole } = useAuth();
    const { isSupervisor, supervisedEmployees, explicitSubordinates, currentEmployeeId, isLoading: isSupervisorLoading } = useSupervisorCheck(user?.email);
    const router = useRouter();

    const isSuperAdminOrAdmin = React.useMemo(() => {
        if (!userRole) return false;
        return userRole.includes('Super Admin') || userRole.includes('Admin');
    }, [userRole]);

    const effectiveSupervisedEmployees = React.useMemo(() => {
        if (isSuperAdminOrAdmin) return supervisedEmployees;
        return explicitSubordinates;
    }, [isSuperAdminOrAdmin, supervisedEmployees, explicitSubordinates]);

    const [records, setRecords] = useState<UnifiedApprovalRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
    const [typeFilter, setTypeFilter] = useState<'All' | 'In Time' | 'Out Time'>('All');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfDay(subDays(new Date(), 30)),
        to: endOfDay(new Date()),
    });

    const [selectedRecord, setSelectedRecord] = useState<UnifiedApprovalRecord | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(50);

    // Month selection logic
    const currentMonthIndex = new Date().getMonth(); // 0-11
    const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIndex);

    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    // Load from cache on mount
    useEffect(() => {
        const cachedRecords = localStorage.getItem('remoteAttendanceRecords');
        if (cachedRecords) {
            try {
                setRecords(JSON.parse(cachedRecords));
                setLoading(false); // If we have cache, we can hide initial loader early
            } catch (e) {
                console.error('Error parsing cached records', e);
            }
        }
    }, []);

    useEffect(() => {
        const year = new Date().getFullYear();
        const from = startOfDay(new Date(year, selectedMonth, 1));
        const to = endOfDay(new Date(year, selectedMonth + 1, 0));
        setDateRange({ from, to });
    }, [selectedMonth]);

    const fetchRemoteAttendance = async () => {
        if (!user || isSupervisorLoading) return;

        if (!isSupervisor || effectiveSupervisedEmployees.length === 0) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const startDate = dateRange?.from || subDays(new Date(), 30);
            const fetchedRecords: UnifiedApprovalRecord[] = [];

            const normalizeStatus = (s: string) => {
                if (!s) return 'Pending';
                const trimmed = s.toString().trim();
                const lower = trimmed.toLowerCase();
                if (lower === 'pending') return 'Pending';
                if (lower === 'approved') return 'Approved';
                if (lower === 'rejected') return 'Rejected';
                return trimmed; // Return trimmed version if it's something else
            };

            const processDaily = (snap: any) => {
                snap.forEach((doc: any) => {
                    const data = doc.data();
                    const emp = effectiveSupervisedEmployees.find(e => e.id === data.employeeId || e.uid === data.employeeId);

                    // Skip if employee is not in supervised list
                    if (!emp) {
                        // console.log(`[processDaily] Skipping doc ${doc.id} - Employee ${data.employeeId} not supervised`);
                        return;
                    }

                    // Map daily attendance records - Show if it was a remote attendance
                    // Remote if: Pending OR (Approved/Rejected AND was outside geofence)
                    const statusIn = normalizeStatus(data.inTimeApprovalStatus || data.approvalStatus);

                    const isInTimeRemote = (statusIn === 'Pending') || (data.isInsideGeofence === false);

                    if (isInTimeRemote) {
                        fetchedRecords.push({
                            id: doc.id,
                            employeeId: data.employeeId || data.uid,
                            employeeName: data.employeeName || emp?.fullName || 'Unknown',
                            employeeCode: emp?.employeeCode || 'N/A',
                            type: 'In Time',
                            timestamp: data.date,
                            location: {
                                latitude: data.inTimeLocation?.latitude || 0,
                                longitude: data.inTimeLocation?.longitude || 0,
                                address: data.inTimeAddress || 'Unknown'
                            },
                            remarks: data.inTimeRemarks || '',
                            status: statusIn,
                            imageURL: '',
                            source: 'daily',
                            createdAt: data.createdAt,
                            updatedAt: data.updatedAt,
                            companyName: 'Office'
                        } as UnifiedApprovalRecord);
                    }

                    const statusOut = normalizeStatus(data.outTimeApprovalStatus || 'Approved');
                    const isOutTimeRemote = (statusOut === 'Pending') || (data.outTime && data.outTimeIsInsideGeofence === false);

                    if (isOutTimeRemote) {
                        fetchedRecords.push({
                            id: doc.id + '_out',
                            employeeId: data.employeeId || data.uid,
                            employeeName: data.employeeName || emp?.fullName || 'Unknown',
                            employeeCode: emp?.employeeCode || 'N/A',
                            type: 'Out Time',
                            timestamp: data.date,
                            displayTime: data.outTime,
                            location: {
                                latitude: data.outTimeLocation?.latitude || 0,
                                longitude: data.outTimeLocation?.longitude || 0,
                                address: data.outTimeAddress || 'Unknown'
                            },
                            remarks: data.outTimeRemarks || '',
                            status: statusOut,
                            imageURL: '',
                            source: 'daily',
                            createdAt: data.createdAt,
                            updatedAt: data.updatedAt,
                            companyName: 'Office',
                            originalId: doc.id
                        } as UnifiedApprovalRecord & { originalId: string });
                    }
                });
            };

            const processMultiple = (snap: any) => {
                snap.forEach((doc: any) => {
                    const data = doc.data();
                    const emp = effectiveSupervisedEmployees.find(e => e.id === data.employeeId);

                    if (!emp) return;

                    fetchedRecords.push({
                        id: doc.id,
                        employeeId: data.employeeId,
                        employeeName: data.employeeName || emp.fullName,
                        employeeCode: emp.employeeCode || 'N/A',
                        type: data.type || 'Visit',
                        timestamp: data.timestamp || data.createdAt?.toDate?.()?.toISOString(),
                        location: data.location || { address: 'Unknown' },
                        remarks: data.remarks || '',
                        status: normalizeStatus(data.status || data.approvalStatus),
                        imageURL: data.imageURL || '',
                        source: 'multiple',
                        createdAt: data.createdAt,
                        updatedAt: data.updatedAt,
                        companyName: data.companyName || 'Unknown'
                    } as UnifiedApprovalRecord);
                });
            };

            // Get supervised employee IDs
            const employeeIds = effectiveSupervisedEmployees.map(e => e.id);
            const employeeUids = effectiveSupervisedEmployees.map(e => e.uid).filter(Boolean) as string[];
            const allTeamIds = Array.from(new Set([...employeeIds, ...employeeUids]));

            if (allTeamIds.length === 0) {
                setRecords([]);
                setLoading(false);
                return;
            }

            const chunks = [];
            for (let i = 0; i < allTeamIds.length; i += 10) {
                chunks.push(allTeamIds.slice(i, i + 10));
            }

            for (const chunk of chunks) {
                try {
                    // Fetch separate queries to avoid composite index requirements and 'in' filter limitations
                    const qRemoteIn = query(
                        collection(firestore, 'attendance'),
                        where('employeeId', 'in', chunk),
                        where('isInsideGeofence', '==', false)
                    );

                    const qRemoteOut = query(
                        collection(firestore, 'attendance'),
                        where('employeeId', 'in', chunk),
                        where('outTimeIsInsideGeofence', '==', false)
                    );

                    // Fetch Pending/pending for overall approvalStatus
                    const qPendingIn = query(
                        collection(firestore, 'attendance'),
                        where('employeeId', 'in', chunk),
                        where('approvalStatus', '==', 'Pending')
                    );

                    const qPendingInLower = query(
                        collection(firestore, 'attendance'),
                        where('employeeId', 'in', chunk),
                        where('approvalStatus', '==', 'pending')
                    );

                    // Fetch Pending/pending for inTimeApprovalStatus (specifically)
                    const qPendingInTimeUpper = query(
                        collection(firestore, 'attendance'),
                        where('employeeId', 'in', chunk),
                        where('inTimeApprovalStatus', '==', 'Pending')
                    );

                    const qPendingInTimeLower = query(
                        collection(firestore, 'attendance'),
                        where('employeeId', 'in', chunk),
                        where('inTimeApprovalStatus', '==', 'pending')
                    );

                    // Fetch Pending/pending for outTimeApprovalStatus
                    // We split this because Firestore doesn't allow 'in' filter with multiple values if we already used 'in' for employeeId
                    const qPendingOutUpper = query(
                        collection(firestore, 'attendance'),
                        where('employeeId', 'in', chunk),
                        where('outTimeApprovalStatus', '==', 'Pending')
                    );

                    const qPendingOutLower = query(
                        collection(firestore, 'attendance'),
                        where('employeeId', 'in', chunk),
                        where('outTimeApprovalStatus', '==', 'pending')
                    );

                    const qMultiple = query(
                        collection(firestore, 'multiple_check_inout'),
                        where('employeeId', 'in', chunk)
                    );

                    const [
                        snapRemoteIn,
                        snapRemoteOut,
                        snapPendingIn,
                        snapPendingInLower,
                        snapPendingInTimeUpper,
                        snapPendingInTimeLower,
                        snapPendingOutUpper,
                        snapPendingOutLower,
                        snapMultiple
                    ] = await Promise.all([
                        getDocs(qRemoteIn),
                        getDocs(qRemoteOut),
                        getDocs(qPendingIn),
                        getDocs(qPendingInLower),
                        getDocs(qPendingInTimeUpper),
                        getDocs(qPendingInTimeLower),
                        getDocs(qPendingOutUpper),
                        getDocs(qPendingOutLower),
                        getDocs(qMultiple)
                    ]);

                    const uniqueDocs = new Map();
                    [
                        snapRemoteIn,
                        snapRemoteOut,
                        snapPendingIn,
                        snapPendingInLower,
                        snapPendingInTimeUpper,
                        snapPendingInTimeLower,
                        snapPendingOutUpper,
                        snapPendingOutLower
                    ].forEach(snap => {
                        snap.forEach(doc => uniqueDocs.set(doc.id, doc));
                    });

                    processDaily(Array.from(uniqueDocs.values()));
                    processMultiple(snapMultiple);
                } catch (err) {
                    console.error("Error fetching attendance for chunk:", err);
                }
            }

            // Filter by date range and sort
            const filteredRecords = fetchedRecords.filter((r) => {
                const recordDate = new Date(r.timestamp);
                const isWithinDate = dateRange?.from && dateRange?.to
                    ? recordDate >= startOfDay(dateRange.from) && recordDate <= endOfDay(dateRange.to)
                    : true;

                const matchesStatus = statusFilter === 'All'
                    ? true
                    : (r.status || 'Pending') === statusFilter;

                const matchesType = typeFilter === 'All'
                    ? true
                    : r.type === typeFilter;

                return isWithinDate && matchesStatus && matchesType;
            });

            filteredRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setRecords(filteredRecords);

            // Update cache
            localStorage.setItem('remoteAttendanceRecords', JSON.stringify(filteredRecords));

        } catch (error) {
            console.error("Error fetching remote attendance:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setVisibleCount(50); // Reset count on filter change
        if (!isSupervisorLoading) {
            fetchRemoteAttendance();
        }
    }, [user, isSupervisor, effectiveSupervisedEmployees, dateRange, statusFilter, typeFilter, isSupervisorLoading]);

    const containerRef = usePullToRefresh(fetchRemoteAttendance);



    const getActiveFiltersCount = () => {
        let count = 0;
        // Status is active if NOT Pending (since Pending is default)
        if (statusFilter !== 'Pending') count++;
        if (typeFilter !== 'All') count++;
        // Active if not current month
        if (selectedMonth !== currentMonthIndex) count++;
        return count;
    };

    const handleCardClick = (record: UnifiedApprovalRecord) => {
        const status = record.status || 'Pending';
        if (status === 'Pending' || status === 'Rejected') {
            setSelectedRecord(record);
            setIsDialogOpen(true);
        }
    };

    const handleAction = async (action: 'Approved' | 'Rejected') => {
        if (!selectedRecord) return;

        if (!currentEmployeeId) {
            Swal.fire("Error", "Could not identify your employee ID. Please try reloading.", "error");
            return;
        }

        setProcessingId(selectedRecord.id);
        try {
            const { doc, updateDoc, serverTimestamp, getDoc } = await import('firebase/firestore');
            const realDocId = (selectedRecord as any).originalId || selectedRecord.id;

            if (selectedRecord.source === 'multiple') {
                const docRef = doc(firestore, 'multiple_check_inout', realDocId);
                await updateDoc(docRef, {
                    status: action,
                    approvalStatus: action,
                    reviewedBy: currentEmployeeId,
                    reviewedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            } else {
                // Update Daily Attendance
                const docRef = doc(firestore, 'attendance', realDocId);

                if (selectedRecord.type === 'In Time') {
                    if (action === 'Approved') {
                        const snap = await getDoc(docRef);
                        const inTime = snap.data()?.inTime;
                        const { determineAttendanceFlag } = await import('@/lib/firebase/utils');
                        const calculatedFlag = determineAttendanceFlag(inTime);
                        const flag = calculatedFlag || 'P'; // Safety fallback

                        await updateDoc(docRef, {
                            approvalStatus: 'Approved',
                            inTimeApprovalStatus: 'Approved',
                            flag: flag,
                            reviewedBy: currentEmployeeId,
                            reviewedAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        });
                    } else {
                        await updateDoc(docRef, {
                            approvalStatus: 'Rejected',
                            inTimeApprovalStatus: 'Rejected',
                            flag: 'A',
                            reviewedBy: currentEmployeeId,
                            reviewedAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        });
                    }
                } else if (selectedRecord.type === 'Out Time') {
                    const snap = await getDoc(docRef);
                    const currentData = snap.data();

                    const updates: any = {
                        outTimeApprovalStatus: action,
                        reviewedBy: currentEmployeeId,
                        reviewedAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    };

                    // If outTime is approved, and inTime is also approved (or wasn't pending), 
                    // we can set the overall approvalStatus to Approved.
                    if (action === 'Approved') {
                        if (currentData?.inTimeApprovalStatus !== 'Pending' && currentData?.approvalStatus !== 'Rejected') {
                            updates.approvalStatus = 'Approved';
                        }
                    } else {
                        // Rejection of OutTime does not affect overall flag or approval status per user request
                    }

                    await updateDoc(docRef, updates);
                }
            }

            // Send Push Notification to Employee
            if (selectedRecord.employeeId) {
                const emp = effectiveSupervisedEmployees.find(e => e.id === selectedRecord.employeeId || e.uid === selectedRecord.employeeId);
                const uid = emp?.uid || selectedRecord.employeeId;
                const recordDate = selectedRecord.timestamp ? format(new Date(selectedRecord.timestamp), 'dd MMM yyyy') : 'today';

                sendPushNotification({
                    title: `Attendance ${action}`,
                    body: `Your ${selectedRecord.type} for ${recordDate} has been ${action.toLowerCase()}.`,
                    userIds: [uid],
                    url: '/mobile/attendance/my-attendance'
                });
            }

            setRecords(prev => prev.map(r => r.id === selectedRecord.id ? { ...r, status: action } : r));

            Swal.fire({
                icon: 'success',
                title: action,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500
            });
            setIsDialogOpen(false);
        } catch (error: any) {
            console.error("Error updating status:", error);
            Swal.fire("Error", `Failed to update status: ${error.message || 'Unknown error'}`, "error");
        } finally {
            setProcessingId(null);
            setIsDialogOpen(false);
        }
    };

    const getStatusColor = (status?: string) => {
        if (status === 'Approved') return 'bg-emerald-100 text-emerald-600';
        if (status === 'Rejected') return 'bg-red-100 text-red-600';
        return 'bg-blue-100 text-blue-600';
    };

    const getEmployeePhoto = (id: string) => {
        const emp = effectiveSupervisedEmployees.find(e => e.id === id);
        return emp?.photoURL;
    }

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-1 pb-6">
                    <div className="flex items-center">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white ml-2">Remote Att. Approval</h1>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => fetchRemoteAttendance()}
                            disabled={loading}
                            className="p-2 text-white hover:bg-white/10 rounded-full transition-all shadow-[0_4px_12px_rgba(0,0,0,0.4)] active:scale-95 bg-[#1a2b6d] disabled:opacity-50"
                        >
                            <RefreshCw className={`h-6 w-6 ${loading ? 'animate-spin' : ''}`} />
                        </button>

                        <Sheet>
                            <SheetTrigger asChild>
                                <button className="relative p-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]">
                                    <Filter className="h-6 w-6" />
                                    {getActiveFiltersCount() > 0 && (
                                        <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0a1e60]">
                                            {getActiveFiltersCount()}
                                        </span>
                                    )}
                                </button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[85%] sm:w-[540px] border-l-0 bg-slate-50 p-0 [&>button]:text-white [&>button]:opacity-100">
                                <div className="bg-[#0a1e60] p-6 pt-10">
                                    <SheetHeader className="text-left">
                                        <SheetTitle className="text-white text-xl font-bold">Filter Attendance</SheetTitle>
                                    </SheetHeader>
                                </div>

                                <div className="p-6 space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Select Month ({new Date().getFullYear()})</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {months.map((month, index) => (
                                                <button
                                                    key={month}
                                                    onClick={() => setSelectedMonth(index)}
                                                    className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${selectedMonth === index
                                                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-100'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-200'
                                                        }`}
                                                >
                                                    {month}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Status</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['All', 'Pending', 'Approved', 'Rejected'].map((status) => (
                                                <button
                                                    key={status}
                                                    onClick={() => setStatusFilter(status as any)}
                                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${statusFilter === status
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                                                        : 'bg-white text-slate-600 border-slate-200'
                                                        }`}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Type Filter</label>
                                        <div className="flex gap-2">
                                            {['All', 'In Time', 'Out Time'].map((type) => (
                                                <button
                                                    key={type}
                                                    onClick={() => setTypeFilter(type as any)}
                                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-1 border ${typeFilter === type
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                                                        : 'bg-white text-slate-600 border-slate-200'
                                                        }`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-4 mt-auto">
                                        <button
                                            onClick={() => {
                                                setStatusFilter('Pending');
                                                setTypeFilter('All');
                                                setSelectedMonth(currentMonthIndex);
                                            }}
                                            className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors text-sm"
                                        >
                                            Reset to Defaults
                                        </button>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
            <div ref={containerRef} className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto overscroll-contain flex flex-col pt-6 pb-[120px] relative z-10">

                <div className="flex-1 px-6 pb-4 space-y-4">
                    {(loading && records.length === 0) ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="bg-white p-4 rounded-2xl shadow-md animate-pulse">
                                <div className="pl-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="h-4 w-12 bg-slate-200 rounded"></div>
                                        <div className="h-4 w-16 bg-slate-200 rounded"></div>
                                        <div className="h-4 w-12 bg-slate-200 rounded"></div>
                                    </div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                                        <div className="space-y-2">
                                            <div className="h-4 w-32 bg-slate-200 rounded"></div>
                                            <div className="h-3 w-24 bg-slate-200 rounded"></div>
                                        </div>
                                    </div>
                                    <div className="h-px bg-slate-100 my-3"></div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-5 h-5 bg-slate-200 rounded-full flex-shrink-0"></div>
                                        <div className="h-3 bg-slate-200 rounded flex-1"></div>
                                        <div className="w-8 h-8 bg-slate-200 rounded-lg flex-shrink-0"></div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : records.length > 0 ? (
                        records.slice(0, visibleCount).map((record) => (
                            <div
                                key={record.id}
                                onClick={() => handleCardClick(record)}
                                className="bg-white p-4 rounded-2xl shadow-md relative cursor-pointer active:scale-[0.98] transition-transform"
                            >
                                <div className={`absolute left-0 top-6 bottom-6 w-1 rounded-r-full ${record.status === 'Approved' ? 'bg-emerald-500' :
                                    record.status === 'Rejected' ? 'bg-red-500' : 'bg-blue-500'
                                    }`}></div>

                                <div className="pl-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                            {record.employeeCode || 'N/A'}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(record.status)}`}>
                                            {record.status || 'Pending'}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${record.type === 'In Time' ? 'text-blue-600 bg-blue-50' : 'text-emerald-600 bg-emerald-50'
                                            }`}>
                                            {record.type}
                                        </span>
                                        {record.source === 'daily' && (
                                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                                GEOFENCE
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3 mb-3">
                                        <Avatar className="w-10 h-10 border border-slate-100">
                                            <AvatarImage src={getEmployeePhoto(record.employeeId) || record.imageURL} />
                                            <AvatarFallback className="text-xs bg-slate-200">
                                                {record.employeeName?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800 leading-tight">{record.employeeName}</h3>
                                            <div className="text-xs font-bold text-indigo-600 mt-0.5">
                                                {record.displayTime
                                                    ? `${format(new Date(record.timestamp), 'dd-MM-yyyy')} • ${record.displayTime}`
                                                    : format(new Date(record.timestamp), 'dd-MM-yyyy • hh:mm a')
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-100 my-3"></div>

                                    <div className="flex items-start gap-3">
                                        <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs font-semibold text-slate-600 flex-1 leading-relaxed line-clamp-2">
                                            {record.location?.address || `${record.location.latitude}, ${record.location.longitude}`}
                                        </p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/mobile/attendance/remote-approval/details?id=${record.id}`);
                                            }}
                                            className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors shadow-[0_4px_12px_rgba(37,99,235,0.2)] border border-blue-100"
                                        >
                                            <MapIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 text-slate-400">
                            No remote attendance records found.
                        </div>
                    )}
                </div>

                {/* Load More Button */}
                {!loading && records.length > visibleCount && (
                    <div className="px-6 pb-2">
                        <Button
                            onClick={() => setVisibleCount(prev => prev + 50)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                        >
                            Load More Records
                        </Button>
                    </div>
                )}

                {/* Bottom Spacing to avoid overlapping with fixed BottomNavBar */}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="w-[90%] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Verify Remote Attendance</DialogTitle>
                        <DialogDescription>
                            Review the request details below.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRecord && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl">
                                <Avatar className="w-12 h-12">
                                    <AvatarImage src={getEmployeePhoto(selectedRecord.employeeId) || selectedRecord.imageURL} />
                                    <AvatarFallback>{selectedRecord.employeeName.substring(0, 2)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="font-bold text-slate-800">{selectedRecord.employeeName}</div>
                                    <div className="text-xs text-slate-500">
                                        {selectedRecord.employeeCode} • {selectedRecord.type}
                                    </div>
                                    <div className="text-[10px] text-indigo-600 font-bold mt-0.5">
                                        {selectedRecord.displayTime
                                            ? `${format(new Date(selectedRecord.timestamp), 'dd MMM')}, ${selectedRecord.displayTime}`
                                            : format(new Date(selectedRecord.timestamp), 'dd MMM, hh:mm a')
                                        }
                                    </div>
                                </div>
                            </div>

                            <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="flex gap-2">
                                    <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <span>{selectedRecord.location?.address}</span>
                                </div>
                            </div>

                            {selectedRecord.imageURL && (
                                <div className="rounded-xl overflow-hidden h-32 w-full bg-slate-100">
                                    <img src={selectedRecord.imageURL} alt="Proof" className="w-full h-full object-cover" />
                                </div>
                            )}

                            <DialogFooter className="flex-row gap-2 mt-4">
                                <Button
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => handleAction('Approved')}
                                    disabled={!!processingId}
                                >
                                    {processingId === selectedRecord.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                                    Approve
                                </Button>
                                <Button
                                    className="flex-1"
                                    variant="destructive"
                                    onClick={() => handleAction('Rejected')}
                                    disabled={!!processingId}
                                >
                                    {processingId === selectedRecord.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                                    Reject
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}
