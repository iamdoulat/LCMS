
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, runTransaction, setDoc } from 'firebase/firestore';
import type { CustomerDocument, ItemDocument as ItemDoc, QuoteTaxType, SaleDocument, SaleFormValues as PageSaleFormValues, SaleLineItemFormValues as PageSaleLineItemFormValues, SaleStatus } from '@/types'; // Updated types
import { InvoiceSchema as SaleSchema, quoteTaxTypes, saleStatusOptions, piShipmentModeOptions } from '@/types'; // Updated schemas
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
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

const PLACEHOLDER_CUSTOMER_VALUE = "__SALE_CUSTOMER_PLACEHOLDER__";
const PLACEHOLDER_ITEM_VALUE = "__SALE_ITEM_PLACEHOLDER__";

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

type SaleFormValues = PageSaleFormValues;
type SaleLineItemFormValues = PageSaleLineItemFormValues;


export function CreateSaleInvoiceForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customerOptions, setCustomerOptions] = React.useState<CustomerOption[]>([]);
  const [itemOptions, setItemOptions] = React.useState<ItemOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const [generatedSaleId, setGeneratedSaleId] = React.useState<string | null>(null);

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(SaleSchema),
    defaultValues: {
      customerId: '',
      billingAddress: '',
      shippingAddress: '',
      invoiceDate: new Date(),
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
    const additionalCharges = packing + handling + other;

    const currentGrandTotal = currentSubtotal - currentTotalDiscount + currentTotalTax + additionalCharges;
    
    return {
      subtotal: currentSubtotal,
      totalDiscountAmount: currentTotalDiscount,
      totalTaxAmount: currentTotalTax,
      grandTotal: currentGrandTotal,
    };
  }, [watchedLineItems, showDiscountColumn, showTaxColumn, getValues, setValue, watchedPackingCharge, watchedHandlingCharge, watchedOtherCharges]);

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
        console.error("Error fetching dropdown options for Sale form: ", error);
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

  const saveSaleLogic = async (data: SaleFormValues): Promise<string | null> => {
    setIsSubmitting(true);
    const selectedCustomer = customerOptions.find(opt => opt.value === data.customerId);
    const currentYear = new Date().getFullYear();
    const counterRef = doc(firestore, "counters", "saleNumberGenerator");

    try {
      const newSaleId = await runTransaction(firestore, async (transaction) => {
        // ----- READ PHASE -----
        const counterDoc = await transaction.get(counterRef);

        const itemsToUpdate: { itemRef: any, newQty: number, label: string }[] = [];
        for (const lineItem of data.lineItems) {
          if (!lineItem.itemId) continue;
          const itemOption = itemOptions.find(opt => opt.value === lineItem.itemId);
          if (itemOption?.manageStock) {
            const itemRef = doc(firestore, "items", lineItem.itemId);
            const itemSnap = await transaction.get(itemRef);

            if (!itemSnap.exists()) {
              throw new Error(`Item "${itemOption.label}" not found. Sale cannot be completed.`);
            }
            const itemData = itemSnap.data() as ItemDoc;
            const currentItemQty = itemData.currentQuantity || 0;
            const requestedQty = parseFloat(String(lineItem.qty || '0'));
            if (currentItemQty < requestedQty) {
              throw new Error(`Insufficient stock for item "${itemData.itemName}". Only ${currentItemQty} available.`);
            }
            itemsToUpdate.push({
              itemRef: itemRef,
              newQty: currentItemQty - requestedQty,
              label: itemData.itemName || "Unknown Item",
            });
          }
        }

        // ----- WRITE PHASE -----
        let currentCount = 0;
        if (counterDoc.exists()) {
          const counterData = counterDoc.data();
          currentCount = counterData?.yearlyCounts?.[currentYear] || 0;
        }
        const newCount = currentCount + 1;
        const formattedSaleId = `IMI${currentYear}-${String(newCount).padStart(2, '0')}`;
        
        const processedLineItems = data.lineItems.map(item => {
          const qty = parseFloat(String(item.qty || '0'));
          const unitPriceStr = String(item.unitPrice || '0');
          const finalUnitPrice = parseFloat(unitPriceStr);
          const discountPercentageStr = String(item.discountPercentage || '0');
          const finalDiscountPercentage = parseFloat(discountPercentageStr);
          const taxPercentageStr = String(item.taxPercentage || '0');
          const finalTaxPercentage = parseFloat(taxPercentageStr);

          const itemTotalBeforeDiscount = qty * finalUnitPrice;
          
          const itemDetails = itemOptions.find(opt => opt.value === item.itemId);

          const lineItemData: any = {
            itemId: item.itemId,
            itemName: itemDetails?.label.split(' (')[0] || 'N/A',
            itemCode: itemDetails?.itemCode,
            description: item.description || '',
            qty, unitPrice: finalUnitPrice, discountPercentage: finalDiscountPercentage, taxPercentage: finalTaxPercentage, total: itemTotalBeforeDiscount,
          };
          Object.keys(lineItemData).forEach(key => {
            if (lineItemData[key] === undefined || lineItemData[key] === null || (typeof lineItemData[key] === 'string' && lineItemData[key].trim() === '')) {
              delete lineItemData[key];
            }
          });
          return lineItemData;
        });
        
        const dataToSave: Record<string, any> = {
          customerId: data.customerId, customerName: selectedCustomer?.label || 'N/A',
          billingAddress: data.billingAddress, shippingAddress: data.shippingAddress,
          invoiceDate: format(data.invoiceDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          dueDate: data.dueDate ? format(data.dueDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
          paymentTerms: data.paymentTerms, salesperson: data.salesperson,
          subject: data.subject,
          lineItems: processedLineItems, taxType: data.taxType,
          comments: data.comments, privateComments: data.privateComments,
          subtotal: subtotal, totalDiscountAmount: totalDiscountAmount, totalTaxAmount: totalTaxAmount,
          totalAmount: grandTotal, status: data.status || "Draft",
          amountPaid: 0,
          packingCharge: data.packingCharge,
          handlingCharge: data.handlingCharge,
          otherCharges: data.otherCharges,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          showItemCodeColumn: data.showItemCodeColumn,
          showDiscountColumn: data.showDiscountColumn,
          showTaxColumn: data.showTaxColumn,
        };

        const cleanedDataToSave = Object.fromEntries(
          Object.entries(dataToSave).filter(([, value]) => value !== undefined && value !== '')
        ) as Partial<Omit<SaleDocument, 'id'>>;
        
        const newSaleRef = doc(firestore, "sales_invoice", formattedSaleId);
        transaction.set(newSaleRef, cleanedDataToSave);

        const newCounters = {
          yearlyCounts: {
            ...(counterDoc.exists() ? counterDoc.data().yearlyCounts : {}),
            [currentYear]: newCount,
          }
        };
        transaction.set(counterRef, newCounters, { merge: true });

        itemsToUpdate.forEach(itemUpdate => {
          transaction.update(itemUpdate.itemRef, {
            currentQuantity: itemUpdate.newQty,
            updatedAt: serverTimestamp(),
          });
        });

        return formattedSaleId;
      });

      return newSaleId;
    } catch (error: any) {
      console.error("Error in saveSaleLogic: ", error);
      Swal.fire({
        title: "Save Failed",
        text: `Failed to record sale: ${error.message}`,
        icon: "error",
      });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegularSave = async (data: SaleFormValues) => {
    const newId = await saveSaleLogic(data);
    if (newId) {
      setGeneratedSaleId(newId);
      Swal.fire("Sale Recorded!", `Sale successfully recorded with ID: ${newId}. Item stock levels updated.`, "success");
    }
  };

  const handleSaveAndPreview = async (data: SaleFormValues) => {
    const newId = await saveSaleLogic(data);
    if (newId) {
      setGeneratedSaleId(newId);
      Swal.fire({
        title: "Sale Recorded!",
        text: `Sale successfully recorded with ID: ${newId}. Navigating to preview...`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      }).then(() => {
        router.push(`/dashboard/inventory/sales/print/${newId}`);
      });
    }
  };

  const handlePreviewLastSaved = () => {
    if (generatedSaleId) {
      router.push(`/dashboard/inventory/sales/print/${generatedSaleId}`);
    } else {
      Swal.fire("No Sale Recorded", "Please save an invoice first to preview it.", "info");
    }
  };
  
  const grandTotalLabel = "TOTAL (BDT):";


  if (isLoadingDropdowns) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading form options...</p>
      </div>
    );
  }
  
  const saveButtonsDisabled = isSubmitting || isLoadingDropdowns;
  const actionButtonsDisabled = !generatedSaleId || isSubmitting;

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
              name="shippingAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Address*</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Delivery address" {...field} rows={3} />
                  </FormControl>
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
                  <FormControl>
                    <Input placeholder="Enter salesperson name" {...field} />
                  </FormControl>
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
          Invoice Details
        </h3>
         <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 items-end">
            <FormItem>
              <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Invoice Number</FormLabel>
              <Input value={generatedSaleId || "(Auto-generated on save)"} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" />
            </FormItem>
            <FormField
                control={control}
                name="invoiceDate"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Invoice Date*</FormLabel>
                    <DatePickerField field={field} placeholder="Select invoice date" />
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
             <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Status*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? 'Draft'}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {saleStatusOptions.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <Separator className="my-6" />

        <div className="flex justify-between items-center">
            <h3 className={cn(sectionHeadingClass, "mb-0 border-b-0")}>
                <ShoppingBag className="mr-2 h-5 w-5 text-primary" /> Line Items
            </h3>
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
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField control={control} name="packingCharge" render={({ field }) => (<FormItem><FormLabel>Packing Charge</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
          <FormField control={control} name="handlingCharge" render={({ field }) => (<FormItem><FormLabel>Handling Charge</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
          <FormField control={control} name="otherCharges" render={({ field }) => (<FormItem><FormLabel>Freight Charges</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={control} name="comments" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold underline">TERMS AND CONDITIONS:</FormLabel>
                <FormControl><Textarea placeholder="Public comments" {...field} rows={3} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={control} name="privateComments" render={({ field }) => (<FormItem><FormLabel>Private Comments (Internal)</FormLabel><FormControl><Textarea placeholder="Internal notes" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)}/>
        </div>
        
        <div className="flex justify-end space-y-2 mt-6">
            <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium text-foreground">{subtotal.toFixed(2)}</span></div>
                {showDiscountColumn && (<div className="flex justify-between"><span className="text-muted-foreground">Total Discount:</span><span className="font-medium text-foreground">(-) {totalDiscountAmount.toFixed(2)}</span></div>)}
                {showTaxColumn && (<div className="flex justify-between"><span className="text-muted-foreground">Total Tax:</span><span className="font-medium text-foreground">(+) {totalTaxAmount.toFixed(2)}</span></div>)}
                <div className="flex justify-between"><span className="text-muted-foreground">Additional Charges:</span><span className="font-medium text-foreground">(+) {(Number(watchedPackingCharge||0) + Number(watchedHandlingCharge||0) + Number(watchedOtherCharges||0)).toFixed(2)}</span></div>
                <Separator />
                <div className="flex justify-between text-lg font-bold"><span className="text-primary">Grand Total:</span><span className="text-primary">{grandTotal.toFixed(2)}</span></div>
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
              {isSubmitting ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording Sale...</> ) : ( <><Save className="mr-2 h-4 w-4" />Record Sale</> )}
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




```
- src/types/index.ts
    - The `CreateInvoiceForm.tsx` file has an error where it's comparing against `"CFR CHATTOGRAM"` and other descriptive strings. The `PIShipmentMode` type should contain these descriptive values, not generic ones like "CFR". I will correct this in the `types.ts` file.
    - `shipmentTerms` was added to `lcEntrySchema` but it should be on `QuoteSchema`, `InvoiceSchema`, and `OrderSchema` instead. I'll move it.
    - I'll remove `otherCharges` from `InvoiceSchema` as it was duplicated from `OrderSchema`.
    - I'll add `shipmentMode`, `freightCharges` to `QuoteSchema`.

Here's the plan to fix everything:

<changes>
  <description>Corrected the shipment mode type definition in `types.ts` to use descriptive values (e.g., "CFR CHATTOGRAM"), which resolves a TypeScript error in the invoice and quote forms. Also, cleaned up schema definitions to place `shipmentMode` and related fields on the correct quote/invoice/order schemas, and removed duplicated fields.</description>
  <change>
    <file>/src/types/index.ts</file>
    <content><![CDATA[
import { z } from 'zod';
import type { Timestamp } from 'firebase/firestore';

export const termsOfPayOptions = [
  "T/T In Advance",
  "L/C AT SIGHT",
  "UPAS",
  "Deferred 60days",
  "Deferred 120days",
  "Deferred 180days",
  "Deferred 360days",
] as const;
export type TermsOfPay = typeof termsOfPayOptions[number];

export const shipmentModeOptions = ["Sea", "Air"] as const;
export type ShipmentMode = typeof shipmentModeOptions[number];

export const currencyOptions = ["USD", "EURO"] as const;
export type Currency = typeof currencyOptions[number];

export const trackingCourierOptions = ["DHL", "FedEx"] as const;
export type TrackingCourier = typeof trackingCourierOptions[number] | "";

export const lcStatusOptions = ["Draft", "Transmitted", "Shipment Pending", "Payment Pending", "Payment Done", "Shipment Done"] as const;
export type LCStatus = typeof lcStatusOptions[number];

export const partialShipmentAllowedOptions = ["Yes", "No"] as const;
export type PartialShipmentAllowed = typeof partialShipmentAllowedOptions[number];

export const certificateOfOriginCountries = [
  "JAPAN", "CHINA", "TAIWAN", "SINGAPORE", "VIETNAM", "MALAYSIA", "ITALY", "USA", "THAILAND", "HONG KONG", "TURKEY", "GERMANY",
] as const;
export type CertificateOfOriginCountry = typeof certificateOfOriginCountries[number];

export const toNumberOrUndefined = (val: unknown): number | undefined => {
  if (val === "" || val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
    return undefined;
  }
  const num = Number(String(val).trim());
  return isNaN(num) ? undefined : num;
};

// Updated getValidOption function to correctly handle types and undefined values
export function getValidOption<T extends string>(
  value: T | undefined,
  options: readonly T[],
  fallback: T
): T {
  if (typeof value === "string" && options.includes(value)) {
    return value;
  }
  return fallback;
}


export interface LCEntry {
  id?: string;
  applicantId: string;
  beneficiaryId: string;
  currency: Currency;
  amount: number | undefined;
  termsOfPay?: TermsOfPay;
  documentaryCreditNumber: string;
  proformaInvoiceNumber?: string;
  invoiceDate?: Date | null | undefined;
  commercialInvoiceNumber?: string;
  commercialInvoiceDate?: Date | null | undefined;
  totalMachineQty: number | undefined;
  numberOfAmendments?: number;
  status?: LCStatus[];
  itemDescriptions?: string;
  partialShipments?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  consigneeBankNameAddress?: string;
  notifyPartyNameAndAddress?: string;
  notifyPartyName?: string; // Previously notifyPartyContactDetails
  notifyPartyCell?: string;
  notifyPartyEmail?: string;
  lcIssueDate?: Date | null | undefined;
  expireDate?: Date | null | undefined;
  latestShipmentDate?: Date | null | undefined;
  purchaseOrderUrl?: string;
  finalPIUrl?: string;
  finalLcUrl?: string;
  shippingDocumentsUrl?: string;
  packingListUrl?: string;
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: Date | null | undefined;
  eta?: Date | null | undefined;
  shipmentMode?: ShipmentMode;
  shipmentTerms?: PIShipmentMode; // New field for shipment terms
  vesselOrFlightName?: string;
  vesselImoNumber?: string;
  flightNumber?: string;
  totalPackageQty?: number;
  totalNetWeight?: number;
  totalGrossWeight?: number;
  totalCbm?: number;
  partialShipmentAllowed?: PartialShipmentAllowed;
  firstPartialQty?: number;
  secondPartialQty?: number;
  thirdPartialQty?: number;
  firstPartialAmount?: number;
  secondPartialAmount?: number;
  thirdPartialAmount?: number;
  firstPartialPkgs?: number;
  firstPartialNetWeight?: number;
  firstPartialGrossWeight?: number;
  firstPartialCbm?: number;
  secondPartialPkgs?: number;
  secondPartialNetWeight?: number;
  secondPartialGrossWeight?: number;
  secondPartialCbm?: number;
  thirdPartialPkgs?: number;
  thirdPartialNetWeight?: number;
  thirdPartialGrossWeight?: number;
  thirdPartialCbm?: number;
  originalBlQty?: number;
  copyBlQty?: number;
  originalCooQty?: number;
  copyCooQty?: number;
  invoiceQty?: number;
  packingListQty?: number;
  beneficiaryCertificateQty?: number;
  brandNewCertificateQty?: number;
  beneficiaryWarrantyCertificateQty?: number;
  beneficiaryComplianceCertificateQty?: number;
  shipmentAdviceQty?: number;
  billOfExchangeQty?: number;
  certificateOfOrigin?: CertificateOfOriginCountry[];
  shippingMarks?: string;
  isFirstShipment?: boolean;
  isSecondShipment?: boolean;
  isThirdShipment?: boolean;
  firstShipmentNote?: string;
  secondShipmentNote?: string;
  thirdShipmentNote?: string;
}

export const lcEntrySchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required"),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required"),
  currency: z.enum(currencyOptions, { required_error: "Currency is required" }),
  amount: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Amount must be a number" }).positive("Amount must be positive")
  ),
  termsOfPay: z.enum(termsOfPayOptions, { required_error: "Terms of Pay is required" }),
  documentaryCreditNumber: z.string().min(1, "Documentary Credit Number is required"),
  proformaInvoiceNumber: z.string().optional(),
  invoiceDate: z.date().optional().nullable(),
  commercialInvoiceNumber: z.string().optional(),
  commercialInvoiceDate: z.date().optional().nullable(),
  totalMachineQty: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Quantity must be a number" }).int().positive("Quantity must be positive")
  ),
  numberOfAmendments: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Amendments must be non-negative integer.").optional().default(0)),
  status: z.array(z.enum(lcStatusOptions)).optional().default([lcStatusOptions[0]]),
  itemDescriptions: z.string().optional(),
  partialShipments: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  consigneeBankNameAddress: z.string().optional(),
  notifyPartyNameAndAddress: z.string().optional(),
  notifyPartyName: z.string().optional(),
  notifyPartyCell: z.string().optional(),
  notifyPartyEmail: z.string().email({ message: "Invalid email address" }).optional().or(z.literal('')),
  lcIssueDate: z.date().optional().nullable(),
  expireDate: z.date().optional().nullable(),
  latestShipmentDate: z.date().optional().nullable(),
  partialShipmentAllowed: z.enum(partialShipmentAllowedOptions).optional(),
  firstPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  secondPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  thirdPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  firstPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional().default(0)),
  secondPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional().default(0)),
  thirdPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional().default(0)),
  firstPartialPkgs: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Pkgs cannot be negative").optional().default(0)),
  firstPartialNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net Weight cannot be negative").optional().default(0)),
  firstPartialGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross Weight cannot be negative").optional().default(0)),
  firstPartialCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional().default(0)),
  secondPartialPkgs: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Pkgs cannot be negative").optional().default(0)),
  secondPartialNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net Weight cannot be negative").optional().default(0)),
  secondPartialGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross Weight cannot be negative").optional().default(0)),
  secondPartialCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional().default(0)),
  thirdPartialPkgs: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Pkgs cannot be negative").optional().default(0)),
  thirdPartialNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net Weight cannot be negative").optional().default(0)),
  thirdPartialGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross Weight cannot be negative").optional().default(0)),
  thirdPartialCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional().default(0)),
  totalPackageQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Package quantity cannot be negative").optional().default(0)),
  totalNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net weight cannot be negative").optional().default(0)),
  totalGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross weight cannot be negative").optional().default(0)),
  totalCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional().default(0)),
  shipmentMode: z.enum(shipmentModeOptions).optional(),
  shipmentTerms: z.enum(["CFR", "CPT", "FOB", "EXW"]).optional(), // Corrected definition here
  vesselOrFlightName: z.string().optional(),
  vesselImoNumber: z.string().optional(),
  flightNumber: z.string().optional(),
  trackingCourier: z.enum(["", ...trackingCourierOptions]).optional(),
  trackingNumber: z.string().optional(),
  etd: z.date().optional().nullable(),
  eta: z.date().optional().nullable(),
  originalBlQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  copyBlQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  originalCooQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  copyCooQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  invoiceQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  packingListQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  beneficiaryCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  brandNewCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  beneficiaryWarrantyCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  beneficiaryComplianceCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  shipmentAdviceQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  billOfExchangeQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  certificateOfOrigin: z.array(z.enum(certificateOfOriginCountries)).optional().default([]),
  shippingMarks: z.string().optional(),
  purchaseOrderUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  finalPIUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  finalLcUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  shippingDocumentsUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  packingListUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  isFirstShipment: z.boolean().optional().default(true),
  isSecondShipment: z.boolean().optional().default(false),
  isThirdShipment: z.boolean().optional().default(false),
  firstShipmentNote: z.string().optional(),
  secondShipmentNote: z.string().optional(),
  thirdShipmentNote: z.string().optional(),
}).superRefine((data, ctx) => {
    if (!data.status || data.status.length === 0 || data.status.includes('Draft')) {
        return;
    }

    if (!data.lcIssueDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['lcIssueDate'],
            message: 'T/T or L/C Issue Date is required when status is not Draft.',
        });
    }

    if (data.termsOfPay !== 'T/T In Advance') {
        if (!data.expireDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['expireDate'],
                message: 'Expire Date is required unless Terms of Pay is T/T In Advance.',
            });
        }
        if (!data.latestShipmentDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['latestShipmentDate'],
                message: 'Latest Shipment Date is required unless Terms of Pay is T/T In Advance.',
            });
        }
    }
});


export interface LCEntryDocument {
  id: string;
  year: number;
  applicantId: string;
  applicantName: string;
  beneficiaryId: string;
  beneficiaryName: string;
  currency: Currency;
  amount: number;
  termsOfPay?: TermsOfPay;
  documentaryCreditNumber: string;
  proformaInvoiceNumber?: string;
  invoiceDate?: string; // ISO string
  commercialInvoiceNumber?: string;
  commercialInvoiceDate?: string; // ISO string
  totalMachineQty: number;
  numberOfAmendments?: number;
  status?: LCStatus[];
  itemDescriptions?: string;
  partialShipments?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  consigneeBankNameAddress?: string;
  notifyPartyNameAndAddress?: string;
  notifyPartyName?: string; // Previously notifyPartyContactDetails
  notifyPartyCell?: string;
  notifyPartyEmail?: string;
  lcIssueDate?: string; // ISO string
  expireDate?: string; // ISO string
  latestShipmentDate?: string; // ISO string
  purchaseOrderUrl?: string;
  finalPIUrl?: string;
  finalLcUrl?: string;
  shippingDocumentsUrl?: string;
  packingListUrl?: string;
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: string; // ISO string
  eta?: string; // ISO string
  shipmentMode?: ShipmentMode;
  shipmentTerms?: PIShipmentMode; // New field for shipment terms
  vesselOrFlightName?: string;
  vesselImoNumber?: string;
  flightNumber?: string;
  totalPackageQty?: number;
  totalNetWeight?: number;
  totalGrossWeight?: number;
  totalCbm?: number;
  partialShipmentAllowed?: PartialShipmentAllowed;
  firstPartialQty?: number;
  secondPartialQty?: number;
  thirdPartialQty?: number;
  firstPartialAmount?: number;
  secondPartialAmount?: number;
  thirdPartialAmount?: number;
  firstPartialPkgs?: number;
  firstPartialNetWeight?: number;
  firstPartialGrossWeight?: number;
  firstPartialCbm?: number;
  secondPartialPkgs?: number;
  secondPartialNetWeight?: number;
  secondPartialGrossWeight?: number;
  secondPartialCbm?: number;
  thirdPartialPkgs?: number;
  thirdPartialNetWeight?: number;
  thirdPartialGrossWeight?: number;
  thirdPartialCbm?: number;
  originalBlQty?: number;
  copyBlQty?: number;
  originalCooQty?: number;
  copyCooQty?: number;
  invoiceQty?: number;
  packingListQty?: number;
  beneficiaryCertificateQty?: number;
  brandNewCertificateQty?: number;
  beneficiaryWarrantyCertificateQty?: number;
  beneficiaryComplianceCertificateQty?: number;
  shipmentAdviceQty?: number;
  billOfExchangeQty?: number;
  certificateOfOrigin?: CertificateOfOriginCountry[];
  shippingMarks?: string;
  isFirstShipment?: boolean;
  isSecondShipment?: boolean;
  isThirdShipment?: boolean;
  firstShipmentNote?: string;
  secondShipmentNote?: string;
  thirdShipmentNote?: string;
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
}

export interface Customer {
  id?: string;
  applicantName: string;
  email: string;
  phone?: string;
  address: string;
  contactPerson?: string;
  contactPersonDesignation?: string;
  binNo?: string;
  tinNo?: string;
  newIrcNo?: string;
  oldIrcNo?: string;
  applicantBondNo?: string;
  groupName?: string;
  bidaRegNo?: string;
  createdAt?: any;
  updatedAt?: any;
}
export type CustomerDocument = Customer & { id: string, createdAt: any, updatedAt: any };
export interface ApplicantOption {
  value: string; // customerId
  label: string; // applicantName
  address?: string;
  contactPersonName?: string;
  email?: string;
  phone?: string;
}


export interface Supplier {
  id?: string;
  beneficiaryName: string;
  headOfficeAddress: string;
  bankInformation?: string;
  contactPersonName: string;
  cellNumber: string;
  emailId: string;
  website?: string;
  brandName: string;
  brandLogoUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}
export type SupplierDocument = Supplier & { id: string, createdAt: any, updatedAt: any, brandLogoUrl?: string, bankInformation?: string, headOfficeAddress: string };


export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  link?: string;
}

export const userRoles = ["Super Admin", "Admin", "User", "Service", "DemoManager", "Accounts", "Viewer", "Commercial"] as const;
export type UserRole = typeof userRoles[number];

export const NoticeBoardSettingsSchema = z.object({
  title: z.string().min(1, "Notice title cannot be empty."),
  content: z.string().min(1, "Notice content cannot be empty."),
  isEnabled: z.boolean().default(false),
  isPopupEnabled: z.boolean().default(true),
  targetRoles: z.array(z.enum(userRoles)).min(1, "At least one target role must be selected."),
});

export type NoticeBoardSettings = z.infer<typeof NoticeBoardSettingsSchema> & {
  updatedAt?: Timestamp;
};


export interface CompanyProfile {
  companyName?: string;
  address?: string;
  contactPerson?: string;
  cellNumber?: string;
  emailId?: string;
  binNumber?: string;
  tinNumber?: string;
  companyLogoUrl?: string;
  invoiceLogoUrl?: string;
  hideCompanyName?: boolean;
  updatedAt?: any;
}

export interface UserDocumentForAdmin {
  id: string; // Firestore document ID
  uid?: string; // Firebase Auth UID (if linked)
  displayName: string;
  email: string;
  contactNumber?: string;
  role: UserRole[]; // Changed to an array of roles
  photoURL?: string;
  disabled?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface LcForInvoiceDropdownOption {
  value: string; // L/C document ID
  label: string; // Commercial Invoice Number
  lcData: LCEntryDocument & {
    id: string;
    commercialInvoiceDate?: string; // ISO Date String
    partialShipmentAllowed?: PartialShipmentAllowed;
    firstPartialQty?: number; firstPartialAmount?: number; firstPartialPkgs?: number; firstPartialNetWeight?: number; firstPartialGrossWeight?: number; firstPartialCbm?: number;
    secondPartialQty?: number; secondPartialAmount?: number; secondPartialPkgs?: number; secondPartialNetWeight?: number; secondPartialGrossWeight?: number; secondPartialCbm?: number;
    thirdPartialQty?: number; thirdPartialAmount?: number; thirdPartialPkgs?: number; thirdPartialNetWeight?: number; thirdPartialGrossWeight?: number; thirdPartialCbm?: number;
    packingListUrl?: string;
    isFirstShipment?: boolean;
    isSecondShipment?: boolean;
    isThirdShipment?: boolean;
  };
}

export interface LcOption {
  value: string;
  label: string;
  issueDate?: string;
  purchaseOrderUrl?: string;
}

// --- Extract Shipping Data Types ---
export const ExtractShippingDataInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A shipping document (PI, etc.) as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractShippingDataInput = z.infer<typeof ExtractShippingDataInputSchema>;

export const ExtractShippingDataOutputSchema = z.object({
  etd: z.string().describe('The Estimated Time of Departure.'),
  eta: z.string().describe('The Estimated Time of Arrival.'),
  itemDescriptions: z.string().describe('A description of the items being shipped.'),
});
export type ExtractShippingDataOutput = z.infer<typeof ExtractShippingDataOutputSchema>;
// --- END Extract Shipping Data Types ---


// --- Proforma Invoice Types ---
export const freightChargeOptions = ["Freight Included", "Freight Excluded"] as const;
export type FreightChargeOption = typeof freightChargeOptions[number];
export const piShipmentModeOptions = ["CFR CHATTOGRAM", "CPT DHAKA", "FOB", "EXW"] as const;
export type PIShipmentMode = typeof piShipmentModeOptions[number];

export interface ProformaInvoiceLineItem {
  slNo?: string;
  modelNo: string;
  qty: number;
  purchasePrice: number;
  salesPrice: number;
  netCommissionPercentage?: number;
}

export interface ProformaInvoice {
  id?: string;
  beneficiaryId: string;
  beneficiaryName: string;
  applicantId: string;
  applicantName: string;
  piNo: string;
  piDate: Date;
  salesPersonName: string;
  connectedLcId?: string;
  connectedLcNumber?: string;
  connectedLcIssueDate?: string; // ISO string
  purchaseOrderUrl?: string;
  lineItems: ProformaInvoiceLineItem[];
  freightChargeOption: FreightChargeOption;
  freightChargeAmount?: number;
  miscellaneousExpenses?: number;
  shipmentMode?: PIShipmentMode;
  freightCharges?: number;
  otherCharges?: number;
  totalQty: number;
  totalPurchasePrice: number;
  totalSalesPrice: number; // Sum of (qty * salesPrice) from line items
  totalExtraNetCommission?: number;
  grandTotalSalesPrice: number; // (totalSalesPrice + (freight if excluded)) - miscExpenses
  grandTotalCommissionUSD: number;
  totalCommissionPercentage: number;
  createdAt?: any;
  updatedAt?: any;
}

export type ProformaInvoiceDocument = Omit<ProformaInvoice, 'piDate' | 'connectedLcIssueDate'> & {
  id: string;
  piDate: string; // ISO string
  connectedLcIssueDate?: string; // ISO string
  createdAt: any;
  updatedAt: any;
};

// --- END Proforma Invoice Types ---


// --- Installation Report Types ---
export const InstallationDetailItemSchema = z.object({
  slNo: z.string().optional(),
  machineModel: z.string().min(1, "Machine Model is required."),
  serialNo: z.string().min(1, "Machine Serial No. is required."),
  ctlBoxModel: z.string().optional(),
  ctlBoxSerial: z.string().optional(),
  installDate: z.date({ required_error: "Installation Date is required." }),
  // warrantyRemaining is calculated, not part of form data
});
export type InstallationDetailItem = z.infer<typeof InstallationDetailItemSchema>;


export const InstallationReportSchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required."),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required."),
  selectedCommercialInvoiceLcId: z.string().optional(),
  documentaryCreditNumber: z.string().optional(),
  totalMachineQtyFromLC: z.preprocess(toNumberOrUndefined, z.number().int().positive("L/C Machine Qty must be a positive integer.").optional()),
  proformaInvoiceNumber: z.string().optional(),
  invoiceDate: z.date().nullable().optional(),
  commercialInvoiceDate: z.date().nullable().optional(),
  etdDate: z.date().nullable().optional(),
  etaDate: z.date().nullable().optional(),
  packingListUrl: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : String(val).trim()),
    z.string().url({ message: "Invalid URL format for Packing List URL" }).optional()
  ),
  technicianName: z.string().min(1, "Technician Name is required."),
  reportingEngineerName: z.string().min(1, "Reporting Engineer Name is required."),
  installationDetails: z.array(InstallationDetailItemSchema)
    .min(1, "At least one installation detail item is required.")
    .refine(
      (items) => {
        const serials = items
          .map((item) => item.serialNo?.trim())
          .filter((sn): sn is string => !!sn && sn.length > 0); // Filter out empty or whitespace-only serials
        return new Set(serials).size === serials.length;
      },
      {
        message: "Each non-empty Machine Serial No. must be unique within this report.",
        path: ["installationDetails"], // Point error to the array if needed or a specific field
      }
    ),
  missingItemInfo: z.string().optional(),
  extraFoundInfo: z.string().optional(),
  missingItemsIssueResolved: z.boolean().optional().default(false),
  extraItemsIssueResolved: z.boolean().optional().default(false),
  installationNotes: z.string().optional(),
});

export type InstallationReportFormValues = z.infer<typeof InstallationReportSchema>;

export interface InstallationReportDocument {
  id: string;
  applicantId: string;
  applicantName: string;
  beneficiaryId: string;
  beneficiaryName: string;
  selectedCommercialInvoiceLcId?: string;
  commercialInvoiceNumber?: string;
  commercialInvoiceDate?: string; // ISO String
  documentaryCreditNumber?: string;
  totalMachineQtyFromLC?: number;
  proformaInvoiceNumber?: string;
  invoiceDate?: string; // ISO string
  etdDate?: string; // ISO string
  etaDate?: string; // ISO string
  packingListUrl?: string;
  technicianName: string;
  reportingEngineerName: string;
  installationDetails: Array<Omit<InstallationDetailItem, 'installDate'> & { installDate: string; }>; // installDate as ISO string
  totalInstalledQty: number;
  pendingQty?: number;
  missingItemInfo?: string;
  extraFoundInfo?: string;
  missingItemsIssueResolved: boolean;
  extraItemsIssueResolved: boolean;
  installationNotes?: string;
  createdAt: any;
  updatedAt: any;
}


// --- Demo Machine Factory Types ---
export interface DemoMachineFactory {
  id?: string;
  factoryName: string;
  factoryLocation: string;
  groupName?: string;
  contactPerson?: string;
  cellNumber?: string;
  note?: string;
}

export interface DemoMachineFactoryDocument extends DemoMachineFactory {
  id: string;
  createdAt: any;
  updatedAt: any;
}
// --- END Demo Machine Factory Types ---

// --- Demo Machine Types ---
export const demoMachineOwnerOptions = ["Own Machine", "Rent Machine", "Supplier Machine"] as const;
export type DemoMachineOwnerOption = typeof demoMachineOwnerOptions[number];

export const demoMachineStatusOptions = ["Available", "Allocated", "Maintenance Mode"] as const;
export type DemoMachineStatusOption = typeof demoMachineStatusOptions[number];

export interface DemoMachine {
  id?: string;
  machineModel: string;
  machineSerial: string;
  machineBrand: string;
  machineOwner: DemoMachineOwnerOption;
  currentStatus?: DemoMachineStatusOption;
  motorOrControlBoxModel?: string;
  controlBoxSerialNo?: string;
  machineFeatures?: string;
  note?: string;
  machineReturned?: boolean; // Added for tracking if machine returned to inventory
  imageUrl?: string; // For the machine image
}

export type DemoMachineDocument = Omit<DemoMachine, 'id'> & { id: string, createdAt: any, updatedAt: any, machineReturned?: boolean, imageUrl?: string };


// --- Demo Machine Application Types ---
const phoneRegexForValidation = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

export const AppliedMachineItemSchema = z.object({
  demoMachineId: z.string().min(1, "Machine Model is required."),
  // machineModel, machineSerial, machineBrand will be populated from selected demoMachineId
});
export type AppliedMachineItem = z.infer<typeof AppliedMachineItemSchema>;

export const demoMachineApplicationSchema = z.object({
  factoryId: z.string().min(1, "Customer Name (Factory) is required."),
  challanNo: z.string().optional(),
  deliveryPersonName: z.string().min(1, "Delivery Person Name is required."),
  deliveryDate: z.date({ required_error: "Delivery Date is required." }),
  estReturnDate: z.date({ required_error: "Est. Return Date is required." }),
  factoryInchargeName: z.string().optional(),
  inchargeCell: z.string().optional().refine(
    (value) => value === "" || value === undefined || phoneRegexForValidation.test(value),
    "Invalid phone number format"
  ),
  notes: z.string().optional(),
  machineReturned: z.boolean().optional().default(false), // Application-level returned status
  appliedMachines: z.array(AppliedMachineItemSchema).min(1, "At least one machine must be selected for the application."),
}).refine(data => {
  if (data.deliveryDate && data.estReturnDate) {
    return data.estReturnDate >= data.deliveryDate;
  }
  return true;
}, {
  message: "Est. Return Date must be on or after Delivery Date.",
  path: ["estReturnDate"],
});

export type DemoMachineApplicationFormValues = z.infer<typeof demoMachineApplicationSchema>;

export interface DemoMachineApplicationDocument {
  id: string;
  factoryId: string;
  factoryName: string; // Denormalized
  factoryLocation: string; // Denormalized
  challanNo: string;
  deliveryPersonName: string;
  deliveryDate: string; // ISO string
  estReturnDate: string; // ISO string
  demoPeriodDays: number;
  factoryInchargeName?: string;
  inchargeCell?: string;
  notes?: string;
  machineReturned?: boolean; // Overall status of the application's machines
  appliedMachines: Array<{ // Array of machines in this application
    demoMachineId: string;
    machineModel: string; // Denormalized
    machineSerial: string; // Denormalized
    machineBrand: string; // Denormalized
  }>;
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
}
// --- END Demo Machine Application Types ---
// --- END Demo Machine Types ---

// --- Item (Inventory) Types ---
export interface Item {
  id?: string;
  itemName: string;
  itemCode?: string; // SKU
  brandName?: string;
  countryOfOrigin?: string; // Added field
  supplierId?: string; // New field
  supplierName?: string; // New field (denormalized for display)
  description?: string;
  unit?: string; // e.g., pcs, kg, m
  salesPrice?: number;
  purchasePrice?: number;
  manageStock: boolean;
  currentQuantity?: number;
  location?: string;
  idealQuantity?: number;
  warningQuantity?: number;
  createdAt?: any; // Firestore ServerTimestamp
  updatedAt?: any; // Firestore ServerTimestamp
}
export type ItemDocument = Item & { id: string };

export const itemSchema = z.object({
  itemName: z.string().min(1, "Item Name is required."),
  itemCode: z.string().optional(),
  brandName: z.string().optional(),
  supplierId: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().optional(),
  salesPrice: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Sales Price must be a number." }).nonnegative("Sales Price cannot be negative.").optional()
  ),
  purchasePrice: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Purchase Price must be a number." }).nonnegative("Purchase Price cannot be negative.").optional()
  ),
  manageStock: z.boolean().default(false),
  currentQuantity: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Current Quantity must be a number." }).int().nonnegative("Current Quantity must be a non-negative integer.").optional()
  ),
  location: z.string().optional(),
  idealQuantity: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Ideal Quantity must be a number." }).int().nonnegative("Ideal Quantity must be a non-negative integer.").optional()
  ),
  warningQuantity: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Warning Quantity must be a number." }).int().nonnegative("Warning Quantity must be a non-negative integer.").optional()
  ),
}).superRefine((data, ctx) => {
  if (data.manageStock && data.currentQuantity === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Current Quantity is required when managing stock.",
        path: ["currentQuantity"],
      });
  }

  if (data.manageStock && data.warningQuantity !== undefined && data.idealQuantity !== undefined) {
    if (data.warningQuantity > data.idealQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Warning Quantity should not be greater than Ideal Quantity.",
        path: ["warningQuantity"],
      });
    }
  }
});

export type ItemFormValues = z.infer<typeof itemSchema>;

// --- Quote Item Types ---
// This schema is for items that are used in quotes/invoices and don't need stock management fields.
export const quoteItemSchema = z.object({
  modelNumber: z.string().min(1, "Model Number is required."),
  itemCode: z.string().optional(),
  brandName: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  supplierId: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().optional(),
  salesPrice: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Sales Price must be a number." }).nonnegative("Sales Price cannot be negative.").optional()
  ),
});

export type QuoteItemFormValues = z.infer<typeof quoteItemSchema>;
// --- END Item (Inventory) Types ---

// --- Quote Types ---
export const quoteTaxTypes = ["Default", "Exempt", "GST @ 5%", "VAT @ 15%"] as const;
export type QuoteTaxType = typeof quoteTaxTypes[number];

export const quoteStatusOptions = ["Draft", "Sent", "Accepted", "Rejected", "Invoiced"] as const;
export type QuoteStatus = typeof quoteStatusOptions[number];

export const QuoteLineItemSchema = z.object({
  itemId: z.string().min(1, "Item selection is required."),
  itemCode: z.string().optional(),
  description: z.string().optional(),
  qty: z.string().min(1, "Qty is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Qty must be > 0" }),
  unitPrice: z.string().min(1, "Unit Price is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Unit Price must be non-negative" }),
  discountPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Discount must be 0-100 or blank" }),
  taxPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Tax must be 0-100 or blank" }),
  total: z.string(), // Calculated, not for direct input
});
export type QuoteLineItemFormValues = z.infer<typeof QuoteLineItemSchema>;

export const QuoteSchema = z.object({
  customerId: z.string().min(1, "Customer is required."),
  billingAddress: z.string().min(1, "Billing Address is required."),
  shippingAddress: z.string().min(1, "Shipping Address is required."),
  quoteDate: z.date({ required_error: "Quote Date is required." }),
  salesperson: z.string().min(1, "Salesperson is required."),
  subject: z.string().optional(),
  lineItems: z.array(QuoteLineItemSchema).min(1, "At least one line item is required."),
  taxType: z.enum(quoteTaxTypes).default("Default"),
  status: z.enum(quoteStatusOptions).optional(),
  globalDiscount: z.string().optional(), // For future use
  globalTaxRate: z.string().optional(), // For future use
  comments: z.string().optional(),
  privateComments: z.string().optional(),
  // Calculated fields, not part of the form for direct input but needed for schema
  subtotal: z.number().optional(),
  totalDiscountAmount: z.number().optional(),
  totalTaxAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  // Column visibility
  showItemCodeColumn: z.boolean().optional().default(true),
  showDiscountColumn: z.boolean().optional().default(true),
  showTaxColumn: z.boolean().optional().default(true),
  convertedToInvoiceId: z.string().optional(),
  shipmentMode: z.enum(piShipmentModeOptions).optional(),
  freightCharges: z.preprocess(toNumberOrUndefined, z.number().nonnegative().optional()),
});
export type QuoteFormValues = z.infer<typeof QuoteSchema>;

export interface QuoteLineItemDocument {
  itemId: string;
  itemName: string; // Denormalized
  itemCode?: string; // Denormalized
  description?: string;
  qty: number;
  unitPrice: number;
  discountPercentage?: number;
  taxPercentage?: number;
  total: number;
}

export interface QuoteDocument {
  id: string; // This will store the formatted QSS{Year}-{Serial}
  customerId: string;
  customerName: string;
  billingAddress: string;
  shippingAddress: string;
  quoteDate: string; // ISO string
  salesperson: string;
  subject?: string;
  lineItems: QuoteLineItemDocument[];
  taxType: QuoteTaxType;
  comments?: string;
  privateComments?: string;
  subtotal: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  status: QuoteStatus;
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
  showItemCodeColumn?: boolean;
  showDiscountColumn?: boolean;
  showTaxColumn?: boolean;
  convertedToInvoiceId?: string;
  shipmentMode?: PIShipmentMode;
  freightCharges?: number;
}
// --- END Quote Types ---

// --- Invoice Types ---
export const invoiceStatusOptions = ["Draft", "Sent", "Paid", "Partial", "Overdue", "Void", "Cancelled", "Refunded"] as const;
export type InvoiceStatus = typeof invoiceStatusOptions[number];

export const InvoiceLineItemSchema = z.object({ // Same as QuoteLineItemSchema for now
  itemId: z.string().min(1, "Item selection is required."),
  itemCode: z.string().optional(),
  description: z.string().optional(),
  qty: z.string().min(1, "Qty is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Qty must be > 0" }),
  unitPrice: z.string().min(1, "Unit Price is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Unit Price must be non-negative" }),
  discountPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Discount must be 0-100 or blank" }),
  taxPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Tax must be 0-100 or blank" }),
  total: z.string(),
});
export type InvoiceLineItemFormValues = z.infer<typeof InvoiceLineItemSchema>;

export const InvoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required."),
  billingAddress: z.string().min(1, "Billing Address is required."),
  shippingAddress: z.string().min(1, "Shipping Address is required."),
  invoiceDate: z.date({ required_error: "Invoice Date is required." }),
  dueDate: z.date().optional(),
  paymentTerms: z.string().optional(),
  salesperson: z.string().min(1, "Salesperson is required."),
  subject: z.string().optional(),
  lineItems: z.array(InvoiceLineItemSchema).min(1, "At least one line item is required."),
  taxType: z.enum(quoteTaxTypes).default("Default"),
  comments: z.string().optional(),
  privateComments: z.string().optional(),
  subtotal: z.number().optional(),
  totalDiscountAmount: z.number().optional(),
  totalTaxAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  status: z.enum(invoiceStatusOptions).optional(),
  amountPaid: z.number().optional(),
  showItemCodeColumn: z.boolean().optional().default(true),
  showDiscountColumn: z.boolean().optional().default(true),
  showTaxColumn: z.boolean().optional().default(true),
  convertedFromQuoteId: z.string().optional(),
  shipmentMode: z.enum(piShipmentModeOptions).optional(),
  freightCharges: z.preprocess(toNumberOrUndefined, z.number().nonnegative().optional()),
  otherCharges: z.preprocess(toNumberOrUndefined, z.number().nonnegative().optional()),
});
export type InvoiceFormValues = z.infer<typeof InvoiceSchema>;

export interface InvoiceLineItemDocument {
  itemId: string;
  itemName: string;
  itemCode?: string;
  description?: string;
  qty: number;
  unitPrice: number;
  discountPercentage?: number;
  taxPercentage?: number;
  total: number;
}

export interface InvoiceDocument {
  id: string;
  customerId: string;
  customerName: string;
  billingAddress: string;
  shippingAddress: string;
  invoiceDate: string; // ISO string
  dueDate?: string; // ISO string
  paymentTerms?: string;
  salesperson: string;
  subject?: string;
  lineItems: InvoiceLineItemDocument[];
  taxType: QuoteTaxType;
  comments?: string;
  privateComments?: string;
  packingCharge?: number;
  handlingCharge?: number;
  freightCharges?: number;
  otherCharges?: number;
  subtotal: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  status?: InvoiceStatus;
  amountPaid?: number;
  refundReason?: string;
  refundDate?: string; // ISO string
  createdAt: any;
  updatedAt: any;
  showItemCodeColumn?: boolean;
  showDiscountColumn?: boolean;
  showTaxColumn?: boolean;
  convertedFromQuoteId?: string;
  shipmentMode?: PIShipmentMode;
}
// --- END Invoice Types ---

// --- Order Types ---
export const orderStatusOptions = ["Pending", "Processing", "Shipped", "Delivered", "Completed", "Cancelled", "On Hold"] as const;
export type OrderStatus = typeof orderStatusOptions[number];

export const OrderLineItemSchema = z.object({ // Same as Quote/Invoice LineItemSchema for now
  itemId: z.string().min(1, "Item selection is required."),
  itemCode: z.string().optional(),
  description: z.string().optional(),
  qty: z.string().min(1, "Qty is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Qty must be > 0" }),
  unitPrice: z.string().min(1, "Unit Price is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Unit Price must be non-negative" }),
  discountPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Discount must be 0-100 or blank" }),
  taxPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Tax must be 0-100 or blank" }),
  total: z.string(),
});
export type OrderLineItemFormValues = z.infer<typeof OrderLineItemSchema>;

export const OrderSchema = z.object({
  beneficiaryId: z.string().min(1, "Beneficiary is required."), // Changed from customerId
  billingAddress: z.string().min(1, "Billing Address is required."),
  shippingAddress: z.string().min(1, "Shipping Address is required."),
  orderDate: z.date({ required_error: "Order Date is required." }),
  salesperson: z.string().min(1, "Salesperson is required."),
  lineItems: z.array(OrderLineItemSchema).min(1, "At least one line item is required."),
  taxType: z.enum(quoteTaxTypes).default("Default"),
  comments: z.string().optional(),
  privateComments: z.string().optional(),
  subtotal: z.number().optional(),
  totalDiscountAmount: z.number().optional(),
  totalTaxAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  showItemCodeColumn: z.boolean().optional().default(true),
  showDiscountColumn: z.boolean().optional().default(true),
  showTaxColumn: z.boolean().optional().default(true),
  terms: z.string().optional(),
  shipVia: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  shipmentMode: z.enum(piShipmentModeOptions).optional(),
  freightCharges: z.preprocess(toNumberOrUndefined, z.number().nonnegative().optional()),
  otherCharges: z.preprocess(toNumberOrUndefined, z.number().nonnegative().optional()),
});
export type OrderFormValues = z.infer<typeof OrderSchema>;

export interface OrderLineItemDocument { // Same as Quote/Invoice LineItemDocument
  itemId: string;
  itemName: string;
  itemCode?: string;
  description?: string;
  qty: number;
  unitPrice: number;
  discountPercentage?: number;
  taxPercentage?: number;
  total: number;
}

export interface OrderDocument {
  id: string; // This will store the formatted ORD{Year}-{Serial}
  beneficiaryId: string; // Changed from customerId
  beneficiaryName: string; // Changed from customerName
  billingAddress: string;
  shippingAddress: string;
  orderDate: string; // ISO string
  salesperson: string;
  lineItems: OrderLineItemDocument[];
  taxType: QuoteTaxType;
  comments?: string;
  privateComments?: string;
  subtotal: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt: any;
  updatedAt: any;
  showItemCodeColumn?: boolean;
  showDiscountColumn?: boolean;
  showTaxColumn?: boolean;
  terms?: string;
  shipVia?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  shipmentMode?: PIShipmentMode;
  freightCharges?: number;
  otherCharges?: number;
}
// --- END Order Types ---

// --- Sale Types (for sales_invoice collection) ---
export const saleStatusOptions = ["Draft", "Cancelled", "Refunded", "Sent", "Partial", "Paid", "Overdue", "Void"] as const;
export type SaleStatus = (typeof saleStatusOptions)[number];

export const SaleLineItemSchema = z.object({
  itemId: z.string().min(1, "Item selection is required."),
  itemCode: z.string().optional(),
  description: z.string().optional(),
  qty: z.preprocess(
    (val) => (String(val).trim() === "" ? 0 : Number(String(val).trim())),
    z.number().positive("Qty must be > 0")
  ),
  unitPrice: z.preprocess(
    (val) => (String(val).trim() === "" ? 0 : Number(String(val).trim())),
    z.number().nonnegative("Unit Price must be non-negative")
  ),
  discountPercentage: z.preprocess(
    (val) => (String(val).trim() === "" ? 0 : Number(String(val).trim())),
    z.number().min(0).max(100, "Discount must be between 0-100").optional()
  ),
  taxPercentage: z.preprocess(
    (val) => (String(val).trim() === "" ? 0 : Number(String(val).trim())),
    z.number().min(0).max(100, "Tax must be between 0-100").optional()
  ),
  total: z.string(), // This is for display and will be recalculated.
});
export type SaleLineItemFormValues = z.infer<typeof SaleLineItemSchema>;

export const SaleSchema = InvoiceSchema.extend({
    status: z.enum(saleStatusOptions).optional(),
});
export type SaleFormValues = z.infer<typeof SaleSchema>;

export type SaleDocument = Omit<InvoiceDocument, 'status'> & {
    status?: SaleStatus;
};
// --- END Sale Types ---


// --- Petty Cash Types ---
export interface PettyCashAccount {
  id?: string;
  name: string;
  balance: number;
  createdAt?: any;
  updatedAt?: any;
}
export type PettyCashAccountDocument = PettyCashAccount & { id: string };

export interface PettyCashCategory {
  id?: string;
  name: string;
  createdAt?: any;
}
export type PettyCashCategoryDocument = PettyCashCategory & { id: string };

export const transactionTypes = ["Debit", "Credit"] as const;
export type TransactionType = typeof transactionTypes[number];

export const chequeTypeOptions = ["Cash", "Account Pay"] as const;
export type ChequeType = typeof chequeTypeOptions[number];

export interface PettyCashTransaction {
  id?: string;
  transactionDate: string; // ISO string
  accountId: string; 
  accountName: string; // Denormalized name
  type: TransactionType;
  payeeName?: string;
  categoryIds?: string[];
  categoryNames?: string[];
  purpose?: string;
  description?: string;
  amount: number;
  chequeType?: ChequeType;
  chequeNumber?: string;
  connectedSaleId?: string;
  createdBy: string;
  createdAt?: any;
}
export type PettyCashTransactionDocument = PettyCashTransaction & { id: string };

export const PettyCashAccountSchema = z.object({
  name: z.string().min(2, "Account name must be at least 2 characters long."),
  balance: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Initial balance must be a number." }).min(0, "Balance cannot be negative.")
  ),
});
export type PettyCashAccountFormValues = z.infer<typeof PettyCashAccountSchema>;

export const PettyCashCategorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters long."),
});
export type PettyCashCategoryFormValues = z.infer<typeof PettyCashCategorySchema>;

export const PettyCashTransactionSchema = z.object({
  transactionDate: z.date({ required_error: "Transaction date is required." }),
  accountId: z.string().min(1, "A source account is required."),
  type: z.enum(transactionTypes, { required_error: "Transaction Type is required." }),
  payeeName: z.string().min(1, "Payee name is required."),
  categoryIds: z.array(z.string()).min(1, "At least one category is required."),
  purpose: z.string().optional(),
  description: z.string().optional(),
  amount: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Amount must be a number." }).positive("Amount must be a positive number.")
  ),
  chequeType: z.enum(chequeTypeOptions).optional(),
  chequeNumber: z.string().optional(),
  connectedSaleId: z.string().optional(),
});
export type PettyCashTransactionFormValues = z.infer<typeof PettyCashTransactionSchema>;
// --- END Petty Cash Types ---


// --- Delivery Challan Types ---
export const DeliveryChallanLineItemSchema = z.object({
  itemId: z.string().optional(), // This can be optional if not linking to specific inventory items
  description: z.string().min(1, "Description is required."),
  qty: z.string().min(1, "Qty is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Qty must be > 0" }),
});
export type DeliveryChallanLineItemFormValues = z.infer<typeof DeliveryChallanLineItemSchema>;

export const DeliveryChallanSchema = z.object({
  customerId: z.string().min(1, "Customer is required."),
  billingAddress: z.string().min(1, "Billing Address is required."),
  shippingAddress: z.string().min(1, "Shipping Address is required."),
  challanDate: z.date({ required_error: "Challan Date is required." }),
  linkedInvoiceId: z.string().optional(),
  deliveryPerson: z.string().min(1, "Delivery Person is required."),
  vehicleNo: z.string().optional(),
  lineItems: z.array(DeliveryChallanLineItemSchema).min(1, "At least one item is required."),
});
export type DeliveryChallanFormValues = z.infer<typeof DeliveryChallanSchema>;

export interface DeliveryChallanLineItemDocument {
  itemId?: string;
  description: string;
  qty: number;
}

export interface DeliveryChallanDocument {
  id: string; // Auto-generated ID like DCN{Year}-{Serial}
  customerId: string;
  customerName: string; // Denormalized
  billingAddress: string;
  shippingAddress: string;
  challanDate: string; // ISO string
  linkedInvoiceId?: string;
  deliveryPerson: string;
  vehicleNo?: string;
  lineItems: DeliveryChallanLineItemDocument[];
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
}
// --- END Delivery Challan Types ---

// --- Demo Machine Challan Types ---
export const DemoChallanLineItemSchema = z.object({
  demoMachineId: z.string().min(1, "Machine Model is required."),
  description: z.string().min(1, "Description is required."),
  qty: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Qty must be > 0" }),
});
export type DemoChallanLineItemFormValues = z.infer<typeof DemoChallanLineItemSchema>;

export const DemoChallanSchema = z.object({
  factoryId: z.string().min(1, "Factory is required."),
  deliveryAddress: z.string().min(1, "Delivery Address is required."),
  challanDate: z.date({ required_error: "Challan Date is required." }),
  linkedApplicationId: z.string().optional(),
  deliveryPerson: z.string().min(1, "Delivery Person is required."),
  vehicleNo: z.string().optional(),
  lineItems: z.array(DemoChallanLineItemSchema).min(1, "At least one item is required."),
});
export type DemoChallanFormValues = z.infer<typeof DemoChallanSchema>;

export interface DemoChallanLineItemDocument {
  demoMachineId: string;
  description: string;
  qty: number;
}

export interface DemoChallanDocument {
  id: string; // Auto-generated ID like DMCN{Year}-{Serial}
  factoryId: string;
  factoryName: string; // Denormalized
  deliveryAddress: string;
  challanDate: string; // ISO string
  linkedApplicationId?: string;
  deliveryPerson: string;
  vehicleNo?: string;
  lineItems: DemoChallanLineItemDocument[];
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
}
// --- END Demo Machine Challan Types ---
