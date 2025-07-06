

"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, runTransaction, getDoc, writeBatch } from 'firebase/firestore';
import type { CustomerDocument, ItemDocument as ItemDoc, QuoteTaxType, SaleDocument, SaleFormValues as PageSaleFormValues, SaleLineItemFormValues as PageSaleLineItemFormValues } from '@/types'; // Updated types
import { SaleSchema, quoteTaxTypes } from '@/types'; // Updated schemas
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, PlusCircle, Trash2, Users, FileText, CalendarDays, DollarSign, Save, X, ShoppingBag, Hash, Columns } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_CUSTOMER_VALUE = "__SALE_EDIT_CUSTOMER__";
const PLACEHOLDER_ITEM_VALUE_PREFIX = "__SALE_EDIT_ITEM__";

interface ItemOption extends ComboboxOption {
  description?: string;
  salesPrice?: number;
  itemCode?: string;
  manageStock?: boolean;
}

interface EditSaleFormProps {
  initialData: SaleDocument;
  saleId: string;
}

export function EditSaleForm({ initialData, saleId }: EditSaleFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customerOptions, setCustomerOptions] = React.useState<ComboboxOption[]>([]);
  const [itemOptions, setItemOptions] = React.useState<ItemOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  const [subtotal, setSubtotal] = React.useState(0);
  const [totalTaxAmount, setTotalTaxAmount] = React.useState(0);
  const [totalDiscountAmount, setTotalDiscountAmount] = React.useState(0);
  const [grandTotal, setGrandTotal] = React.useState(0);

  const [showItemCodeColumn, setShowItemCodeColumn] = React.useState(true);
  const [showDiscountColumn, setShowDiscountColumn] = React.useState(true);
  const [showTaxColumn, setShowTaxColumn] = React.useState(true);

  const form = useForm<PageSaleFormValues>({
    resolver: zodResolver(SaleSchema),
  });

  const { control, setValue, watch, getValues, reset } = form;

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
            manageStock: data.manageStock
          };
        });
        setItemOptions(fetchedItems);

        if (initialData) {
          reset({
            customerId: initialData.customerId || '',
            billingAddress: initialData.billingAddress || '',
            shippingAddress: initialData.shippingAddress || '',
            saleDate: initialData.saleDate && isValid(parseISO(initialData.saleDate)) ? parseISO(initialData.saleDate) : new Date(),
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
  const watchedTaxType = watch("taxType");

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

  async function onSubmit(data: PageSaleFormValues) {
    if (!saleId) {
        Swal.fire("Error", "Sale ID is missing. Cannot update.", "error");
        return;
    }
    setIsSubmitting(true);
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const saleDocRef = doc(firestore, "sales", saleId);
            const saleDocSnap = await transaction.get(saleDocRef);
            if (!saleDocSnap.exists()) {
                throw new Error("Sale does not exist.");
            }
            const originalSaleData = saleDocSnap.data() as SaleDocument;

            const selectedCustomer = customerOptions.find(opt => opt.value === data.customerId);
            
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
                    itemId: item.itemId,
                    itemName: itemDetails?.label.split(' (')[0] || 'N/A',
                    itemCode: itemDetails?.itemCode,
                    description: item.description || '',
                    qty, unitPrice, discountPercentage, taxPercentage, total,
                };
            });

            const finalSubtotal = processedLineItems.reduce((sum, item) => sum + (item.qty * (item.unitPrice ?? 0)), 0);
            const finalTotalDiscount = processedLineItems.reduce((sum, item) => sum + (item.qty * (item.unitPrice ?? 0) * ((item.discountPercentage ?? 0) / 100)), 0);
            const finalTotalTax = processedLineItems.reduce((sum, item) => sum + ((item.qty * (item.unitPrice ?? 0) * (1 - ((item.discountPercentage ?? 0)/100))) * ((item.taxPercentage ?? 0) / 100)), 0);
            const finalGrandTotal = finalSubtotal - finalTotalDiscount + finalTotalTax;

            const dataToUpdate: Partial<Omit<SaleDocument, 'id' | 'createdAt'>> & { updatedAt: any } = {
                customerId: data.customerId,
                customerName: selectedCustomer?.label || originalSaleData.customerName,
                billingAddress: data.billingAddress,
                shippingAddress: data.shippingAddress,
                saleDate: format(data.saleDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
                salesperson: data.salesperson,
                lineItems: processedLineItems,
                taxType: data.taxType,
                comments: data.comments || undefined,
                privateComments: data.privateComments || undefined,
                subtotal: finalSubtotal,
                totalDiscountAmount: finalTotalDiscount,
                totalTaxAmount: finalTotalTax,
                totalAmount: finalGrandTotal,
                updatedAt: serverTimestamp(),
            };

            const oldItemsMap = new Map(originalSaleData.lineItems.map(item => [item.itemId, item.qty]));
            const newItemsMap = new Map(processedLineItems.map(item => [item.itemId, item.qty]));
            const allItemIds = new Set([...oldItemsMap.keys(), ...newItemsMap.keys()]);
            
            for (const itemId of allItemIds) {
                if (!itemId) continue;
                const itemOption = itemOptions.find(opt => opt.value === itemId);
                if (itemOption?.manageStock) {
                    const oldQty = oldItemsMap.get(itemId) || 0;
                    const newQty = newItemsMap.get(itemId) || 0;
                    const qtyDifference = newQty - oldQty;

                    if (qtyDifference !== 0) {
                        const itemRef = doc(firestore, "items", itemId);
                        const itemSnap = await transaction.get(itemRef);
                        if (!itemSnap.exists()) throw new Error(`Item "${itemOption.label}" not found.`);
                        const currentStock = itemSnap.data().currentQuantity || 0;
                        const adjustedStock = currentStock - qtyDifference;
                        if (adjustedStock < 0) throw new Error(`Insufficient stock for ${itemOption.label}.`);
                        transaction.update(itemRef, { currentQuantity: adjustedStock, updatedAt: serverTimestamp() });
                    }
                }
            }
            transaction.update(saleDocRef, dataToUpdate);
        });

        Swal.fire("Sale Updated!", `Sale ID: ${saleId} and item stock levels have been successfully updated.`, "success");
    } catch (error: any) {
        console.error("Error updating sale:", error);
        Swal.fire("Update Failed", `Failed to update sale: ${error.message}`, "error");
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
          <div><FormField control={control} name="customerId" render={({ field }) => (
              <FormItem><FormLabel>Customer*</FormLabel>
                <Combobox options={customerOptions} value={field.value || PLACEHOLDER_CUSTOMER_VALUE} onValueChange={(val) => field.onChange(val === PLACEHOLDER_CUSTOMER_VALUE ? '' : val)} placeholder="Search Customer..." selectPlaceholder="Select Customer" disabled={isLoadingDropdowns}/>
                <FormMessage />
              </FormItem>)}
            />
          </div>
          <div><FormField control={control} name="shippingAddress" render={({ field }) => (
              <FormItem>
                <FormLabel>Delivery Address*</FormLabel>
                <FormControl><Textarea placeholder="Delivery address" {...field} rows={3} /></FormControl><FormMessage />
              </FormItem>)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><FormField control={control} name="salesperson" render={({ field }) => (<FormItem><FormLabel>Salesperson*</FormLabel><FormControl><Input placeholder="Salesperson name" {...field} /></FormControl><FormMessage /></FormItem>)}/></div>
          <div><FormField control={control} name="billingAddress" render={({ field }) => (<FormItem><FormLabel>Bill To*</FormLabel><FormControl><Textarea placeholder="Billing address" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)}/></div>
        </div>
        
        <h3 className={cn(sectionHeadingClass)}><CalendarDays className="mr-2 h-5 w-5 text-primary" />Sale Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <FormItem><FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Sale ID</FormLabel><Input value={saleId} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" /></FormItem>
            <FormField control={control} name="saleDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Sale Date*</FormLabel><DatePickerField field={field} placeholder="Select sale date" /><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="taxType" render={({ field }) => (<FormItem><FormLabel>Tax</FormLabel><Select onValueChange={field.onChange} value={field.value ?? 'Default'}><FormControl><SelectTrigger><SelectValue placeholder="Select tax type" /></SelectTrigger></FormControl><SelectContent>{quoteTaxTypes.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
        </div>

        <Separator />
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
                    onCheckedChange={setShowItemCodeColumn}
                >
                    Item Code
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={showDiscountColumn}
                    onCheckedChange={setShowDiscountColumn}
                >
                    Discount %
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={showTaxColumn}
                    onCheckedChange={setShowTaxColumn}
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
                  <TableCell><FormField control={control} name={`lineItems.${index}.itemId`} render={({ field: itemField }) => (<Combobox options={itemOptions} value={itemField.value || PLACEHOLDER_ITEM_VALUE_PREFIX + index} onValueChange={(itemId) => { itemField.onChange(itemId === (PLACEHOLDER_ITEM_VALUE_PREFIX + index) ? '' : itemId); handleItemSelect(itemId, index);}} placeholder="Search Item..." selectPlaceholder="Select Item" emptyStateMessage="No item found." className="h-9"/>)}/><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.itemId?.message}</FormMessage></TableCell>
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
            <FormField control={control} name="comments" render={({ field }) => (<FormItem><FormLabel>Comments (Public)</FormLabel><FormControl><Textarea placeholder="Public comments" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="privateComments" render={({ field }) => (<FormItem><FormLabel>Private Comments (Internal)</FormLabel><FormControl><Textarea placeholder="Internal notes" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)}/>
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
            <Button type="button" variant="outline" onClick={() => reset(initialData ? {
                ...initialData,
                saleDate: initialData.saleDate ? parseISO(initialData.saleDate) : new Date(),
                lineItems: initialData.lineItems.map(item => ({
                  ...item,
                  itemCode: item.itemCode || '',
                  qty: item.qty.toString(),
                  unitPrice: item.unitPrice.toString(),
                  discountPercentage: item.discountPercentage?.toString() || '0',
                  taxPercentage: item.taxPercentage?.toString() || '0',
                  total: item.total.toFixed(2),
                })),
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
