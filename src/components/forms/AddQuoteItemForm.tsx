

"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore, storage } from '@/lib/firebase/config';
import { collection, addDoc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { QuoteItemFormValues, Item, SupplierDocument } from '@/types';
import { quoteItemSchema } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Package, Save, DollarSign, Tag, Building, Globe, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { ImageUploadWithCrop } from '@/components/ui/ImageUploadWithCrop';

const sectionHeadingClass = "font-semibold text-lg text-primary flex items-center gap-2 mb-4";
const PLACEHOLDER_SUPPLIER_VALUE = "__ADD_QUOTE_ITEM_SUPPLIER_PLACEHOLDER__";

export function AddQuoteItemForm() {
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

  async function onSubmit(data: QuoteItemFormValues) {
    setIsSubmitting(true);

    const selectedSupplier = supplierOptions.find(opt => opt.value === data.supplierId);

    const dataToSave: any = {
      itemName: data.modelNumber, // Map modelNumber to itemName
      itemCode: data.itemCode || undefined,
      brandName: data.brandName || undefined,
      countryOfOrigin: data.countryOfOrigin || undefined,
      supplierId: data.supplierId || undefined,
      supplierName: selectedSupplier?.label || undefined,
      description: data.description || undefined,
      unit: data.unit || undefined,
      salesPrice: data.salesPrice,
      // imageUrl: data.imageUrl || undefined, // Will be set after upload
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Clean up undefined fields
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key as keyof typeof dataToSave] === undefined || dataToSave[key as keyof typeof dataToSave] === '') {
        delete dataToSave[key as keyof typeof dataToSave];
      }
    });

    try {
      // 1. Create document first to get ID
      const docRef = await addDoc(collection(firestore, "quote_items"), dataToSave);

      // 2. Upload image if exists
      if (imageFile) {
        try {
          const imageRef = ref(storage, `items/${docRef.id}/product_image.jpg`);
          await uploadBytes(imageRef, imageFile);
          const downloadURL = await getDownloadURL(imageRef);

          // Update the document with the image URL
          // We need to import updateDoc but since we just added it, we can't easily update imports in this chunk. 
          // Actually, let's just make a separate update call.
          // Wait, I missed importing updateDoc in the first chunk. I should probably add it there.
          // Or I can use setDoc with merge. But docRef is already generic.
          // Let's assume I will fix imports. 

          // Actually for now let's just use the doc ID for path, verify logic.
          // Since I can't easily change imports in multiple chunks cleanly if I missed one, 
          // I will assume updateDoc availability or use a workaround? No, better to do it right.
          // I will add updateDoc to imports in the first chunk. I'll rely on the tool to handle it.

          // RE-PLAN: I will update imports in first chunk to include updateDoc.

          const { updateDoc } = await import('firebase/firestore'); // Dynamic import to be safe if I missed it? 
          // No, better to stick to standard. I will update the first chunk to include updateDoc.

          await updateDoc(docRef, { photoURL: downloadURL, imageUrl: downloadURL });

        } catch (uploadError) {
          console.error("Error uploading image:", uploadError);
          // Don't fail the whole save, just warn
          Swal.fire({
            title: "Image Upload Failed",
            text: "Item saved, but image could not be uploaded.",
            icon: "warning"
          });
        }
      }

      Swal.fire({
        title: "Quote Item Added!",
        text: `Quote Item "${data.modelNumber}" saved successfully with ID: ${docRef.id}.`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
      form.reset({
        modelNumber: '', itemCode: '', brandName: '', countryOfOrigin: '', supplierId: '', description: '', unit: 'pcs', salesPrice: undefined, imageUrl: '',
      });
      setImageFile(null); // Reset image
    } catch (error) {
      console.error("Error adding quote item document: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save quote item: ${errorMessage}`,
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


        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingSuppliers}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Quote Item...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Quote Item
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
