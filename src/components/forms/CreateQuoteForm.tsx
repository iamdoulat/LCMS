"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FilePlus2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, runTransaction, setDoc } from 'firebase/firestore';
import type {
  CustomerDocument,
  ItemDocument as ItemDoc,
  QuoteTaxType,
  QuoteDocument,
  SaleDocument,
  SaleFormValues as PageSaleFormValues,
  SaleLineItemFormValues as PageSaleLineItemFormValues,
  SaleStatus,
  ShipmentTerms,
  QuoteFormValues as PageQuoteFormValues,
  QuoteLineItemFormValues as PageQuoteLineItemFormValues,
  QuoteLineItemDocument
} from '@/types';
import { QuoteSchema, quoteTaxTypes, invoiceStatusOptions as saleStatusOptions, shipmentTermsOptions } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { Loader2, PlusCircle, Trash2, Users, FileText, CalendarDays, DollarSign, Save, X, ShoppingBag, Hash, Columns, Printer, Edit, Mail, Ship } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
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
import Link from 'next/link';
import Image from 'next/image';

const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_CUSTOMER_VALUE = "__SALE_CUSTOMER_PLACEHOLDER__";
const PLACEHOLDER_ITEM_VALUE = "__SALE_ITEM_PLACEHOLDER__";

interface ItemOption extends ComboboxOption {
  description?: string;
  salesPrice?: number;
  itemCode?: string;
  manageStock?: boolean;
  currentQuantity?: number;
  imageUrl?: string;
}

interface CustomerOption extends ComboboxOption {
  address?: string;
}

type SaleFormValues = PageQuoteFormValues;
type SaleLineItemFormValues = PageQuoteLineItemFormValues;


export function CreateQuoteForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customerOptions, setCustomerOptions] = React.useState<CustomerOption[]>([]);
  const [itemOptions, setItemOptions] = React.useState<ItemOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const [generatedSaleId, setGeneratedSaleId] = React.useState<string | null>(null);

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(QuoteSchema),
    defaultValues: {
      customerId: '',
      billingAddress: '',
      shippingAddress: '',
      quoteDate: new Date(),
      salesperson: '',
      lineItems: [{
        itemId: '',
        itemCode: '',
        description: '',
        qty: '1',
        unitPrice: '0',
        discountPercentage: '0',
        taxPercentage: '0',
        total: '0.00',
        imageUrl: '',
      }],
      status: "Draft",
      taxType: 'Default',
      comments: '',
      privateComments: '',
      showItemCodeColumn: true,
      showDiscountColumn: true,
      showTaxColumn: true,
      packingCharge: undefined,
      handlingCharge: undefined,
      otherCharges: undefined,
      shipmentMode: shipmentTermsOptions[0],
      freightCharges: undefined,
    },
  });

  const { control, setValue, watch, getValues, reset, handleSubmit } = form;

  const showItemCodeColumn = watch("showItemCodeColumn");
  const showDiscountColumn = watch("showDiscountColumn");
  const showTaxColumn = watch("showTaxColumn");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const watchedCustomerId = watch("customerId");
  const watchedLineItems = watch("lineItems");
  const watchedTaxType = watch("taxType");
  const watchedPackingCharge = watch("packingCharge");
  const watchedHandlingCharge = watch("handlingCharge");
  const watchedOtherCharges = watch("otherCharges");
  const watchedFreightCharges = watch("freightCharges");
  const watchedShipmentMode = watch("shipmentMode");

  const { subtotal, totalDiscountAmount, totalTaxAmount, grandTotal } = React.useMemo(() => {
    let currentSubtotal = 0;
    let currentTotalTax = 0;
    let currentTotalDiscount = 0;

    if (Array.isArray(watchedLineItems)) {
      watchedLineItems.forEach((item, index) => {
        const qty = parseFloat(String(item.qty || '0')) || 0;
        const unitPrice = parseFloat(String(item.unitPrice || '0')) || 0;
        const discountP = showDiscountColumn ? (parseFloat(String(item.discountPercentage || '0')) || 0) : 0;
        const taxP = showTaxColumn ? (parseFloat(String(item.taxPercentage || '0')) || 0) : 0;

        let itemTotalBeforeDiscount = 0;
        if (qty > 0 && unitPrice >= 0) {
          itemTotalBeforeDiscount = qty * unitPrice;
          const lineDiscountAmount = itemTotalBeforeDiscount * (discountP / 100);
          const itemTotalAfterDiscount = itemTotalBeforeDiscount - lineDiscountAmount;
          const lineTaxAmount = itemTotalAfterDiscount * (taxP / 100);

          currentSubtotal += itemTotalBeforeDiscount;
          currentTotalDiscount += lineDiscountAmount;
          currentTotalTax += lineTaxAmount;
        }

        const displayLineTotal = isNaN(itemTotalBeforeDiscount) ? 0 : itemTotalBeforeDiscount;

        const currentFormLineTotal = getValues(`lineItems.${index}.total`);
        if (String(displayLineTotal.toFixed(2)) !== currentFormLineTotal) {
          setValue(`lineItems.${index}.total`, displayLineTotal.toFixed(2));
        }
      });
    }

    const packing = Number(watchedPackingCharge || 0);
    const handling = Number(watchedHandlingCharge || 0);
    const other = Number(watchedOtherCharges || 0);
    const freight = Number(watchedFreightCharges || 0);
    const additionalCharges = packing + handling + other + freight;

    const currentGrandTotal = currentSubtotal - currentTotalDiscount + currentTotalTax + additionalCharges;

    return {
      subtotal: currentSubtotal,
      totalDiscountAmount: currentTotalDiscount,
      totalTaxAmount: currentTotalTax,
      grandTotal: currentGrandTotal,
    };
  }, [watchedLineItems, showDiscountColumn, showTaxColumn, getValues, setValue, watchedPackingCharge, watchedHandlingCharge, watchedOtherCharges, watchedFreightCharges]);

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
              imageUrl: data.photoURL || data.imageUrl,
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
      setValue(`lineItems.${index}.imageUrl`, selectedItem.imageUrl || '', { shouldValidate: true });
    } else {
      setValue(`lineItems.${index}.itemCode`, '', { shouldValidate: true });
      setValue(`lineItems.${index}.description`, '', { shouldValidate: true });
      setValue(`lineItems.${index}.unitPrice`, '0', { shouldValidate: true });
      setValue(`lineItems.${index}.itemId`, '', { shouldValidate: true });
      setValue(`lineItems.${index}.imageUrl`, '', { shouldValidate: true });
    }
  };

  const saveQuoteLogic = async (data: SaleFormValues): Promise<string | null> => {
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
        const formattedQuoteId = `QT${currentYear}-${String(newCount).padStart(3, '0')}`;

        const processedLineItems = data.lineItems.map(item => {
          const itemDetails = itemOptions.find(opt => opt.value === item.itemId);
          return {
            itemId: item.itemId,
            itemName: itemDetails?.label.split(' (')[0] || 'N/A',
            itemCode: itemDetails?.itemCode || undefined,
            description: item.description || '',
            qty: parseFloat(String(item.qty || '0')),
            unitPrice: parseFloat(String(item.unitPrice || '0')),
            discountPercentage: parseFloat(String(item.discountPercentage || '0')),
            taxPercentage: parseFloat(String(item.taxPercentage || '0')),
            total: (parseFloat(String(item.qty || '0')) * parseFloat(String(item.unitPrice || '0'))),
            imageUrl: item.imageUrl || undefined,
          };
        });

        const quoteDataToSave: Partial<Omit<QuoteDocument, 'id'>> & { createdAt: ReturnType<typeof serverTimestamp>, updatedAt: ReturnType<typeof serverTimestamp> } = {
          customerId: data.customerId,
          customerName: selectedCustomer?.label || 'N/A',
          billingAddress: data.billingAddress,
          shippingAddress: data.shippingAddress,
          quoteDate: format(data.quoteDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          salesperson: data.salesperson,
          subject: data.subject,
          lineItems: processedLineItems as QuoteLineItemDocument[],
          taxType: data.taxType,
          comments: data.comments,
          privateComments: data.privateComments,
          subtotal: subtotal,
          totalDiscountAmount: totalDiscountAmount,
          totalTaxAmount: totalTaxAmount,
          totalAmount: grandTotal,
          status: "Draft",
          showItemCodeColumn: data.showItemCodeColumn,
          showDiscountColumn: data.showDiscountColumn,
          showTaxColumn: data.showTaxColumn,
          shipmentMode: data.shipmentMode,
          freightCharges: data.freightCharges,
          packingCharge: data.packingCharge,
          handlingCharge: data.handlingCharge,
          otherCharges: data.otherCharges,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const cleanedDataToSave = Object.fromEntries(
          Object.entries(quoteDataToSave).filter(([, value]) => value !== undefined && value !== '')
        ) as typeof quoteDataToSave;

        const newQuoteRef = doc(firestore, "quotes", formattedQuoteId);
        transaction.set(newQuoteRef, cleanedDataToSave);

        transaction.set(counterRef, { yearlyCounts: { ...(counterDoc.exists() ? counterDoc.data().yearlyCounts : {}), [currentYear]: newCount } }, { merge: true });

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

  const handleRegularSave = async (data: SaleFormValues) => {
    const newId = await saveQuoteLogic(data);
    if (newId) {
      setGeneratedSaleId(newId);
      Swal.fire("Quote Saved!", `Quote successfully saved with ID: ${newId}.`, "success");
    }
  };

  const handleSaveAndPreview = async (data: SaleFormValues) => {
    const newId = await saveQuoteLogic(data);
    if (newId) {
      setGeneratedSaleId(newId);
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
    if (generatedSaleId) {
      router.push(`/dashboard/quotations/preview/${generatedSaleId}`);
    } else {
      Swal.fire("No Quote Saved", "Please save a quote first to preview it.", "info");
    }
  };

  const grandTotalLabel = `TOTAL (USD):`;
  const saveButtonsDisabled = isSubmitting || isLoadingDropdowns;
  const actionButtonsDisabled = !generatedSaleId || isSubmitting;


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
      <form className="space-y-8">

        <h3 className={cn(sectionHeadingClass)}><Users className="mr-2 h-5 w-5 text-primary" />Customer & Delivery</h3>
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

        <h3 className={cn(sectionHeadingClass)}><CalendarDays className="mr-2 h-5 w-5 text-primary" />Quote Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 items-end">
          <FormItem>
            <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Quote Number</FormLabel>
            <Input value={generatedSaleId || "(Auto-generated on save)"} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" />
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
                    <SelectTrigger><SelectValue placeholder="Select tax type" /></SelectTrigger>
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
          <div className="flex items-center gap-2">
            <Link href="/dashboard/quotations/items/add" target="_blank">
              <Button variant="outline" size="sm" type="button">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Quote Item
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Columns className="mr-2 h-4 w-4" />Columns</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={showItemCodeColumn} onCheckedChange={(checked) => setValue('showItemCodeColumn', !!checked)}>Item Code</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={showDiscountColumn} onCheckedChange={(checked) => setValue('showDiscountColumn', !!checked)}>Discount %</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={showTaxColumn} onCheckedChange={(checked) => setValue('showTaxColumn', !!checked)}>Tax %</DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Qty*</TableHead>
                <TableHead className="min-w-[200px]">Item*</TableHead>
                {showItemCodeColumn && <TableHead className="min-w-[150px]">Item Code</TableHead>}
                <TableHead className="min-w-[250px]">Description</TableHead>
                <TableHead className="w-[120px]">Unit Price*</TableHead>
                {showDiscountColumn && <TableHead className="w-[100px]">Discount %</TableHead>}
                {showTaxColumn && <TableHead className="w-[100px]">Tax %</TableHead>}
                <TableHead className="w-[130px] text-right">Total Price</TableHead>
                <TableHead className="w-[50px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <FormField
                      control={control}
                      name={`lineItems.${index}.qty`}
                      render={({ field: itemField }) => (
                        <Input type="text" placeholder="1" {...itemField} className="h-9" />
                      )}
                    />
                    <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.qty?.message}</FormMessage>
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={control}
                      name={`lineItems.${index}.itemId`}
                      render={({ field: itemField }) => (
                        <Combobox
                          options={itemOptions}
                          value={itemField.value || PLACEHOLDER_ITEM_VALUE}
                          onValueChange={(itemId) => {
                            itemField.onChange(itemId === PLACEHOLDER_ITEM_VALUE ? '' : itemId);
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
                  {showItemCodeColumn && (
                    <TableCell>
                      <FormField
                        control={control}
                        name={`lineItems.${index}.itemCode`}
                        render={({ field: itemField }) => (
                          <Input placeholder="Code" {...itemField} value={itemField.value ?? ''} className="h-9 bg-muted/50" readOnly disabled />
                        )}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <FormField
                      control={control}
                      name={`lineItems.${index}.description`}
                      render={({ field: itemField }) => (
                        <Textarea placeholder="Item description" {...itemField} rows={1} className="h-9 min-h-[2.25rem] resize-y" />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={control}
                      name={`lineItems.${index}.unitPrice`}
                      render={({ field: itemField }) => (
                        <Input type="text" placeholder="0.00" {...itemField} className="h-9" />
                      )}
                    />
                    <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.unitPrice?.message}</FormMessage>
                  </TableCell>
                  {showDiscountColumn && (
                    <TableCell>
                      <FormField
                        control={control}
                        name={`lineItems.${index}.discountPercentage`}
                        render={({ field: itemField }) => (
                          <Input type="text" placeholder="0" {...itemField} className="h-9" />
                        )}
                      />
                      <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.discountPercentage?.message}</FormMessage>
                    </TableCell>
                  )}
                  {showTaxColumn && (
                    <TableCell>
                      <FormField
                        control={control}
                        name={`lineItems.${index}.taxPercentage`}
                        render={({ field: itemField }) => (
                          <Input type="text" placeholder="0" {...itemField} className="h-9" />
                        )}
                      />
                      <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.taxPercentage?.message}</FormMessage>
                    </TableCell>
                  )}
                  <TableCell className="text-right font-medium">
                    {`$${(parseFloat(watch(`lineItems.${index}.qty`) || '0') * parseFloat(watch(`lineItems.${index}.unitPrice`) || '0')).toFixed(2)}`}
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
        <Button type="button" variant="outline" onClick={() => append({ itemId: '', itemCode: '', description: '', qty: '1', unitPrice: '0', discountPercentage: '0', taxPercentage: '0', total: '0.00', imageUrl: '' })} className="mt-2">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Item
        </Button>

        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="shipmentMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shipment Mode</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? shipmentTermsOptions[0]}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select shipment mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {shipmentTermsOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="freightCharges"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Freight Charges:</FormLabel>
                <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={control}
            name="comments"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Terms and Conditions:</FormLabel>
                <FormControl><Textarea placeholder="Public comments" {...field} rows={3} /></FormControl>
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
                <FormControl><Textarea placeholder="Internal notes" {...field} rows={3} /></FormControl>
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
            {showDiscountColumn && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Discount:</span>
                <span className="font-medium text-foreground">(-) {totalDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            {showTaxColumn && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Tax:</span>
                <span className="font-medium text-foreground">(+) {totalTaxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Freight Charges:</span>
              <span className="font-medium text-foreground">(+) {Number(watchedFreightCharges || 0).toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span className="text-primary">{grandTotalLabel}</span>
              <span className="text-primary">{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <Separator />

        <div className="flex flex-wrap gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => {
            form.reset();
            setGeneratedSaleId(null);
          }}>
            <X className="mr-2 h-4 w-4" />Cancel
          </Button>
          <Button type="button" onClick={handleSubmit(handleRegularSave)} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={saveButtonsDisabled}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Quote...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" />Save Quote</>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={handleSubmit(handleSaveAndPreview)} disabled={saveButtonsDisabled}>
            <Printer className="mr-2 h-4 w-4" />Save and Preview
          </Button>
          <Button type="button" variant="outline" onClick={handlePreviewLastSaved} disabled={actionButtonsDisabled}>
            <Printer className="mr-2 h-4 w-4" />Preview Last Saved
          </Button>
        </div>
      </form>
    </Form>
  );
}