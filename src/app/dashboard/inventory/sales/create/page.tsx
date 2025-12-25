
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FilePlus2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateSaleInvoiceForm } from '@/components/forms/financial';
import * as React from 'react';

export default function CreateNewSaleInvoicePage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-screen-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FilePlus2 className="h-7 w-7 text-primary" />
            Create New Sales Invoice
          </CardTitle>
          <CardDescription>
            Fill in the details below to generate a new sales invoice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateSaleInvoiceForm />
        </CardContent>
      </Card>
    </div>
  );
}
