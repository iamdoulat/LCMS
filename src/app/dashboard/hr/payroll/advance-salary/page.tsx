
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AdvanceSalaryList } from '@/components/dashboard/AdvanceSalaryList';

export default function AdvanceSalaryPage() {
  return (
    <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                Advance Salary
              </CardTitle>
              <CardDescription>
                Manage and view all employee advance salary requests.
              </CardDescription>
            </div>
            <Link href="/dashboard/hr/payroll/advance-salary/add" passHref>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <AdvanceSalaryList />
        </CardContent>
      </Card>
    </div>
  );
}
