
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Edit } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { HolidayDocument } from '@/types';
import { EditHolidayForm } from '@/components/forms/EditHolidayForm';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditHolidayPage() {
  const params = useParams();
  const router = useRouter();
  const holidayId = params.holidayId as string;

  const [holidayData, setHolidayData] = React.useState<HolidayDocument | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!holidayId) {
      setError("No Holiday ID provided in the URL.");
      setIsLoading(false);
      return;
    }

    const fetchHolidayData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const holidayDocRef = doc(firestore, "holidays", holidayId);
        const holidayDocSnap = await getDoc(holidayDocRef);

        if (holidayDocSnap.exists()) {
          setHolidayData({ id: holidayDocSnap.id, ...holidayDocSnap.data() } as HolidayDocument);
        } else {
          setError("Holiday not found.");
          Swal.fire("Error", `Holiday with ID ${holidayId} not found.`, "error");
        }
      } catch (err: any) {
        console.error("Error fetching holiday data: ", err);
        setError(`Failed to fetch holiday data: ${err.message}`);
        Swal.fire("Error", `Failed to fetch holiday data: ${err.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHolidayData();
  }, [holidayId]);

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
        <Card className="mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" /> Error Loading Holiday
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/hr/holidays">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Holidays List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!holidayData) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Holiday data could not be loaded.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/dashboard/hr/holidays">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Holidays List
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/hr/holidays" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Holidays List
          </Button>
        </Link>
      </div>
      <Card className="mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Edit className="h-7 w-7 text-primary" />
            Edit Holiday
          </CardTitle>
          <CardDescription>
            Modify the details for the holiday: <span className="font-semibold text-foreground">{holidayData.name}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditHolidayForm initialData={holidayData} onFormSubmit={() => router.push('/dashboard/hr/holidays')} />
        </CardContent>
      </Card>
    </div>
  );
}
