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
    ArrowLeft
} from 'lucide-react';
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
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [employee, setEmployee] = useState<EmployeeDocument | null>(null);
    const [leaveGroup, setLeaveGroup] = useState<LeaveGroupDocument | null>(null);
    const [leaves, setLeaves] = useState<LeaveApplicationDocument[]>([]);
    const [viewMode, setViewMode] = useState<'pie' | 'bar'>('pie');
    const [startX, setStartX] = useState(0);
    const [currentX, setCurrentX] = useState(0);

    // Fetch Employee and Leave Data
    useEffect(() => {
        if (!user?.email) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Employee
                const empQuery = query(collection(firestore, 'employees'), where('email', '==', user.email));
                const empSnap = await getDocs(empQuery);

                if (empSnap.empty) {
                    setLoading(false);
                    return;
                }

                const empData = { id: empSnap.docs[0].id, ...empSnap.docs[0].data() } as EmployeeDocument;
                setEmployee(empData);

                // 2. Fetch Leave Group Policy
                if (empData.leaveGroupId) {
                    const groupRef = doc(firestore, 'hrm_settings', 'leave_groups', 'items', empData.leaveGroupId);
                    const groupSnap = await getDoc(groupRef);
                    if (groupSnap.exists()) {
                        setLeaveGroup({ id: groupSnap.id, ...groupSnap.data() } as LeaveGroupDocument);
                    }
                }

                // 3. Fetch Personal Leaves (Real-time listener for history)
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
                    setLeaves(updatedLeaves);
                    setLoading(false);
                });

                return () => unsubscribe();
            } catch (error) {
                console.error("Error fetching leave data:", error);
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

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

    if (loading) {
        return (
            <div className="flex flex-col h-screen bg-[#0a1e60] items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin mb-4" />
                <p className="text-white font-medium">Loading Balance...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 py-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2">My Leave Balance</h1>
                </div>
            </div>

            <div className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-y-auto overscroll-contain">
                <div className="px-6 pt-6 pb-[120px] space-y-6">

                    {/* Charts Section */}
                    <Card className="rounded-2xl border-none shadow-md overflow-hidden">
                        <CardHeader className="pb-2 border-b">
                            <CardTitle className="text-lg font-bold text-slate-800">Visual Summary</CardTitle>
                            {/* Horizontal Tabs */}
                            <div className="flex items-center justify-center gap-4 pt-3">
                                {(['pie', 'bar'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setViewMode(mode)}
                                        className={cn(
                                            "pb-2 relative text-sm font-semibold transition-colors capitalize px-4 border-b-2",
                                            viewMode === mode ? "text-blue-600 border-blue-600" : "text-slate-400 border-transparent"
                                        )}
                                    >
                                        {mode === 'pie' ? 'Pie Chart' : 'Bar Chart'}
                                    </button>
                                ))}
                            </div>
                        </CardHeader>
                        <CardContent
                            className="pt-6"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    {viewMode === 'pie' ? (
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    ) : (
                                        <BarChart
                                            data={balanceData}
                                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 10 }}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                            <BarTooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                            <Bar dataKey="used" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                                            <Bar dataKey="remaining" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                        </BarChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Breakdown List */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Info className="h-5 w-5 text-blue-600" />
                            Breakdown by Type
                        </h2>
                        <div className="grid grid-cols-1 gap-3">
                            {balanceData.map((item, index) => (
                                <div key={index} className="bg-white p-4 rounded-2xl shadow-md border border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                            <Calendar className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">{item.name}</div>
                                            <div className="text-[10px] text-slate-500 font-medium">Policy: {item.allowed} Days</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-blue-600">{item.remaining}</div>
                                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Remaining</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* History Section */}
                    <div className="space-y-4 pb-12">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <History className="h-5 w-5 text-blue-600" />
                            Leave History
                        </h2>
                        <div className="space-y-3">
                            {leaves.length > 0 ? (
                                leaves.map((leave, index) => {
                                    const statusColor = {
                                        'Approved': 'text-emerald-600 bg-emerald-50 border-emerald-100',
                                        'Pending': 'text-amber-600 bg-amber-50 border-amber-100',
                                        'Rejected': 'text-red-600 bg-red-50 border-red-100'
                                    }[leave.status] || 'text-slate-600 bg-slate-50 border-slate-100';

                                    return (
                                        <div key={index} className="bg-white p-4 rounded-2xl shadow-md border border-slate-100 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{leave.leaveType} Leave</div>
                                                    <div className="text-xs text-slate-500">
                                                        {format(parseISO(leave.fromDate), 'dd MMM')} - {format(parseISO(leave.toDate), 'dd MMM yyyy')}
                                                    </div>
                                                </div>
                                                <div className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider", statusColor)}>
                                                    {leave.status}
                                                </div>
                                            </div>
                                            {leave.reason && (
                                                <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600 italic">
                                                    "{leave.reason}"
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                                    <History className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-400 text-sm font-medium">No leave history found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
