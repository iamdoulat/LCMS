
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, updateDoc } from 'firebase/firestore';
import type { DeliveryChallanFormValues, CustomerDocument, SaleDocument as InvoiceDocument, DeliveryChallanDocument } from '@/types';
import { DeliveryChallanSchema } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from '@/components/forms/common';
import { Loader2, PlusCircle, Trash2, Users, FileText, CalendarDays, Save, X, ShoppingBag, Hash, Columns, Printer, Truck, User } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';

const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_CUSTOMER_VALUE = "__CHALLAN_EDIT_CUSTOMER_PLACEHOLDER__";
const PLACEHOLDER_INVOICE_VALUE = "__CHALLAN_EDIT_INVOICE_PLACEHOLDER__";

interface CustomerOption extends ComboboxOption {
  address?: string;
}
interface InvoiceOption extends ComboboxOption {
  invoiceData?: InvoiceDocument;
}

interface EditDeliveryChallanFormProps {
    initialData: DeliveryChallanDocument;
    challanId: string;
}

export function EditDeliveryChallanForm({ initialData, challanId }: EditDeliveryChallanFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customerOptions, setCustomerOptions] = React.useState<CustomerOption[]>([]);
  const [invoiceOptions, setInvoiceOptions] = React.useState<InvoiceOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  const form = useForm<DeliveryChallanFormValues>({
    resolver: zodResolver(DeliveryChallanSchema),
    defaultValues: {
      customerId: initialData.customerId,
      billingAddress: initialData.billingAddress,
      shippingAddress: initialData.shippingAddress,
      challanDate: parseISO(initialData.challanDate),
      linkedInvoiceId: initialData.linkedInvoiceId,
      deliveryPerson: initialData.deliveryPerson,
      vehicleNo: initialData.vehicleNo,
      lineItems: initialData.lineItems.map(item => ({...item, qty: item.qty.toString()})),
    },
  });

  const { control, setValue, watch, getValues, reset, handleSubmit } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const watchedCustomerId = watch("customerId");
  const watchedInvoiceId = watch("linkedInvoiceId");

  React.useEffect(() => {
    const fetchOptions = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [customersSnap, invoicesSnap] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(collection(firestore, "sales_invoice"))
        ]);
        setCustomerOptions(
          customersSnap.docs.map(doc => {
            const data = doc.data() as CustomerDocument;
            return { value: doc.id, label: data.applicantName || 'Unnamed Customer', address: data.address };
          })
        );
        setInvoiceOptions(
          invoicesSnap.docs.map(doc => {
            const data = doc.data() as InvoiceDocument;
            return {
              value: doc.id,
              label: `${doc.id} - ${data.customerName}`,
              invoiceData: { ...data, id: doc.id },
            };
          })
        );
      } catch (error) {
        Swal.fire("Error", "Could not load customer or invoice data. Please try again.", "error");
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
        setValue("shippingAddress", selectedCustomer.address || "");
      }
    }
  }, [watchedCustomerId, customerOptions, setValue]);
  
  React.useEffect(() => {
    if(watchedInvoiceId) {
        const selectedInvoice = invoiceOptions.find(opt => opt.value === watchedInvoiceId)?.invoiceData;
        if(selectedInvoice) {
            setValue("customerId", selectedInvoice.customerId, { shouldValidate: true });
            setValue("billingAddress", selectedInvoice.billingAddress || '', { shouldValidate: true });
            setValue("shippingAddress", selectedInvoice.shippingAddress || '', { shouldValidate: true });
            
            const newLineItems = selectedInvoice.lineItems.map(item => ({
                itemId: item.itemId,
                description: item.description || item.itemName,
                qty: item.qty.toString()
            }));
            
            form.setValue("lineItems", newLineItems);
        }
    }
  }, [watchedInvoiceId, invoiceOptions, setValue, form]);

  const handleSave = async (data: DeliveryChallanFormValues) => {
    setIsSubmitting(true);
    const selectedCustomer = customerOptions.find(opt => opt.value === data.customerId);

    const challanDataToUpdate: Partial<Omit<DeliveryChallanDocument, 'id' | 'createdAt'>> = {
        customerId: data.customerId,
        customerName: selectedCustomer?.label || 'N/A',
        billingAddress: data.billingAddress,
        shippingAddress: data.shippingAddress,
        challanDate: format(data.challanDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        linkedInvoiceId: data.linkedInvoiceId || undefined,
        deliveryPerson: data.deliveryPerson,
        vehicleNo: data.vehicleNo,
        lineItems: data.lineItems.map(item => ({...item, qty: parseFloat(item.qty)})),
        updatedAt: serverTimestamp(),
    };

    try {
        const docRef = doc(firestore, "delivery_challans", challanId);
        await updateDoc(docRef, challanDataToUpdate);
        Swal.fire("Challan Updated!", `Delivery Challan ${challanId} has been successfully updated.`, "success");
    } catch(error: any) {
        Swal.fire("Update Failed", `Failed to update challan: ${error.message}`, "error");
    } finally {
        setIsSubmitting(false);
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

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(handleSave)} className="space-y-8">
        <h3 className={cn(sectionHeadingClass)}><Users className="mr-2 h-5 w-5 text-primary" />Customer & Delivery Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
           <FormField
              control={control}
              name="linkedInvoiceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link to Sales Invoice (Optional)</FormLabel>
                  <Combobox
                    options={invoiceOptions}
                    value={field.value || PLACEHOLDER_INVOICE_VALUE}
                    onValueChange={(value) => field.onChange(value === PLACEHOLDER_INVOICE_VALUE ? '' : value)}
                    placeholder="Search Invoice ID..."
                    selectPlaceholder="Select Invoice"
                    emptyStateMessage="No invoice found."
                  />
                  <FormDescription>Select an invoice to auto-fill customer and item details.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          <FormField
              control={control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer*</FormLabel>
                  <Combobox
                    options={customerOptions}
                    value={field.value || PLACEHOLDER_CUSTOMER_VALUE}
                    onValueChange={(value) => field.onChange(value === PLACEHOLDER_CUSTOMER_VALUE ? '' : value)}
                    placeholder="Search Customer..."
                    selectPlaceholder="Select Customer"
                    disabled={isLoadingDropdowns || !!watchedInvoiceId}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
             <FormField
              control={control}
              name="shippingAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Address*</FormLabel>
                  <FormControl><Textarea placeholder="Delivery address" {...field} rows={3} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="billingAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing Address*</FormLabel>
                  <FormControl><Textarea placeholder="Billing address" {...field} rows={3} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        
        <h3 className={cn(sectionHeadingClass)}><Truck className="mr-2 h-5 w-5 text-primary" />Challan Details</h3>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
             <FormItem><FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Challan Number</FormLabel><Input value={challanId} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" /></FormItem>
            <FormField control={control} name="challanDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Challan Date*</FormLabel><DatePickerField field={field} placeholder="Select date" /><FormMessage /></FormItem>)}/>
            <FormField control={control} name="deliveryPerson" render={({ field }) => (<FormItem><FormLabel>Delivery Person*</FormLabel><FormControl><Input placeholder="Name of delivery person" {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="vehicleNo" render={({ field }) => (<FormItem><FormLabel>Vehicle No.</FormLabel><FormControl><Input placeholder="Vehicle number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
        </div>
        
        <Separator className="my-6" />
        <h3 className={cn(sectionHeadingClass, "mb-0 border-b-0")}><ShoppingBag className="mr-2 h-5 w-5 text-primary" /> Line Items</h3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead className="w-[80px]">SL No.</TableHead><TableHead className="min-w-[250px]">Description of Goods*</TableHead><TableHead className="w-[120px]">Quantity*</TableHead><TableHead className="w-[50px] text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell><Input value={index + 1} readOnly disabled className="h-9 bg-muted/50" /></TableCell>
                  <TableCell><FormField control={control} name={`lineItems.${index}.description`} render={({ field: itemField }) => (<Textarea placeholder="Item description" {...itemField} rows={1} className="h-9 min-h-[2.25rem] resize-y"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.description?.message}</FormMessage></TableCell>
                  <TableCell><FormField control={control} name={`lineItems.${index}.qty`} render={({ field: itemField }) => (<Input type="text" placeholder="1" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.qty?.message}</FormMessage></TableCell>
                  <TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} title="Remove line item"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>))}
            </TableBody>
          </Table>
        </div>
        {form.formState.errors.lineItems && !form.formState.errors.lineItems.message && typeof form.formState.errors.lineItems === 'object' && form.formState.errors.lineItems.root && (<p className="text-sm font-medium text-destructive">{form.formState.errors.lineItems.root?.message || "Please ensure all line items are valid."}</p>)}
        <Button type="button" variant="outline" onClick={() => append({ itemId: '', description: '', qty: '1'})} className="mt-2"><PlusCircle className="mr-2 h-4 w-4" /> Add Item</Button>
        <Separator />
        
        <div className="flex flex-wrap gap-2 justify-end">
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || isLoadingDropdowns}>
              {isSubmitting ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Changes...</> ) : ( <><Save className="mr-2 h-4 w-4" />Save Changes</> )}
            </Button>
        </div>
      </form>
    </Form>
  );
}
