
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CalendarClock, Info, AlertTriangle, ExternalLink, PlusCircle } from 'lucide-react';
import type { LCEntryDocument } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, orderBy as firestoreOrderBy } from 'firebase/firestore';
import Link from 'next/link';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formatDisplayDate = (dateString?: string | Date) => {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? format(date, 'PPP') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (currency?: string, amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currency || ''} N/A`;
  return `${currency || ''} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function DeferredPaymentTrackerPage() {
  const [deferredPayments, setDeferredPayments] = useState<LCEntryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeferredPayments = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const lcEntriesRef = collection(firestore, "lc_entries");
        const deferredTerms = ["Deferred 60days", "Deferred 120days", "Deferred 180days", "Deferred 360days"];
        const q = query(
          lcEntriesRef, 
          where("termsOfPay", "in", deferredTerms),
          where("status", "array-contains", "Payment Pending"),
          firestoreOrderBy("paymentMaturityDate", "asc")
        );
        const querySnapshot = await getDocs(q);
        const fetchedLCs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LCEntryDocument));
        setDeferredPayments(fetchedLCs);
      } catch (error: any) {
        console.error("Error fetching deferred payment L/Cs: ", error);
        let errorMessage = `Could not fetch L/C data for deferred payments. Please ensure Firestore rules allow reads.`;
         if (error.message?.toLowerCase().includes("index")) {
            errorMessage = `A Firestore index is required for this query. Please check the browser console for a link to create it automatically.`;
        } else if (error.message) {
            errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire({
          title: "Fetch Error",
          html: errorMessage,
          icon: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchDeferredPayments();
  }, []);

  return (
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <CalendarClock className="h-7 w-7 text-primary" />
                Deferred Payment Tracker
              </CardTitle>
              <CardDescription>
                A list of all L/Cs with deferred payment terms that are currently pending payment, sorted by maturity date.
              </CardDescription>
            </div>
            <Link href="/dashboard/shipments/payment-tracking-entry" passHref>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Payment Tracking Entry
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading deferred payment L/Cs...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: fetchError.replace(/\b(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary hover:underline">$1</a>') }}></p>
            </div>
          ) : deferredPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Pending Deferred Payments</p>
              <p className="text-sm text-muted-foreground text-center">There are no L/Cs with deferred payment terms currently awaiting payment.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>L/C Number</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Beneficiary</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Terms of Pay</TableHead>
                    <TableHead>Payment Maturity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deferredPayments.map((lc) => (
                    <TableRow key={lc.id}>
                      <TableCell className="font-medium">{lc.documentaryCreditNumber}</TableCell>
                      <TableCell>{lc.applicantName}</TableCell>
                      <TableCell>{lc.beneficiaryName}</TableCell>
                      <TableCell>{formatCurrencyValue(lc.currency, lc.amount)}</TableCell>
                      <TableCell>{lc.termsOfPay}</TableCell>
                      <TableCell className="font-semibold text-destructive">{lc.paymentMaturityDate || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/total-lc/${lc.id}/edit`}>
                            <ExternalLink className="mr-2 h-4 w-4" /> View L/C
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
