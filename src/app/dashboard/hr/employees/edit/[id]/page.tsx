
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileEdit } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { EmployeeDocument } from '@/types';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { Skeleton } from '@/components/ui/skeleton';
import { createLazyComponent } from '@/lib/lazy-load';

// Lazy load the large form component (45KB)
const EditEmployeeForm = createLazyComponent(
  () => import('@/components/forms/hr').then(mod => ({ default: mod.EditEmployeeForm }))
);

export default function EditEmployeePage() {
  const { id } = useParams();
  const [employee, setEmployee] = useState<EmployeeDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployee = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (!id || typeof id !== 'string') {
          setError('Invalid employee ID.');
          return;
        }

        const employeeDocRef = doc(firestore, "employees", id as string);
        const docSnap = await getDoc(employeeDocRef);

        if (docSnap.exists()) {
          setEmployee({ id: docSnap.id, ...docSnap.data() } as EmployeeDocument);
        } else {
          setError("Employee not found.");
        }
      } catch (e: any) {
        setError(`Error fetching employee: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployee();
  }, [id]);

  return (
    <div className="container mx-auto py-8 px-5">
      <div className="mb-6">
        <Link href="/dashboard/hr/employees" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employee List
          </Button>
        </Link>
      </div>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FileEdit className="h-7 w-7 text-primary" />
            {isLoading ? 'Loading Employee...' : error ? 'Error Loading Employee' : `Edit Employee`}
          </CardTitle>
          <CardDescription>
            {error ? error : isLoading ? 'Loading employee details...' : 'Update the employee details below. Fields marked with an asterisk (*) are required.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-64" />
            </div>
          ) : error || !employee ? (
            <div className="text-red-500">
              {error || "Employee not found."}
            </div>
          ) : (
            <EditEmployeeForm employee={employee} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
