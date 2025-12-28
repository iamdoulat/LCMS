"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import type { EmployeeDocument, LeaveGroupDocument, LeaveApplicationDocument } from '@/types';
import { cn } from '@/lib/utils';

interface EmployeeLeaveBalance {
    employee: EmployeeDocument;
    leaveBalances: {
        leaveType: string;
        totalDays: number;
        takenDays: number;
        remainingDays: number;
    }[];
}

export default function SubOrdinateLeaveBalancePage() {
    const router = useRouter();
    const { user } = useAuth();
    const { supervisedEmployeeIds } = useSupervisorCheck(user?.email);

    const [loading, setLoading] = useState(true);
    const [employeeBalances, setEmployeeBalances] = useState<EmployeeLeaveBalance[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchLeaveBalances = async () => {
            if (!supervisedEmployeeIds.length) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                // Fetch all supervised employees
                const employeesPromises = supervisedEmployeeIds.map(async (empId) => {
                    const empDoc = await getDocs(
                        query(collection(firestore, 'employees'), where('__name__', '==', empId))
                    );
                    if (!empDoc.empty) {
                        return { id: empDoc.docs[0].id, ...empDoc.docs[0].data() } as EmployeeDocument;
                    }
                    return null;
                });

                const employees = (await Promise.all(employeesPromises)).filter(Boolean) as EmployeeDocument[];

                // Fetch leave groups
                const leaveGroupsSnapshot = await getDocs(
                    collection(firestore, 'hrm_settings/leave_groups/items')
                );
                const leaveGroups = leaveGroupsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as LeaveGroupDocument[];

                // Fetch all leave applications for supervised employees
                const leaveAppsSnapshot = await getDocs(
                    query(
                        collection(firestore, 'leave_applications'),
                        where('employeeId', 'in', supervisedEmployeeIds.slice(0, 10)) // Firestore limit
                    )
                );
                const leaveApplications = leaveAppsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as LeaveApplicationDocument[];

                // Calculate balances for each employee
                const balances: EmployeeLeaveBalance[] = employees.map(employee => {
                    const leaveGroup = leaveGroups.find(lg => lg.id === employee.leaveGroupId);

                    if (!leaveGroup) {
                        return {
                            employee,
                            leaveBalances: []
                        };
                    }

                    const leaveBalances = leaveGroup.policies.map(policy => {
                        // Calculate taken days for this leave type
                        const takenDays = leaveApplications
                            .filter(app =>
                                app.employeeId === employee.id &&
                                app.leaveType === policy.leaveTypeName &&
                                app.status === 'Approved'
                            )
                            .reduce((sum, app) => {
                                const from = new Date(app.fromDate);
                                const to = new Date(app.toDate);
                                const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                return sum + days;
                            }, 0);

                        return {
                            leaveType: policy.leaveTypeName,
                            totalDays: policy.allowedBalance,
                            takenDays,
                            remainingDays: policy.allowedBalance - takenDays
                        };
                    });

                    return {
                        employee,
                        leaveBalances
                    };
                });

                setEmployeeBalances(balances);
            } catch (error) {
                console.error("Error fetching leave balances:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaveBalances();
    }, [supervisedEmployeeIds]);

    const toggleExpanded = (employeeId: string) => {
        setExpandedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(employeeId)) {
                newSet.delete(employeeId);
            } else {
                newSet.add(employeeId);
            }
            return newSet;
        });
    };

    const getInitials = (name?: string) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

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
                    <h1 className="text-xl font-bold text-white ml-2">Sub-Ordinate Leave Balance</h1>
                </div>
            </div>

            {/* Employee Cards Container */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain px-5 pt-8 space-y-3">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl p-4 shadow-sm animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="h-14 w-14 rounded-full bg-slate-200" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-32 bg-slate-200 rounded" />
                                    <div className="h-3 w-48 bg-slate-100 rounded" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : employeeBalances.length > 0 ? (
                    employeeBalances.map(({ employee, leaveBalances }) => {
                        const isExpanded = expandedIds.has(employee.id);

                        return (
                            <div key={employee.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                {/* Employee Header */}
                                <button
                                    onClick={() => toggleExpanded(employee.id)}
                                    className="w-full p-4 flex items-center gap-3 active:bg-slate-50 transition-colors"
                                >
                                    <Avatar className="h-14 w-14">
                                        <AvatarImage src={employee.photoURL} />
                                        <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                                            {getInitials(employee.fullName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 text-left">
                                        <h3 className="font-bold text-[#0a1e60] text-base">
                                            {employee.fullName}
                                        </h3>
                                        <p className="text-sm text-slate-500 line-clamp-1">
                                            {employee.designation}
                                        </p>
                                    </div>
                                    <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                                        {isExpanded ? (
                                            <ChevronUp className="h-5 w-5 text-blue-600" />
                                        ) : (
                                            <ChevronDown className="h-5 w-5 text-blue-600" />
                                        )}
                                    </div>
                                </button>

                                {/* Expanded Leave Balance */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-slate-100">
                                        <div className="pt-4">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-sm font-bold text-slate-700">Leave Balances</h4>
                                                <div className="flex gap-3 text-xs">
                                                    <div className="flex items-center gap-1">
                                                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                                        <span className="text-slate-600">Leave remaining</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                                                        <span className="text-slate-600">Leave taken</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Leave Type Bars */}
                                            <div className="flex gap-6 justify-center">
                                                {leaveBalances.map((balance, idx) => {
                                                    const remainingPercentage = (balance.remainingDays / balance.totalDays) * 100;
                                                    const takenPercentage = (balance.takenDays / balance.totalDays) * 100;

                                                    return (
                                                        <div key={idx} className="flex flex-col items-center">
                                                            <div className="relative h-40 w-12 bg-slate-100 rounded-full overflow-hidden flex flex-col-reverse">
                                                                {/* Taken (blue, bottom) */}
                                                                <div
                                                                    className="bg-gradient-to-t from-blue-500 to-blue-400 transition-all relative"
                                                                    style={{ height: `${takenPercentage}%` }}
                                                                >
                                                                    {balance.takenDays > 0 && (
                                                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white transform -rotate-90">
                                                                            Taken {balance.takenDays}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {/* Remaining (green, top) */}
                                                                <div
                                                                    className="bg-gradient-to-t from-emerald-400 to-emerald-500 transition-all relative"
                                                                    style={{ height: `${remainingPercentage}%` }}
                                                                >
                                                                    {balance.remainingDays > 0 && (
                                                                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white transform -rotate-90">
                                                                            Remaining {balance.remainingDays}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <p className="text-xs font-medium text-slate-700 mt-2">
                                                                {balance.leaveType}
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <ArrowLeft className="h-10 w-10 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-medium">No subordinates found</p>
                    </div>
                )}
                {/* Spacer bottom */}
                <div className="h-24" />
            </div>
        </div>
    );
}
