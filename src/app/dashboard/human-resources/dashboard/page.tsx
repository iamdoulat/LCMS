
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/StatCard';
import { Users, UserPlus, LogOut, Birthday, CalendarOff, UserClock, FileClock, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function HumanResourcesDashboardPage() {
  const hrStats = [
    { title: 'Total Headcount', value: '1,250', icon: <Users />, description: '+20 this month', className: 'bg-blue-500' },
    { title: 'New Hires', value: '25', icon: <UserPlus />, description: 'In the last 30 days', className: 'bg-green-500' },
    { title: 'Exits This Month', value: '5', icon: <LogOut />, description: 'Resignations & terminations', className: 'bg-orange-500' },
    { title: 'Upcoming Birthdays', value: '8', icon: <Birthday />, description: 'In the next 7 days', className: 'bg-pink-500' },
    { title: 'On Leave Today', value: '12', icon: <CalendarOff />, description: 'Across all departments', className: 'bg-indigo-500' },
    { title: 'Late/Absent Today', value: '3', icon: <UserClock />, description: 'Real-time attendance data', className: 'bg-yellow-500' },
    { title: 'Pending Approvals', value: '7', icon: <FileClock />, description: 'Leave, claims, etc.', className: 'bg-teal-500' },
    { title: 'Compliance Alerts', value: '2', icon: <ShieldAlert />, description: 'Passport/Visa expiring soon', className: 'bg-red-600' },
  ];

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Users className="h-7 w-7 text-primary" />
            Human Resources Dashboard
          </CardTitle>
          <CardDescription>
            An at-a-glance overview of key HR metrics and activities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {hrStats.map((stat, index) => (
              <StatCard
                key={index}
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                description={stat.description}
                className={stat.className}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      <Alert variant="default" className="bg-blue-500/10 border-blue-500/30">
        <ShieldAlert className="h-5 w-5 text-blue-600" />
        <AlertTitle className="text-blue-700 font-semibold">Placeholder Data & Future Scope</AlertTitle>
        <AlertDescription className="text-blue-700/90">
          The data shown on this dashboard is for demonstration purposes. A full implementation requires building out the underlying modules for Employee Profiles, Attendance, Leave, Payroll, and more as detailed in the blueprint.
        </AlertDescription>
      </Alert>
    </div>
  );
}
