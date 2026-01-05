"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Search,
    MapPin,
    MoreHorizontal,
    Loader2,
    UserCheck,
    Clock,
    Check,
    X,
    AlertTriangle,
    Users
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { determineAttendanceFlag } from '@/lib/firebase/utils';
import type { EmployeeDocument, AttendanceDocument, BranchDocument } from '@/types';
import { RoleBadge } from '@/components/ui/RoleBadge';

interface TeamAttendanceCardProps {
    supervisedEmployeeIds: string[];
}

const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

export function TeamAttendanceCard({ supervisedEmployeeIds }: TeamAttendanceCardProps) {
    const router = useRouter();
    const [employees, setEmployees] = useState<EmployeeDocument[]>([]);
    const [attendance, setAttendance] = useState<AttendanceDocument[]>([]);
    const [branches, setBranches] = useState<BranchDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'P' | 'A' | 'D' | 'Pending'>('All');

    // Fetch supervised employees
    useEffect(() => {
        if (!supervisedEmployeeIds || supervisedEmployeeIds.length === 0) {
            setEmployees([]);
            setIsLoading(false);
            return;
        }

        const fetchEmployees = async () => {
            try {
                // Firebase 'in' operator has a limit of 10-30 depending on version, 
                // but usually the project's supervisor list isn't huge.
                // If it grows, we might need chunking.
                const q = query(
                    collection(firestore, 'employees'),
                    where('id', 'in', supervisedEmployeeIds.slice(0, 30))
                );
                const snapshot = await getDocs(q);
                const empData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmployeeDocument));
                setEmployees(empData);
            } catch (error) {
                console.error("Error fetching team employees:", error);
            }
        };

        fetchEmployees();
    }, [supervisedEmployeeIds]);

    // Fetch Branches for Radius Validation
    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const q = query(collection(firestore, 'branches'));
                const snapshot = await getDocs(q);
                const branchData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BranchDocument));
                setBranches(branchData);
            } catch (error) {
                console.error("Error fetching branches:", error);
            }
        };
        fetchBranches();
    }, []);

    // Helper: Calculate Distance (Haversine Formula)
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // in metres
    };

    // Helper: Handle Approval
    const handleApprove = async (attendanceId: string, time: string | undefined, type: 'in' | 'out') => {
        try {
            const updateData: any = {};
            if (type === 'in') {
                const newFlag = determineAttendanceFlag(time);
                updateData.flag = newFlag;
                updateData.inTimeApprovalStatus = 'Approved';
                // For backward compatibility, also update general status
                updateData.approvalStatus = 'Approved';
            } else {
                updateData.outTimeApprovalStatus = 'Approved';
            }

            const ref = doc(firestore, 'attendance', attendanceId);
            await updateDoc(ref, updateData);
            Swal.fire({
                icon: 'success',
                title: 'Approved',
                text: `${type === 'in' ? 'In-Time' : 'Out-Time'} approved successfully.`,
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error approving attendance:", error);
            Swal.fire('Error', `Failed to approve ${type} attendance.`, 'error');
        }
    };

    // Helper: Handle Rejection
    const handleReject = async (attendanceId: string, type: 'in' | 'out') => {
        try {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: type === 'in' ? "This will mark the attendance as Absent." : "This will reject the out-time record.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, reject it!'
            });

            if (result.isConfirmed) {
                const updateData: any = {};
                if (type === 'in') {
                    updateData.flag = 'A';
                    updateData.inTimeApprovalStatus = 'Rejected';
                    updateData.approvalStatus = 'Rejected';
                } else {
                    updateData.outTimeApprovalStatus = 'Rejected';
                }

                const ref = doc(firestore, 'attendance', attendanceId);
                await updateDoc(ref, updateData);
                Swal.fire(
                    'Rejected!',
                    type === 'in' ? 'Attendance has been marked as Absent.' : 'Out-time has been rejected.',
                    'success'
                );
            }
        } catch (error) {
            console.error("Error rejecting attendance:", error);
            Swal.fire('Error', `Failed to reject ${type} attendance.`, 'error');
        }
    };

    // Sub to today's attendance for team
    useEffect(() => {
        if (!supervisedEmployeeIds || supervisedEmployeeIds.length === 0) {
            setAttendance([]);
            return;
        }

        const todayStart = format(startOfDay(new Date()), "yyyy-MM-dd'T'00:00:00.000xxx");
        const todayEnd = format(endOfDay(new Date()), "yyyy-MM-dd'T'23:59:59.999xxx");

        const attendanceQuery = query(
            collection(firestore, 'attendance'),
            where('date', '>=', todayStart),
            where('date', '<=', todayEnd),
            where('employeeId', 'in', supervisedEmployeeIds.slice(0, 30))
        );

        const unsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
            const attendanceData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceDocument));
            setAttendance(attendanceData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching team attendance: ", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [supervisedEmployeeIds]);

    const combinedTeamData = useMemo(() => {
        if (!employees) return [];

        const attendanceMap = new Map(attendance.map(a => [a.employeeId, a]));

        let list = employees.map(emp => {
            const att = attendanceMap.get(emp.id);
            let status: 'Present' | 'Delayed' | 'Absent' | 'On Leave' = 'Absent';
            let approvalRequired = false;
            let currentApprovalStatus = att?.approvalStatus;

            if (att) {
                // Determine raw status from flag
                if (att.flag === 'P') status = 'Present';
                else if (att.flag === 'D') status = 'Delayed';
                else if (att.flag === 'L') status = 'On Leave';

                let inTimeAppStatus = att.inTimeApprovalStatus || att.approvalStatus;
                let outTimeAppStatus = att.outTimeApprovalStatus;

                // Radius Validation Logic
                let branch = branches.find(b => b.id === emp.branchId);
                if (!branch && emp.branch) {
                    branch = branches.find(b => b.name === emp.branch);
                }

                if (branch && branch.latitude && branch.longitude && branch.allowRadius) {
                    // Check In-Time Radius
                    if (!inTimeAppStatus && att.inTimeLocation) {
                        const dist = calculateDistance(att.inTimeLocation.latitude, att.inTimeLocation.longitude, branch.latitude, branch.longitude);
                        if (dist > branch.allowRadius) {
                            inTimeAppStatus = 'Pending';
                        }
                    }
                    // Check Out-Time Radius
                    if (!outTimeAppStatus && att.outTimeLocation) {
                        const dist = calculateDistance(att.outTimeLocation.latitude, att.outTimeLocation.longitude, branch.latitude, branch.longitude);
                        if (dist > branch.allowRadius) {
                            outTimeAppStatus = 'Pending';
                        }
                    }
                }

                return {
                    ...emp,
                    inTime: att?.inTime || '-',
                    outTime: att?.outTime || '-',
                    inTimeLocation: att?.inTimeLocation,
                    outTimeLocation: att?.outTimeLocation,
                    status: status,
                    attendanceId: att?.id,
                    inTimeApprovalStatus: inTimeAppStatus,
                    outTimeApprovalStatus: outTimeAppStatus,
                    approvalStatus: inTimeAppStatus || outTimeAppStatus // Primary status for badges
                };
            }

            return {
                ...emp,
                inTime: '-',
                outTime: '-',
                inTimeLocation: undefined,
                outTimeLocation: undefined,
                status: 'Absent',
                attendanceId: undefined,
                inTimeApprovalStatus: undefined,
                outTimeApprovalStatus: undefined,
                approvalStatus: undefined
            };
        });

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(emp =>
                emp.fullName?.toLowerCase().includes(lower) ||
                emp.employeeCode?.toLowerCase().includes(lower)
            );
        }

        if (statusFilter !== 'All') {
            list = list.filter(emp => {
                if (statusFilter === 'Pending') return emp.approvalStatus === 'Pending';
                if (statusFilter === 'P') return emp.status === 'Present' && emp.approvalStatus !== 'Pending';
                if (statusFilter === 'A') return (emp.status === 'Absent' || emp.status === 'On Leave') && emp.approvalStatus !== 'Pending';
                if (statusFilter === 'D') return emp.status === 'Delayed' && emp.approvalStatus !== 'Pending';
                return true;
            });
        }

        return list;
    }, [employees, attendance, searchTerm, statusFilter, branches]);

    const stats = useMemo(() => {
        // We need to re-calculate "pending" based on the same logic as above or simple check
        // But since combinedTeamData already processes it, we can use it if we weren't filtering it.
        // However, combinedTeamData is filtered by search/status.
        // So we should replicate logic or do a pre-pass.

        // Let's do a quick pass on data
        let total = employees.length;
        let present = 0;
        let delayed = 0;
        let absent = 0;
        let pending = 0;

        const attendanceMap = new Map(attendance.map(a => [a.employeeId, a]));

        employees.forEach(emp => {
            const att = attendanceMap.get(emp.id);
            let isPending = false;

            if (att) {
                if (att.approvalStatus === 'Pending') isPending = true;
                else if (!att.approvalStatus && att.inTimeLocation) {
                    let branch = branches.find(b => b.id === emp.branchId);
                    if (!branch && emp.branch) branch = branches.find(b => b.name === emp.branch);

                    if (branch && branch.latitude && branch.longitude && branch.allowRadius) {
                        const dist = calculateDistance(att.inTimeLocation.latitude, att.inTimeLocation.longitude, branch.latitude, branch.longitude);
                        if (dist > branch.allowRadius) isPending = true;
                    }
                }
            }

            if (isPending) {
                pending++;
            } else if (att) {
                if (att.flag === 'P' && att.approvalStatus !== 'Rejected') present++;
                else if (att.flag === 'D' && att.approvalStatus !== 'Rejected') delayed++;
                else if (['A', 'L'].includes(att.flag) || att.approvalStatus === 'Rejected') absent++; // Treat rejected as absent or whatever logic
            } else {
                absent++;
            }
        });

        // Correction: if rejected, it might be flag 'A' now, so it counts as absent. 
        // Logic above is approximate but sufficient for badges.

        return { total, present, delayed, absent, pending };
    }, [employees, attendance, branches]);

    const handleViewLocation = (location: { latitude: number; longitude: number } | undefined | null, type: string) => {
        if (location) {
            const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            Swal.fire('No Location', `Location data is not available for this ${type} entry.`, 'info');
        }
    };

    if (isLoading) {
        return (
            <Card className="shadow-xl flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </Card>
        );
    }

    return (
        <Card className="shadow-xl">
            <CardHeader className="pb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-white border border-emerald-100 shadow-sm text-emerald-500">
                            <Users className="h-7 w-7" />
                        </div>
                        <div className="flex-1">
                            <CardTitle className="font-bold text-xl lg:text-2xl tracking-tight bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-transparent bg-clip-text w-fit">My Team Attendance</CardTitle>
                            <CardDescription className="text-slate-500 font-medium">Today&apos;s attendance at a glance for your team.</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                        <div className="relative w-full sm:w-48">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search..."
                                className="pl-9 h-9 w-full text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button
                            variant={statusFilter === 'All' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('All')}
                            className="relative h-9 text-xs"
                        >
                            All <Badge className="ml-1 bg-blue-500 text-white text-[10px] px-1">{stats.total}</Badge>
                        </Button>
                        <Button
                            variant={statusFilter === 'Pending' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('Pending')}
                            className={cn("relative h-9 text-xs", statusFilter === 'Pending' ? "bg-orange-500 hover:bg-orange-600" : "")}
                        >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            <Badge className="bg-orange-600 text-[10px] px-1">{stats.pending}</Badge>
                        </Button>
                        <Button
                            variant={statusFilter === 'A' ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('A')}
                            className="relative h-9 text-xs"
                        >
                            A <Badge variant="destructive" className="ml-1 text-[10px] px-1">{stats.absent}</Badge>
                        </Button>
                        <Button
                            variant={statusFilter === 'P' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('P')}
                            className="relative h-9 text-xs"
                        >
                            P <Badge className="ml-1 bg-green-500 text-[10px] px-1">{stats.present}</Badge>
                        </Button>
                        <Button
                            variant={statusFilter === 'D' ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('D')}
                            className="relative h-9 text-xs font-bold"
                        >
                            D <Badge variant="secondary" className="ml-1 text-[10px] px-1">{stats.delayed}</Badge>
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-auto h-[350px] w-full">
                    <Table className="min-w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs whitespace-nowrap">Name</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">Designation</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">In Time</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">Out Time</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">Status</TableHead>
                                <TableHead className="text-center text-xs whitespace-nowrap">In time Approval</TableHead>
                                <TableHead className="text-center text-xs whitespace-nowrap">Out Time Approval</TableHead>
                                <TableHead className="text-right text-xs whitespace-nowrap">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {combinedTeamData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No team members found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                combinedTeamData.map(emp => (
                                    <TableRow key={emp.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={emp.photoURL} alt={emp.fullName} />
                                                    <AvatarFallback className="text-[10px]">{getInitials(emp.fullName)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <p className="text-xs font-medium leading-none">{emp.fullName}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">{emp.employeeCode}</p>
                                                    <div className="mt-1">
                                                        <RoleBadge roles={emp.role} size="xs" />
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs">{emp.designation}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 text-xs">
                                                {emp.inTime}
                                                {emp.inTimeLocation && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => handleViewLocation(emp.inTimeLocation, 'In-Time')}
                                                    >
                                                        <MapPin className="h-3 w-3 text-blue-500" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 text-xs">
                                                {emp.outTime}
                                                {emp.outTimeLocation && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => handleViewLocation(emp.outTimeLocation, 'Out-Time')}
                                                    >
                                                        <MapPin className="h-3 w-3 text-orange-500" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {emp.inTimeApprovalStatus === 'Pending' ? (
                                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-orange-500 text-orange-500">
                                                    Pending
                                                </Badge>
                                            ) : emp.outTimeApprovalStatus === 'Pending' ? (
                                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-orange-500 text-orange-500">
                                                    Pending
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant={emp.status === 'Present' || emp.status === 'Delayed' ? 'default' : 'destructive'}
                                                    className={cn(
                                                        "text-[10px] h-5 px-1.5",
                                                        emp.status === 'Present' && 'bg-green-500 hover:bg-green-600',
                                                        emp.status === 'Delayed' && 'bg-yellow-500 hover:bg-yellow-600 text-black',
                                                        emp.status === 'Absent' && 'bg-red-500'
                                                    )}
                                                >
                                                    {emp.status}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {emp.inTimeApprovalStatus === 'Pending' && emp.attendanceId && (
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button
                                                        size="sm"
                                                        className="h-6 w-6 p-0 bg-green-500 hover:bg-green-600 rounded-full"
                                                        onClick={() => handleApprove(emp.attendanceId!, emp.inTime, 'in')}
                                                        title="Approve"
                                                    >
                                                        <Check className="h-3 w-3 text-white" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        className="h-6 w-6 p-0 rounded-full"
                                                        onClick={() => handleReject(emp.attendanceId!, 'in')}
                                                        title="Reject"
                                                    >
                                                        <X className="h-3 w-3 text-white" />
                                                    </Button>
                                                </div>
                                            )}
                                            {emp.inTimeApprovalStatus === 'Approved' && (
                                                <span className="text-[10px] text-green-600 font-medium whitespace-nowrap">Approved</span>
                                            )}
                                            {emp.inTimeApprovalStatus === 'Rejected' && (
                                                <span className="text-[10px] text-red-600 font-medium whitespace-nowrap">Rejected</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {emp.outTimeApprovalStatus === 'Pending' && emp.attendanceId && (
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button
                                                        size="sm"
                                                        className="h-6 w-6 p-0 bg-green-500 hover:bg-green-600 rounded-full"
                                                        onClick={() => handleApprove(emp.attendanceId!, emp.outTime, 'out')}
                                                        title="Approve"
                                                    >
                                                        <Check className="h-3 w-3 text-white" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        className="h-6 w-6 p-0 rounded-full"
                                                        onClick={() => handleReject(emp.attendanceId!, 'out')}
                                                        title="Reject"
                                                    >
                                                        <X className="h-3 w-3 text-white" />
                                                    </Button>
                                                </div>
                                            )}
                                            {emp.outTimeApprovalStatus === 'Approved' && (
                                                <span className="text-[10px] text-green-600 font-medium whitespace-nowrap">Approved</span>
                                            )}
                                            {emp.outTimeApprovalStatus === 'Rejected' && (
                                                <span className="text-[10px] text-red-600 font-medium whitespace-nowrap">Rejected</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="text-xs">
                                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/hr/attendance-reconciliation?view=team`)}>
                                                        View Team Reconciliation
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card >
    );
}
