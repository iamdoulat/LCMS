
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AppWindow, FileCode, Loader2, AlertTriangle, Info, Edit, Trash2, CalendarDays, User, Phone, FileText as NoteIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import type { DemoMachineApplicationDocument } from '@/types';
import { format, parseISO, isValid, isPast, isFuture, isToday, startOfDay } from 'date-fns';
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
      date = isValid(parsed) ? parsed : new Date(0); // Fallback for invalid ISO
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

type DemoAppDisplayStatus = "Upcoming" | "Active" | "Overdue" | "Returned";

const getDemoAppStatus = (app: DemoMachineApplicationDocument): DemoAppDisplayStatus => {
    if (app.machineReturned) return "Returned";
    const today = startOfDay(new Date());
    const delivery = app.deliveryDate ? startOfDay(parseISO(app.deliveryDate)) : null;
    const estReturn = app.estReturnDate ? startOfDay(parseISO(app.estReturnDate)) : null;

    if (!delivery || !estReturn) return "Upcoming";

    if (isPast(estReturn)) return "Overdue";
    if ((isToday(delivery) || isPast(delivery)) && (isToday(estReturn) || isFuture(estReturn))) return "Active";
    if (isFuture(delivery)) return "Upcoming";
    
    return "Upcoming";
};

const getDemoStatusBadgeVariant = (status: DemoAppDisplayStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
        case "Active": return "default"; // Green by default in ShadCN
        case "Overdue": return "destructive";
        case "Returned": return "secondary";
        case "Upcoming": return "outline";
        default: return "outline";
    }
};


export default function DemoMachineProgramPage() {
  const [applications, setApplications] = useState<DemoMachineApplicationDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplications = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const applicationsCollectionRef = collection(firestore, "demo_machine_applications");
        const q = query(applicationsCollectionRef, orderBy("createdAt", "desc"));
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
        setApplications(fetchedApplications);
      } catch (error: any) {
        console.error("Error fetching demo machine applications: ", error);
        let errorMessage = `Could not fetch demo machine applications. Please check Firestore rules.`;
         if (error.message?.toLowerCase().includes("index")) {
            errorMessage = `Could not fetch data: A Firestore index might be required for 'demo_machine_applications' ordered by 'createdAt' descending. Please check the browser console for a link to create it.`;
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
    fetchApplications();
  }, []);

  const handleDeleteApplication = (applicationId: string, identifier?: string) => {
    Swal.fire({
        title: 'Are you sure?',
        text: `This will permanently delete the demo machine application "${identifier || applicationId}". This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'hsl(var(--destructive))',
        cancelButtonColor: 'hsl(var(--secondary))',
        confirmButtonText: 'Yes, delete it!',
        reverseButtons: true,
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(firestore, "demo_machine_applications", applicationId));
                setApplications(prev => prev.filter(app => app.id !== applicationId));
                Swal.fire(
                    'Deleted!',
                    `Demo machine application "${identifier || applicationId}" has been removed.`,
                    'success'
                );
            } catch (error: any) {
                console.error("Error deleting demo machine application: ", error);
                Swal.fire(
                    'Error!',
                    `Could not delete application: ${error.message}`,
                    'error'
                );
            }
        }
    });
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <FileCode className="h-7 w-7 text-primary" />
                Demo Machine Program
              </CardTitle>
              <CardDescription>
                Manage programs and software for demo machines. (Displaying Demo Applications List)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" disabled>Filter: All</Button> {/* Placeholder filter button */}
                <Link href="/dashboard/demo/demo-machine-application" passHref>
                <Button variant="default">
                    <AppWindow className="mr-2 h-4 w-4" />
                    New Demo Application
                </Button>
                </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading demo machine applications...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap">{fetchError}</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Applications Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no demo machine applications in the database. Click "New Demo Application" to add one.
              </p>
            </div>
          ) : (
            <ul className="space-y-4 max-h-[calc(100vh-20rem)] overflow-y-auto p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {applications.map((app) => {
                const currentStatus = getDemoAppStatus(app);
                return (
                <li key={app.id} className={cn(
                    "p-4 rounded-lg border hover:shadow-md transition-shadow relative",
                    currentStatus === "Overdue" ? "bg-destructive/10 border-destructive/30" :
                    currentStatus === "Active" ? "bg-green-500/10 border-green-500/30" : "bg-card"
                )}>
                   <div className="absolute top-3 right-3 flex flex-col items-end gap-1 z-10">
                        <Badge variant={getDemoStatusBadgeVariant(currentStatus)} className="text-xs px-2 py-0.5">
                            {currentStatus}
                        </Badge>
                        <div className="flex gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7 bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                            <Link href={`/dashboard/demo/edit-demo-machine-application/${app.id}`}>
                                <Edit className="h-4 w-4" /> <span className="sr-only">Edit Application</span>
                            </Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-7 w-7" onClick={() => handleDeleteApplication(app.id, `${app.factoryName} - ${app.machineModel}`)}>
                            <Trash2 className="h-4 w-4" /> <span className="sr-only">Delete Application</span>
                            </Button>
                        </div>
                    </div>
                  <CardHeader className="pb-3 pt-0 px-0 pr-24"> {/* Adjusted pr for spacing */}
                    <CardTitle className="text-lg font-semibold text-primary mb-1 truncate">
                       {formatReportValue(app.factoryName)} - {formatReportValue(app.machineModel)}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Model: {formatReportValue(app.machineModel)} | Serial: {formatReportValue(app.machineSerial)} | Brand: {formatReportValue(app.machineBrand)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-0 pb-0 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm mb-2">
                      <div><span className="text-muted-foreground">Delivery: </span><span className="font-medium text-foreground">{formatDisplayDate(app.deliveryDate)}</span></div>
                      <div><span className="text-muted-foreground">Est. Return: </span><span className="font-medium text-foreground">{formatDisplayDate(app.estReturnDate)}</span></div>
                      <div><span className="text-muted-foreground">Period: </span><span className="font-medium text-foreground">{formatReportValue(app.demoPeriodDays, "0")} Day(s)</span></div>
                      {app.factoryInchargeName && (
                        <div><User className="inline-block mr-1 h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Incharge: </span><span className="font-medium text-foreground truncate" title={app.factoryInchargeName}>{app.factoryInchargeName}</span></div>
                      )}
                      {app.inchargeCell && (
                        <div><Phone className="inline-block mr-1 h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Cell: </span><span className="font-medium text-foreground truncate" title={app.inchargeCell}>{app.inchargeCell}</span></div>
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
              );
            })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
    
    