
"use client";

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Users as UsersIcon, FileEdit, Trash2, ChevronLeft, ChevronRight, Filter, XCircle, MoreHorizontal, Download, Upload, FileJson } from 'lucide-react';
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
import type { Customer, CustomerDocument, LCEntryDocument } from '@/types';
import { collection, deleteDoc, doc, query as firestoreQuery } from 'firebase/firestore';
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

const ApplicantListSkeleton = () => (
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


export default function ApplicantsListPage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');

  const [currentPage, setCurrentPage] = useState(1);
  const [filterApplicantName, setFilterApplicantName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterContactPerson, setFilterContactPerson] = useState('');

  // Use the custom hook for data fetching, providing a unique query key.
  const { data: allApplicants, isLoading: isLoadingApplicants, error: fetchError } = useFirestoreQuery<CustomerDocument[]>(
    firestoreQuery(collection(firestore, "customers")), // The actual Firestore query
    undefined, // Use default transformer
    ['customers'] // The unique key for this query
  );

  const { data: applicantLcVals, isLoading: isLoadingLcVals } = useFirestoreQuery<{ [key: string]: number }>(
    collection(firestore, "lc_entries"),
    (snapshot) => {
      const lcValues: { [key: string]: number } = {};
      snapshot.forEach(docSnap => {
        const lc = docSnap.data() as LCEntryDocument;
        if (lc.applicantId && typeof lc.amount === 'number') {
          lcValues[lc.applicantId] = (lcValues[lc.applicantId] || 0) + lc.amount;
        }
      });
      return lcValues;
    },
    ['lc_values_by_applicant'] // unique query key
  );

  const isLoading = isLoadingApplicants || isLoadingLcVals;

  const displayedApplicants = useMemo(() => {
    if (!allApplicants) return [];
    let filtered = [...allApplicants];

    if (filterApplicantName) {
      filtered = filtered.filter(app =>
        app.applicantName?.toLowerCase().includes(filterApplicantName.toLowerCase())
      );
    }
    if (filterEmail) {
      filtered = filtered.filter(app =>
        app.email?.toLowerCase().includes(filterEmail.toLowerCase())
      );
    }
    if (filterPhone) {
      filtered = filtered.filter(app =>
        app.phone?.toLowerCase().includes(filterPhone.toLowerCase())
      );
    }
    if (filterContactPerson) {
      filtered = filtered.filter(app =>
        app.contactPerson?.toLowerCase().includes(filterContactPerson.toLowerCase())
      );
    }

    // Sort after filtering
    filtered.sort((a, b) => a.applicantName.localeCompare(b.applicantName));

    return filtered;
  }, [allApplicants, filterApplicantName, filterEmail, filterPhone, filterContactPerson]);

  const handleEditApplicant = (applicantId: string) => {
    router.push(`/dashboard/customers/${applicantId}/edit`);
  };

  const handleDeleteApplicant = (applicantId: string, applicantName?: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will permanently delete the applicant profile for "${applicantName || applicantId}" from Firestore.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "customers", applicantId));
          // React Query will automatically refetch and update the UI.
          Swal.fire(
            'Deleted!',
            `Applicant ${applicantName || applicantId} has been removed.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting applicant: ", error);
          Swal.fire("Error", `Could not delete applicant: ${error.message}`, "error");
        }
      }
    });
  };

  const clearFilters = () => {
    setFilterApplicantName('');
    setFilterEmail('');
    setFilterPhone('');
    setFilterContactPerson('');
    setCurrentPage(1);
  };


  // Pagination Logic
  const totalPages = Math.ceil(displayedApplicants.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = displayedApplicants.slice(indexOfFirstItem, indexOfLastItem);

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

      if (currentPage <= halfPagesToShow + 1) {
        endPage = Math.min(totalPages - 1, maxPagesToShow);
      }
      if (currentPage >= totalPages - halfPagesToShow) {
        startPage = Math.max(2, totalPages - maxPagesToShow + 1);
      }

      if (startPage > 2) {
        pageNumbers.push("...");
      }
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      if (endPage < totalPages - 1) {
        pageNumbers.push("...");
      }
      pageNumbers.push(totalPages);
    }
    return pageNumbers;
  };

  const handleExportCSV = () => {
    if (!displayedApplicants || displayedApplicants.length === 0) {
      Swal.fire("No Data", "There are no applicants to export.", "info");
      return;
    }

    const headers = ["Applicant Name", "Email", "Phone", "Address", "Contact Person", "Designation", "BIN No", "TIN No", "New IRC No", "Old IRC No", "Bond No", "Group Name", "BIDA Reg No"];
    const csvRows = displayedApplicants.map(app => [
      escapeCsvCell(app.applicantName),
      escapeCsvCell(app.email),
      escapeCsvCell(app.phone),
      escapeCsvCell(app.address),
      escapeCsvCell(app.contactPerson),
      escapeCsvCell(app.contactPersonDesignation),
      escapeCsvCell(app.binNo),
      escapeCsvCell(app.tinNo),
      escapeCsvCell(app.newIrcNo),
      escapeCsvCell(app.oldIrcNo),
      escapeCsvCell(app.applicantBondNo),
      escapeCsvCell(app.groupName),
      escapeCsvCell(app.bidaRegNo)
    ]);

    const csvContent = [headers.join(","), ...csvRows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `applicants_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSample = () => {
    const headers = ["Applicant Name", "Email", "Phone", "Address", "Contact Person", "Designation", "BIN No", "TIN No", "New IRC No", "Old IRC No", "Bond No", "Group Name", "BIDA Reg No"];
    const sampleData = [
      "Example Customer Ltd.",
      "contact@example.com",
      "+8801700000000",
      "Dhaka, Bangladesh",
      "John Doe",
      "Manager",
      "123456789",
      "987654321",
      "IRC-001",
      "IRC-OLD-001",
      "BOND-123",
      "Example Group",
      "BIDA-456"
    ];

    const csvContent = headers.join(",") + "\n" + sampleData.map(escapeCsvCell).join(",");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "applicants_sample.csv");
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

      // Simple CSV parser (doesn't handle complex quoted cells perfectly, but works for standard exports)
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
        text: `Found ${items.length} records. Proceed?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, import'
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            Swal.fire({ title: 'Processing...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            for (const item of items) {
              if (item.length < 1 || !item[0]) continue; // Skip empty rows or missing name

              const newApplicant: Omit<Customer, 'id'> = {
                applicantName: item[0],
                email: item[1] || '',
                phone: item[2] || '',
                address: item[3] || '',
                contactPerson: item[4] || '',
                contactPersonDesignation: item[5] || '',
                binNo: item[6] || '',
                tinNo: item[7] || '',
                newIrcNo: item[8] || '',
                oldIrcNo: item[9] || '',
                applicantBondNo: item[10] || '',
                groupName: item[11] || '',
                bidaRegNo: item[12] || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              };

              await addDoc(collection(firestore, "customers"), newApplicant);
            }
            Swal.fire("Success", "Applicants imported successfully.", "success");
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
                <UsersIcon className="h-7 w-7 text-primary" />
                Manage Applicants
              </CardTitle>
              <CardDescription>
                View, search, and manage all applicant profiles from the database.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard/customers/add" passHref>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isReadOnly}>
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Add New Applicant
                </Button>
              </Link>
              <Button variant="outline" onClick={handleExportCSV} disabled={isLoading}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <div className="relative">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  className="hidden"
                  id="csv-import"
                  disabled={isReadOnly || isLoading}
                />
                <Label
                  htmlFor="csv-import"
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
                  <Label htmlFor="applicantNameFilter" className="text-sm font-medium">Applicant Name</Label>
                  <Input
                    id="applicantNameFilter"
                    placeholder="Search by Applicant Name..."
                    value={filterApplicantName}
                    onChange={(e) => setFilterApplicantName(e.target.value)}
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
                  <TableHead className="w-[200px]">Applicant Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Total L/C Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <ApplicantListSkeleton />
                ) : fetchError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-destructive">
                      {fetchError.message}
                    </TableCell>
                  </TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((applicant) => (
                    <TableRow key={applicant.id}>
                      <TableCell className="font-medium">{applicant.applicantName || 'N/A'}</TableCell>
                      <TableCell>{applicant.email || 'N/A'}</TableCell>
                      <TableCell>{applicant.phone || 'N/A'}</TableCell>
                      <TableCell>{applicant.contactPerson || 'N/A'}</TableCell>
                      <TableCell>{formatCurrency(applicantLcVals?.[applicant.id] || 0)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!applicant.id || isReadOnly}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => applicant.id && handleEditApplicant(applicant.id)}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>{isReadOnly ? 'View' : 'Edit'}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => applicant.id && handleDeleteApplicant(applicant.id, applicant.applicantName)}
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
                      No applicants found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your Applicants from Database.
                Showing {displayedApplicants.length > 0 ? indexOfFirstItem + 1 : 0}-${Math.min(indexOfLastItem, displayedApplicants.length)} of {displayedApplicants.length} entries.
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
                    key={`app-page-${page}`}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-9 h-9 p-0"
                  >
                    {page}
                  </Button>
                ) : (
                  <span key={`ellipsis-app-${index}`} className="px-2 py-1 text-sm">
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
