
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CalendarClock, Loader2, AlertTriangle, Info, Edit, User, Phone, FileText as NoteIcon, FileBadge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { DemoMachineApplicationDocument } from '@/types';
import { format, parseISO, isValid, startOfDay, isPast } from 'date-fns';
import Swal from 'sweetalert2';
import { Badge } from '@/components/ui/badge';

const formatDisplayDate = (dateString?: string | null | Timestamp): string => {
  if (!dateString) return 'N/A';
  let date: Date;
  if (dateString instanceof Timestamp) {
    date = dateString.toDate();
  } else if (typeof dateString === 'string') {
    try {
      const parsed = parseISO(dateString);
      date = isValid(parsed) ? parsed : new Date(0); 
    } catch (e) {
      return 'N/A';
    }
  } else {
    return 'N/A';
  }
  return date && isValid(date) && date.getFullYear() > 1 ? format(date, 'PPP') : 'N/A';
};

const formatReportValue = (value: string | number | undefined | null, defaultValue: string = 'N/A'): string => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue;
  }
  return String(value);
};

export default function DemoMcDateOverduePage() {
  const [overdueApplications, setOverdueApplications] = useState<DemoMachineApplicationDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverdueApplications = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const applicationsCollectionRef = collection(firestore, "demo_machine_applications");
        const q = query(applicationsCollectionRef, orderBy("estReturnDate", "asc"));
        const querySnapshot = await getDocs(q);
        const fetchedApplications = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            deliveryDate: data.deliveryDate instanceof Timestamp ? data.deliveryDate.toDate().toISOString() : data.deliveryDate,
            estReturnDate: data.estReturnDate instanceof Timestamp ? data.estReturnDate.toDate().toISOString() : data.estReturnDate,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          } as DemoMachineApplicationDocument;
        });

        const today = startOfDay(new Date());
        const filteredOverdue = fetchedApplications.filter(app => {
          if (!app.estReturnDate) return false;
          const estReturn = startOfDay(parseISO(app.estReturnDate));
          return isValid(estReturn) && isPast(estReturn) && !(app.machineReturned === true);
        });

        setOverdueApplications(filteredOverdue);

      } catch (error: any) {
        console.error("Error fetching overdue demo machine applications: ", error);
        let errorMessage = `Could not fetch overdue applications. Please check Firestore rules.`;
         if (error.message?.toLowerCase().includes("index")) {
            errorMessage = `Could not fetch data: A Firestore index might be required. Please check the browser console for a link to create it.`;
        } else if (error.code === 'permission-denied' || error.message?.toLowerCase().includes("permission")) {
           errorMessage = `Could not fetch data: Missing or insufficient permissions for 'demo_machine_applications'. Please check Firestore security rules.`;
        } else if (error.message) {
            errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire("Fetch Error", errorMessage, "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchOverdueApplications();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <CalendarClock className="h-7 w-7 text-primary" />
            Demo M/C Date Overdue
          </CardTitle>
          <CardDescription>
            List of demo machine applications whose estimated return date has passed and are not marked as returned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading overdue demo applications...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap">{fetchError}</p>
            </div>
          ) : overdueApplications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Overdue Applications Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no demo machine applications currently overdue or all overdue machines have been marked as returned.
              </p>
            </div>
          ) : (
             <ul className="space-y-4 max-h-[calc(100vh-20rem)] overflow-y-auto p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {overdueApplications.map((app) => (
                <li key={app.id} className="p-4 rounded-lg border-2 border-destructive bg-destructive/10 hover:shadow-md transition-shadow relative">
                   <div className="absolute top-3 right-3 flex flex-col items-end gap-1 z-10">
                        <Badge variant="destructive" className="text-xs px-2 py-0.5">Overdue</Badge>
                        <div className="flex gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7 bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                              <Link href={`/dashboard/demo/edit-demo-machine-application/${app.id}`}>
                                <Edit className="h-4 w-4" /> <span className="sr-only">Edit Application</span>
                              </Link>
                            </Button>
                        </div>
                    </div>
                  <CardHeader className="pb-3 pt-0 px-0 pr-20">
                    <Link href={`/dashboard/demo/edit-demo-machine-application/${app.id}`} passHref>
                        <CardTitle className="text-lg font-semibold text-primary hover:underline mb-1 truncate cursor-pointer">
                        {formatReportValue(app.factoryName)} - {formatReportValue(app.machineModel)}
                        </CardTitle>
                    </Link>
                    <CardDescription className="text-xs text-foreground">
                      Model: {formatReportValue(app.machineModel)} | Serial: {formatReportValue(app.machineSerial)} | Brand: {formatReportValue(app.machineBrand)}
                      {app.challanNo && ` | Challan: ${formatReportValue(app.challanNo)}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-0 pb-0 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm mb-2">
                      <div><span className="text-muted-foreground">Delivery: </span><span className="font-medium text-foreground">{formatDisplayDate(app.deliveryDate)}</span></div>
                      <div><span className="text-muted-foreground">Est. Return: </span><span className="font-medium text-destructive">{formatDisplayDate(app.estReturnDate)}</span></div>
                      <div><span className="text-muted-foreground">Period: </span><span className="font-medium text-foreground">{formatReportValue(app.demoPeriodDays, "0")} Day(s)</span></div>
                      {app.factoryInchargeName && (
                        <div><User className="inline-block mr-1 h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Incharge: </span><span className="font-medium text-foreground truncate" title={app.factoryInchargeName}>{app.factoryInchargeName}</span></div>
                      )}
                      {app.inchargeCell && (
                        <div><Phone className="inline-block mr-1 h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Cell: </span><span className="font-medium text-foreground truncate" title={app.inchargeCell}>{app.inchargeCell}</span></div>
                      )}
                       {app.challanNo && ( // Ensure Challan no is also displayed if moved here
                        <div><FileBadge className="inline-block mr-1 h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Challan: </span><span className="font-medium text-foreground truncate" title={app.challanNo}>{app.challanNo}</span></div>
                      )}
                    </div>
                    {app.notes && (
                        <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground flex items-center"><NoteIcon className="mr-1 h-3.5 w-3.5" />Expected Result/Notes:</p>
                            <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded-md">{app.notes}</p>
                        </div>
                    )}
                     <div className="mt-2 text-xs text-muted-foreground text-right">
                      Applied: {formatDisplayDate(app.createdAt)}
                    </div>
                  </CardContent>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
    
    

    