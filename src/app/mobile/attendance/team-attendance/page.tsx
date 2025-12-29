"use client";

import React, { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ChevronLeft, Search, UserCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface AttendanceSummary {
    employeeId: string;
    employeeName: string;
    photoURL?: string;
    inTime?: string;
    outTime?: string;
    flag?: string; // P, A, etc.
}

export default function TeamAttendancePage() {
    const { user } = useAuth();
    const { isSupervisor, supervisedEmployees } = useSupervisorCheck(user?.email);
    const [attendanceData, setAttendanceData] = useState<AttendanceSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();

    const fetchTeamAttendance = async () => {
        if (!user || !isSupervisor || supervisedEmployees.length === 0) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Get today's start and end timestamps in the format used by MobileAttendanceModal
            const now = new Date();
            const startStr = format(startOfDay(now), "yyyy-MM-dd'T'00:00:00.000xxx");
            const endStr = format(endOfDay(now), "yyyy-MM-dd'T'23:59:59.999xxx");

            const employeeIds = supervisedEmployees.map(e => e.id);
            const summaries: AttendanceSummary[] = [];

            if (employeeIds.length === 0) {
                setAttendanceData([]);
                setLoading(false);
                return;
            }

            const chunks = [];
            for (let i = 0; i < employeeIds.length; i += 10) {
                chunks.push(employeeIds.slice(i, i + 10));
            }

            const attendanceMap = new Map<string, any>();

            for (const chunk of chunks) {
                const q = query(
                    collection(firestore, 'attendance'),
                    where('employeeId', 'in', chunk),
                    where('date', '>=', startStr),
                    where('date', '<=', endStr)
                );
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    const data = doc.data();
                    attendanceMap.set(data.employeeId, data);
                });
            }

            // Map supervised employees to summary
            for (const emp of supervisedEmployees) {
                const att = attendanceMap.get(emp.id);
                summaries.push({
                    employeeId: emp.id,
                    employeeName: emp.fullName || emp.name,
                    photoURL: emp.photoURL,
                    inTime: att?.inTime,
                    outTime: att?.outTime,
                    flag: att?.flag || 'A'
                });
            }

            setAttendanceData(summaries);

        } catch (error) {
            console.error("Error fetching team attendance:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeamAttendance();
    }, [user, isSupervisor, supervisedEmployees]);

    const containerRef = usePullToRefresh(fetchTeamAttendance);

    const formatTime = (isoString?: string) => {
        if (!isoString) return 'N/A';
        try {
            return format(new Date(isoString), 'hh:mm a');
        } catch {
            return isoString;
        }
    };

    const filteredData = attendanceData.filter(item =>
        item.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (flag?: string) => {
        // Green for Present (P), others different?
        // Ref image shows Green 'P'. Assume Red for 'A' (Absent).
        if (flag === 'P' || flag === 'L' || flag === 'D') return 'bg-emerald-500';
        return 'bg-red-500'; // Default / Absent
    };

    const getBorderColor = (flag?: string) => {
        if (flag === 'P' || flag === 'L' || flag === 'D') return 'border-emerald-500';
        return 'border-red-500';
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 pt-1 pb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2">View Attendance (Subordinates)</h1>
                </div>
            </div>

            <div ref={containerRef} className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto overscroll-contain flex flex-col">
                {/* Search */}
                <div className="p-6 bg-white shadow-sm z-10 rounded-t-[2rem]">
                    <div className="relative">
                        <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search employee..."
                            className="pl-12 h-12 bg-slate-50 border-slate-200 rounded-xl"
                        />
                    </div>
                </div>

                <div className="flex-1 p-6 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
                        </div>
                    ) : filteredData.length > 0 ? (
                        filteredData.map((emp) => (
                            <div key={emp.employeeId} className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-4">
                                {/* Avatar with status indicator line/border */}
                                <div className={`relative w-14 h-14 rounded-xl overflow-hidden border-l-4 ${getBorderColor(emp.flag)} pl-1 bg-white flex-shrink-0`}>
                                    {emp.photoURL ? (
                                        <img src={emp.photoURL} alt={emp.employeeName} className="w-full h-full object-cover rounded-lg" />
                                    ) : (
                                        <div className="w-full h-full bg-slate-100 flex items-center justify-center rounded-lg">
                                            <UserCircle className="w-10 h-10 text-slate-400" />
                                        </div>
                                    )}
                                    {/* Small badge overlay? Ref image shows badge bottom right of avatar */}
                                    {emp.flag && (
                                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white ${getStatusColor(emp.flag)}`}>
                                            {emp.flag}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-800 text-sm mb-2 truncate">{emp.employeeName}</h3>
                                    <div className="flex gap-3 text-xs font-semibold">
                                        <div className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600">
                                            {formatTime(emp.inTime)}
                                        </div>
                                        <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600">
                                            {formatTime(emp.outTime)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 text-slate-400">
                            No subordinates found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
