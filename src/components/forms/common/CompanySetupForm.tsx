
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
import { Separator } from '@/components/ui/separator';


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
  hideCompanyLogo?: boolean; 
  hideInvoiceLogo?: boolean;
  contactPerson?: string;
  binNumber?: string;
  tinNumber?: string;
  updatedAt?: any;
}


const financialSettingsSchema = z.object({
  companyName: z.string().optional(),
  address: z.string().optional(),
  cellNumber: z.string().regex(/^\+?[0-9\s-()]*$/, "Invalid phone number format").optional().or(z.literal('')),
  emailId: z.string().email("Invalid email address").optional().or(z.literal('')),
  hideCompanyName: z.boolean().optional().default(false),
  hideCompanyLogo: z.boolean().optional().default(false),
  hideInvoiceLogo: z.boolean().optional().default(false),
  companyLogoUrl: z.string().url("Invalid URL format").optional().or(z.literal('')),
  invoiceLogoUrl: z.string().url("Invalid URL format").optional().or(z.literal('')),
  contactPerson: z.string().optional(),
  binNumber: z.string().optional(),
  tinNumber: z.string().optional(),
});

type FinancialSettingsFormValues = z.infer<typeof financialSettingsSchema>;


const DEFAULT_COMPANY_NAME = 'Smart Solution';
const DEFAULT_ADDRESS = 'House#50, Road#10, Sector#10, Uttara Model Town, Dhaka-1230';
const DEFAULT_EMAIL = 'info@smartsolution-bd.com';
const DEFAULT_COMPANY_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";


export function CompanySetupForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const { user: authUser, loading: authLoading, companyName: contextCompanyName, companyLogoUrl: contextCompanyLogoUrl, updateCompanyProfile, userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  
  // States for general company logo
  const [companyLogoSrc, setCompanyLogoSrc] = React.useState('');
  const [companyLogoCrop, setCompanyLogoCrop] = React.useState<Crop>();
  const [companyLogoCompletedCrop, setCompanyLogoCompletedCrop] = React.useState<PixelCrop>();
  const [companyLogoSelectedFile, setCompanyLogoSelectedFile] = React.useState<File | null>(null);
  const [isCompanyLogoCropping, setIsCompanyLogoCropping] = React.useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = React.useState<string | undefined>(contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL);
  const companyLogoImgRef = React.useRef<HTMLImageElement>(null);
  
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
      companyName: contextCompanyName || DEFAULT_COMPANY_NAME,
      address: DEFAULT_ADDRESS,
      emailId: DEFAULT_EMAIL,
      cellNumber: '',
      hideCompanyName: false,
      hideCompanyLogo: false,
      hideInvoiceLogo: false,
      companyLogoUrl: '',
      invoiceLogoUrl: '',
      contactPerson: '',
      binNumber: '',
      tinNumber: '',
    },
  });

  React.useEffect(() => {
    const fetchCompanyData = async () => {
      setIsLoadingData(true);
      try {
        const profileDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, COMPANY_PROFILE_DOC_ID);
        const profileDocSnap = await getDoc(profileDocRef);
        
        let initialProfileData: FinancialSettingsProfile & {companyName: string} = {
          companyName: contextCompanyName || DEFAULT_COMPANY_NAME,
          address: DEFAULT_ADDRESS,
          emailId: DEFAULT_EMAIL,
          companyLogoUrl: contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          invoiceLogoUrl: DEFAULT_COMPANY_LOGO_URL,
          cellNumber: '',
          hideCompanyName: false,
          hideCompanyLogo: false,
          hideInvoiceLogo: false,
          contactPerson: '',
          binNumber: '',
          tinNumber: '',
        };

        if (profileDocSnap.exists()) {
          const data = profileDocSnap.data() as CompanyProfile;
          initialProfileData = {
            ...initialProfileData,
            ...data,
            companyName: data.companyName || DEFAULT_COMPANY_NAME,
            companyLogoUrl: data.companyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
            invoiceLogoUrl: data.invoiceLogoUrl || data.companyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          };
        }
        form.reset(initialProfileData);
        setCompanyLogoUrl(initialProfileData.companyLogoUrl);
        setInvoiceLogoUrl(initialProfileData.invoiceLogoUrl);
      } catch (error) {
        Swal.fire("Error", "Could not load company profile. Using defaults.", "error");
      } finally {
        setIsLoadingData(false);
      }
    };

    if (!authLoading && authUser) fetchCompanyData();
    else if (!authLoading) setIsLoadingData(false);
  }, [form, contextCompanyName, contextCompanyLogoUrl, authLoading, authUser]);

  const onFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setSrc: React.Dispatch<React.SetStateAction<string>>,
    setFile: React.Dispatch<React.SetStateAction<File | null>>,
    setCropping: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      const reader = new FileReader();
      reader.addEventListener('load', () => setSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
      setCropping(true);
      e.target.value = '';
    }
  };

  const handleLogoUpload = async (
    file: File | null,
    storagePath: string
  ): Promise<string | undefined> => {
    if (!file) return undefined;
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  };


  async function onSubmit(data: FinancialSettingsFormValues) {
    setIsSubmitting(true);
    
    let newCompanyLogoUrl = companyLogoUrl;
    let newInvoiceLogoUrl = invoiceLogoUrl;

    try {
        if(companyLogoSelectedFile){
            newCompanyLogoUrl = await handleLogoUpload(companyLogoSelectedFile, 'companyLogos/main_logo.jpg');
        } else if (data.companyLogoUrl) {
            newCompanyLogoUrl = data.companyLogoUrl;
        }

        if(invoiceLogoSelectedFile){
            newInvoiceLogoUrl = await handleLogoUpload(invoiceLogoSelectedFile, 'companyLogos/invoice_logo.jpg');
        } else if (data.invoiceLogoUrl) {
            newInvoiceLogoUrl = data.invoiceLogoUrl;
        }
    
        const dataToSave: FinancialSettingsProfile = {
            ...data,
            companyLogoUrl: newCompanyLogoUrl,
            invoiceLogoUrl: newInvoiceLogoUrl,
            updatedAt: serverTimestamp(),
        };
        
        Object.keys(dataToSave).forEach(key => {
          const typedKey = key as keyof FinancialSettingsProfile;
          if (dataToSave[typedKey] === undefined) {
            delete dataToSave[typedKey];
          }
        });

        const profileDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, COMPANY_PROFILE_DOC_ID);
        await setDoc(profileDocRef, dataToSave, { merge: true });
        
        updateCompanyProfile({ companyName: data.companyName, companyLogoUrl: newCompanyLogoUrl, invoiceLogoUrl: newInvoiceLogoUrl });
        setCompanyLogoUrl(newCompanyLogoUrl);
        setInvoiceLogoUrl(newInvoiceLogoUrl);
        setCompanyLogoSelectedFile(null);
        setInvoiceLogoSelectedFile(null);

        Swal.fire({
            title: "Settings Saved!",
            text: "Company settings have been successfully updated.",
            icon: "success",
            timer: 1000,
            showConfirmButton: true,
        });

    } catch (error) {
      console.error("Error saving settings: ", error);
      Swal.fire("Save Failed", `Failed to save settings: ${(error as Error).message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleCropAndUpload = async (
    imgRefParam: React.RefObject<HTMLImageElement>,
    completedCrop: PixelCrop | undefined,
    selectedFileParam: File | null,
    setFile: React.Dispatch<React.SetStateAction<File | null>>,
    setUrl: React.Dispatch<React.SetStateAction<string | undefined>>,
    setCropping: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!completedCrop || !imgRefParam.current || !selectedFileParam) {
        Swal.fire("Error", "Could not process image crop. Please select and crop an image.", "error");
        return;
    }
    setIsUploading(true);
    try {
        const croppedImageBlob = await getCroppedImg(
            imgRefParam.current,
            completedCrop,
            selectedFileParam.name
        );
        if (!croppedImageBlob) {
            throw new Error("Failed to create cropped image blob.");
        }
        
        const tempUrl = URL.createObjectURL(croppedImageBlob);
        setUrl(tempUrl);
        setFile(croppedImageBlob);
        setCropping(false);
        
        Swal.fire({
            title: "Logo Staged",
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


  if (isLoadingData || authLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading company settings...</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <FormField control={form.control} name="companyName" render={({ field }) => (<FormItem><FormLabel>Company Name</FormLabel><FormControl><Input placeholder="Your company's name" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl><FormDescription>This name will appear on all financial documents.</FormDescription><FormMessage /></FormItem>)} />
             <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Company Address</FormLabel><FormControl><Textarea placeholder={DEFAULT_ADDRESS} {...field} value={field.value || ""} rows={3} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)}/>
             <FormField control={form.control} name="emailId" render={({ field }) => (<FormItem><FormLabel>Email ID</FormLabel><FormControl><Input type="email" placeholder="contact@company.com" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="cellNumber" render={({ field }) => (<FormItem><FormLabel>Cell Number</FormLabel><FormControl><Input type="tel" placeholder="e.g., +1 123 456 7890" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)}/>
          </div>
          <div className="space-y-6">
            <FormField control={form.control} name="hideCompanyName" render={({ field }) => (<FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-card"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="hideCompanyName" disabled={isReadOnly} /></FormControl><div className="space-y-1 leading-none"><FormLabel htmlFor="hideCompanyName" className="text-sm font-medium hover:cursor-pointer">Hide Company Name on Documents</FormLabel><FormDescription className="text-xs">If checked, the company name will not be printed.</FormDescription></div></FormItem>)}/>
            <FormField control={form.control} name="hideInvoiceLogo" render={({ field }) => (<FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-card"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="hideInvoiceLogo" disabled={isReadOnly} /></FormControl><div className="space-y-1 leading-none"><FormLabel htmlFor="hideInvoiceLogo" className="text-sm font-medium hover:cursor-pointer">Hide Invoice Logo on Documents</FormLabel><FormDescription className="text-xs">If checked, the invoice logo will not be printed.</FormDescription></div></FormItem>)}/>
            <FormItem>
              <Label>Invoice Logo</Label>
               <div className="flex items-center gap-4">
                <div className="w-24 h-auto aspect-[396/58] rounded-md border border-dashed flex items-center justify-center bg-muted/50 overflow-hidden">
                  {invoiceLogoUrl ? <Image src={invoiceLogoUrl} alt="Invoice Logo" width={96} height={14} className="object-contain" data-ai-hint="invoice logo"/> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
                </div>
                <Input type="file" accept="image/png, image/jpeg" onChange={(e) => onFileSelect(e, setInvoiceLogoSrc, setInvoiceLogoSelectedFile, setIsInvoiceLogoCropping)} className="flex-1" disabled={isReadOnly} />
              </div>
              <FormDescription>Specific logo for quotes, invoices, etc.</FormDescription>
            </FormItem>
             <FormField control={form.control} name="invoiceLogoUrl" render={({ field }) => (<FormItem><FormLabel>External Invoice Logo URL</FormLabel><FormControl><Input placeholder="https://example.com/logo.png" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl><FormDescription>Use this URL if no file is uploaded for the invoice logo.</FormDescription><FormMessage /></FormItem>)} />
          </div>
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
                <FormField control={form.control} name="hideCompanyLogo" render={({ field }) => (<FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-card"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="hideCompanyLogo" disabled={isReadOnly} /></FormControl><div className="space-y-1 leading-none"><FormLabel htmlFor="hideCompanyLogo" className="text-sm font-medium hover:cursor-pointer">Hide Company Logo on Sidebar</FormLabel><FormDescription className="text-xs">If checked, the logo will be hidden from the main sidebar.</FormDescription></div></FormItem>)}/>
                 <FormItem>
                    <Label>Company Logo (for sidebar)</Label>
                    <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-md border border-dashed flex items-center justify-center bg-muted/50 overflow-hidden">
                        {companyLogoUrl ? <Image src={companyLogoUrl} alt="Company Logo" width={96} height={96} className="object-contain" data-ai-hint="company logo"/> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
                    </div>
                    <Input type="file" accept="image/png, image/jpeg" onChange={(e) => onFileSelect(e, setCompanyLogoSrc, setCompanyLogoSelectedFile, setIsCompanyLogoCropping)} className="flex-1" disabled={isReadOnly} />
                    </div>
                    <FormDescription>Upload a square logo (e.g., 256x256) for the main sidebar.</FormDescription>
                </FormItem>
                <FormField control={form.control} name="companyLogoUrl" render={({ field }) => (<FormItem><FormLabel>External Company Logo URL</FormLabel><FormControl><Input placeholder="https://example.com/logo.png" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl><FormDescription>Use this URL if no file is uploaded. Overrides uploaded logo.</FormDescription><FormMessage /></FormItem>)} />
            </div>
             <div className="space-y-6">
                 <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input placeholder="Primary contact" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="binNumber" render={({ field }) => (<FormItem><FormLabel>BIN No.</FormLabel><FormControl><Input placeholder="Business Identification Number" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="tinNumber" render={({ field }) => (<FormItem><FormLabel>TIN No.</FormLabel><FormControl><Input placeholder="Taxpayer Identification Number" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)}/>
             </div>
        </div>

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingData || isReadOnly}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Settings</>}
        </Button>
      </form>
      
      {/* Company Logo Cropping Dialog */}
      <Dialog open={isCompanyLogoCropping} onOpenChange={setIsCompanyLogoCropping}>
        <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Crop Company Logo (Sidebar)</DialogTitle></DialogHeader>
            {companyLogoSrc && (
                <ReactCrop crop={companyLogoCrop} onChange={(_, c) => setCompanyLogoCrop(c)} onComplete={(c) => setCompanyLogoCompletedCrop(c)} aspect={1} minWidth={100}>
                    <img ref={companyLogoImgRef} src={companyLogoSrc} alt="Crop preview" onLoad={(e) => onImageLoad(e, 1, setCompanyLogoCrop)} style={{ maxHeight: '70vh' }}/>
                </ReactCrop>
            )}
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => handleCropAndUpload(companyLogoImgRef, companyLogoCompletedCrop, companyLogoSelectedFile, setCompanyLogoSelectedFile, (url) => setCompanyLogoUrl(url), setIsCompanyLogoCropping)}>
                    <CropIcon className="mr-2 h-4 w-4"/>Set Logo
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Invoice Logo Cropping Dialog */}
       <Dialog open={isInvoiceLogoCropping} onOpenChange={setIsInvoiceLogoCropping}>
        <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Crop Invoice Logo</DialogTitle></DialogHeader>
            {invoiceLogoSrc && (
                <ReactCrop crop={invoiceLogoCrop} onChange={(_, c) => setInvoiceLogoCrop(c)} onComplete={(c) => setInvoiceLogoCompletedCrop(c)} aspect={396 / 58}>
                    <img ref={invoiceLogoImgRef} src={invoiceLogoSrc} alt="Crop preview" onLoad={(e) => onImageLoad(e, 396 / 58, setInvoiceLogoCrop)} style={{ maxHeight: '70vh' }}/>
                </ReactCrop>
            )}
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isUploading}>Cancel</Button></DialogClose>
                <Button onClick={() => handleCropAndUpload(invoiceLogoImgRef, invoiceLogoCompletedCrop, invoiceLogoSelectedFile, setInvoiceLogoSelectedFile, setInvoiceLogoUrl, setIsInvoiceLogoCropping)} disabled={isUploading || !invoiceLogoCompletedCrop?.width}>
                    {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Uploading...</> : <><CropIcon className="mr-2 h-4 w-4"/>Set Logo</>}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>, aspect: number, setCropFn: React.Dispatch<React.SetStateAction<Crop | undefined>>) {
        const { width, height } = e.currentTarget;
        setCropFn(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height), width, height));
    }
}

    