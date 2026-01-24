"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip
} from 'recharts';
import {
    ChevronLeft,
    Calendar,
    History,
    Loader2,
    Info,
    TrendingUp,
    ArrowLeft,
    PieChart as PieChartIcon
} from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    onSnapshot,
    orderBy
} from 'firebase/firestore';
import {
    format,
    parseISO,
    startOfYear,
    endOfYear,
    max,
    min,
    differenceInCalendarDays
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import type {
    EmployeeDocument,
    LeaveApplicationDocument,
    LeaveGroupDocument,
    LeavePolicyRule
} from '@/types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function MyLeaveBalancePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [employee, setEmployee] = useState<EmployeeDocument | null>(null);
    const [leaveGroup, setLeaveGroup] = useState<LeaveGroupDocument | null>(null);
    const [leaves, setLeaves] = useState<LeaveApplicationDocument[]>([]);
    const [viewMode, setViewMode] = useState<'pie' | 'bar'>('pie');
    const [startX, setStartX] = useState(0);
    const [currentX, setCurrentX] = useState(0);

    // 0. Handle Auth Loading
    useEffect(() => {
        // If auth is done loading and we have no user, redirect
        // (Though layout should handle this, it's good to be safe)
        if (!authLoading && !user) {
            router.replace('/mobile/login');
        }
    }, [user, authLoading, router]);

    // Fetch Employee and Leave Data
    useEffect(() => {
        if (authLoading) return; // Wait for auth
        if (!user?.email) {
            // Should have redirected above, but if we are here and no email, stop loading
            if (!authLoading) setLoading(false);
            return;
        }

        let isMounted = true;

        // 1. Safety Timeout - Force stop loading after 10 seconds if something hangs
        const safetyTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn("Leave Balance data fetch timed out. Creating empty state.");
                setLoading(false);
            }
        }, 10000);

        const fetchData = async () => {
            setLoading(true);
            try {

                // 1. Fetch Employee
                const empQuery = query(collection(firestore, 'employees'), where('email', '==', user.email));
                const empSnap = await getDocs(empQuery);

                if (empSnap.empty) {
                    console.error("Employee not found for email:", user.email);
                    if (isMounted) setLoading(false);
                    return;
                }

                const empData = { id: empSnap.docs[0].id, ...empSnap.docs[0].data() } as EmployeeDocument;
                if (isMounted) setEmployee(empData);

                // 2. Fetch Leave Group Policy
                if (empData.leaveGroupId) {
                    const groupRef = doc(firestore, 'hrm_settings', 'leave_groups', 'items', empData.leaveGroupId);
                    const groupSnap = await getDoc(groupRef);
                    if (groupSnap.exists()) {
                        if (isMounted) setLeaveGroup({ id: groupSnap.id, ...groupSnap.data() } as LeaveGroupDocument);
                    } else {
                        // console.warn(`Leave Group doc not found: ${empData.leaveGroupId}`);
                    }
                } else {
                    // console.warn("No Leave Group ID found in employee record.");
                }

                // 3. Fetch Personal Leaves (Real-time listener for history)
                // We rely on onSnapshot to turn off loading usually, but if there are no leaves?
                // Actually onSnapshot fires immediately with empty array if nothing found.
                // But just in case, we will toggle loading off here for the initial fetch part.

                const leavesQuery = query(
                    collection(firestore, 'leave_applications'),
                    where('employeeId', '==', empData.id),
                    orderBy('fromDate', 'desc')
                );

                const unsubscribe = onSnapshot(leavesQuery, (snapshot) => {
                    const updatedLeaves = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as LeaveApplicationDocument));

                    if (isMounted) {
                        setLeaves(updatedLeaves);
                        // Important: Turn off loading now that we have data!
                        setLoading(false);
                    }
                }, (error) => {
                    console.error("Error in leave snapshot listener:", error);
                    if (isMounted) setLoading(false);
                });

                return () => unsubscribe();
            } catch (error) {
                console.error("Error fetching leave data:", error);
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        return () => {
            isMounted = false;
            clearTimeout(safetyTimeout);
        };
    }, [user, authLoading]);

    // Swipe logic for horizontal tab swap
    const handleTouchStart = (e: React.TouchEvent) => {
        setStartX(e.touches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setCurrentX(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
        const diff = startX - currentX;
        const threshold = 50;

        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                // Swipe Left -> Next Tab (Pie to Bar)
                if (viewMode === 'pie') setViewMode('bar');
            } else {
                // Swipe Right -> Prev Tab (Bar to Pie)
                if (viewMode === 'bar') setViewMode('pie');
            }
        }
        setStartX(0);
        setCurrentX(0);
    };

    // Calculate Balances
    const balanceData = useMemo(() => {
        if (!leaveGroup) return [];

        const startOfCurrentYear = startOfYear(new Date());
        const endOfCurrentYear = endOfYear(new Date());

        return leaveGroup.policies.map(policy => {
            let usedDays = 0;
            leaves.forEach(l => {
                if (l.status === 'Approved' && l.leaveType === policy.leaveTypeName) {
                    const leaveStart = parseISO(l.fromDate);
                    const leaveEnd = parseISO(l.toDate);

                    const overlapStart = max([leaveStart, startOfCurrentYear]);
                    const overlapEnd = min([leaveEnd, endOfCurrentYear]);

                    if (overlapEnd >= overlapStart) {
                        usedDays += differenceInCalendarDays(overlapEnd, overlapStart) + 1;
                    }
                }
            });

            return {
                name: policy.leaveTypeName,
                allowed: policy.allowedBalance,
                used: usedDays,
                remaining: Math.max(0, policy.allowedBalance - usedDays)
            };
        });
    }, [leaveGroup, leaves]);

    // Pie Chart Data (Total Taken vs Total Remaining)
    const pieData = useMemo(() => {
        const totalUsed = balanceData.reduce((sum, item) => sum + item.used, 0);
        const totalRemaining = balanceData.reduce((sum, item) => sum + item.remaining, 0);

        return [
            { name: 'Used', value: totalUsed, color: '#ef4444' },
            { name: 'Remaining', value: totalRemaining, color: '#3b82f6' }
        ];
    }, [balanceData]);

    const SkeletonLoader = () => (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 pt-[14px] pb-6">
                    <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
                    <Skeleton className="h-6 w-40 ml-4 bg-white/10" />
                </div>
            </div>
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] p-6 space-y-6">
                <Skeleton className="h-[300px] w-full rounded-2xl" />
                <div className="space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                </div>
            </div>
        </div>
    );

    if (loading) return <SkeletonLoader />;

    // if (!leaveGroup && !loading) { ... } // Removed blocking check to allow history to show

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden font-sans">
            {/* Solid Header with App Color */}
            <div className="sticky top-0 z-50 bg-[#0a1e60] border-b border-white/5">
                <div className="flex items-center px-4 pt-[14px] pb-6">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-lg bg-white/5 backdrop-blur-sm border border-white/10"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </motion.button>
                    <h1 className="text-xl font-bold ml-3 text-white">
                        Leave Balance
                    </h1>
                </div>
            </div>

            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain shadow-[0_-8px_30px_rgba(0,0,0,0.2)]">
                <div className="px-5 pt-8 pb-[120px] space-y-8">

                    {/* Charts Section with Glassmorphism */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {!leaveGroup ? (
                            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
                                <CardContent className="flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                                    <div className="h-20 w-20 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                                        <Info className="h-10 w-10 text-amber-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800 mb-2">No Policy Assigned</h2>
                                    <p className="text-slate-500 text-sm">
                                        Your account is not linked to any leave policy. Please contact HR to update your employment details.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg font-black tracking-tight text-slate-800 flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-indigo-500" />
                                        Visual Summary
                                    </CardTitle>
                                    {/* Horizontal Tabs */}
                                    <div className="flex items-center justify-center gap-2 pt-4">
                                        {(['pie', 'bar'] as const).map((mode) => (
                                            <button
                                                key={mode}
                                                onClick={() => setViewMode(mode)}
                                                className={cn(
                                                    "py-2 px-6 rounded-full text-xs font-bold transition-all duration-300",
                                                    viewMode === mode
                                                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200 scale-105"
                                                        : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                                                )}
                                            >
                                                {mode === 'pie' ? 'Overview' : 'Details'}
                                            </button>
                                        ))}
                                    </div>
                                </CardHeader>
                                <CardContent
                                    className="pt-4 px-2"
                                    onTouchStart={handleTouchStart}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                >
                                    <div className="h-[280px] w-full relative">
                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={viewMode}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ duration: 0.3 }}
                                                className="h-full w-full"
                                            >
                                                <ResponsiveContainer width="100%" height="100%">
                                                    {viewMode === 'pie' ? (
                                                        <PieChart>
                                                            <Pie
                                                                data={pieData}
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius={65}
                                                                outerRadius={90}
                                                                paddingAngle={8}
                                                                dataKey="value"
                                                                animationDuration={1500}
                                                                animationBegin={200}
                                                            >
                                                                {pieData.map((entry, index) => (
                                                                    <Cell
                                                                        key={`cell-${index}`}
                                                                        fill={entry.color}
                                                                        strokeWidth={0}
                                                                    />
                                                                ))}
                                                            </Pie>
                                                            <RechartsTooltip
                                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                                            />
                                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                                        </PieChart>
                                                    ) : (
                                                        <BarChart
                                                            data={balanceData}
                                                            margin={{ top: 20, right: 30, left: -20, bottom: 20 }}
                                                        >
                                                            <defs>
                                                                <linearGradient id="barUsed" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                                                                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
                                                                </linearGradient>
                                                                <linearGradient id="barRem" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                                                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                            <XAxis
                                                                dataKey="name"
                                                                axisLine={false}
                                                                tickLine={false}
                                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                                            />
                                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                                            <BarTooltip
                                                                cursor={{ fill: 'rgba(51, 65, 85, 0.05)' }}
                                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                                                            />
                                                            <Bar dataKey="used" fill="url(#barUsed)" radius={[8, 8, 0, 0]} barSize={16} animationDuration={1500} />
                                                            <Bar dataKey="remaining" fill="url(#barRem)" radius={[8, 8, 0, 0]} barSize={16} animationDuration={1500} />
                                                        </BarChart>
                                                    )}
                                                </ResponsiveContainer>
                                            </motion.div>
                                        </AnimatePresence>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </motion.div>

                    {/* Breakdown List - Only show if policy exists */}
                    {leaveGroup && (
                        <div className="space-y-5">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 px-1">
                                <span className="h-8 w-1.5 rounded-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
                                Leave Breakdown
                            </h2>
                            <div className="grid grid-cols-1 gap-4">
                                {balanceData.map((item, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-all duration-300 group touch-none"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <Calendar className="h-6 w-6 text-indigo-600" />
                                            </div>
                                            <div>
                                                <div className="text-base font-black text-slate-800">{item.name}</div>
                                                <div className="text-xs text-slate-400 font-bold uppercase tracking-tight">Total: {item.allowed} Days</div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="text-2xl font-black text-indigo-600 leading-none">{item.remaining}</div>
                                            <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Left</div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* History Section */}
                    <div className="space-y-5 pb-10">
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 px-1">
                            <span className="h-8 w-1.5 rounded-full bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.4)]" />
                            Recent Activity
                        </h2>
                        <div className="space-y-4">
                            {leaves.length > 0 ? (
                                leaves.slice(0, 5).map((leave, index) => {
                                    const statusConfig = {
                                        'Approved': { color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: 'bg-emerald-500' },
                                        'Pending': { color: 'text-amber-600 bg-amber-50 border-amber-100', icon: 'bg-amber-500' },
                                        'Rejected': { color: 'text-rose-600 bg-rose-50 border-rose-100', icon: 'bg-rose-500' }
                                    }[leave.status] || { color: 'text-slate-600 bg-slate-50 border-slate-100', icon: 'bg-slate-400' };

                                    return (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.2 + index * 0.05 }}
                                            className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 flex gap-4 items-start"
                                        >
                                            <div className={cn("w-1 h-12 rounded-full", statusConfig.icon)} />
                                            <div className="flex-1 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <div className="text-base font-black text-slate-800 leading-tight">
                                                            {leave.leaveType}
                                                        </div>
                                                        <div className="text-xs text-slate-400 font-bold mt-0.5">
                                                            {format(parseISO(leave.fromDate), 'dd MMM')} — {format(parseISO(leave.toDate), 'dd MMM yyyy')}
                                                        </div>
                                                    </div>
                                                    <div className={cn("text-[9px] font-black px-3 py-1.5 rounded-full border uppercase tracking-wider", statusConfig.color)}>
                                                        {leave.status}
                                                    </div>
                                                </div>
                                                {leave.reason && (
                                                    <div className="p-4 bg-slate-50 rounded-[1.5rem] text-xs font-medium text-slate-600 border border-slate-100/50 leading-relaxed italic">
                                                        "{leave.reason}"
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-16 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 shadow-inner">
                                    <History className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                    <p className="text-slate-400 text-sm font-black uppercase tracking-widest">No Activity Yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
