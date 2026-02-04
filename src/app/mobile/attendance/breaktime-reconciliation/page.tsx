"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { format, parseISO } from 'date-fns';
import { Calendar, Clock, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import { createBreaktimeReconciliationRequest } from '@/lib/firebase/reconciliation';

export default function BreaktimeReconciliationPage() {
    const { user } = useAuth();
    const { currentEmployeeId } = useSupervisorCheck(user?.email);
    const router = useRouter();
    const searchParams = useSearchParams();

    const dateParam = searchParams.get('date');
    const breakIdParam = searchParams.get('breakId');

    const [isFetching, setIsFetching] = useState(true);
    const [employeeData, setEmployeeData] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(dateParam || format(new Date(), 'yyyy-MM-dd'));
    const [breakStartTime, setBreakStartTime] = useState('');
    const [breakEndTime, setBreakEndTime] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Fetch employee data
    useEffect(() => {
        const fetchEmployeeData = async () => {
            if (!currentEmployeeId) return;

            try {
                const employeeDoc = await getDoc(doc(firestore, 'employees', currentEmployeeId));
                if (employeeDoc.exists()) {
                    setEmployeeData(employeeDoc.data());
                }
            } catch (error) {
                console.error("Error fetching employee data:", error);
            }
        };

        fetchEmployeeData();
    }, [currentEmployeeId]);

    // Fetch existing break record to pre-fill the form
    useEffect(() => {
        const fetchBreakDetails = async () => {
            if (!breakIdParam) {
                setIsFetching(false);
                return;
            }

            try {
                const breakRef = doc(firestore, 'break_time', breakIdParam);
                const breakDoc = await getDoc(breakRef);

                if (breakDoc.exists()) {
                    const data = breakDoc.data();
                    // Pre-fill with existing times
                    if (data.startTime) {
                        const startDate = new Date(data.startTime);
                        setBreakStartTime(format(startDate, 'HH:mm'));
                    }
                    if (data.endTime) {
                        const endDate = new Date(data.endTime);
                        setBreakEndTime(format(endDate, 'HH:mm'));
                    }
                }
            } catch (error) {
                console.error("Error fetching break details:", error);
            } finally {
                setIsFetching(false);
            }
        };

        fetchBreakDetails();
    }, [breakIdParam]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentEmployeeId || !employeeData) {
            Swal.fire('Error', 'Employee information not found', 'error');
            return;
        }

        if (!breakStartTime || !breakEndTime) {
            Swal.fire('Validation Error', 'Please provide both break start and end times', 'warning');
            return;
        }

        if (!reason.trim()) {
            Swal.fire('Validation Error', 'Please provide a reason for this reconciliation', 'warning');
            return;
        }

        // Validate that end time is after start time
        const [startHour, startMin] = breakStartTime.split(':').map(Number);
        const [endHour, endMin] = breakEndTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (endMinutes <= startMinutes) {
            Swal.fire('Validation Error', 'Break end time must be after start time', 'warning');
            return;
        }

        setSubmitting(true);

        try {
            // Convert time strings to full ISO timestamps
            const baseDate = parseISO(selectedDate);
            const startDateTime = new Date(baseDate);
            startDateTime.setHours(startHour, startMin, 0, 0);

            const endDateTime = new Date(baseDate);
            endDateTime.setHours(endHour, endMin, 0, 0);

            const reconciliationData = {
                employeeId: currentEmployeeId,
                employeeCode: employeeData?.employeeCode || 'N/A',
                employeeName: employeeData?.fullName || user?.displayName || 'Unknown',
                designation: employeeData?.designation || 'Staff',
                attendanceDate: selectedDate,
                requestedBreakStartTime: startDateTime.toISOString(),
                requestedBreakEndTime: endDateTime.toISOString(),
                reason: reason.trim(),
                breakId: breakIdParam || ''
            };

            await createBreaktimeReconciliationRequest(reconciliationData, user!.uid);

            await Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Breaktime reconciliation request submitted successfully.',
                confirmButtonColor: '#10b981',
            });

            router.push('/mobile/attendance/reconciliation/my-applications');
        } catch (error) {
            console.error('Error submitting breaktime reconciliation:', error);
            Swal.fire('Error', 'Failed to submit reconciliation request. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (isFetching) {
        return (
            <div className="flex flex-col h-screen bg-[#0a1e60]">
                <div className="sticky top-0 z-50 bg-[#0a1e60]">
                    <div className="flex items-center px-4 pt-1 pb-6">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white ml-2">Breaktime Reconciliation</h1>
                    </div>
                </div>

                <div className="flex-1 bg-slate-50 rounded-t-[2rem] flex items-center justify-center">
                    <div className="flex flex-col items-center text-slate-400">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                        <p className="text-sm font-medium">Loading details...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 pt-1 pb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2">Breaktime Reconciliation</h1>
                </div>
            </div>

            {/* Form */}
            <div className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto overscroll-contain pb-[100px]">
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Info Alert */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-bold mb-1">Submit a breaktime reconciliation request</p>
                            <p className="text-xs">Provide the correct break start and end times along with a reason for this request.</p>
                        </div>
                    </div>

                    {/* Date Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Reconciliation Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                max={format(new Date(), 'yyyy-MM-dd')}
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                required
                            />
                        </div>
                    </div>

                    {/* Break Start Time */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Break Start Time</label>
                        <div className="relative">
                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-yellow-500" />
                            <input
                                type="time"
                                value={breakStartTime}
                                onChange={(e) => setBreakStartTime(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 outline-none transition-all"
                                required
                            />
                        </div>
                    </div>

                    {/* Break End Time */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Break End Time</label>
                        <div className="relative">
                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500" />
                            <input
                                type="time"
                                value={breakEndTime}
                                onChange={(e) => setBreakEndTime(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                                required
                            />
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Reason for Reconciliation</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={4}
                            placeholder="Explain why you need to reconcile this break time..."
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                            required
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            'Submit Reconciliation Request'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
