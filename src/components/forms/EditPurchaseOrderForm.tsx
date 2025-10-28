

"use client";

import { EditInventoryOrderForm } from '@/components/forms/EditInventoryOrderForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as React from 'react';


export function EditPurchaseOrderForm() {
    return <EditInventoryOrderForm />;
}

export default function EditNewPurchaseOrderPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-screen-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <ShoppingCart className="h-7 w-7 text-primary" />
            Edit Purchase Order
          </CardTitle>
          <CardDescription>
            Modify the details for this purchase order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditInventoryOrderForm />
        </CardContent>
      </Card>
    </div>
  );
}

