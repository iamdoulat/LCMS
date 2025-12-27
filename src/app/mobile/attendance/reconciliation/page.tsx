"use client";

import React, { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { createReconciliationRequest } from '@/lib/firebase/reconciliation';
import { format, isValid, parseISO } from 'date-fns';
import { Calendar, Clock, ChevronLeft, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function AttendanceReconciliationPage() {
    const { user } = useAuth();
    // Fetch supervisor info to get current employee details if needed or pass via params/context
    // Better to fetch employee details to populate 'CreateReconciliationData'
    // But for now, we'll assume we pass params or use context.
    // The createReconciliationRequest needs employee info. 
    // We can fetch 'employees' doc by currentEmployeeId.
    const { currentEmployeeId } = useSupervisorCheck(user?.email);
    const router = useRouter();
    const searchParams = useSearchParams();

    // URL Params
    const attendanceDateParam = searchParams.get('date');
    const employeeIdParam = searchParams.get('employeeId');

    const [activeTab, setActiveTab] = useState<'in' | 'out' | 'both'>('out');
    const [loading, setLoading] = useState(false);
    const [employeeData, setEmployeeData] = useState<any>(null);

    // Form State
    const [inTimeDate, setInTimeDate] = useState(attendanceDateParam || format(new Date(), 'yyyy-MM-dd'));
    const [inTime, setInTime] = useState('');
    const [outTimeDate, setOutTimeDate] = useState(attendanceDateParam || format(new Date(), 'yyyy-MM-dd'));
    const [outTime, setOutTime] = useState('');


    const [inTimeRemarks, setInTimeRemarks] = useState('');
    const [outTimeRemarks, setOutTimeRemarks] = useState('');

    useEffect(() => {
        const fetchEmployee = async () => {
            if (currentEmployeeId) {
                // Fetch employee data for name/code/designation
                try {
                    const { firestore } = await import('@/lib/firebase/config');
                    const { doc, getDoc } = await import('firebase/firestore');
                    const empDoc = await getDoc(doc(firestore, 'employees', currentEmployeeId));
                    if (empDoc.exists()) {
                        setEmployeeData(empDoc.data());
                    }
                } catch (e) {
                    console.error("Error fetching employee:", e);
                }
            }
        };
        fetchEmployee();
    }, [currentEmployeeId]);

    const handleSubmit = async () => {
        if (!user || !currentEmployeeId || !employeeData) return;
        if (!attendanceDateParam) {
            Swal.fire("Error", "Invalid attendance date.", "error");
            return;
        }

        // Validation
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

        setLoading(true);
        try {
            // Construct request data
            // We need full ISO strings for times. 
            // Input time is usually HH:mm (24h) or HH:mm AM/PM depending on browser/device.
            // Let's assume input type='time' gives HH:mm (24h).
            // We need to combine *TimeDate + *Time to ISO.

            const constructIso = (dateStr: string, timeStr: string) => {
                if (!dateStr || !timeStr) return undefined;
                return new Date(`${dateStr}T${timeStr}:00`).toISOString();
            };

            const reqData: any = {
                employeeId: currentEmployeeId,
                employeeCode: employeeData.employeeCode || '',
                employeeName: employeeData.fullName || user.displayName || 'Unknown',
                designation: employeeData.designation || '',
                attendanceDate: attendanceDateParam,
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

    const formattedHeaderDate = attendanceDateParam ? format(new Date(attendanceDateParam), 'dd-MM-yyyy') : '-';

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60]">
            {/* Header */}
            <div className="px-6 pt-12 pb-6 flex items-center gap-4 text-white">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 text-center pr-10">
                    <h1 className="text-lg font-bold">Attendance Reconciliation</h1>
                    <p className="text-xs text-blue-200">Attendance date: {formattedHeaderDate}</p>
                </div>
            </div>

            <div className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col">
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Tab Switcher */}
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

                    {/* Form Fields */}
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
                                            className="pl-4 h-12 bg-slate-50 border-slate-200 appearance-none" // appearance-none needed for some browsers to allow custom icon overlay if needed, but native picker is fine
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
                </div>
            </div>
        </div>
    );
}
