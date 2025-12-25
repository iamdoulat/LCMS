
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { format, parseISO } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, query, where, runTransaction, serverTimestamp, onSnapshot, getDocs } from 'firebase/firestore';
import type { InvoiceDocument, InvoiceStatus, PettyCashAccountDocument, PettyCashCategoryDocument } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Loader2, CreditCard, FileText, Info, Wallet, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { DatePickerField } from '@/components/forms/common';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';

const invoiceSelectSchema = z.object({
  invoiceId: z.string().min(1, "Invoice selection is required."),
});
type InvoiceSelectFormValues = z.infer<typeof invoiceSelectSchema>;

const paymentMethods = ["Cash", "Bank Transfer", "Card", "Check"] as const;

const PLACEHOLDER_INVOICE_VALUE = "__APPLY_PAYMENT_INVOICE__";



interface InvoiceOption extends ComboboxOption {
  invoiceData?: InvoiceDocument;
}

export default function ApplyPaymentPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const [invoiceOptions, setInvoiceOptions] = React.useState<InvoiceOption[]>([]);
  const [accountOptions, setAccountOptions] = React.useState<ComboboxOption[]>([]);
  const [categoryOptions, setCategoryOptions] = React.useState<MultiSelectOption[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = React.useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = React.useState(true);

  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = React.useState<{
    invoiceDate: string;
    customerName: string;
    totalAmount: number;
    amountDue: number;
    status: InvoiceStatus | undefined;
  } | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);

  const invoiceSelectForm = useForm<InvoiceSelectFormValues>({
    resolver: zodResolver(invoiceSelectSchema),
    defaultValues: {
      invoiceId: '',
    },
  });

  const watchedInvoiceId = invoiceSelectForm.watch("invoiceId");

  React.useEffect(() => {
    setIsLoadingDropdowns(true);
    const q = query(
      collection(firestore, "sales_invoice"),
      where("status", "in", ["Sent", "Partial", "Overdue"])
    );

    const unsubscribeInvoices = onSnapshot(q, (querySnapshot) => {
      const fetchedOptions = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as InvoiceDocument;
        const amountDue = data.totalAmount - (data.amountPaid || 0);
        return {
          value: docSnap.id,
          label: `${docSnap.id} - ${data.customerName} - Due: ${amountDue.toFixed(2)}`,
          invoiceData: { ...data, id: docSnap.id },
        };
      });
      setInvoiceOptions(fetchedOptions);
      setIsLoadingDropdowns(false);
    }, (error) => {
      console.error("Error fetching invoices with onSnapshot: ", error);
      Swal.fire("Error", `Could not load invoices in real-time. Error: ${error.message}`, "error");
      setIsLoadingDropdowns(false);
    });

    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      try {
        const accountsQuery = query(collection(firestore, "petty_cash_accounts"));
        const accountsSnapshot = await getDocs(accountsQuery);
        setAccountOptions(
          accountsSnapshot.docs.map(d => ({ value: d.id, label: (d.data() as PettyCashAccountDocument).name || 'Unnamed Account' }))
        );
      } catch (e) {
        console.error("Error fetching petty cash accounts: ", e);
        Swal.fire("Error", "Could not load source accounts.", "error");
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const categoriesQuery = query(collection(firestore, "petty_cash_categories"));
        const categoriesSnapshot = await getDocs(categoriesQuery);
        setCategoryOptions(
          categoriesSnapshot.docs.map(d => ({ value: d.id, label: (d.data() as PettyCashCategoryDocument).name || 'Unnamed Category' }))
        );
      } catch (e) {
        console.error("Error fetching petty cash categories: ", e);
        Swal.fire("Error", "Could not load categories.", "error");
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchAccounts();
    fetchCategories();

    return () => unsubscribeInvoices();
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

  const paymentDetailsSchema = React.useMemo(() => {
    const amountDue = selectedInvoiceDetails?.amountDue ?? 0;
    return z.object({
      paymentAmount: z.preprocess(
        (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
        z.number({ invalid_type_error: "Amount must be a number." }).positive("Payment amount must be positive.")
      ).refine(
        (amount) => amount <= amountDue,
        { message: `Payment cannot exceed amount due ($${amountDue.toFixed(2)}).`, path: ["paymentAmount"] }
      ),
      paymentDate: z.date({ required_error: "Payment date is required." }),
      sourceAccountId: z.string().min(1, "Source account is required."),
      categoryIds: z.array(z.string()).min(1, "At least one category is required."),
      paymentMethod: z.enum(paymentMethods, { required_error: "Payment method is required." }),
      notes: z.string().optional(),
    });
  }, [selectedInvoiceDetails]);

  type PaymentDetailsFormValues = z.infer<typeof paymentDetailsSchema>;

  const paymentDetailsForm = useForm<PaymentDetailsFormValues>({
    resolver: zodResolver(paymentDetailsSchema),
    defaultValues: {
      paymentAmount: undefined,
      paymentDate: new Date(),
      sourceAccountId: '',
      categoryIds: [],
      paymentMethod: "Cash",
      notes: '',
    }
  });

  React.useEffect(() => {
    if (isPaymentDialogOpen) {
      const invoicePaymentCategory = categoryOptions.find(cat => cat.label.toLowerCase() === "invoice payment received");
      const pettyCashAccount = accountOptions.find(acc => acc.label.toLowerCase() === "petty cash");

      paymentDetailsForm.reset({
        paymentAmount: selectedInvoiceDetails?.amountDue ?? undefined,
        paymentDate: new Date(),
        sourceAccountId: pettyCashAccount ? pettyCashAccount.value : '',
        categoryIds: invoicePaymentCategory ? [invoicePaymentCategory.value] : [],
        paymentMethod: "Cash",
        notes: `Payment for Invoice: ${watchedInvoiceId}`,
      });
    }
  }, [isPaymentDialogOpen, selectedInvoiceDetails, paymentDetailsForm, categoryOptions, accountOptions, watchedInvoiceId]);


  async function onProcessPayment(data: PaymentDetailsFormValues) {
    if (!watchedInvoiceId) {
      Swal.fire("Error", "No invoice selected.", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const selectedAccount = accountOptions.find(opt => opt.value === data.sourceAccountId);
      const selectedCategories = categoryOptions.filter(opt => data.categoryIds.includes(opt.value));

      if (!selectedAccount) {
        throw new Error("Selected source account not found.");
      }
      if (selectedCategories.length === 0) {
        throw new Error("A payment category must be selected.");
      }

      const invoiceRef = doc(firestore, "sales_invoice", watchedInvoiceId);
      const accountRef = doc(firestore, "petty_cash_accounts", data.sourceAccountId);
      const paymentRef = doc(collection(firestore, "payments"));
      const transactionRef = doc(collection(firestore, "petty_cash_transactions"));

      await runTransaction(firestore, async (transaction) => {
        const [invoiceDoc, accountDoc] = await Promise.all([
          transaction.get(invoiceRef),
          transaction.get(accountRef)
        ]);

        if (!invoiceDoc.exists()) {
          throw new Error("Invoice not found.");
        }
        if (!accountDoc.exists()) {
          throw new Error("Petty cash account not found.");
        }

        // Update Invoice
        const invoiceData = invoiceDoc.data() as InvoiceDocument;
        const currentAmountPaid = invoiceData.amountPaid || 0;
        const newAmountPaid = currentAmountPaid + data.paymentAmount;
        const newStatus: InvoiceStatus = newAmountPaid >= invoiceData.totalAmount ? "Paid" : "Partial";
        transaction.update(invoiceRef, {
          status: newStatus,
          amountPaid: newAmountPaid,
          updatedAt: serverTimestamp(),
        });

        // Update Petty Cash Account Balance
        const currentBalance = accountDoc.data().balance || 0;
        const newBalance = currentBalance + data.paymentAmount;
        transaction.update(accountRef, {
          balance: newBalance,
          updatedAt: serverTimestamp(),
        });

        // Create Payment Record
        transaction.set(paymentRef, {
          invoiceId: watchedInvoiceId,
          invoiceNumber: invoiceDoc.id,
          customerId: invoiceData.customerId,
          customerName: invoiceData.customerName,
          paymentAmount: data.paymentAmount,
          paymentDate: format(data.paymentDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          paymentMethod: data.paymentMethod,
          sourceAccountId: data.sourceAccountId,
          sourceAccountName: selectedAccount?.label || 'N/A',
          notes: data.notes || "",
          createdAt: serverTimestamp(),
        });

        // Create Petty Cash Transaction
        transaction.set(transactionRef, {
          transactionDate: format(data.paymentDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          accountId: data.sourceAccountId,
          accountName: selectedAccount?.label || 'N/A',
          categoryIds: selectedCategories.map(c => c.value),
          categoryNames: selectedCategories.map(c => c.label),
          type: 'Credit',
          payeeName: invoiceData.customerName || 'N/A',
          amount: data.paymentAmount,
          purpose: `Payment received for Invoice ${invoiceDoc.id}`,
          description: data.notes || `Payment applied to Invoice ${invoiceDoc.id}`,
          connectedSaleId: invoiceDoc.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      Swal.fire("Payment Applied!", `Payment for invoice ${watchedInvoiceId} has been recorded. Invoice status and account balance updated.`, "success");
      setIsPaymentDialogOpen(false);
      invoiceSelectForm.reset({ invoiceId: '' });
    } catch (error: any) {
      Swal.fire("Error", `Failed to apply payment: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }


  return (
    <div className="container mx-auto py-8 px-5">
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
          <Form {...invoiceSelectForm}>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
              <FormField
                control={invoiceSelectForm.control}
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
                    <Info className="h-5 w-5" /> Selected Invoice Details
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

              <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full md:w-auto" disabled={!watchedInvoiceId || selectedInvoiceDetails?.amountDue === 0}>
                    <CreditCard className="mr-2 h-4 w-4" /> Apply Payment
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Apply Payment Details</DialogTitle>
                    <DialogDescription>
                      Enter the payment details for invoice <strong>{watchedInvoiceId}</strong>.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...paymentDetailsForm}>
                    <form onSubmit={paymentDetailsForm.handleSubmit(onProcessPayment)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
                      <FormField
                        control={paymentDetailsForm.control}
                        name="paymentAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Amount</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={paymentDetailsForm.control}
                        name="paymentDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Payment Date</FormLabel>
                            <DatePickerField field={field} placeholder="Select payment date" />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={paymentDetailsForm.control}
                        name="sourceAccountId"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel className="flex items-center"><Wallet className="mr-2 h-4 w-4 text-muted-foreground" />Source Account*</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex flex-col space-y-1"
                                disabled={isLoadingAccounts}
                              >
                                {accountOptions.map((account) => (
                                  <FormItem key={account.value} className="flex items-center space-x-3 space-y-0">
                                    <FormControl>
                                      <RadioGroupItem value={account.value} />
                                    </FormControl>
                                    <FormLabel className="font-normal">
                                      {account.label}
                                    </FormLabel>
                                  </FormItem>
                                ))}
                              </RadioGroup>
                            </FormControl>
                            {isLoadingAccounts && <p className="text-sm text-muted-foreground">Loading accounts...</p>}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={paymentDetailsForm.control}
                        name="categoryIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center"><List className="mr-1.5 h-4 w-4 text-muted-foreground" />Transaction Categories*</FormLabel>
                            <MultiSelect
                              options={categoryOptions}
                              selected={field.value || []}
                              onChange={field.onChange}
                              placeholder="Select categories..."
                              disabled={isLoadingCategories}
                            />
                            <FormMessage />
                          </FormItem>
                        )} />
                      <FormField
                        control={paymentDetailsForm.control}
                        name="paymentMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Method</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a payment method" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {paymentMethods.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={paymentDetailsForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes (Optional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="e.g., Transaction ID, check number" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter className="mt-4 pt-4 border-t">
                        <DialogClose asChild>
                          <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Confirm Payment
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
