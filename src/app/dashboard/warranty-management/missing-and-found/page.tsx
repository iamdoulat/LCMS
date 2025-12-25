
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Archive, Info, AlertTriangle, Edit, FileText } from 'lucide-react';
import Link from 'next/link';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { InstallationReportDocument } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';

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

export default function MissingAndFoundPage() {
  const [reportsWithIssues, setReportsWithIssues] = useState<InstallationReportDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
          const createdAtISO = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt;
          const updatedAtISO = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt;

          const invoiceDateISO = data.invoiceDate && data.invoiceDate.toDate ? data.invoiceDate.toDate().toISOString() : data.invoiceDate;
          const commercialInvoiceDateISO = data.commercialInvoiceDate && data.commercialInvoiceDate.toDate ? data.commercialInvoiceDate.toDate().toISOString() : data.commercialInvoiceDate;
          const etdDateISO = data.etdDate && data.etdDate.toDate ? data.etdDate.toDate().toISOString() : data.etdDate;
          const etaDateISO = data.etaDate && data.etaDate.toDate ? data.etaDate.toDate().toISOString() : data.etaDate;

          const installationDetailsProcessed = data.installationDetails?.map((item: any) => ({
            ...item,
            installDate: item.installDate && item.installDate.toDate ? item.installDate.toDate().toISOString() : item.installDate,
          })) || [];

          return {
            id: docSnap.id,
            ...data,
            createdAt: createdAtISO,
            updatedAt: updatedAtISO,
            invoiceDate: invoiceDateISO,
            commercialInvoiceDate: commercialInvoiceDateISO,
            etdDate: etdDateISO,
            etaDate: etaDateISO,
            installationDetails: installationDetailsProcessed,
          } as InstallationReportDocument;
        });

        const filteredReports = fetchedReports.filter(report =>
          (report.missingItemInfo && report.missingItemInfo.trim() !== "" && !report.missingItemsIssueResolved) ||
          (report.extraFoundInfo && report.extraFoundInfo.trim() !== "" && !report.extraItemsIssueResolved)
        );
        setReportsWithIssues(filteredReports);

      } catch (error: any) {
        console.error("Error fetching installation reports for missing/found page: ", error);
        let errorMessage = `Failed to fetch reports. Please check Firestore rules and connectivity.`;
        if (error.message?.toLowerCase().includes("index")) {
          errorMessage = `Could not fetch reports: A Firestore index might be required. Please check the browser console for a link to create it.`;
        } else if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes("permission"))) {
          errorMessage = `Could not fetch reports: Missing or insufficient permissions. Please check Firestore security rules for 'installation_reports'.`;
        } else if (error.message) {
          errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire("Fetch Error", errorMessage, "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchReports();
  }, []);

  return (
    <div className="max-w-none mx-[25px] py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Archive className="h-7 w-7 text-primary" />
            Missing and Found Items
          </CardTitle>
          <CardDescription>
            Track and manage installation reports with unresolved missing or extra items.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading reports with issues...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap">{fetchError}</p>
            </div>
          ) : reportsWithIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Active Issues</p>
              <p className="text-sm text-muted-foreground text-center">
                All installation reports are either resolved or have no missing/extra items recorded.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6">
              {reportsWithIssues.map((report) => (
                <Card key={report.id} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg font-semibold text-primary mb-1">
                          C.I.: {report.commercialInvoiceNumber || 'N/A'}
                          {report.commercialInvoiceDate && ` (Date: ${formatDisplayDate(report.commercialInvoiceDate)})`}
                          {" | "}L/C: {report.documentaryCreditNumber || 'N/A'}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Applicant: <span className="font-medium text-foreground">{report.applicantName || 'N/A'}</span>
                          {" | "}Beneficiary: <span className="font-medium text-foreground">{report.beneficiaryName || 'N/A'}</span>
                        </p>
                      </div>
                      <Link href={`/dashboard/warranty-management/edit-installation-report/${report.id}`} passHref>
                        <Button variant="outline" size="icon" className="md:w-auto md:px-3">
                          <Edit className="h-4 w-4 md:mr-2" />
                          <span className="sr-only md:not-sr-only">Edit Report</span>
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      {report.missingItemInfo && report.missingItemInfo.trim() !== "" && !report.missingItemsIssueResolved && (
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium text-foreground underline">Missing And Short Shipment Item Information:</h4>
                          <div className="p-3 rounded-md border bg-muted/30 text-sm text-muted-foreground whitespace-pre-wrap h-32 overflow-y-auto">
                            {report.missingItemInfo}
                          </div>
                        </div>
                      )}
                      {report.extraFoundInfo && report.extraFoundInfo.trim() !== "" && !report.extraItemsIssueResolved && (
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium text-foreground underline">Extra Found and Return Information:</h4>
                          <div className="p-3 rounded-md border bg-muted/30 text-sm text-muted-foreground whitespace-pre-wrap h-32 overflow-y-auto">
                            {report.extraFoundInfo}
                          </div>
                        </div>
                      )}
                    </div>
                    {((!report.missingItemInfo || report.missingItemInfo.trim() === "" || report.missingItemsIssueResolved) &&
                      (!report.extraFoundInfo || report.extraFoundInfo.trim() === "" || report.extraItemsIssueResolved)
                    ) && (
                        <p className="text-sm text-muted-foreground italic text-center py-4">No unresolved missing or extra items for this report.</p>
                      )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
