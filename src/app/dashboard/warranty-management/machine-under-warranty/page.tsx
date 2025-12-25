
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Loader2, ShieldCheck, Info, AlertTriangle, ChevronLeft, ChevronRight, Filter, XCircle, Search, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { InstallationReportDocument } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { format, parseISO, isValid, addDays, differenceInDays, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Swal from 'sweetalert2';

interface UnderWarrantyMachine {
  reportId: string;
  applicantName: string;
  beneficiaryName: string;
  commercialInvoiceNumber?: string;
  machineModel: string;
  serialNo: string;
  installDate: Date;
  warrantyExpiryDate: Date;
  daysRemaining: number;
}

const ITEMS_PER_PAGE = 10;

const formatDisplayDate = (date: Date): string => {
  return isValid(date) ? format(date, 'PPP') : 'N/A';
};

const getDaysRemainingBadgeVariant = (days: number): "default" | "secondary" | "destructive" => {
  if (days < 0) return "destructive"; // Should not happen on this page, but good for safety
  if (days <= 30) return "destructive"; // Less than a month remaining
  if (days <= 90) return "secondary"; // Less than 3 months remaining
  return "default";
};

export default function MachineUnderWarrantyPage() {
  const [allMachines, setAllMachines] = useState<UnderWarrantyMachine[]>([]);
  const [displayedMachines, setDisplayedMachines] = useState<UnderWarrantyMachine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter states
  const [filterApplicant, setFilterApplicant] = useState('');
  const [filterBeneficiary, setFilterBeneficiary] = useState('');
  const [filterSerialNo, setFilterSerialNo] = useState('');
  const [filterMachineModel, setFilterMachineModel] = useState('');

  useEffect(() => {
    const fetchMachines = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const reportsCollectionRef = collection(firestore, "installation_reports");
        const q = query(reportsCollectionRef, firestoreOrderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        const underWarrantyMachines: UnderWarrantyMachine[] = [];
        const today = new Date();

        querySnapshot.docs.forEach(docSnap => {
          const report = { id: docSnap.id, ...docSnap.data() } as InstallationReportDocument;
          report.installationDetails?.forEach(detail => {
            if (detail.installDate) {
              const installDateObj = parseISO(detail.installDate);
              if (isValid(installDateObj)) {
                const expiryDate = addDays(installDateObj, 365);
                if (isAfter(expiryDate, today)) {
                  const daysRemaining = differenceInDays(expiryDate, today);
                  underWarrantyMachines.push({
                    reportId: report.id,
                    applicantName: report.applicantName,
                    beneficiaryName: report.beneficiaryName,
                    commercialInvoiceNumber: report.commercialInvoiceNumber,
                    machineModel: detail.machineModel,
                    serialNo: detail.serialNo,
                    installDate: installDateObj,
                    warrantyExpiryDate: expiryDate,
                    daysRemaining,
                  });
                }
              }
            }
          });
        });

        const sortedMachines = underWarrantyMachines.sort((a, b) =>
          a.applicantName.localeCompare(b.applicantName) || a.daysRemaining - b.daysRemaining
        );

        setAllMachines(sortedMachines);
      } catch (error: any) {
        console.error("Error fetching machines under warranty:", error);
        let errorMessage = `Could not fetch data. Please check Firestore rules.`;
        if (error.message?.toLowerCase().includes("index")) {
          errorMessage = `Could not fetch data: A Firestore index might be required. Please check the browser console for details.`;
        } else if (error.message) {
          errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire("Fetch Error", errorMessage, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMachines();
  }, []);

  useEffect(() => {
    let filtered = [...allMachines];

    if (filterApplicant) {
      filtered = filtered.filter(m => m.applicantName?.toLowerCase().includes(filterApplicant.toLowerCase()));
    }
    if (filterBeneficiary) {
      filtered = filtered.filter(m => m.beneficiaryName?.toLowerCase().includes(filterBeneficiary.toLowerCase()));
    }
    if (filterSerialNo) {
      filtered = filtered.filter(m => m.serialNo?.toLowerCase().includes(filterSerialNo.toLowerCase()));
    }
    if (filterMachineModel) {
      filtered = filtered.filter(m => m.machineModel?.toLowerCase().includes(filterMachineModel.toLowerCase()));
    }

    setDisplayedMachines(filtered);
    setCurrentPage(1);
  }, [allMachines, filterApplicant, filterBeneficiary, filterSerialNo, filterMachineModel]);


  const clearFilters = () => {
    setFilterApplicant('');
    setFilterBeneficiary('');
    setFilterSerialNo('');
    setFilterMachineModel('');
    setCurrentPage(1);
  };

  // Pagination Logic
  const totalPages = Math.ceil(displayedMachines.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = displayedMachines.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    const halfPagesToShow = Math.floor(maxPagesToShow / 2);

    if (totalPages <= maxPagesToShow + 2) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
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
    <div className="max-w-none mx-[25px] py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <ShieldCheck className="h-7 w-7 text-primary" />
            Machines Under Warranty
          </CardTitle>
          <CardDescription>
            View all machines currently under warranty, sorted by applicant and days remaining.
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
                  <Label htmlFor="applicantFilterWarranty" className="text-sm font-medium">Applicant Name</Label>
                  <Input id="applicantFilterWarranty" placeholder="Search by Applicant..." value={filterApplicant} onChange={(e) => setFilterApplicant(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="beneficiaryFilterWarranty" className="text-sm font-medium">Beneficiary Name</Label>
                  <Input id="beneficiaryFilterWarranty" placeholder="Search by Beneficiary..." value={filterBeneficiary} onChange={(e) => setFilterBeneficiary(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="serialNoFilterWarranty" className="text-sm font-medium">Machine Serial No.</Label>
                  <Input id="serialNoFilterWarranty" placeholder="Search by Serial No..." value={filterSerialNo} onChange={(e) => setFilterSerialNo(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="modelFilterWarranty" className="text-sm font-medium">Machine Model</Label>
                  <Input id="modelFilterWarranty" placeholder="Search by Model..." value={filterMachineModel} onChange={(e) => setFilterMachineModel(e.target.value)} />
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
              <p className="text-muted-foreground">Loading machines under warranty...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap">{fetchError}</p>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Machines Under Warranty Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no machines currently under warranty matching your criteria.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant Name</TableHead>
                    <TableHead>Machine Model</TableHead>
                    <TableHead>Serial No.</TableHead>
                    <TableHead>Install Date</TableHead>
                    <TableHead>Warranty Expiry</TableHead>
                    <TableHead>Days Remaining</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map((machine) => (
                    <TableRow key={`${machine.reportId}-${machine.serialNo}`}>
                      <TableCell className="font-medium">{machine.applicantName}</TableCell>
                      <TableCell>{machine.machineModel}</TableCell>
                      <TableCell>{machine.serialNo}</TableCell>
                      <TableCell>{formatDisplayDate(machine.installDate)}</TableCell>
                      <TableCell>{formatDisplayDate(machine.warrantyExpiryDate)}</TableCell>
                      <TableCell>
                        <Badge variant={getDaysRemainingBadgeVariant(machine.daysRemaining)}>
                          {machine.daysRemaining} days
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm" className="w-9 p-0 md:w-auto md:px-3">
                          <Link href={`/dashboard/warranty-management/edit-installation-report/${machine.reportId}`}>
                            <ExternalLink className="h-4 w-4 md:mr-2" />
                            <span className="sr-only md:not-sr-only">View Report</span>
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableCaption className="py-4">
                  Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, displayedMachines.length)} of {displayedMachines.length} entries.
                </TableCaption>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4 mt-4">
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (
                  <Button key={`warranty-page-${page}`} variant={currentPage === page ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(page)} className="w-9 h-9 p-0">{page}</Button>
                ) : (<span key={`ellipsis-warranty-${index}`} className="px-2 py-1 text-sm">{page}</span>)
              )}
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
