
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, runTransaction, updateDoc } from 'firebase/firestore';
import type { OrderDocument, OrderFormValues, SupplierDocument, ItemDocument as ItemDoc, QuoteTaxType, OrderLineItemFormValues, ShipmentTerms } from '@/types';
import { OrderLineItemSchema, OrderSchema, quoteTaxTypes, orderStatusOptions, shipmentTermsOptions } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, PlusCircle, Trash2, Building, FileText, CalendarDays, DollarSign, Percent, Info, Save, Printer, Mail, X, Edit, Tag, ShoppingCart, Hash, Columns, Ship } from 'lucide-react';
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
import Link from 'next/link';


const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_BENEFICIARY_VALUE = "__ORDER_EDIT_BENEFICIARY__";
const PLACEHOLDER_ITEM_VALUE_PREFIX = "__ORDER_EDIT_ITEM__";

interface ItemOption extends ComboboxOption {
  description?: string;
  salesPrice?: number;
  itemCode?: string;
}

interface BeneficiaryOption extends ComboboxOption {
  address?: string;
}

interface EditPurchaseOrderFormProps {
  initialData: OrderDocument;
  orderId: string;
}

export function EditInventoryOrderForm({ initialData, orderId }: EditPurchaseOrderFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<BeneficiaryOption[]>([]);
  const [itemOptions, setItemOptions] = React.useState<ItemOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(OrderSchema),
  });

  const { control, setValue, watch, getValues, reset, handleSubmit } = form;

  const showItemCodeColumn = watch("showItemCodeColumn");
  const showDiscountColumn = watch("showDiscountColumn");
  const showTaxColumn = watch("showTaxColumn");
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  React.useEffect(() => {
    const fetchOptionsAndSetData = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [suppliersSnap, itemsSnap] = await Promise.all([
          getDocs(collection(firestore, "suppliers")),
          getDocs(collection(firestore, "quote_items"))
        ]);

        const fetchedBeneficiaries = suppliersSnap.docs.map(docSnap => {
          const data = docSnap.data() as SupplierDocument;
          return { value: docSnap.id, label: data.beneficiaryName || 'Unnamed Beneficiary', address: data.headOfficeAddress };
        });
        setBeneficiaryOptions(fetchedBeneficiaries);

        const fetchedItems = itemsSnap.docs.map(docSnap => {
          const data = docSnap.data() as ItemDoc;
          return {
            value: docSnap.id,
            label: `${data.itemName}${data.itemCode ? ` (${data.itemCode})` : ''}`,
            description: data.description,
            salesPrice: data.purchasePrice,
            itemCode: data.itemCode,
          };
        });
        setItemOptions(fetchedItems);

        if (initialData) {
          reset({
            beneficiaryId: initialData.beneficiaryId || '',
            billingAddress: initialData.billingAddress || '',
            shippingAddress: initialData.shippingAddress || '',
            orderDate: initialData.orderDate && isValid(parseISO(initialData.orderDate)) ? parseISO(initialData.orderDate) : new Date(),
            salesperson: initialData.salesperson || '',
            lineItems: initialData.lineItems.map(item => ({
              itemId: item.itemId || '',
              itemCode: item.itemCode || '',
              description: item.description || '',
              qty: item.qty?.toString() || '1',
              unitPrice: item.unitPrice?.toString() || '0',
              discountPercentage: item.discountPercentage?.toString() || '0',
              taxPercentage: item.taxPercentage?.toString() || '0',
              total: item.total?.toFixed(2) || '0.00',
            })),
            taxType: initialData.taxType || 'Default',
            comments: initialData.comments || '',
            privateComments: initialData.privateComments || '',
            showItemCodeColumn: initialData.showItemCodeColumn ?? true,
            showDiscountColumn: initialData.showDiscountColumn ?? true,
            showTaxColumn: initialData.showTaxColumn ?? true,
            terms: initialData.terms || '',
            shipVia: initialData.shipVia || '',
            portOfLoading: initialData.portOfLoading || '',
            portOfDischarge: initialData.portOfDischarge || '',
            shipmentMode: initialData.shipmentMode,
            freightCharges: initialData.freightCharges,
            otherCharges: initialData.otherCharges,
          });
        }
      } catch (error) {
        Swal.fire("Error", "Could not load supporting data. Please try again.", "error");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchOptionsAndSetData();
  }, [initialData, reset]);
  
  const watchedBeneficiaryId = watch("beneficiaryId");
  const watchedLineItems = watch("lineItems");
  const watchedFreightCharges = watch("freightCharges");
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
        
        const itemTotalBeforeDiscount = qty * unitPrice;
        
        if (qty > 0 && unitPrice >= 0) {
          const lineDiscountAmount = itemTotalBeforeDiscount * (discountP / 100);
          const itemTotalAfterDiscount = itemTotalBeforeDiscount - lineDiscountAmount;
          const taxAmountVal = itemTotalAfterDiscount * (taxP / 100);
          
          currentSubtotal += itemTotalBeforeDiscount;
          currentTotalDiscount += lineDiscountAmount;
          currentTotalTax += taxAmountVal;
        }
        
        const displayLineTotal = isNaN(itemTotalBeforeDiscount) ? 0 : itemTotalBeforeDiscount;
        const currentFormLineTotal = getValues(`lineItems.${index}.total`);
        if (String(displayLineTotal.toFixed(2)) !== currentFormLineTotal) {
          setValue(`lineItems.${index}.total`, displayLineTotal.toFixed(2));
        }
      });
    }
    
    const freight = Number(watchedFreightCharges || 0);
    const other = Number(watchedOtherCharges || 0);
    const additionalCharges = freight + other;

    const currentGrandTotal = currentSubtotal - currentTotalDiscount + currentTotalTax + additionalCharges;
    
    return {
      subtotal: currentSubtotal,
      totalDiscountAmount: currentTotalDiscount,
      totalTaxAmount: currentTotalTax,
      grandTotal: currentGrandTotal,
    };
  }, [watchedLineItems, showDiscountColumn, showTaxColumn, getValues, setValue, watchedFreightCharges, watchedOtherCharges]);

  React.useEffect(() => {
    if (watchedBeneficiaryId) {
      const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === watchedBeneficiaryId);
      if (selectedBeneficiary) {
        // Only set billing address. Let initialData handle shipping address.
        setValue("billingAddress", selectedBeneficiary.address || "");
        if(!getValues("shippingAddress")) { // Only set shipping if it's empty
          setValue("shippingAddress", selectedBeneficiary.address || "");
        }
      }
    }
  }, [watchedBeneficiaryId, beneficiaryOptions, setValue, getValues]);

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
  
  const handleViewPdf = () => {
    window.open(`/dashboard/inventory/inventory-orders/preview/${orderId}`, '_blank');
  };

  async function onSubmit(data: OrderFormValues) {
    if (!orderId) {
      Swal.fire("Error", "Order ID is missing. Cannot update.", "error");
      return;
    }
    setIsSubmitting(true);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === data.beneficiaryId);

    const processedLineItems = data.lineItems.map(item => {
      const qty = parseFloat(String(item.qty || '0'));
      const unitPriceStr = String(item.unitPrice || '0');
      const finalUnitPrice = parseFloat(unitPriceStr);
      const discountPercentageStr = String(item.discountPercentage || '0');
      const finalDiscountPercentage = parseFloat(discountPercentageStr);
      const taxPercentageStr = String(item.taxPercentage || '0');
      const finalTaxPercentage = parseFloat(taxPercentageStr);

      const itemTotalBeforeDiscount = qty * finalUnitPrice;
      
      const itemDetailsFromOptions = itemOptions.find(opt => opt.value === item.itemId);
      const lineItemData: Record<string, any> = {
        itemId: item.itemId,
        itemName: itemDetailsFromOptions?.label.split(' (')[0] || 'N/A',
        itemCode: itemDetailsFromOptions?.itemCode,
        description: item.description || '',
        qty,
        unitPrice: finalUnitPrice,
        discountPercentage: finalDiscountPercentage,
        taxPercentage: finalTaxPercentage,
        total: itemTotalBeforeDiscount,
      };
      // Clean up undefined/empty fields within the line item
      Object.keys(lineItemData).forEach(key => {
        const value = lineItemData[key];
        if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
          delete lineItemData[key];
        }
      });
      return lineItemData;
    });
    
    const dataToUpdate: Record<string, any> = {
      beneficiaryId: data.beneficiaryId,
      beneficiaryName: selectedBeneficiary?.label || initialData.beneficiaryName,
      billingAddress: data.billingAddress,
      shippingAddress: data.shippingAddress,
      orderDate: format(data.orderDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      salesperson: data.salesperson,
      lineItems: processedLineItems,
      taxType: data.taxType,
      comments: data.comments,
      privateComments: data.privateComments,
      subtotal: subtotal,
      totalDiscountAmount: totalDiscountAmount,
      totalTaxAmount: totalTaxAmount,
      totalAmount: grandTotal,
      status: initialData.status,
      showItemCodeColumn: data.showItemCodeColumn,
      showDiscountColumn: data.showDiscountColumn,
      showTaxColumn: data.showTaxColumn,
      terms: data.terms,
      shipVia: data.shipVia,
      portOfLoading: data.portOfLoading,
      portOfDischarge: data.portOfDischarge,
      shipmentMode: data.shipmentMode,
      freightCharges: data.freightCharges,
      otherCharges: data.otherCharges,
      updatedAt: serverTimestamp(),
    };

    const cleanedDataToUpdate: { [key: string]: any } = {};
    for (const key in dataToUpdate) {
        const value = dataToUpdate[key];
        if (value !== undefined && value !== null && value !== '') {
            cleanedDataToUpdate[key] = value;
        }
    }


    try {
      const orderDocRef = doc(firestore, "inventory_orders", orderId);
      await updateDoc(orderDocRef, cleanedDataToUpdate);
      Swal.fire("Order Updated!", `Order ID: ${orderId} successfully updated.`, "success");
    } catch (error: any) {
      Swal.fire("Update Failed", `Failed to update order: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const grandTotalLabel = `${watchedShipmentMode} Total (USD):`;

  if (isLoadingDropdowns) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading...</p></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <h3 className={cn(sectionHeadingClass)}><Building className="mr-2 h-5 w-5 text-primary" />Beneficiary & Delivery</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <FormField
              control={control}
              name="beneficiaryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beneficiary*</FormLabel>
                  <Combobox
                    options={beneficiaryOptions}
                    value={field.value || PLACEHOLDER_BENEFICIARY_VALUE}
                    onValueChange={(val) => field.onChange(val === PLACEHOLDER_BENEFICIARY_VALUE ? '' : val)}
                    placeholder="Search Beneficiary..."
                    selectPlaceholder="Select Beneficiary"
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
                  <FormLabel>Supplier:</FormLabel>
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
        
        <h3 className={cn(sectionHeadingClass)}><CalendarDays className="mr-2 h-5 w-5 text-primary" />Order Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <FormItem><FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Order Number</FormLabel><Input value={orderId} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" /></FormItem>
            <FormField control={control} name="orderDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Order Date*</FormLabel><DatePickerField field={field} placeholder="Select order date" /><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="taxType" render={({ field }) => (<FormItem><FormLabel>Tax</FormLabel><Select onValueChange={field.onChange} value={field.value ?? 'Default'}><FormControl><SelectTrigger><SelectValue placeholder="Select tax type" /></SelectTrigger></FormControl><SelectContent>{quoteTaxTypes.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <FormField control={control} name="terms" render={({ field }) => (<FormItem><FormLabel>Terms</FormLabel><FormControl><Input placeholder="e.g., FOB, CIF" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
          <FormField control={control} name="shipVia" render={({ field }) => (<FormItem><FormLabel>Ship Via</FormLabel><FormControl><Input placeholder="e.g., Sea, Air" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
          <FormField control={control} name="portOfLoading" render={({ field }) => (<FormItem><FormLabel>Port of Loading</FormLabel><FormControl><Input placeholder="e.g., Shanghai" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
          <FormField control={control} name="portOfDischarge" render={({ field }) => (<FormItem><FormLabel>Port of Discharge</FormLabel><FormControl><Input placeholder="e.g., Chattogram" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
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
          <FormField control={control} name="freightCharges" render={({ field }) => (<FormItem><FormLabel>Freight Charges:</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        
        <Separator className="my-6" />
        <div className="flex justify-between items-center">
            <h3 className={cn(sectionHeadingClass, "mb-0 border-b-0")}>
                <ShoppingCart className="mr-2 h-5 w-5 text-primary" /> Line Items
            </h3>
            <div className="flex items-center gap-2">
                <Link href="/dashboard/quotes/items/add" target="_blank">
                    <Button variant="outline" size="sm" type="button">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New Quote Item
                    </Button>
                </Link>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Columns className="mr-2 h-4 w-4" />Columns</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end"><DropdownMenuLabel>Toggle Columns</DropdownMenuLabel><DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem checked={showItemCodeColumn} onCheckedChange={(checked) => setValue('showItemCodeColumn', !!checked)}>Item Code</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={showDiscountColumn} onCheckedChange={(checked) => setValue('showDiscountColumn', !!checked)}>Discount %</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={showTaxColumn} onCheckedChange={(checked) => setValue('showTaxColumn', !!checked)}>Tax %</DropdownMenuCheckboxItem>
                    </DropdownMenuContent></DropdownMenu>
            </div>
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
                  <TableCell><FormField control={control} name={`lineItems.${index}.itemId`} render={({ field: itemField }) => (<Combobox options={itemOptions} value={itemField.value || PLACEHOLDER_ITEM_VALUE_PREFIX + index} onValueChange={(itemId) => { itemField.onChange(itemId === (PLACEHOLDER_ITEM_VALUE_PREFIX + index) ? '' : itemId); handleItemSelect(itemId, index);}} placeholder="Search Item..." selectPlaceholder="Select Item" emptyStateMessage="No item found." className="h-9"/>)}/><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.itemId?.message}</FormMessage></TableCell>
                  {showItemCodeColumn && (<TableCell><FormField control={control} name={`lineItems.${index}.itemCode`} render={({ field: itemField }) => (<Input placeholder="Code" {...itemField} value={itemField.value ?? ''} className="h-9 bg-muted/50" readOnly disabled />)}/></TableCell>)}
                  <TableCell><FormField control={control} name={`lineItems.${index}.description`} render={({ field: itemField }) => (<Textarea placeholder="Item description" {...itemField} rows={1} className="h-9 min-h-[2.25rem] resize-y"/>)} /></TableCell>
                  <TableCell><FormField control={control} name={`lineItems.${index}.unitPrice`} render={({ field: itemField }) => (<Input type="text" placeholder="0.00" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.unitPrice?.message}</FormMessage></TableCell>
                  {showDiscountColumn && <TableCell><FormField control={control} name={`lineItems.${index}.discountPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.discountPercentage?.message}</FormMessage></TableCell>}
                  {showTaxColumn && <TableCell><FormField control={control} name={`lineItems.${index}.taxPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.taxPercentage?.message}</FormMessage></TableCell>}
                  <TableCell className="text-right font-medium">{`$${(parseFloat(watch(`lineItems.${index}.qty`) || '0') * parseFloat(watch(`lineItems.${index}.unitPrice`) || '0')).toFixed(2)}`}</TableCell>
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
            <FormField control={control} name="privateComments" render={({ field }) => (<FormItem><FormLabel>Private Comments (Internal)</FormLabel><FormControl><Textarea placeholder="Internal notes, not visible to customer" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)}/>
        </div>
        <div className="flex justify-end space-y-2 mt-6">
            <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium text-foreground">{subtotal.toFixed(2)}</span></div>
                {showDiscountColumn && <div className="flex justify-between"><span className="text-muted-foreground">Total Discount:</span><span className="font-medium text-foreground">(-) {totalDiscountAmount.toFixed(2)}</span></div>}
                {showTaxColumn && <div className="flex justify-between"><span className="text-muted-foreground">Total Tax:</span><span className="font-medium text-foreground">(+) {totalTaxAmount.toFixed(2)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Freight Charges:</span><span className="font-medium text-foreground">(+) {(Number(watchedFreightCharges||0) + Number(watchedOtherCharges||0)).toFixed(2)}</span></div>
                <Separator />
                <div className="flex justify-between text-base font-bold"><span className="text-primary">{grandTotalLabel}</span><span className="text-primary">{grandTotal.toFixed(2)}</span></div>
            </div>
        </div>
        <Separator />
        
        <div className="flex flex-wrap gap-2 justify-end">
             <Button type="button" variant="outline" onClick={handleViewPdf}>
                <Printer className="mr-2 h-4 w-4" />
                View PDF
            </Button>
            <Button type="button" variant="outline" onClick={() => reset(initialData ? {
                ...initialData,
                orderDate: initialData.orderDate ? parseISO(initialData.orderDate) : new Date(),
                lineItems: initialData.lineItems.map(item => ({
                  ...item,
                  itemCode: item.itemCode || '',
                  qty: item.qty.toString(),
                  unitPrice: item.unitPrice.toString(),
                  discountPercentage: item.discountPercentage?.toString() || '0',
                  taxPercentage: item.taxPercentage?.toString() || '0',
                  total: item.total.toFixed(2),
                })),
                showItemCodeColumn: initialData.showItemCodeColumn,
                showDiscountColumn: initialData.showDiscountColumn,
                showTaxColumn: initialData.showTaxColumn,
              } : {} )}>
                <X className="mr-2 h-4 w-4" />Reset
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || isLoadingDropdowns}>
              {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Changes...</>) : (<><Save className="mr-2 h-4 w-4" />Save Changes</>)}
            </Button>
        </div>
      </form>
    </Form>
  );
}
