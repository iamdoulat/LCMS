
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Loader2, ClipboardList, Info, AlertTriangle, FileEdit, Trash2, ChevronLeft, ChevronRight, PlusCircle, ExternalLink, FileText, Filter, XCircle, Users, Building, Hash, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import type { InstallationReportDocument, CustomerDocument, SupplierDocument } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, deleteDoc, doc, Timestamp, documentId } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid, addDays, isBefore, getYear, startOfDay } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from '@/context/AuthContext';

const ITEMS_PER_PAGE = 10;
const ALL_YEARS_VALUE = "__ALL_YEARS_INSTALL_REPORT__";
const ALL_APPLICANTS_VALUE = "__ALL_APPLICANTS_INSTALL_REPORT__";
const ALL_BENEFICIARIES_VALUE = "__ALL_BENEFICIARIES_INSTALL_REPORT__";

const currentSystemYear = new Date().getFullYear();
const yearFilterOptions = [ALL_YEARS_VALUE, ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];

const formatDisplayDate = (dateString?: string | null): string => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PPP') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const formatReportValue = (value: string | number | undefined | null, defaultValue: string = 'N/A'): string => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue;
  }
  return String(value);
};

export default function InstallationReportsViewPage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  const [allReports, setAllReports] = useState<InstallationReportDocument[]>([]);
  const [displayedReports, setDisplayedReports] = useState<InstallationReportDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [filterCommercialInvoiceNumber, setFilterCommercialInvoiceNumber] = useState('');
  const [filterApplicantId, setFilterApplicantId] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState('');
  const [filterLcNumber, setFilterLcNumber] = useState('');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());

  const [applicantOptions, setApplicantOptions] = useState<ComboboxOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = useState(true);

  useEffect(() => {
    const fetchReportsAndOptions = async () => {
      setIsLoading(true);
      setIsLoadingApplicants(true);
      setIsLoadingBeneficiaries(true);
      setFetchError(null);

      try {
        const reportsCollectionRef = collection(firestore, "installation_reports");
        const reportsQuery = query(reportsCollectionRef); // Fetch unordered, sort client-side to avoid index issues
        const reportsSnapshot = await getDocs(reportsQuery);
        const fetchedReports = reportsSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt && isValid(parseISO(data.createdAt)) ? parseISO(data.createdAt) : new Date(0));

          return {
            id: docSnap.id,
            ...data,
            createdAt: isValid(createdAt) ? format(createdAt, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : 'N/A',
            updatedAt: data.updatedAt instanceof Timestamp ? format(data.updatedAt.toDate(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : (data.updatedAt && isValid(parseISO(data.updatedAt)) ? format(parseISO(data.updatedAt), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : 'N/A'),
            invoiceDate: data.invoiceDate && data.invoiceDate.toDate ? data.invoiceDate.toDate().toISOString() : data.invoiceDate,
            commercialInvoiceDate: data.commercialInvoiceDate && data.commercialInvoiceDate.toDate ? data.commercialInvoiceDate.toDate().toISOString() : data.commercialInvoiceDate,
            etdDate: data.etdDate && data.etdDate.toDate ? data.etdDate.toDate().toISOString() : data.etdDate,
            etaDate: data.etaDate && data.etaDate.toDate ? data.etaDate.toDate().toISOString() : data.etaDate,
            packingListUrl: data.packingListUrl || undefined, // Ensure packingListUrl is explicitly handled
            installationDetails: data.installationDetails?.map((item: any) => ({
              ...item,
              installDate: item.installDate && item.installDate.toDate ? item.installDate.toDate().toISOString() : item.installDate,
            })) || [],
          } as InstallationReportDocument;
        });

        // Sort by createdAt descending (client-side)
        fetchedReports.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });

        setAllReports(fetchedReports);

        const customersSnapshot = await getDocs(collection(firestore, "customers"));
        setApplicantOptions(
          customersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as CustomerDocument).applicantName || 'Unnamed Applicant' }))
        );
        setIsLoadingApplicants(false);

        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
        setBeneficiaryOptions(
          suppliersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' }))
        );
        setIsLoadingBeneficiaries(false);

      } catch (error: any) {
        let errorMessage = `Could not fetch data. Please check Firestore rules. Error: ${error.message}`;
        if (error.code === 'permission-denied' || error.message?.toLowerCase().includes("permission")) {
          errorMessage = `Could not fetch data: Missing or insufficient permissions. Please check Firestore security rules for the 'installation_reports' collection.`;
        } else if (error.message?.toLowerCase().includes("index")) {
          errorMessage = `Could not fetch data: A Firestore index might be required. Please check your browser console for a link to create it automatically.`;
        }
        setFetchError(errorMessage);
        Swal.fire("Fetch Error", errorMessage, "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchReportsAndOptions();
  }, []);

  useEffect(() => {
    let filtered = [...allReports];

    if (filterCommercialInvoiceNumber) {
      filtered = filtered.filter(report =>
        report.commercialInvoiceNumber?.toLowerCase().includes(filterCommercialInvoiceNumber.toLowerCase())
      );
    }
    if (filterApplicantId && filterApplicantId !== ALL_APPLICANTS_VALUE) {
      filtered = filtered.filter(report => report.applicantId === filterApplicantId);
    }
    if (filterBeneficiaryId && filterBeneficiaryId !== ALL_BENEFICIARIES_VALUE) {
      filtered = filtered.filter(report => report.beneficiaryId === filterBeneficiaryId);
    }
    if (filterLcNumber) {
      filtered = filtered.filter(report =>
        report.documentaryCreditNumber?.toLowerCase().includes(filterLcNumber.toLowerCase())
      );
    }
    if (filterYear && filterYear !== ALL_YEARS_VALUE) {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(report => {
        if (report.commercialInvoiceDate) {
          try {
            const ciDate = parseISO(report.commercialInvoiceDate);
            return isValid(ciDate) && getYear(ciDate) === yearNum;
          } catch { return false; }
        }
        return false;
      });
    }

    setDisplayedReports(filtered);
    setCurrentPage(1);
  }, [allReports, filterCommercialInvoiceNumber, filterApplicantId, filterBeneficiaryId, filterLcNumber, filterYear]);

  const handleDeleteReport = (reportId: string, reportIdentifier?: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This will permanently delete the installation report "${reportIdentifier || reportId}". This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "installation_reports", reportId));
          setAllReports(prevReports => prevReports.filter(report => report.id !== reportId));
          Swal.fire('Deleted!', `Installation report "${reportIdentifier || reportId}" has been removed.`, 'success');
        } catch (error: any) {
          setFetchError(`Could not delete report: ${(error as Error).message}`);
          Swal.fire("Error", `Could not delete report: ${(error as Error).message}`, "error");
        }
      }
    });
  };

  const handleViewUrl = (url: string | undefined | null) => {
    if (url && url.trim() !== "") {
      try {
        new URL(url); window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) { Swal.fire("Invalid URL", "The provided URL is not valid.", "error"); }
    } else { Swal.fire("No URL", "No URL provided to view.", "info"); }
  };

  const clearFilters = () => {
    setFilterCommercialInvoiceNumber('');
    setFilterApplicantId('');
    setFilterBeneficiaryId('');
    setFilterLcNumber('');
    setFilterYear(ALL_YEARS_VALUE);
    setCurrentPage(1);
  };

  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = displayedReports.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(displayedReports.length / ITEMS_PER_PAGE);

  const handlePageChange = (pageNumber: number) => setCurrentPage(pageNumber);
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

  const getPageNumbers = () => {
    const pageNumbers = []; const maxPagesToShow = 5; const halfPagesToShow = Math.floor(maxPagesToShow / 2);
    if (totalPages <= maxPagesToShow + 2) { for (let i = 1; i <= totalPages; i++) pageNumbers.push(i); }
    else {
      pageNumbers.push(1); let startPage = Math.max(2, currentPage - halfPagesToShow); let endPage = Math.min(totalPages - 1, currentPage + halfPagesToShow);
      if (currentPage <= halfPagesToShow + 1) endPage = Math.min(totalPages - 1, maxPagesToShow);
      if (currentPage >= totalPages - halfPagesToShow) startPage = Math.max(2, totalPages - maxPagesToShow + 1);
      if (startPage > 2) pageNumbers.push("...");
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalPages - 1) pageNumbers.push("...");
      pageNumbers.push(totalPages);
    } return pageNumbers;
  };

  return (
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ClipboardList className="h-7 w-7 text-primary" />
                Installation Reports list
              </CardTitle>
              <CardDescription>
                Browse, filter, and manage existing installation reports.
                Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedReports.length)} of {displayedReports.length} entries.
              </CardDescription>
            </div>
            <Link href="/dashboard/warranty-management/new-installation-report" passHref>
              <Button disabled={isReadOnly}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Installation Report
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <Label htmlFor="ciNoFilter" className="text-sm font-medium">C.I. Number</Label>
                  <Input id="ciNoFilter" placeholder="Search by C.I. No..." value={filterCommercialInvoiceNumber} onChange={(e) => setFilterCommercialInvoiceNumber(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="lcNoFilter" className="text-sm font-medium">L/C Number</Label>
                  <Input id="lcNoFilter" placeholder="Search by L/C No..." value={filterLcNumber} onChange={(e) => setFilterLcNumber(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="applicantFilterInstall" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground" />Applicant</Label>
                  <Combobox
                    options={applicantOptions}
                    value={filterApplicantId || ALL_APPLICANTS_VALUE}
                    onValueChange={(value) => setFilterApplicantId(value === ALL_APPLICANTS_VALUE ? '' : value)}
                    placeholder="Search Applicant..."
                    selectPlaceholder={isLoadingApplicants ? "Loading..." : "All Applicants"}
                    emptyStateMessage="No applicant found."
                    disabled={isLoadingApplicants}
                  />
                </div>
                <div>
                  <Label htmlFor="beneficiaryFilterInstall" className="text-sm font-medium flex items-center"><Building className="mr-1 h-4 w-4 text-muted-foreground" />Beneficiary</Label>
                  <Combobox
                    options={beneficiaryOptions}
                    value={filterBeneficiaryId || ALL_BENEFICIARIES_VALUE}
                    onValueChange={(value) => setFilterBeneficiaryId(value === ALL_BENEFICIARIES_VALUE ? '' : value)}
                    placeholder="Search Beneficiary..."
                    selectPlaceholder={isLoadingBeneficiaries ? "Loading..." : "All Beneficiaries"}
                    emptyStateMessage="No beneficiary found."
                    disabled={isLoadingBeneficiaries}
                  />
                </div>
                <div>
                  <Label htmlFor="yearFilterInstall" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground" />Year (C.I. Date)</Label>
                  <Select value={filterYear} onValueChange={(value) => setFilterYear(value)}>
                    <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                    <SelectContent>
                      {yearFilterOptions.map(year => <SelectItem key={year} value={year}>{year === ALL_YEARS_VALUE ? "All Years" : year}</SelectItem>)}
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
              <p className="text-muted-foreground">Loading installation reports...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Reports</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: fetchError.replace(/\b(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary hover:underline">$1</a>') }}>
              </p>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Installation Reports Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no installation reports matching your criteria.
              </p>
            </div>
          ) : (
            <ul className="space-y-6">
              {currentItems.map((report) => {
                let reportExpiredCount = 0;
                let reportRemainingCount = 0;
                const today = startOfDay(new Date());
                report.installationDetails?.forEach(item => {
                  if (item.installDate) {
                    const installDateObj = parseISO(item.installDate);
                    if (isValid(installDateObj)) {
                      const expiryDate = addDays(installDateObj, 365);
                      if (isBefore(expiryDate, today)) {
                        reportExpiredCount++;
                      } else {
                        reportRemainingCount++;
                      }
                    }
                  }
                });

                return (
                  <li key={report.id} className="p-4 rounded-lg border hover:shadow-lg transition-shadow relative bg-card flex flex-col">
                    <div className="absolute top-3 right-3 flex gap-1 z-10">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="default" size="icon" className="h-7 w-7 bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                              <Link href={`/dashboard/warranty-management/edit-installation-report/${report.id}`}>
                                <FileEdit className="h-4 w-4" /> <span className="sr-only">Edit Report</span>
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>{isReadOnly ? 'View' : 'Edit'} Report</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleDeleteReport(report.id, report.commercialInvoiceNumber || report.documentaryCreditNumber)} disabled={isReadOnly}>
                              <Trash2 className="h-4 w-4" /> <span className="sr-only">Delete Report</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Delete Report</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div className="mb-2 text-sm pr-20">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <Link href={`/dashboard/warranty-management/edit-installation-report/${report.id}`} className="font-semibold text-primary hover:underline text-base">
                          C.I.: {formatReportValue(report.commercialInvoiceNumber)}
                        </Link>
                        {(report.commercialInvoiceNumber && report.commercialInvoiceDate) && (
                          <span className="text-xs text-muted-foreground">
                            (Date: {formatDisplayDate(report.commercialInvoiceDate)})
                          </span>
                        )}
                        <span className="font-medium text-foreground text-base">
                          L/C: {formatReportValue(report.documentaryCreditNumber)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 mb-1 text-sm">
                      <div><span className="text-muted-foreground">Applicant: </span><span className="font-medium text-foreground truncate" title={report.applicantName}>{formatReportValue(report.applicantName)}</span></div>
                      <div><span className="text-muted-foreground">Beneficiary: </span><span className="font-medium text-foreground truncate" title={report.beneficiaryName}>{formatReportValue(report.beneficiaryName)}</span></div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 text-sm mb-1">
                      <div><span className="text-muted-foreground">Total L/C Machine Qty: </span><span className="font-medium text-foreground">{formatReportValue(report.totalMachineQtyFromLC)}</span></div>
                      <div><span className="text-muted-foreground">Machine Installed: </span><span className="font-medium text-foreground">{formatReportValue(report.totalInstalledQty)}</span></div>
                      <div><span className="text-muted-foreground">Machine Pending: </span><span className={cn("font-bold", Number(report.pendingQty) > 0 ? "text-destructive" : "text-green-600")}>{formatReportValue(report.pendingQty)}</span></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 text-sm mt-1 mb-2">
                      <p><strong className="text-muted-foreground">Warranty Expired:</strong> <span className="font-medium text-destructive">{reportExpiredCount} sets</span></p>
                      <p><strong className="text-muted-foreground">Warranty Remaining:</strong> <span className="font-medium text-green-600">{reportRemainingCount} sets</span></p>
                    </div>

                    <div className="mt-auto pt-2 text-xs text-muted-foreground border-t border-dashed flex justify-between items-center">
                      {report.createdAt && (<span>Created: {isValid(parseISO(report.createdAt as string)) ? format(parseISO(report.createdAt as string), 'PPP p') : 'N/A'}</span>)}
                      <Button variant="default" size="sm" className="h-7 px-2 py-1 text-xs" onClick={() => handleViewUrl(report.packingListUrl)} disabled={!report.packingListUrl}>
                        <FileText className="mr-1.5 h-3 w-3" /> Packing List
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4 mt-6">
              <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (
                  <Button key={`report-page-${page}`} variant={currentPage === page ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(page)} className="w-9 h-9 p-0">{page}</Button>
                ) : (<span key={`ellipsis-report-${index}`} className="px-2 py-1 text-sm">{page}</span>)
              )}
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}





