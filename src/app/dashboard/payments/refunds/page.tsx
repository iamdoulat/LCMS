
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Undo2, Loader2, Filter, XCircle, Users, CalendarDays, ChevronLeft, ChevronRight, FileText, AlertTriangle, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Swal from 'sweetalert2';
import type { InvoiceDocument, CustomerDocument, InvoiceStatus, ItemDocument as ItemDoc } from '@/types'; // Changed from SaleDocument
import { invoiceStatusOptions } from '@/types'; // Import invoiceStatusOptions
import { format, parseISO, isValid, getYear } from 'date-fns';
import { collection, getDocs, doc, query, where, orderBy as firestoreOrderBy, writeBatch, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PPP') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (amount?: number, currencySymbol: string = 'USD') => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currencySymbol} N/A`;
  return `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getTotalQuantity = (lineItems: InvoiceDocument['lineItems']): number => {
  if (!lineItems || lineItems.length === 0) return 0;
  return lineItems.reduce((sum, item) => sum + (item.qty || 0), 0);
};

const getFirstItemName = (lineItems: InvoiceDocument['lineItems']): string => {
  if (!lineItems || lineItems.length === 0) return 'N/A';
  const firstItem = lineItems[0];
  let name = firstItem.itemName || 'Unnamed Item';
  if (lineItems.length > 1) {
    name += ` + ${lineItems.length - 1} more`;
  }
  return name;
};

const currentSystemYear = new Date().getFullYear();
const invoiceYearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];

const ALL_YEARS_VALUE = "__ALL_YEARS_INV_REFUND__";
const ALL_CUSTOMERS_VALUE = "__ALL_CUSTOMERS_INV_REFUND__";
const ALL_STATUSES_VALUE = "__ALL_STATUSES_INV_REFUND__";
const INVOICE_ITEMS_PER_PAGE = 10;

export default function InvoiceRefundsPage() {
  const router = useRouter();
  const [allInvoices, setAllInvoices] = useState<InvoiceDocument[]>([]); // Changed from allSales
  const [displayedInvoices, setDisplayedInvoices] = useState<InvoiceDocument[]>([]); // Changed from displayedSales
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterInvoiceId, setFilterInvoiceId] = useState(''); // Changed from filterSaleId
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterYear, setFilterYear] = useState<string>(ALL_YEARS_VALUE);
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | ''>(''); // Changed from SaleStatus

  const [customerOptions, setCustomerOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchInvoicesData = React.useCallback(async () => { // Renamed from fetchSalesData
    setIsLoading(true);
    setFetchError(null);
    try {
      // Filter for invoices that are 'Paid' or 'Partial' to be eligible for refund initially, or already 'Refunded'
      const eligibleStatuses: InvoiceStatus[] = ["Paid", "Partial", "Refunded", "Completed"];
      const invoicesQuery = query(
        collection(firestore, "invoices"),
        where("status", "in", eligibleStatuses),
        firestoreOrderBy("updatedAt", "desc") // Order by when they were last updated (e.g., paid or refunded)
      );
      const querySnapshot = await getDocs(invoicesQuery);
      const fetchedInvoices = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return { id: docSnap.id, ...data } as InvoiceDocument;
      });
      setAllInvoices(fetchedInvoices);
    } catch (error: any) {
      let errorMsg = `Could not fetch invoice data. Error: ${error.message}`;
      if (error.message?.toLowerCase().includes("index")) {
            errorMsg = `Could not fetch invoice data: A Firestore index might be required for 'invoices' collection on 'status' (array-contains-any) and 'updatedAt' (descending). Please check the browser console for a link to create it or create manually.`;
      }
      setFetchError(errorMsg);
      Swal.fire("Fetch Error", errorMsg, "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoicesData(); // Renamed call
    const fetchCustomerOptions = async () => {
      setIsLoadingCustomers(true);
      try {
        const customersSnapshot = await getDocs(collection(firestore, "customers"));
        setCustomerOptions(
          customersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as CustomerDocument).applicantName || 'Unnamed Customer' }))
        );
      } catch (error: any) {
        Swal.fire("Error", `Could not load customer options. Error: ${(error as Error).message}`, "error");
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    fetchCustomerOptions();
  }, [fetchInvoicesData]);

  useEffect(() => {
    let filtered = [...allInvoices];
    if (filterInvoiceId) filtered = filtered.filter(inv => inv.id?.toLowerCase().includes(filterInvoiceId.toLowerCase()));
    if (filterCustomerId) filtered = filtered.filter(inv => inv.customerId === filterCustomerId);
    if (filterYear && filterYear !== ALL_YEARS_VALUE) {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(inv => inv.invoiceDate && getYear(parseISO(inv.invoiceDate)) === yearNum);
    }
    if (filterStatus) {
      filtered = filtered.filter(inv => inv.status === filterStatus);
    }
    setDisplayedInvoices(filtered);
    setCurrentPage(1);
  }, [allInvoices, filterInvoiceId, filterCustomerId, filterYear, filterStatus]);

  const handleProcessRefund = async (invoice: InvoiceDocument) => {
    if (invoice.status !== "Paid" && invoice.status !== "Partial" && invoice.status !== "Completed") {
        Swal.fire("Action Not Allowed", `Cannot process refund for an invoice with status "${invoice.status}". Only 'Paid', 'Partial', or 'Completed' invoices are eligible.`, "warning");
        return;
    }

    const { value: reason } = await Swal.fire({
      title: `Process Refund for Invoice ID: ${invoice.id}`,
      input: 'textarea',
      inputLabel: 'Reason for Refund (Optional)',
      inputPlaceholder: 'Enter reason here...',
      showCancelButton: true,
      confirmButtonText: 'Confirm Refund',
      cancelButtonText: 'Cancel',
    });

    if (reason !== undefined) {
      setIsLoading(true);
      const batch = writeBatch(firestore);
      const invoiceDocRef = doc(firestore, "invoices", invoice.id);
      
      batch.update(invoiceDocRef, {
        status: "Refunded" as InvoiceStatus,
        refundReason: reason || "",
        refundDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        updatedAt: serverTimestamp()
      });

      for (const lineItem of invoice.lineItems) {
        if (lineItem.itemId) {
          const itemDocRef = doc(firestore, "items", lineItem.itemId);
          try {
            const itemDocSnap = await getDoc(itemDocRef); // Read outside batch
            if (itemDocSnap.exists()) {
              const itemData = itemDocSnap.data() as ItemDoc;
              if (itemData.manageStock) {
                const newQuantity = (itemData.currentQuantity || 0) + lineItem.qty;
                batch.update(itemDocRef, { currentQuantity: newQuantity, updatedAt: serverTimestamp() });
              }
            } else {
              console.warn(`Item ${lineItem.itemId} not found for stock update during refund.`);
            }
          } catch (error) {
            console.error(`Error updating stock for item ${lineItem.itemId}:`, error);
          }
        }
      }

      try {
        await batch.commit();
        Swal.fire('Refund Processed!', `Invoice ${invoice.id} has been marked as Refunded. Item stock (if managed) has been updated.`, 'success');
        fetchInvoicesData();
      } catch (error: any) {
        Swal.fire("Error", `Could not process refund: ${error.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const clearFilters = () => {
    setFilterInvoiceId('');
    setFilterCustomerId('');
    setFilterYear(ALL_YEARS_VALUE);
    setFilterStatus('');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(displayedInvoices.length / INVOICE_ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * INVOICE_ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - INVOICE_ITEMS_PER_PAGE;
  const currentItems = displayedInvoices.slice(indexOfFirstItem, indexOfLastItem);

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

  const getInvoiceStatusBadgeVariant = (status?: InvoiceStatus): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case "Paid": case "Completed": return "default";
      case "Draft": return "outline";
      case "Sent": case "Partial": return "secondary";
      case "Overdue": case "Void": return "destructive";
      case "Refunded": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Undo2 className="h-7 w-7 text-primary" />
            Process Invoice Refunds
          </CardTitle>
          <CardDescription>
            View paid or partially paid invoices and process refunds. This action updates the invoice status and item stock.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4"><CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Invoices</CardTitle></CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div><Label htmlFor="invoiceIdFilterRefund" className="text-sm font-medium">Invoice No.</Label><Input id="invoiceIdFilterRefund" placeholder="Search by Invoice No..." value={filterInvoiceId} onChange={(e) => setFilterInvoiceId(e.target.value)} /></div>
                <div><Label htmlFor="customerFilterInvRefund" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground"/>Customer</Label>
                  <Combobox options={customerOptions} value={filterCustomerId || ALL_CUSTOMERS_VALUE} onValueChange={(v) => setFilterCustomerId(v === ALL_CUSTOMERS_VALUE ? '' : v)} placeholder="Search Customer..." selectPlaceholder="All Customers" disabled={isLoadingCustomers}/>
                </div>
                <div><Label htmlFor="yearFilterInvRefund" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground"/>Year (Inv. Date)</Label>
                  <Select value={filterYear} onValueChange={setFilterYear}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{invoiceYearFilterOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label htmlFor="statusFilterInvRefund" className="text-sm font-medium">Status</Label>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === ALL_STATUSES_VALUE ? '' : v as InvoiceStatus)}><SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent><SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>{invoiceStatusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="lg:col-span-4 md:col-span-2"><Button onClick={clearFilters} variant="outline" className="w-full md:w-auto"><XCircle className="mr-2 h-4 w-4" /> Clear Filters</Button></div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2 sm:px-4">Invoice No.</TableHead>
                  <TableHead className="px-2 sm:px-4">Customer</TableHead>
                  <TableHead className="px-2 sm:px-4">Invoice Date</TableHead>
                  <TableHead className="px-2 sm:px-4">Due Date</TableHead>
                  <TableHead className="px-2 sm:px-4">Items</TableHead>
                  <TableHead className="px-2 sm:px-4">Grand Total</TableHead>
                  <TableHead className="px-2 sm:px-4">Status</TableHead>
                  <TableHead className="px-2 sm:px-4">Refund Reason</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {isLoading ? (
                   <TableRow><TableCell colSpan={9} className="h-24 text-center p-2 sm:p-4"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary inline" /> Loading invoices...</TableCell></TableRow>
                ) : fetchError ? (
                     <TableRow><TableCell colSpan={9} className="h-24 text-center text-destructive px-2 sm:px-4 whitespace-pre-wrap">{fetchError}</TableCell></TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium p-2 sm:p-4">{invoice.id}</TableCell>
                      <TableCell className="p-2 sm:p-4">{invoice.customerName || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatDisplayDate(invoice.invoiceDate)}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatDisplayDate(invoice.dueDate)}</TableCell>
                      <TableCell className="p-2 sm:p-4 truncate max-w-[200px]" title={getFirstItemName(invoice.lineItems)}>{getFirstItemName(invoice.lineItems)} ({getTotalQuantity(invoice.lineItems)} qty)</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatCurrencyValue(invoice.totalAmount)}</TableCell>
                      <TableCell className="p-2 sm:p-4"><Badge variant={getInvoiceStatusBadgeVariant(invoice.status)}>{invoice.status || "N/A"}</Badge></TableCell>
                       <TableCell className="p-2 sm:p-4 text-xs text-muted-foreground truncate max-w-[150px]" title={invoice.refundReason}>{invoice.refundReason || 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-1 p-2 sm:p-4">
                        <TooltipProvider>
                           <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleProcessRefund(invoice)}
                                  disabled={invoice.status !== "Paid" && invoice.status !== "Partial" && invoice.status !== "Completed"}
                                >
                                  <Undo2 className="mr-1.5 h-4 w-4" /> Process Refund
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Process refund and restock items</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center p-2 sm:p-4">No invoices found matching your criteria.</TableCell></TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                List of invoices eligible for refunds. Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedInvoices.length)} of {displayedInvoices.length} entries.
              </TableCaption>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4">
              <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (<Button key={`inv-refund-page-${page}`} variant={currentPage === page ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(page)} className="w-9 h-9 p-0">{page}</Button>)
                : (<span key={`ellipsis-inv-refund-${index}`} className="px-2 py-1 text-sm">{page}</span>)
              )}
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
