
"use client";

import { CreateDeliveryChallanForm } from '@/components/forms/CreateDeliveryChallanForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CreateDeliveryChallanPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-screen-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Truck className="h-7 w-7 text-primary" />
            Create New Delivery Challan
          </CardTitle>
          <CardDescription>
            Fill in the details below to generate a new delivery challan. You can link it to an existing sales invoice to auto-fill details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateDeliveryChallanForm />
        </CardContent>
      </Card>
    </div>
  );
}
