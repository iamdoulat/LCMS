
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Upload, Crop as CropIcon, Image as ImageIcon } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { firestore, storage } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { CompanyProfile } from '@/types';
import Image from 'next/image';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { getCroppedImg } from '@/lib/image-utils';


const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const COMPANY_PROFILE_DOC_ID = 'main_settings';

interface FinancialSettingsProfile {
  companyName?: string;
  address?: string;
  invoiceLogoUrl?: string;
  companyLogoUrl?: string;
  emailId?: string;
  cellNumber?: string;
  hideCompanyName?: boolean;
  updatedAt?: any;
}


const financialSettingsSchema = z.object({
  companyName: z.string().optional(),
  address: z.string().optional(),
  cellNumber: z.string().regex(/^\+?[0-9\s-()]*$/, "Invalid phone number format").optional().or(z.literal('')),
  emailId: z.string().email("Invalid email address").optional().or(z.literal('')),
  hideCompanyName: z.boolean().optional().default(false),
});

type FinancialSettingsFormValues = z.infer<typeof financialSettingsSchema>;


const DEFAULT_COMPANY_NAME = 'Smart Solution';
const DEFAULT_ADDRESS = 'House#50, Road#10, Sector#10, Uttara Model Town, Dhaka-1230';
const DEFAULT_EMAIL = 'info@smartsolution-bd.com';
const DEFAULT_COMPANY_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";


export function FinancialDocumentSettingsForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  
  // States for invoice logo
  const [invoiceLogoSrc, setInvoiceLogoSrc] = React.useState('');
  const [invoiceLogoCrop, setInvoiceLogoCrop] = React.useState<Crop>();
  const [invoiceLogoCompletedCrop, setInvoiceLogoCompletedCrop] = React.useState<PixelCrop>();
  const [invoiceLogoSelectedFile, setInvoiceLogoSelectedFile] = React.useState<File | null>(null);
  const [isInvoiceLogoCropping, setIsInvoiceLogoCropping] = React.useState(false);
  const [invoiceLogoUrl, setInvoiceLogoUrl] = React.useState<string | undefined>(undefined);
  const invoiceLogoImgRef = React.useRef<HTMLImageElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  const form = useForm<FinancialSettingsFormValues>({
    resolver: zodResolver(financialSettingsSchema),
    defaultValues: {
      companyName: '',
      address: '',
      emailId: '',
      cellNumber: '',
      hideCompanyName: false,
    },
  });

  React.useEffect(() => {
    const fetchFinancialSettings = async () => {
      setIsLoadingData(true);
      try {
        const profileDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, COMPANY_PROFILE_DOC_ID);
        const profileDocSnap = await getDoc(profileDocRef);
        
        if (profileDocSnap.exists()) {
          const data = profileDocSnap.data() as FinancialSettingsProfile;
          form.reset({
            companyName: data.companyName || '',
            address: data.address || '',
            emailId: data.emailId || '',
            cellNumber: data.cellNumber || '',
            hideCompanyName: data.hideCompanyName ?? false,
          });
          setInvoiceLogoUrl(data.invoiceLogoUrl);
        }
      } catch (error) {
        console.error("FinancialDocumentSettingsForm: Error fetching settings:", error);
        Swal.fire("Error", "Could not load financial settings.", "error");
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchFinancialSettings();
  }, [form]);

  const onFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      setInvoiceLogoCrop(undefined); // Reset crop state
      const file = e.target.files[0];
      setInvoiceLogoSelectedFile(file);
      const reader = new FileReader();
      reader.addEventListener('load', () => setInvoiceLogoSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(file);
      setIsInvoiceLogoCropping(true);
      e.target.value = '';
    }
  };

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const aspect = 396 / 58;
    setInvoiceLogoCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height), width, height));
  }
  
  const handleCropAndUpload = async () => {
    if (!invoiceLogoCompletedCrop || !invoiceLogoImgRef.current || !invoiceLogoSelectedFile) {
        Swal.fire("Error", "Could not process image crop. Please try again.", "error");
        return;
    }
    setIsUploading(true);
    try {
        const croppedImageBlob = await getCroppedImg(
            invoiceLogoImgRef.current,
            invoiceLogoCompletedCrop,
            invoiceLogoSelectedFile.name
        );
        if (!croppedImageBlob) {
            throw new Error("Failed to create cropped image blob.");
        }
        
        const storageRef = ref(storage, 'companyLogos/invoice_logo.jpg');
        const snapshot = await uploadBytes(storageRef, croppedImageBlob);
        const downloadURL = await getDownloadURL(snapshot.ref);

        setInvoiceLogoUrl(downloadURL); // Update state for preview
        setInvoiceLogoSelectedFile(null); // Clear selected file after upload
        setIsInvoiceLogoCropping(false);
        
        Swal.fire({
            title: "Logo Cropped & Staged",
            text: "Your new logo is ready. Click 'Save Settings' to apply it.",
            icon: "success",
            timer: 1000,
            showConfirmButton: false,
        });
    } catch (err: any) {
        console.error("Error handling crop and upload:", err);
        Swal.fire("Upload Failed", `Failed to prepare image: ${err.message}`, "error");
    } finally {
        setIsUploading(false);
    }
  };

  async function onSubmit(data: FinancialSettingsFormValues) {
    setIsSubmitting(true);
    
    const dataToSave: FinancialSettingsProfile = {
        ...data,
        invoiceLogoUrl: invoiceLogoUrl,
        updatedAt: serverTimestamp(),
    };
    
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key as keyof FinancialSettingsProfile] === undefined) {
        delete dataToSave[key as keyof FinancialSettingsProfile];
      }
    });

    try {
      const profileDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, COMPANY_PROFILE_DOC_ID);
      await setDoc(profileDocRef, dataToSave, { merge: true });
      
      Swal.fire({
        title: "Layout Settings Saved!",
        text: "The settings for financial documents have been successfully updated.",
        icon: "success",
        timer: 1000,
        showConfirmButton: true,
      });
    } catch (error) {
      console.error("Error saving layout settings: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save settings: ${errorMessage}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <FormField control={form.control} name="companyName" render={({ field }) => (<FormItem><FormLabel>Company Name</FormLabel><FormControl><Input placeholder="Your company's name" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl><FormDescription>This name will appear on all financial documents.</FormDescription><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="hideCompanyName" render={({ field }) => (<FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-card"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="hideCompanyName" disabled={isReadOnly} /></FormControl><div className="space-y-1 leading-none"><FormLabel htmlFor="hideCompanyName" className="text-sm font-medium hover:cursor-pointer">Hide Company Name on Documents</FormLabel><FormDescription className="text-xs">If checked, the company name will not be printed.</FormDescription></div></FormItem>)}/>
            <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Company Address</FormLabel><FormControl><Textarea placeholder="Company address for documents" {...field} value={field.value || ""} rows={3} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)}/>
          </div>
          <div className="space-y-6">
            <FormField control={form.control} name="emailId" render={({ field }) => (<FormItem><FormLabel>Email ID</FormLabel><FormControl><Input type="email" placeholder="contact@company.com" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="cellNumber" render={({ field }) => (<FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input type="tel" placeholder="e.g., +1 123 456 7890" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)}/>
             <FormItem>
              <Label>Invoice Logo</Label>
               <div className="flex items-center gap-4">
                <div className="w-24 h-auto aspect-[396/58] rounded-md border border-dashed flex items-center justify-center bg-muted/50 overflow-hidden">
                  {invoiceLogoUrl ? <Image src={invoiceLogoUrl} alt="Invoice Logo" width={96} height={14} className="object-contain" data-ai-hint="invoice logo"/> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
                </div>
                <Input type="file" accept="image/png, image/jpeg" onChange={onFileSelect} className="flex-1" disabled={isReadOnly} />
              </div>
              <FormDescription>Specific logo for quotes, invoices, etc. If blank, the main company logo is used.</FormDescription>
            </FormItem>
          </div>
        </div>
        
        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingData || isReadOnly}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Layout Settings</>}
        </Button>
      </form>
      
      {/* Invoice Logo Cropping Dialog */}
       <Dialog open={isInvoiceLogoCropping} onOpenChange={setIsInvoiceLogoCropping}>
        <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Crop Invoice Logo</DialogTitle></DialogHeader>
            {invoiceLogoSrc && (
                <ReactCrop crop={invoiceLogoCrop} onChange={(_, c) => setInvoiceLogoCrop(c)} onComplete={(c) => setInvoiceLogoCompletedCrop(c)} aspect={396 / 58}>
                    <img ref={invoiceLogoImgRef} src={invoiceLogoSrc} alt="Crop preview" onLoad={onImageLoad} style={{ maxHeight: '70vh' }}/>
                </ReactCrop>
            )}
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isUploading}>Cancel</Button></DialogClose>
                <Button onClick={handleCropAndUpload} disabled={isUploading || !invoiceLogoCompletedCrop?.width}>
                    {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Uploading...</> : <><CropIcon className="mr-2 h-4 w-4"/>Set Logo</>}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
