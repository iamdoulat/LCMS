"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { format, parseISO, startOfDay, subDays, eachDayOfInterval, isWithinInterval, getDay, endOfDay, isValid, isSameDay, parse } from 'date-fns';
import { ArrowLeft, Clock, AlertCircle, Loader2, UserCircle, Calendar, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { MobileFilterSheet } from '@/components/mobile/MobileFilterSheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import dynamic from 'next/dynamic';
import type { Employee } from '@/types';

// Dynamic import for map
const LocationMap = dynamic(() => import('@/components/ui/LocationMap'), {
    ssr: false,
    loading: () => <div className="h-[300px] w-full bg-slate-100 animate-pulse rounded-md" />
});

interface AttendanceRecord {
    id: string;
    date: string; // YYYY-MM-DD
    inTime?: string;
    outTime?: string;
    flag?: string;
    inTimeLocation?: { latitude: number; longitude: number; address?: string };
    outTimeLocation?: { latitude: number; longitude: number; address?: string };
}

export default function SubordinateAttendanceDetailsPage() {
    const { id: employeeId } = useParams();
    const router = useRouter();
    const { user } = useAuth();

    const [employee, setEmployee] = useState<Employee | null>(null);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [holidays, setHolidays] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter State
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
        from: startOfDay(subDays(new Date(), 30)),
        to: endOfDay(new Date())
    });

    // Map Modal State
    const [selectedLocationRecord, setSelectedLocationRecord] = useState<AttendanceRecord | null>(null);

    const fetchData = async () => {
        if (!employeeId) return;
        setLoading(true);
        try {
            // 1. Fetch Employee Details
            const empDoc = await getDoc(doc(firestore, 'employees', employeeId as string));
            if (empDoc.exists()) {
                const empData = { id: empDoc.id, ...empDoc.data() } as Employee;
                setEmployee(empData);

                // 2. Fetch Support Data
                const [holidaysSnap, leavesSnap, visitsSnap] = await Promise.all([
                    getDocs(collection(firestore, 'holidays')),
                    getDocs(query(collection(firestore, 'leave_applications'), where('employeeId', '==', employeeId), where('status', '==', 'Approved'))),
                    getDocs(query(collection(firestore, 'visit_applications'), where('employeeId', '==', employeeId), where('status', '==', 'Approved')))
                ]);

                const hols = holidaysSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const lvs = leavesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const vsts = visitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                setHolidays(hols);
                setLeaves(lvs);
                setVisits(vsts);

                // 3. Fetch Attendance Records
                const queryIds = [empData.id, empData.uid].filter((id): id is string => !!id);
                const attQ = query(collection(firestore, 'attendance'), where('employeeId', 'in', queryIds));
                const attSnap = await getDocs(attQ);
                const rawAttData = attSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));

                // 4. Synthesize records for the selected date range
                const daysInInterval = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });

                const getDhakaDateStr = (dateInput: Date | string) => {
                    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
                    if (isNaN(d.getTime())) return '';
                    return new Intl.DateTimeFormat('en-CA', {
                        timeZone: 'Asia/Dhaka',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    }).format(d);
                };

                const fullRecords: AttendanceRecord[] = daysInInterval.map(day => {
                    const targetDateStr = format(day, 'yyyy-MM-dd');
                    const existing = rawAttData.find(r => r.date && getDhakaDateStr(r.date) === targetDateStr);

                    if (existing) return existing;

                    const dayOfWeek = getDay(day);
                    let flag = 'A'; // Absent default

                    if (dayOfWeek === 5) flag = 'W'; // Weekend
                    else if (hols.some((h: any) => isWithinInterval(day, { start: parseISO(h.fromDate), end: parseISO(h.toDate || h.fromDate) }))) flag = 'H';
                    else if (lvs.some((l: any) => isWithinInterval(day, { start: parseISO(l.fromDate), end: parseISO(l.toDate) }))) flag = 'L';
                    else if (vsts.some((v: any) => isWithinInterval(day, { start: parseISO(v.fromDate), end: parseISO(v.toDate) }))) flag = 'V';

                    if (isAfter(day, new Date()) && flag === 'A') flag = '';

                    return { id: `synth-${targetDateStr}`, date: targetDateStr, flag } as AttendanceRecord;
                });

                fullRecords.sort((a, b) => b.date.localeCompare(a.date));
                setAttendanceRecords(fullRecords);
            }
        } catch (error) {
            console.error("Error fetching subordinate attendance:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [employeeId, dateRange]);

    const containerRef = usePullToRefresh(fetchData);

    const formatTime = (isoString?: string) => {
        if (!isoString) return '-';
        try {
            return format(parseISO(isoString), 'hh:mm a');
        } catch {
            return isoString;
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            if (!isValid(date)) return { full: dateStr, day: '' };
            return {
                full: format(date, 'dd MMM yyyy'),
                day: format(date, 'EEEE')
            };
        } catch {
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
            case 'V': return 'text-orange-500 bg-orange-50';
            case 'A': return 'text-red-500 bg-red-50';
            default: return 'text-slate-500 bg-slate-50';
        }
    };

    const calculateWorkTime = (inTime?: string, outTime?: string) => {
        if (!inTime || !outTime) return '-';
        try {
            let inDate = parseISO(inTime);
            let outDate = parseISO(outTime);

            if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
                const baseDate = new Date();
                inDate = parse(inTime, 'hh:mm a', baseDate);
                outDate = parse(outTime, 'hh:mm a', baseDate);

                if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
                    return '-';
                }
            }

            const diffMs = outDate.getTime() - inDate.getTime();
            if (diffMs < 0) return '-';
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            return `${hours}h ${minutes}m`;
        } catch {
            return '-';
        }
    };

    const getFlagLabel = (flag?: string) => {
        // Revised flags to shorthand as requested: P, D, A, L, W, H, V
        return flag || '-';
    };

    const isAfter = (d1: Date, d2: Date) => {
        return d1.getTime() > d2.getTime();
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
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
                        <h1 className="text-xl font-bold text-white ml-2">Attendance History</h1>
                    </div>

                    <button
                        onClick={() => setIsFilterOpen(true)}
                        className="p-2 text-white hover:bg-white/10 rounded-full transition-colors bg-[#1a2b6d] shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                    >
                        <Calendar className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <div ref={containerRef} className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto overscroll-contain flex flex-col">
                {/* Employee Profile Bar */}
                {employee && (
                    <div className="p-6 bg-white shadow-sm z-10 rounded-t-[2rem] flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 border-2 border-slate-50">
                            {employee.photoURL ? (
                                <img src={employee.photoURL} alt={employee.fullName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <UserCircle className="w-10 h-10 text-slate-300" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-[#0a1e60] truncate">{employee.fullName}</h2>
                            <p className="text-sm text-slate-500 font-medium">{employee.designation}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase">
                                {employee.employeeCode}
                            </span>
                        </div>
                    </div>
                )}

                {/* Records List */}
                <div className="flex-1 px-4 pt-6 pb-[120px] space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
                        </div>
                    ) : attendanceRecords.length > 0 ? (
                        attendanceRecords.map((record) => {
                            const dateInfo = formatDate(record.date);
                            const hasLocation = record.inTimeLocation || record.outTimeLocation;
                            return (
                                <div key={record.id} className="bg-white rounded-xl px-3 py-3 shadow-sm border border-slate-100 flex items-center gap-3">
                                    <div className={cn("w-1.5 h-12 rounded-full shrink-0",
                                        record.flag === 'P' ? 'bg-emerald-400' :
                                            record.flag === 'D' ? 'bg-yellow-400' :
                                                record.flag === 'W' ? 'bg-violet-400' :
                                                    record.flag === 'H' ? 'bg-pink-400' :
                                                        record.flag === 'L' ? 'bg-cyan-400' :
                                                            record.flag === 'V' ? 'bg-orange-400' :
                                                                record.flag === 'A' ? 'bg-red-400' : 'bg-slate-300'
                                    )}></div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-[12px] font-bold text-slate-900">{dateInfo.full}</span>
                                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">({dateInfo.day})</span>
                                            {record.flag && (
                                                <span className={cn("ml-auto px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shadow-sm border border-white/20 min-w-[24px] text-center", getFlagColor(record.flag))}>
                                                    {getFlagLabel(record.flag)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 text-slate-600">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 text-blue-500" />
                                                <span className="text-[11px] font-bold">
                                                    <span className="text-slate-400 mr-1 text-[9px] uppercase">In</span>
                                                    {formatTime(record.inTime)}
                                                </span>
                                            </div>
                                            <div className="w-px h-3 bg-slate-200"></div>
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                                                <span className="text-[11px] font-bold">
                                                    <span className="text-slate-400 mr-1 text-[9px] uppercase">Out</span>
                                                    {formatTime(record.outTime)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="h-12 w-16 rounded-xl bg-slate-50 flex flex-col items-center justify-center border border-slate-100 shrink-0 shadow-sm">
                                            <span className="text-[11px] font-bold text-[#0a1e60] leading-none mb-1">
                                                {calculateWorkTime(record.inTime, record.outTime)}
                                            </span>
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Work</span>
                                        </div>

                                        {hasLocation && (
                                            <button
                                                onClick={() => setSelectedLocationRecord(record)}
                                                className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors shadow-sm active:scale-95"
                                            >
                                                <MapPin className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-20 text-slate-400">
                            <Clock className="w-12 h-12 mx-auto mb-4 opacity-10" />
                            <p className="font-medium">No attendance history found.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Filter Sheet */}
            <MobileFilterSheet
                open={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                showDateRange={true}
                currentFilters={{
                    dateRange: {
                        from: dateRange.from,
                        to: dateRange.to
                    }
                }}
                onApply={(filters) => {
                    if (filters.dateRange?.from) {
                        setDateRange({
                            from: startOfDay(filters.dateRange.from),
                            to: filters.dateRange.to ? endOfDay(filters.dateRange.to) : endOfDay(filters.dateRange.from)
                        });
                    }
                    setIsFilterOpen(false);
                }}
                onReset={() => {
                    setDateRange({
                        from: startOfDay(subDays(new Date(), 30)),
                        to: endOfDay(new Date())
                    });
                }}
                title="Filter Attendance"
            />

            {/* Location Map Dialog */}
            <Dialog open={!!selectedLocationRecord} onOpenChange={(open) => !open && setSelectedLocationRecord(null)}>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-slate-50 border-0 rounded-t-[2rem]">
                    <DialogHeader className="p-4 bg-white border-b">
                        <DialogTitle>Recorded Locations</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 space-y-4">
                        {selectedLocationRecord?.inTimeLocation && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    Check In Location ({formatTime(selectedLocationRecord.inTime)})
                                </h4>
                                <div className="h-[200px] rounded-xl overflow-hidden shadow-inner border border-slate-200">
                                    <LocationMap
                                        latitude={selectedLocationRecord.inTimeLocation.latitude}
                                        longitude={selectedLocationRecord.inTimeLocation.longitude}
                                        readOnly={true}
                                        onLocationSelect={() => { }}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 px-1 italic">
                                    {selectedLocationRecord.inTimeLocation.address || 'Address not available'}
                                </p>
                            </div>
                        )}
                        {selectedLocationRecord?.outTimeLocation && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                    Check Out Location ({formatTime(selectedLocationRecord.outTime)})
                                </h4>
                                <div className="h-[200px] rounded-xl overflow-hidden shadow-inner border border-slate-200">
                                    <LocationMap
                                        latitude={selectedLocationRecord.outTimeLocation.latitude}
                                        longitude={selectedLocationRecord.outTimeLocation.longitude}
                                        readOnly={true}
                                        onLocationSelect={() => { }}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 px-1 italic">
                                    {selectedLocationRecord.outTimeLocation.address || 'Address not available'}
                                </p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
