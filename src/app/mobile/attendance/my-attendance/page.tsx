"use client";

import React, { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { format, parseISO, startOfDay, endOfDay, parse, eachDayOfInterval, isWithinInterval, subDays, getDay, isToday } from 'date-fns';
import { Edit2, Clock, Coffee, AlertCircle, ArrowLeft, Filter as FilterIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { MobileFilterSheet, hasActiveFilters, type FilterState } from '@/components/mobile/MobileFilterSheet';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

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
    const [holidays, setHolidays] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Filter State
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState<FilterState>({});

    // Load from cache on mount
    useEffect(() => {
        const cachedAttendance = localStorage.getItem('myAttendanceRecords');
        const cachedBreaks = localStorage.getItem('myBreakRecords');
        if (cachedAttendance) {
            try { setAttendanceRecords(JSON.parse(cachedAttendance)); } catch (e) { }
        }
        if (cachedBreaks) {
            try { setBreakRecords(JSON.parse(cachedBreaks)); } catch (e) { }
        }
        if (cachedAttendance || cachedBreaks) {
            setLoading(false);
        }
    }, []);

    const fetchAttendance = async () => {
        const queryIds = [currentEmployeeId, user?.uid].filter((id): id is string => !!id);
        if (queryIds.length === 0) return;

        setLoading(true);
        try {
            // Use 'in' operator to pick up records saved under either UID or doc ID
            let q = query(
                collection(firestore, 'attendance'),
                where('employeeId', 'in', queryIds)
            );

            // Date Range Filter
            if (filters.dateRange?.from) {
                // Assuming date is stored as YYYY-MM-DD string
                const fromStr = format(filters.dateRange.from, 'yyyy-MM-dd');
                q = query(q, where('date', '>=', fromStr));

                if (filters.dateRange.to) {
                    const toStr = format(filters.dateRange.to, 'yyyy-MM-dd');
                    q = query(q, where('date', '<=', toStr));
                }
            }

            const snapshot = await getDocs(q);
            const rawData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));

            // Determine date range for filling gaps
            let startDate: Date;
            let endDate: Date;

            if (filters.dateRange?.from) {
                startDate = startOfDay(filters.dateRange.from);
                endDate = startOfDay(filters.dateRange.to || filters.dateRange.from);
            } else {
                // Default to last 30 days if no filter
                endDate = startOfDay(new Date());
                startDate = startOfDay(subDays(endDate, 29));
            }

            // Generate all dates in interval
            const daysInInterval = eachDayOfInterval({ start: startDate, end: endDate });

            // Merge raw data with synthesized records for missing days
            const fullRecords: AttendanceRecord[] = daysInInterval.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                // Try to find existing record. Firestore date field might be ISO or YYYY-MM-DD
                const existing = rawData.find(r => r.date && r.date.startsWith(dateStr));

                if (existing) return existing;

                // Synthesize record for gap
                const dayOfWeek = getDay(day);
                let flag = 'A'; // Default to Absent

                // Check Weekend (Friday = 5)
                if (dayOfWeek === 5) {
                    flag = 'W';
                } else {
                    // Check Holiday
                    const holiday = holidays.find(h => isWithinInterval(day, {
                        start: parseISO(h.fromDate),
                        end: parseISO(h.toDate || h.fromDate)
                    }));
                    if (holiday) {
                        flag = 'H';
                    } else {
                        // Check Leave
                        const leave = leaves.find(l => isWithinInterval(day, {
                            start: parseISO(l.fromDate),
                            end: parseISO(l.toDate)
                        }));
                        if (leave) {
                            flag = 'L';
                        } else {
                            // Check Visit
                            const visit = visits.find(v => isWithinInterval(day, {
                                start: parseISO(v.fromDate),
                                end: parseISO(v.toDate)
                            }));
                            if (visit) flag = 'V';
                        }
                    }
                }

                // If it's a future date, don't mark as Absent
                const isFuture = day > endOfDay(new Date());
                if (isFuture && flag === 'A') {
                    flag = '';
                }

                return {
                    id: `synth-${dateStr}`,
                    date: dateStr,
                    flag: flag
                } as AttendanceRecord;
            });

            // Sort by date desc
            fullRecords.sort((a, b) => {
                return b.date.localeCompare(a.date);
            });

            setAttendanceRecords(fullRecords);
            // Only update cache if no range filter to avoid polluting recent view
            if (!filters.dateRange?.from) {
                localStorage.setItem('myAttendanceRecords', JSON.stringify(fullRecords));
            }
        } catch (error) {
            console.error("Error fetching attendance:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSupportiveData = async () => {
        if (!currentEmployeeId) return;
        try {
            // Fetch holidays
            const holidaysSnapshot = await getDocs(collection(firestore, 'holidays'));
            setHolidays(holidaysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // Fetch approved leaves
            const leavesQ = query(
                collection(firestore, 'leave_applications'),
                where('employeeId', '==', currentEmployeeId),
                where('status', '==', 'Approved')
            );
            const leavesSnapshot = await getDocs(leavesQ);
            setLeaves(leavesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // Fetch approved visits
            const visitsQ = query(
                collection(firestore, 'visit_applications'),
                where('employeeId', '==', currentEmployeeId),
                where('status', '==', 'Approved')
            );
            const visitsSnapshot = await getDocs(visitsQ);
            setVisits(visitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error fetching supportive data:", error);
        }
    };

    useEffect(() => {
        if (currentEmployeeId) {
            fetchSupportiveData();
        }
    }, [currentEmployeeId]);

    const fetchBreaks = async () => {
        const queryIds = [currentEmployeeId, user?.uid].filter((id): id is string => !!id);
        if (queryIds.length === 0) return;

        setLoading(true);
        try {
            // Fetch records for employee using 'in' operator for resilience
            // Fetch records for employee using 'in' operator for resilience
            let q = query(
                collection(firestore, 'break_time'),
                where('employeeId', 'in', queryIds)
            );

            // Date Range Filter (Assuming break records also have 'date' field YYYY-MM-DD or similar logic)
            if (filters.dateRange?.from) {
                const fromStr = format(filters.dateRange.from, 'yyyy-MM-dd');
                q = query(q, where('date', '>=', fromStr));

                if (filters.dateRange.to) {
                    const toStr = format(filters.dateRange.to, 'yyyy-MM-dd');
                    q = query(q, where('date', '<=', toStr));
                }
            }

            // Status Filter
            if (filters.status && filters.status !== 'All') {
                if (Array.isArray(filters.status)) {
                    q = query(q, where('status', 'in', filters.status));
                } else {
                    q = query(q, where('status', '==', filters.status));
                }
            }

            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BreakRecord));

            // Sort by startTime desc
            data.sort((a, b) => {
                const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
                const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
                return timeB - timeA;
            });

            // data.sort((a, b)...
            setBreakRecords(data.slice(0, 30));
            // Update cache
            if (!filters.dateRange?.from && (!filters.status || filters.status === 'All')) {
                localStorage.setItem('myBreakRecords', JSON.stringify(data.slice(0, 30)));
            }
        } catch (error) {
            console.error("Error fetching breaks:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Trigger fetch as soon as we have at least one identifier (user.uid or employeeId)
        if (user?.uid || currentEmployeeId) {
            if (activeTab === 'attendance') fetchAttendance();
            else fetchBreaks();
        }
    }, [user?.uid, currentEmployeeId, activeTab, filters, holidays.length, leaves.length, visits.length]);

    const refreshData = async () => {
        if (currentEmployeeId) {
            await Promise.all([fetchAttendance(), fetchBreaks(), fetchSupportiveData()]);
        }
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

        if (isLeftSwipe && activeTab === 'attendance') {
            setActiveTab('break');
        }
        if (isRightSwipe && activeTab === 'break') {
            setActiveTab('attendance');
        }
    };

    const containerRef = usePullToRefresh(refreshData);

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
            case 'V': return 'text-orange-500 bg-orange-50';
            case 'A': return 'text-red-500 bg-red-50';
            default: return 'text-slate-500 bg-slate-50';
        }
    };

    const calculateWorkTime = (inTime?: string, outTime?: string) => {
        if (!inTime || !outTime) return '-';
        try {
            // Parse times like "09:04 AM" and "12:10 PM"
            const inDate = parse(inTime, 'hh:mm a', new Date());
            const outDate = parse(outTime, 'hh:mm a', new Date());

            const diffMs = outDate.getTime() - inDate.getTime();
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

            return `${hours}h ${minutes}m`;
        } catch (e) {
            return '-';
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
                            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white ml-2">My Attendance</h1>
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

            <div
                ref={containerRef}
                className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto overscroll-contain flex flex-col"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
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
                <div className="flex-1 px-[5px] pt-4 pb-[120px] space-y-4">
                    {(loading && attendanceRecords.length === 0 && breakRecords.length === 0) ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="bg-white rounded-xl px-3 py-2.5 shadow-sm border border-slate-100 flex items-center gap-3 animate-pulse">
                                    <div className="w-1 h-10 rounded-full bg-slate-200 shrink-0"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 bg-slate-100 rounded w-1/3"></div>
                                        <div className="h-3 bg-slate-50 rounded w-1/2"></div>
                                    </div>
                                    <div className="h-10 w-16 bg-slate-50 rounded-lg"></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        activeTab === 'attendance' ? (
                            attendanceRecords.length > 0 ? (
                                attendanceRecords.map((record) => {
                                    const dateInfo = formatDate(record.date);
                                    return (
                                        <div key={record.id} className="bg-white rounded-xl px-3 py-2.5 shadow-sm border border-slate-100 flex items-center gap-3 active:scale-[0.98] transition-all">
                                            <div className={cn("w-1 h-10 rounded-full shrink-0",
                                                record.flag === 'P' ? 'bg-emerald-400' :
                                                    record.flag === 'D' ? 'bg-yellow-400' :
                                                        record.flag === 'W' ? 'bg-violet-400' :
                                                            record.flag === 'H' ? 'bg-pink-400' :
                                                                record.flag === 'L' ? 'bg-cyan-400' :
                                                                    record.flag === 'V' ? 'bg-orange-400' :
                                                                        record.flag === 'A' ? 'bg-red-400' :
                                                                            'bg-slate-300'
                                            )}></div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[11px] font-bold text-slate-900">{dateInfo.full}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">({dateInfo.day})</span>
                                                    {record.flag && (
                                                        <span className={cn("ml-auto px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shadow-[0_2px_4px_rgba(0,0,0,0.1)] border border-white/20", getFlagColor(record.flag))}>
                                                            {record.flag}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-4 text-slate-600">
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3 text-blue-500" />
                                                        <span className="text-[10px] font-bold"><span className="text-slate-400 mr-1">IN</span>{formatTime(record.inTime)}</span>
                                                    </div>
                                                    <div className="w-px h-3 bg-slate-200"></div>
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3 text-indigo-500" />
                                                        <span className="text-[10px] font-bold"><span className="text-slate-400 mr-1">OUT</span>{formatTime(record.outTime)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-10 w-16 rounded-lg bg-slate-50 flex flex-col items-center justify-center border border-slate-100 shrink-0 shadow-[0_3px_8px_rgba(0,0,0,0.1)]">
                                                <span className="text-[10px] font-bold text-[#0a1e60] leading-none mb-0.5">{calculateWorkTime(record.inTime, record.outTime)}</span>
                                                <span className="text-[7px] font-bold text-slate-400 uppercase leading-none">Work</span>
                                            </div>

                                            <Link
                                                href={`/mobile/attendance/reconciliation?date=${record.date}&employeeId=${currentEmployeeId}`}
                                                className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-[0_3px_8px_rgba(5,150,105,0.4)] shrink-0 active:scale-90 transition-transform"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
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
                                    <div key={record.id} className="bg-white rounded-xl px-3 py-2.5 shadow-sm border border-slate-100 flex items-center gap-3 active:scale-[0.98] transition-all">
                                        <div className={cn("w-1 h-10 rounded-full shrink-0",
                                            record.status === 'approved' || record.status === 'auto-approved' ? 'bg-emerald-400' :
                                                record.status === 'rejected' ? 'bg-red-400' : 'bg-orange-400'
                                        )}></div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[11px] font-bold text-slate-900">{formatDate(record.date).full}</span>
                                                <div className={cn("px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shadow-[0_2px_4px_rgba(0,0,0,0.1)] border border-white/20",
                                                    record.status === 'approved' || record.status === 'auto-approved' ? 'bg-green-500 text-white' :
                                                        record.status === 'rejected' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                                                )}>
                                                    {record.status}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-slate-600">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3 text-indigo-500" />
                                                    <span className="text-[10px] font-bold"><span className="text-slate-400 mr-1">START</span>{formatTime(record.startTime)}</span>
                                                </div>
                                                <div className="w-px h-3 bg-slate-200"></div>
                                                <div className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3 text-rose-500" />
                                                    <span className="text-[10px] font-bold"><span className="text-slate-400 mr-1">END</span>{formatTime(record.endTime)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {record.durationMinutes && (
                                            <div className="h-8 w-8 rounded-lg bg-slate-50 flex flex-col items-center justify-center border border-slate-100 shrink-0">
                                                <span className="text-[10px] font-bold text-[#0a1e60] leading-none mb-0.5">{record.durationMinutes}</span>
                                                <span className="text-[7px] font-bold text-slate-400 uppercase leading-none">Min</span>
                                            </div>
                                        )}
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

            {/* Filter Sheet */}
            <MobileFilterSheet
                open={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                onApply={setFilters}
                onReset={() => setFilters({})}
                showDateRange={true}
                showStatus={activeTab === 'break'}
                statusOptions={['pending', 'approved', 'rejected']}
                currentFilters={filters}
            />
        </div>
    );
}
