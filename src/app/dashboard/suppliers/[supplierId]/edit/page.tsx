
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useParams, useRouter } from 'next/navigation';
import { Store, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EditBeneficiaryForm } from '@/components/forms/crm';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { SupplierDocument } from '@/types';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

export default function EditBeneficiaryPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.supplierId as string;

  const [beneficiaryData, setBeneficiaryData] = useState<SupplierDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supplierId) {
      const fetchBeneficiaryData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const beneficiaryDocRef = doc(firestore, "suppliers", supplierId);
          const beneficiaryDocSnap = await getDoc(beneficiaryDocRef);

          if (beneficiaryDocSnap.exists()) {
            setBeneficiaryData({ id: beneficiaryDocSnap.id, ...beneficiaryDocSnap.data() } as SupplierDocument);
          } else {
            setError("Beneficiary not found.");
            Swal.fire("Error", `Beneficiary with ID ${supplierId} not found.`, "error");
          }
        } catch (err: any) {
          console.error("Error fetching beneficiary data: ", err);
          setError(`Failed to fetch beneficiary data: ${err.message}`);
          Swal.fire("Error", `Failed to fetch beneficiary data: ${err.message}`, "error");
        } finally {
          setIsLoading(false);
        }
      };
      fetchBeneficiaryData();
    } else {
      setError("No Beneficiary ID provided.");
      setIsLoading(false);
      Swal.fire("Error", "No Beneficiary ID specified in the URL.", "error").then(() => {
        router.push('/dashboard/suppliers');
      });
    }
  }, [supplierId, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading beneficiary details for ID: {supplierId}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-3xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" />
              Error Loading Beneficiary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/suppliers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Beneficiary List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!beneficiaryData) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Beneficiary data could not be loaded.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/dashboard/suppliers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Beneficiary List
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-[15px]">
      <div className="mb-6">
        <Link href="/dashboard/suppliers" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Beneficiary List
          </Button>
        </Link>
      </div>
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Store className="h-7 w-7 text-primary" />
            Edit Beneficiary Profile
          </CardTitle>
          <CardDescription>
            Modify the details for beneficiary ID: <span className="font-semibold text-foreground">{supplierId}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditBeneficiaryForm initialData={beneficiaryData} beneficiaryId={supplierId} />
        </CardContent>
      </Card>
    </div>
  );
}
