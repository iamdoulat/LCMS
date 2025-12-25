
"use client";

import { AddDemoMachineFactoryForm } from '@/components/forms/demo';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Factory } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function AddDemoMachineFactoryPage() {
  return (
    <div className="container mx-auto py-8 px-5">
        <div className="mb-6">
            <Link href="/dashboard/demo/demo-machine-factories-list" passHref>
                <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Demo Machine Factories List
                </Button>
            </Link>
        </div>
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Factory className="h-7 w-7 text-primary" />
            Add New Demo Machine Factory
          </CardTitle>
          <CardDescription>
            Fill in the details below to add a new factory for demo machines. Fields marked with an asterisk (*) are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddDemoMachineFactoryForm />
        </CardContent>
      </Card>
    </div>
  );
}
