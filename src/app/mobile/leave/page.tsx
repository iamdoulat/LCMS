"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import {
    Calendar as CalendarIcon,
    Users,
    FileText,
    MapPin,
    ChevronLeft,
    ChevronRight,
    CheckCircle,
    Cake
} from 'lucide-react';
import {
    format, isWithinInterval, parseISO, getMonth, getYear, getDaysInMonth, getDay,
    startOfMonth, isToday as isTodayFn
} from 'date-fns';
import { collection, query, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import type { LeaveApplicationDocument, VisitApplicationDocument, EmployeeDocument, HolidayDocument } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

interface LeaveAction {
    label: string;
    icon: any;
    color: string;
    iconColor: string;
    href?: string;
}

export default function MobileLeavePage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const monthName = format(currentDate, 'MMM yyyy');
    const year = getYear(currentDate);
    const month = getMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    const startDayIndex = getDay(startOfMonth(currentDate));
    const firstDayOfMonth = startDayIndex === 6 ? 0 : startDayIndex + 1;

    // Fetch data from Firestore using the hook
    const { data: employees } = useFirestoreQuery<EmployeeDocument[]>(
        query(collection(firestore, 'employees'), where('status', '!=', 'Terminated')),
        undefined,
        ['mobile_leave_employees_v2']
    );
    const { data: leaves } = useFirestoreQuery<LeaveApplicationDocument[]>(
        collection(firestore, 'leave_applications'),
        undefined,
        ['mobile_leave_applications']
    );
    const { data: visits } = useFirestoreQuery<VisitApplicationDocument[]>(
        collection(firestore, 'visit_applications'),
        undefined,
        ['mobile_visit_applications']
    );
    const { data: holidays } = useFirestoreQuery<HolidayDocument[]>(
        collection(firestore, 'holidays'),
        undefined,
        ['mobile_holidays']
    );

    const getInitials = (name?: string) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    // Generate calendar days with data
    const calendarDays = React.useMemo(() => {
        const days = [];
        const prevMonthDaysCount = getDaysInMonth(new Date(year, month - 1));

        // Previous month days
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            days.push({ day: prevMonthDaysCount - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthDaysCount - i) });
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
        }

        // Next month days
        const totalDaysDisplayed = days.length;
        const remainingDays = 35 - totalDaysDisplayed; // Ensure 5 rows * 7 days = 35 cells
        for (let i = 1; i <= remainingDays; i++) {
            days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
        }

        // Attach data to each day
        return days.map(dayObj => {
            const { date, day, isCurrentMonth } = dayObj;

            // Find leaves for this day
            const dayLeaves = leaves?.filter(leave => {
                if (!['Approved', 'Pending'].includes(leave.status)) return false;
                const fromDate = parseISO(leave.fromDate);
                const toDate = parseISO(leave.toDate);
                return isWithinInterval(date, { start: fromDate, end: toDate });
            }).map(leave => {
                const employee = employees?.find(e => e.id === leave.employeeId);
                if (employee && format(date, 'yyyy-MM-dd') === '2026-01-28') {
                    console.log('🔍 Leave Avatar Debug for Jan 28:', {
                        employeeName: employee.fullName,
                        photoURL: employee.photoURL,
                        hasPhoto: !!employee.photoURL,
                        photoURLType: typeof employee.photoURL
                    });
                }
                return {
                    ...leave,
                    employee
                };
            }) || [];

            // Find visits for this day
            const dayVisits = visits?.filter(visit => {
                if (visit.status !== 'Approved') return false;
                const fromDate = parseISO(visit.fromDate);
                const toDate = parseISO(visit.toDate);
                return isWithinInterval(date, { start: fromDate, end: toDate });
            }).map(visit => ({
                ...visit,
                employee: employees?.find(e => e.id === visit.employeeId)
            })) || [];

            // Find birthdays for this day
            const dayBirthdays = employees?.filter(emp => {
                if (!emp.dateOfBirth) return false;
                try {
                    const dob = parseISO(emp.dateOfBirth);
                    return format(dob, 'MM-dd') === format(date, 'MM-dd');
                } catch { return false; }
            }) || [];

            // Check if this is a holiday
            const holiday = holidays?.find(h =>
                isWithinInterval(date, {
                    start: parseISO(h.fromDate),
                    end: parseISO(h.toDate || h.fromDate)
                })
            ) || null;

            return {
                day,
                isCurrentMonth,
                date,
                isToday: isTodayFn(date),
                holiday: holiday,
                isWeekend: getDay(date) === 5, // Friday
                leaves: dayLeaves,
                visits: dayVisits,
                birthdays: dayBirthdays
            };
        });
    }, [currentDate, employees, leaves, visits, holidays, year, month, daysInMonth, firstDayOfMonth]);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleRefresh = async () => {
        setIsRefreshing(true);

        // Play water drop sound
        try {
            const audio = new Audio('/sounds/water-drop.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => { });
        } catch (err) {
            // Silently fail audio
        }

        // Simulate data refresh
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsRefreshing(false);
        setPullDistance(0);
    };

    const leaveActions: LeaveAction[] = [
        { label: 'Leave Calendar', icon: CalendarIcon, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/leave/calendar' },
        { label: 'My Leave Balance', icon: Users, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/leave/balance' },
        { label: 'My Leave Applications', icon: FileText, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/leave/applications' },
        { label: 'Visit Applications', icon: MapPin, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/visit' },
        { label: 'Sub-Ordinate Leave Balance', icon: Users, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/leave/subordinate?view=team' },
        { label: 'Approve Application', icon: CheckCircle, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/approve' },
    ];

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentDate(prevDate => {
            const newDate = new Date(prevDate);
            if (direction === 'prev') {
                newDate.setMonth(newDate.getMonth() - 1);
            } else {
                newDate.setMonth(newDate.getMonth() + 1);
            }
            return newDate;
        });
    };

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
                    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 ${isRefreshing || pullDistance > 40 ? 'opacity-100' : 'opacity-0'} `}></div>
                </div>

                <div className="px-6 pt-6 pb-[120px] space-y-6">
                    {/* Calendar */}
                    <div className="bg-white rounded-2xl p-6 shadow-xl">
                        {/* Month Header */}
                        <div className="flex items-center justify-between mb-6">
                            <button
                                onClick={() => navigateMonth('prev')}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <h2 className="text-xl font-bold text-blue-600">{monthName}</h2>
                            <button
                                onClick={() => navigateMonth('next')}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Day Headers */}
                        <div className="grid grid-cols-7 gap-2 mb-3">
                            {['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
                                <div key={day} className="text-center text-xs font-semibold text-slate-500">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((dayObj, index) => {
                                const hasData = dayObj.leaves.length > 0 || dayObj.visits.length > 0 || dayObj.birthdays.length > 0;
                                const totalPeople = dayObj.leaves.length + dayObj.visits.length;

                                return (
                                    <div
                                        key={index}
                                        className={`
                                            relative min-h-[60px] p-1 flex flex-col rounded-lg text-sm transition-all duration-200
                            ${dayObj.isCurrentMonth
                                                ? dayObj.isToday
                                                    ? 'bg-blue-50/50 border-2 border-blue-500 shadow-sm z-10'
                                                    : dayObj.holiday
                                                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                        : dayObj.isWeekend
                                                            ? 'bg-rose-100 text-rose-500 border border-rose-200'
                                                            : 'bg-white text-slate-700 border border-slate-100'
                                                : 'bg-gray-50/50 text-slate-300'
                                            }
                            ${dayObj.isCurrentMonth && (dayObj.holiday || dayObj.leaves.length > 0 || dayObj.birthdays.length > 0) ? 'cursor-pointer active:scale-95' : ''}
                                        `}
                                        onClick={() => {
                                            if (!dayObj.isCurrentMonth) return;

                                            let content = '';
                                            if (dayObj.holiday) {
                                                content += `<div class="mb-4 text-left p-3 bg-rose-50 rounded-lg border border-rose-100">
                                                    <div class="font-bold text-rose-700 flex items-center gap-2">
                                                        <span class="bg-rose-500 text-white px-1.5 py-0.5 rounded text-[10px]">H</span>
                                                        ${dayObj.holiday.name}
                                                    </div>
                                                    <div class="text-xs text-rose-600 mt-1">${dayObj.holiday.type} announcement</div>
                                                </div>`;
                                            }

                                            if (dayObj.birthdays.length > 0) {
                                                content += `<div class="mb-4 text-left p-3 bg-pink-50 rounded-lg border border-pink-100">
                                                    <div class="font-bold text-pink-700 flex items-center gap-2">
                                                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                                        Birthdays
                                                    </div>
                                                    <div class="mt-2 space-y-1">
                                                        ${dayObj.birthdays.map(b => `<div class="text-xs flex items-center gap-2">🎂 ${b.fullName}</div>`).join('')}
                                                    </div>
                                                </div>`;
                                            }

                                            if (dayObj.leaves.length > 0) {
                                                content += `<div class="text-left p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                                    <div class="font-bold text-emerald-700">Employees on Leave</div>
                                                    <div class="mt-2 space-y-2">
                                                        ${dayObj.leaves.map(l => `<div class="text-xs flex items-center gap-2">
                                                            <div class="w-2 h-2 rounded-full ${l.status === 'Approved' ? 'bg-emerald-500' : 'bg-amber-500'}"></div>
                                                            <span class="font-medium">${l.employee?.fullName || l.employeeName || 'Unknown'}</span>
                                                            <span class="text-[10px] text-slate-500">(${l.leaveType})</span>
                                                        </div>`).join('')}
                                                    </div>
                                                </div>`;
                                            }

                                            if (content) {
                                                Swal.fire({
                                                    title: format(dayObj.date, 'PPPP'),
                                                    html: `<div class="mt-4">${content}</div>`,
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
                                        <div className="flex justify-between items-start">
                                            <div className={cn("font-semibold text-xs", dayObj.isToday ? "text-blue-600" : (dayObj.holiday || dayObj.isWeekend) ? "text-rose-600" : "text-slate-500")}>{dayObj.day}</div>
                                            {dayObj.holiday ? (
                                                <span className="bg-rose-500 text-white text-[8px] px-1 rounded font-bold">H</span>
                                            ) : dayObj.isWeekend ? (
                                                <span className="bg-rose-400 text-white text-[8px] px-1 rounded font-bold">W</span>
                                            ) : null}
                                        </div>

                                        {dayObj.isCurrentMonth && (
                                            <div className="flex-1 flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                                                {/* Birthdays */}
                                                {dayObj.birthdays.slice(0, 1).map(emp => (
                                                    <div key={emp.id} className="flex items-center gap-0.5 bg-pink-100 rounded px-0.5 py-0.5">
                                                        <Cake className="h-2.5 w-2.5 text-pink-500 flex-shrink-0" />
                                                    </div>
                                                ))}

                                                {/* Leave avatars */}
                                                {dayObj.leaves.slice(0, 2).map((leave, idx) => {
                                                    const photoURL = leave.employee?.photoURL || '';
                                                    if (photoURL) {
                                                        console.log('🖼️ Rendering avatar with photoURL:', photoURL);
                                                    }
                                                    return (
                                                        <div key={`leave-${idx}`} className="relative">
                                                            <Avatar className="h-5 w-5 border border-white shadow-sm">
                                                                <AvatarImage
                                                                    src={photoURL}
                                                                    alt={leave.employee?.fullName || leave.employeeName}
                                                                    className="object-cover"
                                                                    onError={() => console.log('❌ Image failed to load:', photoURL)}
                                                                    onLoad={() => console.log('✅ Image loaded successfully:', photoURL)}
                                                                />
                                                                <AvatarFallback className="text-[7px] bg-emerald-100 text-emerald-700 font-semibold uppercase">
                                                                    {getInitials(leave.employee?.fullName || leave.employeeName)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className={cn(
                                                                "absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border-[0.5px] border-white",
                                                                leave.status === 'Approved' ? "bg-emerald-500" : "bg-amber-500"
                                                            )} />
                                                        </div>
                                                    );
                                                })}

                                                {/* Visit avatars */}
                                                {dayObj.visits.slice(0, 2 - dayObj.leaves.length).map((visit, idx) => (
                                                    <div key={`visit-${idx}`} className="relative">
                                                        <Avatar className="h-5 w-5 border border-white shadow-sm">
                                                            <AvatarImage
                                                                src={visit.employee?.photoURL || ''}
                                                                alt={visit.employee?.fullName || visit.employeeName}
                                                                className="object-cover"
                                                            />
                                                            <AvatarFallback className="text-[7px] bg-blue-100 text-blue-700 font-semibold uppercase">
                                                                {getInitials(visit.employee?.fullName || visit.employeeName)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className={cn(
                                                            "absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border-[0.5px] border-white",
                                                            visit.status === 'Approved' ? "bg-emerald-500" : "bg-amber-500"
                                                        )} />
                                                    </div>
                                                ))}

                                                {/* Show count if more people */}
                                                {totalPeople > 2 && (
                                                    <div className="text-[8px] text-slate-500 font-bold">+{totalPeople - 2}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-[10px] text-slate-500 font-medium">
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span>Approved</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-amber-500" />
                                <span>Pending</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                <span>Today</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="bg-rose-500 text-white text-[8px] px-1 rounded font-bold">H</span>
                                <span className="text-rose-600">Holiday</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="bg-rose-400 text-white text-[8px] px-1 rounded font-bold">W</span>
                                <span className="text-rose-500">Weekend</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Cake className="h-3 w-3 text-pink-500" />
                                <span className="text-pink-500">Birthday</span>
                            </div>
                        </div>
                    </div>

                    {/* Leave Actions */}
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Leave</h2>
                        <div className="grid grid-cols-3 gap-4">
                            {leaveActions.map((action, index) => {
                                const Icon = action.icon;
                                const buttonContent = (
                                    <div className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] hover:shadow-md transition-shadow h-full w-full">
                                        <div className={`${action.color} p-4 rounded-full ${action.iconColor} h-14 w-14 flex items-center justify-center shadow-lg shadow-blue-200`}>
                                            <Icon className="h-7 w-7" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 text-center leading-tight">
                                            {action.label}
                                        </span>
                                    </div>
                                );

                                if (action.href) {
                                    return (
                                        <Link key={index} href={action.href} className="active:scale-95 transition-transform">
                                            {buttonContent}
                                        </Link>
                                    );
                                }

                                return (
                                    <button key={index} className="active:scale-95 transition-transform text-left">
                                        {buttonContent}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
