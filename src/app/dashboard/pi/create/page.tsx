
"use client";

import { CreateSaleInvoiceForm as CreateInvoiceForm } from '@/components/forms/financial';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FilePlus2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as React from 'react';

export default function CreateNewInvoicePage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-screen-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FilePlus2 className="h-7 w-7 text-primary" />
            Create New Proforma Invoice
          </CardTitle>
          <CardDescription>
            Fill in the details below to generate a new Proforma Invoice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateInvoiceForm itemsCollection="quote_items" />
        </CardContent>
      </Card>
    </div>
  );
}
