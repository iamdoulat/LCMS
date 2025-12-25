
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Edit } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { Payslip } from '@/types';
import { EditPayslipForm } from '@/components/forms/hr';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditPayslipPage() {
  const params = useParams();
  const payslipId = params.id as string;

  const [payslipData, setPayslipData] = React.useState<Payslip | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!payslipId) {
      setError("No Payslip ID provided in the URL.");
      setIsLoading(false);
      return;
    }

    const fetchPayslipData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const payslipDocRef = doc(firestore, "payslips", payslipId);
        const payslipDocSnap = await getDoc(payslipDocRef);

        if (payslipDocSnap.exists()) {
          setPayslipData({ id: payslipDocSnap.id, ...payslipDocSnap.data() } as Payslip);
        } else {
          setError("Payslip not found.");
          Swal.fire("Error", `Payslip with ID ${payslipId} not found.`, "error");
        }
      } catch (err: any) {
        console.error("Error fetching payslip data: ", err);
        setError(`Failed to fetch payslip data: ${err.message}`);
        Swal.fire("Error", `Failed to fetch payslip data: ${err.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayslipData();
  }, [payslipId]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-6"><Skeleton className="h-10 w-40" /></div>
        <Card className="max-w-5xl mx-auto shadow-xl">
          <CardHeader><Skeleton className="h-8 w-1/3" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
          <CardContent><div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div></CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-5xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" /> Error Loading Payslip
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/hr/payroll/payslip-list">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Payslip List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!payslipData) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Payslip data could not be loaded.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/dashboard/hr/payroll/payslip-list">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Payslip List
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-5">
      <div className="mb-6">
        <Link href="/dashboard/hr/payroll/payslip-list" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Payslip List
          </Button>
        </Link>
      </div>
      <Card className="max-w-5xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Edit className="h-7 w-7 text-primary" />
            Edit Payslip
          </CardTitle>
          <CardDescription>
            Modify the details for payslip ID: <span className="font-semibold text-foreground">{payslipId}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditPayslipForm initialData={payslipData} />
        </CardContent>
      </Card>
    </div>
  );
}
