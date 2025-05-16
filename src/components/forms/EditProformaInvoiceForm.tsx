
"use client";

import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import type { ProformaInvoiceDocument, ProformaInvoiceLineItem, FreightChargeOption, CustomerDocument, SupplierDocument } from '@/types';
import { freightChargeOptions } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from './DatePickerField';
import { Loader2, PlusCircle, Trash2, Users, Building, FileText, CalendarDays, User, DollarSign, Hash, Percent, Ship, Save } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';

// Zod schema for a single line item - accepting strings for form input
const lineItemFormSchema = z.object({
  slNo: z.string().optional(),
  modelNo: z.string().min(1, "Model No. is required"),
  qty: z.string().min(1, "Qty is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Qty must be > 0" }),
  purchasePrice: z.string().min(1, "Purchase Price is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Purchase Price must be > 0" }),
  salesPrice: z.string().min(1, "Sales Price is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Sales Price must be > 0" }),
});

const proformaInvoiceSchema = z.object({
  beneficiaryId: z.string().min(1, "Beneficiary is required"),
  applicantId: z.string().min(1, "Applicant is required"),
  piNo: z.string().min(1, "PI No. is required"),
  piDate: z.date({ required_error: "PI Date is required" }),
  salesPersonName: z.string().min(1, "Sales Person Name is required"),
  lineItems: z.array(lineItemFormSchema).min(1, "At least one line item is required."),
  freightChargeOption: z.enum(freightChargeOptions, { required_error: "Freight Charge option is required" }),
  freightChargeAmount: z.string().optional(),
}).refine(data => {
    if (data.freightChargeOption === "Freight Excluded") {
        const amount = parseFloat(data.freightChargeAmount || '');
        return !isNaN(amount) && amount >= 0;
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

interface EditProformaInvoiceFormProps {
  initialData: ProformaInvoiceDocument;
  piId: string;
}

const sectionHeadingClass = "font-semibold text-xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-4 flex items-center";

export function EditProformaInvoiceForm({ initialData, piId }: EditProformaInvoiceFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<DropdownOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<DropdownOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  const [totalQty, setTotalQty] = React.useState(0);
  const [totalPurchasePriceAmount, setTotalPurchasePriceAmount] = React.useState(0);
  const [totalSalesPriceAmount, setTotalSalesPriceAmount] = React.useState(0);
  const [grandTotalSalesPrice, setGrandTotalSalesPrice] = React.useState(0);
  const [totalCommissionPercentage, setTotalCommissionPercentage] = React.useState(0);

  const form = useForm<ProformaInvoiceFormValues>({
    resolver: zodResolver(proformaInvoiceSchema),
    // Default values are set by form.reset in useEffect
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

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
        console.error("Error fetching dropdown options for PI edit form: ", error);
        Swal.fire("Error", "Could not load applicant/beneficiary data. Please try again.", "error");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchOptions();
  }, []);

  React.useEffect(() => {
    if (initialData && !isLoadingDropdowns) { // Ensure dropdowns are loaded before reset
      form.reset({
        beneficiaryId: initialData.beneficiaryId || '',
        applicantId: initialData.applicantId || '',
        piNo: initialData.piNo || '',
        piDate: initialData.piDate && isValid(parseISO(initialData.piDate)) ? parseISO(initialData.piDate) : new Date(),
        salesPersonName: initialData.salesPersonName || '',
        lineItems: initialData.lineItems.map(item => ({
          slNo: item.slNo || '',
          modelNo: item.modelNo || '',
          qty: item.qty?.toString() || '',
          purchasePrice: item.purchasePrice?.toString() || '',
          salesPrice: item.salesPrice?.toString() || '',
        })),
        freightChargeOption: initialData.freightChargeOption || "Freight Included",
        freightChargeAmount: initialData.freightChargeAmount?.toString() || '',
      });
    }
  }, [initialData, form, isLoadingDropdowns]);

  const watchedLineItems = form.watch("lineItems");
  const watchedFreightOption = form.watch("freightChargeOption");
  const watchedFreightAmountString = form.watch("freightChargeAmount");

  React.useEffect(() => {
    let newTotalQty = 0;
    let newTotalPurchase = 0;
    let newTotalSales = 0;

    watchedLineItems.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const purchaseP = parseFloat(item.purchasePrice) || 0;
      const salesP = parseFloat(item.salesPrice) || 0;
      
      if (qty > 0) {
        newTotalQty += qty;
        if (purchaseP > 0) newTotalPurchase += qty * purchaseP;
        if (salesP > 0) newTotalSales += qty * salesP;
      }
    });

    setTotalQty(newTotalQty);
    setTotalPurchasePriceAmount(newTotalPurchase);
    setTotalSalesPriceAmount(newTotalSales);

    let currentGrandTotal = newTotalSales;
    if (watchedFreightOption === "Freight Excluded") {
      const freightAmountNum = parseFloat(watchedFreightAmountString || '');
      if (!isNaN(freightAmountNum) && freightAmountNum >= 0) {
        currentGrandTotal += freightAmountNum;
      }
    }
    setGrandTotalSalesPrice(currentGrandTotal);

    if (newTotalPurchase > 0 && currentGrandTotal > newTotalPurchase) {
      const commission = ((currentGrandTotal - newTotalPurchase) / newTotalPurchase) * 100;
      setTotalCommissionPercentage(parseFloat(commission.toFixed(2)));
    } else {
      setTotalCommissionPercentage(0);
    }
  }, [watchedLineItems, watchedFreightOption, watchedFreightAmountString]);

  async function onSubmit(data: ProformaInvoiceFormValues) {
    setIsSubmitting(true);

    const selectedApplicant = applicantOptions.find(opt => opt.value === data.applicantId);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === data.beneficiaryId);

    const freightAmountForDb = data.freightChargeOption === "Freight Excluded" ? parseFloat(data.freightChargeAmount || '0') : undefined;
    if (data.freightChargeOption === "Freight Excluded" && (isNaN(freightAmountForDb!) || freightAmountForDb! < 0)) {
        form.setError("freightChargeAmount", { type: "manual", message: "Freight Amount must be a valid non-negative number if 'Excluded'." });
        setIsSubmitting(false);
        return;
    }

    let finalTotalQty = 0;
    let finalTotalPurchasePrice = 0;
    let finalTotalSalesPrice = 0;

    const processedLineItems = data.lineItems.map(item => {
      const qty = parseFloat(item.qty);
      const purchasePrice = parseFloat(item.purchasePrice);
      const salesPrice = parseFloat(item.salesPrice);

      finalTotalQty += qty;
      finalTotalPurchasePrice += qty * purchasePrice;
      finalTotalSalesPrice += qty * salesPrice;
      
      return {
        slNo: item.slNo || undefined, // Store undefined if empty
        modelNo: item.modelNo,
        qty: qty,
        purchasePrice: purchasePrice,
        salesPrice: salesPrice,
      };
    });

    let finalGrandTotalSalesPrice = finalTotalSalesPrice;
    if (data.freightChargeOption === "Freight Excluded" && freightAmountForDb !== undefined) {
      finalGrandTotalSalesPrice += freightAmountForDb;
    }

    let finalTotalCommissionPercentage = 0;
    if (finalTotalPurchasePrice > 0 && finalGrandTotalSalesPrice > finalTotalPurchasePrice) {
      finalTotalCommissionPercentage = parseFloat((((finalGrandTotalSalesPrice - finalTotalPurchasePrice) / finalTotalPurchasePrice) * 100).toFixed(2));
    }
    
    const dataToUpdate: Partial<Omit<ProformaInvoiceDocument, 'id' | 'createdAt'>> = {
      beneficiaryId: data.beneficiaryId,
      beneficiaryName: selectedBeneficiary?.label || initialData.beneficiaryName,
      applicantId: data.applicantId,
      applicantName: selectedApplicant?.label || initialData.applicantName,
      piNo: data.piNo,
      piDate: format(data.piDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      salesPersonName: data.salesPersonName,
      lineItems: processedLineItems,
      freightChargeOption: data.freightChargeOption,
      freightChargeAmount: freightAmountForDb,
      totalQty: finalTotalQty,
      totalPurchasePrice: finalTotalPurchasePrice,
      totalSalesPrice: finalTotalSalesPrice,
      grandTotalSalesPrice: finalGrandTotalSalesPrice,
      totalCommissionPercentage: finalTotalCommissionPercentage,
      updatedAt: serverTimestamp(),
    };

    try {
      const piDocRef = doc(firestore, "proforma_invoices", piId);
      await updateDoc(piDocRef, dataToUpdate);
      Swal.fire({
        title: "PI Updated!",
        text: `Proforma Invoice "${data.piNo}" has been successfully updated.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error: any) {
      console.error("Error updating PI document: ", error);
      Swal.fire({
        title: "Update Failed",
        text: `Failed to update PI: ${error.message}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleAddLineItem = () => {
    append({ slNo: (fields.length + 1).toString(), modelNo: '', qty: '', purchasePrice: '', salesPrice: '' });
  };

  if (isLoadingDropdowns) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading form options...</p>
      </div>
    );
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
        
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">SL No.</TableHead>
                <TableHead>Model No.*</TableHead>
                <TableHead className="w-[120px]">Qty*</TableHead>
                <TableHead className="w-[150px]">Purchase Price*</TableHead>
                <TableHead className="w-[150px]">Sales Price*</TableHead>
                <TableHead className="w-[80px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`lineItems.${index}.slNo`}
                      render={({ field }) => (
                        <Input placeholder="SL" {...field} className="h-9"/>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`lineItems.${index}.modelNo`}
                      render={({ field }) => (
                        <>
                          <Input placeholder="Model No." {...field} className="h-9"/>
                          <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.modelNo?.message}</FormMessage>
                        </>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                     <FormField
                      control={form.control}
                      name={`lineItems.${index}.qty`}
                      render={({ field }) => (
                        <>
                          <Input type="text" placeholder="Qty" {...field} className="h-9"/>
                          <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.qty?.message}</FormMessage>
                        </>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                     <FormField
                      control={form.control}
                      name={`lineItems.${index}.purchasePrice`}
                      render={({ field }) => (
                         <>
                          <Input type="text" placeholder="Purchase Price" {...field} className="h-9"/>
                          <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.purchasePrice?.message}</FormMessage>
                        </>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                     <FormField
                      control={form.control}
                      name={`lineItems.${index}.salesPrice`}
                      render={({ field }) => (
                        <>
                          <Input type="text" placeholder="Sales Price" {...field} className="h-9"/>
                          <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.salesPrice?.message}</FormMessage>
                        </>
                      )}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} title="Remove line item">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {form.formState.errors.lineItems && !form.formState.errors.lineItems.message && !Array.isArray(form.formState.errors.lineItems) && (
            <p className="text-sm font-medium text-destructive">{form.formState.errors.lineItems.root?.message || "Please ensure all line items are valid."}</p>
        )}
        <Button type="button" variant="outline" onClick={handleAddLineItem} className="mt-2">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Line Item
        </Button>
        
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
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
                            <Input type="text" placeholder="Enter freight amount" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            )}
        </div>

        <Separator />
        <div className="space-y-2 text-sm p-4 border rounded-md shadow-sm bg-muted/30">
            <h4 className="font-medium text-lg text-foreground">Calculated Totals:</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                <p><strong className="text-muted-foreground">Total Qty:</strong> <span className="font-semibold text-foreground">{totalQty}</span></p>
                <p><strong className="text-muted-foreground">Total Purchase Price:</strong> <span className="font-semibold text-foreground">{totalPurchasePriceAmount.toFixed(2)}</span></p>
                <p><strong className="text-muted-foreground">Total Sales Price:</strong> <span className="font-semibold text-foreground">{totalSalesPriceAmount.toFixed(2)}</span></p>
                <p className="font-semibold text-primary md:col-span-1 mt-2 md:mt-0"><strong className="text-muted-foreground">Grand Total Sales:</strong> <span className="text-primary">{grandTotalSalesPrice.toFixed(2)}</span></p>
                <p className="font-semibold text-green-600 md:col-span-2 mt-2 md:mt-0"><strong className="text-muted-foreground">Total Comm. (%):</strong> <span className="text-green-600">{totalCommissionPercentage}%</span></p>
            </div>
        </div>

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingDropdowns}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

