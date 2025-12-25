
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Laptop, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { EditDemoMachineForm } from '@/components/forms/demo';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { DemoMachineDocument } from '@/types';
import Swal from 'sweetalert2';

export default function EditDemoMachinePage() {
  const params = useParams();
  const router = useRouter();
  const machineId = params.machineId as string;

  const [machineData, setMachineData] = useState<DemoMachineDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMachineData = useCallback(async () => {
    if (!machineId) {
      setError("No Demo Machine ID provided.");
      setIsLoading(false);
      Swal.fire("Error", "No Demo Machine ID specified.", "error").then(() => {
        router.push('/dashboard/demo/demo-machine-list');
      });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const machineDocRef = doc(firestore, "demo_machines", machineId);
      const machineDocSnap = await getDoc(machineDocRef);

      if (machineDocSnap.exists()) {
        setMachineData({ id: machineDocSnap.id, ...machineDocSnap.data() } as DemoMachineDocument);
      } else {
        setError("Demo Machine not found.");
        Swal.fire("Error", `Demo Machine with ID ${machineId} not found.`, "error");
      }
    } catch (err: any) {
      console.error("Error fetching demo machine data: ", err);
      setError(`Failed to fetch demo machine data: ${err.message}`);
      Swal.fire("Error", `Failed to fetch demo machine data: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId, router]); // Adding router to deps as it's used in error case

  useEffect(() => {
    fetchMachineData();
  }, [fetchMachineData]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading demo machine details for ID: {machineId}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-4xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" />
              Error Loading Demo Machine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/demo/demo-machine-list">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Demo Machine List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!machineData) {
     return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Demo machine data could not be loaded.</p>
         <Button variant="outline" asChild className="mt-4">
            <Link href="/dashboard/demo/demo-machine-list">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Demo Machine List
            </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/demo/demo-machine-list" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Demo Machine List
          </Button>
        </Link>
      </div>
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Laptop className="h-7 w-7 text-primary" />
            Edit Demo Machine
          </CardTitle>
          <CardDescription>
            Modify the details for demo machine ID: <span className="font-semibold text-foreground">{machineId}</span>
            {machineData.machineModel && ` (${machineData.machineModel} - S/N: ${machineData.machineSerial || 'N/A'})`}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditDemoMachineForm initialData={machineData} machineId={machineId} />
        </CardContent>
      </Card>
    </div>
  );
}
