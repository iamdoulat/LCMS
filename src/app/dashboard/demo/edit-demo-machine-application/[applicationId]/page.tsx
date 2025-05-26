
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useParams, useRouter }
from 'next/navigation';
import Link from 'next/link';
import { AppWindow, ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// TODO: Implement the actual edit form for Demo Machine Applications

export default function EditDemoMachineApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.applicationId as string;

  // Placeholder for fetching application data
  const [applicationData, setApplicationData] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(false); // Set to true when fetching

  // React.useEffect(() => {
  //   if (applicationId) {
  //     setIsLoading(true);
  //     // TODO: Fetch application data from Firestore using applicationId
  //     // Example:
  //     // const fetchApp = async () => {
  //     //   const docRef = doc(firestore, "demo_machine_applications", applicationId);
  //     //   const docSnap = await getDoc(docRef);
  //     //   if (docSnap.exists()) {
  //     //     setApplicationData({ id: docSnap.id, ...docSnap.data() });
  //     //   } else {
  //     //     Swal.fire("Error", "Application not found.", "error");
  //     //     router.push("/dashboard/demo/demo-machine-list"); // Redirect to the list of applications
  //     //   }
  //     //   setIsLoading(false);
  //     // };
  //     // fetchApp();
  //      setIsLoading(false); // Remove this once actual fetch is in place
  //   }
  // }, [applicationId, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading application details for ID: {applicationId}...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/demo/demo-machine-list" passHref> {/* Link back to the applications list */}
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
            Modify the details for application ID: <span className="font-semibold text-foreground">{applicationId}</span>. (Form not yet implemented)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The form to edit this demo machine application (ID: {applicationId}) will be implemented here.
            You would typically fetch the existing application data from Firestore and pre-fill the form fields.
          </p>
          {/* TODO: Add EditDemoMachineApplicationForm component here */}
        </CardContent>
      </Card>
    </div>
  );
}


    