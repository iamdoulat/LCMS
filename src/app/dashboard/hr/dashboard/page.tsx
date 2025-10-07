
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/StatCard';
import { BarChart3, Calendar, Users, Briefcase, FileText, UserCheck, Cake, UserX, UserPlus, Coffee, Plane, Wallet, BookOpen, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { EmployeeDocument, LeaveApplicationDocument, AttendanceDocument } from '@/types';
import { format, startOfTomorrow, isWithinInterval, startOfDay, endOfDay, parseISO, isToday } from 'date-fns';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';


interface HrmDashboardStats {
    totalEmployees: number;
    todayPresent: number;
    onLeaveToday: number;
    onLeaveTomorrow: number;
    pendingLeaveApplications: number;
    upcomingBirthdays: number;
}

export default function HrmDashboardPage() {
    const [stats, setStats] = React.useState<HrmDashboardStats>({
        totalEmployees: 0,
        todayPresent: 0,
        onLeaveToday: 0,
        onLeaveTomorrow: 0,
        pendingLeaveApplications: 0,
        upcomingBirthdays: 0,
    });
    
    const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(collection(firestore, 'employees'), undefined, ['employees_hrm_dashboard']);
    const { data: leaves, isLoading: isLoadingLeaves } = useFirestoreQuery<LeaveApplicationDocument[]>(collection(firestore, 'leave_applications'), undefined, ['leaves_hrm_dashboard']);
    const { data: attendance, isLoading: isLoadingAttendance } = useFirestoreQuery<AttendanceDocument[]>(query(collection(firestore, 'attendance'), where('date', '>=', format(startOfDay(new Date()), "yyyy-MM-dd'T'00:00:00.000xxx")), where('date', '<=', format(endOfDay(new Date()), "yyyy-MM-dd'T'23:59:59.999xxx"))), undefined, ['attendance_today_hrm_dashboard']);
    
    const isLoading = isLoadingEmployees || isLoadingLeaves || isLoadingAttendance;

    React.useEffect(() => {
        if (employees && leaves && attendance) {
            const today = new Date();
            const tomorrow = startOfTomorrow();
            
            const todayPresentCount = attendance.filter(a => a.flag === 'P' || a.flag === 'D').length;
            
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
                todayPresent: todayPresentCount,
                onLeaveToday: onLeaveTodayCount,
                onLeaveTomorrow: onLeaveTomorrowCount,
                pendingLeaveApplications: pendingLeaveApplicationsCount,
                upcomingBirthdays: upcomingBirthdaysCount,
            });
        }
    }, [employees, leaves, attendance]);

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
                        value={stats.todayPresent}
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
                    {/* Placeholder cards from image */}
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
            </CardContent>
        </Card>
    </div>
  );
}
