
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BellRing, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AddNoticeForm } from '@/components/forms/common';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function AddNoticePage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!authLoading && !userRole?.some(r => ["Super Admin", "Admin", "HR"].includes(r))) {
      Swal.fire({
        title: 'Access Denied',
        text: 'You do not have permission to manage notices.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => router.push('/dashboard'));
    }
  }, [userRole, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-[20px]">
      <div className="mb-6">
        <Link href="/dashboard/hr/notice" passHref>
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Notices</Button>
        </Link>
      </div>
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <BellRing className="h-7 w-7 text-primary" />
            Add New Notice
          </CardTitle>
          <CardDescription>
            Create a new notice that can appear as a pop-up on user dashboards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddNoticeForm />
        </CardContent>
      </Card>
    </div>
  );
}
