"use client";

import React, { useState } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import {
    CalendarCheck,
    FileText,
    Users,
    Clock,
    QrCode,
    MapPin
} from 'lucide-react';

export default function MobileAttendancePage() {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        // Simulate data refresh
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsRefreshing(false);
        setPullDistance(0);
    };

    // Placeholder data for the donut chart
    const attendanceData = {
        present: 82.1,
        delay: 8.5,
        weekend: 6.2,
        leave: 3.2
    };

    // Calculate donut chart segments (simplified - in production would use a chart library)
    const total = attendanceData.present + attendanceData.delay + attendanceData.weekend + attendanceData.leave;
    const presentAngle = (attendanceData.present / total) * 360;
    const delayAngle = (attendanceData.delay / total) * 360;
    const weekendAngle = (attendanceData.weekend / total) * 360;
    const leaveAngle = (attendanceData.leave / total) * 360;

    const attendanceActions = [
        { label: 'My Attendance', icon: CalendarCheck, color: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: 'View Attendance', icon: FileText, color: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: 'Recon. Application', icon: FileText, color: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: 'Recon.', icon: Users, color: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: 'Remote Att.', icon: MapPin, color: 'bg-blue-100', iconColor: 'text-blue-600' },
        { label: 'QR Scan /', icon: QrCode, color: 'bg-blue-100', iconColor: 'text-blue-600' },
    ];

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            <MobileHeader />

            <div
                ref={containerRef}
                className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto overscroll-contain relative transition-transform duration-200 ease-out"
                style={{ transform: `translateY(${isRefreshing ? 60 : pullDistance > 0 ? pullDistance * 0.4 : 0}px)` }}
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

                        {/* Donut Chart Container */}
                        <div className="flex items-center justify-between mb-6">
                            {/* SVG Donut Chart */}
                            <div className="relative w-48 h-48">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                    {/* Background circle */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="35"
                                        fill="none"
                                        stroke="#f1f5f9"
                                        strokeWidth="15"
                                    />

                                    {/* Present segment (green) */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="35"
                                        fill="none"
                                        stroke="#10b981"
                                        strokeWidth="15"
                                        strokeDasharray={`${(presentAngle / 360) * 220} 220`}
                                        strokeDashoffset="0"
                                        className="transition-all duration-500"
                                    />

                                    {/* Delay segment (yellow) */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="35"
                                        fill="none"
                                        stroke="#fbbf24"
                                        strokeWidth="15"
                                        strokeDasharray={`${(delayAngle / 360) * 220} 220`}
                                        strokeDashoffset={`-${(presentAngle / 360) * 220}`}
                                        className="transition-all duration-500"
                                    />

                                    {/* Weekend segment (purple) */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="35"
                                        fill="none"
                                        stroke="#a78bfa"
                                        strokeWidth="15"
                                        strokeDasharray={`${(weekendAngle / 360) * 220} 220`}
                                        strokeDashoffset={`-${((presentAngle + delayAngle) / 360) * 220}`}
                                        className="transition-all duration-500"
                                    />

                                    {/* Leave segment (cyan) */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="35"
                                        fill="none"
                                        stroke="#06b6d4"
                                        strokeWidth="15"
                                        strokeDasharray={`${(leaveAngle / 360) * 220} 220`}
                                        strokeDashoffset={`-${((presentAngle + delayAngle + weekendAngle) / 360) * 220}`}
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
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                    <span className="text-sm font-medium text-slate-700">Present</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                    <span className="text-sm font-medium text-slate-700">Delay</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-violet-400"></div>
                                    <span className="text-sm font-medium text-slate-700">Weekend</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                                    <span className="text-sm font-medium text-slate-700">Leave</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Attendance Actions */}
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Attendance</h2>
                        <div className="grid grid-cols-3 gap-4">
                            {attendanceActions.map((action, index) => {
                                const Icon = action.icon;
                                return (
                                    <button
                                        key={index}
                                        className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] hover:shadow-md transition-shadow"
                                    >
                                        <div className={`${action.color} p-4 rounded-full ${action.iconColor} h-14 w-14 flex items-center justify-center`}>
                                            <Icon className="h-7 w-7" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 text-center leading-tight">
                                            {action.label}
                                        </span>
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
