
"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form'; // Import useForm
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListChecks, FileEdit, Trash2, Search, Filter, XCircle, ChevronLeft, ChevronRight, PlusCircle, MoreHorizontal, ShieldAlert, Landmark, CalendarClock, Ship, Plane } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import type { LCEntryDocument, LCStatus, CustomerDocument, SupplierDocument, Currency } from '@/types';
import { lcStatusOptions, termsOfPayOptions } from '@/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';
import { collection, getDocs, deleteDoc, doc, query, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { useAuth } from '@/context/AuthContext';

import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form } from '@/components/ui/form';
import { Label } from '@/components/ui/label';



const getStatusBadgeVariant = (status: LCStatus): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case 'Draft': return 'outline';
    case 'Transmitted': return 'secondary';
    case 'Shipment Pending': return 'default';
    case 'Payment Pending': return 'destructive';
    case 'Payment Done': return 'default';
    case 'Shipment Done': return 'default';
    default: return 'outline';
  }
};

const formatDisplayDate = (dateString?: string) => {
  if (!dateString || !isValid(parseISO(dateString))) return 'N/A';
  try {
    const date = parseISO(dateString);
    return format(date, 'MMM do, yyyy');
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (currency?: Currency | string, amount?: number) => {
  const currencyCode = typeof currency === 'string' ? currency : (currency?.code || '');
  if (typeof amount !== 'number' || isNaN(amount)) return `${currencyCode} N/A`;
  return `${currencyCode} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const ALL_YEARS_VALUE = "__ALL_YEARS__";
const ALL_STATUSES_VALUE = "__ALL_STATUSES__";
const ALL_TERMS_VALUE = "__ALL_TERMS_OF_PAY__";
const ITEMS_PER_PAGE = 10;

const currentSystemYear = new Date().getFullYear();
const yearFilterOptions = [ALL_YEARS_VALUE, ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];



async function getInitialReportData() {
  const lcQuery = query(collection(firestore, "lc_entries"), firestoreOrderBy("createdAt", "desc"));
  const customersQuery = query(collection(firestore, "customers"));
  const suppliersQuery = query(collection(firestore, "suppliers"));

  const [lcSnapshot, customersSnapshot, suppliersSnapshot] = await Promise.all([
    getDocs(lcQuery),
    getDocs(customersQuery),
    getDocs(suppliersQuery)
  ]);

  const allLcEntries = lcSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LCEntryDocument));
  const applicantOptions = customersSnapshot.docs.map(doc => ({ value: doc.id, label: (doc.data() as CustomerDocument).applicantName || 'Unnamed Applicant' }));
  const beneficiaryOptions = suppliersSnapshot.docs.map(doc => ({ value: doc.id, label: (doc.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' }));

  return { allLcEntries, applicantOptions, beneficiaryOptions };
}

const TableSkeleton = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <React.Fragment key={i}>
        <TableRow className="border-b-0">
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-32" /></TableCell>
          <TableCell><Skeleton className="h-5 w-32" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
        </TableRow>
        <TableRow key={`${i}-actions`} className="bg-muted/20">
          <TableCell colSpan={8} className="py-2 px-4">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          </TableCell>
        </TableRow>
      </React.Fragment>
    ))}
  </>
);


export default function TotalLCPage() {
  const router = useRouter();
  const { user, userRole, loading: authLoading } = useAuth();

  const [isReadOnly, setIsReadOnly] = React.useState(true);

  const [allLcEntries, setAllLcEntries] = useState<LCEntryDocument[]>([]);
  const [displayedLcEntries, setDisplayedLcEntries] = useState<LCEntryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterLcNumber, setFilterLcNumber] = useState('');
  const [filterApplicantId, setFilterApplicantId] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState('');
  const [filterStatus, setFilterStatus] = useState<LCStatus | ''>('Shipment Pending');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterTermsOfPay, setFilterTermsOfPay] = useState<string>('');


  const [applicantOptions, setApplicantOptions] = useState<DropdownOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = useState<DropdownOption[]>([]);


  const [sortBy, setSortBy] = useState<string>('lcIssueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const filterForm = useForm();



  useEffect(() => {
    const canView = userRole?.some(role => ['Super Admin', 'Admin', 'Viewer', 'Commercial'].includes(role));
    if (!authLoading && !canView && userRole !== null) {
      setFetchError("You do not have permission to view this data.");
      setIsLoading(false);
      return;
    }

    setIsReadOnly(userRole?.includes('Viewer') ?? true);

    if (!authLoading && user) {
      const fetchInitialData = async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
          const { allLcEntries: fetchedLCs, applicantOptions: fetchedApplicants, beneficiaryOptions: fetchedBeneficiaries } = await getInitialReportData();
          setAllLcEntries(fetchedLCs);
          setApplicantOptions(fetchedApplicants);
          setBeneficiaryOptions(fetchedBeneficiaries);
        } catch (error: any) {
          console.error("Error fetching L/C entries: ", error);
          let errorMsg = `Could not fetch L/C data. Ensure you have the necessary permissions.`;
          if (error.code === 'permission-denied') {
            errorMsg = "Permission denied. You do not have access to view this data.";
          } else if (error.message) {
            errorMsg += ` Error: ${error.message}`;
          }
          setFetchError(errorMsg);
          Swal.fire("Error", errorMsg, "error");
        } finally {
          setIsLoading(false);
        }
      };

      fetchInitialData();
    }
  }, [userRole, authLoading, user]);

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

    if (filterStatus) {
      filtered = filtered.filter(lc => Array.isArray(lc.status) ? lc.status.includes(filterStatus) : lc.status === filterStatus);
    }

    if (filterYear && filterYear !== ALL_YEARS_VALUE) {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(lc => lc.year === yearNum);
    }
    if (filterTermsOfPay && filterTermsOfPay !== ALL_TERMS_VALUE) {
      filtered = filtered.filter(lc => lc.termsOfPay === filterTermsOfPay);
    }

    if (sortBy) {
      filtered.sort((a, b) => {
        let valA = (a as any)[sortBy]; let valB = (b as any)[sortBy];
        if (sortBy.includes('Date') && typeof valA === 'string' && typeof valB === 'string') {
          try { valA = parseISO(valA); valB = parseISO(valB); } catch { }
        }
        if (sortBy === 'amount' || sortBy === 'year') { valA = Number(valA) || 0; valB = Number(valB) || 0; }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setDisplayedLcEntries(filtered);
    setCurrentPage(1);
  }, [allLcEntries, filterLcNumber, filterApplicantId, filterBeneficiaryId, filterStatus, filterYear, filterTermsOfPay, sortBy, sortOrder]);

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
        new URL(url);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        Swal.fire("Invalid URL", "The provided URL is not valid.", "error");
      }
    } else {
      Swal.fire("No URL", "No URL provided to view.", "info");
    }
  };

  const clearFilters = () => {
    setFilterLcNumber(''); setFilterApplicantId(''); setFilterBeneficiaryId('');
    setFilterStatus('Shipment Pending');
    setFilterYear(new Date().getFullYear().toString());
    setFilterTermsOfPay('');
    setSortBy('lcIssueDate'); setSortOrder('desc');
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

  const getShipmentTermLabel = (term?: string) => {
    if (!term) return null;
    if (term.includes("CFR")) return "CFR";
    if (term.includes("CPT")) return "CPT";
    if (term === "FOB") return "FOB";
    if (term === "EXW") return "EXW";
    return null;
  };

  return (
    <div className="m-[10px] p-0 md:container md:mx-auto md:py-8 md:px-5">
      <Card className="shadow-xl">
        <CardHeader className="noprint">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn(
                "font-bold text-2xl lg:text-3xl flex items-center gap-2",
                "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out"
              )}>
                <ListChecks className="h-7 w-7 text-primary" />
                Total T/T OR L/C List
              </CardTitle>
              <CardDescription>
                View, manage, and filter all Letters of Credit.
              </CardDescription>
            </div>
            <Link href="/dashboard/new-lc-entry" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isReadOnly}>
                <PlusCircle className="mr-2 h-5 w-5" />
                New T/T OR L/C Entry
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {fetchError ? (
            <Alert variant="destructive" className="mb-6">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Access Denied</AlertTitle>
              <AlertDescription>{fetchError}</AlertDescription>
            </Alert>
          ) : (
            <div>
              <Card className="mb-6 shadow-md p-4 noprint">
                <CardHeader className="p-2 pb-4">
                  <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter &amp; Sort Options</CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-4">
                  <Form {...filterForm}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
                      <div className="space-y-1">
                        <Label htmlFor="lcNumberFilter">T/T OR L/C Number</Label>
                        <Input
                          id="lcNumberFilter"
                          placeholder="Search by L/C No..."
                          value={filterLcNumber}
                          onChange={(e) => setFilterLcNumber(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="applicantFilter">Applicant</Label>
                        <Combobox options={applicantOptions} value={filterApplicantId} onValueChange={setFilterApplicantId} placeholder="Search Applicant..." selectPlaceholder={isLoading ? "Loading..." : "All Applicants"} emptyStateMessage="No applicant found." disabled={isLoading} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="beneficiaryFilter">Beneficiary</Label>
                        <Combobox options={beneficiaryOptions} value={filterBeneficiaryId} onValueChange={setFilterBeneficiaryId} placeholder="Search Beneficiary..." selectPlaceholder={isLoading ? "Loading..." : "All Beneficiaries"} emptyStateMessage="No beneficiary found." disabled={isLoading} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="yearFilter">Year</Label>
                        <Select
                          value={filterYear === '' ? ALL_YEARS_VALUE : filterYear}
                          onValueChange={(v) => setFilterYear(v === ALL_YEARS_VALUE ? '' : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All Years" />
                          </SelectTrigger>
                          <SelectContent>
                            {yearFilterOptions.map(y => (
                              <SelectItem key={y} value={y}>
                                {y === ALL_YEARS_VALUE ? "All Years" : y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="termsOfPayFilter">Terms of Pay</Label>
                        <Select value={filterTermsOfPay === '' ? ALL_TERMS_VALUE : filterTermsOfPay} onValueChange={(value) => setFilterTermsOfPay(value === ALL_TERMS_VALUE ? '' : value)}>
                          <SelectTrigger id="termsOfPayFilter">
                            <SelectValue placeholder="All Terms" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_TERMS_VALUE}>All Terms</SelectItem>
                            {termsOfPayOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="statusFilter">Status</Label>
                        <Select
                          value={filterStatus === '' ? ALL_STATUSES_VALUE : filterStatus}
                          onValueChange={(v) => setFilterStatus(v === ALL_STATUSES_VALUE ? '' : v as LCStatus | '')}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All Statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>
                            {lcStatusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="sortBy">Sort By</Label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{sortOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="pt-6">
                        <Button onClick={clearFilters} variant="outline" className="w-full"><XCircle className="mr-2 h-4 w-4" /> Clear Filters &amp; Sort</Button>
                      </div>
                    </div>
                  </Form>
                </CardContent>
              </Card>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-2 sm:px-4">T/T OR L/C Number</TableHead>
                      <TableHead className="px-2 sm:px-4">Applicant</TableHead>
                      <TableHead className="px-2 sm:px-4">Beneficiary</TableHead>
                      <TableHead className="px-2 sm:px-4">Amount</TableHead>
                      <TableHead className="px-2 sm:px-4">Issue Date</TableHead>
                      <TableHead className="px-2 sm:px-4">Expire Date</TableHead>
                      <TableHead className="px-2 sm:px-4">Status</TableHead>
                      <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableSkeleton />
                    ) : currentItems.length > 0 ? (
                      currentItems.map((lc) => {
                        const isDeferredPayment = lc.termsOfPay && lc.termsOfPay.startsWith("Deferred");
                        return (
                          <React.Fragment key={lc.id}>
                            <TableRow className="border-b-0">
                              <TableCell className="font-medium px-2 sm:px-4">{lc.documentaryCreditNumber || 'N/A'}</TableCell>
                              <TableCell className="px-2 sm:px-4">{lc.applicantName || 'N/A'}</TableCell>
                              <TableCell className="px-2 sm:px-4">{lc.beneficiaryName || 'N/A'}</TableCell>
                              <TableCell className="px-2 sm:px-4">{formatCurrencyValue(lc.currency, lc.amount)}</TableCell>
                              <TableCell className="px-2 sm:px-4">{formatDisplayDate(lc.lcIssueDate)}</TableCell>
                              <TableCell className="px-2 sm:px-4">{formatDisplayDate(lc.expireDate)}</TableCell>
                              <TableCell className="px-2 sm:px-4">
                                <div className="flex flex-wrap gap-1">
                                  {Array.isArray(lc.status) ? (
                                    lc.status.map(s => (
                                      <Badge
                                        key={s}
                                        variant={getStatusBadgeVariant(s)}
                                        className={
                                          s === 'Payment Pending' ? 'bg-amber-500 text-black dark:bg-amber-600' :
                                            s === 'Payment Done' ? 'bg-green-500 text-white dark:bg-green-600' :
                                              s === 'Shipment Done' ? 'bg-green-600 text-white dark:bg-green-500 dark:text-black' :
                                                s === 'Shipment Pending' ? 'bg-yellow-500 text-black dark:bg-yellow-600 dark:text-black' :
                                                  s === 'Draft' ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-700 dark:text-blue-100 dark:border-blue-500' : ''
                                        }
                                      >
                                        {s}
                                      </Badge>
                                    ))
                                  ) : lc.status ? (
                                    <Badge
                                      variant={getStatusBadgeVariant(lc.status as LCStatus)}
                                      className={
                                        lc.status === 'Payment Pending' ? 'bg-amber-500 text-black dark:bg-amber-600' :
                                          lc.status === 'Payment Done' ? 'bg-green-500 text-white dark:bg-green-600' :
                                            lc.status === 'Shipment Done' ? 'bg-green-600 text-white dark:bg-green-500 dark:text-black' :
                                              lc.status === 'Shipment Pending' ? 'bg-yellow-500 text-black dark:bg-yellow-600 dark:text-black' :
                                                lc.status === 'Draft' ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-700 dark:text-blue-100 dark:border-blue-500' : ''
                                      }
                                    >
                                      {lc.status}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">N/A</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right px-2 sm:px-4">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button className="h-8 w-8 p-0" disabled={!lc.id || isReadOnly}>
                                      <span className="sr-only">Open menu</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => lc.id && handleEditLC(lc.id)}>
                                      <FileEdit className="mr-2 h-4 w-4" />
                                      <span>{isReadOnly ? "View" : "Edit"}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => lc.id && handleDeleteLC(lc.id, lc.documentaryCreditNumber)}
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
                            <TableRow key={`${lc.id}-actions`} className="bg-muted/20">
                              <TableCell colSpan={8} className="py-2 px-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  {lc.shipmentTerms && getShipmentTermLabel(lc.shipmentTerms) && (
                                    <Button variant="outline" size="sm" className="h-7 cursor-default">
                                      <Ship className="mr-1.5 h-3.5 w-3.5" /> {getShipmentTermLabel(lc.shipmentTerms)}
                                    </Button>
                                  )}
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" size="sm" className={"h-7"}>
                                        <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                                        ETD/ETA
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-2">
                                      <div className="space-y-1 text-sm">
                                        <p><strong>ETD:</strong> {formatDisplayDate(lc.etd)}</p>
                                        <p><strong>ETA:</strong> {formatDisplayDate(lc.eta)}</p>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                  {isDeferredPayment && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-7 cursor-default">
                                          <Landmark className="mr-1.5 h-3.5 w-3.5" /> Maturity
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-2">
                                        <p className="text-sm font-medium">{lc.paymentMaturityDate || "Not Specified"}</p>
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                  <Button variant="outline" size="sm" asChild className="h-7" title="Track Original Document" disabled={!lc.trackingCourier || !lc.trackingNumber}>
                                    <a href={lc.trackingCourier === "DHL" ? `https://www.dhl.com/bd-en/home/tracking.html?tracking-id=${encodeURIComponent(String(lc.trackingNumber || '').trim())}&submit=1` : lc.trackingCourier === "FedEx" ? `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(String(lc.trackingNumber || '').trim())}` : lc.trackingCourier === "UPS" ? `https://www.ups.com/track?track=yes&trackNums=${encodeURIComponent(String(lc.trackingNumber || '').trim())}` : '#'} target="_blank" rel="noopener noreferrer" >
                                      <Search className="mr-1.5 h-3.5 w-3.5" />
                                      {lc.trackingCourier || "Track Docs"}
                                    </a>
                                  </Button>
                                  <Button variant="outline" size="sm" asChild className="h-7" disabled={!(lc.vesselImoNumber || lc.flightNumber)}>
                                    <a href={lc.shipmentMode === 'Air' && lc.flightNumber ? `https://www.flightradar24.com/${lc.flightNumber}` : `https://www.vesselfinder.com/vessels/details/${lc.vesselImoNumber}`} target="_blank" rel="noopener noreferrer" title={lc.shipmentMode === 'Air' ? 'Track Flight' : 'Track Vessel'}>
                                      {lc.shipmentMode === 'Air' ? <Plane className="mr-1.5 h-3.5 w-3.5" /> : <Ship className="mr-1.5 h-3.5 w-3.5" />}
                                      {lc.shipmentMode === 'Air' ? 'Air' : 'Vessel'}
                                    </a>
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => handleOpenLink(lc.finalLcUrl)} disabled={!lc.finalLcUrl} title={lc.termsOfPay === 'T/T In Advance' ? 'View Final T/T Document' : 'View Final L/C Document'} className="h-7">
                                    {lc.termsOfPay === 'T/T In Advance' ? 'T/T' : 'L/C'}
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => handleOpenLink(lc.finalPIUrl)} disabled={!lc.finalPIUrl} title="View Final Proforma Invoice" className="h-7">PI</Button>
                                  <Button variant="outline" size="sm" onClick={() => handleOpenLink(lc.shippingDocumentsUrl)} disabled={!lc.shippingDocumentsUrl} title="View Shipping Documents" className="h-7">DOC</Button>
                                  <Button variant="outline" size="sm" onClick={() => handleOpenLink(lc.packingListUrl)} disabled={!lc.packingListUrl} title="View Packing List" className="h-7">PL</Button>
                                  <Button variant="outline" size="sm" onClick={() => handleOpenLink(lc.purchaseOrderUrl)} disabled={!lc.purchaseOrderUrl} title="View OCS / Purchase Order" className="h-7">OCS/PO</Button>
                                  <div className="flex gap-1.5">
                                    {[
                                      { flag: lc.isFirstShipment, label: "1st", note: lc.firstShipmentNote },
                                      { flag: lc.isSecondShipment, label: "2nd", note: lc.secondShipmentNote },
                                      { flag: lc.isThirdShipment, label: "3rd", note: lc.thirdShipmentNote }
                                    ].map((shipment, idx) => (
                                      shipment.label && (
                                        <Popover key={idx}>
                                          <PopoverTrigger asChild>
                                            <Button
                                              variant={shipment.flag ? "default" : "outline"}
                                              size="icon"
                                              className={cn(
                                                "h-7 w-7 rounded-full p-0 text-xs font-bold",
                                                shipment.flag ? "bg-green-500 hover:bg-green-600 text-white" : "border-destructive text-destructive hover:bg-destructive/10"
                                              )}
                                            >
                                              {shipment.label}
                                            </Button>
                                          </PopoverTrigger>
                                          {shipment.note && (
                                            <PopoverContent className="w-auto max-w-sm p-2 text-sm" side="top">
                                              {shipment.note}
                                            </PopoverContent>
                                          )}
                                        </Popover>
                                      )
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center px-2 sm:px-4">
                          No L/C entries found matching your criteria.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  <TableCaption className="py-4">
                    A list of your L/C data from database.
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
                      <span key={`ellipsis-${index}`} className="px-2 py-1 text-sm">{page}</span>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

































