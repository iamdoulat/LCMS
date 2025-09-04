
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { ShieldAlert } from 'lucide-react';

export default function AddEmployeePage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/human-resources/employees" passHref>
            <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Employee List
            </Button>
        </Link>
      </div>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <UserPlus className="h-7 w-7 text-primary" />
            Add New Employee
          </CardTitle>
          <CardDescription>
            Fill out the form below to add a new employee to the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Alert variant="default" className="bg-blue-500/10 border-blue-500/30">
            <ShieldAlert className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-700 font-semibold">Placeholder Form</AlertTitle>
            <AlertDescription className="text-blue-700/90">
              This is a placeholder for the new employee form. The complete form with all fields from the HRMS blueprint will be implemented here.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
