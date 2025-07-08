

"use client";

import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid, addDays, differenceInDays, parse as parseDateFns } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, runTransaction, setDoc } from 'firebase/firestore';
import type { QuoteDocument, QuoteFormValues as PageQuoteFormValues, CustomerDocument, ItemDocument as ItemDoc, QuoteTaxType, QuoteLineItemFormValues as PageQuoteLineItemFormValues } from '@/types';
import { QuoteLineItemSchema, QuoteSchema, quoteTaxTypes } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { Loader2, PlusCircle, Trash2, Users, FileText, CalendarDays, DollarSign, Save, X, ShoppingBag, Hash, Columns, Printer, Edit, Mail } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation'; // Added for navigation
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_CUSTOMER_VALUE = "__QUOTE_CUSTOMER_PLACEHOLDER__";
const PLACEHOLDER_ITEM_VALUE = "__QUOTE_ITEM_PLACEHOLDER__";

interface ItemOption extends ComboboxOption {
  description?: string;
  salesPrice?: number;
  itemCode?: string;
}

interface CustomerOption extends ComboboxOption {
  address?: string;
}

export function CreateQuoteForm() {
  const router = useRouter(); // Added for navigation
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customerOptions, setCustomerOptions] = React.useState<CustomerOption[]>([]);
  const [itemOptions, setItemOptions] = React.useState<ItemOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const [generatedQuoteId, setGeneratedQuoteId] = React.useState<string | null>(null);

  const [subtotal, setSubtotal] = React.useState(0);
  const [totalTaxAmount, setTotalTaxAmount] = React.useState(0);
  const [totalDiscountAmount, setTotalDiscountAmount] = React.useState(0);
  const [grandTotal, setGrandTotal] = React.useState(0);

  const form = useForm<PageQuoteFormValues>({
    resolver: zodResolver(QuoteSchema),
    defaultValues: {
      customerId: '',
      billingAddress: '',
      shippingAddress: '',
      quoteDate: new Date(),
      salesperson: '',
      subject: 'BRAND NEW CAPITAL MACHINERY WITH STANDARD ACCESSORIES FOR 100% EXPORT ORIENTED READYMADE GARMENTS INDUSTRY.',
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
      comments: "By Irrevocable LC at 120 days deferred from the date of B/L\nSmart Solution PTE. Ltd.\nA/C No.: 010-905029-9\nDBS Bank Ltd.\nSouth Bridge Branch, Blk 531, Upper Cross Street,\n#01-51 Hong Lim Complex, Singapore 050531\nSwift code : DBSSSGSG\n\nDelivery : Subject to your final order confirmation\nGross Weight : To be advise after sales confirmation\nHS Code : 8452.21.00\nPort of Loading : Any Seaport of HONGKONG / SINGAPORE\nShipping Mark : REGENCY THREE LTD / SMART SOLUTION\nPort of Discharge : Chattogram\nCountry of Origin : JAPAN / CHINA / TAIWAN\nPartial Shipment: Allowed\nPI Expiry Date : 30 days from above date",
      privateComments: '',
      showItemCodeColumn: true,
      showDiscountColumn: true,
      showTaxColumn: true,
    },
  });

  const { control, setValue, watch, getValues, reset, handleSubmit } = form;
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const showItemCodeColumn = watch("showItemCodeColumn");
  const showDiscountColumn = watch("showDiscountColumn");
  const showTaxColumn = watch("showTaxColumn");

  const watchedCustomerId = watch("customerId");
  const watchedLineItems = watch("lineItems");
  const watchedTaxType = watch("taxType");
  const watchedGlobalDiscount = watch("globalDiscount");
  const watchedGlobalTaxRate = watch("globalTaxRate");

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
            };
          })
        );

      } catch (error) {
        console.error("Error fetching dropdown options for Quote form: ", error);
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
        setValue("shippingAddress", selectedCustomer.address || "");
      }
    } else {
      setValue("billingAddress", "");
      setValue("shippingAddress", "");
    }
  }, [watchedCustomerId, customerOptions, setValue]);

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
  }, [watchedLineItems, watchedTaxType, watchedGlobalDiscount, watchedGlobalTaxRate, setValue, getValues]);


  const handleItemSelect = (itemId: string, index: number) => {
    const selectedItem = itemOptions.find(opt => opt.value === itemId);
    if (selectedItem) {
      let autoDescription = selectedItem.label; 
      if (selectedItem.description) { 
        autoDescription = selectedItem.description;
      }
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

  const saveQuoteLogic = async (data: QuoteFormValues): Promise<string | null> => {
    setIsSubmitting(true);
    const selectedCustomer = customerOptions.find(opt => opt.value === data.customerId);
    const currentYear = new Date().getFullYear();
    const counterRef = doc(firestore, "counters", "quoteNumberGenerator");

    try {
      const newQuoteId = await runTransaction(firestore, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let currentCount = 0;
        if (counterDoc.exists()) {
          const counterData = counterDoc.data();
          currentCount = counterData?.yearlyCounts?.[currentYear] || 0;
        }
        const newCount = currentCount + 1;
        const formattedQuoteId = `QT${currentYear}-${String(newCount).padStart(2, '0')}`;
        
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
            qty: qty,
            unitPrice: finalUnitPrice === 0 && unitPriceStr !== '0' ? undefined : finalUnitPrice,
            discountPercentage: finalDiscountPercentage === 0 && discountPercentageStr !== '0' ? undefined : finalDiscountPercentage,
            taxPercentage: finalTaxPercentage === 0 && taxPercentageStr !== '0' ? undefined : finalTaxPercentage,
            total: calculatedLineTotal,
          };
        });
        
        const finalSubtotal = processedLineItems.reduce((sum, item) => sum + (item.qty * (item.unitPrice ?? 0)), 0);
        const finalTotalDiscount = processedLineItems.reduce((sum, item) => sum + (item.qty * (item.unitPrice ?? 0) * ((item.discountPercentage ?? 0) / 100)), 0);
        const finalTotalTax = processedLineItems.reduce((sum, item) => sum + ((item.qty * (item.unitPrice ?? 0) * (1 - ((item.discountPercentage ?? 0)/100))) * ((item.taxPercentage ?? 0) / 100)), 0);
        const finalGrandTotal = finalSubtotal - finalTotalDiscount + finalTotalTax;

        const quoteDataToSave: Omit<QuoteDocument, 'id'> & { createdAt: any, updatedAt: any } = {
          customerId: data.customerId,
          customerName: selectedCustomer?.label || 'N/A',
          billingAddress: data.billingAddress,
          shippingAddress: data.shippingAddress,
          quoteDate: format(data.quoteDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          salesperson: data.salesperson,
          subject: data.subject || undefined,
          lineItems: processedLineItems,
          taxType: data.taxType,
          comments: data.comments || undefined,
          privateComments: data.privateComments || undefined,
          subtotal: finalSubtotal,
          totalDiscountAmount: finalTotalDiscount,
          totalTaxAmount: finalTotalTax,
          totalAmount: finalGrandTotal,
          status: "Draft", 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          showItemCodeColumn: data.showItemCodeColumn,
          showDiscountColumn: data.showDiscountColumn,
          showTaxColumn: data.showTaxColumn,
        };

        const cleanedDataToSave = Object.fromEntries(
          Object.entries(quoteDataToSave).filter(([, value]) => value !== undefined)
        ) as typeof quoteDataToSave;

        const newQuoteRef = doc(firestore, "quotes", formattedQuoteId);
        transaction.set(newQuoteRef, cleanedDataToSave);

        const newCounters = {
          yearlyCounts: {
            ...(counterDoc.exists() ? counterDoc.data()?.yearlyCounts : {}),
            [currentYear]: newCount,
          }
        };
        transaction.set(counterRef, newCounters, { merge: true });
        
        return formattedQuoteId;
      });
      return newQuoteId;
    } catch (error: any) {
      console.error("Error in saveQuoteLogic: ", error);
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save quote: ${error.message}`,
        icon: "error",
      });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegularSave = async (data: QuoteFormValues) => {
    const newId = await saveQuoteLogic(data);
    if (newId) {
      setGeneratedQuoteId(newId);
      Swal.fire({
        title: "Quote Saved!",
        text: `Quote successfully saved with ID: ${newId}.`,
        icon: "success",
      });
    }
  };

  const handleSaveAndPreview = async (data: QuoteFormValues) => {
    const newId = await saveQuoteLogic(data);
    if (newId) {
      setGeneratedQuoteId(newId);
      Swal.fire({
        title: "Quote Saved!",
        text: `Quote successfully saved with ID: ${newId}. Navigating to preview...`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      }).then(() => {
        router.push(`/dashboard/quotes/preview/${newId}`);
      });
    }
  };

  const handlePreviewLastSaved = () => {
    if (generatedQuoteId) {
      router.push(`/dashboard/quotes/preview/${generatedQuoteId}`);
    } else {
      Swal.fire("No Quote Saved", "Please save a quote first to preview it.", "info");
    }
  };
  
  const handleConvertToInvoice = () => {
    if (generatedQuoteId) {
        Swal.fire({
            title: "Convert to Invoice",
            text: `Functionality to convert Quote ID: ${generatedQuoteId} to an invoice is not yet implemented. This feature will be available soon.`,
            icon: "info",
        });
    } else {
        Swal.fire("No Quote Saved", "Please save a quote first to convert it to an invoice.", "info");
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
  const actionButtonsDisabled = !generatedQuoteId || isSubmitting;


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8"> 
        
        <h3 className={cn(sectionHeadingClass)}>
          <Users className="mr-2 h-5 w-5 text-primary" />
          Customer & Delivery Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
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
          <div>
            <FormField
              control={control}
              name="billingAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bill To*</FormLabel>
                  <FormControl><Textarea placeholder="Billing address" {...field} rows={3} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <FormField
              control={control}
              name="salesperson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Salesperson*</FormLabel>
                  <FormControl><Input placeholder="Salesperson name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div>
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
          </div>
        </div>
        
        <h3 className={cn(sectionHeadingClass)}>
          <CalendarDays className="mr-2 h-5 w-5 text-primary" />
          Quote Details
        </h3>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <FormItem>
              <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Quote Number</FormLabel>
              <Input value={generatedQuoteId || "(Auto-generated on save)"} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" />
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
        
        <Separator className="my-6" />
        <FormField
          control={control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quote Subject</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g., BRAND NEW CAPITAL MACHINERY WITH STANDARD ACCESSORIES FOR 100% EXPORT ORIENTED READYMADE GARMENTS INDUSTRY."
                  className="text-sm font-normal"
                  {...field}
                  value={field.value ?? ''}
                  rows={2}
                />
              </FormControl>
              <FormDescription>
                This text will appear below the address section on the quote.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator className="my-6" />

        <div className="flex justify-between items-center">
            <h3 className={cn(sectionHeadingClass, "mb-0 border-b-0")}>
                <ShoppingBag className="mr-2 h-5 w-5 text-primary" /> Line Items
            </h3>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                    <Columns className="mr-2 h-4 w-4" />
                    Columns
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                    checked={showItemCodeColumn}
                    onCheckedChange={(checked) => setValue('showItemCodeColumn', !!checked)}
                >
                    Item Code
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={showDiscountColumn}
                    onCheckedChange={(checked) => setValue('showDiscountColumn', !!checked)}
                >
                    Discount %
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={showTaxColumn}
                    onCheckedChange={(checked) => setValue('showTaxColumn', !!checked)}
                >
                    Tax %
                </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
            </DropdownMenu>
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
            <FormField control={control} name="comments" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Terms and Conditions:</FormLabel>
                <FormControl><Textarea placeholder="Enter terms and conditions visible to the customer" {...field} rows={3} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
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
            <Button type="button" variant="outline" onClick={() => {
                form.reset();
                setSubtotal(0); setTotalTaxAmount(0); setTotalDiscountAmount(0); setGrandTotal(0);
                setGeneratedQuoteId(null);
            }}>
                <X className="mr-2 h-4 w-4" />Cancel
            </Button>
            <Button type="button" onClick={handleSubmit(handleRegularSave)} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={saveButtonsDisabled}>
              {isSubmitting ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Quote...</> ) : ( <><Save className="mr-2 h-4 w-4" />Save Quote</> )}
            </Button>
            <Button type="button" variant="outline" onClick={handleSubmit(handleSaveAndPreview)} disabled={saveButtonsDisabled}>
                <Printer className="mr-2 h-4 w-4" />Save and Preview
            </Button>
            <Button type="button" variant="outline" onClick={handlePreviewLastSaved} disabled={actionButtonsDisabled}>
                <Printer className="mr-2 h-4 w-4" />Preview Last Saved
            </Button>
            <Button type="button" variant="outline" onClick={handleConvertToInvoice} disabled={actionButtonsDisabled}>
                <Edit className="mr-2 h-4 w-4" />Convert to Invoice
            </Button>
        </div>
      </form>
    </Form>
  );
}
