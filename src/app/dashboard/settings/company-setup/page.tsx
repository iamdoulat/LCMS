
"use client";

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Building } from 'lucide-react';
// import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    <div className="mx-[25px] max-w-none py-8 space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className={cn("flex items-center gap-2 font-bold text-3xl", "bg-gradient-to-r from-primary to-rose-500 text-transparent bg-clip-text")}>
          <Building className="h-8 w-8 text-primary" />
          Company Setup
        </h2>
        <p className="text-muted-foreground text-lg">
          Configure your company&apos;s core profile, location, and branding settings.
        </p>
      </div>

      <CompanySetupForm />
    </div>
  );
}
