
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
export default function PettyCashReportsPage() {
    return (
        <div className="container mx-auto py-8">
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                        <BarChart3 className="h-7 w-7 text-primary" />
                        Petty Cash Reports
                    </CardTitle>
                    <CardDescription>
                        Generate daily, monthly, and yearly reports for your petty cash transactions.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Reporting features are under construction and will be available soon.</p>
                </CardContent>
            </Card>
        </div>
    );
}

