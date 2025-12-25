
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/forms/common';
import { Loader2, BarChart3, Printer, Filter, XCircle, Users, Wallet } from 'lucide-react';
import Swal from 'sweetalert2';
import type { PettyCashTransactionDocument, PettyCashAccountDocument, PettyCashCategoryDocument, TransactionType } from '@/types';
import { transactionTypes } from '@/types';
import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { collection, getDocs, query, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';

import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formatDisplayDate = (dateString?: string) => {
  if (!dateString || !isValid(parseISO(dateString))) return 'N/A';
  try {
    const date = parseISO(dateString);
    return format(date, 'PPP');
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `BDT N/A`;
  return `BDT ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const ALL_ACCOUNTS_VALUE = "__ALL_ACCOUNTS__";
const ALL_CATEGORIES_VALUE = "__ALL_CATEGORIES__";
const ALL_TYPES_VALUE = "__ALL_TYPES__";

export default function PettyCashReportsPage() {

  const [allTransactions, setAllTransactions] = useState<PettyCashTransactionDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterAccount, setFilterAccount] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterType, setFilterType] = useState<TransactionType | ''>('');
  const [filterPayee, setFilterPayee] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | null>(null);
  const [filterDateTo, setFilterDateTo] = useState<Date | null>(null);

  const [accountOptions, setAccountOptions] = useState<ComboboxOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);

  const filteredTransactions = useMemo(() => {
    let filtered = [...allTransactions];
    if (filterAccount) filtered = filtered.filter(tx => tx.accountId === filterAccount);
    if (filterCategory) filtered = filtered.filter(tx => tx.categoryIds?.includes(filterCategory));
    if (filterType) filtered = filtered.filter(tx => tx.type === filterType);
    if (filterPayee) filtered = filtered.filter(tx => tx.payeeName?.toLowerCase().includes(filterPayee.toLowerCase()));

    if (filterDateFrom) {
      const startDate = startOfDay(filterDateFrom);
      filtered = filtered.filter(tx => tx.transactionDate && isFinite(new Date(tx.transactionDate).getTime()) && new Date(tx.transactionDate) >= startDate);
    }
    if (filterDateTo) {
      const endDate = endOfDay(filterDateTo);
      filtered = filtered.filter(tx => tx.transactionDate && isFinite(new Date(tx.transactionDate).getTime()) && new Date(tx.transactionDate) <= endDate);
    }
    return filtered;
  }, [allTransactions, filterAccount, filterCategory, filterType, filterPayee, filterDateFrom, filterDateTo]);

  const reportTotals = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      if (tx.type === 'Debit') acc.totalDebits += tx.amount || 0;
      if (tx.type === 'Credit') acc.totalCredits += tx.amount || 0;
      return acc;
    }, { totalDebits: 0, totalCredits: 0 });
  }, [filteredTransactions]);


  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setIsLoadingDropdowns(true);
      setFetchError(null);
      try {
        const txQuery = query(collection(firestore, "petty_cash_transactions"), firestoreOrderBy("transactionDate", "desc"));
        const accountsQuery = query(collection(firestore, "petty_cash_accounts"), firestoreOrderBy("name"));
        const categoriesQuery = query(collection(firestore, "petty_cash_categories"), firestoreOrderBy("name"));

        const [txSnapshot, accountsSnapshot, categoriesSnapshot] = await Promise.all([
          getDocs(txQuery), getDocs(accountsQuery), getDocs(categoriesQuery)
        ]);

        setAllTransactions(txSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as PettyCashTransactionDocument)));
        setAccountOptions(accountsSnapshot.docs.map(d => ({ value: d.id, label: (d.data() as PettyCashAccountDocument).name || 'Unnamed Account' })));
        setCategoryOptions(categoriesSnapshot.docs.map(d => ({ value: d.id, label: (d.data() as PettyCashCategoryDocument).name || 'Unnamed Category' })));

      } catch (error: any) {
        const msg = `Could not fetch data for reports. Error: ${error.message}`;
        setFetchError(msg);
        Swal.fire("Fetch Error", msg, "error");
      } finally {
        setIsLoading(false);
        setIsLoadingDropdowns(false);
      }
    };
    fetchInitialData();
  }, []);

  const clearFilters = () => {
    setFilterAccount('');
    setFilterCategory('');
    setFilterType('');
    setFilterPayee('');
    setFilterDateFrom(null);
    setFilterDateTo(null);
  };

  const handlePrint = () => {
    if (filteredTransactions.length === 0) {
      Swal.fire("No Data", "There are no reports matching the current filters to print.", "info");
      return;
    }
    const reportData = {
      transactions: filteredTransactions,
      filters: {
        account: accountOptions.find(o => o.value === filterAccount)?.label || 'All',
        category: categoryOptions.find(o => o.value === filterCategory)?.label || 'All',
        type: filterType || 'All',
        payee: filterPayee || 'All',
        dateFrom: filterDateFrom ? format(filterDateFrom, 'PPP') : 'Start',
        dateTo: filterDateTo ? format(filterDateTo, 'PPP') : 'End'
      },
      totals: reportTotals
    };

    localStorage.setItem('pettyCashReportData', JSON.stringify(reportData));
    window.open(`/dashboard/petty-cash/reports/print`, '_blank');
  };

  return (
    <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader className="noprint">
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <BarChart3 className="h-7 w-7 text-primary" />
            Petty Cash Reports
          </CardTitle>
          <CardDescription>Generate daily, monthly, and yearly reports for your petty cash transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 shadow-md p-4 noprint">
            <CardHeader className="p-2 pb-4">
              <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                  <Label>Date From</Label>
                  <DatePickerField
                    field={{
                      value: filterDateFrom,
                      onChange: setFilterDateFrom,
                      name: 'filterDateFrom',
                      onBlur: () => { },
                      ref: () => { }
                    }}
                    placeholder="Start Date"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Date To</Label>
                  <DatePickerField
                    field={{
                      value: filterDateTo,
                      onChange: setFilterDateTo,
                      name: 'filterDateTo',
                      onBlur: () => { },
                      ref: () => { }
                    }}
                    placeholder="End Date"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center"><Wallet className="mr-1 h-4 w-4 text-muted-foreground" />Account</Label>
                  <Combobox options={accountOptions} value={filterAccount || ALL_ACCOUNTS_VALUE} onValueChange={(v) => setFilterAccount(v === ALL_ACCOUNTS_VALUE ? '' : v)} placeholder="Search Account..." selectPlaceholder="All Accounts" disabled={isLoadingDropdowns} />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground" />Payee / Payer</Label>
                  <Input placeholder="Search by payee name..." value={filterPayee} onChange={(e) => setFilterPayee(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground" />Category</Label>
                  <Combobox options={categoryOptions} value={filterCategory || ALL_CATEGORIES_VALUE} onValueChange={(v) => setFilterCategory(v === ALL_CATEGORIES_VALUE ? '' : v)} placeholder="Search Category..." selectPlaceholder="All Categories" disabled={isLoadingDropdowns} />
                </div>
                <div className="space-y-1">
                  <Label>Transaction Type</Label>
                  <Select value={filterType === '' ? ALL_TYPES_VALUE : filterType} onValueChange={(v) => setFilterType(v === ALL_TYPES_VALUE ? '' : v as TransactionType)}>
                    <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
                    <SelectContent><SelectItem value={ALL_TYPES_VALUE}>All Types</SelectItem>{transactionTypes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="pt-6">
                  <Button onClick={clearFilters} variant="outline" className="w-full"><XCircle className="mr-2 h-4 w-4" /> Clear Filters</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="my-4 text-center noprint">
            <Button onClick={handlePrint} variant="default" className="bg-primary hover:bg-primary/90">
              <Printer className="mr-2 h-4 w-4" /> Generate Report
            </Button>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
            ) : fetchError ? (
              <div className="text-center text-destructive p-8">{fetchError}</div>
            ) : filteredTransactions.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Payee/Payer</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell>{formatDisplayDate(tx.transactionDate)}</TableCell>
                        <TableCell>{tx.payeeName}</TableCell>
                        <TableCell>{tx.categoryNames?.join(', ')}</TableCell>
                        <TableCell>{tx.accountName || 'N/A'}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">{tx.type === 'Debit' ? formatCurrencyValue(tx.amount) : '-'}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">{tx.type === 'Credit' ? formatCurrencyValue(tx.amount) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4} className="text-right">Totals:</TableCell>
                    <TableCell className="text-right text-red-600">{formatCurrencyValue(reportTotals.totalDebits)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrencyValue(reportTotals.totalCredits)}</TableCell>
                  </TableRow>
                </Table>
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground">No transactions found matching your criteria.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
