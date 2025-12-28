"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Plus, Calendar as CalendarIcon, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import type { LeaveApplicationDocument, EmployeeDocument } from '@/types';
import { cn } from '@/lib/utils';

export default function MyLeaveApplicationsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [applications, setApplications] = useState<LeaveApplicationDocument[]>([]);
    const [employeeData, setEmployeeData] = useState<EmployeeDocument | null>(null);
    const [selectedApp, setSelectedApp] = useState<LeaveApplicationDocument | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 pt-1 pb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full active:bg-white/10 transition-colors text-white"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2">My Leave Applications</h1>
                </div>
            </div>

            {/* Applications List */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain relative px-5 pt-8 space-y-4">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="p-4 border-none shadow-sm animate-pulse">
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
                ) : applications.length > 0 ? (
                    applications.map(app => (
                        <Card
                            key={app.id}
                            className={cn(
                                "overflow-hidden border-none shadow-sm relative active:scale-95 transition-all cursor-pointer border-l-4",
                                getBorderColor(app.status)
                            )}
                            onClick={() => {
                                setSelectedApp(app);
                                setIsModalOpen(true);
                            }}
                        >
                            <div className="p-4">
                                <Badge className={cn("text-xs font-bold uppercase mb-2", getStatusColor(app.status))}>
                                    {app.status}
                                </Badge>

                                <h3 className="font-bold text-[#0a1e60] mb-1 line-clamp-2">
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

                {/* Spacer bottom */}
                <div className="h-24" />
            </div>

            {/* Floating Action Button */}
            <button
                onClick={() => router.push('/mobile/leave/apply')}
                className="fixed bottom-6 right-6 h-14 w-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all z-50"
            >
                <Plus className="h-6 w-6" />
            </button>

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
