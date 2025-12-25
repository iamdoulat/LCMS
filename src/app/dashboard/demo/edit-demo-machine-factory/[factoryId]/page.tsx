
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Factory as FactoryIcon, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { EditDemoMachineFactoryForm } from '@/components/forms/demo';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { DemoMachineFactoryDocument } from '@/types';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';

export default function EditDemoMachineFactoryPage() {
  const params = useParams();
  const router = useRouter();
  const factoryId = params.factoryId as string;
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');

  const [factoryData, setFactoryData] = useState<DemoMachineFactoryDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (factoryId) {
      const fetchFactoryData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const factoryDocRef = doc(firestore, "demo_machine_factories", factoryId);
          const factoryDocSnap = await getDoc(factoryDocRef);

          if (factoryDocSnap.exists()) {
            setFactoryData({ id: factoryDocSnap.id, ...factoryDocSnap.data() } as DemoMachineFactoryDocument);
          } else {
            setError("Demo Machine Factory not found.");
            Swal.fire("Error", `Factory with ID ${factoryId} not found.`, "error");
          }
        } catch (err: any) {
          console.error("Error fetching factory data: ", err);
          setError(`Failed to fetch factory data: ${err.message}`);
          Swal.fire("Error", `Failed to fetch factory data: ${err.message}`, "error");
        } finally {
          setIsLoading(false);
        }
      };
      fetchFactoryData();
    } else {
      setError("No Factory ID provided.");
      setIsLoading(false);
       Swal.fire("Error", "No Factory ID specified in the URL.", "error").then(() => {
         router.push('/dashboard/demo/demo-machine-factories-list');
       });
    }
  }, [factoryId, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading factory details for ID: {factoryId}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-5">
        <Card className="max-w-3xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" />
              Error Loading Factory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/demo/demo-machine-factories-list">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Demo Machine Factories List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!factoryData) {
     return (
      <div className="container mx-auto py-8 text-center px-5">
        <p className="text-muted-foreground">Factory data could not be loaded.</p>
         <Button variant="outline" asChild className="mt-4">
            <Link href="/dashboard/demo/demo-machine-factories-list">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Demo Machine Factories List
            </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-5">
      <div className="mb-6">
        <Link href="/dashboard/demo/demo-machine-factories-list" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Demo Machine Factories List
          </Button>
        </Link>
      </div>
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FactoryIcon className="h-7 w-7 text-primary" />
            {isReadOnly ? 'View' : 'Edit'} Demo Machine Factory
          </CardTitle>
          <CardDescription>
            {isReadOnly ? 'Viewing details for factory ID:' : 'Modify the details for factory ID:'} <span className="font-semibold text-foreground">{factoryId}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditDemoMachineFactoryForm initialData={factoryData} factoryId={factoryId} />
        </CardContent>
      </Card>
    </div>
  );
}
