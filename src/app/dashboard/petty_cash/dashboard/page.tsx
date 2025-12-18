
"use client";

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/StatCard';
import { Banknote, Wallet, TrendingUp, TrendingDown, Loader2, AlertTriangle, PlusCircle, Edit, Trash2, MoreHorizontal, Info, Receipt, GitCommitVertical, ChevronLeft, ChevronRight, BarChart3, PieChartIcon, ListChecks, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, Timestamp, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import type { PettyCashAccountDocument, PettyCashTransactionDocument, SaleDocument, SaleStatus, ItemDocument } from '@/types';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, isValid, getMonth } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AddPettyCashTransactionForm } from '@/components/forms/AddPettyCashTransactionForm';
import { EditPettyCashTransactionForm } from '@/components/forms/EditPettyCashTransactionForm';
import { useAuth } from '@/context/AuthContext';
import Swal from 'sweetalert2';
import dynamic from 'next/dynamic';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { SalesInvoiceList } from '@/components/dashboard/SalesInvoiceList';


interface PettyCashStats {
    pettyCashBalance: number;
    thisMonthDebits: number;
    thisMonthCredits: number;
    totalUnpaidInvoices: number;
    thisMonthUnpaidInvoices: number;
    totalStockItems: number;
    thisMonthItemsSold: number;
}

interface PieChartDataItem {
    name: string;
    value: number;
    fill: string;
}

interface MonthlyChartData {
    name: string;
    debits: number;
    credits: number;
}

const PettyCashAccountPieChart = dynamic(() => import('@/components/dashboard/PettyCashAccountPieChart'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading chart...</p></div>,
});

const MonthlyTransactionBarChart = dynamic(() => import('@/components/dashboard/MonthlyTransactionBarChart'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading chart...</p></div>,
});


const ITEMS_PER_PAGE = 20;

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
    if (isNaN(value)) {
        return 'BDT N/A';
    }
    const formatter = new Intl.NumberFormat('en-BD', {
        style: 'currency',
        currency: 'BDT',
        currencyDisplay: 'code',
    });

    if (value < 0) {
        // Format absolute value and manually insert the minus sign with non-breaking spaces
        const formatted = formatter.format(Math.abs(value));
        return formatted.replace(/BDT/, 'BDT\u00A0-\u00A0');
    }

    return formatter.format(value).replace(/BDT/, 'BDT\u00A0');
};

const formatCurrencyValue = (amount?: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return `BDT N/A`;
    return `BDT ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const currentSystemYear = new Date().getFullYear();
const chartYearOptions = Array.from({ length: (currentSystemYear - 2020 + 6) }, (_, i) => (2020 + i).toString());

export default function PettyCashDashboardPage() {
    const { userRole } = useAuth();
    const isReadOnly = userRole?.includes('Viewer');

    const [stats, setStats] = React.useState<PettyCashStats>({
        pettyCashBalance: 0,
        thisMonthDebits: 0,
        thisMonthCredits: 0,
        totalUnpaidInvoices: 0,
        thisMonthUnpaidInvoices: 0,
        totalStockItems: 0,
        thisMonthItemsSold: 0,
    });
    const [transactions, setTransactions] = React.useState<PettyCashTransactionDocument[]>([]);
    const [accounts, setAccounts] = React.useState<PettyCashAccountDocument[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [fetchError, setFetchError] = React.useState<string | null>(null);

    const [isAddFormOpen, setIsAddFormOpen] = React.useState(false);
    const [isEditFormOpen, setIsEditFormOpen] = React.useState(false);
    const [editingTransaction, setEditingTransaction] = React.useState<PettyCashTransactionDocument | null>(null);
    const [currentPage, setCurrentPage] = React.useState(1);

    const [accountPieChartData, setAccountPieChartData] = React.useState<PieChartDataItem[]>([]);
    const [monthlyBarChartData, setMonthlyBarChartData] = React.useState<MonthlyChartData[]>([]);
    const [selectedChartYear, setSelectedChartYear] = React.useState<string>(currentSystemYear.toString());


    React.useEffect(() => {
        const accountsQuery = query(collection(firestore, "petty_cash_accounts"), orderBy("name"));
        const unsubAccounts = onSnapshot(accountsQuery, (snapshot) => {
            const fetchedAccounts = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PettyCashAccountDocument));
            setAccounts(fetchedAccounts);

            const totalBalance = fetchedAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
            setStats(prev => ({ ...prev, pettyCashBalance: totalBalance }));

            const pieData = fetchedAccounts.map((acc, index) => ({
                name: acc.name,
                value: acc.balance,
                fill: `hsl(var(--chart-${(index % 5) + 1}))`
            })).filter(item => item.value > 0);
            setAccountPieChartData(pieData);

        }, (error) => {
            console.error("Error fetching accounts:", error);
            setFetchError("Could not load accounts. Check permissions and console.");
        });

        const fetchSalesAndItemStats = async () => {
            try {
                const unpaidStatuses: SaleStatus[] = ["Draft", "Sent", "Partial", "Overdue"];
                const salesQuery = query(collection(firestore, "sales_invoice"));
                const itemsQuery = query(collection(firestore, "items"));

                const [salesSnapshot, itemsSnapshot] = await Promise.all([
                    getDocs(salesQuery),
                    getDocs(itemsQuery)
                ]);

                let totalUnpaid = 0;
                let thisMonthUnpaid = 0;
                let thisMonthSoldQty = 0;
                const now = new Date();
                const start = startOfMonth(now);
                const end = endOfMonth(now);

                salesSnapshot.forEach(doc => {
                    const saleData = doc.data() as SaleDocument;
                    const saleStatus = saleData.status as SaleStatus;

                    if (unpaidStatuses.includes(saleStatus)) {
                        totalUnpaid++;
                        if (saleData.invoiceDate) {
                            try {
                                const invoiceDate = parseISO(saleData.invoiceDate);
                                if (isValid(invoiceDate) && isWithinInterval(invoiceDate, { start, end })) {
                                    thisMonthUnpaid++;
                                }
                            } catch (e) { console.warn("Could not parse invoiceDate for stats:", saleData.invoiceDate); }
                        }
                    }

                    if (saleData.invoiceDate) {
                        try {
                            const invoiceDate = parseISO(saleData.invoiceDate);
                            if (isValid(invoiceDate) && isWithinInterval(invoiceDate, { start, end })) {
                                saleData.lineItems.forEach(item => {
                                    thisMonthSoldQty += item.qty || 0;
                                });
                            }
                        } catch (e) { /* ignore */ }
                    }
                });

                let totalStockQuantity = 0;
                itemsSnapshot.forEach(doc => {
                    const itemData = doc.data() as ItemDocument;
                    if (itemData.manageStock && typeof itemData.currentQuantity === 'number') {
                        totalStockQuantity += itemData.currentQuantity;
                    }
                });

                setStats(prev => ({
                    ...prev,
                    totalUnpaidInvoices: totalUnpaid,
                    thisMonthUnpaidInvoices: thisMonthUnpaid,
                    totalStockItems: totalStockQuantity,
                    thisMonthItemsSold: thisMonthSoldQty
                }));
            } catch (error) {
                console.error("Error fetching sales/item stats:", error);
            }
        };
        fetchSalesAndItemStats();

        return () => unsubAccounts();
    }, []);

    React.useEffect(() => {
        setIsLoading(true);
        const txQuery = query(collection(firestore, "petty_cash_transactions"), orderBy("transactionDate", "desc"));
        const unsubTransactions = onSnapshot(txQuery, (snapshot) => {
            const fetchedTransactions = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PettyCashTransactionDocument));
            setTransactions(fetchedTransactions);

            const now = new Date();
            const thisMonthStart = startOfMonth(now);
            const thisMonthEnd = endOfMonth(now);

            let currentMonthDebits = 0;
            let currentMonthCredits = 0;

            fetchedTransactions.forEach(tx => {
                if (!tx.transactionDate) return;
                let txDate: Date;
                try {
                    txDate = parseISO(tx.transactionDate);
                    if (!isValid(txDate)) return;
                } catch (e) { return; }

                if (isWithinInterval(txDate, { start: thisMonthStart, end: thisMonthEnd })) {
                    if (tx.type === 'Debit') currentMonthDebits += tx.amount || 0;
                    else if (tx.type === 'Credit') currentMonthCredits += tx.amount || 0;
                }
            });

            const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

            setStats(prev => ({
                ...prev,
                thisMonthDebits: currentMonthDebits,
                thisMonthCredits: currentMonthCredits,
                pettyCashBalance: totalBalance,
            }));

            setFetchError(null);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching transactions:", error);
            setFetchError("Could not load transactions. Check permissions and console.");
            setIsLoading(false);
        });

        return () => unsubTransactions();
    }, [accounts]);

    React.useEffect(() => {
        const year = parseInt(selectedChartYear);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyData = monthNames.map(name => ({ name, debits: 0, credits: 0 }));

        transactions.forEach(tx => {
            if (tx.transactionDate) {
                const txDate = parseISO(tx.transactionDate);
                if (isValid(txDate) && txDate.getFullYear() === year) {
                    const monthIndex = getMonth(txDate);
                    if (tx.type === 'Debit') {
                        monthlyData[monthIndex].debits += tx.amount || 0;
                    } else if (tx.type === 'Credit') {
                        monthlyData[monthIndex].credits += tx.amount || 0;
                    }
                }
            }
        });
        setMonthlyBarChartData(monthlyData);
    }, [selectedChartYear, transactions]);


    const handleEdit = (transaction: PettyCashTransactionDocument) => {
        setEditingTransaction(transaction);
        setIsEditFormOpen(true);
    };

    const handleDelete = (transactionId: string) => {
        if (isReadOnly) return;
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

    const netFlow = stats.thisMonthCredits - stats.thisMonthDebits;

    const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
    const currentTransactions = transactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const getPageNumbers = () => {
        const pageNumbers = [];
        const maxPagesToShow = 5;
        const halfPagesToShow = Math.floor(maxPagesToShow / 2);

        if (totalPages <= maxPagesToShow + 2) {
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.push(i);
            }
        } else {
            pageNumbers.push(1);
            let startPage = Math.max(2, currentPage - halfPagesToShow);
            let endPage = Math.min(totalPages - 1, currentPage + halfPagesToShow);
            if (currentPage <= halfPagesToShow + 1) endPage = Math.min(totalPages - 1, maxPagesToShow);
            if (currentPage >= totalPages - halfPagesToShow) startPage = Math.max(2, totalPages - maxPagesToShow + 1);
            if (startPage > 2) pageNumbers.push("...");
            for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
            if (endPage < totalPages - 1) pageNumbers.push("...");
            pageNumbers.push(totalPages);
        }
        return pageNumbers;
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
                <CardContent className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    <StatCard
                        title="Total Balance"
                        value={formatCurrency(stats.pettyCashBalance)}
                        icon={<Wallet />}
                        description="Across all accounts"
                        className="bg-blue-500"
                    />
                    <StatCard
                        title="This Month's Credits"
                        value={formatCurrency(stats.thisMonthCredits)}
                        icon={<TrendingUp />}
                        description={`In ${format(new Date(), 'MMMM')}`}
                        className="bg-green-500"
                    />
                    <StatCard
                        title="This Month's Debits"
                        value={formatCurrency(stats.thisMonthDebits)}
                        icon={<TrendingDown />}
                        description={`In ${format(new Date(), 'MMMM')}`}
                        className="bg-orange-500"
                    />
                    <StatCard
                        title="Net Flow (This Month)"
                        value={formatCurrency(netFlow)}
                        icon={<GitCommitVertical />}
                        description={`In ${format(new Date(), 'MMMM')}`}
                        className={cn(netFlow >= 0 ? "bg-green-600" : "bg-red-600")}
                    />
                    <StatCard
                        title="Total Unpaid Invoices"
                        value={stats.totalUnpaidInvoices.toLocaleString()}
                        icon={<Receipt />}
                        description={`${stats.thisMonthUnpaidInvoices} this month (Unpaid)`}
                        className="bg-cyan-500"
                    />
                    <StatCard
                        title="Total Items in Stock"
                        value={stats.totalStockItems.toLocaleString()}
                        icon={<Package />}
                        description={`${stats.thisMonthItemsSold} items sold this month`}
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
                                    <Banknote className="h-7 w-7 text-primary" />
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
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentTransactions.map(tx => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{formatDisplayDate(tx.transactionDate)}</TableCell>
                                                <TableCell>{tx.accountName || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <span className={cn("font-semibold", tx.type === 'Debit' ? 'text-red-600' : 'text-green-600')}>
                                                        {tx.type}
                                                    </span>
                                                </TableCell>
                                                <TableCell>{tx.payeeName}</TableCell>
                                                <TableCell>{tx.categoryNames?.join(', ') || 'N/A'}</TableCell>
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
                                    <TableCaption>
                                        Showing {currentTransactions.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}-
                                        {Math.min(currentPage * ITEMS_PER_PAGE, transactions.length)} of {transactions.length} transactions.
                                    </TableCaption>
                                </Table>
                            </div>
                        )}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center space-x-2 py-4 mt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </Button>
                                {getPageNumbers().map((page, index) =>
                                    typeof page === 'number' ? (
                                        <Button
                                            key={`page-${page}`}
                                            variant={currentPage === page ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => handlePageChange(page)}
                                            className="w-9 h-9 p-0"
                                        >
                                            {page}
                                        </Button>
                                    ) : (<span key={`ellipsis-${index}`} className="px-2 py-1 text-sm">{page}</span>)
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="shadow-xl">
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <CardTitle className={cn("font-bold text-xl lg:text-2xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                                    <PieChartIcon className="h-6 w-6 text-primary" />
                                    Account Balance Distribution
                                </CardTitle>
                                <CardDescription>
                                    Current balance breakdown across all petty cash accounts.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[400px] w-full">
                        <PettyCashAccountPieChart data={accountPieChartData} />
                    </CardContent>
                </Card>

                <Card className="shadow-xl">
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <CardTitle className={cn("font-bold text-xl lg:text-2xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                                    <BarChart3 className="h-6 w-6 text-primary" />
                                    Monthly Transaction Flow
                                </CardTitle>
                                <CardDescription>
                                    Total debits and credits for each month in the selected year.
                                </CardDescription>
                            </div>
                            <div className="w-full sm:w-auto">
                                <Label htmlFor="chart-year-select">Select Year</Label>
                                <Select value={selectedChartYear} onValueChange={setSelectedChartYear}>
                                    <SelectTrigger id="chart-year-select" className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="Select Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {chartYearOptions.map((year) => (
                                            <SelectItem key={year} value={year}>{year}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[400px] w-full">
                        <MonthlyTransactionBarChart data={monthlyBarChartData} />
                    </CardContent>
                </Card>
            </div>
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                        <ListChecks className="h-7 w-7 text-primary" />
                        Recent Sales Invoices
                    </CardTitle>
                    <CardDescription>A view of the latest sales invoices.</CardDescription>
                </CardHeader>
                <CardContent>
                    <SalesInvoiceList showFilters={false} itemsPerPage={5} />
                </CardContent>
            </Card>
        </div>
    );
}
