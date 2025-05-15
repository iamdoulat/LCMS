
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FileEdit, Info, AlertTriangle, ExternalLink } from 'lucide-react';
import type { LCEntryDocument, LCStatus, Currency } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Swal from 'sweetalert2';

interface DraftLC extends Pick<LCEntryDocument, 'id' | 'documentaryCreditNumber' | 'beneficiaryName' | 'applicantName' | 'status' | 'currency' | 'amount'> {
  createdAtDate: Date;
}

const getStatusBadgeVariant = (status?: LCStatus): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case 'Draft':
      return 'outline'; // Typically blue or neutral for draft
    case 'Transmitted':
      return 'secondary';
    case 'Shipping pending':
      return 'default';
    case 'Shipping going on':
      return 'default';
    case 'Done':
      return 'default';
    default:
      return 'outline';
  }
};

const formatCurrencyValue = (currency?: Currency, amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currency || ''} N/A`;
  return `${currency || ''} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function RecentDraftLCsPage() {
  const [draftLCs, setDraftLCs] = useState<DraftLC[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDraftLCs = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const lcEntriesRef = collection(firestore, "lc_entries");
        // This query requires a composite index on 'status' (asc) and 'createdAt' (desc)
        const q = query(lcEntriesRef, where("status", "==", "Draft"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        const fetchedLCs = querySnapshot.docs.map(doc => {
          const data = doc.data() as LCEntryDocument;
          let createdAtDate = new Date(0); // Fallback to a default date

          if (data.createdAt) {
            if (typeof (data.createdAt as unknown as Timestamp).toDate === 'function') {
              createdAtDate = (data.createdAt as unknown as Timestamp).toDate();
            } else if (typeof data.createdAt === 'string') {
              const parsed = parseISO(data.createdAt);
              if (isValid(parsed)) {
                createdAtDate = parsed;
              } else {
                console.warn(`Invalid date string for createdAt: ${data.createdAt} for L/C ID: ${doc.id}`);
              }
            } else {
               console.warn(`Unexpected type for createdAt for L/C ID: ${doc.id}`, data.createdAt);
            }
          } else {
            console.warn(`Missing createdAt for L/C ID: ${doc.id}`);
          }

          return {
            id: doc.id,
            documentaryCreditNumber: data.documentaryCreditNumber,
            applicantName: data.applicantName,
            beneficiaryName: data.beneficiaryName,
            createdAtDate: createdAtDate,
            status: data.status,
            currency: data.currency,
            amount: data.amount,
          };
        });
        setDraftLCs(fetchedLCs);
      } catch (error: any) {
        console.error("Error fetching draft L/Cs: ", error);
        let errorMessage = `Could not fetch draft L/C data. Please ensure Firestore rules allow reads.`;
        if (error.message && error.message.includes("indexes?create_composite")) {
            errorMessage = `Could not fetch draft L/C data: A Firestore index is required. Please check the browser console for a link to create the index, or create it manually for the 'lc_entries' collection on 'status' (ascending) and 'createdAt' (descending).`;
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

    fetchDraftLCs();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <FileEdit className="h-7 w-7" />
            Recent Draft L/Cs
          </CardTitle>
          <CardDescription>
            List of Letters of Credit currently in "Draft" status, sorted by most recent creation date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading draft L/Cs from database...</p>
            </div>
          ) : fetchError ? (
             <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap">{fetchError}</p>
            </div>
          ) : draftLCs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Draft L/Cs Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no L/Cs currently in "Draft" status, or the required Firestore index is missing/still building.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {draftLCs.map((lc) => (
                <li key={lc.id} className="p-4 rounded-lg border hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1">
                    <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="font-semibold text-primary hover:underline text-lg mb-1 sm:mb-0">
                      {lc.documentaryCreditNumber || 'N/A'}
                    </Link>
                    <Badge
                      variant={getStatusBadgeVariant(lc.status)}
                      className={lc.status === 'Draft' ? 'bg-blue-100 text-blue-700 border-blue-300' : ''}
                    >
                      {lc.status || 'N/A'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Applicant: <span className="font-medium text-foreground">{lc.applicantName || 'N/A'}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mb-1">
                    Beneficiary: <span className="font-medium text-foreground">{lc.beneficiaryName || 'N/A'}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mb-1">
                    Value: <span className="font-medium text-foreground">{formatCurrencyValue(lc.currency, lc.amount)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created: {isValid(lc.createdAtDate) && lc.createdAtDate.getFullYear() > 1 ? format(lc.createdAtDate, 'PPP p') : 'Date not available'}
                  </p>
                   <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="text-xs text-primary hover:underline mt-1 inline-flex items-center">
                     View/Edit L/C <ExternalLink className="ml-1 h-3 w-3"/>
                   </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
