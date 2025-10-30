
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CalendarClock, Info, AlertTriangle, ExternalLink, PlusCircle, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import type { LCEntryDocument, Currency } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy as firestoreOrderBy, doc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';


interface DeferredPaymentRecord {
    id: string;
    documentaryCreditNumber?: string;
    applicantName?: string;
    beneficiaryName?: string;
    lcValue?: number;
    lcCurrency?: Currency;
    shipmentValue?: number;
    termsOfPay?: string;
    isFirstShipment?: boolean;
    isSecondShipment?: boolean;
    isThirdShipment?: boolean;
    shipmentDate: string;
    maturityDate: string;
    remainingDays?: number;
    shipmentMode?: string;
    status: 'Payment Pending' | 'Payment Done';
}


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
  const router = useRouter();
  const [deferredPayments, setDeferredPayments] = useState<DeferredPaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchDeferredPayments = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const trackerRef = collection(firestore, "deferred_payment_tracker");
        const q = query(trackerRef, firestoreOrderBy("maturityDate", "asc"));
        const querySnapshot = await getDocs(q);
        const fetchedRecords = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeferredPaymentRecord));
        setDeferredPayments(fetchedRecords);
      } catch (error: any) {
        console.error("Error fetching deferred payment tracker data: ", error);
        let errorMessage = `Could not fetch tracker data. Please ensure Firestore rules allow reads.`;
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

  useEffect(() => {
    fetchDeferredPayments();
  }, []);
  
  const handleEdit = (id: string) => {
    router.push(`/dashboard/deferred-payment-tracker/edit/${id}`);
  };

  const handleDelete = async (id: string) => {
    Swal.fire({
        title: 'Are you sure?',
        text: "This will permanently delete this tracking entry. This action cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(firestore, "deferred_payment_tracker", id));
                Swal.fire('Deleted!', 'The tracking entry has been deleted.', 'success');
                fetchDeferredPayments(); // Refetch data
            } catch (e: any) {
                Swal.fire('Error', `Could not delete the entry: ${e.message}`, 'error');
            }
        }
    });
  };

  return (
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl max-w-7xl mx-auto">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <CalendarClock className="h-7 w-7 text-primary" />
                Deferred Payment Tracker
              </CardTitle>
              <CardDescription>
                A list of all deferred payment entries, sorted by maturity date.
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
              <p className="text-muted-foreground">Loading deferred payment records...</p>
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
              <p className="text-xl font-semibold text-muted-foreground">No Deferred Payment Records Found</p>
              <p className="text-sm text-muted-foreground text-center">There are no deferred payment tracking entries in the database yet.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>LC No.</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Beneficiary</TableHead>
                    <TableHead>L/C Value</TableHead>
                    <TableHead>Shipment Value</TableHead>
                    <TableHead>Deferred Period</TableHead>
                    <TableHead>Partial</TableHead>
                    <TableHead>Shipment Date</TableHead>
                    <TableHead>Maturity Date</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deferredPayments.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.documentaryCreditNumber || 'N/A'}</TableCell>
                      <TableCell>{entry.applicantName || 'N/A'}</TableCell>
                      <TableCell>{entry.beneficiaryName || 'N/A'}</TableCell>
                      <TableCell>{formatCurrencyValue(entry.lcCurrency, entry.lcValue)}</TableCell>
                      <TableCell>{formatCurrencyValue(entry.lcCurrency, entry.shipmentValue)}</TableCell>
                      <TableCell>{entry.termsOfPay || 'N/A'}</TableCell>
                      <TableCell>
                          {entry.isFirstShipment && <Badge variant="secondary">1st</Badge>}
                          {entry.isSecondShipment && <Badge variant="secondary">2nd</Badge>}
                          {entry.isThirdShipment && <Badge variant="secondary">3rd</Badge>}
                      </TableCell>
                      <TableCell>{formatDisplayDate(entry.shipmentDate)}</TableCell>
                      <TableCell>{formatDisplayDate(entry.maturityDate)}</TableCell>
                      <TableCell className="font-semibold text-destructive">{entry.remainingDays ? `${entry.remainingDays} days` : 'N/A'}</TableCell>
                      <TableCell>
                          <Badge variant={entry.status === 'Payment Done' ? 'default' : 'destructive'}>{entry.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                      <span className="sr-only">Open menu</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => handleEdit(entry.id)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      <span>Edit</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDelete(entry.id)} className="text-destructive focus:text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      <span>Delete</span>
                                  </DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
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
