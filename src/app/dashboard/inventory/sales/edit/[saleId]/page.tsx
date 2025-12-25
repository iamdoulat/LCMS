

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useParams, useRouter } from 'next/navigation';
import { DollarSign, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EditSaleForm } from '@/components/forms/crm';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { SaleDocument } from '@/types';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import { parseISO, isValid } from 'date-fns';

export default function EditSalePage() {
  const params = useParams();
  const router = useRouter();
  const saleId = params.saleId as string;

  const [saleData, setSaleData] = useState<SaleDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSaleData = useCallback(async () => {
    if (!saleId) {
      setError("No Sale ID provided.");
      setIsLoading(false);
      Swal.fire("Error", "No Sale ID specified.", "error").then(() => {
        router.push('/dashboard/inventory/sales-invoices');
      });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const saleDocRef = doc(firestore, "sales_invoice", saleId);
      const saleDocSnap = await getDoc(saleDocRef);

      if (saleDocSnap.exists()) {
        const data = saleDocSnap.data() as Omit<SaleDocument, 'id'>;
        const processedData: SaleDocument = {
          ...data,
          id: saleDocSnap.id,
          invoiceDate: data.invoiceDate && isValid(parseISO(data.invoiceDate)) ? data.invoiceDate : new Date().toISOString(),
          lineItems: data.lineItems.map(item => ({
            ...item,
          })),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        };
        setSaleData(processedData);
      } else {
        setError("Sale record not found.");
        Swal.fire("Error", `Sale with ID ${saleId} not found.`, "error").then(() => {
             router.push('/dashboard/inventory/sales-invoices');
        });
      }
    } catch (err: any) {
      setError(`Failed to fetch sale data: ${err.message}`);
      Swal.fire("Error", `Failed to fetch sale data: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [saleId, router]);

  useEffect(() => {
    fetchSaleData();
  }, [fetchSaleData]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading sale details for ID: {saleId}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-screen-2xl mx-auto shadow-xl border-destructive">
          <CardHeader><CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive"><AlertTriangle className="h-7 w-7" />Error Loading Sale</CardTitle></CardHeader>
          <CardContent><p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4"><Link href="/dashboard/inventory/sales-invoices"><ArrowLeft className="mr-2 h-4 w-4" />Back to Sales Invoices List</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!saleData) {
     return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Sale data could not be loaded.</p>
         <Button variant="outline" asChild className="mt-4"><Link href="/dashboard/inventory/sales-invoices"><ArrowLeft className="mr-2 h-4 w-4" />Back to Sales Invoices List</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6"><Link href="/dashboard/inventory/sales-invoices" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Sales Invoices List</Button></Link></div>
      <Card className="max-w-screen-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <DollarSign className="h-7 w-7 text-primary" />Edit Sale Invoice
          </CardTitle>
          <CardDescription>Modify the details for Sale ID: <span className="font-semibold text-foreground">{saleId}</span>.</CardDescription>
        </CardHeader>
        <CardContent><EditSaleForm initialData={saleData} saleId={saleId} /></CardContent>
      </Card>
    </div>
  );
}
