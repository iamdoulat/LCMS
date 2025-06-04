
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { PlusCircle, FileEdit, Trash2, Loader2, ChevronLeft, ChevronRight, Info, Package as PackageIcon, Tag, Filter, XCircle, Search, MapPin, Building } from 'lucide-react'; // Added Building icon
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Swal from 'sweetalert2';
import type { ItemDocument } from '@/types';
import { collection, getDocs, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

const ITEMS_PER_PAGE = 10;

const formatCurrency = (value?: number, currencySymbol: string = '$') => {
  if (typeof value !== 'number' || isNaN(value)) return `${currencySymbol} N/A`;
  return `${currencySymbol} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function ItemsListPage() {
  const router = useRouter();
  const [allItems, setAllItems] = useState<ItemDocument[]>([]);
  const [displayedItems, setDisplayedItems] = useState<ItemDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter states
  const [filterItemName, setFilterItemName] = useState('');
  const [filterItemCode, setFilterItemCode] = useState('');
  const [filterBrandName, setFilterBrandName] = useState('');
  const [filterSupplierName, setFilterSupplierName] = useState(''); // New filter state

  useEffect(() => {
    const fetchItems = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const itemsCollectionRef = collection(firestore, "items");
        const q = query(itemsCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedItems = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ItemDocument));
        setAllItems(fetchedItems);
      } catch (error: any) {
        console.error("Error fetching items: ", error);
        let errorMessage = `Could not fetch items from Firestore. Please check console for details and ensure Firestore rules allow reads.`;
        if (error.message?.toLowerCase().includes("index")) {
            errorMessage = `Could not fetch data: A Firestore index might be required for 'items' collection ordered by 'createdAt'. Please check the browser console for a link to create it.`;
        } else if (error.code === 'permission-denied' || error.message?.toLowerCase().includes("permission")) {
           errorMessage = `Could not fetch data: Missing or insufficient permissions for 'items'. Please check Firestore security rules.`;
        } else if (error.message) {
            errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire("Fetch Error", errorMessage, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, []);

  useEffect(() => {
    let filtered = [...allItems];

    if (filterItemName) {
      filtered = filtered.filter(item =>
        item.itemName?.toLowerCase().includes(filterItemName.toLowerCase())
      );
    }
    if (filterItemCode) {
      filtered = filtered.filter(item =>
        item.itemCode?.toLowerCase().includes(filterItemCode.toLowerCase())
      );
    }
    if (filterBrandName) {
      filtered = filtered.filter(item =>
        item.brandName?.toLowerCase().includes(filterBrandName.toLowerCase())
      );
    }
    if (filterSupplierName) { // Filter by supplier name
      filtered = filtered.filter(item =>
        item.supplierName?.toLowerCase().includes(filterSupplierName.toLowerCase())
      );
    }

    setDisplayedItems(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allItems, filterItemName, filterItemCode, filterBrandName, filterSupplierName]);


  const handleEditItem = (itemId: string) => {
    router.push(`/dashboard/items/${itemId}/edit`);
  };

  const handleDeleteItem = (itemId: string, itemName?: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will permanently delete the item "${itemName || itemId}" from Firestore.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "items", itemId));
          setAllItems(prevItems => prevItems.filter(item => item.id !== itemId));
          Swal.fire(
            'Deleted!',
            `Item "${itemName || itemId}" has been removed.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting item: ", error);
          Swal.fire("Error", `Could not delete item: ${error.message}`, "error");
        }
      }
    });
  };

  const clearFilters = () => {
    setFilterItemName('');
    setFilterItemCode('');
    setFilterBrandName('');
    setFilterSupplierName(''); // Clear supplier filter
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(displayedItems.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = displayedItems.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
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

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <PackageIcon className="h-7 w-7 text-primary" />
                Manage Inventory Items
              </CardTitle>
              <CardDescription>
                Browse, filter, and manage all your inventory items.
              </CardDescription>
            </div>
            <Link href="/dashboard/items/add" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add New Item
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4">
              <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end"> {/* Adjusted for 5 columns */}
                <div>
                  <Label htmlFor="itemNameFilter" className="text-sm font-medium">Item Name</Label>
                  <Input
                    id="itemNameFilter"
                    placeholder="Search by Item Name..."
                    value={filterItemName}
                    onChange={(e) => setFilterItemName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="itemCodeFilter" className="text-sm font-medium">Item Code/SKU</Label>
                  <Input
                    id="itemCodeFilter"
                    placeholder="Search by Item Code..."
                    value={filterItemCode}
                    onChange={(e) => setFilterItemCode(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="brandNameFilter" className="text-sm font-medium">Brand Name</Label>
                  <Input
                    id="brandNameFilter"
                    placeholder="Search by Brand Name..."
                    value={filterBrandName}
                    onChange={(e) => setFilterBrandName(e.target.value)}
                  />
                </div>
                <div> {/* New Supplier Filter */}
                  <Label htmlFor="supplierNameFilter" className="text-sm font-medium">Supplier Name</Label>
                  <Input
                    id="supplierNameFilter"
                    placeholder="Search by Supplier..."
                    value={filterSupplierName}
                    onChange={(e) => setFilterSupplierName(e.target.value)}
                  />
                </div>
                <div className="lg:col-span-1 md:col-span-2 self-end xl:col-start-5"> {/* Ensure button aligns well */}
                  <Button onClick={clearFilters} variant="outline" className="w-full">
                    <XCircle className="mr-2 h-4 w-4" /> Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] px-2 sm:px-4">Item Name</TableHead>
                  <TableHead className="px-2 sm:px-4">Item Code</TableHead>
                  <TableHead className="px-2 sm:px-4">Brand Name</TableHead>
                  <TableHead className="px-2 sm:px-4">Supplier Name</TableHead> {/* New Header */}
                  <TableHead className="px-2 sm:px-4">Unit</TableHead>
                  <TableHead className="px-2 sm:px-4">Sales Price</TableHead>
                  <TableHead className="px-2 sm:px-4">Purchase Price</TableHead>
                  <TableHead className="px-2 sm:px-4">Stock Status</TableHead>
                  <TableHead className="px-2 sm:px-4">Location</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center px-2 sm:px-4"> {/* Increased colSpan */}
                      <div className="flex justify-center items-center">
                        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading items...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : fetchError ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-destructive px-2 sm:px-4 whitespace-pre-wrap"> {/* Increased colSpan */}
                        {fetchError}
                    </TableCell>
                  </TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium px-2 sm:px-4">{item.itemName || 'N/A'}</TableCell>
                      <TableCell className="px-2 sm:px-4">{item.itemCode || 'N/A'}</TableCell>
                      <TableCell className="px-2 sm:px-4">{item.brandName || 'N/A'}</TableCell>
                      <TableCell className="px-2 sm:px-4">{item.supplierName || 'N/A'}</TableCell> {/* Display Supplier Name */}
                      <TableCell className="px-2 sm:px-4">{item.unit || 'N/A'}</TableCell>
                      <TableCell className="px-2 sm:px-4">{formatCurrency(item.salesPrice)}</TableCell>
                      <TableCell className="px-2 sm:px-4">{formatCurrency(item.purchasePrice)}</TableCell>
                      <TableCell className="px-2 sm:px-4">
                        {item.manageStock ? (
                          <Badge variant="default" className="bg-green-500/80 hover:bg-green-600">
                            Managed: {item.currentQuantity ?? 0}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Not Managed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        {item.location ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {item.location}
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1 px-2 sm:px-4">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="default"
                                size="icon"
                                onClick={() => item.id && handleEditItem(item.id)}
                                className="bg-accent text-accent-foreground hover:bg-accent/90 h-7 w-7"
                                disabled={!item.id}
                              >
                                <FileEdit className="h-4 w-4" />
                                <span className="sr-only">Edit Item</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit Item</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                           <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => item.id && handleDeleteItem(item.id, item.itemName)}
                                  className="h-7 w-7"
                                  disabled={!item.id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete Item</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete Item</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-64 text-center px-2 sm:px-4"> {/* Increased colSpan */}
                        <div className="flex flex-col items-center justify-center">
                            <Info className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-xl font-semibold text-muted-foreground">No Items Found</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {allItems.length > 0 ? "No items match your current filters." : "Click \"Add New Item\" to get started."}
                            </p>
                        </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your items from Firestore.
                Showing {displayedItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedItems.length)} of {displayedItems.length} entries.
              </TableCaption>
            </Table>
          </div>
           {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (
                  <Button
                    key={`item-page-${page}`}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-9 h-9 p-0"
                  >
                    {page}
                  </Button>
                ) : (
                  <span key={`ellipsis-item-${index}`} className="px-2 py-1 text-sm">
                    {page}
                  </span>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
