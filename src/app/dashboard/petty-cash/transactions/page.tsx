
"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Info, AlertTriangle, DollarSign, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import type { PettyCashTransactionDocument } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import { AddPettyCashTransactionForm } from '@/components/forms/AddPettyCashTransactionForm';
import { EditPettyCashTransactionForm } from '@/components/forms/EditPettyCashTransactionForm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';

const formatDisplayDate = (dateString?: string | null | Timestamp): string => {
  if (!dateString) return 'N/A';
  try {
    const date = dateString instanceof Timestamp ? dateString.toDate() : parseISO(dateString as string);
    return isValid(date) ? format(date, 'PPP') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `USD N/A`;
  return `USD ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function DailyTransactionsPage() {
    const { userRole } = useAuth();
    const isReadOnly = userRole?.includes('Viewer');
    const [transactions, setTransactions] = React.useState<PettyCashTransactionDocument[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [fetchError, setFetchError] = React.useState<string | null>(null);
    const [isAddFormOpen, setIsAddFormOpen] = React.useState(false);
    const [isEditFormOpen, setIsEditFormOpen] = React.useState(false);
    const [editingTransaction, setEditingTransaction] = React.useState<PettyCashTransactionDocument | null>(null);

    React.useEffect(() => {
        setIsLoading(true);
        const q = query(collection(firestore, "petty_cash_transactions"), orderBy("transactionDate", "desc"));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedTransactions = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data(),
            } as PettyCashTransactionDocument));
            setTransactions(fetchedTransactions);
            setIsLoading(false);
            setFetchError(null);
        }, (error) => {
            console.error("Error fetching transactions: ", error);
            let errorMessage = "Could not fetch transaction data. Please ensure Firestore rules allow reads for 'petty_cash_transactions' collection.";
            if (error.code === 'permission-denied') {
                errorMessage = "Permission denied. You do not have access to view this data.";
            } else if (error.message?.toLowerCase().includes("index")) {
                errorMessage = "An index is required for this query. Please check the browser console for a link to create it automatically.";
            }
            setFetchError(errorMessage);
            setIsLoading(false);
        });

        return () => unsubscribe();
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

    return (
        <div className="container mx-auto py-8">
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

