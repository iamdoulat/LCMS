
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, runTransaction, setDoc } from 'firebase/firestore';
import type { OrderDocument, OrderFormValues, SupplierDocument, ItemDocument as ItemDoc, QuoteTaxType, OrderLineItemFormValues, PIShipmentMode } from '@/types';
import { OrderLineItemSchema, OrderSchema, quoteTaxTypes, orderStatusOptions, piShipmentModeOptions } from '@/types';
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

const PLACEHOLDER_BENEFICIARY_VALUE = "__ORDER_BENEFICIARY_PLACEHOLDER__";
const PLACEHOLDER_ITEM_VALUE = "__ORDER_ITEM_PLACEHOLDER__";

interface ItemOption extends ComboboxOption {
  description?: string;
  salesPrice?: number;
  itemCode?: string;
}

interface BeneficiaryOption extends ComboboxOption {
  address?: string;
}


export function CreatePurchaseOrderForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<BeneficiaryOption[]>([]);
  const [itemOptions, setItemOptions] = React.useState<ItemOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const [generatedOrderId, setGeneratedOrderId] = React.useState<string | null>(null);

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(OrderSchema),
    defaultValues: {
      beneficiaryId: '',
      billingAddress: '',
      shippingAddress: '',
      orderDate: new Date(),
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
      showItemCodeColumn: true,
      showDiscountColumn: true,
      showTaxColumn: true,
      terms: '',
      shipVia: '',
      portOfLoading: '',
      portOfDischarge: '',
      shipmentMode: piShipmentModeOptions[0],
      freightCharges: undefined,
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

  const watchedBeneficiaryId = watch("beneficiaryId");
  const watchedLineItems = watch("lineItems");
  const watchedTaxType = watch("taxType");
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
    const fetchOptions = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [suppliersSnap, itemsSnap] = await Promise.all([
          getDocs(collection(firestore, "suppliers")),
          getDocs(collection(firestore, "quote_items"))
        ]);

        setBeneficiaryOptions(
          suppliersSnap.docs.map(doc => {
            const data = doc.data() as SupplierDocument;
            return { value: doc.id, label: data.beneficiaryName || 'Unnamed Beneficiary', address: data.headOfficeAddress };
          })
        );

        setItemOptions(
          itemsSnap.docs.map(doc => {
            const data = doc.data() as ItemDoc;
            return {
              value: doc.id,
              label: `${data.itemName}${data.itemCode ? ` (${data.itemCode})` : ''}`,
              description: data.description,
              salesPrice: data.purchasePrice, // Use purchase price for purchase orders
              itemCode: data.itemCode,
            };
          })
        );

      } catch (error) {
        console.error("Error fetching dropdown options for Purchase Order form: ", error);
        Swal.fire("Error", "Could not load beneficiary or item data. Please try again.", "error");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchOptions();
  }, []);

  React.useEffect(() => {
    if (watchedBeneficiaryId) {
      const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === watchedBeneficiaryId);
      if (selectedBeneficiary) {
        setValue("billingAddress", selectedBeneficiary.address || "");
        setValue("shippingAddress", selectedBeneficiary.address || "");
      }
    } else {
      setValue("billingAddress", "");
      setValue("shippingAddress", "");
    }
  }, [watchedBeneficiaryId, beneficiaryOptions, setValue]);

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

  const saveOrderLogic = async (data: OrderFormValues): Promise<string | null> => {
    setIsSubmitting(true);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === data.beneficiaryId);
    const currentYear = new Date().getFullYear();
    const counterRef = doc(firestore, "counters", "inventoryOrderNumberGenerator");

    try {
      const newOrderId = await runTransaction(firestore, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let currentCount = 0;
        if (counterDoc.exists()) {
          const counterData = counterDoc.data();
          currentCount = counterData?.yearlyCounts?.[currentYear] || 0;
        }
        const newCount = currentCount + 1;
        const formattedOrderId = `ORD${currentYear}-${String(newCount).padStart(3, '0')}`;
        
        const processedLineItems = data.lineItems.map(item => {
            const qty = parseFloat(String(item.qty || '0')) || 0;
            const unitPriceStr = String(item.unitPrice || '0');
            const finalUnitPrice = parseFloat(unitPriceStr) || 0;
            const discountPercentageStr = String(item.discountPercentage || '0');
            const finalDiscountPercentage = parseFloat(discountPercentageStr) || 0;
            const taxPercentageStr = String(item.taxPercentage || '0');
            const finalTaxPercentage = parseFloat(taxPercentageStr) || 0;
    
            const itemTotalBeforeDiscount = qty * finalUnitPrice;
            
            const itemDetailsFromOptions = itemOptions.find(opt => opt.value === item.itemId);
    
            const lineItemData: Record<string, any> = {
                itemId: item.itemId,
                itemName: itemDetailsFromOptions?.label.split(' (')[0] || 'N/A', 
                itemCode: itemDetailsFromOptions?.itemCode,
                description: item.description || '',
                qty: qty,
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
        
        const orderDataToSave: Record<string, any> = {
          beneficiaryId: data.beneficiaryId,
          beneficiaryName: selectedBeneficiary?.label || 'N/A',
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
          status: "Pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
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
        };

        const cleanedDataToSave: { [key: string]: any } = {};
        for (const key in orderDataToSave) {
          const value = orderDataToSave[key];
          if (value !== undefined && value !== null && value !== '') {
            cleanedDataToSave[key] = value;
          }
        }
        
        const newOrderRef = doc(firestore, "inventory_orders", formattedOrderId);
        transaction.set(newOrderRef, cleanedDataToSave);

        const newCounters = {
          yearlyCounts: {
            ...(counterDoc.exists() ? counterDoc.data().yearlyCounts : {}),
            [currentYear]: newCount,
          }
        };
        transaction.set(counterRef, newCounters, { merge: true });
        
        return formattedOrderId;
      });
      return newOrderId;
    } catch (error: any) {
      console.error("Error in saveOrderLogic: ", error);
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save purchase order: ${error.message}`,
        icon: "error",
      });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegularSave = async (data: OrderFormValues) => {
    const newId = await saveOrderLogic(data);
    if (newId) {
      setGeneratedOrderId(newId);
      Swal.fire("Purchase Order Saved!", `Purchase Order successfully saved with ID: ${newId}.`, "success");
    }
  };

  const handleSaveAndPreview = async (data: OrderFormValues) => {
    const newId = await saveOrderLogic(data);
    if (newId) {
      setGeneratedOrderId(newId);
      Swal.fire({
        title: "Purchase Order Saved!",
        text: `Purchase Order successfully saved with ID: ${newId}. Navigating to preview...`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      }).then(() => {
        router.push(`/dashboard/inventory/inventory-orders/preview/${newId}`);
      });
    }
  };

  const handlePreviewLastSaved = () => {
    if (generatedOrderId) {
      router.push(`/dashboard/inventory/inventory-orders/preview/${generatedOrderId}`);
    } else {
      Swal.fire("No Order Saved", "Please save a purchase order first to preview it.", "info");
    }
  };
  
  const grandTotalLabel = `${watchedShipmentMode} Total (USD):`;

  if (isLoadingDropdowns) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading form options...</p>
      </div>
    );
  }
  
  const saveButtonsDisabled = isSubmitting || isLoadingDropdowns;
  const actionButtonsDisabled = !generatedOrderId || isSubmitting;

  return (
    <Form {...form}>
      <form className="space-y-8">
        
        <h3 className={cn(sectionHeadingClass)}>
          <Building className="mr-2 h-5 w-5 text-primary" />
          Beneficiary & Delivery
        </h3>
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
                    onValueChange={(value) => field.onChange(value === PLACEHOLDER_BENEFICIARY_VALUE ? '' : value)}
                    placeholder="Search Beneficiary..."
                    selectPlaceholder="Select Beneficiary"
                    emptyStateMessage="No beneficiary found."
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
             <FormItem>
              <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Order Number</FormLabel>
              <Input value={generatedOrderId || "(Auto-generated on save)"} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" />
            </FormItem>
            <FormField
                control={control}
                name="orderDate"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Order Date*</FormLabel>
                    <DatePickerField field={field} placeholder="Select order date" />
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
                      <Select onValueChange={field.onChange} value={field.value ?? piShipmentModeOptions[0]}>
                          <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select shipment mode" />
                              </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {piShipmentModeOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                          </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
              )}
          />
          <FormField control={control} name="freightCharges" render={({ field }) => (<FormItem><FormLabel>Freight Charges:</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        
        <Separator className="my-6" />
        <div className="flex justify-between items-center">
            <h3 className={cn(sectionHeadingClass, "mb-0 border-b-0")}>
                <ShoppingCart className="mr-2 h-5 w-5 text-primary" /> Line Items
            </h3>
            <div className="flex items-center gap-2">
                <Link href="/dashboard/quotations/items/add" target="_blank">
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
                  <TableCell><FormField control={control} name={`lineItems.${index}.itemId`} render={({ field: itemField }) => (<Combobox options={itemOptions} value={itemField.value || PLACEHOLDER_ITEM_VALUE} onValueChange={(itemId) => { itemField.onChange(itemId === PLACEHOLDER_ITEM_VALUE ? '' : itemId); handleItemSelect(itemId, index);}} placeholder="Search Item..." selectPlaceholder="Select Item" emptyStateMessage="No item found." className="h-9"/>)}/><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.itemId?.message}</FormMessage></TableCell>
                  {showItemCodeColumn && (<TableCell><FormField control={control} name={`lineItems.${index}.itemCode`} render={({ field: itemField }) => (<Input placeholder="Code" {...itemField} value={itemField.value ?? ''} className="h-9 bg-muted/50" readOnly disabled />)}/></TableCell>)}
                  <TableCell><FormField control={control} name={`lineItems.${index}.description`} render={({ field: itemField }) => (<Textarea placeholder="Item description" {...itemField} rows={1} className="h-9 min-h-[2.25rem] resize-y"/>)} /></TableCell>
                  <TableCell><FormField control={control} name={`lineItems.${index}.unitPrice`} render={({ field: itemField }) => (<Input type="text" placeholder="0.00" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.unitPrice?.message}</FormMessage></TableCell>
                  {showDiscountColumn && <TableCell><FormField control={control} name={`lineItems.${index}.discountPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.discountPercentage?.message}</FormMessage></TableCell>}
                  {showTaxColumn && <TableCell><FormField control={control} name={`lineItems.${index}.taxPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.taxPercentage?.message}</FormMessage></TableCell>
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
            <Button type="button" variant="outline" onClick={() => {
                form.reset();
                setGeneratedOrderId(null);
            }}>
                <X className="mr-2 h-4 w-4" />Cancel
            </Button>
            <Button type="button" onClick={handleSubmit(handleRegularSave)} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={saveButtonsDisabled}>
              {isSubmitting ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Order...</> ) : ( <><Save className="mr-2 h-4 w-4" />Save Order</> )}
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
- src/components/forms/EditInvoiceForm.tsx:
```tsx
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, runTransaction, updateDoc } from 'firebase/firestore';
import type { InvoiceDocument, InvoiceFormValues, CustomerDocument, ItemDocument as ItemDoc, QuoteTaxType, InvoiceLineItemFormValues, PIShipmentMode } from '@/types';
import { InvoiceSchema, quoteTaxTypes, invoiceStatusOptions, piShipmentModeOptions } from '@/types';
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

const PLACEHOLDER_CUSTOMER_VALUE = "__INVOICE_EDIT_CUSTOMER__";
const PLACEHOLDER_ITEM_VALUE_PREFIX = "__INVOICE_EDIT_ITEM__";

interface ItemOption extends ComboboxOption {
  description?: string;
  salesPrice?: number;
  itemCode?: string;
}

interface CustomerOption extends ComboboxOption {
  address?: string;
}

interface EditInvoiceFormProps {
  initialData: InvoiceDocument;
  invoiceId: string;
}

export function EditInvoiceForm({ initialData, invoiceId }: EditInvoiceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customerOptions, setCustomerOptions] = React.useState<CustomerOption[]>([]);
  const [itemOptions, setItemOptions] = React.useState<ItemOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(InvoiceSchema.extend({
        status: z.enum(invoiceStatusOptions).optional(),
    })),
  });

  const { control, setValue, watch, getValues, reset, handleSubmit } = form;

  const showItemCodeColumn = watch("showItemCodeColumn");
  const showDiscountColumn = watch("showDiscountColumn");
  const showTaxColumn = watch("showTaxColumn");
  const watchedStatus = watch("status");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  React.useEffect(() => {
    const fetchOptionsAndSetData = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [customersSnap, itemsSnap] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(collection(firestore, "quote_items"))
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

        if (initialData) {
          reset({
            customerId: initialData.customerId || '',
            billingAddress: initialData.billingAddress || '',
            shippingAddress: initialData.shippingAddress || '',
            invoiceDate: initialData.invoiceDate && isValid(parseISO(initialData.invoiceDate)) ? parseISO(initialData.invoiceDate) : new Date(),
            dueDate: initialData.dueDate && isValid(parseISO(initialData.dueDate)) ? parseISO(initialData.dueDate) : undefined,
            paymentTerms: initialData.paymentTerms || '',
            salesperson: initialData.salesperson || '',
            subject: initialData.subject || '',
            status: initialData.status || "Draft",
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
            packingCharge: initialData.packingCharge,
            handlingCharge: initialData.handlingCharge,
            otherCharges: initialData.otherCharges,
            convertedFromQuoteId: initialData.convertedFromQuoteId,
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
  
  const watchedLineItems = watch("lineItems");
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
    window.open(`/dashboard/inventory/sales/print/${invoiceId}`, '_blank');
  };

  async function onSubmit(data: InvoiceFormValues) {
    if (!invoiceId) {
      Swal.fire("Error", "Invoice ID is missing. Cannot update.", "error");
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
    
    const dataToUpdate: Record<string, any> = {
      customerId: data.customerId,
      customerName: selectedCustomer?.label || initialData.customerName,
      billingAddress: data.billingAddress,
      shippingAddress: data.shippingAddress,
      invoiceDate: format(data.invoiceDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      dueDate: data.dueDate ? format(data.dueDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      paymentTerms: data.paymentTerms,
      salesperson: data.salesperson,
      subject: data.subject,
      lineItems: processedLineItems,
      taxType: data.taxType,
      comments: data.comments,
      privateComments: data.privateComments,
      subtotal: subtotal,
      totalDiscountAmount: totalDiscountAmount,
      totalTaxAmount: totalTaxAmount,
      totalAmount: grandTotal,
      status: data.status,
      showItemCodeColumn: data.showItemCodeColumn,
      showDiscountColumn: data.showDiscountColumn,
      showTaxColumn: data.showTaxColumn,
      packingCharge: data.packingCharge,
      handlingCharge: data.handlingCharge,
      otherCharges: data.otherCharges,
      updatedAt: serverTimestamp(),
      convertedFromQuoteId: data.convertedFromQuoteId,
    };
    
    Object.keys(dataToUpdate).forEach(key => {
        if (dataToUpdate[key] === undefined || dataToUpdate[key] === null || dataToUpdate[key] === '') {
            delete dataToUpdate[key];
        }
    });

    try {
      const invoiceDocRef = doc(firestore, "sales_invoice", invoiceId);
      await updateDoc(invoiceDocRef, dataToUpdate);
      Swal.fire("Sales Invoice Updated!", `Invoice ID: ${invoiceId} successfully updated.`, "success");
    } catch (error: any) {
      Swal.fire("Update Failed", `Failed to update invoice: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (isLoadingDropdowns) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading...</p></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                    onValueChange={(val) => field.onChange(val === PLACEHOLDER_CUSTOMER_VALUE ? '' : val)}
                    placeholder="Search Customer..."
                    selectPlaceholder="Select Customer"
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
        
        <h3 className={cn(sectionHeadingClass)}><CalendarDays className="mr-2 h-5 w-5 text-primary" />Invoice Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 items-end">
            <FormItem><FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Invoice Number</FormLabel><Input value={invoiceId} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" /></FormItem>
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
                  <TableCell><FormField control={control} name={`lineItems.${index}.itemId`} render={({ field: itemField }) => (<Combobox options={itemOptions} value={itemField.value || PLACEHOLDER_ITEM_VALUE_PREFIX + index} onValueChange={(itemId) => { itemField.onChange(itemId === (PLACEHOLDER_ITEM_VALUE_PREFIX + index) ? '' : itemId); handleItemSelect(itemId, index);}} placeholder="Search Item..." selectPlaceholder="Select Item" emptyStateMessage="No item found." className="h-9"/>)}/><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.itemId?.message}</FormMessage></TableCell>
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
          <FormField control={control} name="packingCharge" render={({ field }) => (<FormItem><FormLabel>Packing Charge</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={control} name="handlingCharge" render={({ field }) => (<FormItem><FormLabel>Handling Charge</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={control} name="otherCharges" render={({ field }) => (<FormItem><FormLabel>Freight Charges</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
            <Button type="button" variant="outline" onClick={handleViewPdf}>
                <Printer className="mr-2 h-4 w-4" />
                View PDF
            </Button>
            <Button type="button" variant="outline" onClick={() => reset(initialData ? {
                ...initialData,
                invoiceDate: initialData.invoiceDate ? parseISO(initialData.invoiceDate) : new Date(),
                dueDate: initialData.dueDate ? parseISO(initialData.dueDate) : undefined,
                lineItems: initialData.lineItems.map(item => ({
                  ...item,
                  itemCode: item.itemCode || '',
                  qty: item.qty.toString(),
                  unitPrice: item.unitPrice.toString(),
                  discountPercentage: item.discountPercentage?.toString() || '0',
                  taxPercentage: item.taxPercentage?.toString() || '0',
                  total: item.total.toFixed(2),
                })),
                status: initialData.status,
                showItemCodeColumn: initialData.showItemCodeColumn,
                showDiscountColumn: initialData.showDiscountColumn,
                showTaxColumn: initialData.showTaxColumn,
                packingCharge: initialData.packingCharge,
                handlingCharge: initialData.handlingCharge,
                otherCharges: initialData.otherCharges,
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
```
- src/components/forms/EditPurchaseOrderForm.tsx:
```tsx
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, runTransaction, updateDoc } from 'firebase/firestore';
import type { OrderDocument, OrderFormValues, SupplierDocument, ItemDocument as ItemDoc, QuoteTaxType, OrderLineItemFormValues, PIShipmentMode } from '@/types';
import { OrderLineItemSchema, OrderSchema, quoteTaxTypes, orderStatusOptions, piShipmentModeOptions } from '@/types';
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

export function EditPurchaseOrderForm({ initialData, orderId }: EditPurchaseOrderFormProps) {
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
                      <Select onValueChange={field.onChange} value={field.value ?? piShipmentModeOptions[0]}>
                          <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select shipment mode" />
                              </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {piShipmentModeOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
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
                <Link href="/dashboard/quotations/items/add" target="_blank">
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
                  {showTaxColumn && <TableCell><FormField control={control} name={`lineItems.${index}.taxPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.taxPercentage?.message}</FormMessage></TableCell>
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
```
- src/components/forms/EditQuoteForm.tsx:
```tsx
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, runTransaction, updateDoc } from 'firebase/firestore';
import type { QuoteDocument, QuoteFormValues as PageQuoteFormValues, CustomerDocument, ItemDocument as ItemDoc, QuoteTaxType, QuoteLineItemFormValues as PageQuoteLineItemFormValues, InvoiceDocument, PIShipmentMode } from '@/types';
import { QuoteLineItemSchema, QuoteSchema, quoteTaxTypes, quoteStatusOptions, piShipmentModeOptions } from '@/types';
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

const PLACEHOLDER_CUSTOMER_VALUE = "__QUOTE_EDIT_CUSTOMER__";
const PLACEHOLDER_ITEM_VALUE_PREFIX = "__QUOTE_EDIT_ITEM__";

interface ItemOption extends ComboboxOption {
  description?: string;
  salesPrice?: number;
  itemCode?: string;
}

interface CustomerOption extends ComboboxOption {
  address?: string;
}

interface EditQuoteFormProps {
  initialData: QuoteDocument;
  quoteId: string;
}

type QuoteFormValues = PageQuoteFormValues;
type QuoteLineItemFormValues = PageQuoteLineItemFormValues;


export function EditQuoteForm({ initialData, quoteId }: EditQuoteFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customerOptions, setCustomerOptions] = React.useState<CustomerOption[]>([]);
  const [itemOptions, setItemOptions] = React.useState<ItemOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(QuoteSchema),
  });

  const { control, setValue, watch, getValues, reset, handleSubmit } = form;
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const showItemCodeColumn = watch("showItemCodeColumn");
  const showDiscountColumn = watch("showDiscountColumn");
  const showTaxColumn = watch("showTaxColumn");
  const watchedStatus = watch("status");
  const watchedShipmentMode = watch("shipmentMode");

  React.useEffect(() => {
    const fetchOptionsAndSetData = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [customersSnap, itemsSnap] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(collection(firestore, "quote_items"))
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

        if (initialData) {
          reset({
            customerId: initialData.customerId || '',
            billingAddress: initialData.billingAddress || '',
            shippingAddress: initialData.shippingAddress || '',
            quoteDate: initialData.quoteDate && isValid(parseISO(initialData.quoteDate)) ? parseISO(initialData.quoteDate) : new Date(),
            salesperson: initialData.salesperson || '',
            subject: initialData.subject || '',
            status: initialData.status || "Draft",
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
            convertedToInvoiceId: initialData.convertedToInvoiceId,
            shipmentMode: initialData.shipmentMode ?? piShipmentModeOptions[0],
            freightCharges: initialData.freightCharges,
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

  const watchedLineItems = watch("lineItems");
  const watchedFreightCharges = watch("freightCharges");
  
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
    window.open(`/dashboard/quotations/preview/${quoteId}`, '_blank');
  };

  const handleConvertToInvoice = async () => {
    if (!quoteId) {
        Swal.fire("Error", "Quote ID is missing.", "error");
        return;
    }

    const result = await Swal.fire({
        title: 'Convert to Invoice?',
        text: `This will create a new invoice from this quote (${quoteId}) and mark the quote as 'Invoiced'. This action cannot be undone.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, convert it!',
        cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) {
        return;
    }

    setIsSubmitting(true);
    const data = getValues();

    try {
        const newInvoiceId = await runTransaction(firestore, async (transaction) => {
            const quoteDocRef = doc(firestore, "quotes", quoteId);
            const counterRef = doc(firestore, "counters", "invoiceNumberGenerator");

            const counterDoc = await transaction.get(counterRef);
            const currentYear = new Date().getFullYear();
            let currentCount = 0;
            if (counterDoc.exists()) {
                const counterData = counterDoc.data();
                currentCount = counterData?.yearlyCounts?.[currentYear] || 0;
            }
            const newCount = currentCount + 1;
            const formattedInvoiceId = `INV${currentYear}-${String(newCount).padStart(3, '0')}`;
            
            const selectedCustomer = customerOptions.find(opt => opt.value === data.customerId);

            const invoiceDataToSave: Omit<InvoiceDocument, 'id'> & { createdAt: any, updatedAt: any } = {
                customerId: data.customerId,
                customerName: selectedCustomer?.label || 'N/A',
                billingAddress: data.billingAddress,
                shippingAddress: data.shippingAddress,
                invoiceDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
                dueDate: undefined,
                paymentTerms: '',
                salesperson: data.salesperson,
                subject: data.subject || undefined,
                lineItems: data.lineItems.map(item => {
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
                        total: parseFloat(String(item.qty || '0')) * parseFloat(String(item.unitPrice || '0')),
                    };
                }),
                taxType: data.taxType,
                comments: data.comments,
                privateComments: data.privateComments,
                subtotal: subtotal,
                totalDiscountAmount: totalDiscountAmount,
                totalTaxAmount: totalTaxAmount,
                totalAmount: grandTotal,
                status: "Draft",
                amountPaid: 0,
                showItemCodeColumn: data.showItemCodeColumn,
                showDiscountColumn: data.showDiscountColumn,
                showTaxColumn: data.showTaxColumn,
                convertedFromQuoteId: quoteId,
                shipmentMode: data.shipmentMode,
                freightCharges: data.freightCharges,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            const cleanedDataToSave = Object.fromEntries(
                Object.entries(invoiceDataToSave).filter(([, value]) => value !== undefined)
            ) as typeof invoiceDataToSave;

            const newInvoiceRef = doc(firestore, "invoices", formattedInvoiceId);
            transaction.set(newInvoiceRef, cleanedDataToSave);

            transaction.update(quoteDocRef, {
                status: "Invoiced",
                convertedToInvoiceId: formattedInvoiceId,
                updatedAt: serverTimestamp()
            });
            
            transaction.set(counterRef, { yearlyCounts: { ...(counterDoc.exists() ? counterDoc.data().yearlyCounts : {}), [currentYear]: newCount } }, { merge: true });

            return formattedInvoiceId;
        });

        setValue("status", "Invoiced");

        Swal.fire({
            title: 'Conversion Successful!',
            html: `A new invoice has been created with ID: <strong>${newInvoiceId}</strong>.`,
            icon: 'success',
            showCancelButton: true,
            confirmButtonText: 'Edit New Invoice',
            cancelButtonText: 'Close',
        }).then((result) => {
            if (result.isConfirmed) {
                router.push(`/dashboard/pi/edit/${newInvoiceId}`);
            }
        });

    } catch (error: any) {
        console.error("Error converting quote to invoice: ", error);
        Swal.fire("Conversion Failed", `Failed to convert quote: ${error.message}`, "error");
    } finally {
        setIsSubmitting(false);
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
      
      Object.keys(lineItemData).forEach(key => {
          if (lineItemData[key] === undefined || lineItemData[key] === null || lineItemData[key] === '') {
              delete lineItemData[key];
          }
      });
      return lineItemData;
    });
    
    const finalSubtotal = processedLineItems.reduce((sum, item) => sum + item.total, 0);
    const finalTotalDiscount = showDiscountColumn ? processedLineItems.reduce((sum, item) => sum + (item.total * ((item.discountPercentage ?? 0) / 100)), 0) : 0;
    const finalTotalTax = showTaxColumn ? processedLineItems.reduce((sum, item) => sum + ((item.total * (1 - ((item.discountPercentage ?? 0)/100))) * ((item.taxPercentage ?? 0) / 100)), 0) : 0;
    const finalGrandTotal = finalSubtotal - finalTotalDiscount + finalTotalTax + Number(data.freightCharges || 0);

    const dataToUpdate: Record<string, any> = {
      customerId: data.customerId,
      customerName: selectedCustomer?.label || initialData.customerName,
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
      status: data.status,
      showItemCodeColumn: data.showItemCodeColumn,
      showDiscountColumn: data.showDiscountColumn,
      showTaxColumn: data.showTaxColumn,
      updatedAt: serverTimestamp(),
      convertedToInvoiceId: data.convertedToInvoiceId,
      shipmentMode: data.shipmentMode,
      freightCharges: data.freightCharges,
    };
    
    Object.keys(dataToUpdate).forEach(key => {
        if (dataToUpdate[key] === undefined || dataToUpdate[key] === null || dataToUpdate[key] === '') {
            delete dataToUpdate[key];
        }
    });

    try {
      const quoteDocRef = doc(firestore, "quotes", quoteId);
      await updateDoc(quoteDocRef, dataToUpdate);
      Swal.fire("Quote Updated!", `Quote Number: ${quoteId} successfully updated.`, "success");
    } catch (error: any) {
      console.error("Error updating quote: ", error);
      Swal.fire("Update Failed", `Failed to update quote: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const grandTotalLabel = `TOTAL (USD):`;


  if (isLoadingDropdowns) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading...</p></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8"> 
        
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
                    onValueChange={(val) => field.onChange(val === PLACEHOLDER_CUSTOMER_VALUE ? '' : val)}
                    placeholder="Search Customer..."
                    selectPlaceholder="Select Customer"
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
            <FormItem><FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Quote Number</FormLabel><Input value={quoteId} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" /></FormItem>
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
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? 'Draft'} disabled={watchedStatus === 'Invoiced'}>
                      <FormControl>
                      <SelectTrigger>
                          <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                      {quoteStatusOptions.map(status => (
                          <SelectItem key={status} value={status} disabled={status === 'Invoiced' && watchedStatus !== 'Invoiced'}>{status}</SelectItem>
                      ))}
                      </SelectContent>
                  </Select>
                  {watchedStatus === 'Invoiced' && <FormDescription className="text-xs">Status is locked after conversion.</FormDescription>}
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
                  <TableCell><FormField control={control} name={`lineItems.${index}.itemId`} render={({ field: itemField }) => (<Combobox options={itemOptions} value={itemField.value || PLACEHOLDER_ITEM_VALUE_PREFIX + index} onValueChange={(itemId) => { itemField.onChange(itemId === (PLACEHOLDER_ITEM_VALUE_PREFIX + index) ? '' : itemId); handleItemSelect(itemId, index);}} placeholder="Search Item..." selectPlaceholder="Select Item" emptyStateMessage="No item found." className="h-9"/>)}/><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.itemId?.message}</FormMessage></TableCell>
                  {showItemCodeColumn && (<TableCell><FormField control={control} name={`lineItems.${index}.itemCode`} render={({ field: itemField }) => (<Input placeholder="Code" {...itemField} value={itemField.value ?? ''} className="h-9 bg-muted/50" readOnly disabled />)}/></TableCell>)}
                  <TableCell><FormField control={control} name={`lineItems.${index}.description`} render={({ field: itemField }) => (<Textarea placeholder="Item description" {...itemField} rows={1} className="h-9 min-h-[2.25rem] resize-y"/>)} /></TableCell>
                  <TableCell><FormField control={control} name={`lineItems.${index}.unitPrice`} render={({ field: itemField }) => (<Input type="text" placeholder="0.00" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.unitPrice?.message}</FormMessage></TableCell>
                  {showDiscountColumn && <TableCell><FormField control={control} name={`lineItems.${index}.discountPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.discountPercentage?.message}</FormMessage></TableCell>}
                  {showTaxColumn && <TableCell><FormField control={control} name={`lineItems.${index}.taxPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.taxPercentage?.message}</FormMessage></TableCell>
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
                 {showDiscountColumn && <div className="flex justify-between"><span className="text-muted-foreground">Total Discount:</span><span className="font-medium text-foreground">(-) {totalDiscountAmount.toFixed(2)}</span></div>}
                 {showTaxColumn && <div className="flex justify-between"><span className="text-muted-foreground">Total Tax:</span><span className="font-medium text-foreground">(+) {totalTaxAmount.toFixed(2)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Freight Charges:</span><span className="font-medium text-foreground">(+) {Number(watchedFreightCharges || 0).toFixed(2)}</span></div>
                <Separator />
                <div className="flex justify-between text-lg font-bold"><span className="text-primary">Grand Total:</span><span className="text-primary">{grandTotal.toFixed(2)}</span></div>
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
                quoteDate: initialData.quoteDate ? parseISO(initialData.quoteDate) : new Date(),
                lineItems: initialData.lineItems.map(item => ({
                  ...item,
                  itemCode: item.itemCode || '',
                  qty: item.qty.toString(),
                  unitPrice: item.unitPrice.toString(),
                  discountPercentage: item.discountPercentage?.toString() || '0',
                  taxPercentage: item.taxPercentage?.toString() || '0',
                  total: item.total.toFixed(2),
                })),
                status: initialData.status,
                showItemCodeColumn: initialData.showItemCodeColumn,
                showDiscountColumn: initialData.showDiscountColumn,
                showTaxColumn: initialData.showTaxColumn,
              } : {} )}>
                <X className="mr-2 h-4 w-4" />Reset
            </Button>
             <Button type="button" onClick={handleConvertToInvoice} className="bg-green-600 hover:bg-green-700" disabled={isSubmitting || watchedStatus === 'Invoiced'}>
              <Edit className="mr-2 h-4 w-4" />Convert to Invoice
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || isLoadingDropdowns}>
              {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Changes...</>) : (<><Save className="mr-2 h-4 w-4" />Save Changes</>)}
            </Button>
        </div>
      </form>
    </Form>
  );
}
```
