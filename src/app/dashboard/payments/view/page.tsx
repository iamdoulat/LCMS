
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ListChecks, Info, AlertTriangle, DollarSign, CalendarDays, CreditCardIcon, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { format, parseISO, isValid } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';

interface PaymentRecord {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  paymentAmount: number;
  paymentDate: string; // ISO string
  paymentMethod: string;
  notes?: string;
  createdAt: any; // Firestore Timestamp
}

const formatDisplayDate = (dateString?: string | null | Timestamp): string => {
  if (!dateString) return 'N/A';
  try {
    const date = dateString instanceof Timestamp ? dateString.toDate() : parseISO(dateString as string);
    return isValid(date) ? format(date, 'PPP p') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};


const formatCurrencyValue = (amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `USD N/A`;
  return `USD ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function ViewPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPayments = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const paymentsCollectionRef = collection(firestore, "payments");
        const q = query(paymentsCollectionRef, orderBy("paymentDate", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedPayments = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            invoiceId: data.invoiceId,
            invoiceNumber: data.invoiceNumber,
            customerId: data.customerId,
            customerName: data.customerName,
            paymentAmount: data.paymentAmount,
            paymentDate: data.paymentDate instanceof Timestamp ? data.paymentDate.toDate().toISOString() : data.paymentDate,
            paymentMethod: data.paymentMethod,
            notes: data.notes,
            createdAt: data.createdAt,
          } as PaymentRecord;
        });
        setPayments(fetchedPayments);
      } catch (error: any) {
        console.error("Error fetching payments:", error);
        let errorMessage = "Could not fetch payment records. Please ensure Firestore rules allow reads for 'payments' collection.";
        if (error.message?.toLowerCase().includes("index")) {
          errorMessage = "Could not fetch payments: A Firestore index might be required. Check console for details.";
        } else if (error.message) {
          errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire("Fetch Error", errorMessage, "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPayments();
  }, []);

  return (
    <div className="max-w-none mx-[25px] py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <ListChecks className="h-7 w-7 text-primary" />
            View Payments
          </CardTitle>
          <CardDescription>
            A list of all recorded payments applied to invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading payment records...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center">{fetchError}</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Payments Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no payment records in the database yet.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Invoice No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead><DollarSign className="inline h-4 w-4 mr-1" />Amount Paid</TableHead>
                    <TableHead><CalendarDays className="inline h-4 w-4 mr-1" />Payment Date</TableHead>
                    <TableHead><CreditCardIcon className="inline h-4 w-4 mr-1" />Method</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium truncate max-w-[100px]">{payment.id}</TableCell>
                      <TableCell>
                        <Link href={`/dashboard/invoices/preview/${payment.invoiceId}`} passHref>
                          <Button variant="link" className="p-0 h-auto text-primary hover:underline">
                            {payment.invoiceNumber} <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        </Link>
                      </TableCell>
                      <TableCell>{payment.customerName}</TableCell>
                      <TableCell>{formatCurrencyValue(payment.paymentAmount)}</TableCell>
                      <TableCell>{formatDisplayDate(payment.paymentDate)}</TableCell>
                      <TableCell>{payment.paymentMethod}</TableCell>
                      <TableCell className="truncate max-w-[200px]" title={payment.notes}>{payment.notes || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableCaption>A list of recorded payments.</TableCaption>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
