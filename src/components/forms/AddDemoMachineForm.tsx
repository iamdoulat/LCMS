
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Laptop, Activity, Cog, Hash, FileText, FileBadge, Image as ImageIcon, Crop as CropIcon } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore, storage } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { DemoMachine, DemoMachineOwnerOption, DemoMachineStatusOption } from '@/types';
import { demoMachineOwnerOptions, demoMachineStatusOptions } from '@/types';
import Image from 'next/image';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { getCroppedImg } from '@/lib/image-utils';

const demoMachineSchema = z.object({
  machineModel: z.string().min(1, "Machine Model is required"),
  machineSerial: z.string().min(1, "Machine Serial is required"),
  machineBrand: z.string().min(1, "Machine Brand is required"),
  motorOrControlBoxModel: z.string().optional(),
  controlBoxSerialNo: z.string().optional(),
  machineOwner: z.enum(demoMachineOwnerOptions, { required_error: "Machine Owner selection is required" }),
  currentStatus: z.enum(demoMachineStatusOptions, { required_error: "Current Machine Status is required" }).default(demoMachineStatusOptions[0]),
  machineFeatures: z.string().optional(),
  note: z.string().optional(),
});

type DemoMachineFormValues = z.infer<typeof demoMachineSchema>;

export function AddDemoMachineForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // States for image cropping
  const [imgSrc, setImgSrc] = React.useState('');
  const [crop, setCrop] = React.useState<Crop>();
  const [completedCrop, setCompletedCrop] = React.useState<PixelCrop>();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isCroppingDialogOpen, setIsCroppingDialogOpen] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [croppedImageUrl, setCroppedImageUrl] = React.useState<string | null>(null);

  const form = useForm<DemoMachineFormValues>({
    resolver: zodResolver(demoMachineSchema),
    defaultValues: {
      machineModel: '',
      machineSerial: '',
      machineBrand: '',
      motorOrControlBoxModel: '',
      controlBoxSerialNo: '',
      machineOwner: demoMachineOwnerOptions[0],
      currentStatus: demoMachineStatusOptions[0],
      machineFeatures: '',
      note: '',
    },
  });

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Reset crop state
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
        setIsCroppingDialogOpen(true);
      });
      reader.readAsDataURL(file);
      e.target.value = ''; // Reset file input
    }
  };

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const aspect = 1; // 512x512 is a 1:1 aspect ratio
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height),
      width, height
    );
    setCrop(crop);
  }

  const handleSetCroppedImage = async () => {
    if (!completedCrop || !imgRef.current || !selectedFile) {
        Swal.fire("Error", "Could not process image crop. Please select and crop an image.", "error");
        return;
    }
    const croppedImageBlob = await getCroppedImg(
        imgRef.current,
        completedCrop,
        selectedFile.name,
        512, // target width
        512  // target height
    );
    if (croppedImageBlob) {
        const tempUrl = URL.createObjectURL(croppedImageBlob);
        setCroppedImageUrl(tempUrl); // Set a temporary URL for preview
        setSelectedFile(croppedImageBlob); // Replace the original file with the cropped blob
        setIsCroppingDialogOpen(false);
    } else {
        Swal.fire("Error", "Failed to create cropped image.", "error");
    }
  };

  async function onSubmit(data: DemoMachineFormValues) {
    setIsSubmitting(true);

    try {
      // 1. Create the document reference first to get an ID
      const docRef = doc(collection(firestore, "demo_machines"));
      const machineId = docRef.id;

      let imageUrl: string | undefined = undefined;

      // 2. If a cropped image exists, upload it
      if (selectedFile) {
        const storageRef = ref(storage, `demoMachineImages/${machineId}/image.jpg`);
        const snapshot = await uploadBytes(storageRef, selectedFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      // 3. Prepare the final data with the image URL
      const dataToSave: Omit<DemoMachine, 'id' | 'createdAt' | 'updatedAt' | 'machineReturned'> & { createdAt: any, updatedAt: any, imageUrl?: string } = {
        ...data,
        motorOrControlBoxModel: data.motorOrControlBoxModel || undefined,
        controlBoxSerialNo: data.controlBoxSerialNo || undefined,
        machineFeatures: data.machineFeatures || undefined,
        note: data.note || undefined,
        imageUrl: imageUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      const cleanedDataToSave: { [key: string]: any } = {};
      for (const key in dataToSave) {
        const value = (dataToSave as any)[key];
        if (value !== undefined) {
          cleanedDataToSave[key] = value;
        }
      }
      
      // 4. Use setDoc to create the document with all the data
      await setDoc(docRef, cleanedDataToSave);

      Swal.fire({
        title: "Demo Machine Saved!",
        text: `Demo Machine data saved successfully with ID: ${machineId}.`,
        icon: "success",
        timer: 3000,
        showConfirmButton: true,
      });

      // Reset form and image states
      form.reset();
      setImgSrc('');
      setCompletedCrop(undefined);
      setSelectedFile(null);
      setCroppedImageUrl(null);
      setIsCroppingDialogOpen(false);

    } catch (error) {
      console.error("Error adding demo machine document: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save demo machine: ${errorMessage}`,
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
                  <Input placeholder="Enter model" {...field} />
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
                  <Input placeholder="Enter serial number" {...field} />
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
                    value={field.value}
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
                    value={field.value}
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
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSetCroppedImage} disabled={!completedCrop?.width}>
                        <CropIcon className="mr-2 h-4 w-4" />Set Cropped Image
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <FormItem>
          <FormLabel>Machine Image</FormLabel>
          <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-md border border-dashed flex items-center justify-center bg-muted/50 overflow-hidden">
                  {croppedImageUrl ? (
                      <Image
                        src={croppedImageUrl}
                        alt="Cropped preview"
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
                <Textarea placeholder="Describe machine features (e.g., color, special functions)" {...field} rows={3} />
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
                <Textarea placeholder="Enter any additional notes for this machine" {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Demo Machine...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Demo Machine
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
