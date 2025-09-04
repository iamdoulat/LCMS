
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserPlus, Save, Image as ImageIcon, Crop as CropIcon } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore, storage } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format } from 'date-fns';
import Image from 'next/image';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DatePickerField } from './DatePickerField';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { getCroppedImg } from '@/lib/image-utils';
import type { EmployeeFormValues } from '@/types';
import { EmployeeSchema, genderOptions, maritalStatusOptions, bloodGroupOptions } from '@/types';

export function AddEmployeeForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Image cropping states
  const [imgSrc, setImgSrc] = React.useState('');
  const [crop, setCrop] = React.useState<Crop>();
  const [completedCrop, setCompletedCrop] = React.useState<PixelCrop>();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isCroppingDialogOpen, setIsCroppingDialogOpen] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [croppedImageUrl, setCroppedImageUrl] = React.useState<string | null>(null);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: {
      employeeCode: '',
      fullName: '',
      email: '',
      phone: '',
      dateOfBirth: undefined,
      gender: undefined,
      maritalStatus: undefined,
      nationalId: '',
      bloodGroup: undefined,
      photoURL: '',
    },
  });

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined);
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(file);
      setIsCroppingDialogOpen(true);
      e.target.value = '';
    }
  };

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 1, width, height), width, height));
  }

  const handleSetCroppedImage = async () => {
    if (!completedCrop || !imgRef.current || !selectedFile) {
      Swal.fire("Error", "Could not process image crop.", "error");
      return;
    }
    const croppedBlob = await getCroppedImg(imgRef.current, completedCrop, selectedFile.name, 256, 256);
    if (croppedBlob) {
      setCroppedImageUrl(URL.createObjectURL(croppedBlob));
      setSelectedFile(croppedBlob);
      setIsCroppingDialogOpen(false);
    } else {
      Swal.fire("Error", "Failed to create cropped image.", "error");
    }
  };

  async function onSubmit(data: EmployeeFormValues) {
    setIsSubmitting(true);
    let imageUrl: string | undefined = undefined;

    try {
      const docRef = doc(collection(firestore, "employees")); // Generate ID beforehand
      const employeeId = docRef.id;

      if (selectedFile) {
        const storageRef = ref(storage, `employeeImages/${employeeId}/profile.jpg`);
        const snapshot = await uploadBytes(storageRef, selectedFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      const dataToSave = {
        ...data,
        dateOfBirth: format(data.dateOfBirth, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        photoURL: imageUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      const cleanedDataToSave: { [key: string]: any } = {};
      for (const key in dataToSave) {
          const value = (dataToSave as any)[key];
          if (value !== undefined && value !== '') {
              cleanedDataToSave[key] = value;
          }
      }

      await setDoc(docRef, cleanedDataToSave);
      
      Swal.fire("Employee Added!", `Employee ${data.fullName} has been added successfully.`, "success");
      form.reset();
      setCroppedImageUrl(null);
      setSelectedFile(null);

    } catch (error) {
      console.error("Error adding employee: ", error);
      Swal.fire("Save Failed", `Failed to add employee: ${(error as Error).message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-1 space-y-4">
            <FormItem>
              <FormLabel>Profile Picture</FormLabel>
              <div className="flex flex-col items-center gap-4">
                <div className="w-32 h-32 rounded-full border-2 border-dashed flex items-center justify-center bg-muted/50 overflow-hidden">
                  {croppedImageUrl ? (
                    <Image src={croppedImageUrl} alt="Profile preview" width={128} height={128} className="object-cover" data-ai-hint="person face" />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                <Input id="profile-picture-upload" type="file" accept="image/png, image/jpeg" onChange={onFileSelect} />
              </div>
            </FormItem>
          </div>
          <div className="md:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="employeeCode" render={({ field }) => (<FormItem><FormLabel>Employee Code*</FormLabel><FormControl><Input placeholder="e.g., EMP-001" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name*</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address*</FormLabel><FormControl><Input type="email" placeholder="employee@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number*</FormLabel><FormControl><Input type="tel" placeholder="+1234567890" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
          </div>
        </div>

        <Separator />

        <h3 className="text-lg font-semibold text-primary">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FormField control={form.control} name="dateOfBirth" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Date of Birth*</FormLabel><DatePickerField field={field} /><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl><SelectContent>{genderOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="maritalStatus" render={({ field }) => (<FormItem><FormLabel>Marital Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{maritalStatusOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="bloodGroup" render={({ field }) => (<FormItem><FormLabel>Blood Group</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger></FormControl><SelectContent>{bloodGroupOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="nationalId" render={({ field }) => (<FormItem><FormLabel>National ID</FormLabel><FormControl><Input placeholder="Enter NID number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
        </div>

        <Dialog open={isCroppingDialogOpen} onOpenChange={setIsCroppingDialogOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Crop Profile Image</DialogTitle></DialogHeader>
                {imgSrc && (
                    <ReactCrop
                        crop={crop}
                        onChange={(_, c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={1}
                        circularCrop
                        minWidth={100}
                    >
                        <img ref={imgRef} src={imgSrc} alt="Crop preview" onLoad={onImageLoad} style={{ maxHeight: '70vh' }}/>
                    </ReactCrop>
                )}
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSetCroppedImage} disabled={!completedCrop?.width}>
                        <CropIcon className="mr-2 h-4 w-4" />Set Image
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Employee...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> Save Employee Profile</>
          )}
        </Button>
      </form>
    </Form>
  );
}
