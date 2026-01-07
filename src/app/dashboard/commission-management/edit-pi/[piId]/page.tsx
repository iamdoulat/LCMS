
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useParams, useRouter } from 'next/navigation';
import { FileEdit as FileEditIcon, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EditCommissionInvoiceForm } from '../../components/EditCommissionInvoiceForm';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { ProformaInvoiceDocument } from '@/types';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

export default function EditProformaInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const piId = params.piId as string;

  const [piData, setPiData] = useState<ProformaInvoiceDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (piId) {
      const fetchPiData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const piDocRef = doc(firestore, "proforma_invoices", piId);
          const piDocSnap = await getDoc(piDocRef);

          if (piDocSnap.exists()) {
            setPiData({ id: piDocSnap.id, ...piDocSnap.data() } as ProformaInvoiceDocument);
          } else {
            setError("Commission Invoice not found.");
            Swal.fire("Error", `Invoice with ID ${piId} not found.`, "error");
          }
        } catch (err: any) {
          console.error("Error fetching PI data: ", err);
          setError(`Failed to fetch PI data: ${err.message}`);
          Swal.fire("Error", `Failed to fetch PI data: ${err.message}`, "error");
        } finally {
          setIsLoading(false);
        }
      };
      fetchPiData();
    } else {
      setError("No PI ID provided.");
      setIsLoading(false);
      Swal.fire("Error", "No PI ID specified in the URL.", "error").then(() => {
        router.push('/dashboard/commission-management/issued-pi-list');
      });
    }
  }, [piId, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading invoice details for ID: {piId}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-4xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" />
              Error Loading Invoice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/commission-management/issued-pi-list">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Issued PI List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!piData) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Invoice data could not be loaded.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/dashboard/commission-management/issued-pi-list">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Issued PI List
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="m-[25px]">
      <div className="mb-6">
        <Link href="/dashboard/commission-management/issued-pi-list" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Issued PI List
          </Button>
        </Link>
      </div>
      <Card className="w-full shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FileEditIcon className="h-7 w-7 text-primary" />
            Edit Commission Invoice (PI)
          </CardTitle>
          <CardDescription>
            Modify the details for Invoice ID: <span className="font-semibold text-foreground">{piId}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditCommissionInvoiceForm initialData={piData} piId={piId} />
        </CardContent>
      </Card>
    </div>
  );
}
