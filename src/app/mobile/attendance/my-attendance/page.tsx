"use client";

import React, { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { format, parseISO } from 'date-fns';
import { Edit2, Clock, Coffee, AlertCircle, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AttendanceRecord {
    id: string;
    date: string; // YYYY-MM-DD
    inTime?: string;
    outTime?: string;
    flag?: string; // P, D, etc.
}

interface BreakRecord {
    id: string;
    date: string;
    startTime: string;
    endTime?: string;
    durationMinutes?: number;
    status: string;
}

export default function MyAttendancePage() {
    const { user } = useAuth();
    // We need employeeId to query attendance. 
    // Usually useSupervisorCheck gives supervisor info, but also returns currentEmployeeId if found via email.
    // Alternatively query 'employees' by email.
    const { currentEmployeeId } = useSupervisorCheck(user?.email);

    const [activeTab, setActiveTab] = useState<'attendance' | 'break'>('attendance');
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [breakRecords, setBreakRecords] = useState<BreakRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchAttendance = async () => {
        if (!currentEmployeeId) return;
        setLoading(true);
        try {
            // Fetch all records for employee and sort client-side to avoid composite index requirement
            const q = query(
                collection(firestore, 'attendance'),
                where('employeeId', '==', currentEmployeeId)
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));

            // Sort by date desc
            data.sort((a, b) => {
                if (!a.date || !b.date) return 0;
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });

            console.log(`Fetched ${data.length} attendance records for ${currentEmployeeId}`);
            setAttendanceRecords(data.slice(0, 30));
        } catch (error) {
            console.error("Error fetching attendance:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBreaks = async () => {
        if (!currentEmployeeId) return;
        setLoading(true);
        try {
            // Fetch all break records for employee and sort client-side to avoid composite index requirement
            const q = query(
                collection(firestore, 'break_time'),
                where('employeeId', '==', currentEmployeeId)
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BreakRecord));

            // Sort by startTime desc
            data.sort((a, b) => {
                if (!a.startTime || !b.startTime) return 0;
                return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
            });

            console.log(`Fetched ${data.length} break records for ${currentEmployeeId}`);
            setBreakRecords(data.slice(0, 30));
        } catch (error) {
            console.error("Error fetching breaks:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentEmployeeId) {
            if (activeTab === 'attendance') fetchAttendance();
            else fetchBreaks();
        }
    }, [currentEmployeeId, activeTab]);

    const formatTime = (isoString?: string) => {
        if (!isoString) return '-';
        try {
            return format(parseISO(isoString), 'hh:mm a');
        } catch (e) {
            return isoString; // Fallback
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            return {
                full: format(new Date(dateStr), 'dd MMM yyyy'),
                day: format(new Date(dateStr), 'EEEE')
            };
        } catch (e) {
            return { full: dateStr, day: '' };
        }
    };

    const getFlagColor = (flag?: string) => {
        switch (flag) {
            case 'P': return 'text-emerald-500 bg-emerald-50';
            case 'D': return 'text-yellow-500 bg-yellow-50';
            case 'L': return 'text-cyan-500 bg-cyan-50';
            case 'W': return 'text-violet-500 bg-violet-50';
            case 'H': return 'text-pink-500 bg-pink-50';
            case 'A': return 'text-red-500 bg-red-50';
            default: return 'text-slate-500 bg-slate-50';
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60]">
            {/* Header */}
            <div className="px-6 pt-7 pb-6 flex items-center gap-4 text-white">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 text-center pr-10">
                    <h1 className="text-xl font-bold">My Attendance</h1>
                </div>
            </div>

            <div className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col">
                {/* Tabs */}
                <div className="bg-white px-6 pt-6 pb-2 rounded-t-[2rem] shadow-sm z-10">
                    <div className="flex items-center justify-between p-1 bg-slate-50 rounded-full mb-4">
                        <button
                            onClick={() => setActiveTab('attendance')}
                            className={`flex-1 py-3 text-sm font-bold rounded-full transition-all duration-200 ${activeTab === 'attendance'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${activeTab === 'attendance' ? 'bg-yellow-400' : 'bg-transparent'}`}></span>
                                Attendance
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('break')}
                            className={`flex-1 py-3 text-sm font-bold rounded-full transition-all duration-200 ${activeTab === 'break'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${activeTab === 'break' ? 'bg-yellow-400' : 'bg-transparent'}`}></span>
                                Break Time
                            </span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        activeTab === 'attendance' ? (
                            attendanceRecords.length > 0 ? (
                                attendanceRecords.map((record) => {
                                    const dateInfo = formatDate(record.date);
                                    return (
                                        <div key={record.id} className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between group h-24">
                                            <div className="flex-1 space-y-1 border-l-4 border-emerald-400 pl-4 h-full flex flex-col justify-center">
                                                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                                                    Date ({dateInfo.day})
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg font-bold text-slate-800">{dateInfo.full}</span>
                                                    {record.flag && (
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getFlagColor(record.flag)}`}>
                                                            {record.flag}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1 text-sm mr-4">
                                                <div className="flex justify-between w-32">
                                                    <span className="text-blue-500 font-medium">In Time</span>
                                                    <span className="text-slate-700 font-bold">{
                                                        // Assuming inTime stored as full ISO string or just time? 
                                                        // Based on current db usually full ISO or time string.
                                                        // Let's assume full ISO or "HH:mm:ss". Implementation plan assumes standard.
                                                        // The code above handles parseISO. If stored as '09:00 AM' it handles that too via fallback.
                                                        formatTime(record.inTime)
                                                    }</span>
                                                </div>
                                                <div className="flex justify-between w-32">
                                                    <span className="text-blue-500 font-medium">Out Time</span>
                                                    <span className="text-slate-700 font-bold">{formatTime(record.outTime)}</span>
                                                </div>
                                            </div>

                                            <Link
                                                href={`/mobile/attendance/reconciliation?date=${record.date}&employeeId=${currentEmployeeId}`}
                                                className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600 hover:bg-yellow-100 transition-colors"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </Link>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-10 text-slate-400 flex flex-col items-center">
                                    <Clock className="w-12 h-12 mb-3 opacity-20" />
                                    No attendance records found.
                                </div>
                            )
                        ) : (
                            breakRecords.length > 0 ? (
                                breakRecords.map((record) => (
                                    <div key={record.id} className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
                                        <div className="flex-1 space-y-1 pl-2">
                                            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                                                {formatDate(record.date).full}
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-slate-400">Start</span>
                                                    <span className="font-bold text-slate-700">{formatTime(record.startTime)}</span>
                                                </div>
                                                <div className="w-px h-8 bg-slate-100"></div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-slate-400">End</span>
                                                    <span className="font-bold text-slate-700">{formatTime(record.endTime)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1">
                                            <div className={`px-2 py-1 rounded-lg text-xs font-bold ${record.status === 'approved' || record.status === 'auto-approved' ? 'bg-green-100 text-green-600' :
                                                record.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                                    'bg-orange-100 text-orange-600'
                                                }`}>
                                                {record.status}
                                            </div>
                                            {record.durationMinutes && (
                                                <span className="text-xs font-medium text-slate-500">
                                                    {record.durationMinutes} min
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-slate-400 mb-auto">
                                    <Coffee className="w-12 h-12 mb-3 opacity-20 mx-auto" />
                                    No break records found.
                                </div>

                            )
                        )
                    )}
                    {activeTab === 'break' && breakRecords.length === 0 && !loading && (
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-red-500 text-white text-center text-sm font-medium">
                            Work breaks are not found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
