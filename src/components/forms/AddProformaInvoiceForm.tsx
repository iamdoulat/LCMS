
"use client";

import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import type { ProformaInvoice, ProformaInvoiceLineItem, FreightChargeOption, CustomerDocument, SupplierDocument } from '@/types';
import { freightChargeOptions } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from './DatePickerField';
import { Loader2, PlusCircle, Trash2, Users, Building, FileText, CalendarDays, User, DollarSign, Hash, Percent, Ship } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';

const toNumberOrUndefined = (val: unknown): number | undefined => {
  if (val === "" || val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
    return undefined;
  }
  const num = Number(String(val).trim());
  return isNaN(num) ? undefined : num;
};

const lineItemSchema = z.object({
  id: z.string().optional(), // for useFieldArray
  slNo: z.string().optional(),
  modelNo: z.string().min(1, "Model No. is required"),
  qty: z.preprocess(
    (val) => toNumberOrUndefined(val) ?? 0, // Default to 0 if blank for calculation, but Zod makes it required > 0
    z.number().int().positive({ message: "Qty must be > 0" })
  ),
  purchasePrice: z.preprocess(
    (val) => toNumberOrUndefined(val) ?? 0,
    z.number().positive({ message: "Purchase Price must be > 0" })
  ),
  salesPrice: z.preprocess(
    (val) => toNumberOrUndefined(val) ?? 0,
    z.number().positive({ message: "Sales Price must be > 0" })
  ),
});

const proformaInvoiceSchema = z.object({
  beneficiaryId: z.string().min(1, "Beneficiary is required"),
  applicantId: z.string().min(1, "Applicant is required"),
  piNo: z.string().min(1, "PI No. is required"),
  piDate: z.date({ required_error: "PI Date is required" }),
  salesPersonName: z.string().min(1, "Sales Person Name is required"),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required."),
  freightChargeOption: z.enum(freightChargeOptions, { required_error: "Freight Charge option is required" }),
  freightChargeAmount: z.preprocess(
    toNumberOrUndefined,
    z.number().nonnegative("Freight Amount cannot be negative").optional()
  ),
}).refine(data => {
    if (data.freightChargeOption === "Freight Excluded" && (data.freightChargeAmount === undefined || data.freightChargeAmount < 0)) {
        return false;
    }
    return true;
}, {
    message: "Freight Amount is required and must be non-negative if Freight Charge is 'Excluded'",
    path: ["freightChargeAmount"],
});

type ProformaInvoiceFormValues = z.infer<typeof proformaInvoiceSchema>;

interface DropdownOption {
  value: string;
  label: string;
}

const sectionHeadingClass = "font-semibold text-xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-4 flex items-center";


export function AddProformaInvoiceForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<DropdownOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<DropdownOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  // Calculated Totals State
  const [totalQty, setTotalQty] = React.useState(0);
  const [totalPurchasePrice, setTotalPurchasePrice] = React.useState(0);
  const [totalSalesPrice, setTotalSalesPrice] = React.useState(0);
  const [grandTotalSalesPrice, setGrandTotalSalesPrice] = React.useState(0);
  const [totalCommissionPercentage, setTotalCommissionPercentage] = React.useState(0);


  const form = useForm<ProformaInvoiceFormValues>({
    resolver: zodResolver(proformaInvoiceSchema),
    defaultValues: {
      beneficiaryId: '',
      applicantId: '',
      piNo: '',
      piDate: new Date(),
      salesPersonName: '',
      lineItems: [{ slNo: '1', modelNo: '', qty: '', purchasePrice: '', salesPrice: '' }],
      freightChargeOption: "Freight Included",
      freightChargeAmount: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  // Fetch Applicant and Beneficiary Options
  React.useEffect(() => {
    const fetchOptions = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [customersSnap, suppliersSnap] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(collection(firestore, "suppliers"))
        ]);
        
        setApplicantOptions(
          customersSnap.docs.map(doc => ({ value: doc.id, label: (doc.data() as CustomerDocument).applicantName || 'Unnamed Applicant' }))
        );
        setBeneficiaryOptions(
          suppliersSnap.docs.map(doc => ({ value: doc.id, label: (doc.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' }))
        );
      } catch (error) {
        console.error("Error fetching dropdown options for PI form: ", error);
        Swal.fire("Error", "Could not load applicant/beneficiary data. Please try again.", "error");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchOptions();
  }, []);

  const watchedLineItems = form.watch("lineItems");
  const watchedFreightOption = form.watch("freightChargeOption");
  const watchedFreightAmount = form.watch("freightChargeAmount");

  // Calculate Totals
  React.useEffect(() => {
    let newTotalQty = 0;
    let newTotalPurchase = 0;
    let newTotalSales = 0;

    watchedLineItems.forEach(item => {
      const qty = Number(item.qty) || 0;
      const purchaseP = Number(item.purchasePrice) || 0;
      const salesP = Number(item.salesPrice) || 0;
      
      newTotalQty += qty;
      newTotalPurchase += qty * purchaseP;
      newTotalSales += qty * salesP;
    });

    setTotalQty(newTotalQty);
    setTotalPurchasePrice(newTotalPurchase);
    setTotalSalesPrice(newTotalSales);

    let currentGrandTotal = newTotalSales;
    if (watchedFreightOption === "Freight Excluded") {
      currentGrandTotal += Number(watchedFreightAmount) || 0;
    }
    setGrandTotalSalesPrice(currentGrandTotal);

    if (newTotalPurchase > 0 && currentGrandTotal > newTotalPurchase) {
      const commission = ((currentGrandTotal - newTotalPurchase) / newTotalPurchase) * 100;
      setTotalCommissionPercentage(parseFloat(commission.toFixed(2)));
    } else {
      setTotalCommissionPercentage(0);
    }

  }, [watchedLineItems, watchedFreightOption, watchedFreightAmount]);


  async function onSubmit(data: ProformaInvoiceFormValues) {
    setIsSubmitting(true);

    const selectedApplicant = applicantOptions.find(opt => opt.value === data.applicantId);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === data.beneficiaryId);

    const dataToSave: Omit<ProformaInvoice, 'id' | 'createdAt' | 'updatedAt'> = {
      beneficiaryId: data.beneficiaryId,
      beneficiaryName: selectedBeneficiary?.label || 'N/A',
      applicantId: data.applicantId,
      applicantName: selectedApplicant?.label || 'N/A',
      piNo: data.piNo,
      piDate: data.piDate, // Will be converted to ISO string before Firestore
      salesPersonName: data.salesPersonName,
      lineItems: data.lineItems.map(item => ({
        slNo: item.slNo,
        modelNo: item.modelNo,
        qty: Number(item.qty),
        purchasePrice: Number(item.purchasePrice),
        salesPrice: Number(item.salesPrice),
      })),
      freightChargeOption: data.freightChargeOption,
      freightChargeAmount: data.freightChargeOption === "Freight Excluded" ? Number(data.freightChargeAmount) : undefined,
      totalQty,
      totalPurchasePrice,
      totalSalesPrice,
      grandTotalSalesPrice,
      totalCommissionPercentage,
    };

    try {
      const docToSaveInFirestore = {
        ...dataToSave,
        piDate: format(dataToSave.piDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"), // Convert Date to ISO string
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(firestore, "proforma_invoices"), docToSaveInFirestore);
      Swal.fire({
        title: "PI Saved!",
        text: "Proforma Invoice has been successfully saved.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      form.reset();
      // Reset calculated totals manually if needed
      setTotalQty(0);
      setTotalPurchasePrice(0);
      setTotalSalesPrice(0);
      setGrandTotalSalesPrice(0);
      setTotalCommissionPercentage(0);

    } catch (error: any) {
      console.error("Error adding PI document: ", error);
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save PI: ${error.message}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="beneficiaryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Beneficiary Name*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingDropdowns}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingDropdowns ? "Loading..." : "Select Beneficiary"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {beneficiaryOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="applicantId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Applicant Name*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingDropdowns}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingDropdowns ? "Loading..." : "Select Applicant"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {applicantOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="piNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />PI No.*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Proforma Invoice number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="piDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />PI Date*</FormLabel>
                <DatePickerField field={field} placeholder="Select PI date" />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="salesPersonName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Sales Person Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter sales person's name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />
        <h3 className={cn(sectionHeadingClass, "text-lg")}>
           <DollarSign className="mr-2 h-5 w-5 text-primary" /> Line Items
        </h3>
        
        {/* Placeholder for Line Items Table */}
        <div className="text-muted-foreground p-4 border rounded-md">
            Line items table will be implemented here in the next step.
        </div>
        {form.formState.errors.lineItems && !form.formState.errors.lineItems.message && (
            <p className="text-sm font-medium text-destructive">At least one line item is required.</p>
        )}
         {form.formState.errors.lineItems?.root?.message && (
            <p className="text-sm font-medium text-destructive">{form.formState.errors.lineItems.root.message}</p>
        )}
        

        <Separator />
        {/* Placeholder for Freight and Totals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <FormField
                control={form.control}
                name="freightChargeOption"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Ship className="mr-2 h-4 w-4 text-muted-foreground" />Freight Charge*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select Freight Option" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {freightChargeOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
            {form.watch("freightChargeOption") === "Freight Excluded" && (
                <FormField
                    control={form.control}
                    name="freightChargeAmount"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />Freight Amount</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="Enter freight amount" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            )}
        </div>

        <Separator />
        <div className="space-y-2 text-sm">
            <h4 className="font-medium text-lg">Calculated Totals:</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 p-2 border rounded-md">
                <p><strong>Total Qty:</strong> {totalQty}</p>
                <p><strong>Total Purchase Price:</strong> {totalPurchasePrice.toFixed(2)}</p>
                <p><strong>Total Sales Price:</strong> {totalSalesPrice.toFixed(2)}</p>
                <p className="font-semibold text-primary col-span-full md:col-span-1 mt-2 md:mt-0"><strong>Grand Total Sales:</strong> {grandTotalSalesPrice.toFixed(2)}</p>
                <p className="font-semibold text-green-600 col-span-full md:col-span-2 mt-2 md:mt-0"><strong>Total Comm. (%):</strong> {totalCommissionPercentage}%</p>
            </div>
        </div>


        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingDropdowns}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving PI...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Save Proforma Invoice
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
