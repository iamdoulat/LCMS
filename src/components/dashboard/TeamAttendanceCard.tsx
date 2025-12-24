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
    Clock
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import type { EmployeeDocument, AttendanceDocument } from '@/types';

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
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'P' | 'A' | 'D'>('All');

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
            if (att) {
                if (att.flag === 'P') status = 'Present';
                else if (att.flag === 'D') status = 'Delayed';
                else if (att.flag === 'L') status = 'On Leave';
            }
            return {
                ...emp,
                inTime: att?.inTime || '-',
                outTime: att?.outTime || '-',
                inTimeLocation: att?.inTimeLocation,
                outTimeLocation: att?.outTimeLocation,
                status: status,
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
                if (statusFilter === 'P') return emp.status === 'Present';
                if (statusFilter === 'A') return emp.status === 'Absent' || emp.status === 'On Leave';
                if (statusFilter === 'D') return emp.status === 'Delayed';
                return true;
            });
        }

        return list;
    }, [employees, attendance, searchTerm, statusFilter]);

    const stats = useMemo(() => {
        return {
            total: employees.length,
            present: attendance.filter(a => a.flag === 'P').length,
            delayed: attendance.filter(a => a.flag === 'D').length,
            absent: employees.length - attendance.filter(a => ['P', 'D', 'L'].includes(a.flag)).length
        };
    }, [employees, attendance]);

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
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1">
                        <CardTitle className="text-xl font-bold">My Team Attendance</CardTitle>
                        <CardDescription>Today's attendance at a glance for your team.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search team member..."
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
                <ScrollArea className="h-[350px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs">Name</TableHead>
                                <TableHead className="text-xs">Designation</TableHead>
                                <TableHead className="text-xs">In Time</TableHead>
                                <TableHead className="text-xs">Out Time</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-right text-xs">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {combinedTeamData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                                            <Badge
                                                variant={emp.status === 'Present' || emp.status === 'Delayed' ? 'default' : 'destructive'}
                                                className={cn(
                                                    "text-[10px] h-5 px-1.5",
                                                    emp.status === 'Present' && 'bg-green-500 hover:bg-green-600',
                                                    emp.status === 'Delayed' && 'bg-yellow-500 hover:bg-yellow-600 text-black'
                                                )}
                                            >
                                                {emp.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="text-xs">
                                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/hr/employees/edit/${emp.id}`)}>
                                                        View Profile
                                                    </DropdownMenuItem>
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
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
