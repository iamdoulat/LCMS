
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, PackageCheck, Info, AlertTriangle } from 'lucide-react';
import type { LCEntryDocument, LCStatus } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

interface CompletedLC extends Pick<LCEntryDocument, 'id' | 'documentaryCreditNumber' | 'beneficiaryName' | 'status'> {
  updatedAtDate: Date;
}

const getStatusBadgeVariant = (status?: LCStatus): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case 'Draft':
      return 'outline';
    case 'Transmitted':
      return 'secondary';
    case 'Shipping pending':
      return 'default';
    case 'Shipping going on':
      return 'default';
    case 'Done':
      return 'default'; // Green color for 'Done'
    default:
      return 'outline';
  }
};

export default function RecentShipmentsPage() {
  const [completedLCs, setCompletedLCs] = useState<CompletedLC[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompletedLCs = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const lcEntriesRef = collection(firestore, "lc_entries");
        // This query requires a composite index on 'status' (asc) and 'updatedAt' (desc)
        const q = query(lcEntriesRef, where("status", "==", "Done"), orderBy("updatedAt", "desc"));
        const querySnapshot = await getDocs(q);

        const fetchedLCs = querySnapshot.docs.map(doc => {
          const data = doc.data() as LCEntryDocument;
          let updatedAtDate = new Date(0); // Fallback to a default date

          if (data.updatedAt) {
            if (typeof (data.updatedAt as unknown as Timestamp).toDate === 'function') {
              updatedAtDate = (data.updatedAt as unknown as Timestamp).toDate();
            } else if (typeof data.updatedAt === 'string') {
              const parsed = parseISO(data.updatedAt);
              if (isValid(parsed)) {
                updatedAtDate = parsed;
              } else {
                console.warn(`Invalid date string for updatedAt: ${data.updatedAt} for L/C ID: ${doc.id}`);
              }
            } else {
               console.warn(`Unexpected type for updatedAt for L/C ID: ${doc.id}`, data.updatedAt);
            }
          } else {
            console.warn(`Missing updatedAt for L/C ID: ${doc.id}`);
          }

          return {
            id: doc.id,
            documentaryCreditNumber: data.documentaryCreditNumber,
            beneficiaryName: data.beneficiaryName,
            updatedAtDate: updatedAtDate,
            status: data.status,
          };
        });
        setCompletedLCs(fetchedLCs);
      } catch (error: any) {
        console.error("Error fetching completed L/Cs: ", error);
        let errorMessage = `Could not fetch completed L/C data. Please ensure Firestore rules allow reads.`;
        if (error.message && error.message.includes("indexes?create_composite")) {
            errorMessage = `Could not fetch completed L/C data: A Firestore index is required. Please check the browser console for a link to create the index, or create it manually for the 'lc_entries' collection on 'status' (ascending) and 'updatedAt' (descending).`;
        } else if (error.message) {
            errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire({
          title: "Fetch Error",
          html: errorMessage.replace(/\b(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary hover:underline">$1</a>'), // Make links clickable
          icon: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompletedLCs();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <PackageCheck className="h-7 w-7 text-primary" />
            Recently Completed L/Cs
          </CardTitle>
          <CardDescription>
            List of Letters of Credit marked as &quot;Done&quot;, sorted by most recent completion date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading completed L/Cs from database...</p>
            </div>
          ) : fetchError ? (
             <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap">{fetchError}</p>
            </div>
          ) : completedLCs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No L/Cs Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no L/Cs currently marked as &quot;Done&quot; in the database, or the required Firestore index is missing/still building.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {completedLCs.map((lc) => (
                <li key={lc.id} className="p-4 rounded-lg border hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1">
                    <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="font-semibold text-primary hover:underline text-lg mb-1 sm:mb-0">
                      {lc.documentaryCreditNumber || 'N/A'}
                    </Link>
                    <Badge
                      variant={getStatusBadgeVariant(lc.status)}
                      className={lc.status === 'Done' ? 'bg-green-600 text-white' : ''}
                    >
                      {lc.status || 'N/A'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Beneficiary: <span className="font-medium text-foreground">{lc.beneficiaryName || 'N/A'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Completed: {isValid(lc.updatedAtDate) && lc.updatedAtDate.getFullYear() > 1 ? format(lc.updatedAtDate, 'PPP p') : 'Date not available'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
