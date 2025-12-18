
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Edit } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { LeaveApplicationDocument } from '@/types';
import { EditLeaveForm } from '@/components/forms/EditLeaveForm';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditLeavePage() {
  const params = useParams();
  const router = useRouter();
  const leaveId = params.leaveId as string;

  const [leaveData, setLeaveData] = React.useState<LeaveApplicationDocument | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!leaveId) {
      setError("No Leave ID provided in the URL.");
      setIsLoading(false);
      return;
    }

    const fetchLeaveData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const leaveDocRef = doc(firestore, "leave_applications", leaveId);
        const leaveDocSnap = await getDoc(leaveDocRef);

        if (leaveDocSnap.exists()) {
          setLeaveData({ id: leaveDocSnap.id, ...leaveDocSnap.data() } as LeaveApplicationDocument);
        } else {
          setError("Leave application not found.");
          Swal.fire("Error", `Leave application with ID ${leaveId} not found.`, "error");
        }
      } catch (err: any) {
        console.error("Error fetching leave data: ", err);
        setError(`Failed to fetch leave data: ${err.message}`);
        Swal.fire("Error", `Failed to fetch leave data: ${err.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaveData();
  }, [leaveId]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-6"><Skeleton className="h-10 w-40" /></div>
        <Card className="mx-auto shadow-xl">
          <CardHeader><Skeleton className="h-8 w-1/3" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
          <CardContent><div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /></div></CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-2xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" /> Error Loading Leave Application
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/hr/leaves">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Leave List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!leaveData) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Leave data could not be loaded.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/dashboard/hr/leaves">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Leave List
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/hr/leaves" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Leave List
          </Button>
        </Link>
      </div>
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Edit className="h-7 w-7 text-primary" />
            Edit Leave Application
          </CardTitle>
          <CardDescription>
            Modify the details for leave application ID: <span className="font-semibold text-foreground">{leaveId}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditLeaveForm initialData={leaveData} onFormSubmit={() => router.push('/dashboard/hr/leaves')} />
        </CardContent>
      </Card>
    </div>
  );
}
