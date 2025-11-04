
"use client";

import { AddDemoMachineForm } from '@/components/forms/AddDemoMachineForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Laptop, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AddNewDemoMachinePage() {
  return (
    <div className="container mx-auto py-8 px-5">
        <div className="mb-6">
            <Link href="/dashboard/demo/demo-machine-list" passHref>
                <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Demo Machine List
                </Button>
            </Link>
        </div>
      <Card className="max-w-6xl mx-auto shadow-xl"> {/* Changed from max-w-4xl to max-w-6xl */}
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Laptop className="h-7 w-7 text-primary" />
            Add New Demo Machine
          </CardTitle>
          <CardDescription>
            Fill in the details below to add a new demo machine to the system. Fields marked with an asterisk (*) are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddDemoMachineForm />
        </CardContent>
      </Card>
    </div>
  );
}
