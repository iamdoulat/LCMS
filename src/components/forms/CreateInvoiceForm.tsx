

"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, runTransaction, setDoc } from 'firebase/firestore';
import type { InvoiceDocument, InvoiceFormValues, CustomerDocument, ItemDocument as ItemDoc, QuoteTaxType, InvoiceLineItemFormValues, InvoiceStatus } from '@/types';
import { InvoiceSchema, quoteTaxTypes, invoiceStatusOptions } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, PlusCircle, Trash2, Users, FileText, CalendarDays, DollarSign, Save, X, ShoppingBag, Hash, Columns, Printer, Edit, Mail } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_CUSTOMER_VALUE = "__INVOICE_CUSTOMER_PLACEHOLDER__";
const PLACEHOLDER_ITEM_VALUE = "__INVOICE_ITEM_PLACEHOLDER__";

interface ItemOption extends ComboboxOption {
  description?: string;
  salesPrice?: number;
  itemCode?: string;
  manageStock?: boolean;
  currentQuantity?: number;
}

interface CustomerOption extends ComboboxOption {
  address?: string;
}

export function CreateInvoiceForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customerOptions, setCustomerOptions] = React.useState<CustomerOption[]>([]);
  const [itemOptions, setItemOptions] = React.useState<ItemOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const [generatedInvoiceId, setGeneratedInvoiceId] = React.useState<string | null>(null);

  const [subtotal, setSubtotal] = React.useState(0);
  const [totalTaxAmount, setTotalTaxAmount] = React.useState(0);
  const [totalDiscountAmount, setTotalDiscountAmount] = React.useState(0);
  const [grandTotal, setGrandTotal] = React.useState(0);

  const [showItemCodeColumn, setShowItemCodeColumn] = React.useState(true);
  const [showDiscountColumn, setShowDiscountColumn] = React.useState(true);
  const [showTaxColumn, setShowTaxColumn] = React.useState(true);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(InvoiceSchema),
    defaultValues: {
      customerId: '',
      billingAddress: '',
      shippingAddress: '',
      sameAsBilling: true,
      invoiceDate: new Date(),
      dueDate: undefined,
      paymentTerms: '',
      salesperson: '',
      lineItems: [{
        itemId: '',
        itemCode: '',
        description: '',
        qty: '1',
        unitPrice: '0',
        discountPercentage: '0',
        taxPercentage: '0',
        total: '0.00'
      }],
      taxType: 'Default',
      comments: '',
      privateComments: '',
      status: "Draft",
    },
  });

  const { control, setValue, watch, getValues, reset, handleSubmit } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const watchedCustomerId = watch("customerId");
  const watchedSameAsBilling = watch("sameAsBilling");
  const watchedBillingAddress = watch("billingAddress");
  const watchedLineItems = watch("lineItems");
  const watchedTaxType = watch("taxType");

  React.useEffect(() => {
    const fetchOptions = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [customersSnap, itemsSnap] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(collection(firestore, "items"))
        ]);
        setCustomerOptions(
          customersSnap.docs.map(doc => {
            const data = doc.data() as CustomerDocument;
            return { value: doc.id, label: data.applicantName || 'Unnamed Customer', address: data.address };
          })
        );
        setItemOptions(
          itemsSnap.docs.map(doc => {
            const data = doc.data() as ItemDoc;
            return {
              value: doc.id,
              label: `${data.itemName}${data.itemCode ? ` (${data.itemCode})` : ''}`,
              description: data.description,
              salesPrice: data.salesPrice,
              itemCode: data.itemCode,
              manageStock: data.manageStock,
              currentQuantity: data.currentQuantity,
            };
          })
        );
      } catch (error) {
        Swal.fire("Error", "Could not load customer or item data. Please try again.", "error");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchOptions();
  }, []);

  React.useEffect(() => {
    if (watchedCustomerId) {
      const selectedCustomer = customerOptions.find(opt => opt.value === watchedCustomerId);
      if (selectedCustomer) {
        setValue("billingAddress", selectedCustomer.address || "");
        if (getValues("sameAsBilling")) {
          setValue("shippingAddress", selectedCustomer.address || "");
        }
      }
    }
  }, [watchedCustomerId, customerOptions, setValue, getValues]);

  React.useEffect(() => {
    if (watchedSameAsBilling) {
      setValue("shippingAddress", getValues("billingAddress"));
    }
  }, [watchedSameAsBilling, watchedBillingAddress, setValue, getValues]);

  React.useEffect(() => {
    let currentSubtotal = 0;
    let currentTotalTax = 0;
    let currentTotalDiscount = 0;
    if (Array.isArray(watchedLineItems)) {
      watchedLineItems.forEach((item, index) => {
        const qty = parseFloat(String(item.qty || '0')) || 0;
        const unitPrice = parseFloat(String(item.unitPrice || '0')) || 0;
        const discountP = parseFloat(String(item.discountPercentage || '0')) || 0;
        const taxP = parseFloat(String(item.taxPercentage || '0')) || 0;
        let lineTotal = 0;
        if (qty > 0 && unitPrice >= 0) {
          const itemTotalBeforeDiscount = qty * unitPrice;
          const lineDiscountAmount = itemTotalBeforeDiscount * (discountP / 100);
          const itemTotalAfterDiscount = itemTotalBeforeDiscount - lineDiscountAmount;
          const lineTaxAmount = itemTotalAfterDiscount * (taxP / 100);
          lineTotal = itemTotalAfterDiscount + lineTaxAmount;
          currentSubtotal += itemTotalBeforeDiscount;
          currentTotalDiscount += lineDiscountAmount;
          currentTotalTax += lineTaxAmount;
        }
        const displayLineTotal = isNaN(lineTotal) ? 0 : lineTotal;
        const currentFormLineTotal = getValues(`lineItems.${index}.total`);
        if (String(displayLineTotal.toFixed(2)) !== currentFormLineTotal) {
          setValue(`lineItems.${index}.total`, displayLineTotal.toFixed(2));
        }
      });
    }
    setSubtotal(currentSubtotal);
    setTotalDiscountAmount(currentTotalDiscount);
    setTotalTaxAmount(currentTotalTax);
    const currentGrandTotal = currentSubtotal - currentTotalDiscount + currentTotalTax;
    setGrandTotal(currentGrandTotal);
  }, [watchedLineItems, watchedTaxType, setValue, getValues]);

  const handleItemSelect = (itemId: string, index: number) => {
    const selectedItem = itemOptions.find(opt => opt.value === itemId);
    if (selectedItem) {
      let autoDescription = selectedItem.label;
      if (selectedItem.description) autoDescription = selectedItem.description;
      setValue(`lineItems.${index}.itemCode`, selectedItem.itemCode || '', { shouldValidate: true });
      setValue(`lineItems.${index}.description`, autoDescription, { shouldValidate: true });
      setValue(`lineItems.${index}.unitPrice`, selectedItem.salesPrice !== undefined ? selectedItem.salesPrice.toString() : '0', { shouldValidate: true });
      setValue(`lineItems.${index}.itemId`, selectedItem.value, { shouldValidate: true });
    } else {
      setValue(`lineItems.${index}.itemCode`, '', { shouldValidate: true });
      setValue(`lineItems.${index}.description`, '', { shouldValidate: true });
      setValue(`lineItems.${index}.unitPrice`, '0', { shouldValidate: true });
      setValue(`lineItems.${index}.itemId`, '', { shouldValidate: true });
    }
  };

  const saveInvoiceLogic = async (data: InvoiceFormValues): Promise<string | null> => {
    setIsSubmitting(true);
    const selectedCustomer = customerOptions.find(opt => opt.value === data.customerId);
    const currentYear = new Date().getFullYear();
    const counterRef = doc(firestore, "counters", "invoiceNumberGenerator");
    try {
      const newInvoiceId = await runTransaction(firestore, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let currentCount = 0;
        if (counterDoc.exists()) {
          const counterData = counterDoc.data();
          currentCount = counterData?.yearlyCounts?.[currentYear] || 0;
        }
        const newCount = currentCount + 1;
        const formattedInvoiceId = `INV${currentYear}-${String(newCount).padStart(3, '0')}`;
        const processedLineItems = data.lineItems.map(item => {
          const qty = parseFloat(String(item.qty || '0'));
          const unitPrice = parseFloat(String(item.unitPrice || '0'));
          const discountPercentage = parseFloat(String(item.discountPercentage || '0'));
          const taxPercentage = parseFloat(String(item.taxPercentage || '0'));
          const itemTotalBeforeDiscount = qty * unitPrice;
          const discountAmount = itemTotalBeforeDiscount * (discountPercentage / 100);
          const totalAfterDiscount = itemTotalBeforeDiscount - discountAmount;
          const taxAmount = totalAfterDiscount * (taxPercentage / 100);
          const total = totalAfterDiscount + taxAmount;
          const itemDetails = itemOptions.find(opt => opt.value === item.itemId);
          return {
            itemId: item.itemId, itemName: itemDetails?.label.split(' (')[0] || 'N/A', itemCode: itemDetails?.itemCode,
            description: item.description || '', qty, unitPrice, discountPercentage, taxPercentage, total,
          };
        });
        const finalSubtotal = processedLineItems.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
        const finalTotalDiscount = processedLineItems.reduce((sum, item) => sum + (item.qty * item.unitPrice * (item.discountPercentage/100)), 0);
        const finalTotalTax = processedLineItems.reduce((sum, item) => sum + ((item.qty * item.unitPrice * (1 - (item.discountPercentage/100))) * (item.taxPercentage/100)), 0);
        const finalGrandTotal = finalSubtotal - finalTotalDiscount + finalTotalTax;
        const invoiceDataToSave: Omit<InvoiceDocument, 'id'> & { createdAt: any, updatedAt: any } = {
          customerId: data.customerId, customerName: selectedCustomer?.label || 'N/A',
          billingAddress: data.billingAddress, shippingAddress: data.shippingAddress,
          invoiceDate: format(data.invoiceDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          dueDate: data.dueDate ? format(data.dueDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
          paymentTerms: data.paymentTerms || undefined, salesperson: data.salesperson,
          lineItems: processedLineItems, taxType: data.taxType,
          comments: data.comments || undefined, privateComments: data.privateComments || undefined,
          subtotal: finalSubtotal, totalDiscountAmount: finalTotalDiscount, totalTaxAmount: finalTotalTax,
          totalAmount: finalGrandTotal, status: data.status || "Draft", amountPaid: 0,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        };
        const cleanedData = Object.fromEntries(Object.entries(invoiceDataToSave).filter(([,v]) => v !== undefined)) as typeof invoiceDataToSave;
        const newInvoiceRef = doc(firestore, "invoices", formattedInvoiceId);
        transaction.set(newInvoiceRef, cleanedData);
        transaction.set(counterRef, { yearlyCounts: { ...(counterDoc.exists() ? counterDoc.data().yearlyCounts : {}), [currentYear]: newCount } }, { merge: true });
        return formattedInvoiceId;
      });
      return newInvoiceId;
    } catch (error: any) {
      Swal.fire("Save Failed", `Failed to save invoice: ${error.message}`, "error");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegularSave = async (data: InvoiceFormValues) => {
    const newId = await saveInvoiceLogic(data);
    if (newId) {
      setGeneratedInvoiceId(newId);
      Swal.fire("Invoice Saved!", `Invoice successfully saved with ID: ${newId}.`, "success");
    }
  };

  const handleSaveAndPreview = async (data: InvoiceFormValues) => {
    const newId = await saveInvoiceLogic(data);
    if (newId) {
      setGeneratedInvoiceId(newId);
      Swal.fire({
        title: "Invoice Saved!", text: `Invoice successfully saved with ID: ${newId}. Navigating to preview...`,
        icon: "success", timer: 1500, showConfirmButton: false,
      }).then(() => router.push(`/dashboard/invoices/preview/${newId}`));
    }
  };

  const handlePreviewLastSaved = () => {
    if (generatedInvoiceId) {
      router.push(`/dashboard/invoices/preview/${generatedInvoiceId}`);
    } else {
      Swal.fire("No Invoice Saved", "Please save an invoice first to preview it.", "info");
    }
  };

  if (isLoadingDropdowns) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading form options...</p>
      </div>
    );
  }

  const saveButtonsDisabled = isSubmitting || isLoadingDropdowns;
  const actionButtonsDisabled = !generatedInvoiceId || isSubmitting;

  return (
    <Form {...form}>
      <form className="space-y-8">
        <h3 className={cn(sectionHeadingClass)}><Users className="mr-2 h-5 w-5 text-primary" />Customer & Delivery Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><FormField control={control} name="customerId" render={({ field }) => (<FormItem><FormLabel>Customer*</FormLabel><Combobox options={customerOptions} value={field.value || PLACEHOLDER_CUSTOMER_VALUE} onValueChange={(value) => field.onChange(value === PLACEHOLDER_CUSTOMER_VALUE ? '' : value)} placeholder="Search Customer..." selectPlaceholder="Select Customer" emptyStateMessage="No customer found." disabled={isLoadingDropdowns}/><FormMessage /></FormItem>)}/></div>
          <div><FormField control={control} name="shippingAddress" render={({ field }) => (<FormItem><div className="flex justify-between items-center mb-1.5"><FormLabel>Delivery Address*</FormLabel><FormField control={control} name="sameAsBilling" render={({ field: checkboxField }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={checkboxField.value} onCheckedChange={checkboxField.onChange} id="sameAsBillingCheckbox" /></FormControl><Label htmlFor="sameAsBillingCheckbox" className="text-xs font-normal cursor-pointer">Same as billing</Label></FormItem>)}/></div><FormControl><Textarea placeholder="Delivery address" {...field} rows={3} disabled={watch("sameAsBilling")} /></FormControl><FormMessage /></FormItem>)}/></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><FormField control={control} name="salesperson" render={({ field }) => (<FormItem><FormLabel>Salesperson*</FormLabel><FormControl><Input placeholder="Enter salesperson name" {...field} /></FormControl><FormMessage /></FormItem>)}/></div>
          <div><FormField control={control} name="billingAddress" render={({ field }) => (<FormItem><FormLabel>Bill To*</FormLabel><FormControl><Textarea placeholder="Billing address" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)}/></div>
        </div>
        <h3 className={cn(sectionHeadingClass)}><CalendarDays className="mr-2 h-5 w-5 text-primary" />Invoice Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <FormItem><FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Invoice Number</FormLabel><Input value={generatedInvoiceId || "(Auto-generated on save)"} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" /></FormItem>
            <FormField control={control} name="invoiceDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Invoice Date*</FormLabel><DatePickerField field={field} placeholder="Select invoice date" /><FormMessage /></FormItem>)}/>
            <FormField control={control} name="dueDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Due Date</FormLabel><DatePickerField field={field} placeholder="Select due date" /><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="taxType" render={({ field }) => (<FormItem><FormLabel>Tax</FormLabel><Select onValueChange={field.onChange} value={field.value ?? 'Default'}><FormControl><SelectTrigger><SelectValue placeholder="Select tax type" /></SelectTrigger></FormControl><SelectContent>{quoteTaxTypes.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="paymentTerms" render={({ field }) => (<FormItem><FormLabel>Payment Terms</FormLabel><FormControl><Input placeholder="e.g., Net 30, Due on receipt" {...field} /></FormControl><FormMessage /></FormItem>)}/>
             <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? 'Draft'}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {invoiceStatusOptions.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <Separator />
        <div className="flex justify-between items-center">
            <h3 className={cn(sectionHeadingClass, "mb-0 border-b-0")}><ShoppingBag className="mr-2 h-5 w-5 text-primary" /> Line Items</h3>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Columns className="mr-2 h-4 w-4" />Columns</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuLabel>Toggle Columns</DropdownMenuLabel><DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={showItemCodeColumn} onCheckedChange={setShowItemCodeColumn}>Item Code</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showDiscountColumn} onCheckedChange={setShowDiscountColumn}>Discount %</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showTaxColumn} onCheckedChange={setShowTaxColumn}>Tax %</DropdownMenuCheckboxItem>
            </DropdownMenuContent></DropdownMenu>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead className="w-[120px]">Qty*</TableHead><TableHead className="min-w-[200px]">Item*</TableHead>{showItemCodeColumn && <TableHead className="min-w-[150px]">Item Code</TableHead>}<TableHead className="min-w-[250px]">Description</TableHead><TableHead className="w-[120px]">Unit Price*</TableHead>
          {showDiscountColumn && <TableHead className="w-[100px]">Discount %</TableHead>}
          {showTaxColumn && <TableHead className="w-[100px]">Tax %</TableHead>}
          <TableHead className="w-[130px] text-right">Line Total</TableHead><TableHead className="w-[50px] text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell><FormField control={control} name={`lineItems.${index}.qty`} render={({ field: itemField }) => (<Input type="text" placeholder="1" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.qty?.message}</FormMessage></TableCell>
                  <TableCell><FormField control={control} name={`lineItems.${index}.itemId`} render={({ field: itemField }) => (<Combobox options={itemOptions} value={itemField.value || PLACEHOLDER_ITEM_VALUE} onValueChange={(itemId) => { itemField.onChange(itemId === PLACEHOLDER_ITEM_VALUE ? '' : itemId); handleItemSelect(itemId, index);}} placeholder="Search Item..." selectPlaceholder="Select Item" emptyStateMessage="No item found." className="h-9"/>)}/><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.itemId?.message}</FormMessage></TableCell>
                  {showItemCodeColumn && (<TableCell><FormField control={control} name={`lineItems.${index}.itemCode`} render={({ field: itemField }) => (<Input placeholder="Code" {...itemField} value={itemField.value ?? ''} className="h-9 bg-muted/50" readOnly disabled />)}/></TableCell>)}
                  <TableCell><FormField control={control} name={`lineItems.${index}.description`} render={({ field: itemField }) => (<Textarea placeholder="Item description" {...itemField} rows={1} className="h-9 min-h-[2.25rem] resize-y"/>)} /></TableCell>
                  <TableCell><FormField control={control} name={`lineItems.${index}.unitPrice`} render={({ field: itemField }) => (<Input type="text" placeholder="0.00" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.unitPrice?.message}</FormMessage></TableCell>
                  {showDiscountColumn && <TableCell><FormField control={control} name={`lineItems.${index}.discountPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.discountPercentage?.message}</FormMessage></TableCell>}
                  {showTaxColumn && <TableCell><FormField control={control} name={`lineItems.${index}.taxPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.taxPercentage?.message}</FormMessage></TableCell>}
                  <TableCell className="text-right"><FormField control={control} name={`lineItems.${index}.total`} render={({ field: itemField }) => (<Input type="text" {...itemField} readOnly disabled className="h-9 bg-muted/50 text-right font-medium"/>)} /></TableCell>
                  <TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} title="Remove line item"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>))}
            </TableBody>
          </Table>
        </div>
        {form.formState.errors.lineItems && !form.formState.errors.lineItems.message && typeof form.formState.errors.lineItems === 'object' && form.formState.errors.lineItems.root && (<p className="text-sm font-medium text-destructive">{form.formState.errors.lineItems.root?.message || "Please ensure all line items are valid."}</p>)}
        <Button type="button" variant="outline" onClick={() => append({ itemId: '', itemCode: '', description: '', qty: '1', unitPrice: '0', discountPercentage: '0', taxPercentage: '0', total: '0.00' })} className="mt-2"><PlusCircle className="mr-2 h-4 w-4" /> Add Item</Button>

        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={control} name="comments" render={({ field }) => (<FormItem><FormLabel>Terms and Conditions:</FormLabel><FormControl><Textarea placeholder="Enter terms and conditions visible to the customer" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="privateComments" render={({ field }) => (<FormItem><FormLabel>Private Comments (Internal)</FormLabel><FormControl><Textarea placeholder="Enter internal notes, not visible to customer" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)}/>
        </div>
        <div className="flex justify-end space-y-2 mt-6">
            <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium text-foreground">{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Discount:</span><span className="font-medium text-foreground">(-) {totalDiscountAmount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Tax:</span><span className="font-medium text-foreground">(+) {totalTaxAmount.toFixed(2)}</span></div>
                <Separator />
                <div className="flex justify-between text-lg font-bold"><span className="text-primary">Grand Total:</span><span className="text-primary">{grandTotal.toFixed(2)}</span></div>
            </div>
        </div>
        <Separator />
        <div className="flex flex-wrap gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => { form.reset(); setSubtotal(0); setTotalTaxAmount(0); setTotalDiscountAmount(0); setGrandTotal(0); setGeneratedInvoiceId(null);}}><X className="mr-2 h-4 w-4" />Cancel</Button>
            <Button type="button" onClick={handleSubmit(handleRegularSave)} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={saveButtonsDisabled}>
              {isSubmitting ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Invoice...</> ) : ( <><Save className="mr-2 h-4 w-4" />Save Invoice</> )}
            </Button>
            <Button type="button" variant="outline" onClick={handleSubmit(handleSaveAndPreview)} disabled={saveButtonsDisabled}><Printer className="mr-2 h-4 w-4" />Save and Preview</Button>
            <Button type="button" variant="outline" onClick={handlePreviewLastSaved} disabled={actionButtonsDisabled}><Printer className="mr-2 h-4 w-4" />Preview Last Saved</Button>
        </div>
      </form>
    </Form>
  );
}
