
"use client";

import { PaymentTrackingEntryForm } from '@/components/forms/financial';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function PaymentTrackingEntryPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8 px-5">
       <div className="mb-6">
        <Link href="/dashboard/deferred-payment-tracker" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Deferred Payment Tracker
          </Button>
        </Link>
      </div>
      <Card className="max-w-5xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <DollarSign className="h-7 w-7 text-primary" />
            Payment Tracking Entry Form
          </CardTitle>
          <CardDescription>
            Select a Documentary Credit Number to track shipment and payment details for deferred L/Cs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentTrackingEntryForm />
        </CardContent>
      </Card>
    </div>
  );
}
