
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Undo2, Loader2, Filter, XCircle, Users, CalendarDays, ChevronLeft, ChevronRight, FileText, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Swal from 'sweetalert2';
import type { SaleDocument, CustomerDocument, SaleStatus, ItemDocument } from '@/types';
import { format, parseISO, isValid, getYear } from 'date-fns';
import { collection, getDocs, doc, query, orderBy as firestoreOrderBy, writeBatch, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (amount?: number, currencySymbol: string = 'USD') => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currencySymbol} N/A`;
  return `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
const saleStatusOptions: SaleStatus[] = ["Draft", "Completed", "Cancelled", "Refunded"];

const ALL_YEARS_VALUE = "__ALL_YEARS_REFUND__";
const ALL_CUSTOMERS_VALUE = "__ALL_CUSTOMERS_REFUND__";
const ALL_STATUSES_VALUE = "__ALL_STATUSES_REFUND__";
const SALE_ITEMS_PER_PAGE = 10;

export default function InventoryRefundsReturnsPage() {
  const router = useRouter();
  const [allSales, setAllSales] = useState<SaleDocument[]>([]);
  const [displayedSales, setDisplayedSales] = useState<SaleDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterSaleId, setFilterSaleId] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterYear, setFilterYear] = useState<string>(ALL_YEARS_VALUE);
  const [filterStatus, setFilterStatus] = useState<SaleStatus | ''>('');

  const [customerOptions, setCustomerOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchSalesData = React.useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const salesQuery = query(collection(firestore, "sales"), firestoreOrderBy("createdAt", "desc"));
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
  }, [fetchSalesData]);

  useEffect(() => {
    let filtered = [...allSales];
    if (filterSaleId) filtered = filtered.filter(sale => sale.id?.toLowerCase().includes(filterSaleId.toLowerCase()));
    if (filterCustomerId && filterCustomerId !== ALL_CUSTOMERS_VALUE) filtered = filtered.filter(sale => sale.customerId === filterCustomerId);
    if (filterYear && filterYear !== ALL_YEARS_VALUE) {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(sale => sale.saleDate && getYear(parseISO(sale.saleDate)) === yearNum);
    }
    if (filterStatus && filterStatus !== ALL_STATUSES_VALUE) filtered = filtered.filter(sale => sale.status === filterStatus);
    setDisplayedSales(filtered);
    setCurrentPage(1);
  }, [allSales, filterSaleId, filterCustomerId, filterYear, filterStatus]);

  const handleProcessRefund = async (sale: SaleDocument) => {
    const { value: reason } = await Swal.fire({
      title: `Process Refund/Return for Sale ID: ${sale.id.substring(0, 8)}...`,
      input: 'textarea',
      inputLabel: 'Reason for Refund/Return (Optional)',
      inputPlaceholder: 'Enter reason here...',
      showCancelButton: true,
      confirmButtonText: 'Confirm Refund/Return',
      cancelButtonText: 'Cancel',
      inputValidator: (value) => {
        // Optional, so no validation needed unless you want max length etc.
        return null;
      }
    });

    if (reason !== undefined) { // User clicked "Confirm" (reason can be empty string)
      setIsLoading(true);
      const batch = writeBatch(firestore);
      const saleDocRef = doc(firestore, "sales", sale.id);
      
      batch.update(saleDocRef, {
        status: "Refunded" as SaleStatus,
        returnReason: reason || "",
        refundDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        updatedAt: serverTimestamp()
      });

      let stockUpdateSuccessful = true;
      for (const lineItem of sale.lineItems) {
        if (lineItem.itemId) {
          const itemDocRef = doc(firestore, "items", lineItem.itemId);
          try {
            const itemDocSnap = await getDoc(itemDocRef);
            if (itemDocSnap.exists()) {
              const itemData = itemDocSnap.data() as ItemDocument;
              if (itemData.manageStock) {
                const newQuantity = (itemData.currentQuantity || 0) + lineItem.qty;
                batch.update(itemDocRef, { currentQuantity: newQuantity, updatedAt: serverTimestamp() });
              }
            } else {
              console.warn(`Item ${lineItem.itemId} not found for stock update during refund.`);
            }
          } catch (error) {
            console.error(`Error updating stock for item ${lineItem.itemId}:`, error);
            stockUpdateSuccessful = false; 
          }
        }
      }

      try {
        await batch.commit();
        Swal.fire('Refund Processed!', `Sale ${sale.id.substring(0,8)} has been marked as Refunded. Item stock (if managed) has been updated.`, 'success');
        fetchSalesData(); // Refresh the list
      } catch (error: any) {
        Swal.fire("Error", `Could not process refund: ${error.message}`, "error");
      } finally {
        setIsLoading(false);
      }
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
      case "Completed": return "default";
      case "Draft": return "outline";
      case "Cancelled": return "destructive";
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
                <div><Label htmlFor="customerFilterRefund" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground"/>Customer</Label>
                  <Combobox options={customerOptions} value={filterCustomerId || ALL_CUSTOMERS_VALUE} onValueChange={(v) => setFilterCustomerId(v === ALL_CUSTOMERS_VALUE ? '' : v)} placeholder="Search Customer..." selectPlaceholder="All Customers" disabled={isLoadingCustomers}/>
                </div>
                <div><Label htmlFor="yearFilterRefund" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground"/>Year</Label>
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
                      <TableCell className="font-medium p-2 sm:p-4">{sale.id.substring(0,8)}...</TableCell>
                      <TableCell className="p-2 sm:p-4">{sale.customerName || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatDisplayDate(sale.saleDate)}</TableCell>
                      <TableCell className="p-2 sm:p-4 truncate max-w-[200px]" title={getFirstItemName(sale.lineItems)}>{getFirstItemName(sale.lineItems)} ({getTotalQuantity(sale.lineItems)} qty)</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatCurrencyValue(sale.totalAmount)}</TableCell>
                      <TableCell className="p-2 sm:p-4"><Badge variant={getSaleStatusBadgeVariant(sale.status)}>{sale.status || "N/A"}</Badge></TableCell>
                       <TableCell className="p-2 sm:p-4 text-xs text-muted-foreground truncate max-w-[150px]" title={sale.returnReason}>{sale.returnReason || 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-1 p-2 sm:p-4">
                        <TooltipProvider>
                           <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleProcessRefund(sale)}
                                  disabled={sale.status === "Refunded" || sale.status === "Cancelled"}
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
                List of sales eligible for refunds/returns. Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedSales.length)} of {displayedSales.length} entries.
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
    </div>
  );
}

