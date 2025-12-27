"use client";

import React, { useState } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import {
    Calendar as CalendarIcon,
    Users,
    FileText,
    CheckCircle,
    MapPin,
    ChevronLeft,
    ChevronRight,
    LucideIcon
} from 'lucide-react';
import Link from 'next/link';

interface LeaveAction {
    label: string;
    icon: LucideIcon;
    color: string;
    iconColor: string;
    href?: string;
}

export default function MobileLeavePage() {
    const [currentMonth, setCurrentMonth] = useState(new Date(2025, 11, 1)); // December 2025
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);

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
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsRefreshing(false);
        setPullDistance(0);
    };

    // Get calendar data
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        return { daysInMonth, startingDayOfWeek };
    };

    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    // Generate calendar days
    const calendarDays = [];
    const prevMonthDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();

    // Previous month days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        calendarDays.push({ day: prevMonthDays - i, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push({ day: i, isCurrentMonth: true });
    }

    // Next month days to fill the grid
    const remainingDays = 42 - calendarDays.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
        calendarDays.push({ day: i, isCurrentMonth: false });
    }

    const leaveActions: LeaveAction[] = [
        { label: 'Leave Calendar', icon: CalendarIcon, color: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: 'My Leave Balance', icon: Users, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/leave/balance' },
        { label: 'My Leave Applications', icon: FileText, color: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: 'Visit', icon: MapPin, color: 'bg-blue-100', iconColor: 'text-blue-600', href: '/mobile/visit' },
        { label: 'Sub-Ordinate', icon: Users, color: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: 'Approve', icon: CheckCircle, color: 'bg-blue-100', iconColor: 'text-blue-600' },
    ];

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentMonth(prev => {
            const newDate = new Date(prev);
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
                    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 ${isRefreshing || pullDistance > 40 ? 'opacity-100' : 'opacity-0'}`}></div>
                </div>

                <div className="px-6 pt-6 pb-24 space-y-6">
                    {/* Calendar */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm">
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
                        <div className="grid grid-cols-7 gap-2">
                            {calendarDays.map((dayObj, index) => {
                                const isToday = dayObj.day === 26 && dayObj.isCurrentMonth; // Highlighting 26th as in reference
                                return (
                                    <div
                                        key={index}
                                        className={`
                                        aspect-square flex items-center justify-center rounded-lg text-sm font-medium
                                        ${dayObj.isCurrentMonth
                                                ? isToday
                                                    ? 'bg-blue-500 text-white'
                                                    : 'text-slate-700 hover:bg-slate-50'
                                                : 'text-slate-300'
                                            }
                                    `}
                                    >
                                        {dayObj.day}
                                    </div>
                                );
                            })}
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
                                        <div className={`${action.color} p-4 rounded-full ${action.iconColor} h-14 w-14 flex items-center justify-center`}>
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
        </div>
    );
}
