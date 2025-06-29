
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function EditUserDisabledPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2 text-destructive")}>
            <ShieldAlert className="h-7 w-7" />
            Feature Disabled
          </CardTitle>
          <CardDescription>
            User registration and management have been disabled in this version of the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <p>Please contact your system administrator for user-related inquiries.</p>
             <Link href="/dashboard" passHref>
                <Button variant="outline" className="mt-6">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Button>
            </Link>
        </CardContent>
      </Card>
    </div>
  );
}
