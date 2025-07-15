
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, PackageCheck, Info, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight, CalendarDays, Filter, XCircle, Users, Building, Hash } from 'lucide-react';
import type { LCEntryDocument, LCStatus, Currency, CustomerDocument, SupplierDocument } from '@/types'; 
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp, orderBy as firestoreOrderBy } from 'firebase/firestore';
import Link from 'next/link';
import { format, parseISO, isValid, getYear } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CompletedLC extends LCEntryDocument {
  updatedAtDate: Date;
}

const ITEMS_PER_PAGE = 10;
const ALL_YEARS_VALUE = "__ALL_YEARS_SHIPMENT_DONE__";
const PLACEHOLDER_APPLICANT_VALUE = "__ALL_APPLICANTS_SHIPMENT_DONE__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__ALL_BENEFICIARIES_SHIPMENT_DONE__";

const currentSystemYear = new Date().getFullYear();
const yearFilterOptions = [ALL_YEARS_VALUE, ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];


const getStatusBadgeVariant = (status: LCStatus): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case 'Draft':
      return 'outline';
    case 'Transmitted':
      return 'secondary';
    case 'Shipment Pending':
      return 'default';
    case 'Payment Pending':
      return 'destructive';
    case 'Payment Done':
      return 'default';
    case 'Shipment Done':
      return 'default';
    default:
      return 'outline';
  }
};

const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PPP') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (currency?: Currency | string, amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currency || ''} N/A`;
  return `${currency || ''} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};


export default function ShipmentDonePage() {
  const [allCompletedLCs, setAllCompletedLCs] = useState<CompletedLC[]>([]);
  const [displayedCompletedLCs, setDisplayedCompletedLCs] = useState<CompletedLC[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter states
  const [filterLcNumber, setFilterLcNumber] = useState('');
  const [filterApplicantId, setFilterApplicantId] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState('');
  const [filterYear, setFilterYear] = useState<string>(ALL_YEARS_VALUE);

  const [applicantOptions, setApplicantOptions] = useState<ComboboxOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = useState(true);


  useEffect(() => {
    const fetchCompletedLCs = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const lcEntriesRef = collection(firestore, "lc_entries");
        const q = query(lcEntriesRef, where("status", "array-contains", "Shipment Done"), firestoreOrderBy("updatedAt", "desc"));
        const querySnapshot = await getDocs(q);

        const fetchedLCs = querySnapshot.docs.map(doc => {
          const data = doc.data() as Omit<LCEntryDocument, 'id'>;
          let updatedAtDate = new Date(0);

          if (data.updatedAt) {
            if (typeof (data.updatedAt as unknown as Timestamp).toDate === 'function') {
              updatedAtDate = (data.updatedAt as unknown as Timestamp).toDate();
            } else if (typeof data.updatedAt === 'string') {
              const parsed = parseISO(data.updatedAt);
              if (isValid(parsed)) {
                updatedAtDate = parsed;
              }
            }
          }

          return {
            ...data,
            id: doc.id,
            updatedAtDate: updatedAtDate,
          };
        });
        setAllCompletedLCs(fetchedLCs as CompletedLC[]);
      } catch (error: any) {
        console.error("Error fetching completed L/Cs: ", error);
        let errorMessage = `Could not fetch completed L/C data. Please ensure Firestore rules allow reads.`;
        if (error.message && error.message.includes("indexes?create_composite")) {
            errorMessage = `Could not fetch completed L/C data: A Firestore index is required. Please check the browser console for a link to create the index, or create it manually for the 'lc_entries' collection on 'status' (array-contains) and 'updatedAt' (descending).`;
        } else if (error.message) {
            errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire({
          title: "Fetch Error",
          html: errorMessage.replace(/\b(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary hover:underline">$1</a>'),
          icon: "error",
        });
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
        console.error("Error fetching filter options for Shipment Done page:", error);
        Swal.fire("Error", `Could not load filter options. Error: ${(error as Error).message}`, "error");
      } finally {
        setIsLoadingApplicants(false);
        setIsLoadingBeneficiaries(false);
      }
    };

    fetchCompletedLCs();
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    let filtered = [...allCompletedLCs];

    if (filterLcNumber) {
      filtered = filtered.filter(lc => lc.documentaryCreditNumber?.toLowerCase().includes(filterLcNumber.toLowerCase()));
    }
    if (filterApplicantId && filterApplicantId !== PLACEHOLDER_APPLICANT_VALUE) {
      filtered = filtered.filter(lc => lc.applicantId === filterApplicantId);
    }
    if (filterBeneficiaryId && filterBeneficiaryId !== PLACEHOLDER_BENEFICIARY_VALUE) {
      filtered = filtered.filter(lc => lc.beneficiaryId === filterBeneficiaryId);
    }
    if (filterYear && filterYear !== ALL_YEARS_VALUE) {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(lc => {
        return lc.year === yearNum;
      });
    }

    setDisplayedCompletedLCs(filtered);
    setCurrentPage(1);
  }, [allCompletedLCs, filterLcNumber, filterApplicantId, filterBeneficiaryId, filterYear]);


  const clearFilters = () => {
    setFilterLcNumber('');
    setFilterApplicantId('');
    setFilterBeneficiaryId('');
    setFilterYear(ALL_YEARS_VALUE);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(displayedCompletedLCs.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = displayedCompletedLCs.slice(indexOfFirstItem, indexOfLastItem);

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
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <PackageCheck className="h-7 w-7 text-primary" />
            Shipment Done
          </CardTitle>
          <CardDescription>
            List of Letters of Credit marked as "Shipment Done", sorted by most recent completion date.
            Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedCompletedLCs.length)} of {displayedCompletedLCs.length} entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4">
              <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <Label htmlFor="lcNoFilterShipmentDone" className="text-sm font-medium">L/C Number</Label>
                  <Input id="lcNoFilterShipmentDone" placeholder="Search by L/C No..." value={filterLcNumber} onChange={(e) => setFilterLcNumber(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="applicantFilterShipmentDone" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground"/>Applicant</Label>
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
                <div>
                  <Label htmlFor="beneficiaryFilterShipmentDone" className="text-sm font-medium flex items-center"><Building className="mr-1 h-4 w-4 text-muted-foreground"/>Beneficiary</Label>
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
                <div>
                  <Label htmlFor="yearFilterShipmentDone" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground"/>Year (L/C Issue)</Label>
                  <Select value={filterYear} onValueChange={(value) => setFilterYear(value)}>
                    <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                    <SelectContent>
                      {yearFilterOptions.map(yearOpt => <SelectItem key={yearOpt} value={yearOpt}>{yearOpt === ALL_YEARS_VALUE ? "All Years" : yearOpt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="lg:col-span-4 md:col-span-2">
                  <Button onClick={clearFilters} variant="outline" className="w-full md:w-auto">
                    <XCircle className="mr-2 h-4 w-4" /> Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading completed L/Cs from database...</p>
            </div>
          ) : fetchError ? (
             <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap"
                 dangerouslySetInnerHTML={{ __html: fetchError.replace(/\b(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary hover:underline">$1</a>') }}>
              </p>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No L/Cs Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no L/Cs currently marked as "Shipment Done" matching your criteria, or the required Firestore index is missing/still building.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {currentItems.map((lc) => (
                <li key={lc.id} className="p-4 rounded-lg border hover:shadow-md transition-shadow relative bg-card">
                  <div className="absolute top-4 right-4 flex flex-col items-end space-y-1 z-10">
                    <div className="flex flex-wrap gap-1 justify-end">
                       {Array.isArray(lc.status) ? (
                            lc.status.map(s => (
                                <Badge
                                    key={s}
                                    variant={getStatusBadgeVariant(s)}
                                    className={s === 'Shipment Done' ? 'bg-green-600 text-white dark:bg-green-500 dark:text-black' : ''}
                                >
                                    {s}
                                </Badge>
                            ))
                        ) : lc.status ? (
                            <Badge
                                variant={getStatusBadgeVariant(lc.status as LCStatus)}
                                className={(lc.status as LCStatus) === 'Shipment Done' ? 'bg-green-600 text-white dark:bg-green-500 dark:text-black' : ''}
                            >
                                {lc.status}
                            </Badge>
                        ) : (
                            <Badge variant="outline">N/A</Badge>
                        )}
                    </div>
                    <div className="flex gap-1.5">
                      {[
                        { flag: lc.isFirstShipment, label: "1st", note: lc.firstShipmentNote },
                        { flag: lc.isSecondShipment, label: "2nd", note: lc.secondShipmentNote },
                        { flag: lc.isThirdShipment, label: "3rd", note: lc.thirdShipmentNote }
                      ].map((shipment, idx) => (
                        <TooltipProvider key={idx} delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={`/dashboard/total-lc/${lc.id}/edit`} passHref>
                                  <Button
                                      variant={shipment.flag ? "default" : "outline"}
                                      size="icon"
                                      className={cn(
                                          "h-7 w-7 rounded-full p-0 text-xs font-bold",
                                          shipment.flag ? "bg-green-500 hover:bg-green-600 text-white" : "border-destructive text-destructive hover:bg-destructive/10"
                                      )}
                                      title={`${shipment.label} Shipment Status`}
                                  >
                                      {shipment.label}
                                  </Button>
                              </Link>
                            </TooltipTrigger>
                            {shipment.note && (
                              <TooltipContent side="top">
                                <p className="max-w-xs">{shipment.note}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </div>

                  <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="font-semibold text-primary hover:underline text-lg mb-1 block truncate pr-28">
                    {lc.documentaryCreditNumber || 'N/A'}
                  </Link>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1 text-sm mb-1">
                    <p className="text-muted-foreground md:col-span-1">
                      Applicant: <span className="font-medium text-foreground truncate">{lc.applicantName || 'N/A'}</span>
                    </p>
                     <p className="text-muted-foreground md:col-span-1">
                      Value: <span className="font-medium text-foreground">{formatCurrencyValue(lc.currency, lc.amount)}</span>
                    </p>
                     <p className="text-muted-foreground md:col-span-1">
                      Issued: <span className="font-medium text-foreground">{formatDisplayDate(lc.lcIssueDate)}</span>
                    </p>
                  </div>
                  <div className="text-sm mb-1">
                    <p className="text-muted-foreground">
                      Beneficiary: <span className="font-medium text-foreground truncate">{lc.beneficiaryName || 'N/A'}</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm mb-1">
                    <p className="text-muted-foreground">
                       ETD: <span className="font-medium text-foreground">{formatDisplayDate(lc.etd)}</span>
                    </p>
                    <p className="text-muted-foreground">
                       ETA: <span className="font-medium text-foreground">{formatDisplayDate(lc.eta)}</span>
                    </p>
                  </div>
                  <div className="mt-2 flex justify-end">
                     <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="text-xs text-primary hover:underline inline-flex items-center">
                        View L/C Details <ExternalLink className="ml-1 h-3 w-3"/>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4 mt-4">
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
                  <span key={`ellipsis-completed-${index}`} className="px-2 py-1 text-sm">
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
