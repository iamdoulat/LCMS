
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function PayslipListPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <ListChecks className="h-7 w-7 text-primary" />
            Payslip List
          </CardTitle>
          <CardDescription>
            View, manage, and print generated payslips.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Alert variant="default" className="bg-blue-500/10 border-blue-500/30">
              <AlertTitle className="text-blue-700 font-semibold">Under Construction</AlertTitle>
              <AlertDescription className="text-blue-700/90">
                This page is a placeholder for viewing a list of all generated payslips. Functionality to filter, sort, and view individual payslips will be added here.
              </AlertDescription>
            </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

