
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useParams, useRouter } from 'next/navigation';
import { ShoppingCart, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EditInventoryOrderForm } from '@/components/forms/inventory';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { OrderDocument } from '@/types';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import { parseISO, isValid } from 'date-fns';

export default function EditInventoryOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [orderData, setOrderData] = useState<OrderDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderData = useCallback(async () => {
    if (!orderId) {
      setError("No Order ID provided.");
      setIsLoading(false);
      Swal.fire("Error", "No Order ID specified.", "error").then(() => {
        router.push('/dashboard/inventory/inventory-orders/list');
      });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const orderDocRef = doc(firestore, "inventory_orders", orderId);
      const orderDocSnap = await getDoc(orderDocRef);

      if (orderDocSnap.exists()) {
        const data = orderDocSnap.data() as Omit<OrderDocument, 'id'>;
        const processedData: OrderDocument = {
          ...data,
          id: orderDocSnap.id,
          orderDate: data.orderDate && isValid(parseISO(data.orderDate)) ? data.orderDate : new Date().toISOString(),
          lineItems: data.lineItems.map(item => ({ ...item })),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        };
        setOrderData(processedData);
      } else {
        setError("Order record not found.");
        Swal.fire("Error", `Order with ID ${orderId} not found.`, "error").then(() => {
             router.push('/dashboard/inventory/inventory-orders/list');
        });
      }
    } catch (err: any) {
      setError(`Failed to fetch order data: ${err.message}`);
      Swal.fire("Error", `Failed to fetch order data: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    fetchOrderData();
  }, [fetchOrderData]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading order details for ID: {orderId}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-screen-2xl mx-auto shadow-xl border-destructive">
          <CardHeader><CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive"><AlertTriangle className="h-7 w-7" />Error Loading Order</CardTitle></CardHeader>
          <CardContent><p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4"><Link href="/dashboard/inventory/inventory-orders/list"><ArrowLeft className="mr-2 h-4 w-4" />Back to Orders List</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!orderData) {
     return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Order data could not be loaded.</p>
         <Button variant="outline" asChild className="mt-4"><Link href="/dashboard/inventory/inventory-orders/list"><ArrowLeft className="mr-2 h-4 w-4" />Back to Orders List</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6"><Link href="/dashboard/inventory/inventory-orders/list" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Orders List</Button></Link></div>
      <Card className="max-w-screen-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <ShoppingCart className="h-7 w-7 text-primary" />Edit Order
          </CardTitle>
          <CardDescription>Modify the details for Order ID: <span className="font-semibold text-foreground">{orderId}</span>.</CardDescription>
        </CardHeader>
        <CardContent><EditInventoryOrderForm initialData={orderData} orderId={orderId} /></CardContent>
      </Card>
    </div>
  );
}
