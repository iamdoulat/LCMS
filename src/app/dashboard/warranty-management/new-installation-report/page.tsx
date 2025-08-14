
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NewInstallationReportForm } from '@/components/forms/NewInstallationReportForm';

export default function NewInstallationReportPage() {
  return (
    <div className="container mx-auto py-8">
        <Card className="max-w-6xl mx-auto shadow-xl">
            <CardHeader>
            <CardTitle className={cn("font-bold text-xl lg:text-2xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Wrench className="mr-2 h-7 w-7 text-primary" />
                New Installation Report
            </CardTitle>
            
            </CardHeader>
            <CardContent>
                <NewInstallationReportForm />
            </CardContent>
        </Card>
    </div>
  );
}


