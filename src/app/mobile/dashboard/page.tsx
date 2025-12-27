"use client";

import React, { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { MobileAttendanceModal } from '@/components/mobile/MobileAttendanceModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, LogIn, LogOut, Clock, Coffee, ListTodo, MoreHorizontal, Settings, ChevronDown, CalendarX, Bell, Wallet, Users, X, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, parse, parseISO, differenceInCalendarDays, startOfYear, endOfYear, max, min } from 'date-fns';

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

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function MobileDashboardPage() {
    const { user } = useAuth();

    const formatAttendanceTime = (timeStr?: string) => {
        if (!timeStr) return null;
        try {
            const parsed = parse(timeStr, 'HH:mm', new Date());
            return format(parsed, 'hh:mm a');
        } catch (e) {
            return timeStr;
        }
    };

    const getAttendanceStatus = (flag?: string, approvalStatus?: string) => {
        if (approvalStatus === 'Pending') return 'Waiting For Remote Approval';
        if (!flag) return null;
        const statusMap: Record<string, string> = {
            'P': 'Present',
            'D': 'Delayed',
            'A': 'Absent',
            'V': 'Visit',
            'L': 'Leave',
            'H': 'Holiday'
        };
        return statusMap[flag] || flag;
    };

    const calculateWorkHours = (inTime?: string, outTime?: string) => {
        if (!inTime || !outTime) return null;
        try {
            const start = parse(inTime, 'HH:mm', new Date());
            const end = parse(outTime, 'HH:mm', new Date());
            let diff = end.getTime() - start.getTime();
            if (diff < 0) diff += 24 * 60 * 60 * 1000;

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            let result = '';
            if (hours > 0) result += `${hours} hr${hours > 1 ? 's' : ''} `;
            if (mins > 0 || hours === 0) result += `${mins} min`;
            return result.trim();
        } catch (e) {
            return null;
        }
    };
    const router = useRouter();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>(['leave', 'visit', 'pending']);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [attendanceType, setAttendanceType] = useState<'in' | 'out'>('in');
    const [todayAttendance, setTodayAttendance] = useState<{ inTime?: string; outTime?: string; flag?: string; approvalStatus?: string } | null>(null);

    // Load settings from localStorage
    useEffect(() => {
        const savedSettings = localStorage.getItem('mobileDashboardSummarySettings');
        if (savedSettings) {
            try {
                setSelectedIds(JSON.parse(savedSettings));
            } catch (e) {
                console.error('Failed to parse saved settings', e);
            }
        }
    }, []);

    // Save settings to localStorage whenever they change
    const toggleItem = (id: string) => {
        setSelectedIds(prev => {
            const newSelection = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
            localStorage.setItem('mobileDashboardSummarySettings', JSON.stringify(newSelection));
            return newSelection;
        });
    };

    // Real-time listener for today's attendance
    useEffect(() => {
        if (!user) return;

        const today = new Date();
        const dateKey = format(today, 'yyyy-MM-dd');
        const docId = `${user.uid}_${dateKey}`;

        const unsubscribe = onSnapshot(doc(firestore, 'attendance', docId), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setTodayAttendance({
                    inTime: data.inTime,
                    outTime: data.outTime,
                    flag: data.flag,
                    approvalStatus: data.approvalStatus
                });
            } else {
                setTodayAttendance(null);
            }
        }, (error) => {
            console.error('Error listening to today attendance:', error);
        });

        return () => unsubscribe();
    }, [user]);

    const [stats, setStats] = useState({
        leaveSpent: 0,
        visitCount: 0,
        pendingCount: 0,
        missedAttendance: 0,
        noticesCount: 0,
        claimAmount: 0,
        disbursedAmount: 0
    });

    const visibleItems = allSummaryItems.filter(item => selectedIds.includes(item.id)).map(item => {
        switch (item.id) {
            case 'leave': return { ...item, value: stats.leaveSpent.toFixed(1) };
            case 'visit': return { ...item, value: stats.visitCount.toFixed(1) };
            case 'pending': return { ...item, value: stats.pendingCount.toString() };
            case 'missed': return { ...item, value: stats.missedAttendance.toString() };
            case 'notices': return { ...item, value: stats.noticesCount.toString() };
            case 'checkin': return { ...item, value: todayAttendance?.inTime || '--:--' };
            case 'checkout': return { ...item, value: todayAttendance?.outTime || '--:--' };
            case 'claim': return { ...item, value: stats.claimAmount.toString() };
            case 'disbursed': return { ...item, value: stats.disbursedAmount.toString() };
            default: return item;
        }
    });

    // Real-time listeners for stats
    useEffect(() => {
        if (!user?.email) return;

        const setupListeners = async () => {
            try {
                // 0. Resolve Employee ID by email
                const empQuery = query(collection(firestore, 'employees'), where('email', '==', user.email));
                const empSnap = await getDocs(empQuery);

                const ids = [user.uid];
                if (!empSnap.empty) {
                    const empId = empSnap.docs[0].id;
                    if (empId !== user.uid) {
                        ids.push(empId);
                    }
                }

                const startMonth = startOfMonth(new Date());
                const endMonth = endOfMonth(new Date());

                // 1. Leave Stats (Approved)
                const qLeave = query(
                    collection(firestore, 'leave_applications'),
                    where('employeeId', 'in', ids)
                );
                const unsubLeave = onSnapshot(qLeave, (snapshot) => {
                    const startOfCurrentYear = startOfYear(new Date());
                    const endOfCurrentYear = endOfYear(new Date());
                    let totalDays = 0;

                    snapshot.docs.forEach(doc => {
                        const data = doc.data();
                        if (data.status === 'Approved' && data.fromDate && data.toDate) {
                            const leaveStart = parseISO(data.fromDate);
                            const leaveEnd = parseISO(data.toDate);

                            const overlapStart = max([leaveStart, startOfCurrentYear]);
                            const overlapEnd = min([leaveEnd, endOfCurrentYear]);

                            if (overlapEnd >= overlapStart) {
                                totalDays += differenceInCalendarDays(overlapEnd, overlapStart) + 1;
                            }
                        }
                    });
                    setStats(prev => ({ ...prev, leaveSpent: totalDays }));
                });

                // 2. Visit Stats (Approved)
                const qVisit = query(
                    collection(firestore, 'visit_applications'),
                    where('employeeId', 'in', ids)
                );
                const unsubVisit = onSnapshot(qVisit, (snapshot) => {
                    const startOfCurrentYear = startOfYear(new Date());
                    const endOfCurrentYear = endOfYear(new Date());
                    let totalDays = 0;

                    snapshot.docs.forEach(doc => {
                        const data = doc.data();
                        if (data.fromDate && data.toDate) {
                            const visitStart = parseISO(data.fromDate);
                            const visitEnd = parseISO(data.toDate);

                            const overlapStart = max([visitStart, startOfCurrentYear]);
                            const overlapEnd = min([visitEnd, endOfCurrentYear]);

                            if (overlapEnd >= overlapStart) {
                                // Using the 'day' field if available, otherwise calculate overlap
                                if (data.day) {
                                    totalDays += Number(data.day);
                                } else {
                                    totalDays += differenceInCalendarDays(overlapEnd, overlapStart) + 1;
                                }
                            }
                        }
                    });
                    setStats(prev => ({ ...prev, visitCount: totalDays }));
                });

                // 3. Pending Requests (Aggregate)
                // Note: Creating multiple listeners might be heavy, but fine for single user dashboard
                const qPendingLeave = query(collection(firestore, 'leave_applications'), where('employeeId', 'in', ids));
                const qPendingVisit = query(collection(firestore, 'visit_applications'), where('employeeId', 'in', ids));
                const qPendingAdvance = query(collection(firestore, 'advance_salary'), where('employeeId', 'in', ids));

                // We'll use a single aggregated update for pending to avoid flickering
                const unsubPendingLeave = onSnapshot(qPendingLeave, (snap) => {
                    updatePendingCount(snap.docs.filter(d => d.data().status === 'Pending').length, 'leave');
                });
                const unsubPendingVisit = onSnapshot(qPendingVisit, (snap) => {
                    updatePendingCount(snap.docs.filter(d => d.data().status === 'Pending').length, 'visit');
                });
                const unsubPendingAdvance = onSnapshot(qPendingAdvance, (snap) => {
                    updatePendingCount(snap.docs.filter(d => d.data().status === 'Pending').length, 'advance');
                });

                let pendingCounts = { leave: 0, visit: 0, advance: 0 };
                const updatePendingCount = (count: number, type: 'leave' | 'visit' | 'advance') => {
                    pendingCounts[type] = count;
                    setStats(prev => ({
                        ...prev,
                        pendingCount: pendingCounts.leave + pendingCounts.visit + pendingCounts.advance
                    }));
                };

                // 4. Missed Attendance (Flag 'A' in current month)
                // Note: This logic assumes 'A' flag is set by a cron job or manual process
                const qMissed = query(
                    collection(firestore, 'attendance'),
                    where('employeeId', 'in', ids)
                );
                const unsubMissed = onSnapshot(qMissed, (snapshot) => {
                    const missedCount = snapshot.docs.filter(doc => {
                        const data = doc.data();
                        return data.flag === 'A' &&
                            data.date >= startMonth.toISOString() &&
                            data.date <= endMonth.toISOString();
                    }).length;
                    setStats(prev => ({ ...prev, missedAttendance: missedCount }));
                });

                // 5. Notices (Unseen count) - Simplified to total active notices for now
                // For distinct "New", we'd need to compare with last seen ID, but just showing total active is a good start
                /* 
                const qNotices = query(collection(firestore, 'site_settings'), where('type', '==', 'notice'), where('isEnabled', '==', true));
                const unsubNotices = onSnapshot(qNotices, (snapshot) => {
                     // Filter logic would go here
                     setStats(prev => ({ ...prev, noticesCount: snapshot.size }));
                });
                */

                return () => {
                    unsubLeave();
                    unsubVisit();
                    unsubPendingLeave();
                    unsubPendingVisit();
                    unsubPendingAdvance();
                    unsubMissed();
                    // unsubNotices();
                };
            } catch (err) {
                console.error("Error setting up dashboard listeners:", err);
            }
        };

        const cleanupPromise = setupListeners();
        return () => {
            cleanupPromise.then(cleanup => cleanup && cleanup());
        };
    }, [user]);

    const refreshAttendanceData = async () => {
        if (!user) return;

        try {
            const today = new Date();
            const dateKey = format(today, 'yyyy-MM-dd');
            const docId = `${user.uid}_${dateKey}`;

            const attendanceDoc = await getDoc(doc(firestore, 'attendance', docId));
            if (attendanceDoc.exists()) {
                const data = attendanceDoc.data();
                setTodayAttendance({
                    inTime: data.inTime,
                    outTime: data.outTime
                });
            } else {
                setTodayAttendance(null);
            }
        } catch (error) {
            console.error('Error refreshing attendance:', error);
        }
    };

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
                    {/* Attendance Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* In Time Card */}
                        <Card className="p-5 rounded-3xl border border-slate-100 shadow-xl bg-white relative overflow-hidden group/card flex flex-col items-center justify-center min-h-[180px]">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover/card:scale-110 duration-700" />

                            <div className="flex flex-col items-center gap-4 relative z-10 w-full">
                                <button
                                    onClick={() => {
                                        setAttendanceType('in');
                                        setIsAttendanceModalOpen(true);
                                    }}
                                    disabled={!!todayAttendance?.inTime}
                                    className={cn(
                                        "h-24 w-24 rounded-full flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-lg relative group/btn",
                                        todayAttendance?.inTime
                                            ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white ring-4 ring-emerald-50"
                                            : "bg-gradient-to-br from-blue-600 to-cyan-500 text-white hover:brightness-110"
                                    )}
                                >
                                    <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                    <Clock className="h-6 w-6 mb-0.5" />
                                    <span className="text-xs font-bold">In Time</span>
                                    {todayAttendance?.inTime && (
                                        <span className="text-[10px] font-medium bg-white/20 px-1.5 py-0.5 rounded-full">{formatAttendanceTime(todayAttendance.inTime)}</span>
                                    )}
                                </button>
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                                    <span className="text-[11px] font-bold text-slate-700 text-center px-1">
                                        {getAttendanceStatus(todayAttendance?.flag, todayAttendance?.approvalStatus) || '08:00 hr(s)'}
                                    </span>
                                </div>
                            </div>
                        </Card>

                        {/* Out Time Card */}
                        <Card className="p-5 rounded-3xl border border-slate-100 shadow-xl bg-white relative overflow-hidden group/card flex flex-col items-center justify-center min-h-[180px]">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover/card:scale-110 duration-700" />

                            <div className="flex flex-col items-center gap-4 relative z-10 w-full">
                                <button
                                    onClick={() => {
                                        setAttendanceType('out');
                                        setIsAttendanceModalOpen(true);
                                    }}
                                    disabled={!todayAttendance?.inTime || !!todayAttendance?.outTime}
                                    className={cn(
                                        "h-24 w-24 rounded-full flex flex-col items-center justify-center gap-1 transition-all active:scale-95 relative group/btn shadow-lg",
                                        todayAttendance?.outTime
                                            ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white ring-4 ring-purple-50"
                                            : todayAttendance?.inTime
                                                ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white hover:brightness-110"
                                                : "bg-slate-50 text-slate-300 border-2 border-dashed border-slate-200"
                                    )}
                                >
                                    <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                    <Clock className="h-6 w-6 mb-0.5" />
                                    <span className="text-xs font-bold">Out Time</span>
                                    {todayAttendance?.outTime && (
                                        <span className="text-[10px] font-medium bg-white/20 px-1.5 py-0.5 rounded-full">{formatAttendanceTime(todayAttendance.outTime)}</span>
                                    )}
                                </button>
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Worked</span>
                                    <span className="text-[11px] font-bold text-slate-700">
                                        {calculateWorkHours(todayAttendance?.inTime, todayAttendance?.outTime) || 'Waiting...'}
                                    </span>
                                </div>
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
                                const content = (
                                    <div className={`flex-shrink-0 w-[130px] ${item.bgColor} p-3 rounded-xl flex flex-col justify-between h-36 relative overflow-hidden shadow-sm border border-slate-100 h-full`}>
                                        <div className={`bg-white rounded-lg p-2 w-12 h-12 flex items-center justify-center shadow-xl/20 mb-2 ${item.textColor}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div className="absolute top-5 right-4 text-lg font-bold text-[#0a1e60]">{item.value}</div>
                                        <div className="mt-auto">
                                            <div className="text-xs text-slate-500">{item.label}</div>
                                            <div className="text-xs text-slate-500">{item.subLabel}</div>
                                        </div>
                                    </div>
                                );

                                if (item.id === 'leave') {
                                    return (
                                        <Link key={item.id} href="/mobile/leave/balance" className="flex-shrink-0 transition-transform active:scale-95">
                                            {content}
                                        </Link>
                                    );
                                }

                                if (item.id === 'visit') {
                                    return (
                                        <Link key={item.id} href="/mobile/visit" className="flex-shrink-0 transition-transform active:scale-95">
                                            {content}
                                        </Link>
                                    );
                                }

                                return (
                                    <div key={item.id} className="flex-shrink-0">
                                        {content}
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
                            <Link
                                href="/mobile/check-in-out"
                                className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] active:scale-95 transition-transform cursor-pointer"
                            >
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center">
                                    <LogIn className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center leading-tight">Check In/Out</span>
                            </Link>

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

            {/* Attendance Modal */}
            <MobileAttendanceModal
                isOpen={isAttendanceModalOpen}
                onClose={() => setIsAttendanceModalOpen(false)}
                onSuccess={refreshAttendanceData}
                type={attendanceType}
            />
        </div>
    );
}
