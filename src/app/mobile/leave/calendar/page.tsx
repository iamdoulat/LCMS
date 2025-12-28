"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
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
    parseISO
} from 'date-fns';
import type { LeaveApplicationDocument, EmployeeDocument } from '@/types';
import { cn } from '@/lib/utils';

export default function LeaveCalendarPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [employeeData, setEmployeeData] = useState<EmployeeDocument | null>(null);
    const [leaveApplications, setLeaveApplications] = useState<LeaveApplicationDocument[]>([]);

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
        const fetchLeaves = async () => {
            if (!employeeData?.id) return;

            setLoading(true);
            try {
                const q = query(
                    collection(firestore, 'leave_applications'),
                    where('employeeId', '==', employeeData.id),
                    where('status', '==', 'Approved')
                );
                const snapshot = await getDocs(q);
                const leaves = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as LeaveApplicationDocument[];

                setLeaveApplications(leaves);
            } catch (error) {
                console.error("Error fetching leave applications:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaves();
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

    const isDateOnLeave = (date: Date) => {
        return leaveApplications.some(leave => {
            const start = parseISO(leave.fromDate);
            const end = parseISO(leave.toDate);
            return date >= start && date <= end;
        });
    };

    const weekDays = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 pt-1 pb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full active:bg-white/10 transition-colors text-white"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2">Leave Calender</h1>
                </div>
            </div>

            {/* Calendar Container */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain px-5 pt-8">
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={goToPreviousMonth}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <h2 className="text-lg font-bold text-blue-600">
                            {format(currentMonth, 'MMM yyyy')}
                        </h2>
                        <button
                            onClick={goToNextMonth}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-100 transition-colors"
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
                            const onLeave = isDateOnLeave(day);

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={cn(
                                        "aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all relative",
                                        isCurrentMonth
                                            ? isCurrentDay
                                                ? 'bg-blue-500 text-white shadow-md'
                                                : onLeave
                                                    ? 'bg-emerald-100 text-emerald-700 font-bold'
                                                    : 'text-slate-700 hover:bg-slate-50'
                                            : 'text-slate-300'
                                    )}
                                >
                                    {format(day, 'd')}
                                    {onLeave && !isCurrentDay && (
                                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-6 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-blue-500" />
                            <span className="text-xs text-slate-600">Today</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200" />
                            <span className="text-xs text-slate-600">On Leave</span>
                        </div>
                    </div>
                </div>
                {/* Spacer bottom */}
                <div className="h-24" />
            </div>
        </div>
    );
}
