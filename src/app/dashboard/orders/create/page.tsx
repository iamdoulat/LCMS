
"use client";

import { CreateOrderForm } from '@/components/forms/CreateOrderForm'; // Import the new form
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CreateNewOrderPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-screen-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <ShoppingCart className="h-7 w-7 text-primary" />
            Create New Order
          </CardTitle>
          <CardDescription>
            Fill in the details below to create a new sales order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrderForm /> {/* Use the imported form component */}
        </CardContent>
      </Card>
    </div>
  );
}
