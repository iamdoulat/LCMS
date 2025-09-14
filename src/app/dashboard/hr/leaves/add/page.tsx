
"use client";

import { AddLeaveForm } from '@/components/forms/AddLeaveForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mailbox, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function AddLeavePage() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/hr/leaves" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Leave Management
          </Button>
        </Link>
      </div>
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Mailbox className="h-7 w-7 text-primary"/>New Leave Application
          </CardTitle>
          <CardDescription>
            Fill out the form below to apply for leave.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddLeaveForm onFormSubmit={() => router.push('/dashboard/hr/leaves')} />
        </CardContent>
      </Card>
    </div>
  );
}

