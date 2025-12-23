
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/StatCard';
import { BarChart3, Calendar, Briefcase, FileText, UserCheck, Cake, UserX, Coffee, Plane, Wallet, BookOpen, Loader2, Search, MoreHorizontal, MapPin, Bell, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import type { EmployeeDocument, LeaveApplicationDocument, AttendanceDocument, HolidayDocument, BranchDocument, DepartmentDocument, NoticeBoardSettings, AdvanceSalaryDocument, VisitApplicationDocument } from '@/types';
import { format, startOfTomorrow, isWithinInterval, startOfDay, endOfDay, parseISO, subDays, eachDayOfInterval, getDay, differenceInDays } from 'date-fns';
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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import Swal from 'sweetalert2';
import dynamic from 'next/dynamic';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LeaveCalendar } from '@/components/dashboard/LeaveCalendar';
import DOMPurify from 'dompurify';


const AttendanceSummaryChart = dynamic(() => import('@/components/dashboard/AttendanceSummaryChart'), {
    ssr: false,
    loading: () => <div className="flex h-[350px] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});


interface HrmDashboardStats {
    totalEmployees: number;
    todayPresent: number;
    todayDelayed: number;
    todayAbsent: number;
    onLeaveToday: number;
    onLeaveTomorrow: number;
    pendingLeaveApplications: number;
    upcomingBirthdays: number;
    pendingAdvanceSalaryRequests: number;
    pendingVisitApplications: number;
    onVisitToday: number;
    onVisitTomorrow: number;
}

const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

const ALL_BRANCHES_FILTER_VALUE = "__ALL_BRANCHES__";
const ALL_DEPTS_FILTER_VALUE = "__ALL_DEPARTMENTS__";


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
        pendingAdvanceSalaryRequests: 0,
        pendingVisitApplications: 0,
        onVisitToday: 0,
        onVisitTomorrow: 0,
    });

    const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(collection(firestore, 'employees'), undefined, ['employees_hrm_dashboard']);
    const { data: leaves, isLoading: isLoadingLeaves } = useFirestoreQuery<LeaveApplicationDocument[]>(collection(firestore, 'leave_applications'), undefined, ['leaves_hrm_dashboard']);
    const { data: holidays, isLoading: isLoadingHolidays } = useFirestoreQuery<HolidayDocument[]>(collection(firestore, 'holidays'), undefined, ['holidays_hrm_dashboard']);
    const { data: notices, isLoading: isLoadingNotices } = useFirestoreQuery<(NoticeBoardSettings & { id: string })[]>(query(collection(firestore, "site_settings"), where("isEnabled", "==", true)), undefined, ['notices_hrm_dashboard']);
    const { data: advanceSalaryRequests, isLoading: isLoadingAdvanceSalary } = useFirestoreQuery<AdvanceSalaryDocument[]>(query(collection(firestore, 'advance_salary'), where('status', '==', 'Pending')), undefined, ['pending_advance_salary']);
    const { data: allVisits, isLoading: isLoadingAllVisits } = useFirestoreQuery<VisitApplicationDocument[]>(collection(firestore, 'visit_applications'), undefined, ['all_visits_hrm_dashboard']);


    const [attendance, setAttendance] = React.useState<AttendanceDocument[]>([]);
    const [isLoadingAttendance, setIsLoadingAttendance] = React.useState(true);

    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<'All' | 'P' | 'A' | 'D'>('All');

    const [chartDateRange, setChartDateRange] = React.useState<DateRange | undefined>({
        from: subDays(new Date(), 29),
        to: new Date(),
    });
    const [chartData, setChartData] = React.useState<any[]>([]);
    const [missedDateRange, setMissedDateRange] = React.useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });
    const [rangeAttendance, setRangeAttendance] = React.useState<AttendanceDocument[]>([]);


    const { data: branches, isLoading: isLoadingBranches } = useFirestoreQuery<BranchDocument[]>(collection(firestore, 'branches'), undefined, ['branches_hrm_dashboard']);
    const { data: departments, isLoading: isLoadingDepts } = useFirestoreQuery<DepartmentDocument[]>(collection(firestore, 'departments'), undefined, ['departments_hrm_dashboard']);
    const [leaveSearchTerm, setLeaveSearchTerm] = React.useState('');
    const [leaveFilterBranch, setLeaveFilterBranch] = React.useState(ALL_BRANCHES_FILTER_VALUE);
    const [leaveFilterDept, setLeaveFilterDept] = React.useState(ALL_DEPTS_FILTER_VALUE);

    const isLoading = isLoadingEmployees || isLoadingLeaves || isLoadingAttendance || isLoadingHolidays || isLoadingBranches || isLoadingDepts || isLoadingNotices || isLoadingAdvanceSalary || isLoadingAllVisits;

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

    React.useEffect(() => {
        const fetchRangeAttendance = async () => {
            if (!missedDateRange?.from) return;
            const from = startOfDay(missedDateRange.from);
            const to = endOfDay(missedDateRange.to || from);

            const rangeAttendanceQuery = query(
                collection(firestore, "attendance"),
                where("date", ">=", from.toISOString()),
                where("date", "<=", to.toISOString())
            );

            const snapshot = await getDocs(rangeAttendanceQuery);
            setRangeAttendance(snapshot.docs.map(d => d.data() as AttendanceDocument));
        };
        fetchRangeAttendance();
    }, [missedDateRange]);

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
                emp.employeeCode?.includes(lowercasedFilter)
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
        if (employees && leaves && attendance && advanceSalaryRequests && allVisits) {
            const today = new Date();
            const tomorrow = startOfTomorrow();

            const presentCount = attendance.filter(a => a.flag === 'P').length;
            const delayedCount = attendance.filter(a => a.flag === 'D').length;

            const onLeaveTodayCount = leaves.filter(l => {
                try {
                    return l.status === 'Approved' && isWithinInterval(today, { start: parseISO(l.fromDate), end: parseISO(l.toDate) })
                } catch (e) {
                    return false;
                }
            }).length;

            const onLeaveTomorrowCount = leaves.filter(l => {
                try {
                    return l.status === 'Approved' && isWithinInterval(tomorrow, { start: parseISO(l.fromDate), end: parseISO(l.toDate) });
                } catch (e) { return false; }
            }).length;

            const pendingLeaveApplicationsCount = leaves.filter(l => l.status === 'Pending').length;

            const birthdaysToday = employees.filter(emp => {
                if (!emp.dateOfBirth) return false;
                try {
                    const dob = parseISO(emp.dateOfBirth);
                    const todayMonthDay = format(today, 'MM-dd');
                    const dobMonthDay = format(dob, 'MM-dd');
                    return todayMonthDay === dobMonthDay;
                } catch { return false; }
            });
            const upcomingBirthdaysCount = birthdaysToday.length;

            const presentEmployeeIds = new Set(attendance.map(a => a.employeeId));
            const onLeaveTodayIds = new Set(leaves.filter(l => l.status === 'Approved' && isWithinInterval(today, { start: parseISO(l.fromDate), end: parseISO(l.toDate) })).map(l => l.employeeId));

            const todayAbsentCount = employees.filter(emp => !presentEmployeeIds.has(emp.id) && !onLeaveTodayIds.has(emp.id)).length;

            const approvedVisits = allVisits.filter(v => v.status === 'Approved');
            const onVisitTodayCount = approvedVisits.filter(v => isWithinInterval(today, { start: parseISO(v.fromDate), end: parseISO(v.toDate) })).length;
            const onVisitTomorrowCount = approvedVisits.filter(v => isWithinInterval(tomorrow, { start: parseISO(v.fromDate), end: parseISO(v.toDate) })).length;
            const pendingVisitApplicationsCount = allVisits.filter(v => v.status === 'Pending').length;


            setStats({
                totalEmployees: employees.length,
                todayPresent: presentCount,
                todayDelayed: delayedCount,
                todayAbsent: todayAbsentCount,
                onLeaveToday: onLeaveTodayCount,
                onLeaveTomorrow: onLeaveTomorrowCount,
                pendingLeaveApplications: pendingLeaveApplicationsCount,
                upcomingBirthdays: upcomingBirthdaysCount,
                pendingAdvanceSalaryRequests: advanceSalaryRequests.length,
                pendingVisitApplications: pendingVisitApplicationsCount,
                onVisitToday: onVisitTodayCount,
                onVisitTomorrow: onVisitTomorrowCount,
            });
        }
    }, [employees, leaves, attendance, advanceSalaryRequests, allVisits]);

    React.useEffect(() => {
        const processChartData = async () => {
            if (!chartDateRange?.from || !employees || !holidays || !leaves) return;

            const from = startOfDay(chartDateRange.from);
            const to = endOfDay(chartDateRange.to || from);

            const attendanceQuery = query(
                collection(firestore, "attendance"),
                where("date", ">=", from.toISOString()),
                where("date", "<=", to.toISOString())
            );

            const attendanceSnapshot = await getDocs(attendanceQuery);
            const rangeAttendance = attendanceSnapshot.docs.map(d => d.data() as AttendanceDocument);

            const days = eachDayOfInterval({ start: from, end: to });
            const data = days.map(day => {
                const dayOfWeek = getDay(day);
                const dayStr = format(day, 'yyyy-MM-dd');

                const isHoliday = holidays.some(h => isWithinInterval(day, { start: parseISO(h.fromDate), end: parseISO(h.toDate || h.fromDate) }));
                const isWeekend = dayOfWeek === 5; // Friday

                const dailyAttendance = rangeAttendance.filter(a => a.date.startsWith(dayStr));

                const present = dailyAttendance.filter(a => a.flag === 'P').length;
                const delayed = dailyAttendance.filter(a => a.flag === 'D').length;
                const onLeave = leaves.filter(l => l.status === 'Approved' && isWithinInterval(day, { start: parseISO(l.fromDate), end: parseISO(l.toDate) })).length;
                const weekendCount = isWeekend ? employees.length - onLeave : 0;
                const holidayCount = isHoliday && !isWeekend ? employees.length - onLeave : 0;

                const accountedFor = present + delayed + onLeave + weekendCount + holidayCount;
                const absent = Math.max(0, employees.length - accountedFor);

                return {
                    name: format(day, 'd/MM'),
                    present,
                    absent,
                    delay: delayed,
                    leave: onLeave,
                    weekend: weekendCount,
                    holiday: holidayCount
                };
            });
            setChartData(data);
        };
        processChartData();
    }, [chartDateRange, employees, holidays, leaves]);


    const handleViewLocation = (location: { latitude: number; longitude: number } | undefined | null, timeType: string) => {
        if (location) {
            const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            Swal.fire('No Location', `Location data is not available for this ${timeType} entry.`, 'info');
        }
    };

    const leaveData = React.useMemo(() => {
        if (!employees || !leaves) return [];

        return employees
            .map(emp => {
                const totalLeaveDays = 24; // Assuming a fixed total
                const takenLeaves = leaves.filter(
                    l => l.employeeId === emp.id && l.status === 'Approved'
                );
                const leaveTaken = takenLeaves.reduce((acc, l) => {
                    return acc + differenceInDays(parseISO(l.toDate), parseISO(l.fromDate)) + 1;
                }, 0);
                const remainLeave = totalLeaveDays - leaveTaken;

                return {
                    ...emp,
                    leaveGroup: 'General',
                    remainLeave,
                    leaveTaken
                };
            })
            .filter(emp => {
                const nameMatch = !leaveSearchTerm || emp.fullName?.toLowerCase().includes(leaveSearchTerm.toLowerCase());
                const branchMatch = leaveFilterBranch === ALL_BRANCHES_FILTER_VALUE || emp.branch === leaveFilterBranch;
                const deptMatch = leaveFilterDept === ALL_DEPTS_FILTER_VALUE || emp.department === leaveFilterDept;
                return nameMatch && branchMatch && deptMatch;
            });

    }, [employees, leaves, leaveSearchTerm, leaveFilterBranch, leaveFilterDept]);

    const missedAttendanceInRange = React.useMemo(() => {
        if (!employees || !missedDateRange?.from) return [];

        const from = startOfDay(missedDateRange.from);
        const to = endOfDay(missedDateRange.to || from);
        const daysInRange = eachDayOfInterval({ start: from, end: to });

        const missedRecords: { date: Date; employee: EmployeeDocument }[] = [];
        const attendanceMap = new Map<string, Set<string>>(); // YYYY-MM-DD -> Set<employeeId>

        rangeAttendance.forEach(att => {
            const dateKey = att.date.substring(0, 10);
            if (!attendanceMap.has(dateKey)) {
                attendanceMap.set(dateKey, new Set());
            }
            attendanceMap.get(dateKey)!.add(att.employeeId);
        });

        daysInRange.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const presentIds = attendanceMap.get(dateKey) || new Set();
            employees.forEach(emp => {
                if (!presentIds.has(emp.id)) {
                    missedRecords.push({ date: day, employee: emp });
                }
            });
        });

        return missedRecords;
    }, [employees, missedDateRange, rangeAttendance]);

    const birthdaysToday = React.useMemo(() => {
        if (!employees) return [];
        const todayMonthDay = format(new Date(), 'MM-dd');
        return employees.filter(emp => {
            if (!emp.dateOfBirth) return false;
            try {
                const dob = parseISO(emp.dateOfBirth);
                return format(dob, 'MM-dd') === todayMonthDay;
            } catch { return false; }
        });
    }, [employees]);


    if (isLoading) {
        return (
            <div className="container mx-auto py-8 px-5">
                <div className="flex justify-center items-center h-96">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 space-y-8 px-5">
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
                    <div className="grid grid-cols-2 gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                            title="Today Absent"
                            value={stats.todayAbsent}
                            icon={<Calendar />}
                            description={`${stats.totalEmployees} Total Employees`}
                            className="bg-indigo-500"
                        />
                        <StatCard
                            title="Pending Advance Salary"
                            value={stats.pendingAdvanceSalaryRequests}
                            icon={<Wallet />}
                            description="Advance salary requests"
                            className="bg-rose-500"
                        />
                        <StatCard
                            title="Total Delayed Today"
                            value={stats.todayDelayed}
                            icon={<Clock />}
                            description="Delayed Today"
                            className="bg-yellow-400"
                        />
                        <StatCard
                            title="On Visit Today"
                            value={stats.onVisitToday}
                            icon={<Briefcase />}
                            description="Employees on official visit"
                            className="bg-cyan-500"
                        />
                        <StatCard
                            title="On Visit Tomorrow"
                            value={stats.onVisitTomorrow}
                            icon={<Plane />}
                            description="Scheduled for tomorrow"
                            className="bg-sky-500"
                        />
                        <StatCard
                            title="Pending Visit Application"
                            value={stats.pendingVisitApplications}
                            icon={<BookOpen />}
                            description="Visit requests to approve"
                            className="bg-rose-500"
                        />
                        <StatCard
                            title="On Break Now"
                            value="0"
                            icon={<Coffee />}
                            description="Employees currently on break"
                            className="bg-gray-500"
                        />
                    </div>

                    <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div className="flex-1">
                                            <CardTitle className="text-2xl font-bold">Quick View</CardTitle>
                                            <CardDescription>Today&apos;s attendance at a glance.</CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <div className="relative w-full sm:w-64">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
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
                                                                    <AvatarImage src={emp.photoURL} alt={emp.fullName} data-ai-hint="employee photo" />
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
                                                                        <MapPin className="h-3.5 w-3.5 text-blue-500" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-1">
                                                                {emp.outTime}
                                                                {emp.outTimeLocation && (
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleViewLocation(emp.outTimeLocation, 'Out-Time')}>
                                                                        <MapPin className="h-3.5 w-3.5 text-orange-500" />
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
                            </Card>
                        </div>
                        <div className="lg:col-span-1">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Notice Board</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingNotices ? (
                                        <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin" /></div>
                                    ) : !notices || notices.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center">No active notices available.</p>
                                    ) : (
                                        <ScrollArea className="h-96 pr-4">
                                            <div className="space-y-4">
                                                {notices.map(notice => (
                                                    <div key={notice.id} className="p-3 border rounded-lg bg-background shadow-sm">
                                                        <h4 className="font-semibold text-sm mb-1">{notice.title}</h4>
                                                        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: notice.content ? DOMPurify.sanitize(notice.content.substring(0, 100) + '...') : '' }} />
                                                        <div className="text-xs text-muted-foreground mt-2">
                                                            {notice.updatedAt ? format(new Date((notice.updatedAt as any).seconds * 1000), 'PPP') : 'N/A'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card>
                            <CardHeader>
                                <CardTitle>Current Leave Balance</CardTitle>
                                <div className="flex items-center gap-2 pt-2">
                                    <Input placeholder="Search name..." value={leaveSearchTerm} onChange={e => setLeaveSearchTerm(e.target.value)} className="h-9" />
                                    <Select value={leaveFilterBranch} onValueChange={(value) => setLeaveFilterBranch(value)}>
                                        <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="All Branches" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_BRANCHES_FILTER_VALUE}>All Branches</SelectItem>
                                            {branches?.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select value={leaveFilterDept} onValueChange={(value) => setLeaveFilterDept(value)}>
                                        <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="All Depts" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_DEPTS_FILTER_VALUE}>All Departments</SelectItem>
                                            {departments?.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-96">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Designation</TableHead>
                                                <TableHead>Leave Group</TableHead>
                                                <TableHead>Remain Leave</TableHead>
                                                <TableHead>Leave Taken</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {leaveData.map(emp => (
                                                <TableRow key={emp.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar>
                                                                <AvatarImage src={emp.photoURL} alt={emp.fullName} data-ai-hint="employee photo" />
                                                                <AvatarFallback>{getInitials(emp.fullName)}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="font-medium">{emp.fullName}</p>
                                                                <p className="text-xs text-muted-foreground">{emp.branch || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{emp.designation}</TableCell>
                                                    <TableCell>{emp.leaveGroup}</TableCell>
                                                    <TableCell>{emp.remainLeave}</TableCell>
                                                    <TableCell>{emp.leaveTaken}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center gap-2">
                                    <div>
                                        <CardTitle>Attendance Missed</CardTitle>
                                        <CardDescription>Employees who missed attendance.</CardDescription>
                                    </div>
                                    <DatePickerWithRange date={missedDateRange} onDateChange={setMissedDateRange} />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-96">
                                    {missedAttendanceInRange.length > 0 ? (
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Name</TableHead><TableHead>Designation</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {missedAttendanceInRange.map(item => (
                                                    <TableRow key={`${item.date.toISOString()}-${item.employee.id}`}>
                                                        <TableCell>{format(item.date, 'MMM d, yyyy')}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <Avatar>
                                                                    <AvatarImage src={item.employee.photoURL} alt={item.employee.fullName} />
                                                                    <AvatarFallback>{getInitials(item.employee.fullName)}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <p className="font-medium">{item.employee.fullName}</p>
                                                                    <p className="text-xs text-muted-foreground">{item.employee.branch}</p>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{item.employee.designation}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-center text-muted-foreground p-4">
                                            <p>No missed attendance records found for the selected range.</p>
                                        </div>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>


                    <div className="mt-12">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div>
                                        <CardTitle className="text-2xl font-bold">Attendance Summary</CardTitle>
                                        <CardDescription>Last 30 days attendance overview</CardDescription>
                                    </div>
                                    <DatePickerWithRange
                                        date={chartDateRange}
                                        onDateChange={setChartDateRange}
                                        className="max-w-sm"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                <AttendanceSummaryChart data={chartData} />
                            </CardContent>
                        </Card>
                    </div>

                    <div className="mt-8">
                        <LeaveCalendar birthdays={birthdaysToday} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

