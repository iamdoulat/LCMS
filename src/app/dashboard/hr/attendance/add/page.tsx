
"use client";

import { AddAttendanceForm } from '@/components/forms/hr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CalendarCheck, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function AddAttendancePage() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/hr/attendance" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Attendance Overview
          </Button>
        </Link>
      </div>
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <CalendarCheck className="h-7 w-7 text-primary" />
            Add Daily Attendance Record
          </CardTitle>
          <CardDescription>
            Select an employee and date to manually record their attendance for a specific day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddAttendanceForm onFormSubmit={() => router.push('/dashboard/hr/attendance')} />
        </CardContent>
      </Card>
    </div>
  );
}
