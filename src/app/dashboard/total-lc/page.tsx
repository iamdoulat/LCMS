
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { PlusCircle, ListChecks, FileEdit, Trash2, Loader2, Search, Filter, XCircle, ArrowDownUp, Users, Building, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, ExternalLink, Ship, PackageCheck, FileText, Plane, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Swal from 'sweetalert2';
import type { LCEntryDocument, LCStatus, CustomerDocument, SupplierDocument, Currency } from '@/types';
import { lcStatusOptions, currencyOptions } from '@/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid, startOfDay, isAfter, isEqual } from 'date-fns';
import { collection, getDocs, deleteDoc, doc, query, orderBy as firestoreOrderBy, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const getStatusBadgeVariant = (status?: LCStatus): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case 'Draft':
      return 'outline';
    case 'Transmitted':
      return 'secondary';
    case 'Shipment Pending':
      return 'default';
    case 'Shipping going on':
      return 'default';
    case 'Payment Done':
      return 'default';
    case 'Shipment Done': // Updated from "Done"
      return 'default';
    default:
      return 'outline';
  }
};

const formatDisplayDate = (dateString?: string) => {
  if (!dateString || !isValid(parseISO(dateString))) return 'N/A';
  try {
    const date = parseISO(dateString);
    return format(date, 'PPP');
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (currency?: Currency | string, amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currency || ''} N/A`;
  return `${currency || ''} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface DropdownOption {
  value: string;
  label: string;
}

const sortOptions = [
  { value: "documentaryCreditNumber", label: "L/C Number" },
  { value: "applicantName", label: "Applicant Name" },
  { value: "beneficiaryName", label: "Beneficiary Name" },
  { value: "lcIssueDate", label: "Issue Date" },
  { value: "expireDate", label: "Expire Date" },
  { value: "latestShipmentDate", label: "Latest Shipment Date" },
  { value: "amount", label: "Amount" },
  { value: "status", label: "Status" },
  { value: "year", label: "Year" },
];

const currentSystemYear = new Date().getFullYear();
const yearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())]; // 2020 to currentYear + 10


const ALL_YEARS_VALUE = "__ALL_YEARS__";
const ALL_STATUSES_VALUE = "__ALL_STATUSES__";
const ITEMS_PER_PAGE = 10;

export default function TotalLCPage() {
  const router = useRouter();
  const [allLcEntries, setAllLcEntries] = useState<LCEntryDocument[]>([]);
  const [displayedLcEntries, setDisplayedLcEntries] = useState<LCEntryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterLcNumber, setFilterLcNumber] = useState('');
  const [filterApplicantId, setFilterApplicantId] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState('');
  const [filterShipmentDate, setFilterShipmentDate] = useState<Date | null>(null);
  const [filterStatus, setFilterStatus] = useState<LCStatus | ''>('');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());


  const [applicantOptions, setApplicantOptions] = useState<DropdownOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = useState<DropdownOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = useState(true);

  const [sortBy, setSortBy] = useState<string>('lcIssueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const lcQuery = query(collection(firestore, "lc_entries"), firestoreOrderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(lcQuery);
        const fetchedLCs = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
             id: doc.id,
             ...data,
          } as LCEntryDocument;
        });
        setAllLcEntries(fetchedLCs);
      } catch (error: any) {
        console.error("Error fetching L/C entries: ", error);
        const errorMsg = `Could not fetch L/C data from Firestore. Ensure Firestore rules allow reads. Error: ${error.message}`;
        setFetchError(errorMsg);
        Swal.fire("Error", errorMsg, "error");
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
          customersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as CustomerDocument).applicantName || 'Unnamed Applicant' }))
        );
        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
        setBeneficiaryOptions(
          suppliersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' }))
        );
      } catch (error: any) {
        console.error("Error fetching filter options:", error);
        Swal.fire("Error", `Could not load filter options. Error: ${(error as Error).message}`, "error");
      } finally {
        setIsLoadingApplicants(false);
        setIsLoadingBeneficiaries(false);
      }
    };

    fetchInitialData();
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    let filtered = [...allLcEntries];

    if (filterLcNumber) {
      filtered = filtered.filter(lc => lc.documentaryCreditNumber?.toLowerCase().includes(filterLcNumber.toLowerCase()));
    }
    if (filterApplicantId) {
      filtered = filtered.filter(lc => lc.applicantId === filterApplicantId);
    }
    if (filterBeneficiaryId) {
      filtered = filtered.filter(lc => lc.beneficiaryId === filterBeneficiaryId);
    }
    if (filterShipmentDate) {
      const targetDate = startOfDay(filterShipmentDate);
      filtered = filtered.filter(lc => {
        if (!lc.latestShipmentDate) return false;
        try {
          const lcDate = startOfDay(parseISO(lc.latestShipmentDate));
          return isValid(lcDate) && (isAfter(lcDate, targetDate) || isEqual(lcDate, targetDate));
        } catch {
          return false;
        }
      });
    }
    if (filterStatus && filterStatus !== ALL_STATUSES_VALUE) {
      filtered = filtered.filter(lc => lc.status === filterStatus);
    }
    if (filterYear && filterYear !== ALL_YEARS_VALUE) {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(lc => lc.year === yearNum);
    }


    if (sortBy) {
      filtered.sort((a, b) => {
        let valA = (a as any)[sortBy];
        let valB = (b as any)[sortBy];

        if (sortBy.includes('Date') && typeof valA === 'string' && typeof valB === 'string') {
          try {
            valA = parseISO(valA);
            valB = parseISO(valB);
             if (!isValid(valA) && isValid(valB)) return sortOrder === 'asc' ? 1 : -1;
             if (isValid(valA) && !isValid(valB)) return sortOrder === 'asc' ? -1 : 1;
             if (!isValid(valA) && !isValid(valB)) return 0;
          } catch { /* ignore parsing error, will compare as strings or fall through */ }
        }

        if (sortBy === 'amount' || sortBy === 'year') {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setDisplayedLcEntries(filtered);
    setCurrentPage(1);
  }, [allLcEntries, filterLcNumber, filterApplicantId, filterBeneficiaryId, filterShipmentDate, filterStatus, filterYear, sortBy, sortOrder]);

  const handleEditLC = (lcId: string) => {
    if (!lcId) {
        Swal.fire("Error", "L/C ID is missing, cannot edit.", "error");
        return;
    }
    router.push(`/dashboard/total-lc/${lcId}/edit`);
  };

  const handleDeleteLC = (lcId: string, lcNumber?: string) => {
     if (!lcId) {
        Swal.fire("Error", "L/C ID is missing, cannot delete.", "error");
        return;
    }
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will permanently delete L/C "${lcNumber || lcId}" from Firestore.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "lc_entries", lcId));
          setAllLcEntries(prevLcEntries => prevLcEntries.filter(lc => lc.id !== lcId));
          Swal.fire(
            'Deleted!',
            `L/C "${lcNumber || lcId}" has been removed.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting L/C: ", error);
          Swal.fire("Error", `Could not delete L/C: ${error.message}`, "error");
        }
      }
    });
  };

  const handleOpenLink = (url?: string) => {
    if (url && url.trim() !== "") {
        try {
            new URL(url); // Validate URL
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (e) {
            Swal.fire("Invalid URL", "The provided URL is not valid.", "error");
        }
    } else {
      Swal.fire("No URL", "No URL provided to view.", "info");
    }
  };

  const clearFilters = () => {
    setFilterLcNumber('');
    setFilterApplicantId('');
    setFilterBeneficiaryId('');
    setFilterShipmentDate(null);
    setFilterStatus('');
    setFilterYear(new Date().getFullYear().toString());
    setSortBy('lcIssueDate');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(displayedLcEntries.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = displayedLcEntries.slice(indexOfFirstItem, indexOfLastItem);

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

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn(
                "font-bold text-2xl lg:text-3xl flex items-center gap-2",
                "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out"
              )}>
                <ListChecks className="h-7 w-7 text-primary" />
                Total T/T OR L/C Overview
              </CardTitle>
              <CardDescription>
                View, search, filter, and manage all Letters of Credit.
              </CardDescription>
            </div>
            <Link href="/dashboard/new-lc-entry" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" />
                New T/T OR L/C Entry
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4">
              <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter &amp; Sort Options</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                  <label htmlFor="lcNumberFilter" className="text-sm font-medium">T/T OR L/C Number</label>
                  <Input
                    id="lcNumberFilter"
                    placeholder="Search by L/C No..."
                    value={filterLcNumber}
                    onChange={(e) => setFilterLcNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="applicantFilter" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground"/>Applicant</label>
                  <Combobox
                    options={applicantOptions}
                    value={filterApplicantId}
                    onValueChange={setFilterApplicantId}
                    placeholder="Search Applicant..."
                    selectPlaceholder={isLoadingApplicants ? "Loading..." : "All Applicants"}
                    emptyStateMessage="No applicant found."
                    disabled={isLoadingApplicants}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="beneficiaryFilter" className="text-sm font-medium flex items-center"><Building className="mr-1 h-4 w-4 text-muted-foreground"/>Beneficiary</label>
                  <Combobox
                    options={beneficiaryOptions}
                    value={filterBeneficiaryId}
                    onValueChange={setFilterBeneficiaryId}
                    placeholder="Search Beneficiary..."
                    selectPlaceholder={isLoadingBeneficiaries ? "Loading..." : "All Beneficiaries"}
                    emptyStateMessage="No beneficiary found."
                    disabled={isLoadingBeneficiaries}
                  />
                </div>
                 <div className="space-y-1">
                  <label htmlFor="yearFilter" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground"/>Year</label>
                  <Select
                    value={filterYear === '' || filterYear === ALL_YEARS_VALUE ? ALL_YEARS_VALUE : filterYear}
                    onValueChange={(value) => setFilterYear(value === ALL_YEARS_VALUE ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearFilterOptions.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="shipmentDateFilter" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground"/>Latest Shipment Date (On/After)</label>
                  <DatePickerField
                    field={{ value: filterShipmentDate, onChange: setFilterShipmentDate, name: 'filterShipmentDate' }}
                    placeholder="Select Date"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="statusFilter" className="text-sm font-medium flex items-center"><CheckSquare className="mr-1 h-4 w-4 text-muted-foreground"/>Status</label>
                  <Select
                    value={filterStatus === '' ? ALL_STATUSES_VALUE : filterStatus}
                    onValueChange={(value) => setFilterStatus(value === ALL_STATUSES_VALUE ? '' : value as LCStatus | '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>
                      {lcStatusOptions.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                    <label htmlFor="sortBy" className="text-sm font-medium flex items-center"><ArrowDownUp className="mr-1 h-4 w-4 text-muted-foreground"/>Sort By</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {sortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-1">
                    <label htmlFor="sortOrder" className="text-sm font-medium">Order</label>
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
                    <XCircle className="mr-2 h-4 w-4" /> Clear Filters &amp; Sort
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2 sm:px-4">T/T OR L/C Number</TableHead>
                  <TableHead className="px-2 sm:px-4">Applicant</TableHead>
                  <TableHead className="px-2 sm:px-4">Beneficiary</TableHead>
                  <TableHead className="px-2 sm:px-4">Amount</TableHead>
                  <TableHead className="px-2 sm:px-4">Issue Date</TableHead>
                  <TableHead className="px-2 sm:px-4">Latest Shipment Date</TableHead>
                  <TableHead className="px-2 sm:px-4">Expire Date*</TableHead>
                  <TableHead className="px-2 sm:px-4">Status</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {isLoading ? (
                   <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center px-2 sm:px-4">
                       <div className="flex justify-center items-center">
                         <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading L/C entries...
                       </div>
                    </TableCell>
                  </TableRow>
                ) : fetchError ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-destructive px-2 sm:px-4">
                      {fetchError}
                    </TableCell>
                  </TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((lc) => (
                    <React.Fragment key={lc.id}>
                      <TableRow className="border-b-0">
                        <TableCell className="font-medium px-2 sm:px-4">{lc.documentaryCreditNumber || 'N/A'}</TableCell>
                        <TableCell className="px-2 sm:px-4">{lc.applicantName || 'N/A'}</TableCell>
                        <TableCell className="px-2 sm:px-4">{lc.beneficiaryName || 'N/A'}</TableCell>
                        <TableCell className="px-2 sm:px-4">{formatCurrencyValue(lc.currency, lc.amount)}</TableCell>
                        <TableCell className="px-2 sm:px-4">{formatDisplayDate(lc.lcIssueDate)}</TableCell>
                        <TableCell className="px-2 sm:px-4">{formatDisplayDate(lc.latestShipmentDate)}</TableCell>
                        <TableCell className="px-2 sm:px-4">{formatDisplayDate(lc.expireDate)}</TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge
                            variant={getStatusBadgeVariant(lc.status)}
                            className={
                              lc.status === 'Shipping going on' ? 'bg-orange-500 text-white dark:bg-orange-600 dark:text-white' :
                              lc.status === 'Payment Done' ? 'bg-green-500 text-white dark:bg-green-600' :
                              lc.status === 'Shipment Done' ? 'bg-green-600 text-white dark:bg-green-500 dark:text-black' :
                              lc.status === 'Shipment Pending' ? 'bg-yellow-500 text-black dark:bg-yellow-600 dark:text-black' :
                              lc.status === 'Draft' ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-700 dark:text-blue-100 dark:border-blue-500' : ''
                            }
                          >
                            {lc.status || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right px-2 sm:px-4">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" disabled={!lc.id}>
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => lc.id && handleEditLC(lc.id)}>
                                    <FileEdit className="mr-2 h-4 w-4" />
                                    <span>Edit</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => lc.id && handleDeleteLC(lc.id, lc.documentaryCreditNumber)}
                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Delete</span>
                                </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                      </TableRow>
                       <TableRow key={`${lc.id}-actions`}>
                         <TableCell colSpan={9} className="pt-0 pb-4 px-4 border-b border-border bg-muted/20">
                          <div className="flex flex-wrap justify-center items-center gap-2">
                             <Button
                                variant={ (lc.shipmentMode === "Sea" && lc.vesselImoNumber) || (lc.shipmentMode === "Air" && lc.flightNumber) ? "default" : "outline" }
                                size="sm"
                                onClick={() => {
                                  let url;
                                  if (lc.shipmentMode === "Sea" && lc.vesselImoNumber) {
                                    url = `https://www.vesselfinder.com/vessels/details/${lc.vesselImoNumber}`;
                                  } else if (lc.shipmentMode === "Air" && lc.flightNumber) {
                                    url = `https://www.flightradar24.com/${lc.flightNumber}`;
                                  }
                                  handleOpenLink(url);
                                }}
                                disabled={!((lc.shipmentMode === "Sea" && lc.vesselImoNumber) || (lc.shipmentMode === "Air" && lc.flightNumber))}
                                title={lc.shipmentMode === "Sea" ? "Track Vessel" : lc.shipmentMode === "Air" ? "Track Flight" : "Track Shipment"}
                            >
                                {lc.shipmentMode === "Sea" ? <Ship className="mr-1.5 h-3.5 w-3.5" /> : lc.shipmentMode === "Air" ? <Plane className="mr-1.5 h-3.5 w-3.5" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
                                {lc.shipmentMode === "Sea" ? "Vessel" : lc.shipmentMode === "Air" ? "Flight" : "Track"}
                            </Button>
                            <Button
                              variant={lc.trackingCourier && lc.trackingNumber ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                let trackUrl = "";
                                if (lc.trackingCourier === "DHL" && lc.trackingNumber) {
                                  trackUrl = `https://www.dhl.com/bd-en/home/tracking.html?tracking-id=${encodeURIComponent(lc.trackingNumber.trim())}&submit=1`;
                                } else if (lc.trackingCourier === "FedEx" && lc.trackingNumber) {
                                  trackUrl = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(lc.trackingNumber.trim())}`;
                                }
                                handleOpenLink(trackUrl || undefined);
                              }}
                              disabled={!lc.trackingCourier || !lc.trackingNumber}
                              title="Track Original Document"
                            >
                              {lc.trackingCourier === "DHL" ? <img src="/icons/dhl-logo.svg" alt="DHL" className="mr-1.5 h-3.5 w-auto" data-ai-hint="dhl logo" /> :
                               lc.trackingCourier === "FedEx" ? <img src="/icons/fedex-logo.svg" alt="FedEx" className="mr-1.5 h-3.5 w-auto" data-ai-hint="fedex logo" /> :
                               <PackageCheck className="mr-1.5 h-3.5 w-3.5" />}
                              {lc.trackingCourier ? lc.trackingCourier : "Docs"}
                            </Button>
                            <Button
                              variant={lc.finalLcUrl ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleOpenLink(lc.finalLcUrl)}
                              disabled={!lc.finalLcUrl}
                              title={lc.termsOfPay === 'T/T In Advance' ? 'View Final T/T Document' : 'View Final L/C Document'}
                            >
                              <FileText className="mr-1.5 h-3.5 w-3.5" />
                              {lc.termsOfPay === 'T/T In Advance' ? 'T/T' : 'L/C'}
                            </Button>
                            <Button
                              variant={lc.finalPIUrl ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleOpenLink(lc.finalPIUrl)}
                              disabled={!lc.finalPIUrl}
                              title="View Final Proforma Invoice"
                            >
                              <FileText className="mr-1.5 h-3.5 w-3.5" /> PI
                            </Button>
                            <Button
                              variant={lc.shippingDocumentsUrl ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleOpenLink(lc.shippingDocumentsUrl)}
                              disabled={!lc.shippingDocumentsUrl}
                              title="View Shipping Documents"
                            >
                              <FileText className="mr-1.5 h-3.5 w-3.5" /> Shipping
                            </Button>
                            <Button
                              variant={lc.packingListUrl ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleOpenLink(lc.packingListUrl)}
                              disabled={!lc.packingListUrl}
                              title="View Packing List"
                            >
                              <FileText className="mr-1.5 h-3.5 w-3.5" /> PL
                            </Button>
                            <Button
                              variant={lc.purchaseOrderUrl ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleOpenLink(lc.purchaseOrderUrl)}
                              disabled={!lc.purchaseOrderUrl}
                              title="View OCS / Purchase Order"
                            >
                              <FileText className="mr-1.5 h-3.5 w-3.5" /> OCS / Purchase Order
                            </Button>
                            <Link href={`/dashboard/total-lc/${lc.id}/edit`} passHref>
                                <Button
                                    variant={lc.isFirstShipment ? "default" : "outline"}
                                    size="icon"
                                    className={cn(
                                      "h-7 w-7 rounded-full p-0 text-xs",
                                      lc.isFirstShipment ? "bg-green-500 hover:bg-green-600 text-white" : "border-destructive text-destructive hover:bg-destructive/10"
                                    )}
                                    title="1st Shipment Status"
                                >
                                    1st
                                </Button>
                            </Link>
                            <Link href={`/dashboard/total-lc/${lc.id}/edit`} passHref>
                                <Button
                                    variant={lc.isSecondShipment ? "default" : "outline"}
                                    size="icon"
                                    className={cn(
                                      "h-7 w-7 rounded-full p-0 text-xs",
                                      lc.isSecondShipment ? "bg-green-500 hover:bg-green-600 text-white" : "border-destructive text-destructive hover:bg-destructive/10"
                                    )}
                                    title="2nd Shipment Status"
                                >
                                    2nd
                                </Button>
                            </Link>
                            <Link href={`/dashboard/total-lc/${lc.id}/edit`} passHref>
                                <Button
                                    variant={lc.isThirdShipment ? "default" : "outline"}
                                    size="icon"
                                    className={cn(
                                      "h-7 w-7 rounded-full p-0 text-xs",
                                      lc.isThirdShipment ? "bg-green-500 hover:bg-green-600 text-white" : "border-destructive text-destructive hover:bg-destructive/10"
                                    )}
                                    title="3rd Shipment Status"
                                >
                                    3rd
                                </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center px-2 sm:px-4">
                       No L/C entries found matching your criteria. Ensure Firestore rules allow reads and data exists.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your Letters of Credit from Firestore.
                Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedLcEntries.length)} of {displayedLcEntries.length} entries.
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
    
