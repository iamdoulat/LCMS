
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
export default function DailyTransactionsPage() {
    return (
        <div className="container mx-auto py-8">
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                        <DollarSign className="h-7 w-7 text-primary" />
                        Daily Petty Cash Transactions
                    </CardTitle>
                    <CardDescription>
                        Add and view daily debit/credit transactions for your petty cash accounts.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">The form and table for managing daily transactions are under construction.</p>
                </CardContent>
            </Card>
        </div>
    );
}

