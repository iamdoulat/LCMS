"use client";

import React, { useState } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, LogIn, LogOut, Clock, Coffee, ListTodo, MoreHorizontal, Settings, ChevronDown, CalendarX, Bell, Wallet, Users, X } from 'lucide-react';

const allSummaryItems = [
    { id: 'leave', label: 'Leave', subLabel: 'Spent', value: '10.0', icon: LogOut, bgColor: 'bg-red-50', textColor: 'text-red-500' },
    { id: 'visit', label: 'Visit', subLabel: 'Taken', value: '0.0', icon: ArrowRight, bgColor: 'bg-orange-50', textColor: 'text-orange-500' }, // orange-500 wasn't working well with red-500 class in previous
    { id: 'pending', label: 'Pending', subLabel: 'Approval', value: '0', icon: Clock, bgColor: 'bg-amber-50', textColor: 'text-amber-500' },
    { id: 'missed', label: 'Missed', subLabel: 'Attendance', value: '0', icon: CalendarX, bgColor: 'bg-slate-100', textColor: 'text-slate-500' },
    { id: 'notices', label: 'New', subLabel: 'Notices', value: '2', icon: Bell, bgColor: 'bg-blue-50', textColor: 'text-blue-500' },
    { id: 'checkin', label: "Today's", subLabel: 'Check In', value: '--:--', icon: LogIn, bgColor: 'bg-indigo-50', textColor: 'text-indigo-500' },
    { id: 'checkout', label: "Today's", subLabel: 'Check Out', value: '--:--', icon: LogOut, bgColor: 'bg-purple-50', textColor: 'text-purple-500' },
    { id: 'claim', label: 'Monthly', subLabel: 'Claim Amount', value: '0', icon: Wallet, bgColor: 'bg-emerald-50', textColor: 'text-emerald-500' },
    { id: 'disbursed', label: 'Monthly', subLabel: 'Disbursed', value: '0', icon: Wallet, bgColor: 'bg-teal-50', textColor: 'text-teal-500' },
];

export default function MobileDashboardPage() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>(['leave', 'visit', 'pending']);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const visibleItems = allSummaryItems.filter(item => selectedIds.includes(item.id));

    const toggleItem = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);

        // Play water drop sound
        try {
            const audio = new Audio('/sounds/water-drop.mp3');
            audio.volume = 0.5;
            audio.play().catch(err => console.log('Audio play failed:', err));
        } catch (err) {
            console.log('Audio error:', err);
        }

        // Simulate data refresh
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsRefreshing(false);
        setPullDistance(0);
    };
    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Sticky Header - stays fixed during pull */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <MobileHeader />
            </div>

            <div
                ref={containerRef}
                className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto overscroll-contain relative transition-transform duration-200 ease-out"
                style={{
                    transform: `translateY(${isRefreshing ? 60 : pullDistance > 0 ? pullDistance * 0.4 : 0}px)`,
                    backgroundColor: '#f8fafc' // Solid background to prevent seeing through
                }}
                onTouchStart={(e) => {
                    const scrollTop = containerRef.current?.scrollTop ?? 0;
                    if (scrollTop === 0 && !isRefreshing) {
                        const startY = e.touches[0].clientY;

                        const handleTouchMove = (moveEvent: TouchEvent) => {
                            const currentY = moveEvent.touches[0].clientY;
                            const diff = currentY - startY;

                            // Check scrollTop using ref to avoid stale/null event object
                            if (diff > 0 && (containerRef.current?.scrollTop ?? 0) === 0) {
                                moveEvent.preventDefault(); // Prevent default scroll when pulling down
                                setPullDistance(diff);
                            }
                        };

                        const handleTouchEnd = () => {
                            setPullDistance(current => {
                                if (current > 80) {
                                    handleRefresh();
                                    return 80; // Keep showing spinner
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

                <div className="px-4 pt-6 pb-24 space-y-6">
                    {/* In/Out Time Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="p-4 rounded-xl flex items-center justify-between border-none shadow-sm h-24">
                            <div>
                                <div className="flex items-center gap-2 text-blue-600 mb-1">
                                    <div className="rounded-full bg-blue-100 p-2">
                                        <LogIn className="h-5 w-5" />
                                    </div>
                                    <span className="font-semibold text-base">In Time</span>
                                </div>
                                <p className="text-xs text-muted-foreground font-medium pl-1">Weekend</p>
                            </div>
                            <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                <ChevronDown className="h-5 w-5" />
                            </div>
                        </Card>

                        <Card className="p-4 rounded-xl flex items-center justify-between border-none shadow-sm h-24">
                            <div>
                                <div className="flex items-center gap-2 text-purple-600 mb-1">
                                    <div className="rounded-full bg-purple-100 p-2">
                                        <LogOut className="h-5 w-5" />
                                    </div>
                                    <span className="font-semibold text-base">Out Time</span>
                                </div>
                            </div>
                            <div className="h-10 w-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                                <ChevronDown className="h-5 w-5" />
                            </div>
                        </Card>
                    </div>

                    {/* Summary Section */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="font-bold text-lg text-slate-800">Summary</h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsSettingsOpen(true)}
                                className="h-8 w-8 bg-blue-100 text-blue-600 rounded-lg"
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Horizontal Scrollable Container */}
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                            {visibleItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.id} className={`flex-shrink-0 w-[130px] ${item.bgColor} p-3 rounded-xl flex flex-col justify-between h-36 relative overflow-hidden`}>
                                        <div className={`bg-white rounded-lg p-2 w-12 h-12 flex items-center justify-center shadow-sm mb-2 ${item.textColor}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div className="absolute top-5 right-4 text-lg font-bold text-[#0a1e60]">{item.value}</div>
                                        <div className="mt-auto">
                                            <div className="text-xs text-slate-500">{item.label}</div>
                                            <div className="text-xs text-slate-500">{item.subLabel}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Settings Popup */}
                    {isSettingsOpen && (
                        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-[2rem] p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-[#0a1e60]">More Summary Items</h3>
                                        <p className="text-xs text-slate-500 mt-1">Select up to 8 items</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsSettingsOpen(false)}
                                        className="text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="h-6 w-6" />
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
                                    {allSummaryItems.map((item) => {
                                        const isSelected = selectedIds.includes(item.id);
                                        const Icon = item.icon;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => toggleItem(item.id)}
                                                className={`p-4 rounded-xl flex items-center gap-3 transition-all ${isSelected
                                                    ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-200'
                                                    : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-slate-100'}`}>
                                                    <Icon className={`h-5 w-5 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-xs font-semibold leading-tight">{item.label}</div>
                                                    <div className="text-xs leading-tight opacity-90">{item.subLabel}</div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>

                                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center">
                                    <Button
                                        className="bg-[#0a1e60] text-white rounded-xl px-8 w-full h-12"
                                        onClick={() => setIsSettingsOpen(false)}
                                    >
                                        Done
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modules Section */}
                    <div>
                        <h2 className="font-bold text-lg text-slate-800 mb-3">Modules</h2>
                        <div className="grid grid-cols-3 gap-4">
                            {/* Break Time */}
                            <div className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px]">
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center">
                                    <Coffee className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center leading-tight">Break Time</span>
                            </div>

                            {/* Task */}
                            <div className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px]">
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center">
                                    <ListTodo className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center">Task</span>
                            </div>

                            {/* Check In/Out */}
                            <div className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px]">
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center">
                                    <LogIn className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center leading-tight">Check In/Out</span>
                            </div>

                            {/* Placeholders for next row */}
                            <div className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px]">
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center">
                                    <Clock className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center">History</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
