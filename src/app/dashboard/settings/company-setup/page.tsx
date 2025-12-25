
"use client";

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Building } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CompanySetupForm } from '@/components/forms/common';

export default function CompanySetupPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const isReadOnly = userRole?.includes('Viewer');

  React.useEffect(() => {
    if (!authLoading && !userRole?.includes("Super Admin") && !userRole?.includes("Admin") && !isReadOnly) {
      Swal.fire({
        title: 'Access Denied',
        text: 'You are not permitted to view/edit company settings.',
        icon: 'error',
        timer: 1000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
    }
  }, [userRole, authLoading, router, isReadOnly]);

  if (authLoading || (!authLoading && !userRole?.includes("Super Admin") && !userRole?.includes("Admin") && !isReadOnly)) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  return (
    <div className="max-w-none mx-[25px] py-8 px-0">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Building className="h-7 w-7 text-primary" />
            Company Setup
          </CardTitle>
          <CardDescription>
            Configure your company&apos;s core information. This data may be used across the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanySetupForm />
        </CardContent>
      </Card>
    </div>
  );
}
