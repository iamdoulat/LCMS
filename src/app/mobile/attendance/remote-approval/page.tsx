"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ChevronLeft, MapPin, ArrowRight, Loader2, Calendar, Check, X, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MultipleCheckInOutRecord } from '@/types/checkInOut';
import { Button } from '@/components/ui/button';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { updateCheckInOutStatus } from '@/lib/firebase/checkInOut';
import Swal from 'sweetalert2';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

interface UnifiedApprovalRecord extends MultipleCheckInOutRecord {
    source: 'multiple' | 'daily';
    employeeCode?: string;
}

export default function RemoteAttendanceApprovalPage() {
    const { user, userRole } = useAuth();
    const { isSupervisor, supervisedEmployees, currentEmployeeId } = useSupervisorCheck(user?.email);
    const router = useRouter();

    const [records, setRecords] = useState<UnifiedApprovalRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDays, setFilterDays] = useState<30 | 90>(30);

    const [selectedRecord, setSelectedRecord] = useState<UnifiedApprovalRecord | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchRemoteAttendance = async () => {
        if (!user || !isSupervisor || supervisedEmployees.length === 0) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const endDate = new Date();
            const startDate = subDays(endDate, filterDays);
            const fetchedRecords: UnifiedApprovalRecord[] = [];

            // Check if user has an administrative role
            const privilegedRoles = ["Super Admin", "Admin", "HR", "Service", "DemoManager", "Accounts", "Commercial", "Viewer"];
            const isAdmin = userRole?.some((role: string) => privilegedRoles.includes(role));

            const processDaily = (snap: any) => {
                snap.forEach((doc: any) => {
                    const data = doc.data();
                    const emp = supervisedEmployees.find(e => e.id === data.employeeId || e.uid === data.employeeId);

                    // Map daily attendance records - Show if it was a remote attendance
                    // Remote if: Pending OR (Approved/Rejected AND was outside geofence)
                    const isInTimeRemote = data.inTimeApprovalStatus || (!data.inTimeApprovalStatus && data.approvalStatus && data.isInsideGeofence === false);
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
                            status: data.inTimeApprovalStatus || data.approvalStatus,
                            imageURL: '',
                            source: 'daily',
                            createdAt: data.createdAt,
                            updatedAt: data.updatedAt,
                            companyName: 'Office'
                        } as UnifiedApprovalRecord);
                    }

                    const isOutTimeRemote = data.outTimeApprovalStatus || (data.outTime && data.outTimeIsInsideGeofence === false);
                    if (isOutTimeRemote) {
                        fetchedRecords.push({
                            id: doc.id + '_out',
                            employeeId: data.employeeId || data.uid,
                            employeeName: data.employeeName || emp?.fullName || 'Unknown',
                            employeeCode: emp?.employeeCode || 'N/A',
                            type: 'Out Time',
                            timestamp: data.date,
                            location: {
                                latitude: data.outTimeLocation?.latitude || 0,
                                longitude: data.outTimeLocation?.longitude || 0,
                                address: data.outTimeAddress || 'Unknown'
                            },
                            remarks: data.outTimeRemarks || '',
                            status: data.outTimeApprovalStatus || 'Approved', // Fallback for legacy
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

            if (isAdmin) {
                // Fetch daily attendance records - Last 30 days
                const q = query(
                    collection(firestore, 'attendance'),
                    where('date', '>=', startDate.toISOString()),
                    orderBy('date', 'desc')
                );

                const snap = await getDocs(q);
                processDaily(snap);
            } else {
                const employeeIds = supervisedEmployees.map(e => e.id);
                const employeeUids = supervisedEmployees.map(e => e.uid).filter(Boolean) as string[];
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
                        // Fetch separate queries to avoid composite index requirements
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

                        const qPendingIn = query(
                            collection(firestore, 'attendance'),
                            where('employeeId', 'in', chunk),
                            where('approvalStatus', '==', 'Pending')
                        );

                        const qPendingOut = query(
                            collection(firestore, 'attendance'),
                            where('employeeId', 'in', chunk),
                            where('outTimeApprovalStatus', '==', 'Pending')
                        );

                        const [snapRemoteIn, snapRemoteOut, snapPendingIn, snapPendingOut] = await Promise.all([
                            getDocs(qRemoteIn),
                            getDocs(qRemoteOut),
                            getDocs(qPendingIn),
                            getDocs(qPendingOut)
                        ]);

                        const uniqueDocs = new Map();
                        snapRemoteIn.forEach(doc => uniqueDocs.set(doc.id, doc));
                        snapRemoteOut.forEach(doc => uniqueDocs.set(doc.id, doc));
                        snapPendingIn.forEach(doc => uniqueDocs.set(doc.id, doc));
                        snapPendingOut.forEach(doc => uniqueDocs.set(doc.id, doc));

                        processDaily(Array.from(uniqueDocs.values()));
                    } catch (err) {
                        console.error("Error fetching attendance for chunk:", err);
                    }
                }
            }

            // Filter by date range and sort
            const filteredRecords = fetchedRecords.filter(r => new Date(r.timestamp) >= startDate);
            filteredRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setRecords(filteredRecords);

        } catch (error) {
            console.error("Error fetching remote attendance:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRemoteAttendance();
    }, [user, isSupervisor, supervisedEmployees, filterDays]);

    const containerRef = usePullToRefresh(fetchRemoteAttendance);


    const handleToggleFilter = () => {
        setFilterDays(prev => prev === 30 ? 90 : 30);
    };

    const handleCardClick = (record: UnifiedApprovalRecord) => {
        if (record.status === 'Pending' || !record.status) {
            setSelectedRecord(record);
            setIsDialogOpen(true);
        } else {
            router.push(`/mobile/attendance/remote-approval/details?id=${record.id}`);
        }
    };

    const handleAction = async (action: 'Approved' | 'Rejected') => {
        if (!selectedRecord || !currentEmployeeId) return;

        setProcessingId(selectedRecord.id);
        try {
            // Update Daily Attendance
            const { doc, updateDoc, serverTimestamp, getDoc } = await import('firebase/firestore');
            const realDocId = (selectedRecord as any).originalId || selectedRecord.id;
            const docRef = doc(firestore, 'attendance', realDocId);

            if (selectedRecord.type === 'In Time') {
                if (action === 'Approved') {
                    const snap = await getDoc(docRef);
                    const inTime = snap.data()?.inTime;
                    const { determineAttendanceFlag } = await import('@/lib/firebase/utils');
                    const flag = determineAttendanceFlag(inTime);

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
                    // If outTime is rejected, maybe we keep approvalStatus as Pending or set to 'Rejected'?
                    // Usually rejection of out-time doesn't negate the in-time, but for simplicity:
                    // updates.approvalStatus = 'Rejected'; 
                }

                await updateDoc(docRef, updates);
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
        } catch (error) {
            console.error("Error updating status:", error);
            Swal.fire("Error", "Failed to update status", "error");
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusColor = (status?: string) => {
        if (status === 'Approved') return 'bg-emerald-100 text-emerald-600';
        if (status === 'Rejected') return 'bg-red-100 text-red-600';
        return 'bg-blue-100 text-blue-600';
    };

    const getEmployeePhoto = (id: string) => {
        const emp = supervisedEmployees.find(e => e.id === id);
        return emp?.photoURL;
    }

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 pt-1 pb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2">Remote Att. Approval</h1>
                </div>
            </div>

            <div ref={containerRef} className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto overscroll-contain flex flex-col">
                <div className="p-6 pb-2">
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

                <div className="flex-1 px-6 pb-6 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
                        </div>
                    ) : records.length > 0 ? (
                        records.map((record) => (
                            <div
                                key={record.id}
                                onClick={() => handleCardClick(record)}
                                className="bg-white p-4 rounded-2xl shadow-sm relative cursor-pointer active:scale-[0.98] transition-transform"
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
                                                {format(new Date(record.timestamp), 'dd-MM-yyyy • hh:mm a')}
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
                                            className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                                        >
                                            <ArrowRight className="w-4 h-4" />
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
                                        {format(new Date(selectedRecord.timestamp), 'dd MMM, hh:mm a')}
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
        </div>
    );
}
