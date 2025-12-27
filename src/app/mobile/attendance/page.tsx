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
    eachDayOfInterval,
    format,
    isSameDay,
    isFriday,
    isBefore,
    isAfter,
    startOfDay
} from 'date-fns';

export default function MobileAttendancePage() {
    const { user } = useAuth();
    const { supervisedEmployeeIds } = useSupervisorCheck(user?.email);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const [attendanceData, setAttendanceData] = useState({
        present: 0,
        delay: 0,
        weekend: 0,
        leave: 0,
        absent: 0
    });
    const [loading, setLoading] = useState(true);

    const fetchWeeklySummary = async () => {
        if (!supervisedEmployeeIds.length) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const today = new Date();
            const start = startOfWeek(today, { weekStartsOn: 6 }); // Week starts on Saturday
            const end = endOfWeek(today, { weekStartsOn: 6 });
            const weekDays = eachDayOfInterval({ start, end });

            // 1. Fetch Attendance Records for the week
            // Firestore 'in' limit is 10. Split if needed. 
            // For simplicity in this iteration, we'll fetch for the first 10 supervised employees.
            // In production, batching logic is needed.
            const employeeIdsToFetch = supervisedEmployeeIds.slice(0, 10);

            // Note: Querying by date range string assuming 'date' field is 'YYYY-MM-DD' or similar sortable string.
            // If date is Timestamp, we need range queries. Assuming 'date' is string 'YYYY-MM-DD' based on typical patterns.
            const startDateStr = format(start, 'yyyy-MM-dd');
            const endDateStr = format(end, 'yyyy-MM-dd');

            const attendanceQuery = query(
                collection(firestore, 'attendance'),
                where('employeeId', 'in', employeeIdsToFetch),
                where('date', '>=', startDateStr),
                where('date', '<=', endDateStr)
            );
            const attendanceSnap = await getDocs(attendanceQuery);
            const attendanceRecords = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

            // 2. Fetch Approved Leave Applications overlapping this week
            const leaveQuery = query(
                collection(firestore, 'leave_applications'),
                where('employeeId', 'in', employeeIdsToFetch),
                where('status', '==', 'Approved')
            );
            const leaveSnap = await getDocs(leaveQuery);
            const leaveApplications = leaveSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

            // 3. Fetch Holidays (Assuming a single document or collection of holidays)
            // Ideally query range, but often holidays are a single doc with an array or small collection.
            // Assuming 'hrm_settings/holiday/items' collection.
            const holidaySnap = await getDocs(collection(firestore, 'hrm_settings/holiday/items'));
            const holidays = holidaySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

            // Calculate Stats
            let present = 0;
            let delay = 0;
            let weekend = 0;
            let leave = 0;
            let absent = 0;

            employeeIdsToFetch.forEach(empId => {
                weekDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');

                    // If day is in future (relative to now), skip counting as absent?
                    // Usually summary includes "so far" or "planned"? 
                    // Let's count up to 'end' but strictly speaking we shouldn't count 'Absent' for tomorrow.
                    // Subordinate summary usually shows historical + today status.
                    if (isAfter(startOfDay(day), startOfDay(today))) {
                        // Future days: Check if approved leave or holiday/weekend exist, otherwise ignore (don't count absent)
                        // But for a weekly chart 100%, we might want to fill it. 
                        // Let's counting everything. If it's future and no leave/holiday, simply don't count it as Absent yet?
                        // Or count as 'Remaining'? 
                        // The prompt asks for Present, Delay, Weekend, Absent, Leave.
                        // We will count future days as 'Absent' only if passed, or maybe just ignore?
                        // Let's ignore future days for "Absent/Present/Delay" counts to avoid skewing data with 0s.
                        // BUT "Weekend" and "Leave" can be known in advance.
                    }

                    // 1. Check Attendance
                    const record = attendanceRecords.find((r: any) => r.employeeId === empId && r.date === dateStr);
                    if (record) {
                        if (record.flag === 'P' || record.flag === 'V') present++;
                        else if (record.flag === 'D') delay++;
                        else if (record.flag === 'L') leave++;
                        else if (record.flag === 'H') weekend++; // Holiday flag in attendance
                        else if (record.flag === 'W') weekend++;
                        else if (record.flag === 'A') absent++;
                        return; // Found record, done for this day
                    }

                    // 2. Check Leave Application
                    const onLeave = leaveApplications.some((app: any) => {
                        return app.employeeId === empId &&
                            dateStr >= app.fromDate && dateStr <= app.toDate;
                    });
                    if (onLeave) {
                        leave++;
                        return;
                    }

                    // 3. Check Holiday/Weekend in Settings
                    // Assuming holiday doc has 'date' or 'startDate'/'endDate'
                    const isHoliday = holidays.some((h: any) => {
                        // Simple check if holiday collection has 'date' field
                        return h.date === dateStr;
                    });
                    // Also check Friday
                    const isWeekend = isFriday(day);

                    if (isHoliday || isWeekend) {
                        weekend++;
                        return;
                    }

                    // 4. Default to Absent if day is <= today
                    if (!isAfter(startOfDay(day), startOfDay(today))) {
                        absent++;
                    }
                });
            });

            setAttendanceData({ present, delay, weekend, leave, absent });

        } catch (error) {
            console.error("Error fetching weekly summary:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWeeklySummary();
    }, [supervisedEmployeeIds]);


    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const audio = new Audio('/sounds/water-drop.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => { });
        } catch (err) {
        }

        await fetchWeeklySummary();
        setIsRefreshing(false);
        setPullDistance(0);
    };

    // Calculate donut chart segments
    const total = attendanceData.present + attendanceData.delay + attendanceData.weekend + attendanceData.leave + attendanceData.absent;
    const safeTotal = total === 0 ? 1 : total; // Prevent division by zero

    const presentAngle = (attendanceData.present / safeTotal) * 360;
    const delayAngle = (attendanceData.delay / safeTotal) * 360;
    const weekendAngle = (attendanceData.weekend / safeTotal) * 360;
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
        { label: 'QR Scan / Face Att.', icon: QrCode, color: 'bg-blue-100', iconColor: 'text-blue-600' },
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
                    {/* Subordinate's Weekly Summary */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-6">Subordinate's Weekly Summary</h2>

                        {loading ? (
                            <div className="flex justify-center py-10">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between mb-6">
                                {/* SVG Donut Chart */}
                                <div className="relative w-48 h-48 flex-shrink-0">
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

                                        {/* Leave segment (cyan) */}
                                        <circle
                                            cx="50"
                                            cy="50"
                                            r={radius}
                                            fill="none"
                                            stroke="#06b6d4"
                                            strokeWidth="15"
                                            strokeDasharray={`${(leaveAngle / 360) * circumference} ${circumference}`}
                                            strokeDashoffset={`-${((presentAngle + delayAngle + weekendAngle) / 360) * circumference}`}
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
                                            strokeDashoffset={`-${((presentAngle + delayAngle + weekendAngle + leaveAngle) / 360) * circumference}`}
                                            className="transition-all duration-500"
                                        />
                                    </svg>

                                    {/* Center text */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <div className="text-3xl font-bold text-emerald-500">{attendanceData.present}</div>
                                        <div className="text-sm font-semibold text-emerald-500">Present</div>
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="space-y-3 flex-1 ml-4">
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
