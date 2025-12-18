
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useParams, useRouter } from 'next/navigation';
import { Edit, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EditQuoteForm } from '@/components/forms/EditQuoteForm'; 
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { QuoteDocument } from '@/types';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import { parseISO, isValid } from 'date-fns';

export default function EditQuotePage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.quoteId as string;

  const [quoteData, setQuoteData] = useState<QuoteDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuoteData = useCallback(async () => {
    if (!quoteId) {
      setError("No Quote ID provided.");
      setIsLoading(false);
      Swal.fire("Error", "No Quote ID specified.", "error").then(() => {
        router.push('/dashboard/quotations/list');
      });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const quoteDocRef = doc(firestore, "quotes", quoteId);
      const quoteDocSnap = await getDoc(quoteDocRef);

      if (quoteDocSnap.exists()) {
        const data = quoteDocSnap.data() as Omit<QuoteDocument, 'id'>;
        const processedData: QuoteDocument = {
          ...data,
          id: quoteDocSnap.id,
          quoteDate: data.quoteDate && isValid(parseISO(data.quoteDate)) ? data.quoteDate : new Date().toISOString(), // Fallback to now if invalid
          lineItems: data.lineItems.map(item => ({ ...item, imageUrl: item.imageUrl || '' })),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        };
        setQuoteData(processedData);
      } else {
        setError("Quote not found.");
        Swal.fire("Error", `Quote with ID ${quoteId} not found.`, "error").then(() => {
             router.push('/dashboard/quotations/list');
        });
      }
    } catch (err: any) {
      setError(`Failed to fetch quote data: ${err.message}`);
      Swal.fire("Error", `Failed to fetch quote data: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [quoteId, router]);

  useEffect(() => {
    fetchQuoteData();
  }, [fetchQuoteData]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading quote details for ID: {quoteId}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-5">
        <Card className="max-w-screen-2xl mx-auto shadow-xl border-destructive">
          <CardHeader><CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive"><AlertTriangle className="h-7 w-7" />Error Loading Quote</CardTitle></CardHeader>
          <CardContent><p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4"><Link href="/dashboard/quotations/list"><ArrowLeft className="mr-2 h-4 w-4" />Back to Quotes List</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quoteData) {
     return (
      <div className="container mx-auto py-8 text-center px-5">
        <p className="text-muted-foreground">Quote data could not be loaded.</p>
         <Button variant="outline" asChild className="mt-4"><Link href="/dashboard/quotations/list"><ArrowLeft className="mr-2 h-4 w-4" />Back to Quotes List</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-5">
      <div className="mb-6">
        <Link href="/dashboard/quotations/list" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Quotes List
          </Button>
        </Link>
      </div>
      <Card className="max-w-screen-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Edit className="h-7 w-7 text-primary" />
            Edit Quote
          </CardTitle>
          <CardDescription>
            Modify the details for Quote ID: <span className="font-semibold text-foreground">{quoteId}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditQuoteForm initialData={quoteData} quoteId={quoteId} />
        </CardContent>
      </Card>
    </div>
  );
}
