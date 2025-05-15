
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, PackageCheck, Info } from 'lucide-react';
import type { LCEntryDocument, LCStatus } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Swal from 'sweetalert2';

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

  useEffect(() => {
    const fetchCompletedLCs = async () => {
      setIsLoading(true);
      try {
        const lcEntriesRef = collection(firestore, "lc_entries");
        const q = query(lcEntriesRef, where("status", "==", "Done"), orderBy("updatedAt", "desc"));
        const querySnapshot = await getDocs(q);

        const fetchedLCs = querySnapshot.docs.map(doc => {
          const data = doc.data() as LCEntryDocument;
          let updatedAtDate = new Date(); // Fallback
          if (data.updatedAt) {
            if (typeof (data.updatedAt as unknown as Timestamp).toDate === 'function') {
              updatedAtDate = (data.updatedAt as unknown as Timestamp).toDate();
            } else if (typeof data.updatedAt === 'string') {
              const parsed = parseISO(data.updatedAt);
              if (isValid(parsed)) {
                updatedAtDate = parsed;
              }
            }
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
      } catch (error) {
        console.error("Error fetching completed L/Cs: ", error);
        Swal.fire({
          title: "Error",
          text: `Could not fetch completed L/C data: ${(error as Error).message}`,
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
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <PackageCheck className="h-7 w-7" />
            Recently Completed L/Cs
          </CardTitle>
          <CardDescription>
            List of Letters of Credit marked as &quot;Done&quot;, sorted by most recent completion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading completed L/Cs...</p>
            </div>
          ) : completedLCs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No L/Cs Found</p>
              <p className="text-sm text-muted-foreground">
                There are no L/Cs currently marked as &quot;Done&quot;.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {completedLCs.map((lc) => (
                <li key={lc.id} className="p-4 rounded-lg border hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-1">
                    <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="font-semibold text-primary hover:underline text-lg">
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
                    Completed: {format(lc.updatedAtDate, 'PPP p')}
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
