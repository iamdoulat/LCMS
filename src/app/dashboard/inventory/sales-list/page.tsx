
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, ListChecks, FileEdit, Trash2, Loader2, Filter, XCircle, Users, CalendarDays, DollarSign, ChevronLeft, ChevronRight, FileDown, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Swal from 'sweetalert2';
import type { SaleDocument, CustomerDocument, SaleStatus } from '@/types';
import { format, parseISO, isValid, getYear } from 'date-fns';
import { collection, getDocs, deleteDoc, doc, query, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';

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

const saleSortOptions = [
  { value: "saleDate", label: "Sale Date" },
  { value: "customerName", label: "Customer Name" },
  { value: "salesperson", label: "Salesperson" },
  { value: "totalAmount", label: "Grand Total" },
  { value: "status", label: "Status" },
];

const saleStatusOptions: SaleStatus[] = ["Draft", "Completed", "Cancelled", "Refunded"];

const currentSystemYear = new Date().getFullYear();
const saleYearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];

const ALL_YEARS_VALUE = "__ALL_YEARS_SALE__";
const ALL_CUSTOMERS_VALUE = "__ALL_CUSTOMERS_SALE__";
const ALL_STATUSES_VALUE = "__ALL_STATUSES_SALE__";
const SALE_ITEMS_PER_PAGE = 10;

export default function SalesListPage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const isReadOnly = userRole === 'Viewer';
  const [allSales, setAllSales] = useState<SaleDocument[]>([]);
  const [displayedSales, setDisplayedSales] = useState<SaleDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterSaleId, setFilterSaleId] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterSalesperson, setFilterSalesperson] = useState('');
  const [filterYear, setFilterYear] = useState<string>(ALL_YEARS_VALUE);
  const [filterStatus, setFilterStatus] = useState<SaleStatus | ''>('');

  const [customerOptions, setCustomerOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);

  const [sortBy, setSortBy] = useState<string>('saleDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const salesQuery = query(collection(firestore, "sales"), firestoreOrderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(salesQuery);
        const fetchedSales = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
             id: docSnap.id,
             ...data,
          } as SaleDocument;
        });
        setAllSales(fetchedSales);
      } catch (error: any) {
        const errorMsg = `Could not fetch sales data. Error: ${error.message}`;
        setFetchError(errorMsg);
        Swal.fire("Fetch Error", errorMsg, "error");
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
    let filtered = [...allSales];

    if (filterSaleId) {
      filtered = filtered.filter(sale => sale.id?.toLowerCase().includes(filterSaleId.toLowerCase()));
    }
    if (filterCustomerId) {
      filtered = filtered.filter(sale => sale.customerId === filterCustomerId);
    }
    if (filterSalesperson) {
      filtered = filtered.filter(sale => sale.salesperson?.toLowerCase().includes(filterSalesperson.toLowerCase()));
    }
    if (filterYear && filterYear !== ALL_YEARS_VALUE) {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(sale => {
        if (sale.saleDate) {
          try {
            const saleDateYear = getYear(parseISO(sale.saleDate));
            return saleDateYear === yearNum;
          } catch { return false; }
        }
        return false;
      });
    }
    if (filterStatus) {
      filtered = filtered.filter(sale => sale.status === filterStatus);
    }

    if (sortBy) {
      filtered.sort((a, b) => {
        let valA = (a as any)[sortBy];
        let valB = (b as any)[sortBy];
        if (sortBy === 'saleDate' && typeof valA === 'string' && typeof valB === 'string') {
          try { valA = parseISO(valA); valB = parseISO(valB); } catch { /* ignore */ }
        }
        if (sortBy === 'totalAmount') { valA = Number(valA) || 0; valB = Number(valB) || 0; }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setDisplayedSales(filtered);
    setCurrentPage(1);
  }, [allSales, filterSaleId, filterCustomerId, filterSalesperson, filterYear, filterStatus, sortBy, sortOrder]);

  const handleEditSale = (saleId: string) => {
    router.push(`/dashboard/inventory/sales/edit/${saleId}`);
  };

  const handleDeleteSale = (saleId: string, saleIdentifier?: string) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `This will permanently delete Sale ID "${saleIdentifier || saleId}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "sales", saleId));
          setAllSales(prevSales => prevSales.filter(s => s.id !== saleId));
          Swal.fire('Deleted!', `Sale "${saleIdentifier || saleId}" has been removed.`, 'success');
        } catch (error: any) {
          Swal.fire("Error", `Could not delete sale: ${error.message}`, "error");
        }
      }
    });
  };

  const handleDownloadPdf = (saleId: string, saleIdentifier?: string) => {
    // Open the print page in a new tab
    window.open(`/dashboard/inventory/sales/print/${saleId}`, '_blank');
  };


  const clearFilters = () => {
    setFilterSaleId('');
    setFilterCustomerId('');
    setFilterSalesperson('');
    setFilterYear(ALL_YEARS_VALUE);
    setFilterStatus('');
    setSortBy('saleDate');
    setSortOrder('desc');
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ListChecks className="h-7 w-7 text-primary" />
                Sales List
              </CardTitle>
              <CardDescription>
                View, search, filter, and manage all recorded sales.
              </CardDescription>
            </div>
            <Link href="/dashboard/inventory/sales" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isReadOnly}>
                <PlusCircle className="mr-2 h-5 w-5" />
                Record New Sale
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
                  <Label htmlFor="saleIdFilter" className="text-sm font-medium">Sale ID</Label>
                  <Input id="saleIdFilter" placeholder="Search by Sale ID..." value={filterSaleId} onChange={(e) => setFilterSaleId(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="customerFilterSale" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground"/>Customer</Label>
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
                  <Label htmlFor="yearFilterSale" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground"/>Year (Sale Date)</Label>
                  <Select value={filterYear} onValueChange={(value) => setFilterYear(value)}>
                    <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                    <SelectContent>
                      {saleYearFilterOptions.map(yearOpt => <SelectItem key={yearOpt} value={yearOpt}>{yearOpt === ALL_YEARS_VALUE ? "All Years" : yearOpt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="statusFilterSale" className="text-sm font-medium">Status</Label>
                  <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value === ALL_STATUSES_VALUE ? '' : value as SaleStatus)}>
                    <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>
                      {saleStatusOptions.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                    <Label htmlFor="sortBySale" className="text-sm font-medium">Sort By</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {saleSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
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
                  <TableHead className="px-2 sm:px-4">Sale ID</TableHead>
                  <TableHead className="px-2 sm:px-4">Customer</TableHead>
                  <TableHead className="px-2 sm:px-4">Salesperson</TableHead>
                  <TableHead className="px-2 sm:px-4">Sale Date</TableHead>
                  <TableHead className="px-2 sm:px-4">Total Qty</TableHead>
                  <TableHead className="px-2 sm:px-4">Items Summary</TableHead>
                  <TableHead className="px-2 sm:px-4">Grand Total</TableHead>
                  <TableHead className="px-2 sm:px-4">Status</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {isLoading ? (
                   <TableRow><TableCell colSpan={9} className="h-24 text-center p-2 sm:p-4"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary inline" /> Loading Sales...</TableCell></TableRow>
                ) : fetchError ? (
                     <TableRow><TableCell colSpan={9} className="h-24 text-center text-destructive px-2 sm:px-4 whitespace-pre-wrap">{fetchError}</TableCell></TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium p-2 sm:p-4">{sale.id.substring(0,8)}...</TableCell>
                      <TableCell className="p-2 sm:p-4">{sale.customerName || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{sale.salesperson || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatDisplayDate(sale.saleDate)}</TableCell>
                      <TableCell className="p-2 sm:p-4">{getTotalQuantity(sale.lineItems)}</TableCell>
                      <TableCell className="p-2 sm:p-4 truncate max-w-xs" title={getFirstItemName(sale.lineItems)}>{getFirstItemName(sale.lineItems)}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatCurrencyValue(sale.totalAmount)}</TableCell>
                      <TableCell className="p-2 sm:p-4"><Badge variant={getSaleStatusBadgeVariant(sale.status)}>{sale.status || "N/A"}</Badge></TableCell>
                      <TableCell className="text-right p-2 sm:p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!sale.id || isReadOnly}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => sale.id && handleEditSale(sale.id)} disabled={isReadOnly}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>{isReadOnly ? 'View' : 'Edit'}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => sale.id && handleDownloadPdf(sale.id, sale.id.substring(0,8))}>
                              <FileDown className="mr-2 h-4 w-4" />
                              <span>Download Invoice</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => sale.id && handleDeleteSale(sale.id, sale.id.substring(0,8))}
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                              disabled={isReadOnly}
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
                  <TableRow><TableCell colSpan={9} className="h-24 text-center p-2 sm:p-4">No sales found matching your criteria.</TableCell></TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your sales. Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedSales.length)} of {displayedSales.length} entries.
              </TableCaption>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4">
              <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (<Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(page)} className="w-9 h-9 p-0">{page}</Button>)
                : (<span key={`ellipsis-sale-${index}`} className="px-2 py-1 text-sm">{page}</span>)
              )}
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
    
