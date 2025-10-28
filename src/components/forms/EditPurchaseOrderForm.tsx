
"use client";

import { EditInventoryOrderForm } from '@/components/forms/EditInventoryOrderForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as React from 'react';
import type { OrderDocument } from '@/types';

interface EditPurchaseOrderFormProps {
  initialData: OrderDocument;
  orderId: string;
}

export function EditPurchaseOrderForm({ initialData, orderId }: EditPurchaseOrderFormProps) {
    return <EditInventoryOrderForm initialData={initialData} orderId={orderId} />;
}

export default function EditNewPurchaseOrderPage() {
  // This default export is for page-level components, which is not the case here.
  // The primary export 'EditPurchaseOrderForm' is the one being used.
  // This can be left as is or cleaned up, but it's not causing the current error.
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
          {/* This part is illustrative; the page directly uses the form component */}
        </CardContent>
      </Card>
    </div>
  );
}
