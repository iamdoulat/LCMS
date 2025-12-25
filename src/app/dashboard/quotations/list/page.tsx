
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, ListChecks, FileEdit, Trash2, Loader2, Filter, XCircle, ArrowDownUp, Users, Building, CalendarDays, Hash, ChevronLeft, ChevronRight, ShoppingBag, DollarSign, MoreHorizontal, Printer } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Swal from 'sweetalert2';
import type { QuoteDocument, CustomerDocument } from '@/types';
import { format, parseISO, isValid, getYear } from 'date-fns';
import { collection, getDocs, deleteDoc, doc, query, where, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const getTotalQuantity = (lineItems: QuoteDocument['lineItems']): number => {
  if (!lineItems || lineItems.length === 0) return 0;
  return lineItems.reduce((sum, item) => sum + (item.qty || 0), 0);
};

const getFirstItemName = (lineItems: QuoteDocument['lineItems']): string => {
  if (!lineItems || lineItems.length === 0) return 'N/A';
  const firstItem = lineItems[0];
  let name = firstItem.itemName || 'Unnamed Item';
  if (lineItems.length > 1) {
    name += ` + ${lineItems.length - 1} more`;
  }
  return name;
};

const quoteSortOptions = [
  { value: "quoteDate", label: "Quote Date" },
  { value: "customerName", label: "Customer Name" },
  { value: "salesperson", label: "Salesperson" },
  { value: "totalAmount", label: "Grand Total" },
  { value: "status", label: "Status" },
];

const currentSystemYear = new Date().getFullYear();
const quoteYearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];

const ALL_YEARS_VALUE = "__ALL_YEARS_QUOTE__";
const ALL_CUSTOMERS_VALUE = "__ALL_CUSTOMERS_QUOTE__";
const QUOTE_ITEMS_PER_PAGE = 10;

export default function QuotesListPage() {
  const router = useRouter();
  const [allQuotes, setAllQuotes] = useState<QuoteDocument[]>([]);
  const [displayedQuotes, setDisplayedQuotes] = useState<QuoteDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterQuoteNumber, setFilterQuoteNumber] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterSalesperson, setFilterSalesperson] = useState('');
  const [filterYear, setFilterYear] = useState<string>(ALL_YEARS_VALUE);

  const [customerOptions, setCustomerOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);

  const [sortBy, setSortBy] = useState<string>('quoteDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const quotesQuery = query(collection(firestore, "quotes"), firestoreOrderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(quotesQuery);
        const fetchedQuotes = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
          } as QuoteDocument;
        });
        setAllQuotes(fetchedQuotes);
      } catch (error: any) {
        console.error("Error fetching quotes: ", error);
        let errorMessage = `Could not fetch quote data from Firestore. Please ensure Firestore rules allow reads.`;
        if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes("permission"))) {
          errorMessage = `Could not fetch quote data: Missing or insufficient permissions. Please check Firestore security rules for the 'quotes' collection.`;
        } else if (error.message && error.message.toLowerCase().includes("index")) {
          errorMessage = `Could not fetch quote data: A Firestore index might be required for this query. Please check the browser's developer console for a link to create it automatically.`;
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
        console.error("Error fetching customer options for quote list:", error);
        Swal.fire("Error", `Could not load customer options. Error: ${(error as Error).message}`, "error");
      } finally {
        setIsLoadingCustomers(false);
      }
    };

    fetchInitialData();
    fetchCustomerOptions();
  }, []);

  useEffect(() => {
    let filtered = [...allQuotes];

    if (filterQuoteNumber) { // Assuming ID is used as quote number for filtering
      filtered = filtered.filter(quote => quote.id?.toLowerCase().includes(filterQuoteNumber.toLowerCase()));
    }
    if (filterCustomerId && filterCustomerId !== ALL_CUSTOMERS_VALUE) {
      filtered = filtered.filter(quote => quote.customerId === filterCustomerId);
    }
    if (filterSalesperson) {
      filtered = filtered.filter(quote => quote.salesperson?.toLowerCase().includes(filterSalesperson.toLowerCase()));
    }
    if (filterYear && filterYear !== ALL_YEARS_VALUE) {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(quote => {
        if (quote.quoteDate) {
          try {
            const quoteDateYear = getYear(parseISO(quote.quoteDate));
            return quoteDateYear === yearNum;
          } catch { return false; }
        }
        return false;
      });
    }

    if (sortBy) {
      filtered.sort((a, b) => {
        let valA = (a as any)[sortBy];
        let valB = (b as any)[sortBy];

        if (sortBy === 'quoteDate' && typeof valA === 'string' && typeof valB === 'string') {
          try {
            valA = parseISO(valA);
            valB = parseISO(valB);
            if (!isValid(valA) && isValid(valB)) return sortOrder === 'asc' ? 1 : -1;
            if (isValid(valA) && !isValid(valB)) return sortOrder === 'asc' ? -1 : 1;
            if (!isValid(valA) && !isValid(valB)) return 0;
          } catch { /* ignore */ }
        }

        if (sortBy === 'totalAmount') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setDisplayedQuotes(filtered);
    setCurrentPage(1);
  }, [allQuotes, filterQuoteNumber, filterCustomerId, filterSalesperson, filterYear, sortBy, sortOrder]);

  const handleEditQuote = (quoteId: string) => {
    router.push(`/dashboard/quotations/edit/${quoteId}`);
  };

  const handleDeleteQuote = (quoteId: string, quoteIdentifier?: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will permanently delete Quote "${quoteIdentifier || quoteId}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "quotes", quoteId));
          setAllQuotes(prevQuotes => prevQuotes.filter(q => q.id !== quoteId));
          Swal.fire('Deleted!', `Quote "${quoteIdentifier || quoteId}" has been removed.`, 'success');
        } catch (error: any) {
          Swal.fire("Error", `Could not delete quote: ${error.message}`, "error");
        }
      }
    });
  };

  const handlePreviewPdf = (quoteId: string) => {
    window.open(`/dashboard/quotations/preview/${quoteId}`, '_blank');
  };

  const clearFilters = () => {
    setFilterQuoteNumber('');
    setFilterCustomerId('');
    setFilterSalesperson('');
    setFilterYear(ALL_YEARS_VALUE);
    setSortBy('quoteDate');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(displayedQuotes.length / QUOTE_ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * QUOTE_ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - QUOTE_ITEMS_PER_PAGE;
  const currentItems = displayedQuotes.slice(indexOfFirstItem, indexOfLastItem);

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

  return (
    <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ListChecks className="h-7 w-7 text-primary" />
                Quotations List
              </CardTitle>
              <CardDescription>
                View, search, filter, and manage all sales quotations.
              </CardDescription>
            </div>
            <Link href="/dashboard/quotations/create" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" />
                Create New Quote
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <Label htmlFor="quoteNoFilter" className="text-sm font-medium">Quote Number</Label>
                  <Input id="quoteNoFilter" placeholder="Search by Quote No..." value={filterQuoteNumber} onChange={(e) => setFilterQuoteNumber(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="customerFilterQuote" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground" />Customer</Label>
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
                  <Label htmlFor="salespersonFilter" className="text-sm font-medium">Salesperson</Label>
                  <Input id="salespersonFilter" placeholder="Search by Salesperson..." value={filterSalesperson} onChange={(e) => setFilterSalesperson(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="yearFilterQuote" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground" />Year (Quote Date)</Label>
                  <Select value={filterYear} onValueChange={(value) => setFilterYear(value)}>
                    <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                    <SelectContent>
                      {quoteYearFilterOptions.map(yearOpt => <SelectItem key={yearOpt} value={yearOpt}>{yearOpt === ALL_YEARS_VALUE ? "All Years" : yearOpt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sortByQuote" className="text-sm font-medium flex items-center"><ArrowDownUp className="mr-1 h-4 w-4 text-muted-foreground" />Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {quoteSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sortOrderQuote" className="text-sm font-medium">Order</Label>
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
                  <TableHead className="px-2 sm:px-4">Quote No.</TableHead>
                  <TableHead className="px-2 sm:px-4">Customer</TableHead>
                  <TableHead className="px-2 sm:px-4">Salesperson</TableHead>
                  <TableHead className="px-2 sm:px-4">Quote Date</TableHead>
                  <TableHead className="px-2 sm:px-4">Total Qty</TableHead>
                  <TableHead className="px-2 sm:px-4">Items Summary</TableHead>
                  <TableHead className="px-2 sm:px-4">Grand Total</TableHead>
                  <TableHead className="px-2 sm:px-4">Status</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center p-2 sm:p-4"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary inline" /> Loading Quotes...</TableCell></TableRow>
                ) : fetchError ? (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center text-destructive px-2 sm:px-4 whitespace-pre-wrap">{fetchError}</TableCell></TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium p-2 sm:p-4">
                        {quote.id.startsWith('QT') ? quote.id : `${quote.id.substring(0, 8)}...`}
                      </TableCell>
                      <TableCell className="p-2 sm:p-4">{quote.customerName || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{quote.salesperson || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatDisplayDate(quote.quoteDate)}</TableCell>
                      <TableCell className="p-2 sm:p-4">{getTotalQuantity(quote.lineItems)}</TableCell>
                      <TableCell className="p-2 sm:p-4 truncate max-w-xs" title={getFirstItemName(quote.lineItems)}>{getFirstItemName(quote.lineItems)}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatCurrencyValue(quote.totalAmount)}</TableCell>
                      <TableCell className="p-2 sm:p-4"><Badge variant={quote.status === "Accepted" ? "default" : "outline"}>{quote.status || "N/A"}</Badge></TableCell>
                      <TableCell className="text-right px-2 sm:px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!quote.id}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => quote.id && handleEditQuote(quote.id)}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => quote.id && handlePreviewPdf(quote.id)}>
                              <Printer className="mr-2 h-4 w-4" />
                              <span>Preview</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => quote.id && handleDeleteQuote(quote.id, quote.id)}
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
                  <TableRow><TableCell colSpan={9} className="h-24 text-center p-2 sm:p-4">No quotes found matching your criteria.</TableCell></TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your quotations from Database. Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedQuotes.length)} of {displayedQuotes.length} entries.
              </TableCaption>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4">
              <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (<Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(page)} className="w-9 h-9 p-0">{page}</Button>)
                  : (<span key={`ellipsis-quote-${index}`} className="px-2 py-1 text-sm">{page}</span>)
              )}
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
