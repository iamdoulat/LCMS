"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Plus, Calendar as CalendarIcon, Info, Filter as FilterIcon, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, parseISO, differenceInCalendarDays, startOfDay, endOfDay } from 'date-fns';
import Swal from 'sweetalert2';
import type { LeaveApplicationDocument, EmployeeDocument } from '@/types';
import { cn } from '@/lib/utils';
import { MobileFilterSheet, hasActiveFilters, type FilterState } from '@/components/mobile/MobileFilterSheet';
import { DateRange } from 'react-day-picker';

export default function MyLeaveApplicationsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [applications, setApplications] = useState<LeaveApplicationDocument[]>([]);
    const [employeeData, setEmployeeData] = useState<EmployeeDocument | null>(null);
    const [selectedApp, setSelectedApp] = useState<LeaveApplicationDocument | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Filter State
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState<FilterState>({});

    useEffect(() => {
        const fetchEmployeeData = async () => {
            if (!user?.email) return;
            try {
                const q = query(collection(firestore, 'employees'), where('email', '==', user.email));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const empDoc = snapshot.docs[0];
                    setEmployeeData({ id: empDoc.id, ...empDoc.data() } as EmployeeDocument);
                }
            } catch (error) {
                console.error("Error fetching employee data:", error);
            }
        };
        fetchEmployeeData();
    }, [user?.email]);

    useEffect(() => {
        const fetchApplications = async () => {
            if (!employeeData?.id) return;

            setLoading(true);
            try {
                const q = query(
                    collection(firestore, 'leave_applications'),
                    where('employeeId', '==', employeeData.id)
                );
                const snapshot = await getDocs(q);
                const apps = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as LeaveApplicationDocument[];

                // Sort by createdAt descending
                const sortedApps = apps.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
                    const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
                    return dateB - dateA;
                });

                setApplications(sortedApps);
            } catch (error) {
                console.error("Error fetching applications:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchApplications();
    }, [employeeData?.id]);

    const calculateDays = (from: string, to: string) => {
        try {
            const start = parseISO(from);
            const end = parseISO(to);
            return differenceInCalendarDays(end, start) + 1;
        } catch {
            return 0;
        }
    };

    const formatDateRange = (from: string, to: string) => {
        try {
            const start = parseISO(from);
            const end = parseISO(to);
            return `${format(start, 'EEE, dd-MM-yyyy')} - ${format(end, 'EEE, dd-MM-yyyy')}`;
        } catch {
            return 'Invalid date';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved':
                return 'bg-emerald-100 text-emerald-700';
            case 'Rejected':
                return 'bg-rose-100 text-rose-700';
            case 'Pending':
            default:
                return 'bg-amber-100 text-amber-700';
        }
    };

    const getBorderColor = (status: string) => {
        switch (status) {
            case 'Approved':
                return 'border-l-emerald-500';
            case 'Rejected':
                return 'border-l-rose-500';
            case 'Pending':
            default:
                return 'border-l-amber-500';
        }
    };

    const handleDeleteApplication = async (appId: string, event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent opening the modal

        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "Do you want to cancel this leave application?",
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
                await deleteDoc(doc(firestore, 'leave_applications', appId));

                // Update local state
                setApplications(prev => prev.filter(app => app.id !== appId));

                Swal.fire({
                    title: 'Cancelled!',
                    text: 'Your leave application has been removed.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                    customClass: { popup: 'rounded-3xl' }
                });
            } catch (error) {
                console.error("Error cancelling leave:", error);
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
    const filteredApplications = React.useMemo(() => {
        return applications.filter(app => {
            // Status Filter
            if (filters.status && filters.status !== 'All') {
                // Handle array or string status
                if (Array.isArray(filters.status)) {
                    if (!filters.status.includes(app.status)) return false;
                } else {
                    if (app.status !== filters.status) return false;
                }
            }

            // Date Range Filter
            if (filters.dateRange?.from) {
                const appDate = app.fromDate ? parseISO(app.fromDate) : null;
                if (!appDate) return false;

                if (appDate < startOfDay(filters.dateRange.from)) return false;
                if (filters.dateRange.to && appDate > endOfDay(filters.dateRange.to)) return false;
            }

            return true;
        });
    }, [applications, filters]);

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-1 pb-6">
                    <div className="flex items-center">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white ml-2">My Leave Applications</h1>
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

            {/* Applications List */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain relative px-5 pt-8 space-y-4 pb-[120px]">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="p-4 border-none shadow-md animate-pulse">
                            <div className="space-y-3">
                                <div className="h-5 w-20 bg-slate-200 rounded" />
                                <div className="h-4 w-full bg-slate-200 rounded" />
                                <div className="h-3 w-3/4 bg-slate-100 rounded" />
                                <div className="flex gap-2">
                                    <div className="h-6 w-24 bg-slate-100 rounded" />
                                    <div className="h-6 w-24 bg-slate-100 rounded" />
                                </div>
                            </div>
                        </Card>
                    ))
                ) : filteredApplications.length > 0 ? (
                    filteredApplications.map(app => (
                        <Card
                            key={app.id}
                            className={cn(
                                "overflow-hidden border-none shadow-md relative active:scale-95 transition-all cursor-pointer border-l-4",
                                getBorderColor(app.status)
                            )}
                            onClick={() => {
                                setSelectedApp(app);
                                setIsModalOpen(true);
                            }}
                        >
                            <div className="p-4 relative">
                                {app.status === 'Pending' && (
                                    <button
                                        onClick={(e) => handleDeleteApplication(app.id, e)}
                                        className="absolute top-4 right-4 h-6 w-6 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center hover:bg-rose-100 active:bg-rose-200 transition-colors z-10"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}

                                <Badge className={cn("text-xs font-bold uppercase mb-2", getStatusColor(app.status))}>
                                    {app.status}
                                </Badge>

                                <h3 className="font-bold text-[#0a1e60] mb-1 line-clamp-2 pr-6">
                                    {app.reason}
                                </h3>

                                <p className="text-xs text-slate-500 mb-3">
                                    {formatDateRange(app.fromDate, app.toDate)} • {calculateDays(app.fromDate, app.toDate)} (Days)
                                </p>

                                <div className="flex gap-2">
                                    <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                        <CalendarIcon className="h-3.5 w-3.5 text-blue-600" />
                                        <span className="text-[10px] font-bold text-slate-600">
                                            {app.createdAt ? format(app.createdAt.toDate(), 'dd-MM-yyyy') : '--'}
                                        </span>
                                    </div>
                                    <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 text-[10px] font-bold">
                                        {app.leaveType}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <Info className="h-10 w-10 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-medium">No applications found</p>
                    </div>
                )}

            </div>

            {/* Floating Action Button */}
            <button
                onClick={() => router.push('/mobile/leave/apply')}
                className="fixed bottom-28 right-6 h-14 w-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all z-50"
            >
                <Plus className="h-6 w-6" />
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

            {/* Quick View Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="p-0 border-none bg-white max-w-[90vw] rounded-[2rem] overflow-hidden">
                    {selectedApp && (
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <Badge className={cn("text-xs font-bold uppercase", getStatusColor(selectedApp.status))}>
                                    {selectedApp.status}
                                </Badge>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-3 mb-6">
                                <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50 text-center">
                                    <p className="text-[10px] text-slate-500 font-medium mb-1">From</p>
                                    <p className="text-xs font-bold text-[#0a1e60]">
                                        {format(parseISO(selectedApp.fromDate), 'EEE, d MMM')}
                                    </p>
                                </div>
                                <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/50 text-center">
                                    <p className="text-[10px] text-slate-500 font-medium mb-1">To</p>
                                    <p className="text-xs font-bold text-[#0a1e60]">
                                        {format(parseISO(selectedApp.toDate), 'EEE, d MMM')}
                                    </p>
                                </div>
                                <div className="bg-purple-50/50 p-3 rounded-2xl border border-purple-100/50 text-center">
                                    <p className="text-[10px] text-slate-500 font-medium mb-1">Leave Taken</p>
                                    <p className="text-xs font-bold text-[#0a1e60]">
                                        {calculateDays(selectedApp.fromDate, selectedApp.toDate)} Days
                                    </p>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h4 className="text-[10px] font-bold text-blue-600 uppercase mb-2">Remarks</h4>
                                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 italic">
                                    "{selectedApp.reason}"
                                </p>
                            </div>

                            <div className="mb-4">
                                <h4 className="text-[10px] font-bold text-blue-600 uppercase mb-3">Approver History</h4>
                                <div className="flex items-center gap-3">
                                    <div className="h-3 w-3 rounded-full bg-slate-200 border-2 border-white shadow-sm" />
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="bg-slate-100 text-slate-400 text-[10px]">
                                            {selectedApp.status === 'Approved' ? 'A' : 'P'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-[#0a1e60]">
                                                {selectedApp.status === 'Approved' ? 'Admin' : 'Pending Review'}
                                            </span>
                                            <Badge
                                                variant="secondary"
                                                className={cn(
                                                    "text-[8px] h-4 py-0 px-1.5 font-bold uppercase",
                                                    selectedApp.status === 'Approved'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                )}
                                            >
                                                {selectedApp.status}
                                            </Badge>
                                        </div>
                                        <p className="text-[9px] text-slate-400">
                                            {selectedApp.status === 'Approved'
                                                ? 'Application approved'
                                                : 'Your supervisor decision is required'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-slate-400 justify-center pt-4 border-t">
                                <CalendarIcon className="h-3 w-3" />
                                Applied on {selectedApp.createdAt ? format(selectedApp.createdAt.toDate(), 'dd-MM-yyyy') : '--'}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
