
"use client";

import { EditDemoMachineChallanForm } from '@/components/forms/EditDemoMachineChallanForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Truck, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { DemoChallanDocument } from '@/types';
import Swal from 'sweetalert2';

export default function EditDemoMachineChallanPage() {
  const params = useParams();

  const challanId = params.challanId as string;

  const [challanData, setChallanData] = useState<DemoChallanDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (challanId) {
      const fetchChallan = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const docRef = doc(firestore, "demo_machine_challans", challanId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setChallanData({ id: docSnap.id, ...docSnap.data() } as DemoChallanDocument);
          } else {
            setError("Challan not found.");
            Swal.fire("Error", `Demo Challan with ID ${challanId} not found.`, "error");
          }
        } catch (err: any) {
          setError(`Failed to fetch data: ${err.message}`);
          Swal.fire("Error", `Failed to fetch data: ${err.message}`, "error");
        } finally {
          setIsLoading(false);
        }
      }
      fetchChallan();
    } else {
      setError("No Challan ID specified.");
      setIsLoading(false);
    }
  }, [challanId]);


  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading demo challan details...</p>
      </div>
    );
  }

  if (error || !challanData) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-screen-2xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" /> Error Loading Demo Challan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error || "Demo challan data could not be loaded."}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/demo/demo-machine-challan">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Demo Machine Challan List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/demo/demo-machine-challan" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Demo Machine Challan List
          </Button>
        </Link>
      </div>
      <Card className="max-w-screen-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Truck className="h-7 w-7 text-primary" />
            Edit Demo Machine Challan
          </CardTitle>
          <CardDescription>
            Modify the details for demo challan number: <span className="font-semibold text-foreground">{challanId}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditDemoMachineChallanForm initialData={challanData} challanId={challanId} />
        </CardContent>
      </Card>
    </div>
  );
}
