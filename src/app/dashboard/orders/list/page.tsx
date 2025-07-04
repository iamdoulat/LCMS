
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, ListChecks, FileEdit, Trash2, Loader2, Filter, XCircle, Building, CalendarDays, DollarSign, ChevronLeft, ChevronRight, FileDown, ShoppingCart } from 'lucide-react'; // Changed Users to Building
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Swal from 'sweetalert2';
import type { OrderDocument, SupplierDocument, OrderStatus } from '@/types'; // Changed CustomerDocument to SupplierDocument
import { orderStatusOptions } from '@/types';
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

const formatCurrencyValue = (amount?: number, currencySymbol: string = 'USD') => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currencySymbol} N/A`;
  return `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getTotalQuantity = (lineItems: OrderDocument['lineItems']): number => {
  if (!lineItems || lineItems.length === 0) return 0;
  return lineItems.reduce((sum, item) => sum + (item.qty || 0), 0);
};

const getFirstItemName = (lineItems: OrderDocument['lineItems']): string => {
  if (!lineItems || lineItems.length === 0) return 'N/A';
  const firstItem = lineItems[0];
  let name = firstItem.itemName || 'Unnamed Item';
  if (lineItems.length > 1) {
    name += ` + ${lineItems.length - 1} more`;
  }
  return name;
};

const orderSortOptions = [
  { value: "orderDate", label: "Order Date" },
  { value: "beneficiaryName", label: "Beneficiary Name" }, // Changed from customerName
  { value: "salesperson", label: "Salesperson" },
  { value: "totalAmount", label: "Grand Total" },
  { value: "status", label: "Status" },
];

const currentSystemYear = new Date().getFullYear();
const orderYearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];

const ALL_YEARS_VALUE = "__ALL_YEARS_ORDER__";
const ALL_BENEFICIARIES_VALUE = "__ALL_BENEFICIARIES_ORDER__"; // Changed from ALL_CUSTOMERS_VALUE
const ALL_STATUSES_VALUE = "__ALL_STATUSES_ORDER__";
const ORDER_ITEMS_PER_PAGE = 10;

export default function OrdersListPage() {
  const router = useRouter();
  const [allOrders, setAllOrders] = useState<OrderDocument[]>([]);
  const [displayedOrders, setDisplayedOrders] = useState<OrderDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterOrderNumber, setFilterOrderNumber] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState(''); // Changed from filterCustomerId
  const [filterSalesperson, setFilterSalesperson] = useState('');
  const [filterYear, setFilterYear] = useState<string>(ALL_YEARS_VALUE);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>('');

  const [beneficiaryOptions, setBeneficiaryOptions] = useState<ComboboxOption[]>([]); // Changed from customerOptions
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = useState(true); // Changed from isLoadingCustomers

  const [sortBy, setSortBy] = useState<string>('orderDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const ordersQuery = query(collection(firestore, "orders"), firestoreOrderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(ordersQuery);
        const fetchedOrders = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
             id: docSnap.id,
             ...data,
          } as OrderDocument;
        });
        setAllOrders(fetchedOrders);
      } catch (error: any) {
        const errorMsg = `Could not fetch order data from Firestore. Ensure Firestore rules allow reads. Error: ${error.message}`;
        setFetchError(errorMsg);
        Swal.fire("Fetch Error", errorMsg, "error");
      } finally {
        setIsLoading(false);
      }
    };

    const fetchBeneficiaryOptions = async () => { // Renamed from fetchCustomerOptions
      setIsLoadingBeneficiaries(true); // Changed from setIsLoadingCustomers
      try {
        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers")); // Fetch from suppliers
        setBeneficiaryOptions( // Changed from setCustomerOptions
          suppliersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' }))
        );
      } catch (error: any) {
        Swal.fire("Error", `Could not load beneficiary options. Error: ${(error as Error).message}`, "error");
      } finally {
        setIsLoadingBeneficiaries(false); // Changed from setIsLoadingCustomers
      }
    };

    fetchInitialData();
    fetchBeneficiaryOptions(); // Renamed
  }, []);

  useEffect(() => {
    let filtered = [...allOrders];

    if (filterOrderNumber) {
      filtered = filtered.filter(order => order.id?.toLowerCase().includes(filterOrderNumber.toLowerCase()));
    }
    if (filterBeneficiaryId && filterBeneficiaryId !== ALL_BENEFICIARIES_VALUE) { // Changed from filterCustomerId
      filtered = filtered.filter(order => order.beneficiaryId === filterBeneficiaryId); // Compare with beneficiaryId
    }
    if (filterSalesperson) {
      filtered = filtered.filter(order => order.salesperson?.toLowerCase().includes(filterSalesperson.toLowerCase()));
    }
    if (filterYear && filterYear !== ALL_YEARS_VALUE) {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(order => {
        if (order.orderDate) {
          try {
            const orderDateYear = getYear(parseISO(order.orderDate));
            return orderDateYear === yearNum;
          } catch { return false; }
        }
        return false;
      });
    }
    if (filterStatus && filterStatus !== ALL_STATUSES_VALUE) {
      filtered = filtered.filter(order => order.status === filterStatus);
    }

    if (sortBy) {
      filtered.sort((a, b) => {
        let valA = (a as any)[sortBy];
        let valB = (b as any)[sortBy];
        if (sortBy === 'orderDate' && typeof valA === 'string' && typeof valB === 'string') {
          try { valA = parseISO(valA); valB = parseISO(valB); } catch { /* ignore */ }
        }
        if (sortBy === 'totalAmount') { valA = Number(valA) || 0; valB = Number(valB) || 0; }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setDisplayedOrders(filtered);
    setCurrentPage(1);
  }, [allOrders, filterOrderNumber, filterBeneficiaryId, filterSalesperson, filterYear, filterStatus, sortBy, sortOrder]); // Updated dependency to filterBeneficiaryId

  const handleEditOrder = (orderId: string) => {
    Swal.fire("Info", `Edit functionality for Order ID ${orderId} is not yet implemented.`, "info");
  };

  const handleDeleteOrder = (orderId: string, orderIdentifier?: string) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `This will permanently delete Order ID "${orderIdentifier || orderId}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "orders", orderId));
          setAllOrders(prevOrders => prevOrders.filter(o => o.id !== orderId));
          Swal.fire('Deleted!', `Order "${orderIdentifier || orderId}" has been removed.`, 'success');
        } catch (error: any) {
          Swal.fire("Error", `Could not delete order: ${error.message}`, "error");
        }
      }
    });
  };

  const handleDownloadPdf = (orderId: string) => {
    window.open(`/dashboard/orders/preview/${orderId}`, '_blank');
  };

  const clearFilters = () => {
    setFilterOrderNumber('');
    setFilterBeneficiaryId(''); // Changed from setFilterCustomerId
    setFilterSalesperson('');
    setFilterYear(ALL_YEARS_VALUE);
    setFilterStatus('');
    setSortBy('orderDate');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(displayedOrders.length / ORDER_ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ORDER_ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ORDER_ITEMS_PER_PAGE;
  const currentItems = displayedOrders.slice(indexOfFirstItem, indexOfLastItem);

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

  const getOrderStatusBadgeVariant = (status?: OrderStatus): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case "Delivered": case "Completed": return "default";
      case "Pending": return "outline";
      case "Processing": case "Shipped": case "On Hold": return "secondary";
      case "Cancelled": return "destructive";
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
                <ShoppingCart className="h-7 w-7 text-primary" />
                Orders List
              </CardTitle>
              <CardDescription>
                View, search, filter, and manage all sales orders.
              </CardDescription>
            </div>
            <Link href="/dashboard/orders/create" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" />
                Create New Order
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
                  <Label htmlFor="orderNoFilter" className="text-sm font-medium">Order No.</Label>
                  <Input id="orderNoFilter" placeholder="Search by Order No..." value={filterOrderNumber} onChange={(e) => setFilterOrderNumber(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="beneficiaryFilterOrder" className="text-sm font-medium flex items-center"><Building className="mr-1 h-4 w-4 text-muted-foreground"/>Beneficiary</Label> {/* Changed from Customer */}
                  <Combobox
                    options={beneficiaryOptions} // Changed from customerOptions
                    value={filterBeneficiaryId || ALL_BENEFICIARIES_VALUE} // Changed
                    onValueChange={(value) => setFilterBeneficiaryId(value === ALL_BENEFICIARIES_VALUE ? '' : value)} // Changed
                    placeholder="Search Beneficiary..." // Changed
                    selectPlaceholder={isLoadingBeneficiaries ? "Loading..." : "All Beneficiaries"} // Changed
                    emptyStateMessage="No beneficiary found." // Changed
                    disabled={isLoadingBeneficiaries} // Changed
                  />
                </div>
                <div>
                  <Label htmlFor="salespersonFilterOrder" className="text-sm font-medium">Salesperson</Label>
                  <Input id="salespersonFilterOrder" placeholder="Search by Salesperson..." value={filterSalesperson} onChange={(e) => setFilterSalesperson(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="yearFilterOrder" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground"/>Year (Order Date)</Label>
                  <Select value={filterYear} onValueChange={(value) => setFilterYear(value)}>
                    <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                    <SelectContent>
                      {orderYearFilterOptions.map(yearOpt => <SelectItem key={yearOpt} value={yearOpt}>{yearOpt === ALL_YEARS_VALUE ? "All Years" : yearOpt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="statusFilterOrder" className="text-sm font-medium">Status</Label>
                  <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value === ALL_STATUSES_VALUE ? '' : value as OrderStatus)}>
                    <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>
                      {orderStatusOptions.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                    <Label htmlFor="sortByOrder" className="text-sm font-medium">Sort By</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {orderSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div>
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
                  <TableHead className="px-2 sm:px-4">Order No.</TableHead>
                  <TableHead className="px-2 sm:px-4">Beneficiary</TableHead> {/* Changed from Customer */}
                  <TableHead className="px-2 sm:px-4">Salesperson</TableHead>
                  <TableHead className="px-2 sm:px-4">Order Date</TableHead>
                  <TableHead className="px-2 sm:px-4">Items Summary</TableHead>
                  <TableHead className="px-2 sm:px-4">Grand Total</TableHead>
                  <TableHead className="px-2 sm:px-4">Status</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {isLoading ? (
                   <TableRow><TableCell colSpan={8} className="h-24 text-center p-2 sm:p-4"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary inline" /> Loading Orders...</TableCell></TableRow>
                ) : fetchError ? (
                     <TableRow><TableCell colSpan={8} className="h-24 text-center text-destructive px-2 sm:px-4 whitespace-pre-wrap">{fetchError}</TableCell></TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium p-2 sm:p-4">{order.id}</TableCell>
                      <TableCell className="p-2 sm:p-4">{order.beneficiaryName || 'N/A'}</TableCell> {/* Changed from customerName */}
                      <TableCell className="p-2 sm:p-4">{order.salesperson || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatDisplayDate(order.orderDate)}</TableCell>
                      <TableCell className="p-2 sm:p-4 truncate max-w-xs" title={getFirstItemName(order.lineItems)}>{getFirstItemName(order.lineItems)} ({getTotalQuantity(order.lineItems)} qty)</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatCurrencyValue(order.totalAmount)}</TableCell>
                      <TableCell className="p-2 sm:p-4"><Badge variant={getOrderStatusBadgeVariant(order.status)}>{order.status || "N/A"}</Badge></TableCell>
                      <TableCell className="text-right space-x-1 p-2 sm:p-4">
                        <TooltipProvider>
                          <Tooltip><TooltipTrigger asChild><Button variant="default" size="icon" onClick={() => handleEditOrder(order.id)} className="bg-accent text-accent-foreground hover:bg-accent/90 h-7 w-7"><FileEdit className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Edit Order</p></TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="destructive" size="icon" onClick={() => handleDeleteOrder(order.id, order.id)} className="h-7 w-7"><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Delete Order</p></TooltipContent></Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleDownloadPdf(order.id)}
                                className="h-7 w-7 border-primary text-primary hover:bg-primary/10"
                              >
                                <FileDown className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Download Order PDF</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center p-2 sm:p-4">No orders found matching your criteria.</TableCell></TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your sales orders from Firestore.
                Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedOrders.length)} of {displayedOrders.length} entries.
              </TableCaption>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4">
              <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (<Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(page)} className="w-9 h-9 p-0">{page}</Button>)
                : (<span key={`ellipsis-order-${index}`} className="px-2 py-1 text-sm">{page}</span>)
              )}
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
    

    