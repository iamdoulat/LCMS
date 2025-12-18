
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { PlusCircle, ListChecks, FileEdit, Trash2, Loader2, Filter, XCircle, ArrowDownUp, Users, Building, CalendarDays, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
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
import type { ProformaInvoiceDocument, CustomerDocument, SupplierDocument } from '@/types';

import { format, parseISO, isValid, getMonth, getYear } from 'date-fns';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/context/AuthContext';


const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'MM/dd/yyyy') : 'Invalid Date';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (amount?: number, currencySymbol: string = '$') => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currencySymbol} N/A`;
  return `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercentage = (percentage?: number) => {
  if (typeof percentage !== 'number' || isNaN(percentage)) return 'N/A %';
  return `${percentage.toFixed(2)}%`;
}

const piSortOptions = [
  { value: "piNo", label: "PI Number" },
  { value: "piDate", label: "PI Date" },
  { value: "applicantName", label: "Applicant Name" },
  { value: "beneficiaryName", label: "Beneficiary Name" },
  { value: "grandTotalSalesPrice", label: "Grand Total" },
  { value: "totalCommissionPercentage", label: "Commission %" },
  { value: "salesPersonName", label: "Sales Person" },
];

const currentSystemYear = new Date().getFullYear();
const piYearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 5) }, (_, i) => (2020 + i).toString())]; // 2020 to currentYear + 4

const monthOptions = [
  "All Months", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const ALL_YEARS_VALUE = "All Years";
const ALL_MONTHS_VALUE = "All Months";
const PLACEHOLDER_APPLICANT_VALUE = "__PI_LIST_APPLICANT_PLACEHOLDER__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__PI_LIST_BENEFICIARY_PLACEHOLDER__";
const PI_ITEMS_PER_PAGE = 10;

export default function IssuedPIListPage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  const [allProformaInvoices, setAllProformaInvoices] = useState<ProformaInvoiceDocument[]>([]);
  const [displayedProformaInvoices, setDisplayedProformaInvoices] = useState<ProformaInvoiceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterPiNo, setFilterPiNo] = useState('');
  const [filterApplicantId, setFilterApplicantId] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>(ALL_MONTHS_VALUE);
  const [filterYear, setFilterYear] = useState<string>(ALL_YEARS_VALUE);

  const [applicantOptions, setApplicantOptions] = useState<ComboboxOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = useState(true);

  const [sortBy, setSortBy] = useState<string>('piDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(firestore, "proforma_invoices"));
        const fetchedPIs = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
          } as ProformaInvoiceDocument;
        });
        setAllProformaInvoices(fetchedPIs);
      } catch (error: any) {
        console.error("Error fetching Proforma Invoices: ", error);
        Swal.fire("Error", `Could not fetch PI data from Firestore. Please check console for details and ensure Firestore rules allow reads. Error: ${error.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };

    const fetchFilterOptions = async () => {
      setIsLoadingApplicants(true);
      setIsLoadingBeneficiaries(true);
      try {
        const customersSnapshot = await getDocs(collection(firestore, "customers"));
        setApplicantOptions(
          customersSnapshot.docs.map(doc => ({ value: doc.id, label: (doc.data() as CustomerDocument).applicantName || 'Unnamed Applicant' }))
        );
        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
        setBeneficiaryOptions(
          suppliersSnapshot.docs.map(doc => ({ value: doc.id, label: (doc.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' }))
        );
      } catch (error: any) {
        console.error("Error fetching filter options for PI list:", error);
        Swal.fire("Error", `Could not load filter options for applicants/beneficiaries. Error: ${(error as Error).message}`, "error");
      } finally {
        setIsLoadingApplicants(false);
        setIsLoadingBeneficiaries(false);
      }
    };

    fetchInitialData();
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    let filtered = [...allProformaInvoices];

    if (filterPiNo) {
      filtered = filtered.filter(pi => pi.piNo?.toLowerCase().includes(filterPiNo.toLowerCase()));
    }
    if (filterApplicantId) {
      filtered = filtered.filter(pi => pi.applicantId === filterApplicantId);
    }
    if (filterBeneficiaryId) {
      filtered = filtered.filter(pi => pi.beneficiaryId === filterBeneficiaryId);
    }

    const selectedYearNum = filterYear !== ALL_YEARS_VALUE ? parseInt(filterYear) : null;
    const selectedMonthNum = filterMonth !== ALL_MONTHS_VALUE ? monthOptions.indexOf(filterMonth) - 1 : null; // 0-indexed month

    if (selectedYearNum !== null || selectedMonthNum !== null) {
      filtered = filtered.filter(pi => {
        if (!pi.piDate) return false;
        try {
          const date = parseISO(pi.piDate);
          if (!isValid(date)) return false;
          const piYear = getYear(date);
          const piMonth = getMonth(date); // 0-indexed

          const yearMatch = selectedYearNum === null || piYear === selectedYearNum;
          const monthMatch = selectedMonthNum === null || piMonth === selectedMonthNum;

          return yearMatch && monthMatch;
        } catch {
          return false;
        }
      });
    }


    if (sortBy) {
      filtered.sort((a, b) => {
        let valA = (a as any)[sortBy];
        let valB = (b as any)[sortBy];

        if (sortBy === 'piDate' && typeof valA === 'string' && typeof valB === 'string') {
          try {
            valA = parseISO(valA);
            valB = parseISO(valB);
            if (!isValid(valA) && isValid(valB)) return sortOrder === 'asc' ? 1 : -1;
            if (isValid(valA) && !isValid(valB)) return sortOrder === 'asc' ? -1 : 1;
            if (!isValid(valA) && !isValid(valB)) return 0;
          } catch { /* ignore parsing error, will compare as strings or fall through */ }
        }

        if (sortBy === 'grandTotalSalesPrice' || sortBy === 'totalCommissionPercentage') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setDisplayedProformaInvoices(filtered);
    setCurrentPage(1);
  }, [allProformaInvoices, filterPiNo, filterApplicantId, filterBeneficiaryId, filterMonth, filterYear, sortBy, sortOrder]);

  const handleEditPI = (piId: string) => {
    if (!piId) {
      Swal.fire("Error", "PI ID is missing, cannot edit.", "error");
      return;
    }
    router.push(`/dashboard/commission-management/edit-pi/${piId}`);
  };

  const handleDeletePI = (piId: string, piNumber?: string) => {
    if (!piId) {
      Swal.fire("Error", "PI ID is missing, cannot delete.", "error");
      return;
    }
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will permanently delete PI "${piNumber || piId}" from Firestore.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "proforma_invoices", piId));
          setAllProformaInvoices(prevPIs => prevPIs.filter(pi => pi.id !== piId));
          Swal.fire(
            'Deleted!',
            `PI "${piNumber || piId}" has been removed.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting PI: ", error);
          Swal.fire("Error", `Could not delete PI: ${error.message}`, "error");
        }
      }
    });
  };

  const clearFilters = () => {
    setFilterPiNo('');
    setFilterApplicantId('');
    setFilterBeneficiaryId('');
    setFilterMonth(ALL_MONTHS_VALUE);
    setFilterYear(ALL_YEARS_VALUE);
    setSortBy('piDate');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(displayedProformaInvoices.length / PI_ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * PI_ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - PI_ITEMS_PER_PAGE;
  const currentItems = displayedProformaInvoices.slice(indexOfFirstItem, indexOfLastItem);

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
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ListChecks className="h-7 w-7 text-primary" />
                Issued Proforma Invoice (PI) List
              </CardTitle>
              <CardDescription>
                View, search, filter, and manage all issued Proforma Invoices.
              </CardDescription>
            </div>
            <Link href="/dashboard/commission-management/add-pi" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isReadOnly}>
                <PlusCircle className="mr-2 h-5 w-5" />
                Add New PI
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
                <div className="space-y-1">
                  <label htmlFor="piNoFilter" className="text-sm font-medium">PI Number</label>
                  <Input
                    id="piNoFilter"
                    placeholder="Search by PI No..."
                    value={filterPiNo}
                    onChange={(e) => setFilterPiNo(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="applicantFilterPi" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground" />Applicant</label>
                  <Combobox
                    options={applicantOptions}
                    value={filterApplicantId || PLACEHOLDER_APPLICANT_VALUE}
                    onValueChange={(value) => setFilterApplicantId(value === PLACEHOLDER_APPLICANT_VALUE ? '' : value)}
                    placeholder="Search Applicant..."
                    selectPlaceholder={isLoadingApplicants ? "Loading..." : "All Applicants"}
                    emptyStateMessage="No applicant found."
                    disabled={isLoadingApplicants}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="beneficiaryFilterPi" className="text-sm font-medium flex items-center"><Building className="mr-1 h-4 w-4 text-muted-foreground" />Beneficiary</label>
                  <Combobox
                    options={beneficiaryOptions}
                    value={filterBeneficiaryId || PLACEHOLDER_BENEFICIARY_VALUE}
                    onValueChange={(value) => setFilterBeneficiaryId(value === PLACEHOLDER_BENEFICIARY_VALUE ? '' : value)}
                    placeholder="Search Beneficiary..."
                    selectPlaceholder={isLoadingBeneficiaries ? "Loading..." : "All Beneficiaries"}
                    emptyStateMessage="No beneficiary found."
                    disabled={isLoadingBeneficiaries}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="yearFilterPi" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground" />Year</label>
                  <Select
                    value={filterYear}
                    onValueChange={(value) => setFilterYear(value)}
                  >
                    <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                    <SelectContent>
                      {piYearFilterOptions.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="monthFilterPi" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground" />Month</label>
                  <Select
                    value={filterMonth}
                    onValueChange={(value) => setFilterMonth(value)}
                  >
                    <SelectTrigger><SelectValue placeholder="All Months" /></SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((month) => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="sortByPi" className="text-sm font-medium flex items-center"><ArrowDownUp className="mr-1 h-4 w-4 text-muted-foreground" />Sort By</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {piSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="self-end md:col-span-2 lg:col-span-1">
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
                  <TableHead className="px-2 sm:px-4">PI No.</TableHead>
                  <TableHead className="px-2 sm:px-4">PI Date</TableHead>
                  <TableHead className="px-2 sm:px-4">Applicant</TableHead>
                  <TableHead className="px-2 sm:px-4">Beneficiary</TableHead>
                  <TableHead className="px-2 sm:px-4">Grand Total</TableHead>
                  <TableHead className="px-2 sm:px-4">Commission %</TableHead>
                  <TableHead className="px-2 sm:px-4">Sales Person</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center p-2 sm:p-4">
                      <div className="flex justify-center items-center">
                        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading PIs...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((pi) => (
                    <TableRow key={pi.id}>
                      <TableCell className="font-medium p-2 sm:p-4">{pi.piNo || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatDisplayDate(pi.piDate)}</TableCell>
                      <TableCell className="p-2 sm:p-4">{pi.applicantName || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{pi.beneficiaryName || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatCurrencyValue(pi.grandTotalSalesPrice)}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatPercentage(pi.totalCommissionPercentage)}</TableCell>
                      <TableCell className="p-2 sm:p-4">{pi.salesPersonName || 'N/A'}</TableCell>
                      <TableCell className="text-right p-2 sm:p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!pi.id || isReadOnly}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => pi.id && handleEditPI(pi.id)} disabled={isReadOnly}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => pi.id && handleDeletePI(pi.id, pi.piNo)}
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
                    <TableCell colSpan={8} className="h-24 text-center p-2 sm:p-4">
                      No Proforma Invoices found matching your criteria. Ensure Firestore rules allow reads and data exists.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your Proforma Invoices from Database.
                Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedProformaInvoices.length)} of {displayedProformaInvoices.length} entries.
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
                  <span key={`ellipsis-pi-${index}`} className="px-2 py-1 text-sm">
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




