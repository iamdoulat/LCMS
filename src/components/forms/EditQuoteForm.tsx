

"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import type { QuoteDocument, QuoteFormValues, CustomerDocument, ItemDocument as ItemDoc, QuoteTaxType, QuoteLineItemFormValues } from '@/types';
import { QuoteSchema, quoteTaxTypes } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, PlusCircle, Trash2, Users, Building, FileText, CalendarDays, DollarSign, Percent, Info, Save, Printer, Mail, X, Edit, Tag, ShoppingBag, Hash } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_CUSTOMER_VALUE = "__QUOTE_EDIT_CUSTOMER_PLACEHOLDER__";
const PLACEHOLDER_ITEM_VALUE_PREFIX = "__QUOTE_EDIT_ITEM_PLACEHOLDER__";

interface ItemOption extends ComboboxOption {
  description?: string;
  salesPrice?: number;
  itemCode?: string;
}

interface EditQuoteFormProps {
  initialData: QuoteDocument;
  quoteId: string;
}

export function EditQuoteForm({ initialData, quoteId }: EditQuoteFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customerOptions, setCustomerOptions] = React.useState<ComboboxOption[]>([]);
  const [itemOptions, setItemOptions] = React.useState<ItemOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  const [subtotal, setSubtotal] = React.useState(0);
  const [totalTaxAmount, setTotalTaxAmount] = React.useState(0);
  const [totalDiscountAmount, setTotalDiscountAmount] = React.useState(0);
  const [grandTotal, setGrandTotal] = React.useState(0);

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(QuoteSchema),
    // Default values will be set by useEffect based on initialData
  });

  const { control, setValue, watch, getValues, reset } = form;

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
    const fetchOptionsAndSetData = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [customersSnap, itemsSnap] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(collection(firestore, "items"))
        ]);

        const fetchedCustomers = customersSnap.docs.map(docSnap => {
          const data = docSnap.data() as CustomerDocument;
          return { value: docSnap.id, label: data.applicantName || 'Unnamed Customer', address: data.address };
        });
        setCustomerOptions(fetchedCustomers);

        const fetchedItems = itemsSnap.docs.map(docSnap => {
          const data = docSnap.data() as ItemDoc;
          return {
            value: docSnap.id,
            label: `${data.itemName}${data.itemCode ? ` (${data.itemCode})` : ''}`,
            description: data.description,
            salesPrice: data.salesPrice,
            itemCode: data.itemCode,
          };
        });
        setItemOptions(fetchedItems);

        // Set form values from initialData after dropdowns are loaded
        if (initialData) {
          reset({
            customerId: initialData.customerId || '',
            billingAddress: initialData.billingAddress || '',
            shippingAddress: initialData.shippingAddress || '',
            sameAsBilling: initialData.billingAddress === initialData.shippingAddress, // Infer if not explicitly stored
            quoteDate: initialData.quoteDate && isValid(parseISO(initialData.quoteDate)) ? parseISO(initialData.quoteDate) : new Date(),
            salesperson: initialData.salesperson || '',
            lineItems: initialData.lineItems.map(item => ({
              itemId: item.itemId || '',
              description: item.description || '',
              qty: item.qty?.toString() || '1',
              unitPrice: item.unitPrice?.toString() || '0',
              discountPercentage: item.discountPercentage?.toString() || '0',
              taxPercentage: item.taxPercentage?.toString() || '0',
              total: item.total?.toFixed(2) || '0.00', // Ensure total is a string
            })),
            taxType: initialData.taxType || 'Default',
            comments: initialData.comments || '',
            privateComments: initialData.privateComments || '',
          });
        }

      } catch (error) {
        console.error("Error fetching dropdown options for Edit Quote form: ", error);
        Swal.fire("Error", "Could not load customer or item data. Please try again.", "error");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchOptionsAndSetData();
  }, [initialData, reset]);


  React.useEffect(() => {
    if (watchedCustomerId && customerOptions.length > 0) {
      const selectedCustomer = customerOptions.find(opt => opt.value === watchedCustomerId);
      if (selectedCustomer) {
        const billingAddr = (selectedCustomer as any).address || '';
        setValue("billingAddress", billingAddr);
        if (getValues("sameAsBilling")) {
          setValue("shippingAddress", billingAddr);
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

  }, [watchedLineItems, setValue, getValues]);


  const handleItemSelect = (itemId: string, index: number) => {
    const selectedItem = itemOptions.find(opt => opt.value === itemId);
    if (selectedItem) {
      let autoDescription = selectedItem.label;
      if (selectedItem.description) autoDescription = selectedItem.description;
      setValue(`lineItems.${index}.description`, autoDescription, { shouldValidate: true });
      setValue(`lineItems.${index}.unitPrice`, selectedItem.salesPrice !== undefined ? selectedItem.salesPrice.toString() : '0', { shouldValidate: true });
      setValue(`lineItems.${index}.itemId`, selectedItem.value, { shouldValidate: true });
    } else {
      setValue(`lineItems.${index}.description`, '', { shouldValidate: true });
      setValue(`lineItems.${index}.unitPrice`, '0', { shouldValidate: true });
      setValue(`lineItems.${index}.itemId`, '', { shouldValidate: true });
    }
  };

  async function onSubmit(data: QuoteFormValues) {
    if (!quoteId) {
      Swal.fire("Error", "Quote Number is missing. Cannot update.", "error");
      return;
    }
    setIsSubmitting(true);
    const selectedCustomer = customerOptions.find(opt => opt.value === data.customerId);

    const processedLineItems = data.lineItems.map(item => {
      const qty = parseFloat(String(item.qty || '0'));
      const unitPriceStr = String(item.unitPrice || '0');
      const finalUnitPrice = parseFloat(unitPriceStr);
      const discountPercentageStr = String(item.discountPercentage || '0');
      const finalDiscountPercentage = parseFloat(discountPercentageStr);
      const taxPercentageStr = String(item.taxPercentage || '0');
      const finalTaxPercentage = parseFloat(taxPercentageStr);

      const itemTotalBeforeDiscount = qty * finalUnitPrice;
      const discountAmountVal = itemTotalBeforeDiscount * (finalDiscountPercentage / 100);
      const itemTotalAfterDiscount = itemTotalBeforeDiscount - discountAmountVal;
      const taxAmountVal = itemTotalAfterDiscount * (finalTaxPercentage / 100);
      const calculatedLineTotal = itemTotalAfterDiscount + taxAmountVal;
      
      const itemDetailsFromOptions = itemOptions.find(opt => opt.value === item.itemId);
      return {
        itemId: item.itemId,
        itemName: itemDetailsFromOptions?.label.split(' (')[0] || 'N/A',
        itemCode: itemDetailsFromOptions?.itemCode || undefined,
        description: item.description || '',
        qty,
        unitPrice: finalUnitPrice,
        discountPercentage: finalDiscountPercentage,
        taxPercentage: finalTaxPercentage,
        total: calculatedLineTotal,
      };
    });
    
    const finalSubtotal = processedLineItems.reduce((sum, item) => sum + (item.qty * (item.unitPrice ?? 0)), 0);
    const finalTotalDiscount = processedLineItems.reduce((sum, item) => sum + (item.qty * (item.unitPrice ?? 0) * ((item.discountPercentage ?? 0) / 100)), 0);
    const finalTotalTax = processedLineItems.reduce((sum, item) => sum + ((item.qty * (item.unitPrice ?? 0) * (1 - ((item.discountPercentage ?? 0)/100))) * ((item.taxPercentage ?? 0) / 100)), 0);
    const finalGrandTotal = finalSubtotal - finalTotalDiscount + finalTotalTax;

    const dataToUpdate: Partial<Omit<QuoteDocument, 'id' | 'createdAt'>> & { updatedAt: any } = {
      customerId: data.customerId,
      customerName: selectedCustomer?.label || initialData.customerName,
      billingAddress: data.billingAddress,
      shippingAddress: data.shippingAddress,
      quoteDate: format(data.quoteDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      salesperson: data.salesperson,
      lineItems: processedLineItems,
      taxType: data.taxType,
      comments: data.comments || undefined,
      privateComments: data.privateComments || undefined,
      subtotal: finalSubtotal,
      totalDiscountAmount: finalTotalDiscount,
      totalTaxAmount: finalTotalTax,
      totalAmount: finalGrandTotal,
      status: initialData.status, // Retain current status unless explicitly changed
      updatedAt: serverTimestamp(),
    };

    const cleanedDataToUpdate = Object.fromEntries(
      Object.entries(dataToUpdate).filter(([, value]) => value !== undefined)
    ) as typeof dataToUpdate;

    try {
      const quoteDocRef = doc(firestore, "quotes", quoteId);
      await updateDoc(quoteDocRef, cleanedDataToUpdate);
      Swal.fire({
        title: "Quote Updated!",
        text: `Quote Number: ${quoteId} successfully updated.`,
        icon: "success",
      });
    } catch (error: any) {
      console.error("Error updating quote: ", error);
      Swal.fire({
        title: "Update Failed",
        text: `Failed to update quote: ${error.message}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

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
        
        <h3 className={cn(sectionHeadingClass)}>
          <Users className="mr-2 h-5 w-5 text-primary" />
          Customer & Delivery Information
        </h3>
        {/* Row 1: Customer & Delivery Address */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div> {/* Column 1 for Customer */}
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
                    emptyStateMessage="No customer found."
                    disabled={isLoadingDropdowns}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div> {/* Column 2 for Delivery Address */}
            <FormField
              control={control}
              name="shippingAddress"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center mb-1.5">
                      <FormLabel>Delivery Address*</FormLabel>
                      <FormField
                          control={control}
                          name="sameAsBilling"
                          render={({ field: checkboxField }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                              <Checkbox checked={checkboxField.value} onCheckedChange={checkboxField.onChange} id="sameAsBillingCheckboxQuoteEdit" />
                              </FormControl>
                              <Label htmlFor="sameAsBillingCheckboxQuoteEdit" className="text-xs font-normal cursor-pointer">Same as billing</Label>
                          </FormItem>
                          )}
                      />
                  </div>
                  <FormControl>
                    <Textarea placeholder="Delivery address" {...field} rows={3} disabled={watchedSameAsBilling} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Row 2: Salesperson & Billing Address */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div> {/* Column 1 for Salesperson */}
            <FormField
              control={control}
              name="salesperson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Salesperson*</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter salesperson name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div> {/* Column 2 for Billing Address */}
            <FormField
              control={control}
              name="billingAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bill To*</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Billing address" {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <h3 className={cn(sectionHeadingClass)}>
          <CalendarDays className="mr-2 h-5 w-5 text-primary" />
          Quote Details
        </h3>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <FormItem>
              <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Quote Number</FormLabel>
              <Input value={quoteId} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" />
            </FormItem>
            <FormField
                control={control}
                name="quoteDate"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Quote Date*</FormLabel>
                    <DatePickerField field={field} placeholder="Select quote date" />
                    <FormMessage />
                </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="taxType"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Tax</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? 'Default'}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select tax type" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {quoteTaxTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
             />
        </div>

        <Separator />
        <h3 className={cn(sectionHeadingClass)}>
          <ShoppingBag className="mr-2 h-5 w-5 text-primary" /> Line Items
        </h3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Qty*</TableHead>
                <TableHead className="min-w-[200px]">Item*</TableHead>
                <TableHead className="min-w-[250px]">Description</TableHead>
                <TableHead className="w-[120px]">Unit Price*</TableHead>
                <TableHead className="w-[100px]">Discount %</TableHead>
                <TableHead className="w-[100px]">Tax %</TableHead>
                <TableHead className="w-[130px] text-right">Line Total</TableHead>
                <TableHead className="w-[50px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <FormField control={control} name={`lineItems.${index}.qty`} render={({ field: itemField }) => (<Input type="text" placeholder="1" {...itemField} className="h-9"/>)} />
                    <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.qty?.message}</FormMessage>
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={control}
                      name={`lineItems.${index}.itemId`}
                      render={({ field: itemField }) => (
                        <Combobox
                          options={itemOptions}
                          value={itemField.value || PLACEHOLDER_ITEM_VALUE_PREFIX + index}
                          onValueChange={(itemId) => {
                            itemField.onChange(itemId === (PLACEHOLDER_ITEM_VALUE_PREFIX + index) ? '' : itemId);
                            handleItemSelect(itemId, index);
                          }}
                          placeholder="Search Item..."
                          selectPlaceholder="Select Item"
                          emptyStateMessage="No item found."
                          className="h-9"
                        />
                      )}
                    />
                    <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.itemId?.message}</FormMessage>
                  </TableCell>
                  <TableCell>
                    <FormField control={control} name={`lineItems.${index}.description`} render={({ field: itemField }) => (<Textarea placeholder="Item description" {...itemField} rows={1} className="h-9 min-h-[2.25rem] resize-y"/>)} />
                  </TableCell>
                  <TableCell>
                    <FormField control={control} name={`lineItems.${index}.unitPrice`} render={({ field: itemField }) => (<Input type="text" placeholder="0.00" {...itemField} className="h-9"/>)} />
                     <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.unitPrice?.message}</FormMessage>
                  </TableCell>
                  <TableCell>
                    <FormField control={control} name={`lineItems.${index}.discountPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9"/>)} />
                     <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.discountPercentage?.message}</FormMessage>
                  </TableCell>
                  <TableCell>
                    <FormField control={control} name={`lineItems.${index}.taxPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9"/>)} />
                    <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.taxPercentage?.message}</FormMessage>
                  </TableCell>
                  <TableCell className="text-right">
                     <FormField control={control} name={`lineItems.${index}.total`} render={({ field: itemField }) => (<Input type="text" {...itemField} readOnly disabled className="h-9 bg-muted/50 text-right font-medium"/>)} />
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
         {form.formState.errors.lineItems && !form.formState.errors.lineItems.message && typeof form.formState.errors.lineItems === 'object' && form.formState.errors.lineItems.root && (
            <p className="text-sm font-medium text-destructive">{form.formState.errors.lineItems.root?.message || "Please ensure all line items are valid."}</p>
        )}
        <Button type="button" variant="outline" onClick={() => append({ itemId: '', description: '', qty: '1', unitPrice: '0', discountPercentage: '0', taxPercentage: '0', total: '0.00' })} className="mt-2">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Item
        </Button>

        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
                control={control}
                name="comments"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Comments (Public)</FormLabel>
                    <FormControl>
                    <Textarea placeholder="Enter comments visible to the customer" {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={control}
                name="privateComments"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Private Comments (Internal)</FormLabel>
                    <FormControl>
                    <Textarea placeholder="Enter internal notes, not visible to customer" {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <div className="flex justify-end space-y-2 mt-6">
            <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium text-foreground">{subtotal.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Discount:</span>
                    <span className="font-medium text-foreground">(-) {totalDiscountAmount.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Tax:</span>
                    <span className="font-medium text-foreground">(+) {totalTaxAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                    <span className="text-primary">Grand Total:</span>
                    <span className="text-primary">{grandTotal.toFixed(2)}</span>
                </div>
            </div>
        </div>
        <Separator />
        
        <div className="flex flex-wrap gap-2 justify-end">
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || isLoadingDropdowns}>
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Changes...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" />Save Changes</>
              )}
            </Button>
             <Button type="button" variant="outline" disabled>
                <Printer className="mr-2 h-4 w-4" />Preview
            </Button>
        </div>
      </form>
    </Form>
  );
}
