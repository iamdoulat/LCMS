
"use client";

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/StatCard';
import { DollarSign, Wallet, TrendingUp, TrendingDown, Loader2, AlertTriangle, PlusCircle, Edit, Trash2, MoreHorizontal, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, Timestamp, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import type { PettyCashAccountDocument, PettyCashTransactionDocument } from '@/types';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, isValid } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AddPettyCashTransactionForm } from '@/components/forms/AddPettyCashTransactionForm';
import { EditPettyCashTransactionForm } from '@/components/forms/EditPettyCashTransactionForm';
import { useAuth } from '@/context/AuthContext';
import Swal from 'sweetalert2';


interface PettyCashStats {
    totalBalance: number;
    totalAccounts: number;
    thisMonthDebits: number;
    thisMonthCredits: number;
}

const formatDisplayDate = (dateString?: string | null | Timestamp): string => {
  if (!dateString) return 'N/A';
  try {
    const date = dateString instanceof Timestamp ? dateString.toDate() : parseISO(dateString as string);
    return isValid(date) ? format(date, 'PPP') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const formatCurrencyValue = (amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `USD N/A`;
  return `USD ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PettyCashDashboardPage() {
    const { userRole } = useAuth();
    const isReadOnly = userRole?.includes('Viewer');

    const [stats, setStats] = React.useState<PettyCashStats>({
        totalBalance: 0,
        totalAccounts: 0,
        thisMonthDebits: 0,
        thisMonthCredits: 0,
    });
    const [transactions, setTransactions] = React.useState<PettyCashTransactionDocument[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [fetchError, setFetchError] = React.useState<string | null>(null);

    const [isAddFormOpen, setIsAddFormOpen] = React.useState(false);
    const [isEditFormOpen, setIsEditFormOpen] = React.useState(false);
    const [editingTransaction, setEditingTransaction] = React.useState<PettyCashTransactionDocument | null>(null);

    React.useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            setFetchError(null);
            try {
                const accountsSnapshot = await getDocs(collection(firestore, "petty_cash_accounts"));
                let totalBalance = 0;
                accountsSnapshot.forEach(doc => {
                    totalBalance += (doc.data() as PettyCashAccountDocument).balance || 0;
                });
                const totalAccounts = accountsSnapshot.size;
                setStats(prev => ({ ...prev, totalBalance, totalAccounts }));
            } catch (error: any) {
                console.error("Error fetching petty cash stats:", error);
                setFetchError(error.message || "An unknown error occurred while fetching stats.");
            } finally {
                setIsLoading(false);
            }
        };

        const unsubTransactions = onSnapshot(
            query(collection(firestore, "petty_cash_transactions"), orderBy("transactionDate", "desc")),
            (snapshot) => {
                const fetchedTransactions = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PettyCashTransactionDocument));
                setTransactions(fetchedTransactions);

                let thisMonthDebits = 0;
                let thisMonthCredits = 0;
                const now = new Date();
                const start = startOfMonth(now);
                const end = endOfMonth(now);

                fetchedTransactions.forEach(tx => {
                    if (!tx.transactionDate) return;
                    let txDate: Date;
                    try {
                        txDate = parseISO(tx.transactionDate);
                         if (!isValid(txDate)) return;
                    } catch(e) { return; }
                    
                    if (isWithinInterval(txDate, { start, end })) {
                        if (tx.type === 'Debit') {
                            thisMonthDebits += tx.amount;
                        } else if (tx.type === 'Credit') {
                            thisMonthCredits += tx.amount;
                        }
                    }
                });
                setStats(prev => ({...prev, thisMonthDebits, thisMonthCredits}));
                setFetchError(null);
            },
            (error) => {
                console.error("Error fetching transactions:", error);
                setFetchError("Could not load transactions. Check permissions and console.");
            }
        );

        fetchStats();

        return () => {
            unsubTransactions();
        };
    }, []);

    const handleEdit = (transaction: PettyCashTransactionDocument) => {
        setEditingTransaction(transaction);
        setIsEditFormOpen(true);
    };

    const handleDelete = (transactionId: string) => {
        Swal.fire({
            title: 'Are you sure?',
            text: `This will permanently delete the transaction. This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'hsl(var(--destructive))',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(firestore, "petty_cash_transactions", transactionId));
                    Swal.fire('Deleted!', 'The transaction has been removed.', 'success');
                } catch (error: any) {
                    Swal.fire('Error!', `Could not delete transaction: ${error.message}`, 'error');
                }
            }
        });
    };

    if (isLoading) {
        return (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        );
    }

    if (fetchError) {
        return (
            <div className="container mx-auto py-8">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error Fetching Data</AlertTitle>
                    <AlertDescription>{fetchError}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 space-y-8">
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

            <Dialog open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
                <Card className="shadow-xl">
                    <CardHeader>
                         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                                    <DollarSign className="h-7 w-7 text-primary" />
                                    Daily Petty Cash Transactions
                                </CardTitle>
                                <CardDescription>
                                    Add and view daily debit/credit transactions for your petty cash accounts.
                                </CardDescription>
                            </div>
                            <DialogTrigger asChild>
                                <Button disabled={isReadOnly}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Transaction
                                </Button>
                            </DialogTrigger>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
                        ) : fetchError ? (
                            <div className="text-destructive-foreground bg-destructive/10 p-4 rounded-md text-center">
                                <AlertTriangle className="mx-auto mb-2 h-8 w-8" />
                                <p className="font-semibold">Error Loading Transactions</p>
                                <p className="text-sm">{fetchError}</p>
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="text-muted-foreground text-center py-10">
                                <Info className="mx-auto mb-2 h-10 w-10" />
                                <p className="font-semibold">No Transactions Found</p>
                                <p className="text-sm">Click "Add Transaction" to get started.</p>
                            </div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Account</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Payee/Purpose</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactions.map(tx => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{formatDisplayDate(tx.transactionDate)}</TableCell>
                                                <TableCell>{tx.accountName}</TableCell>
                                                <TableCell>
                                                    <span className={cn("font-semibold", tx.type === 'Debit' ? 'text-green-600' : 'text-red-600')}>
                                                        {tx.type}
                                                    </span>
                                                </TableCell>
                                                <TableCell>{tx.payeeName}</TableCell>
                                                <TableCell className="text-right font-medium">{formatCurrencyValue(tx.amount)}</TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={isReadOnly}>
                                                                <span className="sr-only">Open menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => handleEdit(tx)} disabled={isReadOnly}><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleDelete(tx.id)} className="text-destructive focus:text-destructive" disabled={isReadOnly}><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableCaption>A list of your recent petty cash transactions.</TableCaption>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
                <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle>Add New Transaction</DialogTitle>
                        <DialogDescription>
                            Record a new debit or credit transaction for a petty cash account.
                        </DialogDescription>
                    </DialogHeader>
                    <AddPettyCashTransactionForm onFormSubmit={() => setIsAddFormOpen(false)} />
                </DialogContent>
            </Dialog>

            {editingTransaction && (
                <Dialog open={isEditFormOpen} onOpenChange={setIsEditFormOpen}>
                     <DialogContent className="sm:max-w-[550px]">
                        <DialogHeader>
                            <DialogTitle>Edit Transaction</DialogTitle>
                            <DialogDescription>
                                Modify the details for transaction ID: {editingTransaction.id}.
                            </DialogDescription>
                        </DialogHeader>
                        <EditPettyCashTransactionForm 
                            initialData={editingTransaction}
                            onFormSubmit={() => {
                                setIsEditFormOpen(false);
                                setEditingTransaction(null);
                            }}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
