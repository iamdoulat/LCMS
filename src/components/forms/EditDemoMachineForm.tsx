
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Laptop, Activity, Cog, Hash, FileText, FileBadge, Image as ImageIcon, Crop as CropIcon } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore, storage } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { DemoMachineDocument, DemoMachineOwnerOption, DemoMachineStatusOption } from '@/types';
import { demoMachineOwnerOptions, demoMachineStatusOptions } from '@/types';
import Image from 'next/image';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { getCroppedImg } from '@/lib/image-utils';

const demoMachineSchema = z.object({
  machineModel: z.string().min(1, "Machine Model is required"),
  machineSerial: z.string().min(1, "Machine Serial is required"),
  machineBrand: z.string().min(1, "Machine Brand is required"),
  motorOrControlBoxModel: z.string().optional(),
  controlBoxSerialNo: z.string().optional(),
  machineOwner: z.enum(demoMachineOwnerOptions, { required_error: "Machine Owner selection is required" }),
  currentStatus: z.enum(demoMachineStatusOptions, { required_error: "Current Machine Status is required" }),
  machineReturned: z.boolean().optional().default(false),
  machineFeatures: z.string().optional(),
  note: z.string().optional(),
  imageUrl: z.string().optional(), // Added to track image URL in form state
});

type DemoMachineEditFormValues = z.infer<typeof demoMachineSchema>;

interface EditDemoMachineFormProps {
  initialData: DemoMachineDocument;
  machineId: string;
}

export function EditDemoMachineForm({ initialData, machineId }: EditDemoMachineFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isInitialMountRef = React.useRef(true);
  
  const [imgSrc, setImgSrc] = React.useState('');
  const [crop, setCrop] = React.useState<Crop>();
  const [completedCrop, setCompletedCrop] = React.useState<PixelCrop>();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isCroppingDialogOpen, setIsCroppingDialogOpen] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const form = useForm<DemoMachineEditFormValues>({
    resolver: zodResolver(demoMachineSchema),
    defaultValues: {
      machineModel: '',
      machineSerial: '',
      machineBrand: '',
      motorOrControlBoxModel: '',
      controlBoxSerialNo: '',
      machineOwner: demoMachineOwnerOptions[0],
      currentStatus: demoMachineStatusOptions[0],
      machineReturned: false,
      machineFeatures: '',
      note: '',
      imageUrl: '',
    },
  });

  const { watch, setValue } = form;
  const watchedMachineReturned = watch("machineReturned");
  const currentImageUrl = watch("imageUrl");

  React.useEffect(() => {
    if (initialData) {
      form.reset({
        machineModel: initialData.machineModel || '',
        machineSerial: initialData.machineSerial || '',
        machineBrand: initialData.machineBrand || '',
        motorOrControlBoxModel: initialData.motorOrControlBoxModel || '',
        controlBoxSerialNo: initialData.controlBoxSerialNo || '',
        machineOwner: initialData.machineOwner || demoMachineOwnerOptions[0],
        currentStatus: initialData.currentStatus || demoMachineStatusOptions[0],
        machineReturned: initialData.machineReturned ?? false,
        machineFeatures: initialData.machineFeatures || '',
        note: initialData.note || '',
        imageUrl: initialData.imageUrl || '',
      });
      setTimeout(() => { isInitialMountRef.current = false; }, 0);
    }
  }, [initialData, form]);

  React.useEffect(() => {
    if (isInitialMountRef.current) return;
    if (watchedMachineReturned) {
      setValue("currentStatus", "Available", { shouldValidate: true, shouldDirty: true });
    } else {
      if (form.getValues("currentStatus") !== "Maintenance Mode") {
        setValue("currentStatus", "Allocated", { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [watchedMachineReturned, setValue, form]);

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

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const aspect = 1;
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height),
      width, height
    );
    setCrop(crop);
  }

  const handleCropAndUpload = async () => {
    if (!completedCrop || !imgRef.current || !selectedFile) {
        Swal.fire("Error", "Could not process image crop. Please try again.", "error");
        return;
    }
    setIsUploading(true);
    try {
        const croppedImageBlob = await getCroppedImg(
            imgRef.current,
            completedCrop,
            selectedFile.name,
            512, 512
        );
        if (!croppedImageBlob) {
            throw new Error("Failed to create cropped image blob.");
        }
        const storageRef = ref(storage, `demoMachineImages/${machineId}/image.jpg`);
        const snapshot = await uploadBytes(storageRef, croppedImageBlob);
        const downloadURL = await getDownloadURL(snapshot.ref);

        await updateDoc(doc(firestore, "demo_machines", machineId), {
            imageUrl: downloadURL,
            updatedAt: serverTimestamp(),
        });
        
        setValue("imageUrl", downloadURL, { shouldDirty: true });
        
        setIsCroppingDialogOpen(false);
        Swal.fire({
            title: "Image Updated",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
        });

    } catch (err: any) {
        console.error("Error uploading demo machine image:", err);
        Swal.fire("Upload Failed", `Failed to upload image: ${err.message}`, "error");
    } finally {
        setIsUploading(false);
    }
  };

  async function onSubmit(data: DemoMachineEditFormValues) {
    setIsSubmitting(true);

    try {
      const dataToUpdate: Partial<Omit<DemoMachineDocument, 'id' | 'createdAt'>> & { updatedAt: any } = {
        machineModel: data.machineModel,
        machineSerial: data.machineSerial,
        machineBrand: data.machineBrand,
        machineOwner: data.machineOwner,
        currentStatus: data.currentStatus,
        machineReturned: data.machineReturned,
        imageUrl: data.imageUrl || undefined,
        updatedAt: serverTimestamp(),
      };
      
      const optionalFields: (keyof DemoMachineEditFormValues)[] = [
        'motorOrControlBoxModel',
        'controlBoxSerialNo',
        'machineFeatures',
        'note',
      ];
      optionalFields.forEach(field => {
        const value = data[field];
        if (value) {
            (dataToUpdate as any)[field] = value;
        }
    });
      
      const cleanedDataToUpdate: { [key: string]: any } = {};
      for (const key in dataToUpdate) {
        const value = (dataToUpdate as any)[key];
        if (value !== undefined) {
          cleanedDataToUpdate[key] = value;
        }
      }

      const machineDocRef = doc(firestore, "demo_machines", machineId);
      await updateDoc(machineDocRef, cleanedDataToUpdate);

      Swal.fire({
        title: "Demo Machine Updated!",
        text: `Demo Machine (ID: ${machineId}) has been successfully updated.`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });

    } catch (error: any) {
      const errorMessage = error.message || "An unknown error occurred.";
      Swal.fire({
        title: "Update Failed",
        text: `Failed to update demo machine: ${errorMessage}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="machineModel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Machine Model*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter machine model" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="machineBrand"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Machine Brand*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter machine brand" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="machineSerial"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Hash className="mr-1 h-3.5 w-3.5 text-muted-foreground"/>Machine Serial*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter machine serial number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="motorOrControlBoxModel"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Cog className="mr-1 h-3.5 w-3.5 text-muted-foreground"/>Motor or Control Box Model</FormLabel>
                <FormControl>
                  <Input placeholder="Enter model" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="controlBoxSerialNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Hash className="mr-1 h-3.5 w-3.5 text-muted-foreground"/>Control Box Serial No.</FormLabel>
                <FormControl>
                  <Input placeholder="Enter serial number" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="machineOwner"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="flex items-center"><Laptop className="mr-2 h-4 w-4 text-muted-foreground" />Machine Owner*</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value ?? demoMachineOwnerOptions[0]}
                    className="flex flex-col space-y-1 sm:flex-row sm:space-y-0 sm:space-x-4"
                  >
                    {demoMachineOwnerOptions.map((option) => (
                      <FormItem key={option} className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value={option} />
                        </FormControl>
                        <FormLabel className="font-normal">{option}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currentStatus"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="flex items-center"><Activity className="mr-2 h-4 w-4 text-muted-foreground" />Current Machine Status*</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value ?? demoMachineStatusOptions[0]}
                    className="flex flex-col space-y-1 sm:flex-row sm:space-y-0 sm:space-x-4"
                  >
                    {demoMachineStatusOptions.map((option) => (
                      <FormItem key={option} className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value={option} />
                        </FormControl>
                        <FormLabel className="font-normal">{option}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
         <FormField
          control={form.control}
          name="machineReturned"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-card">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="machineReturnedMachineForm"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel htmlFor="machineReturnedMachineForm" className="text-sm font-medium hover:cursor-pointer">
                  Machine Returned by Factory
                </FormLabel>
                <FormDescription className="text-xs">
                  Check this if this specific demo machine has been returned by the factory.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        
        <Dialog open={isCroppingDialogOpen} onOpenChange={setIsCroppingDialogOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Crop Machine Image (1:1)</DialogTitle></DialogHeader>
                {imgSrc && (
                    <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={1}
                        minWidth={100}
                    >
                        <img ref={imgRef} src={imgSrc} alt="Crop preview" onLoad={onImageLoad} style={{ maxHeight: '70vh' }}/>
                    </ReactCrop>
                )}
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={isUploading}>Cancel</Button></DialogClose>
                    <Button onClick={handleCropAndUpload} disabled={isUploading || !completedCrop?.width}>
                        {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Uploading...</> : <><CropIcon className="mr-2 h-4 w-4" />Crop & Upload</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <FormItem>
          <FormLabel>Machine Image</FormLabel>
          <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-md border border-dashed flex items-center justify-center bg-muted/50 overflow-hidden">
                  {currentImageUrl ? (
                       <Image
                        src={currentImageUrl}
                        alt="Machine preview"
                        width={96}
                        height={96}
                        className="object-cover"
                        data-ai-hint="sewing machine"
                      />
                  ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
              </div>
              <Input id="machine-image-upload" type="file" accept="image/png, image/jpeg" onChange={onFileSelect} className="flex-1" />
          </div>
          <FormDescription>Upload a 512x512 image for the demo machine.</FormDescription>
        </FormItem>

        <FormField
          control={form.control}
          name="machineFeatures"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Machine features:</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe machine features (e.g., color, special functions)" {...field} rows={3} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Note:</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter any additional notes for this machine" {...field} rows={3} value={field.value ?? ''}/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
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
