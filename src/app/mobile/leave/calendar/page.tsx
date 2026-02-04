"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, ChevronLeft, ChevronRight, Cake, Circle } from 'lucide-react';
import Swal from 'sweetalert2';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isToday,
    getDay,
    addMonths,
    subMonths,
    isSameDay,
    parseISO,
    isWithinInterval
} from 'date-fns';
import type { LeaveApplicationDocument, EmployeeDocument, HolidayDocument } from '@/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function LeaveCalendarPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [employeeData, setEmployeeData] = useState<EmployeeDocument | null>(null);
    const [leaveApplications, setLeaveApplications] = useState<LeaveApplicationDocument[]>([]);
    const [holidays, setHolidays] = useState<HolidayDocument[]>([]);
    const [allEmployees, setAllEmployees] = useState<EmployeeDocument[]>([]);

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
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch all approved leaves
                const leavesQ = query(
                    collection(firestore, 'leave_applications'),
                    where('status', 'in', ['Approved', 'Pending'])
                );
                const leavesSnapshot = await getDocs(leavesQ);
                setLeaveApplications(leavesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveApplicationDocument)));

                // Fetch holidays
                const holidaysSnapshot = await getDocs(collection(firestore, 'holidays'));
                setHolidays(holidaysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HolidayDocument)));

                // Fetch birthdays (all active employees)
                const employeesQ = query(collection(firestore, 'employees'), where('status', '!=', 'Terminated'));
                const employeesSnapshot = await getDocs(employeesQ);
                setAllEmployees(employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmployeeDocument)));

            } catch (error) {
                console.error("Error fetching calendar data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [employeeData?.id]);


    const goToPreviousMonth = () => {
        setCurrentMonth(prev => subMonths(prev, 1));
    };

    const goToNextMonth = () => {
        setCurrentMonth(prev => addMonths(prev, 1));
    };

    const daysInMonth = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth)
    });
    // Explicitly handle week starting on Saturday (6)
    // 0(Sun) -> 1, 1(Mon) -> 2, ..., 5(Fri) -> 6, 6(Sat) -> 0
    const startDayIndex = getDay(startOfMonth(currentMonth));
    const firstDayOfMonth = startDayIndex === 6 ? 0 : startDayIndex + 1;

    console.log('Calendar Month:', format(currentMonth, 'yyyy-MM'), 'Start Day Index:', startDayIndex, 'Offset:', firstDayOfMonth);

    const paddingDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

    const getDayLeaves = (date: Date) => {
        return leaveApplications.filter(leave => {
            try {
                const start = parseISO(leave.fromDate);
                const end = parseISO(leave.toDate);
                return isWithinInterval(date, { start, end });
            } catch { return false; }
        }).map(leave => ({
            ...leave,
            employee: allEmployees.find(emp => emp.id === leave.employeeId)
        }));
    };

    const getInitials = (name?: string) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const isBirthday = (date: Date) => {
        return allEmployees.some(emp => {
            if (!emp.dateOfBirth) return false;
            try {
                const dob = parseISO(emp.dateOfBirth);
                return format(dob, 'MM-dd') === format(date, 'MM-dd');
            } catch { return false; }
        });
    };

    const getHoliday = (date: Date) => {
        return holidays.find(h => isWithinInterval(date, {
            start: parseISO(h.fromDate),
            end: parseISO(h.toDate || h.fromDate)
        }));
    };

    const weekDays = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2">Leave Calendar</h1>
                </div>
            </div>

            {/* Calendar Container */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain px-5 pt-8 pb-[120px]">
                <div className="bg-white rounded-2xl p-3 shadow-md">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={goToPreviousMonth}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shadow-[0_4px_12px_rgba(37,99,235,0.2)] border border-blue-100"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <h2 className="text-lg font-bold text-blue-600">
                            {format(currentMonth, 'MMM yyyy')}
                        </h2>
                        <button
                            onClick={goToNextMonth}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shadow-[0_4px_12px_rgba(37,99,235,0.2)] border border-blue-100"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Week Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {weekDays.map((day) => (
                            <div key={day} className="text-center text-xs font-bold text-slate-500">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Padding days */}
                        {paddingDays.map((i) => (
                            <div key={`padding-${i}`} className="aspect-square" />
                        ))}

                        {/* Actual days */}
                        {daysInMonth.map((day) => {
                            const isCurrentDay = isToday(day);
                            const isCurrentMonth = isSameMonth(day, currentMonth);
                            const dayLeaves = getDayLeaves(day);
                            const holiday = getHoliday(day);
                            const birthday = isBirthday(day);
                            const isWeekend = getDay(day) === 5; // Friday

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={cn(
                                        "aspect-square flex flex-col items-center justify-start py-1 rounded-lg text-sm font-medium transition-all relative overflow-hidden min-h-[50px]",
                                        isCurrentMonth
                                            ? isCurrentDay
                                                ? 'bg-blue-50/50 border-2 border-blue-500 shadow-sm z-10'
                                                : holiday
                                                    ? 'bg-rose-100 text-rose-700 font-bold border border-rose-200'
                                                    : dayLeaves.length > 0
                                                        ? dayLeaves.every(l => l.status === 'Approved')
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                                                        : isWeekend
                                                            ? 'text-rose-500 bg-rose-100 border border-rose-200'
                                                            : 'text-slate-700 bg-white border border-slate-100 hover:bg-slate-50'
                                            : 'text-slate-300'
                                    )}
                                    onClick={() => {
                                        let content = '';

                                        if (holiday) {
                                            content += `<div class="mb-4 text-left p-3 bg-rose-50 rounded-lg border border-rose-100">
                                                <div class="font-bold text-rose-700 flex items-center gap-2">
                                                    <span class="bg-rose-500 text-white px-1.5 py-0.5 rounded text-[10px]">H</span>
                                                    ${holiday.name}
                                                </div>
                                                <div class="text-xs text-rose-600 mt-1">${holiday.type} announcement</div>
                                            </div>`;
                                        }

                                        if (dayLeaves.length > 0) {
                                            content += `<div class="text-left p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                                <div class="font-bold text-emerald-700 mb-2">Employees on Leave</div>
                                                <div class="space-y-2">
                                                    ${dayLeaves.map(l => `
                                                        <div class="text-xs flex items-center gap-2 p-1.5 bg-white/50 rounded">
                                                            <div class="w-2 h-2 rounded-full ${l.status === 'Approved' ? 'bg-emerald-500' : 'bg-amber-500'}"></div>
                                                            <span class="font-semibold text-slate-800">${l.employee?.fullName || 'Unknown'}</span>
                                                            <span class="text-[10px] text-slate-500 ml-auto">(${l.status})</span>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>`;
                                        }

                                        if (birthday) {
                                            const birthdayEmployees = allEmployees.filter(emp => {
                                                if (!emp.dateOfBirth) return false;
                                                try {
                                                    const dob = parseISO(emp.dateOfBirth);
                                                    return format(dob, 'MM-dd') === format(day, 'MM-dd');
                                                } catch { return false; }
                                            });

                                            if (birthdayEmployees.length > 0) {
                                                content += `<div class="mt-4 text-left p-3 bg-pink-50 rounded-lg border border-pink-100">
                                                    <div class="font-bold text-pink-700 flex items-center gap-2 mb-2">
                                                        <span class="text-lg">🎂</span> Birthdays
                                                    </div>
                                                    <div class="space-y-1">
                                                        ${birthdayEmployees.map(e => `<div class="text-xs text-pink-600 font-medium">${e.fullName}</div>`).join('')}
                                                    </div>
                                                </div>`;
                                            }
                                        }

                                        if (content) {
                                            Swal.fire({
                                                title: format(day, 'PPPP'),
                                                html: `<div class="mt-2">${content}</div>`,
                                                showConfirmButton: false,
                                                showCloseButton: true,
                                                customClass: {
                                                    popup: 'rounded-2xl',
                                                    title: 'text-lg font-bold text-blue-600 border-b pb-3 pt-4'
                                                }
                                            });
                                        }
                                    }}
                                >
                                    <div className="flex justify-between items-center w-full px-1">
                                        <span className={cn("relative z-10 text-[11px]", isCurrentDay ? "text-blue-600 font-bold" : "")}>{format(day, 'd')}</span>
                                        {holiday ? (
                                            <span className="bg-rose-500 text-white text-[8px] px-1 rounded font-bold">H</span>
                                        ) : isWeekend ? (
                                            <span className="bg-rose-400 text-white text-[8px] px-1 rounded font-bold">W</span>
                                        ) : null}
                                    </div>

                                    <div className="flex flex-wrap gap-0.5 mt-1 justify-center px-0.5 pb-1 relative z-10">
                                        {dayLeaves.slice(0, 2).map((leave, idx) => (
                                            <div key={`leave-${idx}`} className="relative">
                                                <Avatar className="h-5 w-5 border border-white shadow-sm">
                                                    <AvatarImage
                                                        src={leave.employee?.photoURL || ''}
                                                        alt={leave.employee?.fullName}
                                                        className="object-cover"
                                                    />
                                                    <AvatarFallback className="text-[7px] bg-emerald-100 text-emerald-700 font-bold uppercase">
                                                        {getInitials(leave.employee?.fullName)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className={cn(
                                                    "absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-white",
                                                    leave.status === 'Approved' ? "bg-emerald-500" : "bg-amber-500"
                                                )} />
                                            </div>
                                        ))}
                                        {dayLeaves.length > 2 && (
                                            <div className="text-[8px] text-slate-500 font-bold flex items-center">+{dayLeaves.length - 2}</div>
                                        )}
                                        {birthday && dayLeaves.length === 0 && (
                                            <Cake className={cn("h-3 w-3", isCurrentDay ? "text-blue-500" : "text-pink-500")} />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-blue-500" />
                            <span className="text-xs text-blue-600 font-medium">Today</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-emerald-500" />
                            <span className="text-xs text-emerald-600 font-medium">Leave (Approved)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-amber-500" />
                            <span className="text-xs text-amber-600 font-medium">Leave (Pending)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative w-4 h-4 rounded bg-rose-100 flex items-center justify-center border border-rose-200">
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full flex items-center justify-center border border-white">
                                    <span className="text-[5px] text-white font-bold leading-none">H</span>
                                </div>
                            </div>
                            <span className="text-xs text-rose-600 font-medium">Holiday</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Cake className="h-4 w-4 text-pink-500" />
                            <span className="text-xs text-pink-500 font-medium">Birthday</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative w-4 h-4 rounded bg-rose-100 flex items-center justify-center border border-rose-200">
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-400 rounded-full flex items-center justify-center border border-white">
                                    <span className="text-[5px] text-white font-bold leading-none">W</span>
                                </div>
                            </div>
                            <span className="text-xs text-rose-500 font-medium">Weekend</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
