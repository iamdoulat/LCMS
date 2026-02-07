"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, orderBy, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO } from 'date-fns';
import { MobileFilterSheet, hasActiveFilters, type FilterState } from '@/components/mobile/MobileFilterSheet';
import { DateRange } from 'react-day-picker';
import { startOfDay, endOfDay } from 'date-fns';
import {
    ArrowLeft,
    Plus,
    Calendar,
    Clock,
    Info,
    Loader2,
    ChevronRight,
    MapPin,
    CheckCircle2,
    Timer,
    Users,
    MessageSquare,
    Filter as FilterIcon,
    X
} from 'lucide-react';
import { MobileVisitForm } from '@/components/mobile/MobileVisitForm';
import { cn } from '@/lib/utils';
import type { VisitApplicationDocument } from '@/types';
import Swal from 'sweetalert2';

// Helper function to check if application is within 8-hour cancellation window
// Note: Visit applications might use 'createdAt' or 'applyDate' depending on implementation
// Based on file content, it seems applyDate is a string (ISO) and there might be a createdAt timestamp
const isWithinCancellationWindow = (createdAt: Timestamp | undefined, windowHours: number): boolean => {
    if (!createdAt) return false;
    if (windowHours === 0) return true; // No restriction
    const now = new Date();
    const applicationTime = createdAt.toDate();
    const elapsedMs = now.getTime() - applicationTime.getTime();
    const windowInMs = windowHours * 60 * 60 * 1000;
    return elapsedMs < windowInMs;
};

// Countdown Timer Component
const CountdownTimer: React.FC<{ createdAt: Timestamp | undefined, windowHours: number }> = ({ createdAt, windowHours }) => {
    const [timeRemaining, setTimeRemaining] = useState<string>('00:00:00');
    const [colorClass, setColorClass] = useState<string>('text-green-600');

    useEffect(() => {
        if (!createdAt || windowHours === 0) return;

        const updateTimer = () => {
            const now = new Date();
            const applicationTime = createdAt.toDate();
            const elapsedMs = now.getTime() - applicationTime.getTime();
            const windowInMs = windowHours * 60 * 60 * 1000;
            const remainingMs = Math.max(0, windowInMs - elapsedMs);

            const hours = Math.floor(remainingMs / (60 * 60 * 1000));
            const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);

            const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            setTimeRemaining(formatted);

            // Update color based on remaining time
            if (remainingMs === 0) {
                setColorClass('text-slate-400');
            } else if (hours < 1) {
                setColorClass('text-red-600');
            } else if (hours < (windowHours / 2)) {
                setColorClass('text-amber-600');
            } else {
                setColorClass('text-green-600');
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [createdAt, windowHours]);

    if (windowHours === 0) return null;

    return (
        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
            <Timer className={cn("h-3.5 w-3.5", colorClass)} />
            <span className={cn("text-[10px] font-bold font-mono", colorClass)}>
                {timeRemaining}
            </span>
        </div>
    );
};

export default function MobileVisitApplicationsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [visits, setVisits] = useState<VisitApplicationDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Filter State
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState<FilterState>({});
    const [cancellationWindowHours, setCancellationWindowHours] = useState<number>(8); // Default 8

    useEffect(() => {
        const unsub = onSnapshot(doc(firestore, 'hrm_settings', 'leave_cancellation'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.cancellationWindowHours !== undefined) {
                    setCancellationWindowHours(data.cancellationWindowHours);
                }
            }
        });
        return () => unsub();
    }, []);

    const handleDeleteApplication = async (appId: string) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "Do you want to cancel this visit application?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, cancel it!',
            cancelButtonText: 'No, keep it',
            reverseButtons: true,
            customClass: {
                popup: 'rounded-3xl',
                confirmButton: 'rounded-xl',
                cancelButton: 'rounded-xl'
            }
        });

        if (result.isConfirmed) {
            try {
                setLoading(true);
                await deleteDoc(doc(firestore, 'visit_applications', appId));

                // Update local state
                setVisits(prev => prev.filter(app => app.id !== appId));

                Swal.fire({
                    title: 'Cancelled!',
                    text: 'Your visit application has been removed.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                    customClass: { popup: 'rounded-3xl' }
                });
            } catch (error) {
                console.error("Error cancelling visit:", error);
                Swal.fire({
                    title: 'Error',
                    text: 'Failed to cancel the application. Please try again.',
                    icon: 'error',
                    confirmButtonColor: '#3b82f6',
                    customClass: { popup: 'rounded-3xl' }
                });
            } finally {
                setLoading(false);
            }
        }
    };


    // Filter Logic
    const filteredVisits = React.useMemo(() => {
        return visits.filter(visit => {
            // Status Filter
            if (filters.status && filters.status !== 'All') {
                if (Array.isArray(filters.status)) {
                    if (!filters.status.includes(visit.status)) return false;
                } else {
                    if (visit.status !== filters.status) return false;
                }
            }

            // Date Range Filter
            if (filters.dateRange?.from) {
                const visitDate = visit.fromDate ? parseISO(visit.fromDate) : null;
                if (!visitDate) return false;

                if (visitDate < startOfDay(filters.dateRange.from)) return false;
                if (filters.dateRange.to && visitDate > endOfDay(filters.dateRange.to)) return false;
            }

            return true;
        });
    }, [visits, filters]);

    const fetchData = async () => {
        if (!user?.email) return;
        setLoading(true);
        try {
            // 1. Resolve Employee ID by email
            const empQuery = query(collection(firestore, 'employees'), where('email', '==', user.email));
            const empSnap = await getDocs(empQuery);

            const ids = [user.uid];
            if (!empSnap.empty) {
                const empId = empSnap.docs[0].id;
                if (empId !== user.uid) {
                    ids.push(empId);
                }
            }

            // 2. Fetch Visit Applications for resolved ID(s)
            const q = query(
                collection(firestore, 'visit_applications'),
                where('employeeId', 'in', ids)
            );

            const snapshot = await getDocs(q);
            const updatedVisits = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...(doc.data() as any)
                } as VisitApplicationDocument))
                .sort((a, b) => {
                    const dateA = a.applyDate ? new Date(a.applyDate).getTime() : 0;
                    const dateB = b.applyDate ? new Date(b.applyDate).getTime() : 0;
                    return dateB - dateA;
                });

            setVisits(updatedVisits);
        } catch (err) {
            console.error("Error fetching data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user?.email) {
            setLoading(false);
            return;
        }

        let unsubscribe = () => { };

        const setupListener = async () => {
            try {
                const empQuery = query(collection(firestore, 'employees'), where('email', '==', user.email));
                const empSnap = await getDocs(empQuery);
                const ids = [user.uid];
                if (!empSnap.empty) {
                    const empId = empSnap.docs[0].id;
                    if (empId !== user.uid) ids.push(empId);
                }

                const q = query(
                    collection(firestore, 'visit_applications'),
                    where('employeeId', 'in', ids)
                );

                unsubscribe = onSnapshot(q, (snapshot) => {
                    const updatedVisits = snapshot.docs
                        .map(doc => ({
                            id: doc.id,
                            ...(doc.data() as any)
                        } as VisitApplicationDocument))
                        .sort((a, b) => {
                            const dateA = a.applyDate ? new Date(a.applyDate).getTime() : 0;
                            const dateB = b.applyDate ? new Date(b.applyDate).getTime() : 0;
                            return dateB - dateA;
                        });
                    setVisits(updatedVisits);
                    setLoading(false);
                }, (error) => {
                    console.error("Error listening to visit applications:", error);
                    setLoading(false);
                });
            } catch (err) {
                console.error("Error setting up listener:", err);
                setLoading(false);
            }
        };

        setupListener();
        return () => unsubscribe();
    }, [user]);

    if (loading) {
        return (
            <div className="flex flex-col h-screen bg-[#0a1e60] items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin mb-4" />
                <p className="text-white font-medium">Loading visits...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden relative">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-1 pb-6">
                    <div className="flex items-center">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white ml-2">Visit Applications</h1>
                    </div>
                    <button
                        onClick={() => setIsFilterOpen(true)}
                        className={cn(
                            "p-2 rounded-full transition-all relative shadow-[0_4px_12px_rgba(37,99,235,0.2)] bg-white/10",
                            hasActiveFilters(filters) ? "text-white" : "text-white/70 hover:text-white"
                        )}
                    >
                        <FilterIcon className="h-5 w-5" />
                        {hasActiveFilters(filters) && (
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 border-2 border-[#0a1e60]"></span>
                        )}
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain relative">
                <div className="px-6 pt-8 pb-32 space-y-4">
                    {filteredVisits.length > 0 ? (
                        filteredVisits.map((visit) => {
                            const isApproved = visit.status === 'Approved';
                            const isPending = visit.status === 'Pending';
                            const isRejected = visit.status === 'Rejected';

                            return (
                                <div key={visit.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex gap-4 animate-in fade-in slide-in-from-bottom-2 relative">
                                    {/* Left Border Accent */}
                                    <div className={cn(
                                        "w-1.5 rounded-full my-1",
                                        isApproved ? "bg-emerald-400" : isPending ? "bg-amber-400" : "bg-red-400"
                                    )} />

                                    {/* Cancellation Button */}
                                    {isPending && isWithinCancellationWindow(visit.createdAt, cancellationWindowHours) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteApplication(visit.id);
                                            }}
                                            className="absolute top-2 right-2 h-8 w-8 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center hover:bg-rose-100 active:bg-rose-200 transition-colors z-10"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}

                                    <div className="flex-1 space-y-4">
                                        {/* Status Badge */}
                                        <div className={cn(
                                            "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                            isApproved ? "text-emerald-600 bg-emerald-50 border-emerald-100" :
                                                isPending ? "text-amber-600 bg-amber-50 border-amber-100" :
                                                    "text-red-600 bg-red-50 border-red-100"
                                        )}>
                                            {visit.status}
                                        </div>

                                        {/* Purpose */}
                                        <h3 className="text-sm font-bold text-slate-800 leading-tight pr-6">
                                            {visit.remarks}
                                        </h3>

                                        {/* Dates */}
                                        <div className="space-y-1">
                                            <div className="flex items-center text-[11px] text-blue-600 font-medium">
                                                {format(parseISO(visit.fromDate), 'EEE, dd-MM-yyyy hh:mm a')} - {format(parseISO(visit.toDate), 'EEE, dd-MM-yyyy hh:mm a')}
                                                <span className="ml-2 text-slate-400">• {visit.day} (Days)</span>
                                            </div>
                                        </div>

                                        {/* Customer & Location */}
                                        <div className="grid grid-cols-1 gap-2 pt-1">
                                            {visit.customerName && visit.customerName !== 'N/A' && (
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="text-[11px] text-slate-600 font-medium">
                                                        <span className="text-slate-400 mr-1">Customer:</span> {visit.customerName}
                                                    </span>
                                                </div>
                                            )}
                                            {visit.location && visit.location !== 'N/A' && (
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="text-[11px] text-slate-600 font-medium">
                                                        <span className="text-slate-400 mr-1">Address:</span> {visit.location}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Approver Comment */}
                                        {visit.approverComment && (
                                            <div className="mt-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2">
                                                <MessageSquare className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Approver Comment</span>
                                                    <p className="text-[11px] text-slate-600 leading-tight mt-0.5">{visit.approverComment}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Applied Date Footer */}
                                        <div className="flex items-center gap-2 pt-2 flex-wrap">
                                            <div className="bg-slate-50 px-3 py-1.5 rounded-xl flex items-center gap-2 border border-slate-100">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="text-[10px] text-slate-500 font-bold">
                                                    {format(parseISO(visit.applyDate), 'dd-MM-yyyy hh:mm a')}
                                                </span>
                                            </div>
                                            {isPending && (
                                                <CountdownTimer createdAt={visit.createdAt} windowHours={cancellationWindowHours} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );

                        })
                    ) : (
                        <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
                            <MapPin className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-400 font-medium">No visit applications found</p>
                            <p className="text-slate-300 text-xs mt-1">Tap the + button to apply</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Action Button */}
            <button
                onClick={() => setIsFormOpen(true)}
                className="absolute bottom-24 right-6 h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-200 active:scale-90 transition-transform z-50 border-4 border-white"
            >
                <Plus className="h-8 w-8" />
            </button>

            {/* Filter Sheet */}
            <MobileFilterSheet
                open={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                onApply={setFilters}
                onReset={() => setFilters({})}
                showDateRange
                showStatus
                statusOptions={['Pending', 'Approved', 'Rejected']}
                currentFilters={filters}
            />

            {/* Application Form Modal */}
            <MobileVisitForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={() => { }}
            />
        </div>
    );
}
