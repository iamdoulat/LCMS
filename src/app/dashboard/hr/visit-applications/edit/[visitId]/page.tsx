
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Edit, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { VisitApplicationDocument } from '@/types';
import { EditVisitApplicationForm } from '@/components/forms/hr';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditVisitApplicationPage() {
  const params = useParams();
  const visitId = params.visitId as string;

  const [visitData, setVisitData] = React.useState<VisitApplicationDocument | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visitId) {
      setError("No Visit ID provided in the URL.");
      setIsLoading(false);
      return;
    }

    const fetchVisitData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const docRef = doc(firestore, "visit_applications", visitId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setVisitData({ id: docSnap.id, ...docSnap.data() } as VisitApplicationDocument);
        } else {
          setError("Visit application not found.");
          Swal.fire("Error", `Application with ID ${visitId} not found.`, "error");
        }
      } catch (err: any) {
        setError(`Failed to fetch data: ${err.message}`);
        Swal.fire("Error", `Failed to fetch data: ${err.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisitData();
  }, [visitId]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-5">
        <div className="mb-6"><Skeleton className="h-10 w-40" /></div>
        <Card className="shadow-xl">
          <CardHeader><Skeleton className="h-8 w-1/3" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
          <CardContent><div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /></div></CardContent>
        </Card>
      </div>
    );
  }

  if (error || !visitData) {
    return (
      <div className="container mx-auto py-8 px-5">
        <Card className="shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" /> Error Loading Application
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error || "Data could not be loaded."}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/hr/visit-applications">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-5">
      <div className="mb-6">
        <Link href="/dashboard/hr/visit-applications" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Visit Application List
          </Button>
        </Link>
      </div>
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Edit className="h-7 w-7 text-primary" />
                Edit Visit Application
              </CardTitle>
              <CardDescription>
                Modify the details for application from: <span className="font-semibold text-foreground">{visitData.employeeName}</span>
              </CardDescription>
            </div>
            <Link href="/dashboard/hr/visit-applications" passHref>
              <Button variant="ghost" size="icon">
                <X className="h-6 w-6" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <EditVisitApplicationForm initialData={visitData} />
        </CardContent>
      </Card>
    </div>
  );
}
