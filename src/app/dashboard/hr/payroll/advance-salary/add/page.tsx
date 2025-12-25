
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddAdvanceSalaryForm } from '@/components/forms/hr';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AddAdvanceSalaryPage() {
    const router = useRouter();
    const { userRole } = useAuth();
    const canNavigateBack = userRole?.some(role => ['Super Admin', 'Admin', 'HR'].includes(role));

    return (
        <div className="m-[10px] p-0 md:container md:mx-auto md:py-8 md:px-5">
            <div className="mb-6">
                <Link href="/dashboard/hr/payroll/advance-salary" passHref>
                    <Button variant="outline" disabled={!canNavigateBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Advance Salary List
                    </Button>
                </Link>
            </div>
            <Card className="shadow-xl mx-auto">
                <CardHeader>
                    <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                        <DollarSign className="h-7 w-7 text-primary" />
                        Apply for Advance Salary
                    </CardTitle>
                    <CardDescription>
                        Fill out the form below to submit an advance salary request for an employee.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <AddAdvanceSalaryForm onFormSubmit={() => router.push('/dashboard/hr/payroll/advance-salary')} />
                </CardContent>
            </Card>
        </div>
    );
}
