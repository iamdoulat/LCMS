
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppWindow, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditDemoMachineApplicationForm } from '@/components/forms/EditDemoMachineApplicationForm';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { DemoMachineApplicationDocument } from '@/types';
import Swal from 'sweetalert2';

export default function EditDemoMachineApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.applicationId as string;

  const [applicationData, setApplicationData] = React.useState<DemoMachineApplicationDocument | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (applicationId) {
      setIsLoading(true);
      setError(null);
      const fetchApp = async () => {
        try {
          const docRef = doc(firestore, "demo_machine_applications", applicationId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setApplicationData({ id: docSnap.id, ...docSnap.data() } as DemoMachineApplicationDocument);
          } else {
            setError("Demo Machine Application not found.");
            Swal.fire("Error", `Application with ID ${applicationId} not found.`, "error").then(() => {
                 router.push("/dashboard/demo/demo-machine-list"); // Redirect to the list
            });
          }
        } catch (err: any) {
            console.error("Error fetching application data: ", err);
            setError(`Failed to fetch application data: ${err.message}`);
            Swal.fire("Error", `Failed to fetch application: ${err.message}`, "error");
        } finally {
            setIsLoading(false);
        }
      };
      fetchApp();
    } else {
        setError("No Application ID provided.");
        setIsLoading(false);
        Swal.fire("Error", "No Application ID specified.", "error").then(() => {
            router.push("/dashboard/demo/demo-machine-list");
        });
    }
  }, [applicationId, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading application details for ID: {applicationId}...</p>
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
              Error Loading Application
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/demo/demo-machine-list">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Applications List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!applicationData) {
     return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Application data could not be loaded.</p>
         <Button variant="outline" asChild className="mt-4">
            <Link href="/dashboard/demo/demo-machine-list">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Applications List
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
            Back to Applications List
          </Button>
        </Link>
      </div>
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <AppWindow className="h-7 w-7 text-primary" />
            Edit Demo Machine Application
          </CardTitle>
          <CardDescription>
            Modify the details for application ID: <span className="font-semibold text-foreground">{applicationId}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditDemoMachineApplicationForm initialData={applicationData} applicationId={applicationId} />
        </CardContent>
      </Card>
    </div>
  );
}
    