
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, getDoc, getDocs, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { InvoiceDocument, CustomerDocument, InvoiceStatus } from '@/types';
import { invoiceStatusOptions } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Loader2, CreditCard, Users, CalendarDays, DollarSign, FileText, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const applyPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice selection is required."),
  // Payment details would be in a separate modal form
});

type ApplyPaymentFormValues = z.infer<typeof applyPaymentSchema>;

const PLACEHOLDER_INVOICE_VALUE = "__APPLY_PAYMENT_INVOICE__";

interface InvoiceOption extends ComboboxOption {
  invoiceData?: InvoiceDocument;
}

export default function ApplyPaymentPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const [invoiceOptions, setInvoiceOptions] = React.useState<InvoiceOption[]>([]);
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = React.useState<{
    invoiceDate: string;
    customerName: string;
    totalAmount: number;
    amountDue: number;
    status: InvoiceStatus | undefined;
  } | null>(null);

  const form = useForm<ApplyPaymentFormValues>({
    resolver: zodResolver(applyPaymentSchema),
    defaultValues: {
      invoiceId: '',
    },
  });

  const watchedInvoiceId = form.watch("invoiceId");

  React.useEffect(() => {
    const fetchInvoices = async () => {
      setIsLoadingDropdowns(true);
      try {
        // Fetch only 'Sent', 'Partial', or 'Overdue' invoices
        const q = query(
          collection(firestore, "invoices"),
          where("status", "in", ["Sent", "Partial", "Overdue"])
        );
        const invoicesSnap = await getDocs(q);
        const fetchedOptions = invoicesSnap.docs.map(docSnap => {
          const data = docSnap.data() as InvoiceDocument;
          return {
            value: docSnap.id,
            label: `${docSnap.id} - ${data.customerName} - Amount: ${data.totalAmount.toFixed(2)}`,
            invoiceData: { ...data, id: docSnap.id },
          };
        });
        setInvoiceOptions(fetchedOptions);
      } catch (error) {
        console.error("Error fetching invoices:", error);
        Swal.fire("Error", "Could not load invoices. Please try again.", "error");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchInvoices();
  }, []);

  React.useEffect(() => {
    if (watchedInvoiceId) {
      const selectedOption = invoiceOptions.find(opt => opt.value === watchedInvoiceId);
      if (selectedOption && selectedOption.invoiceData) {
        const inv = selectedOption.invoiceData;
        const amountPaid = inv.amountPaid || 0;
        const amountDue = inv.totalAmount - amountPaid;
        setSelectedInvoiceDetails({
          invoiceDate: inv.invoiceDate ? format(parseISO(inv.invoiceDate), 'PPP') : 'N/A',
          customerName: inv.customerName || 'N/A',
          totalAmount: inv.totalAmount || 0,
          amountDue: amountDue > 0 ? amountDue : 0,
          status: inv.status,
        });
      } else {
        setSelectedInvoiceDetails(null);
      }
    } else {
      setSelectedInvoiceDetails(null);
    }
  }, [watchedInvoiceId, invoiceOptions]);

  const handleApplyPayment = async () => {
    if (!selectedInvoiceDetails || !watchedInvoiceId) {
      Swal.fire("Error", "Please select an invoice first.", "error");
      return;
    }

    // Placeholder for payment modal/dialog
    // In a real app, a modal would open here to collect paymentAmount, paymentMethod, etc.
    // For this example, we'll simulate a full payment and update the invoice.

    const paymentAmount = selectedInvoiceDetails.amountDue; // Simulate paying the full due amount

    if (paymentAmount <= 0) {
      Swal.fire("Info", "This invoice has no amount due or is already paid.", "info");
      return;
    }
    
    const { isConfirmed } = await Swal.fire({
        title: 'Confirm Payment Application',
        html: `
            You are about to apply a payment of <strong>$${paymentAmount.toFixed(2)}</strong> for Invoice <strong>${watchedInvoiceId}</strong>.
            <br/><br/>
            Payment Method: <strong>Cash (Simulated)</strong>
            <br/><br/>
            This will mark the invoice as 'Paid'. Proceed?
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Apply Payment',
        cancelButtonText: 'Cancel',
    });

    if (isConfirmed) {
        setIsSubmitting(true);
        try {
            const invoiceRef = doc(firestore, "invoices", watchedInvoiceId);
            const paymentRef = doc(collection(firestore, "payments")); // Auto-generate ID

            await runTransaction(firestore, async (transaction) => {
                const invoiceDoc = await transaction.get(invoiceRef);
                if (!invoiceDoc.exists()) {
                    throw new Error("Invoice not found.");
                }
                const invoiceData = invoiceDoc.data() as InvoiceDocument;
                const currentAmountPaid = invoiceData.amountPaid || 0;
                const newAmountPaid = currentAmountPaid + paymentAmount;
                const newStatus: InvoiceStatus = newAmountPaid >= invoiceData.totalAmount ? "Paid" : "Partial";

                transaction.update(invoiceRef, {
                    status: newStatus,
                    amountPaid: newAmountPaid,
                    updatedAt: serverTimestamp(),
                });

                transaction.set(paymentRef, {
                    invoiceId: watchedInvoiceId,
                    invoiceNumber: invoiceData.id, // Storing invoice number for easier querying on payment list
                    customerId: invoiceData.customerId,
                    customerName: invoiceData.customerName,
                    paymentAmount: paymentAmount,
                    paymentDate: serverTimestamp(), // Or allow user to select
                    paymentMethod: "Cash", // Simulated
                    notes: "Payment applied via simulated cash transaction.",
                    createdAt: serverTimestamp(),
                });
            });

            Swal.fire("Payment Applied!", `Payment for invoice ${watchedInvoiceId} has been recorded. Invoice status updated to 'Paid'.`, "success");
            form.reset();
            setSelectedInvoiceDetails(null);
            // Re-fetch invoices to update dropdown (or remove paid one)
             const q = query(collection(firestore, "invoices"), where("status", "in", ["Sent", "Partial", "Overdue"]));
             const invoicesSnap = await getDocs(q);
             setInvoiceOptions(invoicesSnap.docs.map(docSnap => {
                const data = docSnap.data() as InvoiceDocument;
                return {value: docSnap.id, label: `${docSnap.id} - ${data.customerName} - Amount: ${data.totalAmount.toFixed(2)}`, invoiceData: {...data, id: docSnap.id}};
             }));

        } catch (error: any) {
            Swal.fire("Error", `Failed to apply payment: ${error.message}`, "error");
        } finally {
            setIsSubmitting(false);
        }
    }
  };


  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <CreditCard className="h-7 w-7 text-primary" />
            Apply Payment to Invoice
          </CardTitle>
          <CardDescription>
            Select an invoice to apply a payment. Only invoices with 'Sent', 'Partial', or 'Overdue' status are shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleApplyPayment)} className="space-y-8">
              <FormField
                control={form.control}
                name="invoiceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Select Invoice*</FormLabel>
                    <Combobox
                      options={invoiceOptions}
                      value={field.value || PLACEHOLDER_INVOICE_VALUE}
                      onValueChange={(value) => field.onChange(value === PLACEHOLDER_INVOICE_VALUE ? '' : value)}
                      placeholder="Search Invoice No, Customer, Amount..."
                      selectPlaceholder={isLoadingDropdowns ? "Loading Invoices..." : "Select an Invoice"}
                      emptyStateMessage="No matching invoice found or all invoices paid."
                      disabled={isLoadingDropdowns || isSubmitting}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedInvoiceDetails && (
                <Card className="bg-muted/30 p-4 space-y-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <Info className="h-5 w-5"/> Selected Invoice Details
                  </CardTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <p><strong className="text-muted-foreground">Invoice Date:</strong> <span className="font-medium text-foreground">{selectedInvoiceDetails.invoiceDate}</span></p>
                    <p><strong className="text-muted-foreground">Customer:</strong> <span className="font-medium text-foreground">{selectedInvoiceDetails.customerName}</span></p>
                    <p><strong className="text-muted-foreground">Total Amount:</strong> <span className="font-medium text-foreground">${selectedInvoiceDetails.totalAmount.toFixed(2)}</span></p>
                    <p><strong className="text-muted-foreground">Amount Due:</strong> <span className="font-bold text-destructive">${selectedInvoiceDetails.amountDue.toFixed(2)}</span></p>
                    <p><strong className="text-muted-foreground">Status:</strong> <span className="font-medium text-foreground">{selectedInvoiceDetails.status || 'N/A'}</span></p>
                  </div>
                </Card>
              )}
              
              <Alert variant="default" className="bg-blue-500/10 border-blue-500/30">
                <Info className="h-5 w-5 text-blue-600" />
                <AlertTitle className="text-blue-700 font-semibold">Payment Modal Placeholder</AlertTitle>
                <AlertDescription className="text-blue-700/90">
                  In a full implementation, clicking "Apply Payment" would open a modal to select payment method (Cash, Bank, Card), enter amount, and other details. For this demo, it will simulate a full payment of the amount due via 'Cash'.
                </AlertDescription>
              </Alert>

              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || !watchedInvoiceId || selectedInvoiceDetails?.amountDue === 0}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Apply Payment (Simulated Full Payment)
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
