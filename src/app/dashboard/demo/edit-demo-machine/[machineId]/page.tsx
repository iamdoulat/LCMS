
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
// TODO: Import EditDemoMachineForm when created

export default function EditDemoMachinePage() {
  const params = useParams();
  const router = useRouter();
  const machineId = params.machineId as string;

  // Placeholder for actual form and data fetching
  // const [machineData, setMachineData] = React.useState<DemoMachineDocument | null>(null);
  // const [isLoading, setIsLoading] = React.useState(true);
  // const [error, setError] = React.useState<string | null>(null);

  // React.useEffect(() => {
  //   // Fetch machine data here
  // }, [machineId]);

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
            Modify the details for demo machine ID: <span className="font-semibold text-foreground">{machineId}</span>.
            {/* Replace with actual machine model/serial once data is fetched */}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 
            TODO: Replace with <EditDemoMachineForm initialData={machineData} machineId={machineId} /> 
            once the form component is created and data fetching is implemented.
          */}
          <p className="text-muted-foreground">Edit form for demo machine ID: {machineId} will be here.</p>
          <p className="text-muted-foreground mt-2">Functionality to edit demo machine details from Firestore is pending.</p>
        </CardContent>
      </Card>
    </div>
  );
}
