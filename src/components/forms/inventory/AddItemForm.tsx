"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore, storage } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { ItemFormValues, Item, SupplierDocument, PettyCashCategoryDocument, ItemSectionDocument, ItemVariationDocument, CurrencyDocument } from '@/types';
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
import { CheckboxCombobox } from "@/components/ui/checkbox-combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Image from 'next/image';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';

const sectionHeadingClass = "font-semibold text-lg text-primary flex items-center gap-2 mb-4";
const PLACEHOLDER_SUPPLIER_VALUE = "__ADD_ITEM_SUPPLIER_PLACEHOLDER__";

export function AddItemForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [supplierOptions, setSupplierOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = React.useState(true);
  const [currencyOptions, setCurrencyOptions] = React.useState<ComboboxOption[]>([]);

  // Image Upload State
  const [imgSrc, setImgSrc] = React.useState('');
  const [crop, setCrop] = React.useState<Crop>();
  const [completedCrop, setCompletedCrop] = React.useState<PixelCrop>();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isCroppingDialogOpen, setIsCroppingDialogOpen] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [externalUrl, setExternalUrl] = React.useState('');

  const { data: categories, isLoading: isLoadingCategories } = useFirestoreQuery<PettyCashCategoryDocument[]>(query(collection(firestore, 'item_categories'), orderBy("createdAt", "desc")), undefined, ['item_categories']);
  const { data: itemSections, isLoading: isLoadingItemSections } = useFirestoreQuery<ItemSectionDocument[]>(query(collection(firestore, 'item_sections'), orderBy("createdAt", "desc")), undefined, ['item_sections']);
  const { data: itemVariations, isLoading: isLoadingItemVariations } = useFirestoreQuery<ItemVariationDocument[]>(query(collection(firestore, 'item_variations'), orderBy("createdAt", "desc")), undefined, ['item_variations']);
  const { data: currencies } = useFirestoreQuery<CurrencyDocument[]>(query(collection(firestore, 'currencies'), orderBy("name", "asc")), undefined, ['currencies']);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      itemName: '',
      modelNumber: '',
      category: '',
      itemSection: '',
      itemType: 'Single',
      itemVariation: '',
      itemCode: '',
      brandName: '',
      supplierId: '',
      currency: 'BDT', // Default to BDT
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
  const watchCurrency = form.watch("currency");

  React.useEffect(() => {
    if (currencies) {
      setCurrencyOptions(currencies.map(c => ({ value: c.code, label: `${c.code} - ${c.name} (${c.symbol})` })));
    }
  }, [currencies]);

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
    let photoDownloadURL = null;

    try {
      if (selectedFile) {
        // We need an ID for the image path, but we don't have the doc ID yet.
        // We can create a ref first or use a temp path, but usually better to let Firestore generate the ID.
        // For simplicity in Add, we might upload to a temp location or just use a timestamp based name if we don't have ID.
        // However, standard practice here is to Add Doc first then update? Or just generate ID first.
        // Let's generate a new doc ref to get an ID.
        const newDocRef = doc(collection(firestore, "items"));
        const storageRef = ref(storage, `itemImages/${newDocRef.id}/profile.jpg`);
        await uploadBytes(storageRef, selectedFile);
        photoDownloadURL = await getDownloadURL(storageRef);

        // Then set the doc with that ID
        const dataToSave = {
          ...data,
          modelNumber: data.modelNumber || undefined,
          itemVariation: data.itemType === 'Variant' ? data.itemVariation : undefined,
          itemCode: data.itemCode || undefined,
          brandName: data.brandName || undefined,
          supplierId: data.supplierId || undefined,
          supplierName: selectedSupplier?.label || undefined,
          currency: data.currency,
          description: data.description || undefined,
          unit: data.unit || undefined,
          currentQuantity: data.manageStock ? data.currentQuantity : undefined,
          location: data.manageStock ? (data.location || undefined) : undefined,
          idealQuantity: data.manageStock ? data.idealQuantity : undefined,
          warningQuantity: data.manageStock ? data.warningQuantity : undefined,
          photoURL: photoDownloadURL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        // Remove undefined keys
        Object.keys(dataToSave).forEach(key => dataToSave[key as keyof typeof dataToSave] === undefined && delete dataToSave[key as keyof typeof dataToSave]);

        await setDoc(newDocRef, dataToSave);

      } else if (externalUrl) {
        photoDownloadURL = externalUrl;
        await addDoc(collection(firestore, 'items'), {
          ...data,
          modelNumber: data.modelNumber || undefined,
          itemVariation: data.itemType === 'Variant' ? data.itemVariation : undefined,
          itemCode: data.itemCode || undefined,
          brandName: data.brandName || undefined,
          supplierId: data.supplierId || undefined,
          supplierName: selectedSupplier?.label || undefined,
          currency: data.currency,
          description: data.description || undefined,
          unit: data.unit || undefined,
          currentQuantity: data.manageStock ? data.currentQuantity : undefined,
          location: data.manageStock ? (data.location || undefined) : undefined,
          idealQuantity: data.manageStock ? data.idealQuantity : undefined,
          warningQuantity: data.manageStock ? data.warningQuantity : undefined,
          photoURL: photoDownloadURL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(firestore, 'items'), {
          ...data,
          modelNumber: data.modelNumber || undefined,
          itemVariation: data.itemType === 'Variant' ? data.itemVariation : undefined,
          itemCode: data.itemCode || undefined,
          brandName: data.brandName || undefined,
          supplierId: data.supplierId || undefined,
          supplierName: selectedSupplier?.label || undefined,
          currency: data.currency,
          description: data.description || undefined,
          unit: data.unit || undefined,
          currentQuantity: data.manageStock ? data.currentQuantity : undefined,
          location: data.manageStock ? (data.location || undefined) : undefined,
          idealQuantity: data.manageStock ? data.idealQuantity : undefined,
          warningQuantity: data.manageStock ? data.warningQuantity : undefined,
          photoURL: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      Swal.fire({
        title: "Item Added!",
        text: `Item "${data.itemName}" has been successfully added.`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });

      form.reset();
      setPhotoPreview(null);
      setExternalUrl('');
      setSelectedFile(null);
      setCrop(undefined);

    } catch (error: any) {
      console.error("Error adding item: ", error);
      Swal.fire("Error", `Failed to add item: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">

        {/* Main Details Section */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Image Upload Column */}
          <div className="w-full lg:w-1/4">
            <div className="sticky top-6 space-y-4">
              <div className="aspect-square w-full rounded-xl border-2 border-dashed border-muted-foreground/20 flex items-center justify-center bg-muted/30 overflow-hidden relative shadow-inner group">
                <Image
                  src={photoPreview || externalUrl || "https://placehold.co/400x400/f1f5f9/94a3b8?text=Product+Image"}
                  width={400}
                  height={400}
                  alt="Product preview"
                  className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input type="file" accept="image/*" onChange={onFileSelect} className="flex-1 h-10" />
                  <Button type="button" onClick={() => { setSelectedFile(null); setPhotoPreview(null); setExternalUrl(''); }} variant="outline" size="icon" className="shrink-0 hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Or Image URL</label>
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={externalUrl}
                    onChange={(e) => {
                      setExternalUrl(e.target.value);
                      if (e.target.value) setPhotoPreview(e.target.value);
                    }}
                    className="h-10 text-sm bg-muted/30"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form Fields Column */}
          <div className="flex-1 space-y-8">
            <div className="flex items-center gap-3 border-b pb-4 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold">General Information</h3>
                <p className="text-sm text-muted-foreground">Basic details about your product</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <FormField
                control={form.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel>Item Name*</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter product name" {...field} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="modelNumber"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel>Model Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Model #" {...field} value={field.value ?? ''} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="itemCode"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel>SKU / Item Code</FormLabel>
                    <FormControl>
                      <Input placeholder="Unique code" {...field} value={field.value ?? ''} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel className="flex items-center"><Layers className="mr-2 h-4 w-4 text-muted-foreground" />Category*</FormLabel>
                    <CheckboxCombobox
                      options={categories?.map(c => ({ value: c.name, label: c.name })) || []}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={isLoadingCategories ? "Loading..." : "Select category"}
                      searchPlaceholder="Search categories..."
                      className="h-11"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="itemSection"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel className="flex items-center"><Layers className="mr-2 h-4 w-4 text-muted-foreground" />Section*</FormLabel>
                    <CheckboxCombobox
                      options={itemSections?.map(s => ({ value: s.name, label: s.name })) || []}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={isLoadingItemSections ? "Loading..." : "Select section"}
                      searchPlaceholder="Search sections..."
                      className="h-11"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="itemType"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel>Item Type*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Type" />
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

              {watchItemType === 'Variant' && (
                <FormField
                  control={form.control}
                  name="itemVariation"
                  render={({ field }) => (
                    <FormItem className="col-span-1">
                      <FormLabel>Variation</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={isLoadingItemVariations ? "..." : "Variation"} />
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
                name="supplierId"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Supplier</FormLabel>
                    <Combobox
                      options={supplierOptions}
                      value={field.value || PLACEHOLDER_SUPPLIER_VALUE}
                      onValueChange={(value) => field.onChange(value === PLACEHOLDER_SUPPLIER_VALUE ? '' : value)}
                      placeholder="Search..."
                      selectPlaceholder={isLoadingSuppliers ? "Loading..." : "Select Supplier"}
                      className="h-11"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="brandName"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel className="flex items-center"><Tag className="h-4 w-4 mr-1 text-muted-foreground" />Brand</FormLabel>
                    <FormControl>
                      <Input placeholder="Brand Name" {...field} value={field.value ?? ''} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Input placeholder="pcs, kg, etc" {...field} value={field.value ?? ''} className="h-11" />
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
                    <Textarea placeholder="Detailed product description..." {...field} rows={4} className="bg-muted/10 resize-none focus:bg-background transition-colors" value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Pricing Section */}
        <Card className="border-l-4 border-l-green-500 overflow-hidden shadow-md hover:shadow-lg transition-all duration-300">
          <CardContent className="p-0">
            <div className="bg-green-50/50 dark:bg-green-950/20 px-6 py-4 border-b">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold">
                <DollarSign className="w-5 h-5" />
                <span className="uppercase tracking-wider text-sm">Pricing Strategy</span>
              </div>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Price Component</FormLabel>
                    <Combobox
                      options={[{ value: 'BDT', label: 'BDT - Bangladeshi Taka (৳)' }, ...currencyOptions.filter(c => c.value !== 'BDT')]}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Currency"
                      selectPlaceholder="Select Currency"
                      className="h-11"
                    />
                    <FormDescription className="text-[10px]">Select base currency</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salesPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling Price</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <span className="absolute left-3.5 top-2.5 text-muted-foreground font-semibold group-focus-within:text-green-600 transition-colors">
                          {watchCurrency === 'BDT' ? '৳' : currencies?.find(c => c.code === watchCurrency)?.symbol || '$'}
                        </span>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} className="pl-10 h-11 text-lg font-medium" />
                      </div>
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
                    <FormLabel>Cost Price</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <span className="absolute left-3.5 top-2.5 text-muted-foreground font-semibold group-focus-within:text-green-600 transition-colors">
                          {watchCurrency === 'BDT' ? '৳' : currencies?.find(c => c.code === watchCurrency)?.symbol || '$'}
                        </span>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} className="pl-10 h-11 text-lg font-medium" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Inventory Section */}
        <Card className="border-l-4 border-l-blue-500 overflow-hidden shadow-md hover:shadow-lg transition-all duration-300">
          <CardContent className="p-0">
            <div className="bg-blue-50/50 dark:bg-blue-950/20 px-6 py-4 border-b flex justify-between items-center">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
                <Warehouse className="w-5 h-5" />
                <span className="uppercase tracking-wider text-sm">Inventory & Stock</span>
              </div>
              <FormField
                control={form.control}
                name="manageStock"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground mr-1">Enable Management</span>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="h-5 w-5 border-blue-400 data-[state=checked]:bg-blue-500"
                    />
                  </div>
                )}
              />
            </div>

            <div className={cn("p-8 transition-all duration-500", !watchManageStock && "opacity-40 grayscale-[0.5] pointer-events-none")}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <FormField
                  control={form.control}
                  name="currentQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Balance*</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} value={field.value ?? ''} className="h-11 font-bold" />
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
                      <FormLabel className="flex items-center"><MapPin className="h-4 w-4 mr-1 text-muted-foreground" />Storage Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Warehouse/Shelf" {...field} value={field.value ?? ''} className="h-11" />
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
                      <FormLabel>Target Stock</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="100" {...field} value={field.value ?? ''} className="h-11" />
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
                      <FormLabel className="flex items-center text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Low Stock Alert
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="10"
                          {...field}
                          value={field.value ?? ''}
                          className="h-11 border-amber-200 focus-visible:ring-amber-500 font-bold"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row justify-end items-center gap-4 bg-muted/20 p-6 rounded-2xl border-2 border-dashed">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ready to Submit?</p>
            <p className="text-[10px] text-muted-foreground italic">Review all fields before saving</p>
          </div>
          <Button
            type="submit"
            className="w-full sm:w-auto h-14 px-12 text-lg font-bold shadow-xl hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            disabled={isSubmitting || isLoadingSuppliers}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Save className="mr-2 h-6 w-6" />
                Add Product to Inventory
              </>
            )}
          </Button>
        </div>

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
    </Form>
  );
}
