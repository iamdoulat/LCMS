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
import { format, startOfMonth, endOfMonth, parse, parseISO, differenceInCalendarDays, startOfYear, endOfYear, max, min, isFriday, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';
import Image from 'next/image';
import { usePermissions } from '@/hooks/usePermissions';
import { useRealtimeData, useRealtimeDoc } from '@/hooks/useRealtimeData';
import { dataScoper } from '@/lib/data/dataScoper';

const allSummaryItems = [
    { id: 'leave', label: 'Leave', subLabel: 'Spent', value: '10.0', icon: LogOut, bgColor: 'bg-red-50', textColor: 'text-red-500' },
    { id: 'pending', label: 'Pending', subLabel: 'Approval', value: '0', icon: Clock, bgColor: 'bg-amber-50', textColor: 'text-amber-500' },
    { id: 'missed', label: 'Missed', subLabel: 'Attendance', value: '0', icon: CalendarX, bgColor: 'bg-slate-100', textColor: 'text-slate-500' },
    { id: 'visit', label: 'Visit', subLabel: 'Taken', value: '0.0', icon: ArrowRight, bgColor: 'bg-orange-50', textColor: 'text-orange-500' },
    { id: 'notices', label: 'New', subLabel: 'Notices', value: '2', icon: Bell, bgColor: 'bg-blue-50', textColor: 'text-blue-500' },
    { id: 'checkin', label: "Today's", subLabel: 'Clock In', value: '--:--', icon: LogIn, bgColor: 'bg-indigo-50', textColor: 'text-indigo-500' },
    { id: 'checkout', label: "Today's", subLabel: 'Clock Out', value: '--:--', icon: LogOut, bgColor: 'bg-purple-50', textColor: 'text-purple-500' },
    { id: 'claim', label: 'Monthly', subLabel: 'Claim Amount', value: '0', icon: Wallet, bgColor: 'bg-emerald-50', textColor: 'text-emerald-500' },
    { id: 'disbursed', label: 'Monthly', subLabel: 'Disbursed', value: '0', icon: Wallet, bgColor: 'bg-teal-50', textColor: 'text-teal-500' },
];

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirebaseMessaging } from '@/hooks/useFirebaseMessaging';

export default function MobileDashboardPage() {
    const { user, userRole: globalUserRole, companyName, companyLogoUrl } = useAuth();
    const { isSupervisor, supervisedEmployeeIds, explicitSubordinateIds, currentEmployeeId } = useSupervisorCheck(user?.email);
    const permissions = usePermissions();

    // Context for data scoping - using explicitSubordinateIds for "own team" focus
    const scoperContext = useMemo(() => ({
        uid: user?.uid || '',
        employeeId: currentEmployeeId,
        supervisedEmployeeIds: explicitSubordinateIds || []
    }), [user?.uid, currentEmployeeId, explicitSubordinateIds]);

    // Initialize Firebase Cloud Messaging
    useFirebaseMessaging();

    const formatAttendanceTime = (timeStr?: any) => {
        if (!timeStr) return null;
        if (typeof timeStr !== 'string') return null;
        try {
            // Support both HH:mm and hh:mm a
            const formatStr = (timeStr.includes('AM') || timeStr.includes('PM')) ? 'hh:mm a' : 'HH:mm';
            const parsed = parse(timeStr, formatStr, new Date());
            return format(parsed, 'hh:mm a');
        } catch (e) {
            return timeStr;
        }
    };
    const getAttendanceStatus = (flag?: any, approvalStatus?: string, inTimeApprovalStatus?: string, outTimeApprovalStatus?: string) => {
        if (typeof flag !== 'string') return null;
        if (flag === 'A') return 'Absent';
        if (flag === 'L') return 'On Leave';
        if (flag === 'V') return 'On Visit';
        if (flag === 'W') return 'Weekend';
        if (flag === 'H') return 'Holiday';
        if (flag === 'P' || flag === 'D') {
            if (inTimeApprovalStatus === 'Pending') return 'In-Time Pending';
            if (outTimeApprovalStatus === 'Pending') return 'Out-Time Pending';
            if (approvalStatus === 'Pending') return 'Attendance Pending';
            return flag === 'P' ? 'Present' : 'Delayed Entry';
        }
        return null;
    };
    const calculateWorkHours = (inTime?: any, outTime?: any) => {
        if (!inTime || !outTime) return null;
        if (typeof inTime !== 'string' || typeof outTime !== 'string') return null;
        try {
            const inFormat = (inTime.includes('AM') || inTime.includes('PM')) ? 'hh:mm a' : 'HH:mm';
            const outFormat = (outTime.includes('AM') || outTime.includes('PM')) ? 'hh:mm a' : 'HH:mm';
            const start = parse(inTime, inFormat, new Date());
            const end = parse(outTime, outFormat, new Date());
            let diff = end.getTime() - start.getTime();
            if (diff < 0) diff += 24 * 60 * 60 * 1000;

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            let result = '';
            if (hours > 0) result += `${hours} hr${hours > 1 ? 's' : ''} `;
            if (minutes > 0 || hours === 0) result += `${minutes} min`;
            return result.trim();
        } catch (e) {
            return null;
        }
    };
    const router = useRouter();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>(['leave', 'pending', 'missed', 'visit', 'notices']);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    // isBreakModalOpen state removed
    const [attendanceType, setAttendanceType] = useState<'in' | 'out'>('in');
    const [todayAttendance, setTodayAttendance] = useState<{ inTime?: string; outTime?: string; flag?: string; approvalStatus?: string; inTimeApprovalStatus?: string; outTimeApprovalStatus?: string } | null>(null);
    const { isOnBreak, activeBreakRecord, openBreakModal } = useBreakTime();
    const [breakElapsedTime, setBreakElapsedTime] = useState<string>("00:00:00");
    // Local role for display/legacy check, but we'll prioritize globalUserRole
    const [localUserRole, setLocalUserRole] = useState<string>('user');
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

    const [stats, setStats] = useState({
        leaveSpent: 0,
        visitCount: 0,
        pendingCount: 0,
        missedAttendance: 0,
        teamMissedToday: 0,
        pendingAttendanceCount: 0,
        noticesCount: 0,
        claimAmount: 0,
        disbursedAmount: 0
    });

    // Real-time Data Subscriptions using the new architecture
    const attendanceQuery = useMemo(() => dataScoper.getAttendanceQuery(permissions, scoperContext), [permissions, scoperContext]);
    const leaveQuery = useMemo(() => dataScoper.getLeaveQuery(permissions, scoperContext), [permissions, scoperContext]);
    const visitQuery = useMemo(() => dataScoper.getVisitQuery(permissions, scoperContext), [permissions, scoperContext]);

    const { data: attendanceData, loading: attendanceLoading } = useRealtimeData<any[]>(attendanceQuery);
    const { data: leaveData, loading: leaveLoading } = useRealtimeData<any[]>(leaveQuery);
    const { data: visitData, loading: visitLoading } = useRealtimeData<any[]>(visitQuery);

    // Today's attendance listener using new hook
    const todayDocRef = useMemo(() => {
        const canonicalId = currentEmployeeId || user?.uid;
        if (!canonicalId) return null;
        const dateKey = format(new Date(), 'yyyy-MM-dd');
        return doc(firestore, 'attendance', `${canonicalId}_${dateKey}`);
    }, [user?.uid, currentEmployeeId]);

    const { data: todayAttendanceData, loading: todayLoading } = useRealtimeDoc<any>(todayDocRef);

    // Role-based notice listener
    const noticeQuery = useMemo(() => query(collection(firestore, 'site_settings'), where('isEnabled', '==', true)), []);
    const { data: rawNoticeData, loading: noticesLoading } = useRealtimeData<any[]>(noticeQuery);

    // Claim stats current month
    const claimQuery = useMemo(() => {
        if (!user?.uid) return null;
        const ids = [user.uid];
        if (currentEmployeeId) ids.push(currentEmployeeId);
        return query(
            collection(firestore, 'hr_claims'),
            where('employeeId', 'in', Array.from(new Set(ids))),
            where('claimDate', '>=', startOfMonth(new Date()).toISOString())
        );
    }, [user?.uid, currentEmployeeId]);
    const { data: claimData, loading: claimLoading } = useRealtimeData<any[]>(claimQuery);

    useEffect(() => {
        if (rawNoticeData) {
            const filtered = rawNoticeData.filter(doc => {
                if (!doc.targetRoles || !Array.isArray(doc.targetRoles) || doc.targetRoles.length === 0) return true;
                return doc.targetRoles.some((role: any) => globalUserRole?.includes(role));
            });
            setStats(prev => ({ ...prev, noticesCount: filtered.length }));
        }
    }, [rawNoticeData, globalUserRole]);

    useEffect(() => {
        if (todayAttendanceData) {
            setTodayAttendance({
                inTime: todayAttendanceData.inTime,
                outTime: todayAttendanceData.outTime,
                flag: todayAttendanceData.flag,
                approvalStatus: todayAttendanceData.approvalStatus,
                inTimeApprovalStatus: todayAttendanceData.inTimeApprovalStatus,
                outTimeApprovalStatus: todayAttendanceData.outTimeApprovalStatus
            });
        } else {
            setTodayAttendance(null);
        }
    }, [todayAttendanceData]);

    const visibleItems = useMemo(() => {
        return allSummaryItems.filter(item => selectedIds.includes(item.id)).map(item => {
            let isLoading = false;
            switch (item.id) {
                case 'leave':
                    isLoading = leaveLoading;
                    return { ...item, value: stats.leaveSpent.toFixed(1), isLoading };
                case 'visit':
                    isLoading = visitLoading;
                    return { ...item, value: stats.visitCount.toFixed(1), isLoading };
                case 'pending':
                    isLoading = attendanceLoading || leaveLoading || visitLoading;
                    return { ...item, value: stats.pendingCount.toString(), isLoading };
                case 'missed':
                    isLoading = attendanceLoading;
                    return { ...item, value: (isSupervisor ? stats.teamMissedToday : stats.missedAttendance).toString(), isLoading };
                case 'notices':
                    isLoading = noticesLoading;
                    return { ...item, value: stats.noticesCount.toString(), isLoading };
                case 'checkin':
                    isLoading = todayLoading;
                    return { ...item, value: typeof todayAttendance?.inTime === 'string' ? todayAttendance.inTime : '--:--', isLoading };
                case 'checkout':
                    isLoading = todayLoading;
                    return { ...item, value: typeof todayAttendance?.outTime === 'string' ? todayAttendance.outTime : '--:--', isLoading };
                case 'claim':
                    isLoading = claimLoading;
                    return { ...item, value: `৳ ${stats.claimAmount.toLocaleString()}`, isLoading };
                case 'disbursed':
                    isLoading = claimLoading;
                    return { ...item, value: `৳ ${stats.disbursedAmount.toLocaleString()}`, isLoading };
                default: return { ...item, isLoading: false };
            }
        });
    }, [selectedIds, stats, todayAttendance, isSupervisor, leaveLoading, visitLoading, attendanceLoading, noticesLoading, todayLoading, claimLoading]);

    // Derived stats from real-time data
    useEffect(() => {
        const calculateStats = () => {
            const now = new Date();
            const startOfCurrYear = startOfYear(now);
            const endOfCurrYear = endOfYear(now);
            const startOfCurrMonth = startOfMonth(now);
            const currMonth = now.getMonth();
            const currYear = now.getFullYear();

            // 1. Leave Stats
            let leafSpent = 0;
            let pendingLeaveCount = 0;
            leaveData?.forEach(doc => {
                if (doc.status === 'Approved' && doc.fromDate && doc.toDate) {
                    const start = parseISO(doc.fromDate);
                    const end = parseISO(doc.toDate);
                    const overlapStart = max([start, startOfCurrYear]);
                    const overlapEnd = min([end, endOfCurrYear]);
                    if (overlapEnd >= overlapStart) {
                        leafSpent += differenceInCalendarDays(overlapEnd, overlapStart) + 1;
                    }
                } else if (doc.status === 'Pending') {
                    pendingLeaveCount++;
                }
            });

            // 2. Visit Stats
            let visitCount = 0;
            let pendingVisitCount = 0;
            visitData?.forEach(doc => {
                if (doc.status === 'Approved' && doc.fromDate && doc.toDate) {
                    const start = parseISO(doc.fromDate);
                    const end = parseISO(doc.toDate);
                    const overlapStart = max([start, startOfCurrYear]);
                    const overlapEnd = min([end, endOfCurrYear]);
                    if (overlapEnd >= overlapStart) {
                        visitCount += doc.day ? Number(doc.day) : (differenceInCalendarDays(overlapEnd, overlapStart) + 1);
                    }
                } else if (doc.status === 'Pending') {
                    pendingVisitCount++;
                }
            });

            // 3. Attendance Stats
            let missedAttendanceCount = 0;
            let pendingAttendanceCount = 0;
            let teamMissedToday = 0;

            const todayDateStr = format(now, 'yyyy-MM-dd');

            attendanceData?.forEach(doc => {
                const date = doc.date instanceof Timestamp ? doc.date.toDate() : (typeof doc.date === 'string' ? parseISO(doc.date) : new Date(doc.date));
                const dateStr = format(date, 'yyyy-MM-dd');

                // 1. My Stats (always track my own missed attendance)
                if (doc.employeeId === (currentEmployeeId || user?.uid)) {
                    if (doc.flag === 'A' && date.getMonth() === currMonth && date.getFullYear() === currYear) {
                        missedAttendanceCount++;
                    }
                    // For non-supervisors, count my own pending items
                    if (!isSupervisor) {
                        const isPending = doc.approvalStatus === 'Pending' ||
                            doc.inTimeApprovalStatus === 'Pending' ||
                            doc.outTimeApprovalStatus === 'Pending';
                        if (isPending) {
                            pendingAttendanceCount++;
                        }
                    }
                }

                // 2. Team Stats (Subordinates/Supervised)
                if (isSupervisor) {
                    // Pending approval (uses supervisedEmployeeIds to match remote-approval page)
                    if (supervisedEmployeeIds?.includes(doc.employeeId)) {
                        const isPending = doc.approvalStatus === 'Pending' ||
                            doc.inTimeApprovalStatus === 'Pending' ||
                            doc.outTimeApprovalStatus === 'Pending';
                        if (isPending) {
                            pendingAttendanceCount++;
                        }
                    }
                }
            });

            // Special case for Team Missed Today: Align with Web "Absent (A)" logic
            // Web Logic: Total Subordinates - (Present + Delayed + Pending)
            if (isSupervisor && explicitSubordinateIds && explicitSubordinateIds.length > 0) {
                const todayAttendanceMap = new Map();

                // First, find all today's records for subordinates
                attendanceData?.forEach(doc => {
                    const date = doc.date instanceof Timestamp ? doc.date.toDate() : (typeof doc.date === 'string' ? parseISO(doc.date) : new Date(doc.date));
                    const dateStr = format(date, 'yyyy-MM-dd');
                    if (dateStr === todayDateStr && explicitSubordinateIds.includes(doc.employeeId)) {
                        todayAttendanceMap.set(doc.employeeId, doc);
                    }
                });

                let absentCount = 0;
                explicitSubordinateIds.forEach(empId => {
                    const att = todayAttendanceMap.get(empId);

                    if (!att) {
                        // No record today = Absent/Missed
                        absentCount++;
                    } else {
                        // Check if the record counts as "Not Absent" (Present or Delayed or Pending)
                        const isPending = att.approvalStatus === 'Pending' ||
                            att.inTimeApprovalStatus === 'Pending' ||
                            att.outTimeApprovalStatus === 'Pending';

                        const isActive = (att.flag === 'P' || att.flag === 'D') && att.approvalStatus !== 'Rejected';

                        // If it's not pending and not active present/delayed, it's Absent (A, L, or Rejected)
                        if (!isPending && !isActive) {
                            absentCount++;
                        }
                    }
                });
                teamMissedToday = absentCount;
            }

            setStats(prev => ({
                ...prev,
                leaveSpent: leafSpent,
                visitCount: visitCount,
                missedAttendance: missedAttendanceCount,
                teamMissedToday: teamMissedToday,
                pendingAttendanceCount: pendingAttendanceCount,
                pendingCount: pendingLeaveCount + pendingVisitCount + pendingAttendanceCount
            }));
        };

        if (attendanceData || leaveData || visitData) {
            calculateStats();
        }
    }, [attendanceData, leaveData, visitData, isSupervisor, explicitSubordinateIds, supervisedEmployeeIds, currentEmployeeId]);

    useEffect(() => {
        if (claimData) {
            const totalClaimed = claimData.reduce((sum, doc) => sum + (doc.claimAmount || 0), 0);
            const totalDisbursed = claimData.filter(doc => doc.status === 'Disbursed').reduce((sum, doc) => sum + (doc.approvedAmount || 0), 0);
            setStats(prev => ({ ...prev, claimAmount: totalClaimed, disbursedAmount: totalDisbursed }));
        }
    }, [claimData]);

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
        const canonicalId = currentEmployeeId || user?.uid;
        if (!canonicalId) return;

        try {
            const today = new Date();
            const dateKey = format(today, 'yyyy-MM-dd');
            const docId = `${canonicalId}_${dateKey}`;

            const attendanceDoc = await getDoc(doc(firestore, 'attendance', docId));
            if (attendanceDoc.exists()) {
                const data = attendanceDoc.data();
                setTodayAttendance({
                    inTime: data.inTime,
                    outTime: data.outTime,
                    flag: data.flag,
                    approvalStatus: data.approvalStatus,
                    inTimeApprovalStatus: data.inTimeApprovalStatus,
                    outTimeApprovalStatus: data.outTimeApprovalStatus
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
    // We already have state listeners, so we don't need a mid-loading state for UI, 
    // but skeletons are good if data is still fetching.

    return (
        <div className="flex flex-col h-[100dvh] bg-[#0a1e60] overflow-hidden">
            {/* Sticky Header - stays fixed during pull */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <MobileHeader />
            </div>

            <motion.div
                ref={containerRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain relative transition-transform duration-200 ease-out shadow-[0_-8px_30px_rgba(0,0,0,0.2)]"
                style={{
                    transform: `translateY(${isRefreshing ? 60 : pullDistance > 0 ? pullDistance * 0.4 : 0}px) translateZ(0)`,
                    backgroundColor: '#f8fafc',
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
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
                    <div className={cn(
                        "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600",
                        (isRefreshing || pullDistance > 40) ? 'opacity-100' : 'opacity-0'
                    )}></div>
                </div>

                <div className="px-4 pt-6 pb-[120px] space-y-6">
                    {/* Attendance Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* In Time Card */}
                        <Card className="p-5 rounded-3xl border border-slate-100 shadow-xl bg-white relative overflow-hidden group/card flex flex-col items-center justify-center min-h-[180px]">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover/card:scale-110 duration-700" />

                            <div className="flex flex-col items-center gap-4 relative z-10 w-full">
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => {
                                        setAttendanceType('in');
                                        setIsAttendanceModalOpen(true);
                                    }}
                                    disabled={!!todayAttendance?.inTime || !!restrictionNote}
                                    className={cn(
                                        "h-24 w-24 rounded-full flex flex-col items-center justify-center gap-1 transition-all shadow-lg relative group/btn",
                                        todayAttendance?.inTime
                                            ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white ring-4 ring-emerald-50"
                                            : !!restrictionNote
                                                ? "bg-slate-50 text-slate-300 border-2 border-dashed border-slate-200"
                                                : "bg-gradient-to-br from-blue-600 to-cyan-500 text-white hover:brightness-110"
                                    )}
                                >
                                    <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                    {!todayAttendance?.inTime && !restrictionNote && (
                                        <>
                                            <div className="absolute inset-0 rounded-full bg-sky-500 opacity-20 animate-ping [animation-duration:6000ms] pointer-events-none z-[-1]" />
                                            <div className="absolute inset-0 rounded-full bg-sky-500 opacity-20 animate-ping [animation-duration:6000ms] pointer-events-none z-[-1]" style={{ animationDelay: '3000ms' }} />
                                        </>
                                    )}
                                    <Clock className="h-6 w-6 mb-0.5" />
                                    <span className="text-xs font-semibold">In Time</span>
                                    {todayAttendance?.inTime && (
                                        <span className="text-[10px] font-medium bg-white/20 px-1.5 py-0.5 rounded-full">{formatAttendanceTime(todayAttendance.inTime)}</span>
                                    )}
                                </motion.button>
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Status</span>
                                    <span className="text-[11px] font-semibold text-slate-700 text-center px-1 font-mono">
                                        {restrictionNote || getAttendanceStatus(todayAttendance?.flag, todayAttendance?.approvalStatus, todayAttendance?.inTimeApprovalStatus, todayAttendance?.outTimeApprovalStatus) || '08:00 hr(s)'}
                                    </span>
                                </div>
                            </div>
                        </Card>

                        {/* Out Time Card */}
                        <Card className="p-5 rounded-3xl border border-slate-100 shadow-xl bg-white relative overflow-hidden group/card flex flex-col items-center justify-center min-h-[180px]">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover/card:scale-110 duration-700" />

                            <div className="flex flex-col items-center gap-4 relative z-10 w-full">
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => {
                                        setAttendanceType('out');
                                        setIsAttendanceModalOpen(true);
                                    }}
                                    disabled={!todayAttendance?.inTime || !!todayAttendance?.outTime || !!restrictionNote}
                                    className={cn(
                                        "h-24 w-24 rounded-full flex flex-col items-center justify-center gap-1 transition-all relative group/btn shadow-lg",
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
                                    {todayAttendance?.inTime && !todayAttendance?.outTime && !restrictionNote && (
                                        <>
                                            <div className="absolute inset-0 rounded-full bg-sky-500 opacity-20 animate-ping [animation-duration:6000ms] pointer-events-none z-[-1]" />
                                            <div className="absolute inset-0 rounded-full bg-sky-500 opacity-20 animate-ping [animation-duration:6000ms] pointer-events-none z-[-1]" style={{ animationDelay: '3000ms' }} />
                                        </>
                                    )}
                                    <Clock className="h-6 w-6 mb-0.5" />
                                    <span className="text-xs font-semibold">Out Time</span>
                                    {todayAttendance?.outTime && (
                                        <span className="text-[10px] font-medium bg-white/20 px-1.5 py-0.5 rounded-full">{formatAttendanceTime(todayAttendance.outTime)}</span>
                                    )}
                                </motion.button>
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Worked</span>
                                    <span className="text-[11px] font-semibold text-slate-700 font-mono text-center">
                                        {restrictionNote ? '---' :
                                            todayAttendance?.outTimeApprovalStatus === 'Pending' ? 'Waiting For Approval' :
                                                calculateWorkHours(todayAttendance?.inTime, todayAttendance?.outTime) || 'Waiting...'}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Summary Section */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="font-bold text-lg text-slate-800">Summary</h2>
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setIsSettingsOpen(true)}
                                className="h-10 w-10 bg-white shadow-lg text-blue-600 rounded-xl border border-slate-100 flex items-center justify-center transition-all hover:bg-slate-50"
                            >
                                <Settings className="h-5 w-5" />
                            </motion.button>
                        </div>

                        {/* Horizontal Scrollable Container */}
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                            {visibleItems.map((item) => {
                                const Icon = item.icon;
                                const content = (
                                    <motion.div
                                        whileTap={{ scale: 0.95 }}
                                        className={`flex-shrink-0 w-[140px] ${item.bgColor} p-4 rounded-[2rem] flex flex-col h-40 relative overflow-hidden shadow-sm border border-white/50 group/item hover:shadow-md transition-all`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className={`bg-white rounded-2xl p-2.5 w-12 h-12 flex items-center justify-center shadow-lg ${item.textColor} group-hover/item:scale-110 transition-transform duration-300`}>
                                                <Icon className="h-6 w-6" />
                                            </div>
                                            {(item.id !== 'checkin' && item.id !== 'checkout') && (
                                                <div className="text-xl font-semibold text-[#0a1e60] tracking-tighter pr-1">
                                                    {(item as any).isLoading ? (
                                                        <div className="h-6 w-10 bg-slate-200/50 animate-pulse rounded-md" />
                                                    ) : String(item.value)}
                                                </div>
                                            )}
                                        </div>

                                        {(item.id === 'checkin' || item.id === 'checkout') ? (
                                            <div className="mt-1">
                                                <div className="text-lg font-bold text-[#0a1e60] tracking-tight">
                                                    {(item as any).isLoading ? (
                                                        <div className="h-6 w-20 bg-slate-200/50 animate-pulse rounded-md" />
                                                    ) : String(item.value)}
                                                </div>
                                            </div>
                                        ) : null}

                                        <div className="mt-auto">
                                            <div className="text-[11px] font-semibold text-slate-800 uppercase tracking-tight">{item.label}</div>
                                            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest leading-none">{item.subLabel}</div>
                                        </div>
                                    </motion.div>
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
                                        <Link key={item.id} href="/mobile/attendance/remote-approval" className="flex-shrink-0 transition-transform active:scale-95">
                                            {content}
                                        </Link>
                                    );
                                }

                                if (item.id === 'notices') {
                                    return (
                                        <Link key={item.id} href="/mobile/notice-board" className="flex-shrink-0 transition-transform active:scale-95">
                                            {content}
                                        </Link>
                                    );
                                }

                                if (item.id === 'claim' || item.id === 'disbursed') {
                                    return (
                                        <Link key={item.id} href="/mobile/claim" className="flex-shrink-0 transition-transform active:scale-95">
                                            {content}
                                        </Link>
                                    );
                                }

                                if (item.id === 'missed') {
                                    return (
                                        <Link key={item.id} href="/mobile/attendance/team-attendance" className="flex-shrink-0 transition-transform active:scale-95">
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

                                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center pb-[45px]">
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
                        <h2 className="font-bold text-lg text-slate-800 mb-4 px-1">Modules</h2>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                            {/* Break Time */}
                            <button
                                onClick={openBreakModal}
                                className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] transition-all hover:shadow-md hover:bg-slate-50 active:scale-95 text-center w-full group"
                            >
                                <div className={cn(
                                    "p-4 rounded-full h-14 w-14 flex items-center justify-center transition-all shadow-lg group-hover:scale-110",
                                    isOnBreak ? "bg-orange-100 text-orange-600 animate-pulse shadow-orange-200" : "bg-blue-100 text-blue-600 shadow-blue-200"
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
                            <Link
                                href="/mobile/project-management"
                                className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] transition-all hover:shadow-md hover:bg-slate-50 active:scale-95 group"
                            >
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center transition-all shadow-lg shadow-blue-200 group-hover:scale-110">
                                    <ListTodo className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center">Task</span>
                            </Link>

                            {/* Check In/Out */}
                            <Link
                                href="/mobile/check-in-out"
                                className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] transition-all hover:shadow-md hover:bg-slate-50 active:scale-95 group"
                            >
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center transition-all shadow-lg shadow-blue-200 group-hover:scale-110">
                                    <LogIn className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center leading-tight">Check In/Out</span>
                            </Link>


                            {/* Claim */}
                            <Link
                                href="/mobile/claim"
                                className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] transition-all hover:shadow-md hover:bg-slate-50 active:scale-95 group"
                            >
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center transition-all shadow-lg shadow-blue-200 group-hover:scale-110">
                                    <Wallet className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center">Claim</span>
                            </Link>


                            {/* Directory */}
                            <Link
                                href="/mobile/directory"
                                className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] transition-all hover:shadow-md hover:bg-slate-50 active:scale-95 group"
                            >
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center transition-all shadow-lg shadow-blue-200 group-hover:scale-110">
                                    <Users className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center">Directory</span>
                            </Link>

                            {/* Assets */}
                            <Link
                                href="/mobile/assets"
                                className="bg-white p-4 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm min-h-[120px] transition-all hover:shadow-md hover:bg-slate-50 active:scale-95 group"
                            >
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600 h-14 w-14 flex items-center justify-center transition-all shadow-lg shadow-blue-200 group-hover:scale-110">
                                    <UserCheck className="h-7 w-7" />
                                </div>
                                <span className="text-sm font-medium text-slate-600 text-center">Assets</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </motion.div>

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
