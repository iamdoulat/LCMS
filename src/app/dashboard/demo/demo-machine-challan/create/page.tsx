
"use client";

import { CreateDemoMachineChallanForm } from '@/components/forms/CreateDemoMachineChallanForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Truck, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CreateNewDemoMachineChallanPage() {
  return (
    <div className="container mx-auto py-8 px-5">
       <div className="mb-6">
            <Link href="/dashboard/demo/demo-machine-challan" passHref>
                <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Demo Machine Challan List
                </Button>
            </Link>
        </div>
      <Card className="max-w-screen-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Truck className="h-7 w-7 text-primary" />
            Create New Demo Machine Challan
          </CardTitle>
          <CardDescription>
            Fill in the details below to generate a new demo machine challan. You can link it to an existing application to auto-fill details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateDemoMachineChallanForm />
        </CardContent>
      </Card>
    </div>
  );
}
