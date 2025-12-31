"use client";

import React, { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import {
    CalendarCheck,
    FileText,
    Users,
    Clock,
    QrCode,
    MapPin
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import {
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    format,
    isSameDay,
    isFriday,
    isBefore,
    isAfter,
    startOfDay,
    isWithinInterval,
    parseISO,
    subDays,
    getDaysInMonth
} from 'date-fns';

export default function MobileAttendancePage() {
    const { user } = useAuth();
    const { supervisedEmployees, supervisedEmployeeIds } = useSupervisorCheck(user?.email);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const [attendanceData, setAttendanceData] = useState({
        present: 0,
        delay: 0,
        weekend: 0,
        holiday: 0,
        leave: 0,
        absent: 0
    });
    const [loading, setLoading] = useState(true);
    const [periodFilter, setPeriodFilter] = useState<'weekly' | 'monthly'>('weekly');

    const fetchAttendanceSummary = async (period: 'weekly' | 'monthly' = 'weekly') => {
        if (!supervisedEmployeeIds || supervisedEmployeeIds.length === 0) {
            setAttendanceData({ present: 0, delay: 0, weekend: 0, holiday: 0, leave: 0, absent: 0 });
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const today = new Date();
            let start, end;

            if (period === 'weekly') {
                // Last 7 days including today (today - 6 days to today)
                start = subDays(today, 6);
                end = today;
            } else {
                // Monthly: Use actual days in current month (28-31 days)
                const daysInMonth = getDaysInMonth(today);
                start = subDays(today, daysInMonth - 1);
                end = today;
            }
            const weekDays = eachDayOfInterval({ start, end });

            // 1. Fetch Attendance Records for supervised employees
            // We collect both document IDs and UIDs for each employee for resilient matching
            const allPossibleIds = supervisedEmployees.map(e => [e.id, e.uid]).flat().filter((id): id is string => !!id);

            // Limit to top 30 unique IDs (Firestore limit)
            const uniquePossibleIds = Array.from(new Set(allPossibleIds)).slice(0, 30);

            const startDateStr = format(start, 'yyyy-MM-dd');
            const endDateStr = format(end, 'yyyy-MM-dd');

            // Fetch all attendance records for these IDs
            const attendanceQuery = query(
                collection(firestore, 'attendance'),
                where('employeeId', 'in', uniquePossibleIds)
            );
            const attendanceSnap = await getDocs(attendanceQuery);

            // Filter by date client-side
            const attendanceRecords = attendanceSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .filter((record: any) => {
                    if (!record.date) return false;
                    const rDatePrefix = (typeof record.date === 'string' && record.date.includes('T'))
                        ? record.date.split('T')[0]
                        : record.date;
                    return rDatePrefix >= startDateStr && rDatePrefix <= endDateStr;
                });

            // 2. Fetch Approved Leave Applications
            const leaveQuery = query(
                collection(firestore, 'leave_applications'),
                where('employeeId', 'in', uniquePossibleIds),
                where('status', '==', 'Approved')
            );
            const leaveSnap = await getDocs(leaveQuery);
            const leaveApplications = leaveSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

            // 3. Fetch Holidays
            const holidaySnap = await getDocs(collection(firestore, 'holidays'));
            const holidays = holidaySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

            // Calculate Stats
            let present = 0;
            let delay = 0;
            let weekend = 0;
            let holiday = 0;
            let leave = 0;
            let absent = 0;

            supervisedEmployees.forEach(emp => {
                weekDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');

                    // 1. Check Attendance Record (match by ID or UID)
                    const record = attendanceRecords.find((r: any) => {
                        const rEmployeeId = r.employeeId;
                        const rDateStr = (typeof r.date === 'string' && r.date.includes('T'))
                            ? r.date.split('T')[0]
                            : r.date;

                        return (rEmployeeId === emp.id || (emp.uid && rEmployeeId === emp.uid)) &&
                            rDateStr === dateStr;
                    });
                    if (record) {
                        if (record.flag === 'P' || record.flag === 'V') present++;
                        else if (record.flag === 'D') delay++;
                        else if (record.flag === 'L') leave++;
                        else if (record.flag === 'H') weekend++; // Holiday flag in attendance
                        else if (record.flag === 'W') weekend++;
                        else if (record.flag === 'A') absent++;
                        return; // Found record, done for this day
                    }

                    // 2. Check Leave Application (match by ID or UID)
                    const onLeave = leaveApplications.some((app: any) => {
                        return (app.employeeId === emp.id || (emp.uid && app.employeeId === emp.uid)) &&
                            dateStr >= app.fromDate && dateStr <= app.toDate;
                    });
                    if (onLeave) {
                        leave++;
                        return;
                    }

                    // 3. Check Holiday (separate from weekend)
                    // Holidays use fromDate and toDate (ISO strings)
                    const isHoliday = holidays.some((h: any) => {
                        try {
                            const holidayStart = parseISO(h.fromDate);
                            const holidayEnd = h.toDate ? parseISO(h.toDate) : holidayStart;
                            return isWithinInterval(day, { start: holidayStart, end: holidayEnd });
                        } catch (error) {
                            console.error('Error parsing holiday date:', h, error);
                            return false;
                        }
                    });

                    if (isHoliday) {
                        holiday++;
                        return;
                    }

                    // 4. Check Weekend (only Friday)
                    const isWeekend = isFriday(day);
                    if (isWeekend) {
                        weekend++;
                        return;
                    }

                    // 5. Default to Absent if day is <= today
                    if (!isAfter(startOfDay(day), startOfDay(today))) {
                        absent++;
                    }
                });
            });

            setAttendanceData({ present, delay, weekend, holiday, leave, absent });

        } catch (error) {
            console.error("[ATTENDANCE] Error fetching attendance summary:", error);
            setAttendanceData({ present: 0, delay: 0, weekend: 0, holiday: 0, leave: 0, absent: 0 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (supervisedEmployeeIds && supervisedEmployeeIds.length > 0) {
            fetchAttendanceSummary(periodFilter);
        } else {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supervisedEmployeeIds.length, periodFilter]);


    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const audio = new Audio('/sounds/water-drop.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => { });
        } catch (err) {
        }

        await fetchAttendanceSummary(periodFilter);
        setIsRefreshing(false);
        setPullDistance(0);
    };

    // Calculate donut chart segments
    const total = attendanceData.present + attendanceData.delay + attendanceData.weekend + attendanceData.holiday + attendanceData.leave + attendanceData.absent;
    const safeTotal = total === 0 ? 1 : total; // Prevent division by zero

    const presentAngle = (attendanceData.present / safeTotal) * 360;
    const delayAngle = (attendanceData.delay / safeTotal) * 360;
    const weekendAngle = (attendanceData.weekend / safeTotal) * 360;
    const holidayAngle = (attendanceData.holiday / safeTotal) * 360;
    const leaveAngle = (attendanceData.leave / safeTotal) * 360;
    const absentAngle = (attendanceData.absent / safeTotal) * 360;

    // Helper to create strokeDasharray/offset
    // We stack them: Present -> Delay -> Weekend -> Leave -> Absent
    const radius = 35;
    const circumference = 2 * Math.PI * radius; // ~220

    const attendanceActions = [
        { label: 'My Attendance', icon: CalendarCheck, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/attendance/my-attendance' },
        { label: 'View Attendance', icon: FileText, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/attendance/team-attendance' },
        { label: 'Recon. Application', icon: FileText, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/attendance/reconciliation/my-applications' },
        { label: 'Recon. Approval', icon: Users, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/attendance/reconciliation/approval' },
        { label: 'Remote Att. Approval', icon: MapPin, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/attendance/remote-approval' },
        { label: 'QR Scan / Face Att.', icon: QrCode, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/qrcode' },
    ];

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <MobileHeader />
            </div>

            <div
                ref={containerRef}
                className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto overscroll-contain relative transition-transform duration-200 ease-out"
                style={{
                    transform: `translateY(${isRefreshing ? 60 : pullDistance > 0 ? pullDistance * 0.4 : 0}px)`,
                    backgroundColor: '#f8fafc'
                }}
                onTouchStart={(e) => {
                    const scrollTop = containerRef.current?.scrollTop ?? 0;
                    if (scrollTop === 0 && !isRefreshing) {
                        const startY = e.touches[0].clientY;

                        const handleTouchMove = (moveEvent: TouchEvent) => {
                            const currentY = moveEvent.touches[0].clientY;
                            const diff = currentY - startY;

                            if (diff > 0 && (containerRef.current?.scrollTop ?? 0) === 0) {
                                moveEvent.preventDefault();
                                setPullDistance(diff);
                            }
                        };

                        const handleTouchEnd = () => {
                            setPullDistance(current => {
                                if (current > 80) {
                                    handleRefresh();
                                    return 80;
                                }
                                return 0;
                            });
                            document.removeEventListener('touchmove', handleTouchMove);
                            document.removeEventListener('touchend', handleTouchEnd);
                        };

                        document.addEventListener('touchmove', handleTouchMove, { passive: false });
                        document.addEventListener('touchend', handleTouchEnd, { once: true });
                    }
                }}
            >
                {/* Pull to refresh indicator - Absolute positioned above content */}
                <div className="absolute left-0 right-0 -top-12 flex justify-center py-2 z-10">
                    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 ${isRefreshing || pullDistance > 40 ? 'opacity-100' : 'opacity-0'}`}></div>
                </div>

                <div className="px-6 pt-6 pb-24 space-y-6">
                    {/* Subordinate's Summary with Period Filter */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-slate-800">
                                Subordinate's {periodFilter === 'weekly' ? 'Weekly' : 'Monthly'} Summary
                            </h2>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPeriodFilter('weekly')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${periodFilter === 'weekly'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    Weekly
                                </button>
                                <button
                                    onClick={() => setPeriodFilter('monthly')}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${periodFilter === 'monthly'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    Monthly
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-10">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                            </div>
                        ) : supervisedEmployeeIds.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <Users className="h-16 w-16 text-slate-300 mb-3" />
                                <p className="text-slate-500 font-medium">No Subordinates Found</p>
                                <p className="text-sm text-slate-400 mt-1">You don't have any subordinates to supervise</p>
                            </div>
                        ) : total === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <Clock className="h-16 w-16 text-slate-300 mb-3" />
                                <p className="text-slate-500 font-medium">No Attendance Data</p>
                                <p className="text-sm text-slate-400 mt-1">No attendance records found for this week</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* SVG Donut Chart - Centered */}
                                <div className="flex justify-center">
                                    <div className="relative w-48 h-48">
                                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                            {/* Background circle */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r={radius}
                                                fill="none"
                                                stroke="#f1f5f9"
                                                strokeWidth="15"
                                            />

                                            {/* Present segment (green) */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r={radius}
                                                fill="none"
                                                stroke="#10b981"
                                                strokeWidth="15"
                                                strokeDasharray={`${(presentAngle / 360) * circumference} ${circumference}`}
                                                strokeDashoffset="0"
                                                className="transition-all duration-500"
                                            />

                                            {/* Delay segment (yellow) */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r={radius}
                                                fill="none"
                                                stroke="#fbbf24"
                                                strokeWidth="15"
                                                strokeDasharray={`${(delayAngle / 360) * circumference} ${circumference}`}
                                                strokeDashoffset={`-${(presentAngle / 360) * circumference}`}
                                                className="transition-all duration-500"
                                            />

                                            {/* Weekend segment (purple) */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r={radius}
                                                fill="none"
                                                stroke="#a78bfa"
                                                strokeWidth="15"
                                                strokeDasharray={`${(weekendAngle / 360) * circumference} ${circumference}`}
                                                strokeDashoffset={`-${((presentAngle + delayAngle) / 360) * circumference}`}
                                                className="transition-all duration-500"
                                            />

                                            {/* Holiday segment (pink) */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r={radius}
                                                fill="none"
                                                stroke="#ec4899"
                                                strokeWidth="15"
                                                strokeDasharray={`${(holidayAngle / 360) * circumference} ${circumference}`}
                                                strokeDashoffset={`-${((presentAngle + delayAngle + weekendAngle) / 360) * circumference}`}
                                                className="transition-all duration-500"
                                            />

                                            {/* Leave segment (cyan) */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r={radius}
                                                fill="none"
                                                stroke="#06b6d4"
                                                strokeWidth="15"
                                                strokeDasharray={`${(leaveAngle / 360) * circumference} ${circumference}`}
                                                strokeDashoffset={`-${((presentAngle + delayAngle + weekendAngle + holidayAngle) / 360) * circumference}`}
                                                className="transition-all duration-500"
                                            />

                                            {/* Absent segment (red) */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r={radius}
                                                fill="none"
                                                stroke="#ef4444"
                                                strokeWidth="15"
                                                strokeDasharray={`${(absentAngle / 360) * circumference} ${circumference}`}
                                                strokeDashoffset={`-${((presentAngle + delayAngle + weekendAngle + holidayAngle + leaveAngle) / 360) * circumference}`}
                                                className="transition-all duration-500"
                                            />
                                        </svg>

                                        {/* Center text */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <div className="text-3xl font-bold text-emerald-500">{attendanceData.present}</div>
                                            <div className="text-sm font-semibold text-emerald-500">Present</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Legend - Left aligned below chart */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                            <span className="text-sm font-medium text-slate-700">Present</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">{attendanceData.present}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                            <span className="text-sm font-medium text-slate-700">Delay</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">{attendanceData.delay}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-violet-400"></div>
                                            <span className="text-sm font-medium text-slate-700">Weekend</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">{attendanceData.weekend}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-pink-500"></div>
                                            <span className="text-sm font-medium text-slate-700">Holiday</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">{attendanceData.holiday}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                                            <span className="text-sm font-medium text-slate-700">Leave</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">{attendanceData.leave}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                            <span className="text-sm font-medium text-slate-700">Absent</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">{attendanceData.absent}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Attendance Actions */}
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Attendance</h2>
                        <div className="grid grid-cols-3 gap-4">
                            {attendanceActions.map((action, index) => {
                                const Icon = action.icon;
                                const Component = action.href ? 'a' : 'button';
                                return (
                                    <Component
                                        key={index}
                                        href={action.href}
                                        className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] hover:shadow-md transition-shadow active:scale-95 duration-200"
                                    >
                                        <div className={`${action.color} p-4 rounded-full ${action.iconColor} h-14 w-14 flex items-center justify-center`}>
                                            <Icon className="h-7 w-7" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 text-center leading-tight">
                                            {action.label}
                                        </span>
                                    </Component>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
