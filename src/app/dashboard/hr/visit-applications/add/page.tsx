
"use client";

import { AddVisitApplicationForm } from '@/components/forms/AddVisitApplicationForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plane, ArrowLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function AddVisitApplicationPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8 px-5">
       <div className="mb-6">
        <Link href="/dashboard/hr/visit-applications" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Visit Applications
          </Button>
        </Link>
      </div>
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-start">
             <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Plane className="h-7 w-7 text-primary"/>New Visit Application
            </CardTitle>
             <Link href="/dashboard/hr/visit-applications" passHref>
                <Button variant="ghost" size="icon">
                    <X className="h-6 w-6" />
                </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <AddVisitApplicationForm onFormSubmit={() => router.push('/dashboard/hr/visit-applications')} />
        </CardContent>
      </Card>
    </div>
  );
}
