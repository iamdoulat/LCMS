
"use client";

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/StatCard';
import { DollarSign, Wallet, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import type { PettyCashAccountDocument, PettyCashTransactionDocument } from '@/types';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

interface PettyCashStats {
    totalBalance: number;
    totalAccounts: number;
    thisMonthDebits: number;
    thisMonthCredits: number;
}

export default function PettyCashDashboardPage() {
    const [stats, setStats] = React.useState<PettyCashStats>({
        totalBalance: 0,
        totalAccounts: 0,
        thisMonthDebits: 0,
        thisMonthCredits: 0,
    });
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const accountsSnapshot = await getDocs(collection(firestore, "petty_cash_accounts"));
                const transactionsSnapshot = await getDocs(collection(firestore, "petty_cash_transactions"));

                let totalBalance = 0;
                accountsSnapshot.forEach(doc => {
                    totalBalance += (doc.data() as PettyCashAccountDocument).balance || 0;
                });
                const totalAccounts = accountsSnapshot.size;

                let thisMonthDebits = 0;
                let thisMonthCredits = 0;
                const now = new Date();
                const start = startOfMonth(now);
                const end = endOfMonth(now);

                transactionsSnapshot.forEach(doc => {
                    const tx = doc.data() as PettyCashTransactionDocument;
                    const txDate = tx.transactionDate ? parseISO(tx.transactionDate) : new Date(0);
                    if (isWithinInterval(txDate, { start, end })) {
                        if (tx.type === 'Debit') {
                            thisMonthDebits += tx.amount;
                        } else if (tx.type === 'Credit') {
                            thisMonthCredits += tx.amount;
                        }
                    }
                });

                setStats({
                    totalBalance,
                    totalAccounts,
                    thisMonthDebits,
                    thisMonthCredits,
                });
            } catch (error) {
                console.error("Error fetching petty cash stats:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    }

    if (isLoading) {
        return (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                        <Wallet className="h-7 w-7 text-primary" />
                        Petty Cash Dashboard
                    </CardTitle>
                    <CardDescription>
                        An overview of your petty cash accounts and recent activity.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Total Balance"
                        value={formatCurrency(stats.totalBalance)}
                        icon={<DollarSign />}
                        description={`Across ${stats.totalAccounts} accounts`}
                        className="bg-blue-500"
                    />
                    <StatCard
                        title="This Month's Debits"
                        value={formatCurrency(stats.thisMonthDebits)}
                        icon={<TrendingUp />}
                        description={`In ${format(new Date(), 'MMMM')}`}
                        className="bg-green-500"
                    />
                    <StatCard
                        title="This Month's Credits"
                        value={formatCurrency(stats.thisMonthCredits)}
                        icon={<TrendingDown />}
                        description={`In ${format(new Date(), 'MMMM')}`}
                        className="bg-red-500"
                    />
                     <StatCard
                        title="Net Flow (This Month)"
                        value={formatCurrency(stats.thisMonthDebits - stats.thisMonthCredits)}
                        icon={<DollarSign />}
                        description={`In ${format(new Date(), 'MMMM')}`}
                        className="bg-purple-500"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

