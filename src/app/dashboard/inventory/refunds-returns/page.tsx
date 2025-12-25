
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Undo2, Loader2, Filter, XCircle, Users, ChevronLeft, ChevronRight, Wallet, List, CalendarDays } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Swal from 'sweetalert2';
import type { SaleDocument, CustomerDocument, SaleStatus, ItemDocument, PettyCashAccountDocument, PettyCashCategoryDocument, PettyCashTransactionFormValues } from '@/types';
import { saleStatusOptions, PettyCashTransactionSchema } from '@/types';
import { format, parseISO, isValid, getYear } from 'date-fns';
import { collection, getDocs, doc, query, orderBy as firestoreOrderBy, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DatePickerField } from '@/components/forms/common';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { useAuth } from '@/context/AuthContext';
import { z } from 'zod';


const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `BDT N/A`;
  return `BDT ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getTotalQuantity = (lineItems: SaleDocument['lineItems']): number => {
  if (!lineItems || lineItems.length === 0) return 0;
  return lineItems.reduce((sum, item) => sum + (item.qty || 0), 0);
};

const getFirstItemName = (lineItems: SaleDocument['lineItems']): string => {
  if (!lineItems || lineItems.length === 0) return 'N/A';
  const firstItem = lineItems[0];
  let name = firstItem.itemName || 'Unnamed Item';
  if (lineItems.length > 1) {
    name += ` + ${lineItems.length - 1} more`;
  }
  return name;
};

const currentSystemYear = new Date().getFullYear();
const saleYearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];

const ALL_YEARS_VALUE = "__ALL_YEARS_REFUND__";
const ALL_CUSTOMERS_VALUE = "__ALL_CUSTOMERS_REFUND__";
const ALL_STATUSES_VALUE = "__ALL_STATUSES_REFUND__";
const SALE_ITEMS_PER_PAGE = 10;


const returnReasonSchema = z.object({
  returnReason: z.string().optional()
});
type ReturnReasonFormValues = z.infer<typeof returnReasonSchema>;

export default function InventoryRefundsReturnsPage() {
  const { user } = useAuth();

  const [allSales, setAllSales] = useState<SaleDocument[]>([]);
  const [displayedSales, setDisplayedSales] = useState<SaleDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterSaleId, setFilterSaleId] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterYear, setFilterYear] = useState<string>(ALL_YEARS_VALUE);
  const [filterStatus, setFilterStatus] = useState<SaleStatus | ''>('');

  const [customerOptions, setCustomerOptions] = useState<ComboboxOption[]>([]);
  const [accountOptions, setAccountOptions] = React.useState<ComboboxOption[]>([]);
  const [categoryOptions, setCategoryOptions] = React.useState<MultiSelectOption[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingPettyCashOptions, setIsLoadingPettyCashOptions] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const [isRefundReasonDialogOpen, setIsRefundReasonDialogOpen] = useState(false);
  const [isDebitTxDialogOpen, setIsDebitTxDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedSaleForRefund, setSelectedSaleForRefund] = useState<SaleDocument | null>(null);
  const [refundReason, setRefundReason] = useState<string>('');

  const fetchSalesData = React.useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const salesQuery = query(collection(firestore, "sales_invoice"), firestoreOrderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(salesQuery);
      const fetchedSales = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return { id: docSnap.id, ...data } as SaleDocument;
      });
      setAllSales(fetchedSales);
    } catch (error: any) {
      const errorMsg = `Could not fetch sales data. Error: ${error.message}`;
      setFetchError(errorMsg);
      Swal.fire("Fetch Error", errorMsg, "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSalesData();
    const fetchDropdownOptions = async () => {
      setIsLoadingCustomers(true);
      setIsLoadingPettyCashOptions(true);
      try {
        const [customersSnapshot, accountsSnapshot, categoriesSnapshot] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(query(collection(firestore, "petty_cash_accounts"))),
          getDocs(query(collection(firestore, "petty_cash_categories"))),
        ]);
        setCustomerOptions(
          customersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as CustomerDocument).applicantName || 'Unnamed Customer' }))
        );
        setAccountOptions(
          accountsSnapshot.docs.map(d => ({ value: d.id, label: (d.data() as PettyCashAccountDocument).name || 'Unnamed Account' }))
        );
        setCategoryOptions(
          categoriesSnapshot.docs.map(d => ({ value: d.id, label: (d.data() as PettyCashCategoryDocument).name || 'Unnamed Category' }))
        );
      } catch (error: any) {
        Swal.fire("Error", `Could not load dropdown options. Error: ${(error as Error).message}`, "error");
      } finally {
        setIsLoadingCustomers(false);
        setIsLoadingPettyCashOptions(false);
      }
    };
    fetchDropdownOptions();
  }, [fetchSalesData]);

  const returnReasonForm = useForm<ReturnReasonFormValues>({
    resolver: zodResolver(returnReasonSchema),
    defaultValues: { returnReason: '' },
  });

  const debitTxForm = useForm<PettyCashTransactionFormValues>({
    resolver: zodResolver(PettyCashTransactionSchema),
  });

  const openRefundReasonDialog = (sale: SaleDocument) => {
    setSelectedSaleForRefund(sale);
    returnReasonForm.reset({ returnReason: sale.refundReason || '' });
    setIsRefundReasonDialogOpen(true);
  };

  const handleConfirmRefundAndOpenTxDialog = (data: ReturnReasonFormValues) => {
    setRefundReason(data.returnReason || '');

    if (selectedSaleForRefund) {
      const refundCategory = categoryOptions.find(c => c.label.toLowerCase().includes("refund"));
      debitTxForm.reset({
        transactionDate: new Date(),
        accountId: accountOptions.find(a => a.label.toLowerCase() === "petty cash")?.value || accountOptions[0]?.value || '',
        type: 'Debit',
        payeeName: selectedSaleForRefund.customerName,
        amount: selectedSaleForRefund.amountPaid || selectedSaleForRefund.totalAmount,
        purpose: `Refund for Invoice #${selectedSaleForRefund.id.substring(0, 8)}...`,
        categoryIds: refundCategory ? [refundCategory.value] : [],
        description: data.returnReason || `Refund processed for Invoice #${selectedSaleForRefund.id.substring(0, 8)}...`,
      });
      setIsDebitTxDialogOpen(true); // This will now open the second dialog
    }
    setIsRefundReasonDialogOpen(false); // Close the first dialog
  };


  useEffect(() => {
    let filtered = [...allSales];
    if (filterSaleId) filtered = filtered.filter(sale => sale.id?.toLowerCase().includes(filterSaleId.toLowerCase()));
    if (filterCustomerId) filtered = filtered.filter(sale => sale.customerId === filterCustomerId);
    if (filterYear && filterYear !== ALL_YEARS_VALUE) {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(sale => sale.invoiceDate && getYear(parseISO(sale.invoiceDate)) === yearNum);
    }
    if (filterStatus) filtered = filtered.filter(sale => sale.status === filterStatus);
    setDisplayedSales(filtered);
    setCurrentPage(1);
  }, [allSales, filterSaleId, filterCustomerId, filterYear, filterStatus]);

  const handleProcessRefundAndDebit = async (data: PettyCashTransactionFormValues) => {
    if (!selectedSaleForRefund) return;
    if (!user) {
      Swal.fire("Authentication Error", "You must be logged in to process a refund.", "error");
      return;
    }

    setIsSubmitting(true);
    const batch = writeBatch(firestore);
    const saleDocRef = doc(firestore, "sales_invoice", selectedSaleForRefund.id);
    const accountDocRef = doc(firestore, "petty_cash_accounts", data.accountId);
    const transactionRef = doc(collection(firestore, "petty_cash_transactions"));

    // 1. Update invoice status with reason from first dialog
    batch.update(saleDocRef, {
      status: "Refunded" as SaleStatus,
      refundReason: refundReason, // Use the stored reason
      refundDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      updatedAt: serverTimestamp()
    });

    // 2. Restock items
    for (const lineItem of selectedSaleForRefund.lineItems) {
      if (lineItem.itemId) {
        const itemDocRef = doc(firestore, "items", lineItem.itemId);
        const itemDocSnap = await getDoc(itemDocRef);
        if (itemDocSnap.exists()) {
          const itemData = itemDocSnap.data() as ItemDocument;
          if (itemData.manageStock) {
            const newQuantity = (itemData.currentQuantity || 0) + lineItem.qty;
            batch.update(itemDocRef, { currentQuantity: newQuantity, updatedAt: serverTimestamp() });
          }
        }
      }
    }

    // 3. Create Petty Cash Debit Transaction from the second form
    const selectedAccount = accountOptions.find(opt => opt.value === data.accountId);
    const selectedCategories = categoryOptions.filter(opt => data.categoryIds?.includes(opt.value));

    const debitTxData = {
      transactionDate: format(data.transactionDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      accountId: data.accountId,
      accountName: selectedAccount?.label || 'N/A',
      categoryIds: data.categoryIds,
      categoryNames: selectedCategories.map(c => c.label),
      type: 'Debit', // Hardcoded as debit for refund
      payeeName: data.payeeName,
      amount: data.amount,
      purpose: data.purpose,
      description: data.description || `Refund for Invoice #${selectedSaleForRefund.id.substring(0, 8)}`,
      connectedSaleId: selectedSaleForRefund.id,
      createdBy: user.displayName || user.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    batch.set(transactionRef, debitTxData);

    // 4. Update Account Balance
    const accountDocSnap = await getDoc(accountDocRef);
    if (!accountDocSnap.exists()) {
      throw new Error("Selected petty cash account not found.");
    }
    const currentBalance = accountDocSnap.data().balance || 0;
    const newBalance = currentBalance - Number(data.amount);
    batch.update(accountDocRef, { balance: newBalance, updatedAt: serverTimestamp() });

    try {
      await batch.commit();
      Swal.fire('Refund Processed!', `Sale ${selectedSaleForRefund.id.substring(0, 8)} has been refunded and a debit transaction was created.`, 'success');
      fetchSalesData(); // Refresh the list
      setIsDebitTxDialogOpen(false);
      setRefundReason(''); // Clear stored reason
      setSelectedSaleForRefund(null);
    } catch (error: any) {
      Swal.fire("Error", `Could not process refund: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };


  const clearFilters = () => {
    setFilterSaleId('');
    setFilterCustomerId('');
    setFilterYear(ALL_YEARS_VALUE);
    setFilterStatus('');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(displayedSales.length / SALE_ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * SALE_ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - SALE_ITEMS_PER_PAGE;
  const currentItems = displayedSales.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber: number) => setCurrentPage(pageNumber);
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

  const getPageNumbers = () => {
    const pageNumbers = []; const maxPagesToShow = 5; const halfPagesToShow = Math.floor(maxPagesToShow / 2);
    if (totalPages <= maxPagesToShow + 2) { for (let i = 1; i <= totalPages; i++) pageNumbers.push(i); }
    else {
      pageNumbers.push(1); let startPage = Math.max(2, currentPage - halfPagesToShow); let endPage = Math.min(totalPages - 1, currentPage + halfPagesToShow);
      if (currentPage <= halfPagesToShow + 1) endPage = Math.min(totalPages - 1, maxPagesToShow);
      if (currentPage >= totalPages - halfPagesToShow) startPage = Math.max(2, totalPages - maxPagesToShow + 1);
      if (startPage > 2) pageNumbers.push("...");
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalPages - 1) pageNumbers.push("...");
      pageNumbers.push(totalPages);
    } return pageNumbers;
  };

  const getSaleStatusBadgeVariant = (status?: SaleStatus): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case "Paid": return "default";
      case "Draft": return "outline";
      case "Sent": case "Partial": return "secondary";
      case "Overdue": case "Void": return "destructive";
      case "Cancelled": return "destructive";
      case "Refunded": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="max-w-none mx-[25px] py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Undo2 className="h-7 w-7 text-primary" />
            Refunds &amp; Returns Management
          </CardTitle>
          <CardDescription>
            View sales and process refunds or returns. This will update sale status and item stock levels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4"><CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Sales</CardTitle></CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div><Label htmlFor="saleIdFilterRefund" className="text-sm font-medium">Sale ID</Label><Input id="saleIdFilterRefund" placeholder="Search by Sale ID..." value={filterSaleId} onChange={(e) => setFilterSaleId(e.target.value)} /></div>
                <div><Label htmlFor="customerFilterRefund" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground" />Customer</Label>
                  <Combobox options={customerOptions} value={filterCustomerId || ALL_CUSTOMERS_VALUE} onValueChange={(v) => setFilterCustomerId(v === ALL_CUSTOMERS_VALUE ? '' : v)} placeholder="Search Customer..." selectPlaceholder="All Customers" disabled={isLoadingCustomers} />
                </div>
                <div><Label htmlFor="yearFilterRefund" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground" />Year</Label>
                  <Select value={filterYear} onValueChange={setFilterYear}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{saleYearFilterOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label htmlFor="statusFilterRefund" className="text-sm font-medium">Status</Label>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === ALL_STATUSES_VALUE ? '' : v as SaleStatus)}><SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent><SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>{saleStatusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="lg:col-span-4 md:col-span-2"><Button onClick={clearFilters} variant="outline" className="w-full md:w-auto"><XCircle className="mr-2 h-4 w-4" /> Clear Filters</Button></div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2 sm:px-4">Sale ID</TableHead>
                  <TableHead className="px-2 sm:px-4">Customer</TableHead>
                  <TableHead className="px-2 sm:px-4">Sale Date</TableHead>
                  <TableHead className="px-2 sm:px-4">Items</TableHead>
                  <TableHead className="px-2 sm:px-4">Grand Total</TableHead>
                  <TableHead className="px-2 sm:px-4">Status</TableHead>
                  <TableHead className="px-2 sm:px-4">Return Reason</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center p-2 sm:p-4"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary inline" /> Loading sales...</TableCell></TableRow>
                ) : fetchError ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center text-destructive px-2 sm:px-4 whitespace-pre-wrap">{fetchError}</TableCell></TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium p-2 sm:p-4">{sale.id.substring(0, 8)}...</TableCell>
                      <TableCell className="p-2 sm:p-4">{sale.customerName || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatDisplayDate(sale.invoiceDate)}</TableCell>
                      <TableCell className="p-2 sm:p-4 truncate max-w-[200px]" title={getFirstItemName(sale.lineItems)}>{getFirstItemName(sale.lineItems)} ({getTotalQuantity(sale.lineItems)} qty)</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatCurrencyValue(sale.totalAmount)}</TableCell>
                      <TableCell className="p-2 sm:p-4"><Badge variant={getSaleStatusBadgeVariant(sale.status)}>{sale.status || "N/A"}</Badge></TableCell>
                      <TableCell className="p-2 sm:p-4 text-xs text-muted-foreground truncate max-w-[150px]" title={sale.refundReason}>{sale.refundReason || 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-1 p-2 sm:p-4">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => openRefundReasonDialog(sale)}
                                disabled={sale.status === "Refunded" || sale.status === "Cancelled" || sale.status === "Draft"}
                              >
                                <Undo2 className="mr-1.5 h-4 w-4" /> Process Refund/Return
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Process refund and restock items</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center p-2 sm:p-4">No sales found matching your criteria.</TableCell></TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                List of sales eligible for refunds/returns. Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-${Math.min(indexOfLastItem, displayedSales.length)} of {displayedSales.length} entries.
              </TableCaption>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4">
              <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (<Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(page)} className="w-9 h-9 p-0">{page}</Button>)
                  : (<span key={`ellipsis-refund-${index}`} className="px-2 py-1 text-sm">{page}</span>)
              )}
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRefundReasonDialogOpen} onOpenChange={setIsRefundReasonDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process Refund/Return for Invoice ID: {selectedSaleForRefund?.id.substring(0, 8)}...</DialogTitle>
            <DialogDescription>
              Enter a reason for this return. This is optional but recommended for record-keeping.
            </DialogDescription>
          </DialogHeader>
          <Form {...returnReasonForm}>
            <form onSubmit={returnReasonForm.handleSubmit(handleConfirmRefundAndOpenTxDialog)} className="space-y-4">
              <FormField
                control={returnReasonForm.control}
                name="returnReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Refund/Return (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Customer returned damaged goods..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="mt-4 pt-4 border-t">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" variant="destructive">
                  Confirm Refund/Return
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDebitTxDialogOpen} onOpenChange={setIsDebitTxDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Debit Transaction</DialogTitle>
            <DialogDescription>
              Confirm details for the refund debit from your petty cash account for Invoice <strong>#{selectedSaleForRefund?.id.substring(0, 8)}...</strong>
            </DialogDescription>
          </DialogHeader>
          <Form {...debitTxForm}>
            <form onSubmit={debitTxForm.handleSubmit(handleProcessRefundAndDebit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
              <FormField control={debitTxForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Refund Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={debitTxForm.control} name="transactionDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Debit Transaction Date</FormLabel><DatePickerField field={field} /><FormMessage /></FormItem>)} />
              <FormField
                control={debitTxForm.control} name="accountId" render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="flex items-center"><Wallet className="mr-1.5 h-4 w-4 text-muted-foreground" />Debit From Account*</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1" disabled={isLoadingPettyCashOptions}>
                        {accountOptions.map((account) => (
                          <FormItem key={account.value} className="flex items-center space-x-3 space-y-0">
                            <FormControl><RadioGroupItem value={account.value} /></FormControl>
                            <FormLabel className="font-normal">{account.label}</FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              <FormField
                control={debitTxForm.control} name="categoryIds" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><List className="mr-1.5 h-4 w-4 text-muted-foreground" />Category*</FormLabel>
                    <MultiSelect options={categoryOptions} selected={field.value || []} onChange={field.onChange} placeholder="Select categories..." disabled={isLoadingPettyCashOptions} />
                    <FormMessage />
                  </FormItem>
                )} />
              <DialogFooter className="mt-4 pt-4 border-t">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" variant="destructive" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm & Process
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
