
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/forms/DatePickerField'; // Though not used for PI date filter, kept for potential future use
import { PlusCircle, ListChecks, FileEdit, Trash2, Loader2, Search, Filter, XCircle, ArrowDownUp, Users, Building, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, DollarSign, Percent } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Swal from 'sweetalert2';
import type { ProformaInvoiceDocument, CustomerDocument, SupplierDocument } from '@/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid, getMonth, getYear } from 'date-fns';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';

const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
  } catch (e) {
    return 'N/A';
  }
};

// Assuming a default currency if not specified in ProformaInvoiceDocument
// For better accuracy, currency should be part of the PI document.
const formatCurrencyValue = (amount?: number, currencySymbol: string = '$') => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currencySymbol} N/A`;
  return `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercentage = (percentage?: number) => {
    if (typeof percentage !== 'number' || isNaN(percentage)) return 'N/A %';
    return `${percentage.toFixed(2)}%`;
}

interface DropdownOption {
  value: string;
  label: string;
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
const ALL_APPLICANTS_VALUE = "__ALL_APPLICANTS_PI__";
const ALL_BENEFICIARIES_VALUE = "__ALL_BENEFICIARIES_PI__";
const PI_ITEMS_PER_PAGE = 10;

export default function IssuedPIListPage() {
  const router = useRouter();
  const [allProformaInvoices, setAllProformaInvoices] = useState<ProformaInvoiceDocument[]>([]);
  const [displayedProformaInvoices, setDisplayedProformaInvoices] = useState<ProformaInvoiceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterPiNo, setFilterPiNo] = useState('');
  const [filterApplicantId, setFilterApplicantId] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>(ALL_MONTHS_VALUE);
  const [filterYear, setFilterYear] = useState<string>(ALL_YEARS_VALUE);

  const [applicantOptions, setApplicantOptions] = useState<DropdownOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = useState<DropdownOption[]>([]);
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
    const selectedMonthNum = filterMonth !== ALL_MONTHS_VALUE ? monthOptions.indexOf(filterMonth) -1 : null; // 0-indexed month

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
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ListChecks className="h-7 w-7 text-primary" />
                Issued Proforma Invoice (PI) List
              </CardTitle>
              <CardDescription>
                View, search, filter, and manage all issued Proforma Invoices.
              </CardDescription>
            </div>
            <Link href="/dashboard/commission-management/add-pi" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
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
                  <label htmlFor="applicantFilterPi" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground"/>Applicant</label>
                  <Select 
                    value={filterApplicantId === '' ? ALL_APPLICANTS_VALUE : filterApplicantId} 
                    onValueChange={(value) => setFilterApplicantId(value === ALL_APPLICANTS_VALUE ? '' : value)} 
                    disabled={isLoadingApplicants}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingApplicants ? "Loading..." : "All Applicants"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_APPLICANTS_VALUE}>All Applicants</SelectItem>
                      {applicantOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="beneficiaryFilterPi" className="text-sm font-medium flex items-center"><Building className="mr-1 h-4 w-4 text-muted-foreground"/>Beneficiary</label>
                  <Select 
                    value={filterBeneficiaryId === '' ? ALL_BENEFICIARIES_VALUE : filterBeneficiaryId} 
                    onValueChange={(value) => setFilterBeneficiaryId(value === ALL_BENEFICIARIES_VALUE ? '' : value)} 
                    disabled={isLoadingBeneficiaries}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingBeneficiaries ? "Loading..." : "All Beneficiaries"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_BENEFICIARIES_VALUE}>All Beneficiaries</SelectItem>
                      {beneficiaryOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="yearFilterPi" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground"/>Year</label>
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
                  <label htmlFor="monthFilterPi" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground"/>Month</label>
                  <Select 
                    value={filterMonth} 
                    onValueChange={(value) => setFilterMonth(value)}
                  >
                    <SelectTrigger><SelectValue placeholder="All Months" /></SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((month, index) => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                    <label htmlFor="sortByPi" className="text-sm font-medium flex items-center"><ArrowDownUp className="mr-1 h-4 w-4 text-muted-foreground"/>Sort By</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {piSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-1">
                    <label htmlFor="sortOrderPi" className="text-sm font-medium">Order</label>
                    <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="asc">Ascending</SelectItem>
                            <SelectItem value="desc">Descending</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="pt-5 xl:col-start-4">
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
                  <TableHead>PI No.</TableHead>
                  <TableHead>PI Date</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Beneficiary</TableHead>
                  <TableHead>Grand Total</TableHead>
                  <TableHead>Commission %</TableHead>
                  <TableHead>Sales Person</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {isLoading ? (
                   <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                       <div className="flex justify-center items-center">
                         <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading PIs...
                       </div>
                    </TableCell>
                  </TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((pi) => (
                    <TableRow key={pi.id}>
                      <TableCell className="font-medium">{pi.piNo || 'N/A'}</TableCell>
                      <TableCell>{formatDisplayDate(pi.piDate)}</TableCell>
                      <TableCell>{pi.applicantName || 'N/A'}</TableCell>
                      <TableCell>{pi.beneficiaryName || 'N/A'}</TableCell>
                      <TableCell>{formatCurrencyValue(pi.grandTotalSalesPrice)}</TableCell>
                      <TableCell>{formatPercentage(pi.totalCommissionPercentage)}</TableCell>
                      <TableCell>{pi.salesPersonName || 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                               <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => pi.id && handleEditPI(pi.id)}
                                className="hover:bg-accent/50 hover:text-accent-foreground"
                                disabled={!pi.id}
                                title="Edit PI"
                              >
                                <FileEdit className="h-4 w-4" />
                                <span className="sr-only">Edit PI</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit PI</p></TooltipContent>
                          </Tooltip>
                           <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => pi.id && handleDeletePI(pi.id, pi.piNo)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                  disabled={!pi.id}
                                  title="Delete PI"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete PI</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete PI</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                       No Proforma Invoices found matching your criteria. Ensure Firestore rules allow reads and data exists.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your Proforma Invoices from Firestore.
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

