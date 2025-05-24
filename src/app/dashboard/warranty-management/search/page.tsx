
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, Layers, Wrench, Hourglass, ShieldCheck, ShieldOff, BarChart3, CalendarDays, Microscope, Loader2, Info, AlertTriangle, ChevronLeft, ChevronRight, FileEdit, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import { StatCard } from '@/components/dashboard/StatCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, Timestamp, orderBy } from 'firebase/firestore'; // Added orderBy
import type { InstallationReportDocument } from '@/types';
import { format, parseISO, isValid, getYear, addDays, isBefore } from 'date-fns';

const currentSystemYear = new Date().getFullYear();
const yearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];

const ITEMS_PER_PAGE = 5; // For search results pagination

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


export default function WarrantySearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [displayedSearchTerm, setDisplayedSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>("All Years");

  const [allReports, setAllReports] = useState<InstallationReportDocument[]>([]);
  const [searchResults, setSearchResults] = useState<InstallationReportDocument[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [currentSearchPage, setCurrentSearchPage] = useState(1);

  const [warrantyStats, setWarrantyStats] = useState({
    totalLcMachineries: 0,
    totalInstalledMachines: 0,
    totalPendingMachines: 0,
    machinesUnderWarranty: 0,
    machinesOutOfWarranty: 0,
  });

  const fetchAndCalculateStats = useCallback(async (year: string) => {
    setIsLoadingStats(true);
    setStatsError(null);
    try {
      const reportsCollectionRef = collection(firestore, "installation_reports");
      const reportsQuery = query(reportsCollectionRef, orderBy("createdAt", "desc")); // Fetch all for client-side year filter
      const reportsSnapshot = await getDocs(reportsQuery);
      const fetchedReports = reportsSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
         return {
            id: docSnap.id,
            ...data,
            // Ensure dates are consistently strings or undefined from Firestore
            commercialInvoiceDate: data.commercialInvoiceDate instanceof Timestamp ? data.commercialInvoiceDate.toDate().toISOString() : data.commercialInvoiceDate,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
            invoiceDate: data.invoiceDate instanceof Timestamp ? data.invoiceDate.toDate().toISOString() : data.invoiceDate,
            etdDate: data.etdDate instanceof Timestamp ? data.etdDate.toDate().toISOString() : data.etdDate,
            etaDate: data.etaDate instanceof Timestamp ? data.etaDate.toDate().toISOString() : data.etaDate,
            installationDetails: data.installationDetails?.map((item: any) => ({
                ...item,
                installDate: item.installDate instanceof Timestamp ? item.installDate.toDate().toISOString() : item.installDate,
            })) || [],
          } as InstallationReportDocument;
      });
      setAllReports(fetchedReports); // Store all reports for searching

      let reportsForSelectedYear = fetchedReports;
      if (year !== "All Years") {
        const numericYear = parseInt(year);
        reportsForSelectedYear = fetchedReports.filter(report => {
          const reportDateString = report.commercialInvoiceDate || report.createdAt;
          if (reportDateString) {
            try {
              const reportDate = parseISO(reportDateString as string);
              return isValid(reportDate) && getYear(reportDate) === numericYear;
            } catch { return false; }
          }
          return false;
        });
      }

      let totalLcMachineries = 0;
      let totalInstalledMachines = 0;
      let machinesUnderWarranty = 0;
      let machinesOutOfWarranty = 0;
      const today = new Date();

      reportsForSelectedYear.forEach(report => {
        totalLcMachineries += Number(report.totalMachineQtyFromLC || 0);
        totalInstalledMachines += Number(report.totalInstalledQty || 0);
        report.installationDetails?.forEach(detail => {
          if (detail.installDate) {
            try {
              const installDateObj = parseISO(detail.installDate as string);
              if (isValid(installDateObj)) {
                const expiryDate = addDays(installDateObj, 365);
                if (isBefore(expiryDate, today)) {
                  machinesOutOfWarranty++;
                } else {
                  machinesUnderWarranty++;
                }
              }
            } catch (e) {
              console.warn("Error parsing installDate for warranty calculation:", detail.installDate, e);
            }
          }
        });
      });

      setWarrantyStats({
        totalLcMachineries,
        totalInstalledMachines,
        totalPendingMachines: totalLcMachineries - totalInstalledMachines,
        machinesUnderWarranty,
        machinesOutOfWarranty,
      });

    } catch (error: any) {
      console.error("Error fetching/calculating warranty stats:", error);
      setStatsError(`Failed to load statistics: ${error.message}`);
      setWarrantyStats({ totalLcMachineries: 0, totalInstalledMachines: 0, totalPendingMachines: 0, machinesUnderWarranty: 0, machinesOutOfWarranty: 0 });
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchAndCalculateStats(selectedYear);
  }, [selectedYear, fetchAndCalculateStats]);

  const handleSearchSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setDisplayedSearchTerm(searchTerm);
    setIsSearching(true);
    setSearchError(null);
    setCurrentSearchPage(1); // Reset to first page on new search

    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    let filteredReports = allReports;

    if (selectedYear !== "All Years") {
        const numericYear = parseInt(selectedYear);
        filteredReports = allReports.filter(report => {
            const reportDateString = report.commercialInvoiceDate || report.createdAt;
            if (reportDateString) {
                try {
                    const reportDate = parseISO(reportDateString as string);
                    return isValid(reportDate) && getYear(reportDate) === numericYear;
                } catch { return false; }
            }
            return false;
        });
    }

    const results = filteredReports.filter(report => {
      return (
        report.commercialInvoiceNumber?.toLowerCase().includes(lowerSearchTerm) ||
        report.documentaryCreditNumber?.toLowerCase().includes(lowerSearchTerm) ||
        report.applicantName?.toLowerCase().includes(lowerSearchTerm) ||
        report.beneficiaryName?.toLowerCase().includes(lowerSearchTerm) ||
        report.missingItemInfo?.toLowerCase().includes(lowerSearchTerm) ||
        report.extraFoundInfo?.toLowerCase().includes(lowerSearchTerm) ||
        (report.installationDetails && report.installationDetails.some(detail =>
          detail.machineModel?.toLowerCase().includes(lowerSearchTerm) ||
          detail.serialNo?.toLowerCase().includes(lowerSearchTerm) ||
          detail.ctlBoxModel?.toLowerCase().includes(lowerSearchTerm) ||
          detail.ctlBoxSerial?.toLowerCase().includes(lowerSearchTerm)
        ))
      );
    });
    setSearchResults(results);
    setIsSearching(false);
  };
  
  // Pagination for search results
  const totalSearchPages = Math.ceil(searchResults.length / ITEMS_PER_PAGE);
  const indexOfLastSearchItem = currentSearchPage * ITEMS_PER_PAGE;
  const indexOfFirstSearchItem = indexOfLastSearchItem - ITEMS_PER_PAGE;
  const currentSearchItems = searchResults.slice(indexOfFirstSearchItem, indexOfLastSearchItem);

  const handleSearchPageChange = (pageNumber: number) => setCurrentSearchPage(pageNumber);

  const getSearchPageNumbers = () => {
    const pageNumbers = []; const maxPagesToShow = 5; const halfPagesToShow = Math.floor(maxPagesToShow / 2);
    if (totalSearchPages <= maxPagesToShow + 2) { for (let i = 1; i <= totalSearchPages; i++) pageNumbers.push(i); }
    else {
      pageNumbers.push(1); let startPage = Math.max(2, currentSearchPage - halfPagesToShow); let endPage = Math.min(totalSearchPages - 1, currentSearchPage + halfPagesToShow);
      if (currentSearchPage <= halfPagesToShow + 1) endPage = Math.min(totalSearchPages - 1, maxPagesToShow);
      if (currentSearchPage >= totalSearchPages - halfPagesToShow) startPage = Math.max(2, totalSearchPages - maxPagesToShow + 1);
      if (startPage > 2) pageNumbers.push("...");
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalSearchPages - 1) pageNumbers.push("...");
      pageNumbers.push(totalSearchPages);
    } return pageNumbers;
  };


  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card className="shadow-xl max-w-6xl mx-auto">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Microscope className="h-7 w-7 text-primary" />
                Warranty Search
              </CardTitle>
              <CardDescription>
                Search for warranty information for year {selectedYear}.
              </CardDescription>
            </div>
            <div className="w-full sm:w-auto">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full sm:w-[180px] bg-card shadow-sm">
                  <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearFilterOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearchSubmit} className="flex w-full items-center space-x-2 mb-8">
            <Input
              type="search"
              placeholder="Search by Machine Model/Serial, Ctl. Box Model/Serial, L/C No, Applicant, Beneficiary..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
              aria-label="Warranty Search Input"
            />
            <Button type="submit" variant="default" disabled={isSearching}>
              {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchIcon className="mr-2 h-4 w-4" />}
              Search
            </Button>
          </form>

          {displayedSearchTerm && !isSearching && searchResults.length === 0 && !searchError && (
            <div className="text-center text-muted-foreground py-10">
                <Info className="mx-auto h-12 w-12 mb-4" />
                <p className="text-lg">No warranty-related installation reports found for &quot;{displayedSearchTerm}&quot; in {selectedYear}.</p>
            </div>
          )}
          {searchError && (
             <div className="text-center text-destructive py-10">
                <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
                <p className="text-lg">{searchError}</p>
            </div>
          )}

          {!displayedSearchTerm && !isSearching && !searchError && (
            <div className="text-center text-muted-foreground py-10">
                <SearchIcon className="mx-auto h-12 w-12 mb-4" />
                <p className="text-lg">Enter terms above to search warranty-related installation reports for {selectedYear}.</p>
            </div>
          )}

          {currentSearchItems.length > 0 && !isSearching && (
            <div className="space-y-6">
                 <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">
                    Search Results for &quot;{displayedSearchTerm}&quot; in {selectedYear} (Showing {indexOfFirstSearchItem + 1}-{Math.min(indexOfLastSearchItem, searchResults.length)} of {searchResults.length}):
                 </h3>
                {currentSearchItems.map((report) => (
                    <Card key={report.id} className="shadow-md hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-base font-semibold text-primary mb-1">
                                      {report.commercialInvoiceNumber && (
                                        <>
                                          C.I.: {formatReportValue(report.commercialInvoiceNumber)}
                                          {report.commercialInvoiceDate && ` (Date: ${formatDisplayDate(report.commercialInvoiceDate)})`}
                                        </>
                                      )}
                                      {report.commercialInvoiceNumber && report.documentaryCreditNumber && " | "}
                                      {report.documentaryCreditNumber && `L/C: ${formatReportValue(report.documentaryCreditNumber)}`}
                                      {(!report.commercialInvoiceNumber && !report.documentaryCreditNumber) && `Report ID: ${report.id.substring(0,8)}...`}
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                        Applicant: <span className="font-medium text-foreground">{formatReportValue(report.applicantName)}</span>
                                        {" | "}Beneficiary: <span className="font-medium text-foreground">{formatReportValue(report.beneficiaryName)}</span>
                                    </p>
                                </div>
                                <Link href={`/dashboard/warranty-management/edit-installation-report/${report.id}`} passHref>
                                    <Button variant="default" size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 h-7 px-2 py-1 text-xs">
                                        <FileEdit className="mr-1.5 h-3.5 w-3.5" /> Edit Report
                                    </Button>
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1 pt-0">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
                                <p><strong className="text-muted-foreground">Total L/C Machine Qty:</strong> {formatReportValue(report.totalMachineQtyFromLC)}</p>
                                <p><strong className="text-muted-foreground">Machine Installed:</strong> {formatReportValue(report.totalInstalledQty)}</p>
                                <p><strong className={cn("font-medium", Number(report.pendingQty) > 0 ? "text-destructive" : "text-green-600")}>Machine Pending:</strong> {formatReportValue(report.pendingQty)}</p>
                            </div>
                             {report.installationDetails && report.installationDetails.length > 0 && (
                                <details className="text-xs mt-2">
                                    <summary className="cursor-pointer text-primary hover:underline">View Machine Details ({report.installationDetails.length})</summary>
                                    <ul className="list-disc pl-5 mt-1 space-y-0.5 bg-muted/50 p-2 rounded-md">
                                        {report.installationDetails.map((detail, idx) => (
                                            <li key={idx}>
                                                Model: {detail.machineModel || 'N/A'}, Serial: {detail.serialNo || 'N/A'}, Ctl. Box Model: {detail.ctlBoxModel || 'N/A'}, Ctl. Box Serial: {detail.ctlBoxSerial || 'N/A'}, Installed: {formatDisplayDate(detail.installDate as string)}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </CardContent>
                    </Card>
                ))}
                {totalSearchPages > 1 && (
                    <div className="flex items-center justify-center space-x-2 py-4 mt-4">
                    <Button variant="outline" size="sm" onClick={() => handleSearchPageChange(Math.max(1, currentSearchPage - 1))} disabled={currentSearchPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                    {getSearchPageNumbers().map((page, index) =>
                        typeof page === 'number' ? (
                        <Button key={`search-page-${page}`} variant={currentSearchPage === page ? 'default' : 'outline'} size="sm" onClick={() => handleSearchPageChange(page)} className="w-9 h-9 p-0">{page}</Button>
                        ) : (<span key={`ellipsis-search-${index}`} className="px-2 py-1 text-sm">{page}</span>)
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleSearchPageChange(Math.min(totalSearchPages, currentSearchPage + 1))} disabled={currentSearchPage === totalSearchPages}>Next <ChevronRight className="h-4 w-4" /></Button>
                    </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xl max-w-6xl mx-auto">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
             <BarChart3 className="h-6 w-6 text-primary"/>
            Warranty Statistics for {selectedYear}
          </CardTitle>
          <CardDescription>
            Overview of machine warranty status for the selected year, calculated from installation reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStats ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Calculating statistics...
            </div>
          ) : statsError ? (
            <div className="text-destructive text-center py-4">{statsError}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard
                title="Total L/C Machineries"
                value={warrantyStats.totalLcMachineries.toLocaleString()}
                icon={<Layers className="h-6 w-6 text-primary" />}
                description={`For year ${selectedYear}`}
              />
              <StatCard
                title="Total Installed Machines"
                value={warrantyStats.totalInstalledMachines.toLocaleString()}
                icon={<Wrench className="h-6 w-6 text-primary" />}
                description={`For year ${selectedYear}`}
              />
              <StatCard
                title="Total Pending Machines"
                value={warrantyStats.totalPendingMachines.toLocaleString()}
                icon={<Hourglass className="h-6 w-6 text-primary" />}
                description={`For year ${selectedYear}`}
              />
              <StatCard
                title="Machines Under Warranty"
                value={warrantyStats.machinesUnderWarranty.toLocaleString()}
                icon={<ShieldCheck className="h-6 w-6 text-primary" />}
                description={`For year ${selectedYear}`}
              />
              <StatCard
                title="Machines Out Of Warranty"
                value={warrantyStats.machinesOutOfWarranty.toLocaleString()}
                icon={<ShieldOff className="h-6 w-6 text-primary" />}
                description={`For year ${selectedYear}`}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

