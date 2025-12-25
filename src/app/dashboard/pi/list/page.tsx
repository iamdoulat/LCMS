
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, ListChecks, FileEdit, Trash2, Loader2, Filter, XCircle, Users, CalendarDays, ChevronLeft, ChevronRight, MoreHorizontal, Printer } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Swal from 'sweetalert2';
import type { InvoiceDocument, CustomerDocument, InvoiceStatus } from '@/types';
import { invoiceStatusOptions } from '@/types'; // Make sure this is exported from types
import { format, parseISO, isValid, getYear } from 'date-fns';
import { collection, getDocs, deleteDoc, doc, query, orderBy as firestoreOrderBy } from 'firebase/firestore';
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

const formatCurrencyValue = (amount?: number, currencySymbol: string = 'USD') => { // Assuming USD as default
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

const invoiceSortOptions = [
  { value: "invoiceDate", label: "Invoice Date" },
  { value: "dueDate", label: "Due Date" },
  { value: "customerName", label: "Customer Name" },
  { value: "salesperson", label: "Salesperson" },
  { value: "totalAmount", label: "Grand Total" },
  { value: "status", label: "Status" },
];

const currentSystemYear = new Date().getFullYear();
const invoiceYearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];

const ALL_YEARS_VALUE = "__ALL_YEARS_INVOICE__";
const ALL_CUSTOMERS_VALUE = "__ALL_CUSTOMERS_INVOICE__";
const ALL_STATUSES_VALUE = "__ALL_STATUSES_INVOICE__";
const INVOICE_ITEMS_PER_PAGE = 10;

export default function InvoicesListPage() {
  const router = useRouter();
  const [allInvoices, setAllInvoices] = useState<InvoiceDocument[]>([]);
  const [displayedInvoices, setDisplayedInvoices] = useState<InvoiceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterInvoiceNumber, setFilterInvoiceNumber] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterSalesperson, setFilterSalesperson] = useState('');
  const [filterYear, setFilterYear] = useState<string>(ALL_YEARS_VALUE);
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | ''>('');

  const [customerOptions, setCustomerOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);

  const [sortBy, setSortBy] = useState<string>('invoiceDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const invoicesQuery = query(collection(firestore, "invoices"), firestoreOrderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(invoicesQuery);
        const fetchedInvoices = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
          } as InvoiceDocument;
        });
        setAllInvoices(fetchedInvoices);
      } catch (error: any) {
        console.error("Error fetching invoices: ", error);
        let errorMessage = `Could not fetch invoice data from Firestore. Please ensure Firestore rules allow reads.`;
        if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes("permission"))) {
          errorMessage = `Could not fetch invoice data: Missing or insufficient permissions. Please check Firestore security rules for the 'invoices' collection.`;
        } else if (error.message && error.message.toLowerCase().includes("index")) {
          errorMessage = `Could not fetch invoice data: A Firestore index might be required for this query. Please check the browser's developer console for a link to create it automatically.`;
        } else if (error.message) {
          errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire("Fetch Error", errorMessage, "error");
      } finally {
        setIsLoading(false);
      }
    };

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

    fetchInitialData();
    fetchCustomerOptions();
  }, []);

  useEffect(() => {
    let filtered = [...allInvoices];

    if (filterInvoiceNumber) {
      filtered = filtered.filter(inv => inv.id?.toLowerCase().includes(filterInvoiceNumber.toLowerCase()));
    }
    if (filterCustomerId) {
      filtered = filtered.filter(inv => inv.customerId === filterCustomerId);
    }
    if (filterSalesperson) {
      filtered = filtered.filter(inv => inv.salesperson?.toLowerCase().includes(filterSalesperson.toLowerCase()));
    }
    if (filterYear && filterYear !== ALL_YEARS_VALUE) {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(inv => {
        if (inv.invoiceDate) {
          try {
            const invoiceDateYear = getYear(parseISO(inv.invoiceDate));
            return invoiceDateYear === yearNum;
          } catch { return false; }
        }
        return false;
      });
    }
    if (filterStatus) {
      filtered = filtered.filter(inv => inv.status === filterStatus);
    }

    if (sortBy) {
      filtered.sort((a, b) => {
        let valA = (a as any)[sortBy];
        let valB = (b as any)[sortBy];
        if ((sortBy === 'invoiceDate' || sortBy === 'dueDate') && typeof valA === 'string' && typeof valB === 'string') {
          try { valA = parseISO(valA); valB = parseISO(valB); } catch { /* ignore */ }
        }
        if (sortBy === 'totalAmount') { valA = Number(valA) || 0; valB = Number(valB) || 0; }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setDisplayedInvoices(filtered);
    setCurrentPage(1);
  }, [allInvoices, filterInvoiceNumber, filterCustomerId, filterSalesperson, filterYear, filterStatus, sortBy, sortOrder]);

  const handleEditInvoice = (invoiceId: string) => {
    router.push(`/dashboard/pi/edit/${invoiceId}`);
  };

  const handleDeleteInvoice = (invoiceId: string, invoiceIdentifier?: string) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `This will permanently delete Invoice ID "${invoiceIdentifier || invoiceId}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "invoices", invoiceId));
          setAllInvoices(prevInvoices => prevInvoices.filter(inv => inv.id !== invoiceId));
          Swal.fire('Deleted!', `Invoice "${invoiceIdentifier || invoiceId}" has been removed.`, 'success');
        } catch (error: any) {
          Swal.fire("Error", `Could not delete invoice: ${error.message}`, "error");
        }
      }
    });
  };

  const handlePreviewPdf = (invoiceId: string) => {
    window.open(`/dashboard/pi/preview/${invoiceId}`, '_blank');
  };

  const clearFilters = () => {
    setFilterInvoiceNumber('');
    setFilterCustomerId('');
    setFilterSalesperson('');
    setFilterYear(ALL_YEARS_VALUE);
    setFilterStatus('');
    setSortBy('invoiceDate');
    setSortOrder('desc');
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
      case "Paid":
        return "default";
      case "Draft":
        return "outline";
      case "Sent":
      case "Partial":
        return "secondary";
      case "Overdue":
      case "Void":
        return "destructive";
      case "Refunded":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ListChecks className="h-7 w-7 text-primary" />
                Proforma Invoices List
              </CardTitle>
              <CardDescription>
                View, search, filter, and manage all sales invoices.
              </CardDescription>
            </div>
            <Link href="/dashboard/pi/create" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" />
                Create New Proforma Invoice
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4">
              <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter & Sort Options</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
                <div>
                  <Label htmlFor="invoiceNoFilter" className="text-sm font-medium">Invoice No.</Label>
                  <Input id="invoiceNoFilter" placeholder="Search by Invoice No..." value={filterInvoiceNumber} onChange={(e) => setFilterInvoiceNumber(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="customerFilterInvoice" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground" />Customer</Label>
                  <Combobox
                    options={customerOptions}
                    value={filterCustomerId || ALL_CUSTOMERS_VALUE}
                    onValueChange={(value) => setFilterCustomerId(value === ALL_CUSTOMERS_VALUE ? '' : value)}
                    placeholder="Search Customer..."
                    selectPlaceholder={isLoadingCustomers ? "Loading..." : "All Customers"}
                    emptyStateMessage="No customer found."
                    disabled={isLoadingCustomers}
                  />
                </div>
                <div>
                  <Label htmlFor="salespersonFilterInvoice" className="text-sm font-medium">Salesperson</Label>
                  <Input id="salespersonFilterInvoice" placeholder="Search by Salesperson..." value={filterSalesperson} onChange={(e) => setFilterSalesperson(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="yearFilterInvoice" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground" />Year (Invoice Date)</Label>
                  <Select value={filterYear} onValueChange={(value) => setFilterYear(value)}>
                    <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                    <SelectContent>
                      {invoiceYearFilterOptions.map(yearOpt => <SelectItem key={yearOpt} value={yearOpt}>{yearOpt === ALL_YEARS_VALUE ? "All Years" : yearOpt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="statusFilterInvoice" className="text-sm font-medium">Status</Label>
                  <Select value={filterStatus || ALL_STATUSES_VALUE} onValueChange={(value) => setFilterStatus(value === ALL_STATUSES_VALUE ? '' : value as InvoiceStatus)}>
                    <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>
                      {invoiceStatusOptions.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sortByInvoice" className="text-sm font-medium">Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {invoiceSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sortOrderInvoice" className="text-sm font-medium">Order</Label>
                  <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="xl:col-start-4">
                  <Button onClick={clearFilters} variant="outline" className="w-full">
                    <XCircle className="mr-2 h-4 w-4" /> Clear Filters & Sort
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2 sm:px-4">Invoice No.</TableHead>
                  <TableHead className="px-2 sm:px-4">Customer</TableHead>
                  <TableHead className="px-2 sm:px-4">Salesperson</TableHead>
                  <TableHead className="px-2 sm:px-4">Invoice Date</TableHead>
                  <TableHead className="px-2 sm:px-4">Due Date</TableHead>
                  <TableHead className="px-2 sm:px-4">Items Summary</TableHead>
                  <TableHead className="px-2 sm:px-4">Grand Total</TableHead>
                  <TableHead className="px-2 sm:px-4">Status</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center p-2 sm:p-4"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary inline" /> Loading Invoices...</TableCell></TableRow>
                ) : fetchError ? (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center text-destructive px-2 sm:px-4 whitespace-pre-wrap">{fetchError}</TableCell></TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium p-2 sm:p-4">{invoice.id}</TableCell>
                      <TableCell className="p-2 sm:px-4">{invoice.customerName || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:px-4">{invoice.salesperson || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:px-4">{formatDisplayDate(invoice.invoiceDate)}</TableCell>
                      <TableCell className="p-2 sm:px-4">{formatDisplayDate(invoice.dueDate)}</TableCell>
                      <TableCell className="p-2 sm:px-4 truncate max-w-xs" title={getFirstItemName(invoice.lineItems)}>{getFirstItemName(invoice.lineItems)} ({getTotalQuantity(invoice.lineItems)} qty)</TableCell>
                      <TableCell className="p-2 sm:px-4">{formatCurrencyValue(invoice.totalAmount)}</TableCell>
                      <TableCell className="p-2 sm:px-4"><Badge variant={getInvoiceStatusBadgeVariant(invoice.status)}>{invoice.status || "N/A"}</Badge></TableCell>
                      <TableCell className="text-right p-2 sm:px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!invoice.id}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => invoice.id && handleEditInvoice(invoice.id)}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => invoice.id && handlePreviewPdf(invoice.id)}>
                              <Printer className="mr-2 h-4 w-4" />
                              <span>Preview</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => invoice.id && handleDeleteInvoice(invoice.id, invoice.id)}
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center p-2 sm:p-4">No invoices found matching your criteria.</TableCell></TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your Proforma invoices. Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedInvoices.length)} of {displayedInvoices.length} entries.
              </TableCaption>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4">
              <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (<Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(page)} className="w-9 h-9 p-0">{page}</Button>)
                  : (<span key={`ellipsis-invoice-${index}`} className="px-2 py-1 text-sm">{page}</span>)
              )}
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
