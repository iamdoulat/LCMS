
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { ShieldAlert } from 'lucide-react';


export default function EmployeeListPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Users className="h-7 w-7 text-primary" />
                Employee List
              </CardTitle>
              <CardDescription>
                View, manage, and filter all employee profiles.
              </CardDescription>
            </div>
            <Link href="/dashboard/human-resources/employees/add" passHref>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
                </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
           <Alert variant="default" className="bg-blue-500/10 border-blue-500/30">
            <ShieldAlert className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-700 font-semibold">Placeholder Page</AlertTitle>
            <AlertDescription className="text-blue-700/90">
              This page is a placeholder for the Employee List. Functionality for filtering, searching, and displaying employee data will be implemented here based on the HRMS blueprint.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
