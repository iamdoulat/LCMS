"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, ChevronLeft, ChevronRight, Cake } from 'lucide-react';
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
                // Fetch user's approved leaves
                if (employeeData?.id) {
                    const leavesQ = query(
                        collection(firestore, 'leave_applications'),
                        where('employeeId', '==', employeeData.id)
                    );
                    const leavesSnapshot = await getDocs(leavesQ);
                    setLeaveApplications(leavesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveApplicationDocument)));
                }

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

    const firstDayOfMonth = getDay(startOfMonth(currentMonth));
    const paddingDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

    const getLeaveStatus = (date: Date) => {
        return leaveApplications.find(leave => {
            const start = parseISO(leave.fromDate);
            const end = parseISO(leave.toDate);
            return isWithinInterval(date, { start, end });
        });
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
                <div className="flex items-center px-4 pt-1 pb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2">Leave Calender</h1>
                </div>
            </div>

            {/* Calendar Container */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain px-5 pt-8 pb-[120px]">
                <div className="bg-white rounded-2xl p-6 shadow-md">
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
                    <div className="grid grid-cols-7 gap-2 mb-3">
                        {weekDays.map((day) => (
                            <div key={day} className="text-center text-xs font-bold text-slate-500">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-2">
                        {/* Padding days */}
                        {paddingDays.map((i) => (
                            <div key={`padding-${i}`} className="aspect-square" />
                        ))}

                        {/* Actual days */}
                        {daysInMonth.map((day) => {
                            const isCurrentDay = isToday(day);
                            const isCurrentMonth = isSameMonth(day, currentMonth);
                            const leave = getLeaveStatus(day);
                            const holiday = getHoliday(day);
                            const birthday = isBirthday(day);

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={cn(
                                        "aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all relative overflow-hidden",
                                        isCurrentMonth
                                            ? isCurrentDay
                                                ? 'bg-blue-500 text-white shadow-md z-10'
                                                : holiday
                                                    ? 'bg-rose-50 text-rose-700 font-bold border border-rose-100'
                                                    : leave
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'text-slate-700 hover:bg-slate-50'
                                            : 'text-slate-300'
                                    )}
                                    onClick={() => {
                                        if (holiday) {
                                            Swal.fire({
                                                title: holiday.name,
                                                text: `${holiday.type} announcement.`,
                                                icon: 'info',
                                                confirmButtonColor: '#3b82f6'
                                            });
                                        }
                                    }}
                                >
                                    <span className="relative z-10">{format(day, 'd')}</span>

                                    <div className="flex gap-0.5 mt-0.5 relative z-10">
                                        {leave && (
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full shadow-sm",
                                                leave.status === 'Approved' ? "bg-emerald-500" : "bg-amber-500"
                                            )} />
                                        )}
                                        {birthday && (
                                            <Cake className={cn("h-3 w-3", isCurrentDay ? "text-white" : "text-pink-500")} />
                                        )}
                                    </div>

                                    {holiday && (
                                        <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-rose-500 rounded-full flex items-center justify-center border border-white z-20">
                                            <span className="text-[8px] text-white font-bold leading-none">H</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-blue-500" />
                            <span className="text-xs text-slate-600 font-medium">Today</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-emerald-500" />
                            <span className="text-xs text-slate-600 font-medium">Leave (Approved)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-amber-500" />
                            <span className="text-xs text-slate-600 font-medium">Leave (Pending)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-rose-50 border border-rose-100" />
                            <span className="text-xs text-slate-600 font-medium">Holiday</span>
                        </div>
                        <div className="flex items-center gap-2 col-span-2">
                            <Cake className="h-4 w-4 text-pink-500" />
                            <span className="text-xs text-slate-600 font-medium">Birthday</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
