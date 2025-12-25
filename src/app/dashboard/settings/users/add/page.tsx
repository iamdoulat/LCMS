
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AddUserForm } from '@/components/forms/common';

export default function AddUserPage() {
  return (
    <div className="container mx-auto py-8 px-5">
       <div className="mb-6">
            <Link href="/dashboard/settings/users" passHref>
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to User List</Button>
            </Link>
        </div>
      <Card className="max-w-7xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <UserPlus className="h-7 w-7 text-primary" />
            Add New User
          </CardTitle>
          <CardDescription>
            Create a new user account and assign their roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <AddUserForm />
        </CardContent>
      </Card>
    </div>
  );
}
