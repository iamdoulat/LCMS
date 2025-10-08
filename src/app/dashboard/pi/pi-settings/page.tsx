
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings, Loader2, Save, Image as ImageIcon, Crop as CropIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { firestore, storage } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { getCroppedImg } from '@/lib/image-utils';

const PI_SETTINGS_COLLECTION = 'pi_layout_settings';
const PI_SETTINGS_DOC_ID = 'main_settings';

const piSettingsSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().optional(),
  piLogoUrl: z.string().url().optional().or(z.literal('')), // For storing the final URL
});

type PiSettingsFormValues = z.infer<typeof piSettingsSchema>;

export default function PISettingsPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');

  // States for image cropping
  const [imgSrc, setImgSrc] = React.useState('');
  const [crop, setCrop] = React.useState<Crop>();
  const [completedCrop, setCompletedCrop] = React.useState<PixelCrop>();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isCroppingDialogOpen, setIsCroppingDialogOpen] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [piLogoPreviewUrl, setPiLogoPreviewUrl] = React.useState<string | undefined>(undefined);


  const form = useForm<PiSettingsFormValues>({
    resolver: zodResolver(piSettingsSchema),
    defaultValues: {
      name: '',
      address: '',
      email: '',
      phone: '',
      piLogoUrl: '',
    },
  });

  React.useEffect(() => {
    const fetchSettings = async () => {
      setIsLoadingData(true);
      try {
        const docRef = doc(firestore, PI_SETTINGS_COLLECTION, PI_SETTINGS_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          form.reset(data);
          if (data.piLogoUrl) {
            setPiLogoPreviewUrl(data.piLogoUrl);
          }
        }
      } catch (error) {
        console.error("Error fetching PI settings:", error);
        Swal.fire("Error", "Could not load PI settings.", "error");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchSettings();
  }, [form]);

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
    const aspect = 413 / 28; // Aspect ratio for the logo
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height),
      width, height
    );
    setCrop(crop);
  }

   const handleCropAndSet = async () => {
    if (!completedCrop || !imgRef.current || !selectedFile) {
      Swal.fire("Error", "Could not process image crop. Please select and crop an image.", "error");
      return;
    }
    const croppedImageBlob = await getCroppedImg(
      imgRef.current,
      completedCrop,
      selectedFile.name
    );
    if (croppedImageBlob) {
      const tempUrl = URL.createObjectURL(croppedImageBlob);
      setPiLogoPreviewUrl(tempUrl);
      setSelectedFile(croppedImageBlob); // Important: Use the cropped blob for submission
      setIsCroppingDialogOpen(false);
      Swal.fire("Logo Staged", "New logo is ready. Click 'Save Settings' to apply the change.", "info");
    } else {
      Swal.fire("Error", "Failed to create cropped image.", "error");
    }
  };


  async function onSubmit(data: PiSettingsFormValues) {
    setIsSubmitting(true);
    let finalLogoUrl = form.getValues('piLogoUrl');

    try {
      // If a new file was selected and cropped, upload it
      if (selectedFile) {
        setIsUploading(true);
        const storageRef = ref(storage, `piLayoutSettings/pi_logo.jpg`);
        const snapshot = await uploadBytes(storageRef, selectedFile);
        finalLogoUrl = await getDownloadURL(snapshot.ref);
        setIsUploading(false);
      }

      const dataToSave = {
        ...data,
        piLogoUrl: finalLogoUrl, // Use the new or existing URL
        updatedAt: serverTimestamp(),
      };

      const docRef = doc(firestore, PI_SETTINGS_COLLECTION, PI_SETTINGS_DOC_ID);
      await setDoc(docRef, dataToSave, { merge: true });

      Swal.fire({
        title: "Settings Saved!",
        text: "Your PI layout settings have been updated.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      // Clear the file state after successful save
      setSelectedFile(null);

    } catch (error) {
      console.error("Error saving PI settings:", error);
      Swal.fire("Save Failed", "Could not save your settings.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingData) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Settings className="h-7 w-7 text-primary" />
            PI Settings
          </CardTitle>
          <CardDescription>
            Manage settings for Proforma Invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Enter a name" {...field} value={field.value ?? ""} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" placeholder="Enter a phone number" {...field} value={field.value ?? ""} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)}/>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Textarea placeholder="Enter an address" {...field} value={field.value ?? ""} rows={3} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="Enter an email" {...field} value={field.value ?? ""} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)}/>
                </div>

                 <Dialog open={isCroppingDialogOpen} onOpenChange={setIsCroppingDialogOpen}>
                    <DialogContent className="max-w-xl">
                        <DialogHeader><DialogTitle>Crop PI Logo (413x28px)</DialogTitle></DialogHeader>
                        {imgSrc && (
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={413 / 28}
                                minWidth={100}
                            >
                                <img ref={imgRef} src={imgSrc} alt="Crop preview" onLoad={onImageLoad} style={{ maxHeight: '70vh' }}/>
                            </ReactCrop>
                        )}
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleCropAndSet} disabled={!completedCrop?.width}>
                                <CropIcon className="mr-2 h-4 w-4" />Set Cropped Image
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <FormItem>
                  <Label>PI Header Logo</Label>
                  <div className="flex items-center gap-4">
                      <div className="w-48 h-auto aspect-[413/28] rounded-md border border-dashed flex items-center justify-center bg-muted/50 overflow-hidden">
                          {piLogoPreviewUrl ? (
                              <Image
                                src={piLogoPreviewUrl}
                                alt="PI logo preview"
                                width={413}
                                height={28}
                                className="object-contain"
                                data-ai-hint="company logo"
                              />
                          ) : (
                              <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          )}
                      </div>
                      <Input id="pi-logo-upload" type="file" accept="image/png, image/jpeg" onChange={onFileSelect} className="flex-1" disabled={isReadOnly} />
                  </div>
                  <FormDescription>Upload a 413x28 pixels logo for the PI header.</FormDescription>
                </FormItem>


              <Button type="submit" disabled={isSubmitting || isReadOnly}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save Settings
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
