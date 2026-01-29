
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { PlusCircle, FileEdit, Trash2, Loader2, ChevronLeft, ChevronRight, Info, Package as PackageIcon, Filter, XCircle, MapPin, MoreHorizontal, ImageIcon, Download, Upload } from 'lucide-react';
import Link from 'next/link';
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
import { writeBatch, serverTimestamp, setDoc } from 'firebase/firestore';
import { format } from 'date-fns';

const escapeCsvCell = (value: any) => {
  if (value === null || value === undefined) return '""';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const ITEMS_PER_PAGE = 10;

const formatCurrency = (value?: number) => {
  if (typeof value !== 'number' || isNaN(value)) return `BDT N/A`;
  return `BDT ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function ItemsListPage() {
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
    router.push(`/dashboard/inventory/items/${itemId}/edit`);
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

  const handleExportCSV = () => {
    if (!displayedItems || displayedItems.length === 0) {
      Swal.fire("No Data", "There are no items to export.", "info");
      return;
    }

    const headers = [
      "Item Name", "Item Code", "Model Number", "Category", "Section",
      "Item Type", "Variation", "Variation Option", "Brand Name",
      "Origin", "Currency", "Unit", "Sales Price", "Purchase Price",
      "Manage Stock", "Current Qty", "Ideal Qty", "Warning Qty",
      "Location", "Supplier", "Warehouse", "Description"
    ];

    const csvRows = displayedItems.map(item => [
      escapeCsvCell(item.itemName),
      escapeCsvCell(item.itemCode),
      escapeCsvCell(item.modelNumber),
      escapeCsvCell(item.category),
      escapeCsvCell(item.itemSection),
      escapeCsvCell(item.itemType),
      escapeCsvCell(item.itemVariation),
      escapeCsvCell(item.variationOption),
      escapeCsvCell(item.brandName),
      escapeCsvCell(item.countryOfOrigin),
      escapeCsvCell(item.currency),
      escapeCsvCell(item.unit),
      item.salesPrice ?? "",
      item.purchasePrice ?? "",
      item.manageStock ? "Yes" : "No",
      item.currentQuantity ?? "",
      item.idealQuantity ?? "",
      item.warningQuantity ?? "",
      escapeCsvCell(item.location),
      escapeCsvCell(item.supplierName),
      escapeCsvCell(item.warehouseName),
      escapeCsvCell(item.description)
    ]);

    const csvContent = [headers.join(","), ...csvRows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSample = () => {
    const headers = [
      "Item Name", "Item Code", "Model Number", "Category", "Section",
      "Item Type", "Variation", "Variation Option", "Brand Name",
      "Origin", "Currency", "Unit", "Sales Price", "Purchase Price",
      "Manage Stock", "Current Qty", "Ideal Qty", "Warning Qty",
      "Location", "Supplier", "Warehouse", "Description"
    ];
    const sampleData = [
      "Example Item", "SKU123", "MOD-001", "Tools", "Hand Tools",
      "Single", "", "", "Example Brand",
      "Bangladesh", "BDT", "pcs", "1500", "1200",
      "Yes", "50", "100", "10",
      "Shelf A1", "Reliable Supplier", "Main Warehouse", "This is an example item description."
    ];

    const csvContent = headers.join(",") + "\n" + sampleData.map(escapeCsvCell).join(",");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "inventory_sample_file.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvData = event.target?.result as string;
      const rows = csvData.split(/\r?\n/).filter(row => row.trim() !== "");
      if (rows.length < 2) {
        Swal.fire("Invalid File", "The CSV file appears to be empty or missing data rows.", "error");
        return;
      }

      const parseCSVLine = (line: string) => {
        const result = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuote && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuote = !inQuote;
            }
          } else if (char === ',' && !inQuote) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const columns = rows.slice(1).map(row => parseCSVLine(row));

      Swal.fire({
        title: 'Importing...',
        text: `Found ${columns.length} items to import. Proceed?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, import'
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            Swal.fire({ title: 'Processing...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            const [suppliersSnap, warehousesSnap, categoriesSnap, sectionsSnap, variationsSnap] = await Promise.all([
              getDocs(collection(firestore, "suppliers")),
              getDocs(collection(firestore, "warehouses")),
              getDocs(collection(firestore, "item_categories")),
              getDocs(collection(firestore, "item_sections")),
              getDocs(collection(firestore, "item_variations"))
            ]);

            const supplierMap = new Map(suppliersSnap.docs.map(d => [d.data().beneficiaryName?.toLowerCase(), d.id]));
            const warehouseMap = new Map(warehousesSnap.docs.map(d => [d.data().name?.toLowerCase(), d.id]));
            const categoryMap = new Map(categoriesSnap.docs.map(d => [d.data().name?.toLowerCase(), d.id]));
            const sectionMap = new Map(sectionsSnap.docs.map(d => [d.data().name?.toLowerCase(), d.id]));
            const variationMap = new Map(variationsSnap.docs.map(d => [d.data().name?.toLowerCase(), d.id]));

            const batch = writeBatch(firestore);
            let importedCount = 0;

            for (const item of columns) {
              if (item.length < 1 || !item[0]) continue;

              const newItemRef = doc(collection(firestore, "items"));
              const itemName = item[0];
              const itemCode = item[1] || "";
              const modelNumber = item[2] || "";
              const catName = item[3]?.toLowerCase();
              const secName = item[4]?.toLowerCase();
              const itemType = (item[5] === "Variant" ? "Variant" : "Single") as "Single" | "Variant";
              const varName = item[6]?.toLowerCase();
              const varOption = item[7] || "";
              const brandName = item[8] || "";
              const origin = item[9] || "";
              const currency = item[10] || "BDT";
              const unit = item[11] || "";
              const salesPrice = parseFloat(item[12]) || 0;
              const purchasePrice = parseFloat(item[13]) || 0;
              const manageStock = item[14]?.toLowerCase() === "yes";
              const currentQty = parseInt(item[15]) || 0;
              const idealQty = parseInt(item[16]) || 0;
              const warningQty = parseInt(item[17]) || 0;
              const location = item[18] || "";
              const supName = item[19]?.toLowerCase();
              const whName = item[20]?.toLowerCase();
              const description = item[21] || "";

              const itemData: any = {
                itemName,
                itemCode,
                modelNumber,
                category: categoryMap.get(catName) || (item[3] || ""),
                itemSection: sectionMap.get(secName) || (item[4] || ""),
                itemType,
                itemVariation: variationMap.get(varName) || (item[6] || ""),
                variationOption: varOption,
                brandName,
                countryOfOrigin: origin,
                currency,
                unit,
                salesPrice,
                purchasePrice,
                manageStock,
                currentQuantity: manageStock ? currentQty : 0,
                idealQuantity: idealQty || undefined,
                warningQuantity: warningQty || undefined,
                location,
                supplierId: supplierMap.get(supName) || "",
                supplierName: item[19] || "",
                warehouseId: warehouseMap.get(whName) || "",
                warehouseName: item[20] || "",
                description,
                photoURL: null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              };

              // Cleanup undefined
              Object.keys(itemData).forEach(key => itemData[key] === undefined && delete itemData[key]);

              batch.set(newItemRef, itemData);
              importedCount++;
            }

            await batch.commit();

            const itemsCollectionRef = collection(firestore, "items");
            const q = query(itemsCollectionRef, orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            setAllItems(querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ItemDocument)));

            Swal.fire("Success", `${importedCount} items imported successfully.`, "success");
            e.target.value = '';
          } catch (error: any) {
            console.error("Import error:", error);
            Swal.fire("Error", `Failed to import: ${error.message}`, "error");
          }
        }
      });
    };
    reader.readAsText(file);
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
                Manage Inventory Items
              </CardTitle>
              <CardDescription>
                Browse, filter, and manage all your inventory items.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard/inventory/items/add" passHref>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isReadOnly}>
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Add New Item
                </Button>
              </Link>
              <Button variant="outline" onClick={handleExportCSV} disabled={isLoading}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  className="hidden"
                  id="inventory-csv-import"
                  disabled={isReadOnly || isLoading}
                />
                <Label
                  htmlFor="inventory-csv-import"
                  className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 cursor-pointer",
                    (isReadOnly || isLoading) && "opacity-50 pointer-events-none"
                  )}
                >
                  <Upload className="mr-2 h-4 w-4" /> Import CSV
                </Label>
              </div>
              <Button variant="ghost" onClick={handleDownloadSample} className="text-muted-foreground">
                <Info className="mr-2 h-4 w-4" /> Sample
              </Button>
            </div>
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
                  <TableHead className="w-[80px] px-2 sm:px-4">Image</TableHead>
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
                  <TableRow><TableCell colSpan={10} className="h-24 text-center px-2 sm:px-4"><div className="flex justify-center items-center"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading items...</div></TableCell></TableRow>
                ) : fetchError ? (
                  <TableRow><TableCell colSpan={10} className="h-24 text-center text-destructive px-2 sm:px-4 whitespace-pre-wrap">{fetchError}</TableCell></TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="px-2 sm:px-4">
                        {(item.photoURL || item.imageUrl) ? (
                          <div className="h-10 w-10 relative overflow-hidden rounded-md border text-center">
                            <img src={item.photoURL || item.imageUrl} alt={item.itemName} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium px-2 sm:px-4">
                        <button
                          onClick={() => item.id && handleEditItem(item.id)}
                          className="text-primary hover:underline hover:text-primary/80 transition-colors cursor-pointer text-left font-medium"
                          disabled={!item.id}
                        >
                          {item.itemName || 'N/A'}
                        </button>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">{item.itemCode || 'N/A'}</TableCell>
                      <TableCell className="px-2 sm:px-4">{item.brandName || 'N/A'}</TableCell>
                      <TableCell className="px-2 sm:px-4">{item.supplierName || 'N/A'}</TableCell>
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
                  <TableRow><TableCell colSpan={10} className="h-64 text-center px-2 sm:px-4"><div className="flex flex-col items-center justify-center"><Info className="h-12 w-12 text-muted-foreground mb-4" /><p className="text-xl font-semibold text-muted-foreground">No Items Found</p><p className="text-sm text-muted-foreground mt-1">{allItems.length > 0 ? "No items match your current filters." : "Click \"Add New Item\" to get started."}</p></div></TableCell></TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your items from Database.
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


