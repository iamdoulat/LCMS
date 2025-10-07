
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/StatCard';
import { BarChart3, Calendar, Users, Briefcase, FileText, UserCheck, Cake, UserX, UserPlus, Coffee, Plane, Wallet, BookOpen, Loader2, AlertTriangle, Search, MoreHorizontal, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import type { EmployeeDocument, LeaveApplicationDocument, AttendanceDocument } from '@/types';
import { format, startOfTomorrow, isWithinInterval, startOfDay, endOfDay, parseISO, isToday } from 'date-fns';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import Swal from 'sweetalert2';

interface HrmDashboardStats {
    totalEmployees: number;
    todayPresent: number;
    todayDelayed: number;
    todayAbsent: number;
    onLeaveToday: number;
    onLeaveTomorrow: number;
    pendingLeaveApplications: number;
    upcomingBirthdays: number;
}

const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

export default function HrmDashboardPage() {
    const router = useRouter();
    const [stats, setStats] = React.useState<HrmDashboardStats>({
        totalEmployees: 0,
        todayPresent: 0,
        todayDelayed: 0,
        todayAbsent: 0,
        onLeaveToday: 0,
        onLeaveTomorrow: 0,
        pendingLeaveApplications: 0,
        upcomingBirthdays: 0,
    });
    
    const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(collection(firestore, 'employees'), undefined, ['employees_hrm_dashboard']);
    const { data: leaves, isLoading: isLoadingLeaves } = useFirestoreQuery<LeaveApplicationDocument[]>(collection(firestore, 'leave_applications'), undefined, ['leaves_hrm_dashboard']);
    const [attendance, setAttendance] = React.useState<AttendanceDocument[]>([]);
    const [isLoadingAttendance, setIsLoadingAttendance] = React.useState(true);
    
    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<'All' | 'P' | 'A' | 'D'>('All');

    const isLoading = isLoadingEmployees || isLoadingLeaves || isLoadingAttendance;
    
    React.useEffect(() => {
        const todayStart = format(startOfDay(new Date()), "yyyy-MM-dd'T'00:00:00.000xxx");
        const todayEnd = format(endOfDay(new Date()), "yyyy-MM-dd'T'23:59:59.999xxx");
        const attendanceQuery = query(collection(firestore, 'attendance'), where('date', '>=', todayStart), where('date', '<=', todayEnd));

        const unsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
            const attendanceData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceDocument));
            setAttendance(attendanceData);
            setIsLoadingAttendance(false);
        }, (error) => {
            console.error("Error fetching today's attendance: ", error);
            setIsLoadingAttendance(false);
        });

        return () => unsubscribe();
    }, []);

    const combinedEmployeeData = React.useMemo(() => {
        if (!employees) return [];
        
        const attendanceMap = new Map(attendance.map(a => [a.employeeId, a]));

        let employeeList = employees.map(emp => {
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
            const lowercasedFilter = searchTerm.toLowerCase();
            employeeList = employeeList.filter(emp =>
                emp.fullName?.toLowerCase().includes(lowercasedFilter) ||
                emp.designation?.toLowerCase().includes(lowercasedFilter)
            );
        }

        if (statusFilter !== 'All') {
            employeeList = employeeList.filter(emp => {
                if (statusFilter === 'P') return emp.status === 'Present';
                if (statusFilter === 'A') return emp.status === 'Absent' || emp.status === 'On Leave';
                if (statusFilter === 'D') return emp.status === 'Delayed';
                return true;
            });
        }
        
        return employeeList;

    }, [employees, attendance, searchTerm, statusFilter]);

    React.useEffect(() => {
        if (employees && leaves && attendance) {
            const today = new Date();
            const tomorrow = startOfTomorrow();
            
            const presentCount = attendance.filter(a => a.flag === 'P').length;
            const delayedCount = attendance.filter(a => a.flag === 'D').length;
            const todayPresentCount = presentCount + delayedCount;
            const todayAbsentCount = employees.length - todayPresentCount;

            const onLeaveTodayCount = leaves.filter(l => l.status === 'Approved' && isWithinInterval(today, { start: parseISO(l.fromDate), end: parseISO(l.toDate) })).length;
            const onLeaveTomorrowCount = leaves.filter(l => l.status === 'Approved' && isToday(parseISO(l.fromDate))).length;
            const pendingLeaveApplicationsCount = leaves.filter(l => l.status === 'Pending').length;

            const upcomingBirthdaysCount = employees.filter(e => {
                if (!e.dateOfBirth) return false;
                try {
                    const dob = parseISO(e.dateOfBirth);
                    const todayMonthDay = format(today, 'MM-dd');
                    const dobMonthDay = format(dob, 'MM-dd');
                    return todayMonthDay === dobMonthDay;
                } catch { return false; }
            }).length;

            setStats({
                totalEmployees: employees.length,
                todayPresent: presentCount,
                todayDelayed: delayedCount,
                todayAbsent: todayAbsentCount,
                onLeaveToday: onLeaveTodayCount,
                onLeaveTomorrow: onLeaveTomorrowCount,
                pendingLeaveApplications: pendingLeaveApplicationsCount,
                upcomingBirthdays: upcomingBirthdaysCount,
            });
        }
    }, [employees, leaves, attendance]);

    const handleViewLocation = (location: { latitude: number; longitude: number } | undefined | null, timeType: string) => {
        if (location) {
          const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          Swal.fire('No Location', `Location data is not available for this ${timeType} entry.`, 'info');
        }
    };

    if (isLoading) {
        return (
             <div className="container mx-auto py-8">
                <div className="flex justify-center items-center h-96">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            </div>
        );
    }

  return (
    <div className="container mx-auto py-8">
        <Card className="shadow-xl">
            <CardHeader>
                <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                    <BarChart3 className="h-7 w-7 text-primary" />
                    HRM Dashboard
                </CardTitle>
                <CardDescription>
                    An overview of Human Resource Management activities.
                </CardDescription>
            </CardHeader>
            <CardContent>
               <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Today Present"
                        value={stats.todayPresent + stats.todayDelayed}
                        icon={<UserCheck />}
                        description={`${stats.totalEmployees} Total Employees`}
                        className="bg-green-500"
                    />
                     <StatCard
                        title="On Leave Today"
                        value={stats.onLeaveToday}
                        icon={<UserX />}
                        description="Employees on approved leave"
                        className="bg-yellow-500"
                    />
                    <StatCard
                        title="Pending Leave Application"
                        value={stats.pendingLeaveApplications}
                        icon={<FileText />}
                        description="Awaiting for approval"
                        className="bg-orange-500"
                    />
                     <StatCard
                        title="Upcoming Birthdays"
                        value={stats.upcomingBirthdays}
                        icon={<Cake />}
                        description="Today's birthdays"
                        className="bg-pink-500"
                    />
                    <StatCard
                        title="On Leave Tomorrow"
                        value={stats.onLeaveTomorrow}
                        icon={<Calendar />}
                        description="Approved for tomorrow"
                        className="bg-blue-500"
                    />
                    <StatCard
                        title="Pending Attendance Approval"
                        value="7"
                        icon={<Calendar />}
                        description="Manual entries to review"
                        className="bg-indigo-500"
                    />
                    <StatCard
                        title="Pending Attendance Recon."
                        value="1"
                        icon={<UserPlus />}
                        description="Discrepancies to resolve"
                        className="bg-teal-500"
                    />
                     <StatCard
                        title="On Break Now"
                        value="0"
                        icon={<Coffee />}
                        description="Employees currently on break"
                        className="bg-gray-500"
                    />
                    <StatCard
                        title="On Visit Today"
                        value="0"
                        icon={<Briefcase />}
                        description="Employees on official visit"
                        className="bg-cyan-500"
                    />
                     <StatCard
                        title="On Visit Tomorrow"
                        value="0"
                        icon={<Plane />}
                        description="Scheduled for tomorrow"
                        className="bg-sky-500"
                    />
                    <StatCard
                        title="Pending Visit Application"
                        value="0"
                        icon={<BookOpen />}
                        description="Visit requests to approve"
                        className="bg-rose-500"
                    />
                     <StatCard
                        title="Pending Advance Salary"
                        value="0"
                        icon={<Wallet />}
                        description="Advance salary requests"
                        className="bg-lime-500"
                    />
               </div>

                <div className="mt-12">
                    <CardHeader className="px-0">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-2xl font-bold">Quick View</CardTitle>
                          <CardDescription>Today's attendance at a glance.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"/>
                                <Input placeholder="Search employee..." className="pl-10 h-10 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                            <Button variant={statusFilter === 'All' ? 'default' : 'outline'} onClick={() => setStatusFilter('All')} className="relative">
                                All <Badge className="ml-2 bg-blue-500 text-white absolute -top-2 -right-2 px-1.5">{stats.totalEmployees}</Badge>
                            </Button>
                            <Button variant={statusFilter === 'A' ? 'destructive' : 'outline'} onClick={() => setStatusFilter('A')} className="relative">
                                A <Badge variant="destructive" className="absolute -top-2 -right-2 px-1.5">{stats.todayAbsent}</Badge>
                            </Button>
                            <Button variant={statusFilter === 'P' ? 'default' : 'outline'} onClick={() => setStatusFilter('P')} className="relative">
                                P <Badge className="ml-2 bg-green-500 absolute -top-2 -right-2 px-1.5">{stats.todayPresent}</Badge>
                            </Button>
                            <Button variant={statusFilter === 'D' ? 'secondary' : 'outline'} onClick={() => setStatusFilter('D')} className="relative">
                                D <Badge variant="secondary" className="absolute -top-2 -right-2 px-1.5">{stats.todayDelayed}</Badge>
                            </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-96">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>In Time</TableHead>
                                    <TableHead>Out Time</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {combinedEmployeeData.map(emp => (
                                    <TableRow key={emp.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src={emp.photoURL} alt={emp.fullName} data-ai-hint="employee photo"/>
                                                    <AvatarFallback>{getInitials(emp.fullName)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{emp.fullName}</p>
                                                    <p className="text-xs text-muted-foreground">{emp.branch || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{emp.designation}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                {emp.inTime}
                                                {emp.inTimeLocation && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleViewLocation(emp.inTimeLocation, 'In-Time')}>
                                                        <MapPin className="h-3.5 w-3.5 text-blue-500"/>
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                {emp.outTime}
                                                {emp.outTimeLocation && (
                                                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleViewLocation(emp.outTimeLocation, 'Out-Time')}>
                                                        <MapPin className="h-3.5 w-3.5 text-orange-500"/>
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={emp.status === 'Present' || emp.status === 'Delayed' ? 'default' : 'destructive'} className={cn(emp.status === 'Present' && 'bg-green-500', emp.status === 'Delayed' && 'bg-yellow-500 text-black')}>
                                                {emp.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/hr/employees/edit/${emp.id}`)}>View Profile</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/hr/attendance`)}>View Full Attendance</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </ScrollArea>
                    </CardContent>
                </div>

            </CardContent>
        </Card>
    </div>
  );
}

