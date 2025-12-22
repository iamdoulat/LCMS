
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Search as SearchIcon, Layers, Wrench, Hourglass, ShieldCheck, ShieldOff, BarChart3, CalendarDays, Microscope, Loader2, Info, AlertTriangle, ChevronLeft, ChevronRight, FileEdit, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import { StatCard } from '@/components/dashboard/StatCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import Image from 'next/image';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, Timestamp, orderBy as firestoreOrderBy, where } from 'firebase/firestore';
import type { InstallationReportDocument, InstallationDetailItem as PageInstallationDetailItemType, ClaimReportDocument } from '@/types';
import { format, parseISO, isValid, getYear, addDays, isBefore, differenceInDays, startOfDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';


const currentSystemYear = new Date().getFullYear();
const yearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];

const ITEMS_PER_PAGE = 10;

interface WarrantySearchResultItem {
  reportId: string;
  commercialInvoiceNumber?: string;
  applicantName?: string;
  beneficiaryName?: string;
  machineModel?: string;
  serialNo?: string;
  ctlBoxModel?: string;
  ctlBoxSerial?: string;
  installDate?: string; // Keep as string from Firestore for now
  warrantyStatus: string; // "X days remaining", "Expired", "N/A"
}

const WarrantySearchSkeleton = () => (
  <div className="space-y-8">
    <Card className="shadow-xl max-w-6xl mx-auto"><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
    <Card className="shadow-xl max-w-6xl mx-auto">
      <CardHeader><Skeleton className="h-8 w-1/3" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="shadow-lg"><CardContent className="p-6 flex justify-between items-center"><div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-9 w-24" /></div><Skeleton className="h-12 w-12 rounded-lg" /></CardContent></Card>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);


export default function WarrantySearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [displayedSearchTerm, setDisplayedSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>("All Years");

  const [allReports, setAllReports] = useState<InstallationReportDocument[]>([]);
  const [searchResults, setSearchResults] = useState<WarrantySearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [currentSearchPage, setCurrentSearchPage] = useState(1);

  const [warrantyStats, setWarrantyStats] = useState({
    totalLcMachineries: 0,
    totalInstalledMachines: 0,
    totalPendingMachines: 0,
    machinesUnderWarranty: 0,
    machinesOutOfWarranty: 0,
    totalClaims: 0,
    pendingClaims: 0,
  });

  const fetchAllReportsAndCalculateStats = useCallback(async (yearToFilter: string) => {
    setIsLoading(true);
    setSearchError(null);
    try {
      const reportsCollectionRef = collection(firestore, "installation_reports");
      const claimsCollectionRef = collection(firestore, "claim_reports");
      const reportsQuery = query(reportsCollectionRef, firestoreOrderBy("createdAt", "desc"));
      const claimsQuery = query(claimsCollectionRef);

      const [reportsSnapshot, claimsSnapshot] = await Promise.all([getDocs(reportsQuery), getDocs(claimsQuery)]);

      const fetchedReports = reportsSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          commercialInvoiceDate: data.commercialInvoiceDate instanceof Timestamp ? data.commercialInvoiceDate.toDate().toISOString() : (data.commercialInvoiceDate && isValid(parseISO(data.commercialInvoiceDate)) ? data.commercialInvoiceDate : undefined),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (data.createdAt && isValid(parseISO(data.createdAt)) ? data.createdAt : 'N/A'),
          invoiceDate: data.invoiceDate instanceof Timestamp ? data.invoiceDate.toDate().toISOString() : (data.invoiceDate && isValid(parseISO(data.invoiceDate)) ? data.invoiceDate : undefined),
          etdDate: data.etdDate instanceof Timestamp ? data.etdDate.toDate().toISOString() : (data.etdDate && isValid(parseISO(data.etdDate)) ? data.etdDate : undefined),
          etaDate: data.etaDate instanceof Timestamp ? data.etaDate.toDate().toISOString() : (data.etaDate && isValid(parseISO(data.etaDate)) ? data.etaDate : undefined),
          installationDetails: data.installationDetails?.map((item: any) => ({
            ...item,
            installDate: item.installDate instanceof Timestamp ? item.installDate.toDate().toISOString() : (item.installDate && isValid(parseISO(item.installDate)) ? item.installDate : undefined),
          })) || [],
        } as InstallationReportDocument;
      });
      setAllReports(fetchedReports);

      const fetchedClaims = claimsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Omit<ClaimReportDocument, 'id'> }));

      let reportsForSelectedYear = fetchedReports;
      let claimsForSelectedYear = fetchedClaims;

      if (yearToFilter !== "All Years") {
        const numericYear = parseInt(yearToFilter);
        reportsForSelectedYear = fetchedReports.filter(report => {
          const reportDateString = report.commercialInvoiceDate || (report.createdAt as string);
          if (reportDateString && reportDateString !== 'N/A') {
            try {
              const reportDate = parseISO(reportDateString);
              return isValid(reportDate) && getYear(reportDate) === numericYear;
            } catch { return false; }
          }
          return false;
        });
        claimsForSelectedYear = fetchedClaims.filter(claim => {
          if (claim.claimDate && claim.claimDate !== 'N/A') {
            try {
              const claimDate = parseISO(claim.claimDate as string);
              return isValid(claimDate) && getYear(claimDate) === numericYear;
            } catch { return false; }
          }
          return false;
        });
      }

      let totalLcMachineries = 0;
      let totalInstalledMachines = 0;
      let machinesUnderWarranty = 0;
      let machinesOutOfWarranty = 0;
      const today = startOfDay(new Date());

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
              console.warn("Error parsing installDate for warranty stats:", detail.installDate, e);
            }
          }
        });
      });

      const totalClaims = claimsForSelectedYear.length;
      const pendingClaims = claimsForSelectedYear.filter(claim => claim.status === 'Pending').length;

      setWarrantyStats({
        totalLcMachineries,
        totalInstalledMachines,
        totalPendingMachines: totalLcMachineries - totalInstalledMachines,
        machinesUnderWarranty,
        machinesOutOfWarranty,
        totalClaims,
        pendingClaims
      });

    } catch (error: any) {
      console.error("Error fetching/calculating warranty stats:", error);
      let errorMsg = "Failed to load statistics.";
      if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes("permission"))) {
        errorMsg = "Failed to load statistics: Missing or insufficient permissions. Please check Firestore rules for 'installation_reports' and 'claim_reports'.";
      } else if (error.message) {
        errorMsg = `Failed to load statistics: ${error.message}`;
      }
      Swal.fire("Statistics Error", errorMsg, "error");
      setWarrantyStats({ totalLcMachineries: 0, totalInstalledMachines: 0, totalPendingMachines: 0, machinesUnderWarranty: 0, machinesOutOfWarranty: 0, totalClaims: 0, pendingClaims: 0 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllReportsAndCalculateStats(selectedYear);
  }, [selectedYear, fetchAllReportsAndCalculateStats]);

  const handleSearchSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const trimmedSearchTerm = searchTerm.trim();
    setDisplayedSearchTerm(trimmedSearchTerm);
    setIsSearching(true);
    setSearchError(null);
    setCurrentSearchPage(1);

    if (!trimmedSearchTerm) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const lowerSearchTerm = trimmedSearchTerm.toLowerCase();

    let reportsToSearchFrom = allReports;
    if (selectedYear !== "All Years") {
      const numericYear = parseInt(selectedYear);
      reportsToSearchFrom = allReports.filter(report => {
        const reportDateString = report.commercialInvoiceDate || report.createdAt as string;
        if (reportDateString && reportDateString !== 'N/A') {
          try {
            const reportDate = parseISO(reportDateString);
            return isValid(reportDate) && getYear(reportDate) === numericYear;
          } catch { return false; }
        }
        return false;
      });
    }

    const results: WarrantySearchResultItem[] = [];
    const today = startOfDay(new Date());

    reportsToSearchFrom.forEach(report => {
      let reportLevelMatch = false;
      if (
        report.applicantName?.toLowerCase().includes(lowerSearchTerm) ||
        report.beneficiaryName?.toLowerCase().includes(lowerSearchTerm) ||
        report.commercialInvoiceNumber?.toLowerCase().includes(lowerSearchTerm) ||
        report.documentaryCreditNumber?.toLowerCase().includes(lowerSearchTerm) ||
        report.missingItemInfo?.toLowerCase().includes(lowerSearchTerm) ||
        report.extraFoundInfo?.toLowerCase().includes(lowerSearchTerm)
      ) {
        reportLevelMatch = true;
      }

      let detailMatchedInReport = false;
      report.installationDetails?.forEach(detail => {
        let currentDetailMatch = false;
        if (
          detail.machineModel?.toLowerCase().includes(lowerSearchTerm) ||
          detail.serialNo?.toLowerCase().includes(lowerSearchTerm) ||
          detail.ctlBoxModel?.toLowerCase().includes(lowerSearchTerm) ||
          detail.ctlBoxSerial?.toLowerCase().includes(lowerSearchTerm)
        ) {
          currentDetailMatch = true;
          detailMatchedInReport = true;
        }

        if (currentDetailMatch) {
          let warrantyStatus = "N/A";
          if (detail.installDate && isValid(parseISO(detail.installDate as string))) {
            const installDateObj = parseISO(detail.installDate as string);
            const expiryDate = addDays(installDateObj, 365);
            const diff = differenceInDays(expiryDate, today);
            warrantyStatus = isBefore(expiryDate, today) ? "Expired" : `${diff} days remaining`;
          }
          const existingResultIndex = results.findIndex(r => r.reportId === report.id && r.serialNo === detail.serialNo && r.ctlBoxSerial === detail.ctlBoxSerial);
          if (existingResultIndex === -1) {
            results.push({
              reportId: report.id,
              commercialInvoiceNumber: report.commercialInvoiceNumber,
              applicantName: report.applicantName,
              beneficiaryName: report.beneficiaryName,
              machineModel: detail.machineModel,
              serialNo: detail.serialNo,
              ctlBoxModel: detail.ctlBoxModel,
              ctlBoxSerial: detail.ctlBoxSerial,
              installDate: detail.installDate as string,
              warrantyStatus,
            });
          }
        }
      });

      if (reportLevelMatch && !detailMatchedInReport) {
        if (report.installationDetails && report.installationDetails.length > 0) {
          const detail = report.installationDetails[0];
          let warrantyStatus = "N/A";
          if (detail.installDate && isValid(parseISO(detail.installDate as string))) {
            const installDateObj = parseISO(detail.installDate as string);
            const expiryDate = addDays(installDateObj, 365);
            const diff = differenceInDays(expiryDate, today);
            warrantyStatus = isBefore(expiryDate, today) ? "Expired" : `${diff} days`;
          }
          const existingResultIndex = results.findIndex(r => r.reportId === report.id && r.serialNo === detail.serialNo && r.ctlBoxSerial === detail.ctlBoxSerial);
          if (existingResultIndex === -1) {
            results.push({
              reportId: report.id,
              commercialInvoiceNumber: report.commercialInvoiceNumber,
              applicantName: report.applicantName,
              beneficiaryName: report.beneficiaryName,
              machineModel: detail.machineModel,
              serialNo: detail.serialNo,
              ctlBoxModel: detail.ctlBoxModel,
              ctlBoxSerial: detail.ctlBoxSerial,
              installDate: detail.installDate as string,
              warrantyStatus,
            });
          }
        } else {
          const existingResultIndex = results.findIndex(r => r.reportId === report.id);
          if (existingResultIndex === -1) {
            results.push({
              reportId: report.id,
              commercialInvoiceNumber: report.commercialInvoiceNumber,
              applicantName: report.applicantName,
              beneficiaryName: report.beneficiaryName,
              machineModel: "N/A (No Installation Details)",
              serialNo: "N/A",
              ctlBoxModel: "N/A",
              ctlBoxSerial: "N/A",
              installDate: undefined,
              warrantyStatus: "N/A",
            });
          }
        }
      }
    });
    setSearchResults(results);
    setIsSearching(false);
  };

  const totalSearchPages = Math.ceil(searchResults.length / ITEMS_PER_PAGE);
  const indexOfLastSearchItem = currentSearchPage * ITEMS_PER_PAGE;
  const indexOfFirstSearchItem = indexOfLastSearchItem - ITEMS_PER_PAGE;
  const currentSearchItems = searchResults.slice(indexOfFirstSearchItem, indexOfLastSearchItem);

  const handleSearchPageChange = (pageNumber: number) => {
    setCurrentSearchPage(pageNumber);
  };

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

  if (isLoading) {
    return <WarrantySearchSkeleton />;
  }

  return (
    <div className="m-[10px] p-0 md:py-8 md:px-5 space-y-8">
      <Card
        className="shadow-xl relative overflow-hidden"
      >
        <div className="relative z-10 bg-card/90 dark:bg-card/80 rounded-lg">
          <CardHeader className="text-center">
            <CardTitle className={cn("flex items-center justify-center gap-2 font-bold text-2xl lg:text-3xl text-card-foreground", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
              <Microscope className="h-7 w-7 text-primary" />
              Warranty Search Engine
            </CardTitle>
            <CardDescription className="text-center pt-2 text-card-foreground/80">
              Search for warranty information for year {selectedYear === "All Years" ? "Overall" : selectedYear}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearchSubmit} className="flex w-full max-w-xl mx-auto items-center space-x-2 mb-8">
              <Input
                type="search"
                placeholder="Search by Machine Model/Serial, Ctl. Box Model/Serial, L/C No, Applicant, Beneficiary..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
                aria-label="Warranty Search Input"
              />
              <Button type="submit" variant="default" disabled={isSearching || isLoading}>
                {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchIcon className="mr-2 h-4 w-4" />}
                Search
              </Button>
            </form>

            {isSearching && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                <p className="text-card-foreground/80">Searching reports...</p>
              </div>
            )}

            {!isSearching && displayedSearchTerm && searchResults.length === 0 && !searchError && (
              <div className="text-center text-card-foreground/70 py-10">
                <Info className="mx-auto h-12 w-12 mb-4" />
                <p className="text-lg">No warranty-related installation report details found for &quot;{displayedSearchTerm}&quot; in {selectedYear === "All Years" ? "any year" : selectedYear}.</p>
                <p className="text-sm">Ensure data exists in Firestore and check filter criteria.</p>
              </div>
            )}
            {searchError && !isSearching && (
              <div className="text-center text-destructive py-10">
                <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
                <p className="text-lg">{searchError}</p>
              </div>
            )}

            {!displayedSearchTerm && !isSearching && !searchError && (
              <div className="text-center text-card-foreground/70 py-10">
                <iframe src="https://lottie.host/embed/1b954d50-dbd6-4e85-a947-9c8fc4fa093c/Jkw6b9BbW1.lottie" style={{ border: 'none', width: '150px', height: '150px', margin: '0 auto 1rem' }}></iframe>
                <p className="text-lg">
                  Enter terms above to search warranty-related information for{' '}
                  {selectedYear === "All Years" ? "all years" : selectedYear}.
                </p>
              </div>
            )}

            {currentSearchItems.length > 0 && !isSearching && !searchError && (
              <div className="space-y-6 mt-8">
                <h3 className="text-lg font-semibold text-card-foreground mt-6 mb-2 text-center">
                  Search Results for &quot;{displayedSearchTerm || 'All Demo Machines'}&quot; in {selectedYear === "All Years" ? "All Years" : selectedYear} (Showing {indexOfFirstSearchItem + 1}-{Math.min(indexOfLastSearchItem, searchResults.length)} of {searchResults.length} matching entries):
                </h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-card-foreground/90">Machine Model</TableHead>
                        <TableHead className="text-card-foreground/90">Machine S/N</TableHead>
                        <TableHead className="text-card-foreground/90">Ctl. Box Model</TableHead>
                        <TableHead className="text-card-foreground/90">Ctl. Box S/N</TableHead>
                        <TableHead className="text-card-foreground/90">Warranty</TableHead>
                        <TableHead className="text-card-foreground/90">Applicant</TableHead>
                        <TableHead className="text-right text-card-foreground/90">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentSearchItems.map((item, idx) => (
                        <TableRow key={`${item.reportId}-${item.serialNo || idx}-${item.ctlBoxSerial || idx}`}>
                          <TableCell className="text-card-foreground/80">{item.machineModel || 'N/A'}</TableCell>
                          <TableCell className="text-card-foreground/80">{item.serialNo || 'N/A'}</TableCell>
                          <TableCell className="text-card-foreground/80">{item.ctlBoxModel || 'N/A'}</TableCell>
                          <TableCell className="text-card-foreground/80">{item.ctlBoxSerial || 'N/A'}</TableCell>
                          <TableCell
                            className={cn(
                              "font-medium",
                              item.warrantyStatus === "Expired" ? "text-destructive" : "text-green-600"
                            )}
                          >
                            {item.warrantyStatus}
                          </TableCell>
                          <TableCell className="truncate max-w-xs text-card-foreground/80">{item.applicantName || 'N/A'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/dashboard/warranty-management/edit-installation-report/${item.reportId}`}>
                                <FileEdit className="mr-1.5 h-3.5 w-3.5" /> View Report
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableCaption className="text-card-foreground/70 py-4">
                      Displaying {indexOfFirstSearchItem + 1} - {Math.min(indexOfLastSearchItem, searchResults.length)} of {searchResults.length} matching machine/control box entries.
                    </TableCaption>
                  </Table>
                </div>

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
        </div>
      </Card>

      <Card
        className="shadow-xl"
      >
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex-1 text-center sm:text-left">
            <CardTitle className={cn("flex items-center sm:justify-start justify-center gap-2", "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
              <BarChart3 className="h-6 w-6 text-primary" />
              Yearly Warranty Statistics
            </CardTitle>
            <CardDescription className="text-card-foreground/80">
              Overview of machine warranty status for year {selectedYear === "All Years" ? "Overall" : selectedYear}.
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
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              title="Total L/C Machineries"
              value={warrantyStats.totalLcMachineries.toLocaleString()}
              icon={<Layers className="h-6 w-6" />}
              description={`For year ${selectedYear === "All Years" ? "Overall" : selectedYear}`}
              className="bg-[#4A90E2]"
            />
            <StatCard
              title="Total Installed Machines"
              value={warrantyStats.totalInstalledMachines.toLocaleString()}
              icon={<Wrench className="h-6 w-6" />}
              description={`For year ${selectedYear === "All Years" ? "Overall" : selectedYear}`}
              className="bg-[#50E3C2]"
            />
            <StatCard
              title="Total Pending Machines"
              value={warrantyStats.totalPendingMachines.toLocaleString()}
              icon={<Hourglass className="h-6 w-6" />}
              description={`For year ${selectedYear === "All Years" ? "Overall" : selectedYear}`}
              className="bg-[#F5A623]"
            />
            <StatCard
              title="Machines Under Warranty"
              value={warrantyStats.machinesUnderWarranty.toLocaleString()}
              icon={<ShieldCheck className="h-6 w-6" />}
              description={`For year ${selectedYear === "All Years" ? "Overall" : selectedYear}`}
              className="bg-[#7ED321]"
            />
            <StatCard
              title="Machines Out Of Warranty"
              value={warrantyStats.machinesOutOfWarranty.toLocaleString()}
              icon={<ShieldOff className="h-6 w-6" />}
              description={`For year ${selectedYear === "All Years" ? "Overall" : selectedYear}`}
              className="bg-[#D0021B]"
            />
            <StatCard
              title="Total Claims Overall"
              value={warrantyStats.totalClaims.toLocaleString()}
              icon={<HelpCircle className="h-6 w-6" />}
              description={`${warrantyStats.pendingClaims} Total Pending`}
              className="bg-[#BD10E0]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
