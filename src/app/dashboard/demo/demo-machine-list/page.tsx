
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Laptop as LaptopIcon, ListChecks, FileEdit, Trash2, Loader2, AlertTriangle, Info, CalendarDays, User, Phone, FileText as NoteIcon, AppWindow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import type { DemoMachineApplicationDocument } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import Swal from 'sweetalert2';

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

export default function DemoMachineApplicationsListPage() {
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
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ListChecks className="h-7 w-7 text-primary" />
                Demo Machine List
              </CardTitle>
              <CardDescription>
                View and manage all demo machine applications. Up to 20 latest entries are shown; list is scrollable.
              </CardDescription>
            </div>
            <Link href="/dashboard/demo/add-demo-machine" passHref>
              <Button variant="default">
                <LaptopIcon className="mr-2 h-4 w-4" />
                Add Demo Machine
              </Button>
            </Link>
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
                There are no demo machine applications in the database. Click "Add Demo Machine" or "New Demo Application" from relevant pages to add one.
              </p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto space-y-4 p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {applications.slice(0, 20).map((app) => ( 
                <Card key={app.id} className="shadow-md hover:shadow-lg transition-shadow relative">
                   <div className="absolute top-3 right-3 flex gap-1 z-10">
                        <Button variant="outline" size="icon" className="h-7 w-7 bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                          <Link href={`/dashboard/demo/edit-demo-machine-application/${app.id}`}>
                            <FileEdit className="h-4 w-4" /> <span className="sr-only">Edit Application</span>
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-7 w-7" onClick={() => handleDeleteApplication(app.id, `${app.factoryName} - ${app.machineModel}`)}>
                          <Trash2 className="h-4 w-4" /> <span className="sr-only">Delete Application</span>
                        </Button>
                    </div>
                  <CardHeader className="pb-3 pt-4 px-4 pr-20">
                    <CardTitle className="text-lg font-semibold text-primary mb-1 truncate">
                       {formatReportValue(app.factoryName)} - {formatReportValue(app.machineModel)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm mb-2">
                      <div><span className="text-muted-foreground">Delivery Date: </span><span className="font-medium text-foreground">{formatDisplayDate(app.deliveryDate)}</span></div>
                      <div><span className="text-muted-foreground">Est. Return: </span><span className="font-medium text-foreground">{formatDisplayDate(app.estReturnDate)}</span></div>
                      <div><span className="text-muted-foreground">Demo Period: </span><span className="font-medium text-foreground">{formatReportValue(app.demoPeriodDays, "0")} Day(s)</span></div>
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
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
