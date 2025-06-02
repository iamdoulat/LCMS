
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ItemFormValues, Item } from '@/types';
import { itemSchema } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Package, Save, DollarSign, Warehouse, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const sectionHeadingClass = "font-semibold text-lg text-primary flex items-center gap-2 mb-4";

export function AddItemForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      itemName: '',
      itemCode: '',
      description: '',
      unit: 'pcs',
      salesPrice: undefined,
      purchasePrice: undefined,
      manageStock: false,
      currentQuantity: 0,
      idealQuantity: undefined,
      warningQuantity: undefined,
    },
  });

  const watchManageStock = form.watch("manageStock");

  async function onSubmit(data: ItemFormValues) {
    setIsSubmitting(true);

    const dataToSave: Omit<Item, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any, updatedAt: any } = {
      itemName: data.itemName,
      itemCode: data.itemCode || undefined,
      description: data.description || undefined,
      unit: data.unit || undefined,
      salesPrice: data.salesPrice, // Will be undefined if not entered
      purchasePrice: data.purchasePrice, // Will be undefined if not entered
      manageStock: data.manageStock,
      currentQuantity: data.manageStock ? data.currentQuantity : undefined,
      idealQuantity: data.manageStock ? data.idealQuantity : undefined,
      warningQuantity: data.manageStock ? data.warningQuantity : undefined,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Filter out explicitly undefined fields that Zod might have defaulted
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key as keyof typeof dataToSave] === undefined) {
        delete dataToSave[key as keyof typeof dataToSave];
      }
    });


    try {
      const docRef = await addDoc(collection(firestore, "items"), dataToSave);
      Swal.fire({
        title: "Item Added!",
        text: `Item "${data.itemName}" saved successfully with ID: ${docRef.id}.`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
      form.reset({ // Reset to initial default values or specific ones
        itemName: '', itemCode: '', description: '', unit: 'pcs', salesPrice: undefined, purchasePrice: undefined,
        manageStock: false, currentQuantity: 0, idealQuantity: undefined, warningQuantity: undefined,
      });
    } catch (error) {
      console.error("Error adding item document: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save item: ${errorMessage}`,
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
          <Package className="h-5 w-5" /> Item Details
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
        
        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Item...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Item
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
