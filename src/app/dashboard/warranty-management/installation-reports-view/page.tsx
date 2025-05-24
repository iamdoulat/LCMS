
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ClipboardList, Info, AlertTriangle, FileEdit, Trash2, ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import type { InstallationReportDocument } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const ITEMS_PER_PAGE = 9;

const formatReportValue = (value: string | number | undefined | null, defaultValue: string = 'N/A'): string => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue;
  }
  return String(value);
};

export default function InstallationReportsViewPage() {
  const router = useRouter();
  const [allReports, setAllReports] = useState<InstallationReportDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const reportsCollectionRef = collection(firestore, "installation_reports");
        const q = query(reportsCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedReports = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          // Convert Firestore Timestamps to ISO strings for dates if they exist
          const createdAtISO = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt;
          const updatedAtISO = data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt;
          const invoiceDateISO = data.invoiceDate?.toDate ? data.invoiceDate.toDate().toISOString() : data.invoiceDate;
          const etdDateISO = data.etdDate?.toDate ? data.etdDate.toDate().toISOString() : data.etdDate;
          const etaDateISO = data.etaDate?.toDate ? data.etaDate.toDate().toISOString() : data.etaDate;

          const installationDetailsProcessed = data.installationDetails?.map((item: any) => ({
            ...item,
            installDate: item.installDate?.toDate ? item.installDate.toDate().toISOString() : item.installDate,
          })) || [];


          return {
            id: docSnap.id,
            ...data,
            createdAt: createdAtISO,
            updatedAt: updatedAtISO,
            invoiceDate: invoiceDateISO,
            etdDate: etdDateISO,
            etaDate: etaDateISO,
            installationDetails: installationDetailsProcessed,
          } as InstallationReportDocument;
        });
        setAllReports(fetchedReports);
      } catch (error: any) {
        console.error("Error fetching installation reports: ", error);
        let errorMessage = `Could not fetch installation reports. Please ensure Firestore rules allow reads.`;
        if (error.message && (error.message.toLowerCase().includes("index") || error.message.toLowerCase().includes("create_composite"))) {
            errorMessage = `Could not fetch installation reports: A Firestore index might be required. Please check the browser console for a link to create it if prompted. The query orders by 'createdAt' (descending).`;
        } else if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes("permission"))) {
           errorMessage = `Could not fetch installation reports: Missing or insufficient permissions. Please check Firestore security rules for 'installation_reports'.`;
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
    fetchReports();
  }, []);

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
          Swal.fire(
            'Deleted!',
            `Installation report "${reportIdentifier || reportId}" has been removed.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting installation report: ", error);
          Swal.fire("Error", `Could not delete report: ${error.message}`, "error");
        }
      }
    });
  };

  const totalPages = Math.ceil(allReports.length / ITEMS_PER_PAGE);
  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return allReports.slice(startIndex, endIndex);
  }, [allReports, currentPage]);

  const handlePageChange = (pageNumber: number) => setCurrentPage(pageNumber);
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

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
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ClipboardList className="h-7 w-7 text-primary" />
                View Installation Reports
              </CardTitle>
              <CardDescription>
                Browse and manage existing installation reports. Showing {currentItems.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}-{Math.min(currentPage * ITEMS_PER_PAGE, allReports.length)} of {allReports.length} entries.
              </CardDescription>
            </div>
             <Link href="/dashboard/warranty-management/new-installation-report" passHref>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Report
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
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
                There are no installation reports in the database yet, or an index is still building.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6">
              {currentItems.map((report) => (
                <Card key={report.id} className="flex flex-col justify-between shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-primary truncate" title={report.commercialInvoiceNumber || report.documentaryCreditNumber || 'Report'}>
                      C.I.: {formatReportValue(report.commercialInvoiceNumber)}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      L/C: {formatReportValue(report.documentaryCreditNumber)}
                      {report.createdAt && (
                        <span className="block mt-1">Created: {format(new Date(report.createdAt as string), 'PPP')}</span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm flex-grow">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2">
                      <div>
                        <p className="font-medium text-muted-foreground">Applicant:</p>
                        <p className="truncate" title={report.applicantName}>{formatReportValue(report.applicantName)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Beneficiary:</p>
                        <p className="truncate" title={report.beneficiaryName}>{formatReportValue(report.beneficiaryName)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">L/C Qty:</p>
                        <p>{formatReportValue(report.totalMachineQtyFromLC)}</p>
                      </div>
                       <div>
                        <p className="font-medium text-muted-foreground">Installed:</p>
                        <p>{formatReportValue(report.totalInstalledQty)}</p>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <p className="font-medium text-muted-foreground">Pending:</p>
                        <p className="font-bold text-destructive">{formatReportValue(report.pendingQty)}</p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2 border-t pt-3">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/warranty-management/edit-installation-report/${report.id}`}>
                        <FileEdit className="mr-1.5 h-4 w-4" /> Edit
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDeleteReport(report.id, report.commercialInvoiceNumber || report.documentaryCreditNumber)}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4 mt-6">
              <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (
                  <Button
                    key={`report-page-${page}`}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-9 h-9 p-0"
                  >
                    {page}
                  </Button>
                ) : (
                  <span key={`ellipsis-report-${index}`} className="px-2 py-1 text-sm">{page}</span>
                )
              )}
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

