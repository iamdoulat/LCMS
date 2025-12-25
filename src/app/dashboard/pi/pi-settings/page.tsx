
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Image as ImageIcon, Crop as CropIcon, Settings } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { firestore, storage } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { CompanyProfile } from '@/types';
import Image from 'next/image';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { getCroppedImg } from '@/lib/image-utils';
import { Checkbox } from '@/components/ui/checkbox';

const PI_SETTINGS_COLLECTION = 'pi_layout_settings';
const PI_SETTINGS_DOC_ID = 'main_settings';

const piSettingsSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().optional(),
  piLogoUrl: z.string().url("Invalid URL format").optional().or(z.literal('')),
  hidePiHeaderLogo: z.boolean().optional().default(false),
  logoWidth: z.number().min(16).max(512).optional().default(64),
  logoHeight: z.number().min(16).max(512).optional().default(64),
});

type PiSettingsFormValues = z.infer<typeof piSettingsSchema>;

export default function PISettingsPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');

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
      hidePiHeaderLogo: false,
      logoWidth: 64,
      logoHeight: 64,
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
          form.reset({
            ...data,
            hidePiHeaderLogo: data.hidePiHeaderLogo ?? false,
          });
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
    const logoWidth = form.getValues('logoWidth') || 64;
    const logoHeight = form.getValues('logoHeight') || 64;
    const aspect = logoWidth / logoHeight;
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
      setSelectedFile(croppedImageBlob);
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
      if (selectedFile) {
        setIsUploading(true);
        const storageRef = ref(storage, `piLayoutSettings/pi_logo.jpg`);
        const snapshot = await uploadBytes(storageRef, selectedFile);
        finalLogoUrl = await getDownloadURL(snapshot.ref);
        setIsUploading(false);
      }

      const dataToSave = {
        ...data,
        piLogoUrl: finalLogoUrl,
        updatedAt: serverTimestamp(),
      };

      const docRef = doc(firestore, PI_SETTINGS_COLLECTION, PI_SETTINGS_DOC_ID);
      await setDoc(docRef, dataToSave, { merge: true });

      Swal.fire({
        title: "Settings Saved!",
        text: "Your PI layout settings have been updated.",
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
      });

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
    <div className="max-w-none mx-[25px] py-8 px-0">
      <Card className="mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Enter a name" {...field} value={field.value ?? ""} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="236A Serangoon Road, #02-236A, Singapore 218084&#x0a;Registration No. 201610840K" {...field} value={field.value ?? ""} rows={1} className="h-10" disabled={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" placeholder="Enter a phone number" {...field} value={field.value ?? ""} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="Enter an email" {...field} value={field.value ?? ""} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <Dialog open={isCroppingDialogOpen} onOpenChange={setIsCroppingDialogOpen}>
                <DialogContent className="max-w-xl">
                  <DialogHeader><DialogTitle>Crop PI Logo ({form.watch('logoWidth') || 64}x{form.watch('logoHeight') || 64}px)</DialogTitle></DialogHeader>
                  {imgSrc && (
                    <ReactCrop
                      crop={crop}
                      onChange={(_, percentCrop) => setCrop(percentCrop)}

                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={(form.watch('logoWidth') || 64) / (form.watch('logoHeight') || 64)}
                      minWidth={form.watch('logoWidth') || 64}
                    >
                      <img ref={imgRef} src={imgSrc} alt="Crop preview" onLoad={onImageLoad} style={{ maxHeight: '70vh' }} />
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="hidePiHeaderLogo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            id="hidePiHeaderLogo"
                            disabled={isReadOnly}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel htmlFor="hidePiHeaderLogo" className="hover:cursor-pointer">
                            Hide PI Header Logo
                          </FormLabel>
                          <FormDescription>
                            If checked, the logo will not be printed on the PI header.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="piLogoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>External PI Header Logo URL</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder="https://example.com/logo.png"
                            {...field}
                            value={field.value || ""}
                            disabled={isReadOnly}
                          />
                        </FormControl>
                        <FormDescription>Use this URL if no file is uploaded.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="logoWidth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logo Width (px)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="16"
                              max="512"
                              placeholder="64"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 64)}
                              value={field.value || 64}
                              disabled={isReadOnly}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="logoHeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logo Height (px)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="16"
                              max="512"
                              placeholder="64"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 64)}
                              value={field.value || 64}
                              disabled={isReadOnly}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormItem>
                    <Label>PI Header Logo</Label>
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-32 rounded-md border border-dashed flex items-center justify-center bg-muted/50 overflow-hidden">
                        {piLogoPreviewUrl ? (
                          <Image
                            src={piLogoPreviewUrl}
                            alt="PI logo preview"
                            width={form.watch('logoWidth') || 64}
                            height={form.watch('logoHeight') || 64}
                            className="object-contain"
                            data-ai-hint="company logo"
                          />
                        ) : (
                          <ImageIcon className="h-12 w-12 text-muted-foreground" />
                        )}
                      </div>
                      <Input id="pi-logo-upload" type="file" accept="image/png, image/jpeg" onChange={onFileSelect} className="flex-1" disabled={isReadOnly} />
                    </div>
                    <FormDescription>Upload a {form.watch('logoWidth') || 64}x{form.watch('logoHeight') || 64} pixels logo for the PI header.</FormDescription>
                  </FormItem>
                </div>
              </div>


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
    </div >
  );
}
