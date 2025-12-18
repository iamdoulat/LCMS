
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertTriangle, Edit } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { InstallationReportDocument } from '@/types';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import { createLazyComponent } from '@/lib/lazy-load';

// Lazy load the large form component (58KB)
const EditInstallationReportForm = createLazyComponent(
  () => import('@/components/forms/EditInstallationReportForm').then(mod => ({ default: mod.EditInstallationReportForm }))
);

export default function EditInstallationReportPage() {
  const params = useParams();
  const reportId = params.reportId as string;


  const [reportData, setReportData] = React.useState<InstallationReportDocument | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!reportId) {
      setError("No Report ID provided in the URL.");
      setIsLoading(false);
      return;
    }

    const fetchReportData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const reportDocRef = doc(firestore, "installation_reports", reportId);
        const reportDocSnap = await getDoc(reportDocRef);

        if (reportDocSnap.exists()) {
          const data = reportDocSnap.data() as Omit<InstallationReportDocument, 'id'>;
          const processedData: InstallationReportDocument = {
            id: reportDocSnap.id,
            ...data,
            // Ensure all date fields are converted to ISO strings for consistency
            commercialInvoiceDate: data.commercialInvoiceDate && (data.commercialInvoiceDate as any).toDate ? (data.commercialInvoiceDate as any).toDate().toISOString() : data.commercialInvoiceDate,
            invoiceDate: data.invoiceDate && (data.invoiceDate as any).toDate ? (data.invoiceDate as any).toDate().toISOString() : data.invoiceDate,
            etdDate: data.etdDate && (data.etdDate as any).toDate ? (data.etdDate as any).toDate().toISOString() : data.etdDate,
            etaDate: data.etaDate && (data.etaDate as any).toDate ? (data.etaDate as any).toDate().toISOString() : data.etaDate,
            installationDetails: data.installationDetails?.map(item => ({
              ...item,
              installDate: item.installDate && (item.installDate as any).toDate ? (item.installDate as any).toDate().toISOString() : item.installDate,
            })) || [],
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          };
          setReportData(processedData);
        } else {
          setError("Installation Report not found.");
          Swal.fire("Error", `Report with ID ${reportId} not found.`, "error");
        }
      } catch (err: any) {
        console.error("Error fetching installation report data: ", err);
        setError(`Failed to fetch report data: ${err.message}`);
        Swal.fire("Error", `Failed to fetch report data: ${err.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [reportId]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading report details for ID: {reportId}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-6xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" />
              Error Loading Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/warranty-management/installation-reports-view">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Reports List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Report data could not be loaded.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/dashboard/warranty-management/installation-reports-view">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reports List
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/warranty-management/installation-reports-view" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Installation Reports List
          </Button>
        </Link>
      </div>
      <Card className="max-w-6xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Edit className="mr-2 h-7 w-7 text-primary" />
            Edit Installation Report
          </CardTitle>
          <CardDescription>
            Modify the details for Report ID: <span className="font-semibold text-foreground">{reportId}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditInstallationReportForm initialData={reportData} reportId={reportId} />
        </CardContent>
      </Card>
    </div>
  );
}
