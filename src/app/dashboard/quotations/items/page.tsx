
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { PlusCircle, FileEdit, Trash2, Loader2, ChevronLeft, ChevronRight, Info, Package as PackageIcon, Tag, Filter, XCircle, Search, MapPin, Building, MoreHorizontal, Globe } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Swal from 'sweetalert2';
import type { ItemDocument } from '@/types';
import { collection, getDocs, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

const ITEMS_PER_PAGE = 10;

const formatCurrency = (value?: number, currencySymbol: string = '$') => {
  if (typeof value !== 'number' || isNaN(value)) return `${currencySymbol} N/A`;
  return `${currencySymbol} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function QuoteItemsListPage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  const [allItems, setAllItems] = useState<ItemDocument[]>([]);
  const [displayedItems, setDisplayedItems] = useState<ItemDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter states
  const [filterItemName, setFilterItemName] = useState('');
  const [filterItemCode, setFilterItemCode] = useState('');
  const [filterBrandName, setFilterBrandName] = useState('');
  const [filterSupplierName, setFilterSupplierName] = useState('');

  useEffect(() => {
    const fetchItems = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const itemsCollectionRef = collection(firestore, "quote_items");
        const q = query(itemsCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedItems = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return { id: docSnap.id, ...data, imageUrl: data.photoURL || data.imageUrl } as ItemDocument;
        });
        setAllItems(fetchedItems);
      } catch (error: any) {
        console.error("Error fetching quote items: ", error);
        let errorMessage = `Could not fetch quote items from Firestore. Please check console for details and ensure Firestore rules allow reads.`;
        if (error.message?.toLowerCase().includes("index")) {
          errorMessage = `Could not fetch data: A Firestore index might be required for 'quote_items' collection ordered by 'createdAt'. Please check the browser console for a link to create it.`;
        } else if (error.code === 'permission-denied' || error.message?.toLowerCase().includes("permission")) {
          errorMessage = `Could not fetch data: Missing or insufficient permissions for 'quote_items'. Please check Firestore security rules.`;
        }
        else if (error.message) {
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
    if (filterSupplierName) {
      filtered = filtered.filter(item =>
        item.supplierName?.toLowerCase().includes(filterSupplierName.toLowerCase())
      );
    }

    setDisplayedItems(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allItems, filterItemName, filterItemCode, filterBrandName, filterSupplierName]);


  const handleEditItem = (itemId: string) => {
    router.push(`/dashboard/quotations/items/${itemId}/edit`);
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
          await deleteDoc(doc(firestore, "quote_items", itemId));
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
    setFilterSupplierName('');
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
    <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <PackageIcon className="h-7 w-7 text-primary" />
                Manage Products Items
              </CardTitle>
              <CardDescription>
                Browse, filter, and manage all your quote items.
              </CardDescription>
            </div>
            <Link href="/dashboard/quotations/items/add" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isReadOnly}>
                <PlusCircle className="mr-2 h-5 w-5" />
                Add New Quote Item
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
                <div>
                  <Label htmlFor="itemNameFilter" className="text-sm font-medium">Model Number</Label>
                  <Input
                    id="itemNameFilter"
                    placeholder="Search by Model Number..."
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
                <div>
                  <Label htmlFor="supplierNameFilter" className="text-sm font-medium">Supplier Name</Label>
                  <Input
                    id="supplierNameFilter"
                    placeholder="Search by Supplier..."
                    value={filterSupplierName}
                    onChange={(e) => setFilterSupplierName(e.target.value)}
                  />
                </div>
                <div className="lg:col-span-1 md:col-span-2 self-end xl:col-start-5">
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
                  <TableHead className="w-[80px] px-2 sm:px-4">Image</TableHead>
                  <TableHead className="w-[200px] px-2 sm:px-4">Model Number</TableHead>
                  <TableHead className="px-2 sm:px-4">Brand Name</TableHead>
                  <TableHead className="px-2 sm:px-4">Country</TableHead>
                  <TableHead className="px-2 sm:px-4">Supplier Name</TableHead>
                  <TableHead className="px-2 sm:px-4">Unit</TableHead>
                  <TableHead className="px-2 sm:px-4">Sales Price</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center px-2 sm:px-4"><div className="flex justify-center items-center"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading items...</div></TableCell></TableRow>
                ) : fetchError ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center text-destructive px-2 sm:px-4 whitespace-pre-wrap">{fetchError}</TableCell></TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="px-2 sm:px-4">
                        {item.imageUrl ? (
                          <div className="relative w-10 h-10 overflow-hidden rounded-md border">
                            <Image
                              src={item.imageUrl}
                              alt={item.itemName || 'Item'}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-muted/50 rounded-md flex items-center justify-center border">
                            <PackageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium px-2 sm:px-4">{item.itemName || 'N/A'}</TableCell>
                      <TableCell className="px-2 sm:px-4">{item.brandName || 'N/A'}</TableCell>
                      <TableCell className="px-2 sm:px-4">{item.countryOfOrigin || 'N/A'}</TableCell>
                      <TableCell className="px-2 sm:px-4">{item.supplierName || 'N/A'}</TableCell>
                      <TableCell className="px-2 sm:px-4">{item.unit || 'N/A'}</TableCell>
                      <TableCell className="px-2 sm:px-4">{formatCurrency(item.salesPrice)}</TableCell>
                      <TableCell className="text-right px-2 sm:px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!item.id || isReadOnly}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => item.id && handleEditItem(item.id)}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>{isReadOnly ? 'View' : 'Edit'}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => item.id && handleDeleteItem(item.id, item.itemName)}
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
                  <TableRow><TableCell colSpan={8} className="h-64 text-center px-2 sm:px-4"><div className="flex flex-col items-center justify-center"><Info className="h-12 w-12 text-muted-foreground mb-4" /><p className="text-xl font-semibold text-muted-foreground">No Quote Items Found</p><p className="text-sm text-muted-foreground mt-1">{allItems.length > 0 ? "No items match your current filters." : "Click \"Add New Quote Item\" to get started."}</p></div></TableCell></TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your Products items from Database. Showing {displayedItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedItems.length)} of {displayedItems.length} entries.
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
