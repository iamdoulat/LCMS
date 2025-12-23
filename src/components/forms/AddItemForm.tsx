
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore, storage } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { ItemFormValues, Item, SupplierDocument, PettyCashCategoryDocument, ItemSectionDocument, ItemVariationDocument } from '@/types';
import { itemSchema, itemTypeOptions } from '@/types';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { getCroppedImg } from '@/lib/image-utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package, Save, DollarSign, Warehouse, AlertTriangle, Info, Tag, MapPin, Building, Layers, Trash2, Crop as CropIcon, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Image from 'next/image';

const sectionHeadingClass = "font-semibold text-lg text-primary flex items-center gap-2 mb-4";
const PLACEHOLDER_SUPPLIER_VALUE = "__ADD_ITEM_SUPPLIER_PLACEHOLDER__";

import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';

export function AddItemForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [supplierOptions, setSupplierOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = React.useState(true);

  // Image Upload State
  const [imgSrc, setImgSrc] = React.useState('');
  const [crop, setCrop] = React.useState<Crop>();
  const [completedCrop, setCompletedCrop] = React.useState<PixelCrop>();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isCroppingDialogOpen, setIsCroppingDialogOpen] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [externalUrl, setExternalUrl] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);

  const { data: categories, isLoading: isLoadingCategories } = useFirestoreQuery<PettyCashCategoryDocument[]>(query(collection(firestore, 'item_categories'), orderBy("createdAt", "desc")), undefined, ['item_categories']);
  const { data: itemSections, isLoading: isLoadingItemSections } = useFirestoreQuery<ItemSectionDocument[]>(query(collection(firestore, 'item_sections'), orderBy("createdAt", "desc")), undefined, ['item_sections']);
  const { data: itemVariations, isLoading: isLoadingItemVariations } = useFirestoreQuery<ItemVariationDocument[]>(query(collection(firestore, 'item_variations'), orderBy("createdAt", "desc")), undefined, ['item_variations']);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      itemName: '',
      modelNumber: '',
      category: '',
      itemSection: '',
      itemType: 'Single',
      itemCode: '',
      brandName: '',
      supplierId: '',
      description: '',
      unit: 'pcs',
      salesPrice: undefined,
      purchasePrice: undefined,
      manageStock: true,
      currentQuantity: 0,
      location: '',
      idealQuantity: undefined,
      warningQuantity: undefined,
    },
  });

  const watchManageStock = form.watch("manageStock");
  const watchItemType = form.watch("itemType");

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

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined);
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
        setIsCroppingDialogOpen(true);
      });
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
      width, height
    );
    setCrop(crop);
  }

  const handleSetCroppedImage = async () => {
    const image = imgRef.current;
    if (!completedCrop || !image || !selectedFile) {
      Swal.fire("Error", "Could not process image crop. Please select and crop an image.", "error");
      return;
    }
    const croppedImageBlob = await getCroppedImg(image, completedCrop, selectedFile.name, 500, 500);
    if (croppedImageBlob) {
      setPhotoPreview(URL.createObjectURL(croppedImageBlob));
      setSelectedFile(croppedImageBlob);
      setIsCroppingDialogOpen(false);
    } else {
      Swal.fire("Error", "Failed to create cropped image.", "error");
    }
  };

  async function onSubmit(data: ItemFormValues) {
    setIsSubmitting(true);

    const selectedSupplier = supplierOptions.find(opt => opt.value === data.supplierId);

    // Generate a new document reference with an ID beforehand
    const newItemRef = doc(collection(firestore, "items"));
    let photoDownloadURL = '';

    try {
      if (selectedFile) {
        const storageRef = ref(storage, `itemImages/${newItemRef.id}/profile.jpg`);
        await uploadBytes(storageRef, selectedFile);
        photoDownloadURL = await getDownloadURL(storageRef);
      } else if (externalUrl) {
        photoDownloadURL = externalUrl;
      }

      const dataToSave: Omit<Item, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any, updatedAt: any, photoURL?: string | null } = {
        itemName: data.itemName,
        modelNumber: data.modelNumber || undefined,
        category: data.category,
        itemSection: data.itemSection,
        itemType: data.itemType,
        itemVariation: data.itemType === 'Variant' ? data.itemVariation : undefined,
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
        photoURL: photoDownloadURL || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key as keyof typeof dataToSave] === undefined) {
          delete dataToSave[key as keyof typeof dataToSave];
        }
      });

      await setDoc(newItemRef, dataToSave);

      Swal.fire({
        title: "Item Added!",
        text: `Item "${data.itemName}" saved successfully with ID: ${newItemRef.id}.`,
        icon: "success",
        timer: 1000,
        showConfirmButton: true,
      });

      form.reset({
        itemName: '', modelNumber: '', category: '', itemType: 'Single', itemVariation: '', itemCode: '', brandName: '', supplierId: '', description: '', unit: 'pcs', salesPrice: undefined, purchasePrice: undefined,
        manageStock: false, currentQuantity: 0, location: '', idealQuantity: undefined, warningQuantity: undefined,
      });
      setSelectedFile(null);
      setPhotoPreview(null);
      setExternalUrl('');

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

        <div className="flex flex-col md:flex-row gap-6">
          {/* Image Upload Section */}
          <div className="w-full md:w-1/4 flex flex-col gap-4">
            <div className="aspect-square w-full rounded-md border-2 border-dashed flex items-center justify-center bg-muted/50 overflow-hidden relative">
              <Image
                src={photoPreview && !selectedFile ? externalUrl || photoPreview : photoPreview || externalUrl || "https://placehold.co/400x400/e2e8f0/e2e8f0?text=Item+Image"}
                width={400}
                height={400}
                alt="Item image placeholder"
                className="object-cover w-full h-full"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input type="file" accept="image/*" onChange={onFileSelect} className="flex-1" />
                <Button type="button" onClick={() => { setSelectedFile(null); setPhotoPreview(null); setExternalUrl(''); }} variant="outline" size="icon" title="Clear Image">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground ml-1">Or External URL:</span>
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={externalUrl}
                  onChange={(e) => {
                    setExternalUrl(e.target.value);
                  }}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Main Form Fields */}
          <div className="flex-1 space-y-6">
            <h3 className={cn(sectionHeadingClass, "mt-0")}>
              <Package className="h-5 w-5" /> Item Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <FormField
                control={form.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
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
                name="modelNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter model number" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Layers className="mr-2 h-4 w-4 text-muted-foreground" />Category*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingCategories ? "Loading..." : "Select category"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((category) => (
                          <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="itemSection"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Layers className="mr-2 h-4 w-4 text-muted-foreground" />Item Section*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingItemSections ? "Loading..." : "Select item section"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {itemSections?.map((section) => (
                          <SelectItem key={section.id} value={section.name}>{section.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="itemType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Type*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select item type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {itemTypeOptions.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Supplier Field with increased width */}
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              {watchItemType === 'Variant' && (
                <FormField
                  control={form.control}
                  name="itemVariation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Variation</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingItemVariations ? "Loading..." : "Select variation"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {itemVariations?.map((variation) => (
                            <SelectItem key={variation.id} value={variation.name}>{variation.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
          </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      <Dialog open={isCroppingDialogOpen} onOpenChange={setIsCroppingDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Crop Image</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {imgSrc && (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  alt="Crop me"
                  src={imgSrc}
                  onLoad={onImageLoad}
                  style={{ maxHeight: '60vh' }}
                />
              </ReactCrop>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCroppingDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSetCroppedImage}>
              <CropIcon className="mr-2 h-4 w-4" />
              Set Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form >
  );
}
