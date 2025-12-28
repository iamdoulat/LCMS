"use client";

import React, { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { MobileAttendanceModal } from '@/components/mobile/MobileAttendanceModal';
// MobileBreakTimeModal is now global via Context
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, LogIn, LogOut, Clock, Coffee, ListTodo, MoreHorizontal, Settings, ChevronDown, CalendarX, Bell, Wallet, Users, X, UserCheck, Timer, QrCode, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { useBreakTime } from '@/context/BreakTimeContext';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, parse, parseISO, differenceInCalendarDays, startOfYear, endOfYear, max, min, isFriday, isWithinInterval, startOfDay } from 'date-fns';

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
    const { isSupervisor, supervisedEmployeeIds } = useSupervisorCheck(user?.email);

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
    const [selectedIds, setSelectedIds] = useState<string[]>(['leave', 'visit', 'pending', 'missed', 'notices']);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    // isBreakModalOpen state removed
    const [attendanceType, setAttendanceType] = useState<'in' | 'out'>('in');
    const [todayAttendance, setTodayAttendance] = useState<{ inTime?: string; outTime?: string; flag?: string; approvalStatus?: string } | null>(null);
    const { isOnBreak, activeBreakRecord, openBreakModal } = useBreakTime();
    const [breakElapsedTime, setBreakElapsedTime] = useState<string>("00:00:00");
    const [userRole, setUserRole] = useState<string>('user');
    const [restrictionNote, setRestrictionNote] = useState<string | null>(null);

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
                    const empData = empSnap.docs[0].data();
                    const empId = empSnap.docs[0].id;
                    if (empId !== user.uid) {
                        ids.push(empId);
                    }
                    setUserRole(empData.role || 'user');
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
                const qPendingLeave = query(collection(firestore, 'leave_applications'), where('employeeId', 'in', ids));
                const qPendingVisit = query(collection(firestore, 'visit_applications'), where('employeeId', 'in', ids));
                const qPendingAdvance = query(collection(firestore, 'advance_salary'), where('employeeId', 'in', ids));

                const updatePendingCount = (count: number, type: 'leave' | 'visit' | 'advance') => {
                    pendingCounts[type] = count;
                    setStats(prev => ({
                        ...prev,
                        pendingCount: pendingCounts.leave + pendingCounts.visit + pendingCounts.advance
                    }));
                };

                let pendingCounts = { leave: 0, visit: 0, advance: 0 };
                const unsubPendingLeave = onSnapshot(qPendingLeave, (snap) => {
                    const myPending = snap.docs.filter(d => d.data().status === 'Pending' && ids.includes(d.data().employeeId)).length;
                    const teamPending = isSupervisor ? snap.docs.filter(d => d.data().status === 'Pending' && supervisedEmployeeIds.includes(d.data().employeeId)).length : 0;
                    updatePendingCount(myPending + teamPending, 'leave');
                });
                const unsubPendingVisit = onSnapshot(qPendingVisit, (snap) => {
                    const myPending = snap.docs.filter(d => d.data().status === 'Pending' && ids.includes(d.data().employeeId)).length;
                    const teamPending = isSupervisor ? snap.docs.filter(d => d.data().status === 'Pending' && supervisedEmployeeIds.includes(d.data().employeeId)).length : 0;
                    updatePendingCount(myPending + teamPending, 'visit');
                });
                const unsubPendingAdvance = onSnapshot(qPendingAdvance, (snap) => {
                    const myPending = snap.docs.filter(d => d.data().status === 'Pending' && ids.includes(d.data().employeeId)).length;
                    const teamPending = isSupervisor ? snap.docs.filter(d => d.data().status === 'Pending' && supervisedEmployeeIds.includes(d.data().employeeId)).length : 0; // Advance salary might have different logic but for now including if in team
                    updatePendingCount(myPending + teamPending, 'advance');
                });

                // 4. Missed Attendance (Flag 'A' in current month)
                const qMissed = query(
                    collection(firestore, 'attendance'),
                    where('employeeId', 'in', ids)
                );
                const unsubMissed = onSnapshot(qMissed, (snapshot) => {
                    const now = new Date();
                    const currentMonth = now.getMonth();
                    const currentYear = now.getFullYear();

                    const missedCount = snapshot.docs.filter(doc => {
                        const data = doc.data();
                        if (!data.date || data.flag !== 'A') return false;

                        try {
                            let dDate: Date;
                            if (typeof data.date === 'string') {
                                dDate = parseISO(data.date);
                            } else if (data.date instanceof Timestamp || (data.date && typeof data.date.toDate === 'function')) {
                                dDate = data.date.toDate();
                            } else {
                                dDate = new Date(data.date);
                            }

                            return dDate.getMonth() === currentMonth &&
                                dDate.getFullYear() === currentYear;
                        } catch (e) {
                            console.error("Error parsing date for missed attendance:", data.date, e);
                            return false;
                        }
                    }).length;
                    setStats(prev => ({ ...prev, missedAttendance: missedCount }));
                });

                // 5. Notices (Filtered by role)
                const qNotices = query(collection(firestore, 'site_settings'), where('isEnabled', '==', true));
                const unsubNotices = onSnapshot(qNotices, (snapshot) => {
                    const filtered = snapshot.docs.filter(doc => {
                        const data = doc.data();
                        // If it's a notice (you might need to check a 'type' field if site_settings contains other things)
                        // Assuming mostisEnabled items here are notices or relevant
                        if (!data.targetRoles || data.targetRoles.length === 0) return true;
                        return data.targetRoles.includes(userRole);
                    });
                    setStats(prev => ({ ...prev, noticesCount: filtered.length }));
                });

                // 6. Break Time listener removed (handled by Context)

                return () => {
                    unsubLeave();
                    unsubVisit();
                    unsubPendingLeave();
                    unsubPendingVisit();
                    unsubPendingAdvance();
                    unsubMissed();
                    unsubNotices();
                };
            } catch (err) {
                console.error("Error setting up dashboard listeners:", err);
            }
        };

        const cleanupPromise = setupListeners();
        return () => {
            cleanupPromise.then(cleanup => cleanup && cleanup());
        };
    }, [user, userRole, isSupervisor, supervisedEmployeeIds]);

    // Timer effect for active break
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isOnBreak && activeBreakRecord?.startTime) {
            const updateTimer = () => {
                const start = new Date(activeBreakRecord.startTime);
                const now = new Date();
                const diff = Math.max(0, now.getTime() - start.getTime());

                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                setBreakElapsedTime(
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                );
            };

            updateTimer();
            interval = setInterval(updateTimer, 1000);
        } else {
            setBreakElapsedTime("00:00:00");
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isOnBreak, activeBreakRecord?.startTime]);

    // Check for restrictions (Weekend, Holiday, Leave, Visit)
    useEffect(() => {
        const checkRestrictions = async () => {
            const today = startOfDay(new Date());

            // 1. Check Weekend (Friday)
            if (isFriday(today)) {
                setRestrictionNote("Today is the weekend.");
                return;
            }

            // 2. Check Holidays
            try {
                const holidaySnap = await getDocs(collection(firestore, 'holidays'));
                const todayHoliday = holidaySnap.docs.find(doc => {
                    const data = doc.data();
                    if (!data.fromDate) return false;
                    const start = startOfDay(parseISO(data.fromDate));
                    const end = data.toDate ? startOfDay(parseISO(data.toDate)) : start;
                    return isWithinInterval(today, { start, end });
                });
                if (todayHoliday) {
                    setRestrictionNote("Today is a holiday.");
                    return;
                }
            } catch (e) {
                console.error("Error checking holidays:", e);
            }

            // 3. Check Leaves (Approved)
            try {
                if (!user) return;
                const empQuery = query(collection(firestore, 'employees'), where('email', '==', user.email));
                const empSnap = await getDocs(empQuery);
                const ids = [user.uid];
                if (!empSnap.empty) {
                    ids.push(empSnap.docs[0].id);
                }

                const leaveSnap = await getDocs(query(collection(firestore, 'leave_applications'), where('employeeId', 'in', ids), where('status', '==', 'Approved')));
                const todayLeave = leaveSnap.docs.find(doc => {
                    const data = doc.data();
                    if (!data.fromDate || !data.toDate) return false;
                    const start = startOfDay(parseISO(data.fromDate));
                    const end = startOfDay(parseISO(data.toDate));
                    return isWithinInterval(today, { start, end });
                });
                if (todayLeave) {
                    setRestrictionNote("You are on leave.");
                    return;
                }

                // 4. Check Visits (Approved)
                const visitSnap = await getDocs(query(collection(firestore, 'visit_applications'), where('employeeId', 'in', ids), where('status', '==', 'Approved')));
                const todayVisit = visitSnap.docs.find(doc => {
                    const data = doc.data();
                    if (!data.fromDate || !data.toDate) return false;
                    const start = startOfDay(parseISO(data.fromDate));
                    const end = startOfDay(parseISO(data.toDate));
                    return isWithinInterval(today, { start, end });
                });
                if (todayVisit) {
                    setRestrictionNote("You are on a visit.");
                    return;
                }
            } catch (e) {
                console.error("Error checking leaves/visits:", e);
            }

            setRestrictionNote(null);
        };

        checkRestrictions();
        // Re-check every hour to handle day transitions
        const interval = setInterval(checkRestrictions, 60 * 60 * 1000);
        return () => clearInterval(interval);
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
                                    disabled={!!todayAttendance?.inTime || !!restrictionNote}
                                    className={cn(
                                        "h-24 w-24 rounded-full flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-lg relative group/btn",
                                        todayAttendance?.inTime
                                            ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white ring-4 ring-emerald-50"
                                            : !!restrictionNote
                                                ? "bg-slate-50 text-slate-300 border-2 border-dashed border-slate-200"
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
                                    <span className="text-[11px] font-bold text-slate-700 text-center px-1 font-mono">
                                        {restrictionNote || getAttendanceStatus(todayAttendance?.flag, todayAttendance?.approvalStatus) || '08:00 hr(s)'}
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
                                    disabled={!todayAttendance?.inTime || !!todayAttendance?.outTime || !!restrictionNote}
                                    className={cn(
                                        "h-24 w-24 rounded-full flex flex-col items-center justify-center gap-1 transition-all active:scale-95 relative group/btn shadow-lg",
                                        todayAttendance?.outTime
                                            ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white ring-4 ring-purple-50"
                                            : !!restrictionNote
                                                ? "bg-slate-50 text-slate-300 border-2 border-dashed border-slate-200"
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
                                    <span className="text-[11px] font-bold text-slate-700 font-mono">
                                        {restrictionNote ? '---' : calculateWorkHours(todayAttendance?.inTime, todayAttendance?.outTime) || 'Waiting...'}
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
                                    <div className={`flex-shrink-0 w-[130px] ${item.bgColor} p-3 rounded-xl flex flex-col h-36 relative overflow-hidden shadow-sm border border-slate-100 h-full`}>
                                        <div className={`bg-white rounded-lg p-2 w-12 h-12 flex items-center justify-center shadow-xl/20 mb-[15px] ${item.textColor}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div className="absolute top-5 right-4 text-lg font-bold text-[#0a1e60]">{item.value}</div>
                                        <div>
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

                                if (item.id === 'pending') {
                                    return (
                                        <Link key={item.id} href="/mobile/approve" className="flex-shrink-0 transition-transform active:scale-95">
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
                            <button
                                onClick={openBreakModal}
                                className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] transition-all hover:shadow-md hover:bg-slate-50 active:scale-95 text-center w-full group"
                            >
                                <div className={cn(
                                    "p-4 rounded-full h-14 w-14 flex items-center justify-center transition-all shadow-inner group-hover:scale-110",
                                    isOnBreak ? "bg-orange-100 text-orange-600 animate-pulse" : "bg-blue-100 text-blue-600"
                                )}>
                                    {isOnBreak ? <Timer className="h-7 w-7 animate-spin-slow" /> : <Coffee className="h-7 w-7" />}
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-medium text-slate-600 leading-tight">Break Time</span>
                                    {isOnBreak && (
                                        <span className="text-[10px] font-mono font-bold text-orange-600 mt-0.5">{breakElapsedTime}</span>
                                    )}
                                </div>
                            </button>

                            {/* Task */}
                            <button className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] transition-all hover:shadow-md hover:bg-slate-50 active:scale-95 group">
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center transition-all group-hover:scale-110">
                                    <ListTodo className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center">Task</span>
                            </button>

                            {/* Check In/Out */}
                            <Link
                                href="/mobile/check-in-out"
                                className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] transition-all hover:shadow-md hover:bg-slate-50 active:scale-95 group"
                            >
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center transition-all group-hover:scale-110">
                                    <LogIn className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center leading-tight">Check In/Out</span>
                            </Link>


                            {/* Claim */}
                            <button className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] transition-all hover:shadow-md hover:bg-slate-50 active:scale-95 group">
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center transition-all group-hover:scale-110">
                                    <Wallet className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center">Claim</span>
                            </button>

                            {/* Directory */}
                            <Link
                                href="/mobile/directory"
                                className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] transition-all hover:shadow-md hover:bg-slate-50 active:scale-95 group"
                            >
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center transition-all group-hover:scale-110">
                                    <Users className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center">Directory</span>
                            </Link>

                            {/* Assets */}
                            <button className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] transition-all hover:shadow-md hover:bg-slate-50 active:scale-95 group">
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center transition-all group-hover:scale-110">
                                    <UserCheck className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center">Assets</span>
                            </button>
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
