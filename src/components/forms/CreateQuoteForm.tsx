
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, runTransaction, setDoc } from 'firebase/firestore';
import type { QuoteDocument, QuoteFormValues as PageQuoteFormValues, CustomerDocument, ItemDocument as ItemDoc, QuoteTaxType, QuoteLineItemFormValues as PageQuoteLineItemFormValues, InvoiceDocument, PIShipmentMode } from '@/types';
import { QuoteLineItemSchema, QuoteSchema, quoteTaxTypes, quoteStatusOptions, piShipmentModeOptions } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { Loader2, PlusCircle, Trash2, Users, FileText, CalendarDays, DollarSign, Save, X, ShoppingBag, Hash, Columns, Printer, Edit, Mail, Ship } from 'lucide-react';
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

type QuoteFormValues = PageQuoteFormValues;
type QuoteLineItemFormValues = PageQuoteLineItemFormValues;


export function CreateQuoteForm() {
  const router = useRouter(); // Added for navigation
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customerOptions, setCustomerOptions] = React.useState<CustomerOption[]>([]);
  const [itemOptions, setItemOptions] = React.useState<ItemOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const [generatedQuoteId, setGeneratedQuoteId] = React.useState<string | null>(null);

  const form = useForm<PageQuoteFormValues>({
    resolver: zodResolver(QuoteSchema),
    defaultValues: {
      customerId: '',
      billingAddress: '',
      shippingAddress: '',
      quoteDate: undefined,
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
      // Changed default values to false for these columns
      showItemCodeColumn: false,
      showDiscountColumn: false,
      showTaxColumn: false,
      shipmentMode: piShipmentModeOptions[0],
      freightCharges: undefined,
    },
  });

  React.useEffect(() => {
    // Set default dates on the client side to prevent hydration mismatch
    form.reset({
      ...form.getValues(),
      quoteDate: new Date(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const watchedFreightCharges = watch("freightCharges");

  const { subtotal, totalDiscountAmount, totalTaxAmount, grandTotal } = React.useMemo(() => {
    let currentSubtotal = 0;
    let currentTotalTax = 0;
    let currentTotalDiscount = 0;

    if (Array.isArray(watchedLineItems)) {
      watchedLineItems.forEach((item) => {
        const qty = parseFloat(String(item.qty || '0')) || 0;
        const unitPrice = parseFloat(String(item.unitPrice || '0')) || 0;
        const discountP = showDiscountColumn ? (parseFloat(String(item.discountPercentage || '0')) || 0) : 0;
        const taxP = showTaxColumn ? (parseFloat(String(item.taxPercentage || '0')) || 0) : 0;

        const itemTotalBeforeDiscount = qty * unitPrice;

        if (qty > 0 && unitPrice >= 0) {
          const lineDiscountAmount = itemTotalBeforeDiscount * (discountP / 100);
          const itemTotalAfterDiscount = itemTotalBeforeDiscount - lineDiscountAmount;
          const lineTaxAmount = itemTotalAfterDiscount * (taxP / 100);

          currentSubtotal += itemTotalBeforeDiscount;
          currentTotalDiscount += lineDiscountAmount;
          currentTotalTax += lineTaxAmount;
        }
      });
    }

    const freight = Number(watchedFreightCharges || 0);
    const currentGrandTotal = currentSubtotal - currentTotalDiscount + currentTotalTax + freight;
    return {
      subtotal: currentSubtotal,
      totalDiscountAmount: currentTotalDiscount,
      totalTaxAmount: currentTotalTax,
      grandTotal: currentGrandTotal,
    };
  }, [watchedLineItems, showDiscountColumn, showTaxColumn, watchedFreightCharges]);

  React.useEffect(() => {
    const fetchOptions = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [customersSnap, itemsSnap] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(collection(firestore, "quote_items"))
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

  const saveQuoteLogic = async (data: PageQuoteFormValues): Promise<string | null> => {
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
            const itemDetails = itemOptions.find(opt => opt.value === item.itemId);
            const qty = parseFloat(String(item.qty || '0'));
            const unitPrice = parseFloat(String(item.unitPrice || '0'));
            const total = qty * unitPrice;

            const lineItemData: any = {
                itemId: item.itemId,
                itemName: itemDetails?.label.split(' (')[0] || 'N/A',
                itemCode: itemDetails?.itemCode || undefined,
                description: item.description || '',
                qty,
                unitPrice,
                discountPercentage: parseFloat(String(item.discountPercentage || '0')),
                taxPercentage: parseFloat(String(item.taxPercentage || '0')),
                total,
            };
             // Clean the line item itself
            Object.keys(lineItemData).forEach(key => {
                if (lineItemData[key] === undefined || lineItemData[key] === null || lineItemData[key] === '') {
                    delete lineItemData[key];
                }
            });
            return lineItemData;
        });
        
        const finalSubtotal = processedLineItems.reduce((sum, item) => sum + item.total, 0);
        const finalTotalDiscount = data.showDiscountColumn ? processedLineItems.reduce((sum, item) => sum + (item.total * ((item.discountPercentage ?? 0) / 100)), 0) : 0;
        const finalTotalTax = data.showTaxColumn ? processedLineItems.reduce((sum, item) => sum + ((item.total * (1 - ((item.discountPercentage ?? 0)/100))) * ((item.taxPercentage ?? 0) / 100)), 0) : 0;
        const finalGrandTotal = finalSubtotal - finalTotalDiscount + finalTotalTax + Number(data.freightCharges || 0);

        const quoteDataToSave: Record<string, any> = {
          customerId: data.customerId,
          customerName: selectedCustomer?.label || 'N/A',
          billingAddress: data.billingAddress,
          shippingAddress: data.shippingAddress,
          quoteDate: format(data.quoteDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          salesperson: data.salesperson,
          subject: data.subject,
          lineItems: processedLineItems,
          taxType: data.taxType,
          comments: data.comments,
          privateComments: data.privateComments,
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
          convertedToInvoiceId: data.convertedToInvoiceId,
          shipmentMode: data.shipmentMode,
          freightCharges: data.freightCharges,
        };
        
        // Final cleaning of the main object before saving
        Object.keys(quoteDataToSave).forEach(key => {
          if (quoteDataToSave[key] === undefined || quoteDataToSave[key] === null || quoteDataToSave[key] === '') {
            delete quoteDataToSave[key];
          }
        });

        const newQuoteRef = doc(firestore, "quotes", formattedQuoteId);
        transaction.set(newQuoteRef, quoteDataToSave);

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
    } catch (error) {
      console.error("Error in saveQuoteLogic: ", error);
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save quote: ${(error as Error).message}`,
        icon: "error",
      });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegularSave = async (data: PageQuoteFormValues) => {
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

  const handleSaveAndPreview = async (data: PageQuoteFormValues) => {
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
        router.push(`/dashboard/quotations/preview/${newId}`);
      });
    }
  };

  const handlePreviewLastSaved = () => {
    if (generatedQuoteId) {
      router.push(`/dashboard/quotations/preview/${generatedQuoteId}`);
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

  // Custom reset function that maintains the new default values
  const handleReset = () => {
    form.reset({
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
      // Ensure these remain false on reset
      showItemCodeColumn: false,
      showDiscountColumn: false,
      showTaxColumn: false,
      shipmentMode: piShipmentModeOptions[0],
      freightCharges: undefined,
    });
    setGeneratedQuoteId(null);
  };

  const grandTotalLabel = `TOTAL (USD):`;

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
      <form onSubmit={handleSubmit(() => {})} className="space-y-8">
        
        <h3 className={cn(sectionHeadingClass)}><Users className="mr-2 h-5 w-5 text-primary" />Customer & Delivery Information</h3>
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
          <div><FormField control={control} name="salesperson" render={({ field }) => (<FormItem><FormLabel>Salesperson*</FormLabel><FormControl><Input placeholder="Salesperson name" {...field} /></FormControl><FormMessage /></FormItem>)}/></div>
          <div><FormField control={control} name="shippingAddress" render={({ field }) => (<FormItem><FormLabel>Delivery Address*</FormLabel><FormControl><Textarea placeholder="Delivery address" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)}/></div>
        </div>
        
        <h3 className={cn(sectionHeadingClass)}><CalendarDays className="mr-2 h-5 w-5 text-primary" />Quote Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 items-end">
            <FormItem><FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Quote Number</FormLabel><Input value={generatedQuoteId || "(Auto-generated on save)"} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" /></FormItem>
            <FormField control={control} name="quoteDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Quote Date*</FormLabel><DatePickerField field={field} placeholder="Select quote date" /><FormMessage /></FormItem>)}/>
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
            <h3 className={cn(sectionHeadingClass, "mb-0 border-b-0")}><ShoppingBag className="mr-2 h-5 w-5 text-primary" /> Line Items</h3>
            <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Columns className="mr-2 h-4 w-4" />Columns</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end"><DropdownMenuLabel>Toggle Columns</DropdownMenuLabel><DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={showItemCodeColumn} onCheckedChange={(checked) => setValue('showItemCodeColumn', !!checked)}>Item Code</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={showDiscountColumn} onCheckedChange={(checked) => setValue('showDiscountColumn', !!checked)}>Discount %</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={showTaxColumn} onCheckedChange={(checked) => setValue('showTaxColumn', !!checked)}>Tax %</DropdownMenuCheckboxItem>
                </DropdownMenuContent></DropdownMenu>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead className="w-[120px]">Qty*</TableHead><TableHead className="min-w-[200px]">Item*</TableHead>{showItemCodeColumn && <TableHead className="min-w-[150px]">Item Code</TableHead>}<TableHead className="min-w-[250px]">Description</TableHead><TableHead className="w-[120px]">Unit Price*</TableHead>
          {showDiscountColumn && <TableHead className="w-[100px]">Discount %</TableHead>}
          {showTaxColumn && <TableHead className="w-[100px]">Tax %</TableHead>}
          <TableHead className="w-[130px] text-right">Total Price</TableHead><TableHead className="w-[50px] text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell><FormField control={control} name={`lineItems.${index}.qty`} render={({ field: itemField }) => (<Input type="text" placeholder="1" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.qty?.message}</FormMessage></TableCell>
                  <TableCell><FormField control={control} name={`lineItems.${index}.itemId`} render={({ field: itemField }) => (<Combobox options={itemOptions} value={itemField.value || PLACEHOLDER_ITEM_VALUE} onValueChange={(itemId) => { itemField.onChange(itemId === PLACEHOLDER_ITEM_VALUE ? '' : itemId); handleItemSelect(itemId, index);}} placeholder="Search Item..." selectPlaceholder="Select Item" emptyStateMessage="No item found." className="h-9"/>)}/><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.itemId?.message}</FormMessage></TableCell>
                  {showItemCodeColumn && (<TableCell><FormField control={control} name={`lineItems.${index}.itemCode`} render={({ field: itemField }) => (<Input placeholder="Code" {...itemField} value={itemField.value ?? ''} className="h-9 bg-muted/50" readOnly disabled />)}/></TableCell>)}
                  <TableCell><FormField control={control} name={`lineItems.${index}.description`} render={({ field: itemField }) => (<Textarea placeholder="Item description" {...itemField} rows={1} className="h-9 min-h-[2.25rem] resize-y"/>)} /></TableCell>
                  <TableCell><FormField control={control} name={`lineItems.${index}.unitPrice`} render={({ field: itemField }) => (<Input type="text" placeholder="0.00" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.unitPrice?.message}</FormMessage></TableCell>
                  {showDiscountColumn && <TableCell><FormField control={control} name={`lineItems.${index}.discountPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.discountPercentage?.message}</FormMessage></TableCell>}
                  {showTaxColumn && <TableCell><FormField control={control} name={`lineItems.${index}.taxPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.taxPercentage?.message}</FormMessage></TableCell>
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
                <FormLabel className="font-bold underline">Terms and Conditions:</FormLabel>
                <FormControl><Textarea placeholder="Enter terms and conditions visible to the customer" {...field} rows={3} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={control} name="privateComments" render={({ field }) => (<FormItem><FormLabel>Private Comments (Internal)</FormLabel><FormControl><Textarea placeholder="Internal notes, not visible to customer" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)}/>
        </div>
        <div className="flex justify-end space-y-2 mt-6">
            <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium text-foreground">{subtotal.toFixed(2)}</span></div>
                {showDiscountColumn && (<div className="flex justify-between"><span className="text-muted-foreground">Total Discount:</span><span className="font-medium text-foreground">(-) {totalDiscountAmount.toFixed(2)}</span></div>)}
                {showTaxColumn && (<div className="flex justify-between"><span className="text-muted-foreground">Total Tax:</span><span className="font-medium text-foreground">(+) {totalTaxAmount.toFixed(2)}</span></div>)}
                <div className="flex justify-between"><span className="text-muted-foreground">Freight Charges:</span><span className="font-medium text-foreground">(+) {Number(watchedFreightCharges || 0).toFixed(2)}</span></div>
                <Separator />
                <div className="flex justify-between text-lg font-bold"><span className="text-primary">{grandTotalLabel}</span><span className="text-primary">{grandTotal.toFixed(2)}</span></div>
            </div>
        </div>
        <Separator />
        
        <div className="flex flex-wrap gap-2 justify-end">
            <Button type="button" variant="outline" onClick={handleReset}>
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
