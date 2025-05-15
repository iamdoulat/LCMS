
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CalendarClock, Info, AlertTriangle, ExternalLink } from 'lucide-react';
import type { LCEntryDocument, LCStatus } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import Link from 'next/link';
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Swal from 'sweetalert2';

interface UpcomingLC extends Pick<LCEntryDocument, 'id' | 'documentaryCreditNumber' | 'beneficiaryName' | 'status'> {
  latestShipmentDateObj: Date;
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
      return 'default'; 
    default:
      return 'outline';
  }
};

const formatDisplayDate = (dateString?: string | Date): string => {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
  } catch (e) {
    return 'Invalid Date Format';
  }
};

const ACTIVE_LC_STATUSES: LCStatus[] = ["Draft", "Transmitted", "Shipping pending", "Shipping going on"];

export default function UpcomingShipmentsPage() {
  const [upcomingLCs, setUpcomingLCs] = useState<UpcomingLC[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUpcomingLCs = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const lcEntriesRef = collection(firestore, "lc_entries");
        // Query for active L/Cs, order by latestShipmentDate (nearest first), limit to 30
        const q = query(
          lcEntriesRef,
          where("status", "in", ACTIVE_LC_STATUSES),
          orderBy("latestShipmentDate", "asc"),
          limit(30)
        );
        const querySnapshot = await getDocs(q);

        const fetchedLCs = querySnapshot.docs.map(doc => {
          const data = doc.data() as LCEntryDocument;
          let latestShipmentDateObj = new Date(0); 

          if (data.latestShipmentDate) {
            // Handle both Firestore Timestamp and ISO string dates
            if (typeof (data.latestShipmentDate as unknown as Timestamp).toDate === 'function') {
              latestShipmentDateObj = (data.latestShipmentDate as unknown as Timestamp).toDate();
            } else if (typeof data.latestShipmentDate === 'string') {
              const parsed = parseISO(data.latestShipmentDate);
              if (isValid(parsed)) {
                latestShipmentDateObj = parsed;
              } else {
                console.warn(`Invalid date string for latestShipmentDate: ${data.latestShipmentDate} for L/C ID: ${doc.id}`);
              }
            } else {
               console.warn(`Unexpected type for latestShipmentDate for L/C ID: ${doc.id}`, data.latestShipmentDate);
            }
          } else {
            console.warn(`Missing latestShipmentDate for L/C ID: ${doc.id}`);
          }

          return {
            id: doc.id,
            documentaryCreditNumber: data.documentaryCreditNumber,
            beneficiaryName: data.beneficiaryName,
            latestShipmentDateObj: latestShipmentDateObj,
            status: data.status,
          };
        });
        setUpcomingLCs(fetchedLCs);
      } catch (error: any) {
        console.error("Error fetching upcoming L/Cs: ", error);
        let errorMessage = `Could not fetch upcoming L/C data. Please ensure Firestore rules allow reads.`;
        if (error.message && error.message.includes("indexes?create_composite")) {
            errorMessage = `Could not fetch upcoming L/C data. This query likely requires a composite Firestore index. Please check your browser's developer console for a direct link to create it. The index is needed on the 'lc_entries' collection for fields: 'status' (ascending) and 'latestShipmentDate' (ascending).`;
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

    fetchUpcomingLCs();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <CalendarClock className="h-7 w-7" />
            Upcoming L/C Shipment Dates
          </CardTitle>
          <CardDescription>
            List of active Letters of Credit approaching their latest shipment date (up to 30).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading upcoming L/Cs from database...</p>
            </div>
          ) : fetchError ? (
             <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap">{fetchError}</p>
            </div>
          ) : upcomingLCs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Upcoming L/Cs Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no active L/Cs nearing their shipment date, or the required Firestore index is missing/still building.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {upcomingLCs.map((lc) => (
                <li key={lc.id} className="p-4 rounded-lg border hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1">
                    <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="font-semibold text-primary hover:underline text-lg mb-1 sm:mb-0">
                      {lc.documentaryCreditNumber || 'N/A'}
                    </Link>
                     <Badge
                        variant={getStatusBadgeVariant(lc.status)}
                        className={
                            lc.status === 'Shipping going on' ? 'bg-orange-500 text-white' :
                            lc.status === 'Shipping pending' ? 'bg-yellow-500 text-black' : ''
                        }
                        >
                        {lc.status || 'N/A'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Beneficiary: <span className="font-medium text-foreground">{lc.beneficiaryName || 'N/A'}</span>
                  </p>
                  <p className="text-sm text-foreground">
                    Latest Shipment Date: <span className="font-semibold">{formatDisplayDate(lc.latestShipmentDateObj)}</span>
                  </p>
                   <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="text-xs text-primary hover:underline mt-1 inline-flex items-center">
                     View L/C Details <ExternalLink className="ml-1 h-3 w-3"/>
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
