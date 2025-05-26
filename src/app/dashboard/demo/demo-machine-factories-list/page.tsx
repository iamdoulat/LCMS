
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ListChecks, Factory as FactoryIcon, AlertTriangle, Info, PlusCircle, ExternalLink, Phone, User, MapPin } from 'lucide-react';
import Link from 'next/link';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { DemoMachineFactoryDocument } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns'; // For createdAt display
import Swal from 'sweetalert2';

const formatFactoryDate = (dateInput?: string | Timestamp): string => {
  if (!dateInput) return 'N/A';
  let date: Date;
  if (dateInput instanceof Timestamp) {
    date = dateInput.toDate();
  } else if (typeof dateInput === 'string') {
    try {
      date = new Date(dateInput); // Attempt to parse if it's a string that new Date can handle
    } catch (e) {
      return 'Invalid Date Input';
    }
  } else {
    return 'Invalid Date Input';
  }
  return date && !isNaN(date.valueOf()) ? format(date, 'PPP p') : 'Invalid Date';
};


export default function DemoMachineFactoriesListPage() {
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
            // Ensure createdAt and updatedAt are consistently strings or handle Timestamps
            createdAt: data.createdAt, // Keep as Timestamp or convert to ISO string as needed
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
            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto space-y-4 p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"> {/* Scrollable container */}
              {factories.map((factory) => (
                <Card key={factory.id} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3 pt-4 px-4">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-semibold text-primary mb-1">
                           <FactoryIcon className="inline-block mr-2 h-5 w-5 align-text-bottom" /> {factory.factoryName || 'N/A'}
                        </CardTitle>
                        {/* Add Edit/Delete buttons here if needed later */}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="space-y-1 text-sm">
                      <p className="flex items-start">
                        <MapPin className="mr-2 h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> 
                        <span className="text-muted-foreground">Address: </span>
                        <span className="font-medium text-foreground ml-1">{factory.factoryLocation || 'N/A'}</span>
                      </p>
                      {factory.contactPerson && (
                        <p className="flex items-center">
                            <User className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground">Contact: </span>
                            <span className="font-medium text-foreground ml-1">{factory.contactPerson}</span>
                        </p>
                      )}
                      {factory.cellNumber && (
                        <p className="flex items-center">
                            <Phone className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground">Cell: </span>
                            <a href={`tel:${factory.cellNumber.replace(/\s/g, '')}`} className="font-medium text-primary hover:underline ml-1" title={`Call ${factory.cellNumber}`}>
                                {factory.cellNumber}
                            </a>
                        </p>
                      )}
                    </div>
                    {factory.note && (
                        <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground">Note:</p>
                            <p className="text-xs text-foreground whitespace-pre-wrap">{factory.note}</p>
                        </div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">
                      Added: {formatFactoryDate(factory.createdAt)}
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
