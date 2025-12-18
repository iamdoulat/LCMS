
"use client";

import { AddHolidayForm } from '@/components/forms/AddHolidayForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CalendarPlus, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function AddHolidayPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8 px-[20px]">
      <div className="mb-6">
        <Link href="/dashboard/hr/holidays" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Holidays List
          </Button>
        </Link>
      </div>
      <Card className="mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <CalendarPlus className="h-7 w-7 text-primary" />
            Add New Holiday
          </CardTitle>
          <CardDescription>
            Fill out the form below to add a new company or public holiday.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddHolidayForm onFormSubmit={() => router.push('/dashboard/hr/holidays')} />
        </CardContent>
      </Card>
    </div>
  );
}
