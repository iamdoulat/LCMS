
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Edit } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { AdvanceSalaryDocument } from '@/types';
import { EditAdvanceSalaryForm } from '@/components/forms/EditAdvanceSalaryForm';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditAdvanceSalaryPage() {
  const params = useParams();
  const id = params.id as string;

  const [advanceData, setAdvanceData] = React.useState<AdvanceSalaryDocument | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) {
      setError("No ID provided in the URL.");
      setIsLoading(false);
      return;
    }

    const fetchAdvanceData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const docRef = doc(firestore, "advance_salary", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setAdvanceData({ id: docSnap.id, ...docSnap.data() } as AdvanceSalaryDocument);
        } else {
          setError("Advance salary record not found.");
          Swal.fire("Error", `Record with ID ${id} not found.`, "error");
        }
      } catch (err: any) {
        setError(`Failed to fetch data: ${err.message}`);
        Swal.fire("Error", `Failed to fetch data: ${err.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdvanceData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-5">
        <div className="mb-6"><Skeleton className="h-10 w-40" /></div>
        <Card className="max-w-4xl mx-auto shadow-xl">
          <CardHeader><Skeleton className="h-8 w-1/3" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
          <CardContent><div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /></div></CardContent>
        </Card>
      </div>
    );
  }

  if (error || !advanceData) {
    return (
      <div className="container mx-auto py-8 px-5">
        <Card className="max-w-4xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" /> Error Loading Record
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error || "Data could not be loaded."}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/hr/payroll/advance-salary">
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
        <Link href="/dashboard/hr/payroll/advance-salary" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Advance Salary List
          </Button>
        </Link>
      </div>
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Edit className="h-7 w-7 text-primary" />
            Edit Advance Salary Request
          </CardTitle>
          <CardDescription>
            Modify the details for request from: <span className="font-semibold text-foreground">{advanceData.employeeName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditAdvanceSalaryForm initialData={advanceData} />
        </CardContent>
      </Card>
    </div>
  );
}
