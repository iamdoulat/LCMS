
"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Loader2, Printer, ShoppingCart } from 'lucide-react'; // Changed icon to ShoppingCart
import Link from 'next/link';
import { cn } from '@/lib/utils';
// Placeholder: Add imports for fetching order data and types if you implement full preview

export default function OrderPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  // Placeholder: State and useEffect for fetching actual order data would go here
  const [isLoading, setIsLoading] = React.useState(false); // Set to true if fetching data
  const [orderData, setOrderData] = React.useState<any>(null); // Replace 'any' with actual OrderDocument type

  const handlePrint = () => {
    window.print();
  };

  // Placeholder: useEffect to fetch order data based on orderId
  // React.useEffect(() => {
  //   if (orderId) {
  //     setIsLoading(true);
  //     // Fetch order data from Firestore using orderId
  //     // setOrderData(fetchedData);
  //     // setIsLoading(false);
  //   }
  // }, [orderId]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading order preview...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 print-invoice-container"> {/* Reusing print-invoice-container for styles */}
      <div className="mb-6 flex justify-between items-center noprint">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button variant="default" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print Order
        </Button>
      </div>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <ShoppingCart className="h-7 w-7 text-primary" /> {/* Changed icon */}
            Order Preview
          </CardTitle>
          <CardDescription>
            Previewing Order ID: <span className="font-semibold text-foreground">{orderId}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-10 text-center text-muted-foreground">
            <p className="text-lg">Full Order Preview Content Will Be Displayed Here.</p>
            <p>This includes company details, customer information, line items, and totals.</p>
            <p className="mt-4">Order ID: <strong>{orderId}</strong></p>
          </div>
          
          {orderData && (
            <div className="mt-6 space-y-4">
              <div>
                <h4 className="font-semibold">Customer:</h4>
                <p>{orderData.customerName || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">{orderData.billingAddress || 'N/A'}</p>
              </div>
              <div>
                <h4 className="font-semibold">Line Items:</h4>
                {/* Map through orderData.lineItems here */}
              </div>
              <div className="text-right">
                <p><span className="text-muted-foreground">Subtotal:</span> {orderData.subtotal?.toFixed(2) || '0.00'}</p>
                <p><span className="text-muted-foreground">Grand Total:</span> <span className="font-bold text-primary">{orderData.totalAmount?.toFixed(2) || '0.00'}</span></p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
