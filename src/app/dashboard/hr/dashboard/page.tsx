
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HrmDashboardPage() {
  return (
    <div className="container mx-auto py-8">
        <Card className="shadow-xl">
            <CardHeader>
                <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                    <BarChart3 className="h-7 w-7 text-primary" />
                    HRM Dashboard
                </CardTitle>
                <CardDescription>
                    An overview of Human Resource Management activities. This page is under construction.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground py-12">
                    <p>Dashboard content will be displayed here.</p>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
