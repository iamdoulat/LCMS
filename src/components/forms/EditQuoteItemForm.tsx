
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import type { ItemFormValues, ItemDocument, SupplierDocument } from '@/types';
import { itemSchema } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Package, Save, DollarSign, Warehouse, AlertTriangle, Info, Tag, MapPin, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';

const sectionHeadingClass = "font-semibold text-lg text-primary flex items-center gap-2 mb-4";
const PLACEHOLDER_SUPPLIER_VALUE = "__EDIT_QUOTE_ITEM_SUPPLIER__";

interface EditQuoteItemFormProps {
  initialData: ItemDocument;
  itemId: string;
}

export function EditQuoteItemForm({ initialData, itemId }: EditQuoteItemFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [supplierOptions, setSupplierOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = React.useState(true);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      itemName: '',
      itemCode: '',
      brandName: '',
      supplierId: '',
      description: '',
      unit: 'pcs',
      salesPrice: undefined,
      purchasePrice: undefined,
      manageStock: false,
      currentQuantity: 0,
      location: '',
      idealQuantity: undefined,
      warningQuantity: undefined,
    },
  });

  React.useEffect(() => {
    const fetchSuppliers = async () => {
      setIsLoadingSuppliers(true);
      try {
        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
        setSupplierOptions(
          suppliersSnapshot.docs.map(docSnap => {
            const data = docSnap.data() as SupplierDocument;
            return { value: docSnap.id, label: data.beneficiaryName || 'Unnamed Supplier' };
          })
        );
      } catch (error) {
        console.error("Error fetching suppliers for item form: ", error);
      } finally {
        setIsLoadingSuppliers(false);
      }
    };
    fetchSuppliers();
  }, []);

  React.useEffect(() => {
    if (initialData) {
      form.reset({
        itemName: initialData.itemName || '',
        itemCode: initialData.itemCode || '',
        brandName: initialData.brandName || '',
        supplierId: initialData.supplierId || '',
        description: initialData.description || '',
        unit: initialData.unit || 'pcs',
        salesPrice: initialData.salesPrice,
        purchasePrice: initialData.purchasePrice,
        manageStock: initialData.manageStock ?? false,
        currentQuantity: initialData.currentQuantity ?? 0,
        location: initialData.location || '',
        idealQuantity: initialData.idealQuantity,
        warningQuantity: initialData.warningQuantity,
      });
    }
  }, [initialData, form]);

  const watchManageStock = form.watch("manageStock");

  async function onSubmit(data: ItemFormValues) {
    setIsSubmitting(true);

    const selectedSupplier = supplierOptions.find(opt => opt.value === data.supplierId);

    const dataToUpdate: Partial<Omit<ItemDocument, 'id' | 'createdAt'>> & { updatedAt: any } = {
      itemName: data.itemName,
      itemCode: data.itemCode || undefined,
      brandName: data.brandName || undefined,
      supplierId: data.supplierId || undefined,
      supplierName: selectedSupplier?.label || undefined,
      description: data.description || undefined,
      unit: data.unit || undefined,
      salesPrice: data.salesPrice,
      purchasePrice: data.purchasePrice,
      manageStock: data.manageStock,
      currentQuantity: data.manageStock ? data.currentQuantity : undefined,
      location: data.manageStock ? (data.location || undefined) : undefined,
      idealQuantity: data.manageStock ? data.idealQuantity : undefined,
      warningQuantity: data.manageStock ? data.warningQuantity : undefined,
      updatedAt: serverTimestamp(),
    };

    Object.keys(dataToUpdate).forEach(key => {
      if (dataToUpdate[key as keyof typeof dataToUpdate] === undefined) {
        delete dataToUpdate[key as keyof typeof dataToUpdate];
      }
    });

    try {
      const itemDocRef = doc(firestore, "quote_items", itemId);
      await updateDoc(itemDocRef, dataToUpdate);
      Swal.fire({
        title: "Quote Item Updated!",
        text: `Quote Item "${data.itemName}" has been successfully updated.`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
    } catch (error) {
      console.error("Error updating quote item document: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Update Failed",
        text: `Failed to update quote item: ${errorMessage}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <h3 className={cn(sectionHeadingClass)}>
          <Package className="h-5 w-5" /> Quote Item Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="itemName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Item Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter item name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Supplier Name</FormLabel>
                <Combobox
                  options={supplierOptions}
                  value={field.value || PLACEHOLDER_SUPPLIER_VALUE}
                  onValueChange={(value) => field.onChange(value === PLACEHOLDER_SUPPLIER_VALUE ? '' : value)}
                  placeholder="Search Supplier..."
                  selectPlaceholder={isLoadingSuppliers ? "Loading Suppliers..." : "Select Supplier (Optional)"}
                  emptyStateMessage="No supplier found."
                  disabled={isLoadingSuppliers}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="itemCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Item Code/SKU</FormLabel>
                <FormControl>
                  <Input placeholder="Enter item code or SKU" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="brandName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Tag className="h-4 w-4 mr-1 text-muted-foreground" />Brand Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter brand name" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter item description" {...field} rows={3} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., pcs, kg, m" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="salesPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><DollarSign className="h-4 w-4 mr-1 text-muted-foreground" />Sales Price</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="purchasePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><DollarSign className="h-4 w-4 mr-1 text-muted-foreground" />Purchase Price</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <h3 className={cn(sectionHeadingClass)}>
          <Warehouse className="h-5 w-5" /> Inventory Management
        </h3>
        <FormField
          control={form.control}
          name="manageStock"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="hover:cursor-pointer">
                  Manage inventory stock levels for this item
                </FormLabel>
                <FormDescription>
                  Enable to track current quantity, ideal levels, and warning thresholds.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {watchManageStock && (
          <Card className="bg-muted/30 p-6">
            <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="currentQuantity"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Current Quantity*</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="0" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><MapPin className="h-4 w-4 mr-1 text-muted-foreground" />Location</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., Warehouse A, Shelf B-3" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="idealQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ideal Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 100" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="warningQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><AlertTriangle className="h-4 w-4 mr-1 text-amber-500" />Warning Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 10" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormDescription>
                        Receive alerts when stock reaches this level.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingSuppliers}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
