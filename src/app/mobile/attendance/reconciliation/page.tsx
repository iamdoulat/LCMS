"use client";

import React, { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { createReconciliationRequest } from '@/lib/firebase/reconciliation';
import { format, isValid, parseISO } from 'date-fns';
import { Calendar, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { Suspense } from 'react';

function ReconciliationForm() {
    const { user } = useAuth();
    const { currentEmployeeId } = useSupervisorCheck(user?.email);
    const router = useRouter();
    const searchParams = useSearchParams();

    // URL Params
    const attendanceDateParam = searchParams.get('date');
    const employeeIdParam = searchParams.get('employeeId');

    const [activeTab, setActiveTab] = useState<'in' | 'out' | 'both'>('in');
    const [loading, setLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [employeeData, setEmployeeData] = useState<any>(null);

    // Helper for safe date parsing
    // Helper for safe date parsing - treats YYYY-MM-DD as local date to avoid timezone shifts
    const safeParseDate = (dateStr: string | null) => {
        if (!dateStr) return new Date();
        try {
            const decodedDate = decodeURIComponent(dateStr);
            // Manually parse YYYY-MM-DD to avoid timezone issues
            if (/^\d{4}-\d{2}-\d{2}$/.test(decodedDate)) {
                const [year, month, day] = decodedDate.split('-').map(Number);
                return new Date(year, month - 1, day);
            }
            const d = new Date(decodedDate);
            return isNaN(d.getTime()) ? new Date() : d;
        } catch (e) {
            return new Date();
        }
    };

    const getInitialDateStr = () => {
        return attendanceDateParam ? format(safeParseDate(attendanceDateParam), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    };

    const initialDateStr = getInitialDateStr();

    // Form State
    const [inTimeDate, setInTimeDate] = useState(initialDateStr);
    const [inTime, setInTime] = useState('');
    const [outTimeDate, setOutTimeDate] = useState(initialDateStr);
    const [outTime, setOutTime] = useState('');

    // Sync state if URL param changes after initial render
    useEffect(() => {
        if (attendanceDateParam) {
            const parsed = format(safeParseDate(attendanceDateParam), 'yyyy-MM-dd');
            setInTimeDate(parsed);
            setOutTimeDate(parsed);
        }
    }, [attendanceDateParam]);

    const [inTimeRemarks, setInTimeRemarks] = useState('');
    const [outTimeRemarks, setOutTimeRemarks] = useState('');

    const parseTimeTo24h = (timeStr: string | undefined | null) => {
        if (!timeStr) return '';
        // Input: "09:30 AM" or "01:30 PM"
        const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return '';
        let [_, hours, minutes, period] = match;
        let h = parseInt(hours, 10);
        if (period.toUpperCase() === 'PM' && h < 12) h += 12;
        if (period.toUpperCase() === 'AM' && h === 12) h = 0;
        return `${h.toString().padStart(2, '0')}:${minutes}`;
    };

    useEffect(() => {
        const fetchData = async () => {
            if (currentEmployeeId) {
                try {
                    setIsFetching(true);
                    const { firestore } = await import('@/lib/firebase/config');
                    const { doc, getDoc } = await import('firebase/firestore');

                    // 1. Fetch Employee
                    const empDoc = await getDoc(doc(firestore, 'employees', currentEmployeeId));
                    if (empDoc.exists()) {
                        setEmployeeData(empDoc.data());
                    }

                    // 2. Fetch Attendance
                    if (attendanceDateParam) {
                        const datePart = attendanceDateParam.split('T')[0];
                        const attendanceDocId = `${currentEmployeeId}_${datePart}`;
                        const attDoc = await getDoc(doc(firestore, 'attendance', attendanceDocId));

                        if (attDoc.exists()) {
                            const data = attDoc.data();
                            if (data.inTime) setInTime(parseTimeTo24h(data.inTime));
                            if (data.outTime) setOutTime(parseTimeTo24h(data.outTime));
                            if (data.inTimeRemarks) setInTimeRemarks(data.inTimeRemarks);
                            if (data.outTimeRemarks) setOutTimeRemarks(data.outTimeRemarks);

                            // Also fetch and set dates
                            if (data.date) {
                                // data.date is ISO string, we need YYYY-MM-DD
                                const recordDate = data.date.split('T')[0];
                                setInTimeDate(recordDate);
                                setOutTimeDate(recordDate);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error fetching data:", e);
                } finally {
                    setIsFetching(false);
                }
            } else {
                setIsFetching(false);
            }
        };
        fetchData();
    }, [currentEmployeeId, attendanceDateParam]);

    const handleSubmit = async () => {
        if (!user || !currentEmployeeId) {
            Swal.fire("Error", "User or Employee ID missing. Please log in again.", "error");
            return;
        }
        if (!attendanceDateParam) {
            Swal.fire("Error", "Invalid attendance date.", "error");
            return;
        }

        if ((activeTab === 'in' || activeTab === 'both') && !inTime) {
            Swal.fire("Validation Error", "Please provide In Time.", "warning");
            return;
        }
        if ((activeTab === 'out' || activeTab === 'both') && !outTime) {
            Swal.fire("Validation Error", "Please provide Out Time.", "warning");
            return;
        }
        if ((activeTab === 'in' || activeTab === 'both') && !inTimeRemarks) {
            Swal.fire("Validation Error", "In Time Remarks are required.", "warning");
            return;
        }
        if ((activeTab === 'out' || activeTab === 'both') && !outTimeRemarks) {
            Swal.fire("Validation Error", "Out Time Remarks are required.", "warning");
            return;
        }

        // Add validation for negative work time
        if (inTime && outTime) {
            const inDateTime = new Date(`${inTimeDate}T${inTime}:00`);
            const outDateTime = new Date(`${outTimeDate}T${outTime}:00`);

            if (outDateTime <= inDateTime) {
                Swal.fire({
                    title: "Validation Error",
                    text: "Negative work time not allowed. Out Time should be after In Time. Check! AM / PM",
                    icon: "warning"
                });
                return;
            }
        }

        setLoading(true);
        try {
            const constructIso = (dateStr: string, timeStr: string) => {
                if (!dateStr || !timeStr) return undefined;
                return new Date(`${dateStr}T${timeStr}:00`).toISOString();
            };

            const reqData: any = {
                employeeId: currentEmployeeId,
                employeeCode: employeeData?.employeeCode || 'N/A',
                employeeName: employeeData?.fullName || user.displayName || 'Unknown User',
                designation: employeeData?.designation || 'Staff',
                attendanceDate: inTimeDate, // Use the date state which handles updates
                inTimeRemarks: inTimeRemarks,
                outTimeRemarks: outTimeRemarks,
            };

            if (activeTab === 'in' || activeTab === 'both') {
                reqData.requestedInTime = constructIso(inTimeDate, inTime);
            }
            if (activeTab === 'out' || activeTab === 'both') {
                reqData.requestedOutTime = constructIso(outTimeDate, outTime);
            }

            await createReconciliationRequest(reqData, user.uid);

            await Swal.fire({
                title: 'Success',
                text: 'Reconciliation request submitted successfully.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
            router.back();

        } catch (error) {
            console.error("Error submitting reconciliation:", error);
            Swal.fire("Error", "Failed to submit request.", "error");
        } finally {
            setLoading(false);
        }
    };

    const formattedHeaderDate = inTimeDate ? format(safeParseDate(inTimeDate), 'dd MMM yyyy') : '-';

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60]">
            <div className="px-6 pt-[10px] pb-[5px] flex items-center gap-4 text-white">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 text-center pr-10">
                    <h1 className="text-lg font-bold">Attendance Reconciliation</h1>
                    <p className="text-xs text-blue-200">Reconciliation Date: {formattedHeaderDate}</p>
                </div>
            </div>

            <div className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col">
                <div className="p-6 space-y-6 overflow-y-auto pb-[200px]">
                    {isFetching ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                            <p className="text-sm font-medium">Loading details...</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex bg-white p-1 rounded-xl shadow-sm">
                                <button
                                    onClick={() => setActiveTab('in')}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'in' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                                        }`}
                                >
                                    In Time
                                </button>
                                <button
                                    onClick={() => setActiveTab('out')}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'out' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                                        }`}
                                >
                                    Out Time
                                </button>
                                <button
                                    onClick={() => setActiveTab('both')}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'both' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                                        }`}
                                >
                                    Both
                                </button>
                            </div>

                            <div className="bg-white rounded-2xl p-6 shadow-sm space-y-6">
                                {(activeTab === 'in' || activeTab === 'both') && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 flex">In Time Date<span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <Input
                                                    type="date"
                                                    value={inTimeDate}
                                                    onChange={(e) => setInTimeDate(e.target.value)}
                                                    className="pl-4 h-12 bg-slate-50 border-slate-200"
                                                    disabled={true}
                                                />
                                                <Calendar className="absolute right-4 top-3.5 w-5 h-5 text-indigo-500 pointer-events-none" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 flex">In Time<span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <Input
                                                    type="time"
                                                    value={inTime}
                                                    onChange={(e) => setInTime(e.target.value)}
                                                    className="pl-4 h-12 bg-slate-50 border-slate-200 appearance-none"
                                                />
                                                <Clock className="absolute right-4 top-3.5 w-5 h-5 text-indigo-500 pointer-events-none" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {(activeTab === 'out' || activeTab === 'both') && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 flex">Out Time Date<span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <Input
                                                    type="date"
                                                    value={outTimeDate}
                                                    onChange={(e) => setOutTimeDate(e.target.value)}
                                                    className="pl-4 h-12 bg-slate-50 border-slate-200"
                                                    disabled={true}
                                                />
                                                <Calendar className="absolute right-4 top-3.5 w-5 h-5 text-indigo-500 pointer-events-none" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 flex">Out Time<span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <Input
                                                    type="time"
                                                    value={outTime}
                                                    onChange={(e) => setOutTime(e.target.value)}
                                                    className="pl-4 h-12 bg-slate-50 border-slate-200"
                                                />
                                                <Clock className="absolute right-4 top-3.5 w-5 h-5 text-indigo-500 pointer-events-none" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {(activeTab === 'in' || activeTab === 'both') && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 flex">In Time Remarks<span className="text-red-500">*</span></label>
                                        <Textarea
                                            value={inTimeRemarks}
                                            onChange={(e) => setInTimeRemarks(e.target.value)}
                                            className="bg-slate-50 border-slate-200 min-h-[80px] resize-none"
                                        />
                                    </div>
                                )}

                                {(activeTab === 'out' || activeTab === 'both') && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 flex">Out Time Remarks<span className="text-red-500">*</span></label>
                                        <Textarea
                                            value={outTimeRemarks}
                                            onChange={(e) => setOutTimeRemarks(e.target.value)}
                                            className="bg-slate-50 border-slate-200 min-h-[80px] resize-none"
                                        />
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-lg font-bold shadow-lg shadow-blue-200 mb-6"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : 'Submit'}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AttendanceReconciliationPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col h-screen bg-[#0a1e60] items-center justify-center">
                <Loader2 className="animate-spin text-white w-10 h-10" />
            </div>
        }>
            <ReconciliationForm />
        </Suspense>
    );
}
