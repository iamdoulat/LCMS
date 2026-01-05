"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy,
    doc,
    updateDoc,
    serverTimestamp,
    getDocs,
    getDoc
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import {
    ArrowLeft,
    MoreHorizontal,
    Calendar,
    Clock,
    CheckCircle2,
    XCircle,
    User,
    ChevronRight,
    Search,
    Filter,
    Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid, differenceInCalendarDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileFilterSheet, hasActiveFilters, type FilterState } from '@/components/mobile/MobileFilterSheet';
import { DateRange } from 'react-day-picker';
import type {
    LeaveApplicationDocument,
    VisitApplicationDocument,
    EmployeeDocument
} from '@/types';

export default function ApproveApplicationsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { isSupervisor, supervisedEmployeeIds, currentEmployeeId } = useSupervisorCheck(user?.email);
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState<'leave' | 'visit'>('leave');
    const [loading, setLoading] = useState(true);
    const [leaveApps, setLeaveApps] = useState<LeaveApplicationDocument[]>([]);
    const [visitApps, setVisitApps] = useState<VisitApplicationDocument[]>([]);
    const [employeeMap, setEmployeeMap] = useState<Record<string, EmployeeDocument>>({});

    const [selectedLeave, setSelectedLeave] = useState<LeaveApplicationDocument | null>(null);
    const [selectedVisit, setSelectedVisit] = useState<VisitApplicationDocument | null>(null);
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);

    // Filter State - Default to All
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState<FilterState>({ status: 'All' });

    // Computed filtered lists (Date Range Logic)
    const filteredLeaveApps = React.useMemo(() => {
        return leaveApps.filter(app => {
            if (filters.dateRange?.from) {
                const appDate = app.fromDate ? parseISO(app.fromDate) : null;
                if (!appDate) return false;
                if (appDate < startOfDay(filters.dateRange.from)) return false;
                if (filters.dateRange.to && appDate > endOfDay(filters.dateRange.to)) return false;
            }
            return true;
        });
    }, [leaveApps, filters.dateRange]);

    const filteredVisitApps = React.useMemo(() => {
        return visitApps.filter(app => {
            if (filters.dateRange?.from) {
                const appDate = app.fromDate ? parseISO(app.fromDate) : null;
                if (!appDate) return false;
                if (appDate < startOfDay(filters.dateRange.from)) return false;
                if (filters.dateRange.to && appDate > endOfDay(filters.dateRange.to)) return false;
            }
            return true;
        });
    }, [visitApps, filters.dateRange]);

    // Fetch team applications
    useEffect(() => {
        if (!supervisedEmployeeIds.length) {
            if (!loading) setLoading(false);
            return;
        }

        setLoading(true);

        // Fetch Leave Applications
        let qLeave = collection(firestore, 'leave_applications') as any; // Cast for flexibility

        const targetStatus = filters.status || 'All';
        if (targetStatus !== 'All') {
            qLeave = query(qLeave, where('status', '==', targetStatus));
        }

        const unsubLeave = onSnapshot(qLeave, (snapshot: any) => {
            const apps = snapshot.docs
                .map((doc: any) => ({ id: doc.id, ...doc.data() } as LeaveApplicationDocument))
                .filter((app: LeaveApplicationDocument) => supervisedEmployeeIds.includes(app.employeeId));

            // Client-side sort
            const sortedApps = [...apps].sort((a, b) => {
                const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
                const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
                return dateB - dateA;
            });

            setLeaveApps(sortedApps);
            setLoading(false);
        }, (error: any) => {
            console.error("ApprovePage: Error fetching leave apps:", error);
            setLoading(false);
        });

        // Fetch Visit Applications
        let qVisit = collection(firestore, 'visit_applications') as any;

        if (targetStatus !== 'All') {
            qVisit = query(qVisit, where('status', '==', targetStatus));
        }

        const unsubVisit = onSnapshot(qVisit, (snapshot: any) => {
            const apps = snapshot.docs
                .map((doc: any) => ({ id: doc.id, ...doc.data() } as VisitApplicationDocument))
                .filter((app: VisitApplicationDocument) => supervisedEmployeeIds.includes(app.employeeId));

            // Client-side sort
            const sortedApps = [...apps].sort((a, b) => {
                const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
                const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
                return dateB - dateA;
            });

            setVisitApps(sortedApps);
        }, (error: any) => {
            console.error("ApprovePage: Error fetching visit apps:", error);
        });

        // Fetch Employee details for the team
        const fetchEmployees = async () => {
            const newMap: Record<string, EmployeeDocument> = {};
            const chunkSize = 10;
            for (let i = 0; i < supervisedEmployeeIds.length; i += chunkSize) {
                const chunk = supervisedEmployeeIds.slice(i, i + chunkSize);
                const qEmp = query(collection(firestore, 'employees'), where('__name__', 'in', chunk));
                const snap = await getDocs(qEmp);
                snap.docs.forEach(doc => {
                    newMap[doc.id] = { id: doc.id, ...doc.data() } as EmployeeDocument;
                });
            }
            setEmployeeMap(newMap);
        };

        fetchEmployees();

        return () => {
            unsubLeave();
            unsubVisit();
        };
    }, [supervisedEmployeeIds, filters.status]);

    const handleApproveLeave = async (appId: string) => {
        try {
            await updateDoc(doc(firestore, 'leave_applications', appId), {
                status: 'Approved',
                updatedAt: serverTimestamp(),
                approvedBy: currentEmployeeId
            });
            setIsLeaveModalOpen(false);
            toast({
                title: "Approved!",
                description: "Leave application has been approved successfully.",
                duration: 3000,
            });
        } catch (error) {
            console.error("Error approving leave:", error);
            Swal.fire({ title: 'Error', text: 'Failed to approve application', icon: 'error', timer: 3000, showConfirmButton: false });
        }
    };

    const handleRejectLeave = async (appId: string, reason?: string) => {
        try {
            await updateDoc(doc(firestore, 'leave_applications', appId), {
                status: 'Rejected',
                updatedAt: serverTimestamp(),
                approverComment: reason || 'No reason provided',
                rejectedBy: currentEmployeeId
            });
            setIsLeaveModalOpen(false);
            toast({
                title: "Rejected",
                description: "Leave application has been rejected.",
                duration: 3000,
            });
        } catch (error) {
            console.error("Error rejecting leave:", error);
            Swal.fire({ title: 'Error', text: 'Failed to reject application', icon: 'error', timer: 3000, showConfirmButton: false });
        }
    };

    const handleApproveVisit = async (appId: string) => {
        try {
            await updateDoc(doc(firestore, 'visit_applications', appId), {
                status: 'Approved',
                updatedAt: serverTimestamp(),
                approvedBy: currentEmployeeId
            });
            setIsVisitModalOpen(false);
            toast({
                title: "Approved!",
                description: "Visit application has been approved successfully.",
                duration: 3000,
            });
        } catch (error) {
            console.error("Error approving visit:", error);
            Swal.fire({ title: 'Error', text: 'Failed to approve application', icon: 'error', timer: 3000, showConfirmButton: false });
        }
    };

    const handleRejectVisit = async (appId: string, reason?: string) => {
        try {
            await updateDoc(doc(firestore, 'visit_applications', appId), {
                status: 'Rejected',
                updatedAt: serverTimestamp(),
                approverComment: reason || 'No reason provided',
                rejectedBy: currentEmployeeId
            });
            setIsVisitModalOpen(false);
            toast({
                title: "Rejected",
                description: "Visit application has been rejected.",
                duration: 3000,
            });
        } catch (error) {
            console.error("Error rejecting visit:", error);
            Swal.fire({ title: 'Error', text: 'Failed to reject application', icon: 'error', timer: 3000, showConfirmButton: false });
        }
    };

    const formatDateRange = (from: string, to: string) => {
        const start = parseISO(from);
        const end = parseISO(to);
        if (!isValid(start) || !isValid(end)) return 'Invalid Date';
        return `${format(start, 'EEE, d MMM')} - ${format(end, 'EEE, d MMM')}`;
    };

    const calculateDays = (from: string, to: string) => {
        const start = parseISO(from);
        const end = parseISO(to);
        if (!isValid(start) || !isValid(end)) return 0;
        return differenceInCalendarDays(end, start) + 1;
    };

    const ApplicationCard = ({ app, type }: { app: any, type: 'leave' | 'visit' }) => {
        const emp = employeeMap[app.employeeId];
        const title = type === 'leave' ? app.leaveType : app.customerName || 'Work Visit';

        return (
            <Card
                className="mb-4 overflow-hidden border-none shadow-md relative active:scale-95 transition-all"
                onClick={() => {
                    if (type === 'leave') {
                        setSelectedLeave(app);
                        setIsLeaveModalOpen(true);
                    } else {
                        setSelectedVisit(app);
                        setIsVisitModalOpen(true);
                    }
                }}
            >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" />
                <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-3">
                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                <AvatarImage src={emp?.photoURL} />
                                <AvatarFallback className="bg-blue-100 text-blue-600">
                                    {app.employeeName?.[0]}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h3 className="font-bold text-[#0a1e60] leading-tight">{app.employeeName}</h3>
                                <p className="text-[10px] text-slate-500">{emp?.designation || 'Specialist'}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <Badge
                                variant="secondary"
                                className={cn(
                                    "text-[9px] px-2 py-0 h-5 font-bold uppercase",
                                    app.status === 'Pending' && "bg-amber-100 text-amber-700",
                                    app.status === 'Approved' && "bg-green-100 text-green-700",
                                    app.status === 'Rejected' && "bg-red-100 text-red-700"
                                )}
                            >
                                {app.status || 'Pending'}
                            </Badge>
                            <button className="p-1 text-slate-400">
                                <MoreHorizontal className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <p className="text-sm text-slate-700 mb-3 line-clamp-2 italic">
                        "{app.reason || app.remarks}"
                    </p>

                    <div className="flex items-center gap-2 text-[#0a1e60] font-bold text-xs mb-3">
                        {formatDateRange(app.fromDate, app.toDate)}
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span className="text-slate-500 font-medium">{calculateDays(app.fromDate, app.toDate)}.0 (Days)</span>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <Calendar className="h-3.5 w-3.5 text-blue-600" />
                            <span className="text-[10px] font-bold text-slate-600">
                                {app.createdAt ? format(app.createdAt.toDate(), 'dd-MM-yyyy') : '--'}
                            </span>
                        </div>
                        {type === 'leave' && (
                            <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 text-[10px] font-bold">
                                {app.leaveType}
                            </div>
                        )}
                        {type === 'visit' && (
                            <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 text-[10px] font-bold">
                                {app.location || 'Site Visit'}
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        );
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

        if (isLeftSwipe && activeTab === 'leave') {
            setActiveTab('visit');
        }
        if (isRightSwipe && activeTab === 'visit') {
            setActiveTab('leave');
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-1 pb-6">
                    <div className="flex items-center">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-white bg-white/10 rounded-full transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)]"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white ml-2">Approve Applications</h1>
                    </div>
                    <button
                        onClick={() => setIsFilterOpen(true)}
                        className={cn(
                            "p-2 rounded-full transition-all relative shadow-[0_4px_12px_rgba(37,99,235,0.2)] bg-white/10",
                            /* Since default is Pending, only show active dot if DateRange is set or status is NOT Pending (i.e. user modified default) */
                            (filters.dateRange?.from || (filters.status && filters.status !== 'Pending')) ? "text-white" : "text-white/70 hover:text-white"
                        )}
                    >
                        <Filter className="h-5 w-5" />
                        {(filters.dateRange?.from || (filters.status && filters.status !== 'Pending')) && (
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 border-2 border-[#0a1e60]"></span>
                        )}
                    </button>
                </div>
            </div>

            <div
                className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain relative px-5 pt-8 pb-[120px]"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <Card className="p-1 px-3 rounded-full border-none shadow-lg mb-6 flex justify-between bg-white/95 backdrop-blur">
                    <button
                        onClick={() => setActiveTab('leave')}
                        className={cn(
                            "flex-1 py-3 text-sm font-bold transition-all relative rounded-full",
                            activeTab === 'leave' ? "text-blue-700" : "text-slate-400"
                        )}
                    >
                        {activeTab === 'leave' && (
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-amber-400" />
                        )}
                        Leave App.
                    </button>
                    <button
                        onClick={() => setActiveTab('visit')}
                        className={cn(
                            "flex-1 py-3 text-sm font-bold transition-all relative rounded-full",
                            activeTab === 'visit' ? "text-blue-700" : "text-slate-400"
                        )}
                    >
                        {activeTab === 'visit' && (
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-amber-400" />
                        )}
                        Visit App.
                    </button>
                </Card>

                {/* List Container */}
                <div className="space-y-4">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <Card key={i} className="p-4 border-none shadow-md animate-pulse">
                                <div className="flex gap-3 mb-4">
                                    <div className="h-12 w-12 rounded-full bg-slate-200" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 w-1/2 bg-slate-200 rounded" />
                                        <div className="h-3 w-1/3 bg-slate-100 rounded" />
                                    </div>
                                </div>
                                <div className="h-16 bg-slate-50 rounded-lg mb-4" />
                                <div className="flex gap-2">
                                    <div className="h-8 w-24 bg-slate-100 rounded-lg" />
                                    <div className="h-8 w-24 bg-slate-100 rounded-lg" />
                                </div>
                            </Card>
                        ))
                    ) : (activeTab === 'leave' ? filteredLeaveApps : filteredVisitApps).length > 0 ? (
                        (activeTab === 'leave' ? filteredLeaveApps : filteredVisitApps).map(app => (
                            <ApplicationCard key={app.id} app={app} type={activeTab} />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                            <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Info className="h-10 w-10 text-slate-300" />
                            </div>
                            <p className="text-slate-500 font-medium">No data to show</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Leave Detail Modal */}
            <Dialog open={isLeaveModalOpen} onOpenChange={setIsLeaveModalOpen}>
                <DialogContent className="p-0 border-none bg-white max-h-[85vh] max-w-[90vw] rounded-3xl overflow-y-auto">
                    <div className="p-6 pb-8">
                        <div className="flex justify-between items-start mb-6">
                            <Badge className="bg-amber-100 text-amber-700 font-bold uppercase text-[10px]">Pending</Badge>
                        </div>

                        <div className="flex gap-4 mb-6">
                            <Avatar className="h-16 w-16 border-4 border-slate-50 shadow-xl">
                                <AvatarImage src={employeeMap[selectedLeave?.employeeId || '']?.photoURL} />
                                <AvatarFallback className="bg-blue-100 text-blue-600 text-xl font-bold">
                                    {selectedLeave?.employeeName?.[0]}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h2 className="text-xl font-bold text-[#0a1e60]">{selectedLeave?.employeeName}</h2>
                                <p className="text-sm text-slate-500">{employeeMap[selectedLeave?.employeeId || '']?.designation || 'Specialist'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50 text-center">
                                <p className="text-[10px] text-slate-500 font-medium mb-1">From</p>
                                <p className="text-xs font-bold text-[#0a1e60]">
                                    {selectedLeave ? format(parseISO(selectedLeave.fromDate), 'EEE, d MMM') : '--'}
                                </p>
                            </div>
                            <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/50 text-center">
                                <p className="text-[10px] text-slate-500 font-medium mb-1">To</p>
                                <p className="text-xs font-bold text-[#0a1e60]">
                                    {selectedLeave ? format(parseISO(selectedLeave.toDate), 'EEE, d MMM') : '--'}
                                </p>
                            </div>
                            <div className="bg-purple-50/50 p-3 rounded-2xl border border-purple-100/50 text-center">
                                <p className="text-[10px] text-slate-500 font-medium mb-1">Leave Taken</p>
                                <p className="text-xs font-bold text-[#0a1e60]">
                                    {selectedLeave ? calculateDays(selectedLeave.fromDate, selectedLeave.toDate) : 0}.0 Days
                                </p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h4 className="text-[10px] font-bold text-blue-600 uppercase mb-2">Remarks</h4>
                            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 italic">
                                "{selectedLeave?.reason}"
                            </p>
                        </div>

                        <div className="mb-8">
                            <h4 className="text-[10px] font-bold text-blue-600 uppercase mb-3">Approver History</h4>
                            <div className="flex items-center gap-3">
                                <div className="h-3 w-3 rounded-full bg-slate-200 border-2 border-white shadow-sm" />
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-slate-100 text-slate-400 text-[10px]">H</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-[#0a1e60]">YOU</span>
                                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[8px] h-4 py-0 px-1.5 font-bold uppercase">
                                            Under Processing
                                        </Badge>
                                    </div>
                                    <p className="text-[9px] text-slate-400">Your direct supervisor decision is required</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <Button
                                className="flex-1 bg-rose-500 hover:bg-rose-600 py-6 rounded-2xl font-bold shadow-lg shadow-rose-200"
                                onClick={() => handleRejectLeave(selectedLeave?.id || '')}
                            >
                                <XCircle className="mr-2 h-5 w-5" /> Reject
                            </Button>
                            <Button
                                className="flex-1 bg-[#10b981] hover:bg-[#059669] py-6 rounded-2xl font-bold shadow-lg shadow-emerald-200"
                                onClick={() => handleApproveLeave(selectedLeave?.id || '')}
                            >
                                <CheckCircle2 className="mr-2 h-5 w-5" /> Approve
                            </Button>
                        </div>

                        <div className="mt-6 flex items-center gap-2 text-[10px] text-slate-400 justify-center">
                            <Calendar className="h-3 w-3" />
                            Applied on {selectedLeave?.createdAt ? format(selectedLeave.createdAt.toDate(), 'dd-MM-yyyy') : '--'}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Visit Detail Modal (similar to Leave) */}
            <Dialog open={isVisitModalOpen} onOpenChange={setIsVisitModalOpen}>
                <DialogContent className="p-0 border-none bg-white max-h-[85vh] max-w-[90vw] rounded-3xl overflow-y-auto">
                    <div className="p-6 pb-8">
                        <div className="flex justify-between items-start mb-6">
                            <Badge className="bg-amber-100 text-amber-700 font-bold uppercase text-[10px]">Pending</Badge>
                        </div>

                        <div className="flex gap-4 mb-6">
                            <Avatar className="h-16 w-16 border-4 border-slate-50 shadow-xl">
                                <AvatarImage src={employeeMap[selectedVisit?.employeeId || '']?.photoURL} />
                                <AvatarFallback className="bg-blue-100 text-blue-600 text-xl font-bold">
                                    {selectedVisit?.employeeName?.[0]}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h2 className="text-xl font-bold text-[#0a1e60]">{selectedVisit?.employeeName}</h2>
                                <p className="text-sm text-slate-500">{employeeMap[selectedVisit?.employeeId || '']?.designation || 'Specialist'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50 text-center">
                                <p className="text-[10px] text-slate-500 font-medium mb-1">From</p>
                                <p className="text-xs font-bold text-[#0a1e60]">
                                    {selectedVisit ? format(parseISO(selectedVisit.fromDate), 'EEE, d MMM') : '--'}
                                </p>
                            </div>
                            <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/50 text-center">
                                <p className="text-[10px] text-slate-500 font-medium mb-1">To</p>
                                <p className="text-xs font-bold text-[#0a1e60]">
                                    {selectedVisit ? format(parseISO(selectedVisit.toDate), 'EEE, d MMM') : '--'}
                                </p>
                            </div>
                            <div className="bg-purple-50/50 p-3 rounded-2xl border border-purple-100/50 text-center">
                                <p className="text-[10px] text-slate-500 font-medium mb-1">Visit Days</p>
                                <p className="text-xs font-bold text-[#0a1e60]">
                                    {selectedVisit ? calculateDays(selectedVisit.fromDate, selectedVisit.toDate) : 0}.0 Days
                                </p>
                            </div>
                        </div>

                        <div className="mb-4">
                            <h4 className="text-[10px] font-bold text-indigo-600 uppercase mb-2">Customer / Location</h4>
                            <div className="flex gap-2">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex-1">
                                    <p className="text-[10px] text-slate-500 mb-0.5">Customer</p>
                                    <p className="text-xs font-bold text-[#0a1e60]">{selectedVisit?.customerName || 'N/A'}</p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex-1">
                                    <p className="text-[10px] text-slate-500 mb-0.5">Location</p>
                                    <p className="text-xs font-bold text-[#0a1e60]">{selectedVisit?.location || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h4 className="text-[10px] font-bold text-blue-600 uppercase mb-2">Remarks</h4>
                            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 italic">
                                "{selectedVisit?.remarks}"
                            </p>
                        </div>

                        <div className="mb-8">
                            <h4 className="text-[10px] font-bold text-blue-600 uppercase mb-3">Approver History</h4>
                            <div className="flex items-center gap-3">
                                <div className="h-3 w-3 rounded-full bg-slate-200 border-2 border-white shadow-sm" />
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-slate-100 text-slate-400 text-[10px]">H</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-[#0a1e60]">YOU</span>
                                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[8px] h-4 py-0 px-1.5 font-bold uppercase">
                                            Under Processing
                                        </Badge>
                                    </div>
                                    <p className="text-[9px] text-slate-400">Your supervisor decision is required</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <Button
                                className="flex-1 bg-rose-500 hover:bg-rose-600 py-6 rounded-2xl font-bold shadow-lg shadow-rose-200"
                                onClick={() => handleRejectVisit(selectedVisit?.id || '')}
                            >
                                <XCircle className="mr-2 h-5 w-5" /> Reject
                            </Button>
                            <Button
                                className="flex-1 bg-[#10b981] hover:bg-[#059669] py-6 rounded-2xl font-bold shadow-lg shadow-emerald-200"
                                onClick={() => handleApproveVisit(selectedVisit?.id || '')}
                            >
                                <CheckCircle2 className="mr-2 h-5 w-5" /> Approve
                            </Button>
                        </div>

                        <div className="mt-6 flex items-center gap-2 text-[10px] text-slate-400 justify-center">
                            <Calendar className="h-3 w-3" />
                            Applied on {selectedVisit?.createdAt ? format(selectedVisit.createdAt.toDate(), 'dd-MM-yyyy') : '--'}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Filter Sheet */}
            <MobileFilterSheet
                open={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                onApply={setFilters}
                onReset={() => setFilters({ status: 'All' })}
                showDateRange
                showStatus
                statusOptions={['All', 'Pending', 'Approved', 'Rejected']}
                currentFilters={filters}
            />
        </div>
    );
}
