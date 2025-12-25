
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useParams, useRouter } from 'next/navigation';
import { FileEdit as FileEditIcon, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { LCEntryDocument } from '@/types';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import { createLazyComponent } from '@/lib/lazy-load';

// Lazy load the large form component
const EditLCEntryForm = createLazyComponent(
  () => import('@/components/forms/financial').then(mod => ({ default: mod.EditLCEntryForm }))
);

export default function EditLCPage() {
  const params = useParams();
  const router = useRouter();
  const lcId = params.lcId as string;

  const [lcData, setLcData] = useState<LCEntryDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDirectPrint = useCallback(() => {
    window.print();
  }, []);

  useEffect(() => {
    if (lcId) {
      const fetchLCData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const lcDocRef = doc(firestore, "lc_entries", lcId);
          const lcDocSnap = await getDoc(lcDocRef);

          if (lcDocSnap.exists()) {
            setLcData({ id: lcDocSnap.id, ...lcDocSnap.data() } as LCEntryDocument);
          } else {
            setError("L/C entry not found.");
            Swal.fire("Error", `L/C with ID ${lcId} not found.`, "error");
          }
        } catch (err: any) {
          console.error("Error fetching L/C data: ", err);
          setError(`Failed to fetch L/C data: ${err.message}`);
          Swal.fire("Error", `Failed to fetch L/C data: ${err.message}`, "error");
        } finally {
          setIsLoading(false);
        }
      };
      fetchLCData();
    } else {
      setError("No L/C ID provided.");
      setIsLoading(false);
      Swal.fire("Error", "No L/C ID specified in the URL.", "error").then(() => {
        router.push('/dashboard/total-lc');
      });
    }
  }, [lcId, router]);

  useEffect(() => {
    const handlePageKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        handleDirectPrint();
      }
    };

    window.addEventListener('keydown', handlePageKeyDown);
    return () => {
      window.removeEventListener('keydown', handlePageKeyDown);
    };
  }, [handleDirectPrint]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading L/C details for ID: {lcId}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-3xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" />
              Error Loading L/C
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/total-lc">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to L/C List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!lcData) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">L/C entry data could not be loaded.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/dashboard/total-lc">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to L/C List
          </Link>
        </Button>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-8 px-5">
      <div className="mb-6 flex justify-between items-center">
        <Link href="/dashboard/total-lc" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to L/C List
          </Button>
        </Link>
      </div>
      <Card className="max-w-7xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FileEditIcon className="h-7 w-7 text-primary" />
            Edit L/C Entry
          </CardTitle>
          <CardDescription>
            Modify the details for L/C ID: <span className="font-semibold text-foreground">{lcId}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditLCEntryForm initialData={lcData} lcId={lcId} />
        </CardContent>
      </Card>
    </div>
  );
}
