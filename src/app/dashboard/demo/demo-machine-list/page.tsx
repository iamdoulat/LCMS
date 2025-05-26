
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ListChecks, Laptop as LaptopIcon, AlertTriangle, Info, Package, ExternalLink, FileText } from 'lucide-react';
import Link from 'next/link';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { DemoMachineDocument, DemoMachineOwnerOption, DemoMachineStatusOption } from '@/types';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import Swal from 'sweetalert2';
import { Badge } from '@/components/ui/badge';

const formatMachineDate = (dateInput?: string | Timestamp): string => {
  if (!dateInput) return 'N/A';
  let date: Date;
  if (dateInput instanceof Timestamp) {
    date = dateInput.toDate();
  } else if (typeof dateInput === 'string') {
    date = parseISO(dateInput);
  } else {
    return 'Invalid Date Input';
  }
  return isValid(date) ? format(date, 'PPP p') : 'Invalid Date';
};

const getStatusBadgeVariant = (status?: DemoMachineStatusOption): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case 'Available':
      return 'default'; // Greenish
    case 'Allocated':
      return 'secondary'; // Bluish/Greyish
    case 'Maintenance Mode':
      return 'destructive'; // Reddish
    default:
      return 'outline';
  }
};


export default function DemoMachineListPage() {
  const [demoMachines, setDemoMachines] = useState<DemoMachineDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDemoMachines = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const machinesCollectionRef = collection(firestore, "demo_machines");
        const q = query(machinesCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedMachines = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          } as DemoMachineDocument;
        });
        setDemoMachines(fetchedMachines);
      } catch (error: any) {
        console.error("Error fetching demo machines: ", error);
        let errorMessage = `Could not fetch demo machines. Please check Firestore rules.`;
         if (error.message && error.message.toLowerCase().includes("index")) {
            errorMessage = `Could not fetch demo machines: A Firestore index might be required. Please check the browser console for a link to create it.`;
        } else if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes("permission"))) {
           errorMessage = `Could not fetch demo machines: Missing or insufficient permissions. Please check Firestore security rules for 'demo_machines'.`;
        } else if (error.message) {
            errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire("Fetch Error", errorMessage, "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDemoMachines();
  }, []);

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
                View and manage the list of available demo machines.
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
              <p className="text-muted-foreground">Loading demo machines...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap">{fetchError}</p>
            </div>
          ) : demoMachines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Demo Machines Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no demo machines in the database. Click "Add Demo Machine" to add one.
              </p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto space-y-4 p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"> {/* Scrollable container */}
              {demoMachines.map((machine) => (
                <Card key={machine.id} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3 pt-4 px-4">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold text-primary mb-1 truncate pr-16">
                           {machine.machineModel || 'N/A'}
                        </CardTitle>
                       {machine.currentStatus && (
                         <Badge 
                            variant={getStatusBadgeVariant(machine.currentStatus)}
                            className={cn(
                                machine.currentStatus === "Available" && "bg-green-600 text-white dark:bg-green-500 dark:text-black",
                                machine.currentStatus === "Maintenance Mode" && "bg-red-600 text-white dark:bg-red-500 dark:text-black",
                                machine.currentStatus === "Allocated" && "bg-yellow-500 text-black dark:bg-yellow-600 dark:text-black"
                            )}
                         >
                            {machine.currentStatus}
                         </Badge>
                       )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div>
                        <span className="text-muted-foreground">Serial: </span>
                        <span className="font-medium text-foreground">{machine.machineSerial || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Brand: </span>
                        <span className="font-medium text-foreground">{machine.machineBrand || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Owner: </span>
                        <span className="font-medium text-foreground">{machine.machineOwner || 'N/A'}</span>
                      </div>
                    </div>
                    {machine.motorOrControlBoxModel && (
                        <div className="mt-1 text-sm">
                            <span className="text-muted-foreground">Ctl. Box Model: </span>
                            <span className="font-medium text-foreground">{machine.motorOrControlBoxModel}</span>
                        </div>
                    )}
                    {machine.controlBoxSerialNo && (
                        <div className="mt-1 text-sm">
                            <span className="text-muted-foreground">Ctl. Box S/N: </span>
                            <span className="font-medium text-foreground">{machine.controlBoxSerialNo}</span>
                        </div>
                    )}
                     {machine.machineFeatures && (
                        <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground">Features:</p>
                            <p className="text-xs text-foreground whitespace-pre-wrap">{machine.machineFeatures}</p>
                        </div>
                    )}
                    {machine.note && (
                        <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground">Note:</p>
                            <p className="text-xs text-foreground whitespace-pre-wrap">{machine.note}</p>
                        </div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">
                      Added: {formatMachineDate(machine.createdAt)}
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

    