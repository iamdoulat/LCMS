"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { FinancialDocumentSettingsForm } from '@/components/forms/FinancialDocumentSettingsForm';

export default function FinancialManagementSettingPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const isReadOnly = userRole === 'Viewer';

  React.useEffect(() => {
    // A non-admin can't change settings, but a viewer might be allowed to see them
    if (!authLoading && userRole !== "Super Admin" && userRole !== "Admin" && !isReadOnly) {
      Swal.fire({
        title: 'Access Denied',
        text: 'You do not have permission to view or edit these settings.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
    }
  }, [userRole, authLoading, router, isReadOnly]);

  // Show loading indicator while auth state is being resolved.
  if (authLoading || (!authLoading && userRole !== "Super Admin" && userRole !== "Admin" && !isReadOnly)) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Verifying access...</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Settings className="h-7 w-7 text-primary" />
            Financial Document Settings
          </CardTitle>
          <CardDescription>
            Manage company details that appear on quotes, invoices, and orders. These settings are separate from the main company profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinancialDocumentSettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}
