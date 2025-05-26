
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ListChecks, Factory as FactoryIcon, AlertTriangle, Info, PlusCircle, ExternalLink, Phone, User, MapPin, MessageSquare, FileText, FileEdit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import type { DemoMachineFactoryDocument } from '@/types';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import Swal from 'sweetalert2';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const formatFactoryDate = (dateInput?: string | Timestamp | Date): string => {
  if (!dateInput) return 'N/A';
  let date: Date;
  if (dateInput instanceof Timestamp) {
    date = dateInput.toDate();
  } else if (typeof dateInput === 'string') {
    try {
      const parsed = parseISO(dateInput);
      if (isValid(parsed)) {
        date = parsed;
      } else {
        // Try a more lenient parse if ISO fails (e.g. if it's already formatted)
        const directDate = new Date(dateInput);
        if (isValid(directDate)) {
          date = directDate;
        } else {
          return 'Invalid Date Input';
        }
      }
    } catch (e) {
      return 'Invalid Date Input';
    }
  } else if (dateInput instanceof Date) {
    date = dateInput;
  }
   else {
    return 'Invalid Date Input';
  }
  return date && isValid(date) ? format(date, 'PPP p') : 'N/A';
};


export default function DemoMachineFactoriesListPage() {
  const router = useRouter();
  const [factories, setFactories] = useState<DemoMachineFactoryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFactories = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const factoriesCollectionRef = collection(firestore, "demo_machine_factories");
        const q = query(factoriesCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedFactories = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt, 
            updatedAt: data.updatedAt,
          } as DemoMachineFactoryDocument;
        });
        setFactories(fetchedFactories);
      } catch (error: any) {
        console.error("Error fetching demo machine factories: ", error);
        let errorMessage = `Could not fetch factory data. Please check Firestore rules.`;
         if (error.message && error.message.toLowerCase().includes("index")) {
            errorMessage = `Could not fetch factory data: A Firestore index might be required. Please check the browser console for a link to create it.`;
        } else if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes("permission"))) {
           errorMessage = `Could not fetch factory data: Missing or insufficient permissions. Please check Firestore security rules for 'demo_machine_factories'.`;
        } else if (error.message) {
            errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire("Fetch Error", errorMessage, "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchFactories();
  }, []);

  const handleDeleteFactory = (factoryId: string, factoryLabel?: string) => {
    Swal.fire({
        title: 'Are you sure?',
        text: `This will permanently delete the factory "${factoryLabel || factoryId}". This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'hsl(var(--destructive))',
        cancelButtonColor: 'hsl(var(--secondary))',
        confirmButtonText: 'Yes, delete it!',
        reverseButtons: true,
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(firestore, "demo_machine_factories", factoryId));
                setFactories(prev => prev.filter(f => f.id !== factoryId));
                Swal.fire(
                    'Deleted!',
                    `Factory "${factoryLabel || factoryId}" has been removed.`,
                    'success'
                );
            } catch (error: any) {
                console.error("Error deleting factory: ", error);
                Swal.fire(
                    'Error!',
                    `Could not delete factory: ${error.message}`,
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
                Demo Machine Factories List
              </CardTitle>
              <CardDescription>
                View and manage the list of demo machine factories.
              </CardDescription>
            </div>
            <Link href="/dashboard/demo/add-demo-machine-factory" passHref>
              <Button variant="default">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Factory
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading factories...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap">{fetchError}</p>
            </div>
          ) : factories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Factories Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no demo machine factories in the database. Click "Add Factory" to add one.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {factories.map((factory) => (
                <li key={factory.id} className="p-4 rounded-lg border hover:shadow-md transition-shadow relative bg-card flex flex-col">
                  <CardHeader className="pb-3 pt-0 px-0"> {/* Adjusted padding for header within li */}
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold text-primary mb-1 pr-20">
                           <FactoryIcon className="inline-block mr-2 h-5 w-5 align-text-bottom" /> {factory.factoryName || 'N/A'}
                        </CardTitle>
                        <div className="absolute top-4 right-4 flex gap-1 z-10"> {/* Adjusted top to match li padding */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-7 w-7" asChild>
                                            <Link href={`/dashboard/demo/edit-demo-machine-factory/${factory.id}`}>
                                                <FileEdit className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Edit Factory</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-7 w-7" onClick={() => handleDeleteFactory(factory.id, factory.factoryName)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Delete Factory</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0 pb-0 pt-0 text-sm flex-grow"> {/* Adjusted padding for content within li */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-1 mb-2">
                      <div className="flex items-start col-span-1 lg:col-span-2">
                        <MapPin className="mr-2 h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> 
                        <div>
                          <span className="text-muted-foreground">Address: </span>
                          <span className="font-medium text-foreground">{factory.factoryLocation || 'N/A'}</span>
                        </div>
                      </div>
                      <div className="col-span-1">
                        {factory.contactPerson && (
                          <div className="flex items-center">
                              <User className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground">Contact: </span>
                              <span className="font-medium text-foreground ml-1 truncate" title={factory.contactPerson}>{factory.contactPerson}</span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-1">
                        {factory.cellNumber && (
                          <div className="flex items-center">
                              <Phone className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground">Cell: </span>
                              <a href={`tel:${factory.cellNumber.replace(/\s/g, '')}`} className="font-medium text-primary hover:underline ml-1 truncate" title={`Call ${factory.cellNumber}`}>
                                  {factory.cellNumber}
                              </a>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {factory.note && (
                        <div className="mt-2 flex items-start">
                            <FileText className="mr-2 h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div>
                                <span className="text-xs font-medium text-muted-foreground">Note: </span>
                                <span className="text-xs text-foreground whitespace-pre-wrap">{factory.note}</span>
                            </div>
                        </div>
                    )}
                  </CardContent>
                  <div className="mt-auto self-end text-xs text-muted-foreground pt-2"> {/* Date positioned at bottom-right */}
                    Added: {formatFactoryDate(factory.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
    

    