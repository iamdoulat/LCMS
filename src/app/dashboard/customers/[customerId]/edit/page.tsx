
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useParams, useRouter } from 'next/navigation';
import { UserCog, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EditApplicantForm } from '@/components/forms/EditApplicantForm'; 
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { CustomerDocument } from '@/types';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

export default function EditApplicantPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [applicantData, setApplicantData] = useState<CustomerDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customerId) {
      const fetchApplicantData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const applicantDocRef = doc(firestore, "customers", customerId);
          const applicantDocSnap = await getDoc(applicantDocRef);

          if (applicantDocSnap.exists()) {
            setApplicantData({ id: applicantDocSnap.id, ...applicantDocSnap.data() } as CustomerDocument);
          } else {
            setError("Applicant not found.");
            Swal.fire("Error", `Applicant with ID ${customerId} not found.`, "error");
          }
        } catch (err: any) {
          console.error("Error fetching applicant data: ", err);
          setError(`Failed to fetch applicant data: ${err.message}`);
          Swal.fire("Error", `Failed to fetch applicant data: ${err.message}`, "error");
        } finally {
          setIsLoading(false);
        }
      };
      fetchApplicantData();
    } else {
      setError("No Applicant ID provided.");
      setIsLoading(false);
       Swal.fire("Error", "No Applicant ID specified in the URL.", "error").then(() => {
         router.push('/dashboard/customers');
       });
    }
  }, [customerId, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading applicant details for ID: {customerId}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-5">
        <Card className="max-w-3xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" />
              Error Loading Applicant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/customers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Applicant List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!applicantData) {
     return (
      <div className="container mx-auto py-8 text-center px-5">
        <p className="text-muted-foreground">Applicant data could not be loaded.</p>
         <Button variant="outline" asChild className="mt-4">
            <Link href="/dashboard/customers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Applicant List
            </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-5">
       <div className="mb-6">
        <Link href="/dashboard/customers" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Applicant List
          </Button>
        </Link>
      </div>
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <UserCog className="h-7 w-7 text-primary" />
            Edit Applicant Profile
          </CardTitle>
          <CardDescription>
            Modify the details for applicant ID: <span className="font-semibold text-foreground">{customerId}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditApplicantForm initialData={applicantData} applicantId={customerId} />
        </CardContent>
      </Card>
    </div>
  );
}
