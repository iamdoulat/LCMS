
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore, storage } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { QuoteItemFormValues, ItemDocument, SupplierDocument } from '@/types';
import { quoteItemSchema } from '@/types';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Package, Save, DollarSign, Tag, Building, ArrowLeft, Globe, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { ImageUploadWithCrop } from '@/components/ui/ImageUploadWithCrop';

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
  const [imageFile, setImageFile] = React.useState<Blob | null>(null);

  const form = useForm<QuoteItemFormValues>({
    resolver: zodResolver(quoteItemSchema),
    defaultValues: {
      modelNumber: '',
      itemCode: '',
      brandName: '',
      countryOfOrigin: '',
      supplierId: '',
      description: '',
      unit: 'pcs',
      salesPrice: undefined,
      imageUrl: '',
    },
  });

  const watchedImageUrl = form.watch("imageUrl");


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
        modelNumber: initialData.itemName || '',
        itemCode: initialData.itemCode || '',
        brandName: initialData.brandName || '',
        countryOfOrigin: initialData.countryOfOrigin || '',
        supplierId: initialData.supplierId || '',
        description: initialData.description || '',
        unit: initialData.unit || 'pcs',
        salesPrice: initialData.salesPrice,
        imageUrl: initialData.imageUrl || '',
      });
    }
  }, [initialData, form]);

  async function onSubmit(data: QuoteItemFormValues) {
    setIsSubmitting(true);

    const selectedSupplier = supplierOptions.find(opt => opt.value === data.supplierId);

    const dataToSave: any = {
      itemName: data.modelNumber,
      itemCode: data.itemCode || undefined,
      brandName: data.brandName || undefined,
      countryOfOrigin: data.countryOfOrigin || undefined,
      supplierId: data.supplierId || undefined,
      supplierName: selectedSupplier?.label || undefined,
      description: data.description || undefined,
      unit: data.unit || undefined,
      salesPrice: data.salesPrice,
      imageUrl: data.imageUrl || undefined, // Start with text input value
      updatedAt: serverTimestamp(),
    };

    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key as keyof typeof dataToSave] === undefined) {
        delete dataToSave[key as keyof typeof dataToSave];
      }
    });

    try {
      const docRef = doc(firestore, "quote_items", itemId);

      // Upload new image if exists
      if (imageFile) {
        try {
          const imageRef = ref(storage, `quote_items/${itemId}/product_image.jpg`);
          await uploadBytes(imageRef, imageFile);
          const downloadURL = await getDownloadURL(imageRef);
          dataToSave.imageUrl = downloadURL; // Override text input if file uploaded
        } catch (uploadError) {
          console.error("Error uploading image:", uploadError);
          Swal.fire({
            title: "Image Upload Failed",
            text: "Item will be saved, but image upload failed.",
            icon: "warning"
          });
        }
      }

      await updateDoc(docRef, dataToSave);

      Swal.fire({
        title: "Quote Item Updated!",
        text: `Quote Item "${data.modelNumber}" has been successfully updated.`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
      form.reset(data); // Re-initialize with saved data
      setImageFile(null); // Reset file input
      // Ideally we should update the initialData or refresh the page/context, 
      // but form reset with same data is tricky if we changed imageUrl.
      // Since we don't return new data from updateDoc, we might need to assume success.
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
            name="modelNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model Number*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter model number" {...field} />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <FormField
            control={form.control}
            name="countryOfOrigin"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Globe className="h-4 w-4 mr-1 text-muted-foreground" />Country of origin</FormLabel>
                <FormControl>
                  <Input placeholder="Enter country" {...field} value={field.value ?? ''} />
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

        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><LinkIcon className="h-4 w-4 mr-1 text-muted-foreground" />Product Image</FormLabel>
              <div className="space-y-4">
                <ImageUploadWithCrop
                  onImageCropped={(blob) => setImageFile(blob)}
                  aspectRatio={1}
                  initialImageUrl={field.value}
                />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or using URL</span>
                  </div>
                </div>
                <FormControl>
                  <Input type="url" placeholder="https://example.com/image.jpg" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {watchedImageUrl && (
          <div className="space-y-2">
            <Label>Image Preview</Label>
            <div className="mt-2 w-32 h-32 rounded-md border p-2 flex items-center justify-center">
              <Image
                src={watchedImageUrl}
                alt="Item Preview"
                width={120}
                height={120}
                className="object-contain rounded-sm"
                onError={(e) => { e.currentTarget.src = 'https://placehold.co/120x120/e2e8f0/e2e8f0?text=Invalid'; }}
                data-ai-hint="item image"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>

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
