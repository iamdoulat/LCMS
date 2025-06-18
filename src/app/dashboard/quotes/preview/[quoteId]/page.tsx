
"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Loader2, Printer } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
// Placeholder: Add imports for fetching quote data and types if you implement full preview

export default function QuotePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.quoteId as string;

  // Placeholder: State and useEffect for fetching actual quote data would go here
  const [isLoading, setIsLoading] = React.useState(false); // Set to true if fetching data
  const [quoteData, setQuoteData] = React.useState<any>(null); // Replace 'any' with actual QuoteDocument type

  const handlePrint = () => {
    window.print();
  };

  // Placeholder: useEffect to fetch quote data based on quoteId
  // React.useEffect(() => {
  //   if (quoteId) {
  //     setIsLoading(true);
  //     // Fetch quote data from Firestore using quoteId
  //     // setQuoteData(fetchedData);
  //     // setIsLoading(false);
  //   }
  // }, [quoteId]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading quote preview...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 print-invoice-container"> {/* Added print-invoice-container for print styles */}
      <div className="mb-6 flex justify-between items-center noprint">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button variant="default" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print Quote
        </Button>
      </div>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FileText className="h-7 w-7 text-primary" />
            Quote Preview
          </CardTitle>
          <CardDescription>
            Previewing Quote ID: <span className="font-semibold text-foreground">{quoteId}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 
            Placeholder for actual quote content rendering.
            You would map over quoteData.lineItems here, display customer info, totals, etc.
            For now, just showing a placeholder message.
          */}
          <div className="py-10 text-center text-muted-foreground">
            <p className="text-lg">Full Quote Preview Content Will Be Displayed Here.</p>
            <p>This includes company details, customer information, line items, and totals.</p>
            <p className="mt-4">Quote ID: <strong>{quoteId}</strong></p>
          </div>
          
          {/* Example of how you might display some data if quoteData was populated */}
          {quoteData && (
            <div className="mt-6 space-y-4">
              <div>
                <h4 className="font-semibold">Customer:</h4>
                <p>{quoteData.customerName || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">{quoteData.billingAddress || 'N/A'}</p>
              </div>
              <div>
                <h4 className="font-semibold">Line Items:</h4>
                {/* Map through quoteData.lineItems here */}
              </div>
              <div className="text-right">
                <p><span className="text-muted-foreground">Subtotal:</span> {quoteData.subtotal?.toFixed(2) || '0.00'}</p>
                <p><span className="text-muted-foreground">Grand Total:</span> <span className="font-bold text-primary">{quoteData.totalAmount?.toFixed(2) || '0.00'}</span></p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
