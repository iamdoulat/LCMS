
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Users as UsersIcon, FileEdit, Trash2, Loader2, ChevronLeft, ChevronRight, Search, Filter, XCircle, MoreHorizontal, ListChecks, Download, Upload, FileJson } from 'lucide-react';
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
import type { Supplier, SupplierDocument, ProformaInvoiceDocument } from '@/types';
import { collection, getDocs, deleteDoc, doc, orderBy, query as firestoreQuery } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { addDoc, serverTimestamp } from 'firebase/firestore';

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
  if (typeof value !== 'number' || isNaN(value)) return 'USD N/A';
  return `USD ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const SupplierListSkeleton = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
      </TableRow>
    ))}
  </>
);

export default function BeneficiariesListPage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter states
  const [filterBeneficiaryName, setFilterBeneficiaryName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterContactPerson, setFilterContactPerson] = useState('');

  // Data fetching using the custom hook
  const { data: allBeneficiaries, isLoading: isLoadingBeneficiaries, error: fetchError } = useFirestoreQuery<SupplierDocument[]>(
    firestoreQuery(collection(firestore, "suppliers"), orderBy("beneficiaryName", "asc")),
    undefined, // Use default transformer
    ['suppliers'] // Query key
  );

  const { data: supplierCommissionVals, isLoading: isLoadingCommissions } = useFirestoreQuery<{ [key: string]: number }>(
    collection(firestore, "proforma_invoices"),
    (snapshot) => {
      const commissionsBySupplier: { [key: string]: number } = {};
      snapshot.forEach(docSnap => {
        const pi = docSnap.data() as ProformaInvoiceDocument;
        if (pi.beneficiaryId && typeof pi.grandTotalCommissionUSD === 'number') {
          commissionsBySupplier[pi.beneficiaryId] = (commissionsBySupplier[pi.beneficiaryId] || 0) + pi.grandTotalCommissionUSD;
        }
      });
      return commissionsBySupplier;
    },
    ['commissions_by_supplier'] // Query key
  );

  const isLoading = isLoadingBeneficiaries || isLoadingCommissions;

  const displayedBeneficiaries = useMemo(() => {
    if (!allBeneficiaries) return [];
    let filtered = [...allBeneficiaries];

    if (filterBeneficiaryName) {
      filtered = filtered.filter(b =>
        b.beneficiaryName?.toLowerCase().includes(filterBeneficiaryName.toLowerCase())
      );
    }
    if (filterEmail) {
      filtered = filtered.filter(b =>
        b.emailId?.toLowerCase().includes(filterEmail.toLowerCase())
      );
    }
    if (filterPhone) {
      filtered = filtered.filter(b =>
        b.cellNumber?.toLowerCase().includes(filterPhone.toLowerCase())
      );
    }
    if (filterContactPerson) {
      filtered = filtered.filter(b =>
        b.contactPersonName?.toLowerCase().includes(filterContactPerson.toLowerCase())
      );
    }

    return filtered;
  }, [allBeneficiaries, filterBeneficiaryName, filterEmail, filterPhone, filterContactPerson]);

  const handleEditBeneficiary = (beneficiaryId: string) => {
    router.push(`/dashboard/suppliers/${beneficiaryId}/edit`);
  };

  const handleDeleteBeneficiary = (beneficiaryId: string, beneficiaryName?: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This will permanently delete the beneficiary profile for "${beneficiaryName || beneficiaryId}" from Firestore.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "suppliers", beneficiaryId));
          // React Query will automatically refetch and update the UI.
          Swal.fire(
            'Deleted!',
            `Beneficiary ${beneficiaryName || beneficiaryId} has been removed.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting beneficiary: ", error);
          Swal.fire("Error", `Could not delete beneficiary: ${error.message}`, "error");
        }
      }
    });
  };

  const clearFilters = () => {
    setFilterBeneficiaryName('');
    setFilterEmail('');
    setFilterPhone('');
    setFilterContactPerson('');
    setCurrentPage(1);
  };

  // Pagination Logic
  const totalPages = Math.ceil(displayedBeneficiaries.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = displayedBeneficiaries.slice(indexOfFirstItem, indexOfLastItem);

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

  const handleExportCSV = () => {
    if (!displayedBeneficiaries || displayedBeneficiaries.length === 0) {
      Swal.fire("No Data", "There are no beneficiaries to export.", "info");
      return;
    }

    const headers = ["Beneficiary Name", "Head Office Address", "Bank Information", "Contact Person", "Cell Number", "Email", "Website", "Brand Name"];
    const csvRows = displayedBeneficiaries.map(b => [
      escapeCsvCell(b.beneficiaryName),
      escapeCsvCell(b.headOfficeAddress),
      escapeCsvCell(b.bankInformation),
      escapeCsvCell(b.contactPersonName),
      escapeCsvCell(b.cellNumber),
      escapeCsvCell(b.emailId),
      escapeCsvCell(b.website),
      escapeCsvCell(b.brandName)
    ]);

    const csvContent = [headers.join(","), ...csvRows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `beneficiaries_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSample = () => {
    const headers = ["Beneficiary Name", "Head Office Address", "Bank Information", "Contact Person", "Cell Number", "Email", "Website", "Brand Name"];
    const sampleData = [
      "Example Supplier Ltd.",
      "Singapore Office, Tower A",
      "DBS Bank, Singapore. SWIFT: DBSSSG",
      "Jane Smith",
      "+6591234567",
      "jane@supplier.com",
      "www.supplier.com",
      "ExampleBrand"
    ];

    const csvContent = headers.join(",") + "\n" + sampleData.map(escapeCsvCell).join(",");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "beneficiaries_sample.csv");
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

      const items = rows.slice(1).map(row => parseCSVLine(row));

      Swal.fire({
        title: 'Importing...',
        text: `Found ${items.length} records for Beneficiaries. Proceed?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, import'
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            Swal.fire({ title: 'Processing...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            for (const item of items) {
              if (item.length < 1 || !item[0]) continue; // Skip empty rows or missing name

              const newBeneficiary: Omit<Supplier, 'id'> = {
                beneficiaryName: item[0],
                headOfficeAddress: item[1] || '',
                bankInformation: item[2] || '',
                contactPersonName: item[3] || '',
                cellNumber: item[4] || '',
                emailId: item[5] || '',
                website: item[6] || '',
                brandName: item[7] || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              };

              await addDoc(collection(firestore, "suppliers"), newBeneficiary);
            }
            Swal.fire("Success", "Beneficiaries imported successfully.", "success");
            e.target.value = ''; // Reset input
          } catch (error: any) {
            console.error("Import error:", error);
            Swal.fire("Error", `Failed to import: ${error.message}`, "error");
          }
        }
      });
    };
    reader.readAsText(file);
  };


  return (
    <div className="max-w-none mx-[25px] py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ListChecks className="h-7 w-7 text-primary" />
                Manage Beneficiaries
              </CardTitle>
              <CardDescription>
                View, search, and manage all beneficiary profiles from the database.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard/suppliers/add" passHref>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isReadOnly}>
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Add New Beneficiary
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
                  id="suppliers-csv-import"
                  disabled={isReadOnly || isLoading}
                />
                <Label
                  htmlFor="suppliers-csv-import"
                  className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 cursor-pointer",
                    (isReadOnly || isLoading) && "opacity-50 pointer-events-none"
                  )}
                >
                  <Upload className="mr-2 h-4 w-4" /> Import CSV
                </Label>
              </div>
              <Button variant="ghost" onClick={handleDownloadSample} className="text-muted-foreground">
                <FileJson className="mr-2 h-4 w-4" /> Sample
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <Label htmlFor="beneficiaryNameFilter" className="text-sm font-medium">Beneficiary Name</Label>
                  <Input
                    id="beneficiaryNameFilter"
                    placeholder="Search by Beneficiary Name..."
                    value={filterBeneficiaryName}
                    onChange={(e) => setFilterBeneficiaryName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="emailFilter" className="text-sm font-medium">Email</Label>
                  <Input
                    id="emailFilter"
                    type="email"
                    placeholder="Search by Email..."
                    value={filterEmail}
                    onChange={(e) => setFilterEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="phoneFilter" className="text-sm font-medium">Phone</Label>
                  <Input
                    id="phoneFilter"
                    type="tel"
                    placeholder="Search by Phone..."
                    value={filterPhone}
                    onChange={(e) => setFilterPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="contactPersonFilter" className="text-sm font-medium">Contact Person</Label>
                  <Input
                    id="contactPersonFilter"
                    placeholder="Search by Contact Person..."
                    value={filterContactPerson}
                    onChange={(e) => setFilterContactPerson(e.target.value)}
                  />
                </div>
                <div className="lg:col-span-4 md:col-span-2">
                  <Button onClick={clearFilters} variant="outline" className="w-full md:w-auto">
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
                  <TableHead className="w-[200px]">Beneficiary Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Total Commissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <SupplierListSkeleton />
                ) : fetchError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-destructive">
                      {fetchError.message}
                    </TableCell>
                  </TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((beneficiary) => (
                    <TableRow key={beneficiary.id}>
                      <TableCell className="font-medium">{beneficiary.beneficiaryName || 'N/A'}</TableCell>
                      <TableCell>{beneficiary.emailId || 'N/A'}</TableCell>
                      <TableCell>{beneficiary.cellNumber || 'N/A'}</TableCell>
                      <TableCell>{beneficiary.contactPersonName || 'N/A'}</TableCell>
                      <TableCell>{formatCurrency(supplierCommissionVals?.[beneficiary.id] || 0)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!beneficiary.id || isReadOnly}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => beneficiary.id && handleEditBeneficiary(beneficiary.id)}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>{isReadOnly ? 'View' : 'Edit'}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => beneficiary.id && handleDeleteBeneficiary(beneficiary.id, beneficiary.beneficiaryName)}
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
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No beneficiaries found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your Beneficiaries from Database.
                Showing {displayedBeneficiaries.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedBeneficiaries.length)} of {displayedBeneficiaries.length} entries.
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
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-9 h-9 p-0"
                  >
                    {page}
                  </Button>
                ) : (
                  <span key={`ellipsis-${index}`} className="px-2 py-1 text-sm">
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
