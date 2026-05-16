
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Upload, Crop as CropIcon, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { uploadFile, getActiveStorageConfig, getFileUrl } from '@/lib/storage/storage';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCroppedImg } from '@/lib/image-utils';
import { Separator } from '@/components/ui/separator';
import { DatePickerInput } from '@/components/ui/date-picker-input';


const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const COMPANY_PROFILE_DOC_ID = 'main_settings';

interface FinancialSettingsProfile {
  companyName?: string;
  address?: string;
  invoiceLogoUrl?: string;
  companyLogoUrl?: string;
  faviconUrl?: string;
  pwaAppName?: string;
  pwaShortName?: string;
  pwaDescription?: string;
  pwaIcon192Url?: string;
  pwaIcon512Url?: string;
  pwaIcon144Url?: string;
  pwaIconMaskableUrl?: string;
  pwaScreenshotUrl?: string;
  emailId?: string;
  cellNumber?: string;
  hideCompanyName?: boolean;
  hideCompanyLogo?: boolean;
  hideInvoiceLogo?: boolean;
  contactPerson?: string;
  binNumber?: string;
  tinNumber?: string;
  operationStartDate?: any;
  appVersion?: string;
  timezone?: string;
  updatedAt?: any;
  sidebarLogoWidth?: number;
  sidebarLogoHeight?: number;
  invoiceLogoWidth?: number;
  invoiceLogoHeight?: number;
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
  faviconUrl: z.string().url("Invalid URL format").optional().or(z.literal('')),
  pwaAppName: z.string().optional(),
  pwaShortName: z.string().optional(),
  pwaDescription: z.string().optional(),
  pwaIcon192Url: z.string().url("Invalid URL format").optional().or(z.literal('')),
  pwaIcon512Url: z.string().url("Invalid URL format").optional().or(z.literal('')),
  pwaIcon144Url: z.string().url("Invalid URL format").optional().or(z.literal('')),
  pwaIconMaskableUrl: z.string().url("Invalid URL format").optional().or(z.literal('')),
  pwaScreenshotUrl: z.string().url("Invalid URL format").optional().or(z.literal('')),
  contactPerson: z.string().optional(),
  binNumber: z.string().optional(),
  tinNumber: z.string().optional(),
  operationStartDate: z.any().optional(),
  appVersion: z.string().optional().or(z.literal('')),
  timezone: z.string().optional(),
  sidebarLogoWidth: z.coerce.number().optional().or(z.literal('')),
  sidebarLogoHeight: z.coerce.number().optional().or(z.literal('')),
  invoiceLogoWidth: z.coerce.number().optional().or(z.literal('')),
  invoiceLogoHeight: z.coerce.number().optional().or(z.literal('')),
});

type FinancialSettingsFormValues = z.infer<typeof financialSettingsSchema>;


const DEFAULT_COMPANY_NAME = 'LCMS';
const DEFAULT_ADDRESS = 'House#50/A, Road#10, Sector#10, Uttara Model Town, Dhaka-1230';
const DEFAULT_EMAIL = 'info@uddoktasoft.com';
const DEFAULT_COMPANY_LOGO_URL = "/icons/icon-192x192.png";
const DEFAULT_PWA_APP_NAME = 'LCMS';
const DEFAULT_PWA_SHORT_NAME = 'LCMS';
const DEFAULT_PWA_DESCRIPTION = 'LCMS - LC & HR Management System - Employee Portal';
const DEFAULT_APP_VERSION = 'v1.1';


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

  // States for favicon
  const [faviconSrc, setFaviconSrc] = React.useState('');
  const [faviconCrop, setFaviconCrop] = React.useState<Crop>();
  const [faviconCompletedCrop, setFaviconCompletedCrop] = React.useState<PixelCrop>();
  const [faviconSelectedFile, setFaviconSelectedFile] = React.useState<File | null>(null);
  const [isFaviconCropping, setIsFaviconCropping] = React.useState(false);
  const [faviconUrl, setFaviconUrl] = React.useState<string | undefined>(undefined);
  const faviconImgRef = React.useRef<HTMLImageElement>(null);

  // States for PWA Assets
  const [pwa192Src, setPwa192Src] = React.useState('');
  const [pwa192Crop, setPwa192Crop] = React.useState<Crop>();
  const [pwa192CompletedCrop, setPwa192CompletedCrop] = React.useState<PixelCrop>();
  const [pwa192SelectedFile, setPwa192SelectedFile] = React.useState<File | null>(null);
  const [isPwa192Cropping, setIsPwa192Cropping] = React.useState(false);
  const [pwa192Url, setPwa192Url] = React.useState<string | undefined>(undefined);
  const pwa192ImgRef = React.useRef<HTMLImageElement>(null);

  const [pwa512Src, setPwa512Src] = React.useState('');
  const [pwa512Crop, setPwa512Crop] = React.useState<Crop>();
  const [pwa512CompletedCrop, setPwa512CompletedCrop] = React.useState<PixelCrop>();
  const [pwa512SelectedFile, setPwa512SelectedFile] = React.useState<File | null>(null);
  const [isPwa512Cropping, setIsPwa512Cropping] = React.useState(false);
  const [pwa512Url, setPwa512Url] = React.useState<string | undefined>(undefined);
  const pwa512ImgRef = React.useRef<HTMLImageElement>(null);

  const [pwa144Src, setPwa144Src] = React.useState('');
  const [pwa144Crop, setPwa144Crop] = React.useState<Crop>();
  const [pwa144CompletedCrop, setPwa144CompletedCrop] = React.useState<PixelCrop>();
  const [pwa144SelectedFile, setPwa144SelectedFile] = React.useState<File | null>(null);
  const [isPwa144Cropping, setIsPwa144Cropping] = React.useState(false);
  const [pwa144Url, setPwa144Url] = React.useState<string | undefined>(undefined);
  const pwa144ImgRef = React.useRef<HTMLImageElement>(null);

  const [pwaMaskableSrc, setPwaMaskableSrc] = React.useState('');
  const [pwaMaskableCrop, setPwaMaskableCrop] = React.useState<Crop>();
  const [pwaMaskableCompletedCrop, setPwaMaskableCompletedCrop] = React.useState<PixelCrop>();
  const [pwaMaskableSelectedFile, setPwaMaskableSelectedFile] = React.useState<File | null>(null);
  const [isPwaMaskableCropping, setIsPwaMaskableCropping] = React.useState(false);
  const [pwaMaskableUrl, setPwaMaskableUrl] = React.useState<string | undefined>(undefined);
  const pwaMaskableImgRef = React.useRef<HTMLImageElement>(null);

  const [pwaScreenshotSelectedFile, setPwaScreenshotSelectedFile] = React.useState<File | null>(null);
  const [pwaScreenshotUrl, setPwaScreenshotUrl] = React.useState<string | undefined>(undefined);

  // States to toggle external URL inputs
  const [showCompanyLogoUrl, setShowCompanyLogoUrl] = React.useState(false);
  const [showInvoiceLogoUrl, setShowInvoiceLogoUrl] = React.useState(false);
  const [showFaviconUrl, setShowFaviconUrl] = React.useState(false);
  const [showPwa192Url, setShowPwa192Url] = React.useState(false);
  const [showPwa512Url, setShowPwa512Url] = React.useState(false);
  const [showPwa144Url, setShowPwa144Url] = React.useState(false);
  const [showPwaMaskableUrl, setShowPwaMaskableUrl] = React.useState(false);
  const [showPwaScreenshotUrl, setShowPwaScreenshotUrl] = React.useState(false);

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
      faviconUrl: '',
      pwaAppName: DEFAULT_PWA_APP_NAME,
      pwaShortName: DEFAULT_PWA_SHORT_NAME,
      pwaDescription: DEFAULT_PWA_DESCRIPTION,
      pwaIcon192Url: '',
      pwaIcon512Url: '',
      pwaScreenshotUrl: '',
      contactPerson: '',
      binNumber: '',
      tinNumber: '',
      operationStartDate: undefined,
      appVersion: DEFAULT_APP_VERSION,
      timezone: 'Asia/Dhaka',
      sidebarLogoWidth: 64,
      sidebarLogoHeight: 64,
      invoiceLogoWidth: 180,
      invoiceLogoHeight: 48,
    },
  });

  React.useEffect(() => {
    const fetchCompanyData = async () => {
      setIsLoadingData(true);
      try {
        const profileDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, COMPANY_PROFILE_DOC_ID);
        const profileDocSnap = await getDoc(profileDocRef);

        let initialProfileData: FinancialSettingsProfile & { companyName: string } = {
          companyName: contextCompanyName || DEFAULT_COMPANY_NAME,
          address: DEFAULT_ADDRESS,
          emailId: DEFAULT_EMAIL,
          companyLogoUrl: contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          invoiceLogoUrl: DEFAULT_COMPANY_LOGO_URL,
          faviconUrl: '',
          pwaAppName: DEFAULT_PWA_APP_NAME,
          pwaShortName: DEFAULT_PWA_SHORT_NAME,
          pwaDescription: DEFAULT_PWA_DESCRIPTION,
          pwaIcon192Url: '',
          pwaIcon512Url: '',
          pwaIcon144Url: '',
          pwaIconMaskableUrl: '',
          pwaScreenshotUrl: '',
          cellNumber: '',
          hideCompanyName: false,
          hideCompanyLogo: false,
          hideInvoiceLogo: false,
          contactPerson: '',
          binNumber: '',
          tinNumber: '',
          operationStartDate: undefined,
          appVersion: DEFAULT_APP_VERSION,
        };

        if (profileDocSnap.exists()) {
          const data = profileDocSnap.data() as CompanyProfile;
          
          // Resolve PWA icons and main logos to active storage if they use standard paths
          const [res144, res192, res512, resMask, resScreen, resComp, resInv] = await Promise.all([
            data.pwaIcon144Url ? getFileUrl(data.pwaIcon144Url) : Promise.resolve(''),
            data.pwaIcon192Url ? getFileUrl(data.pwaIcon192Url) : Promise.resolve(''),
            data.pwaIcon512Url ? getFileUrl(data.pwaIcon512Url) : Promise.resolve(''),
            data.pwaIconMaskableUrl ? getFileUrl(data.pwaIconMaskableUrl) : Promise.resolve(''),
            data.pwaScreenshotUrl ? getFileUrl(data.pwaScreenshotUrl) : Promise.resolve(''),
            data.companyLogoUrl ? getFileUrl(data.companyLogoUrl) : Promise.resolve(''),
            (data.invoiceLogoUrl || data.companyLogoUrl) ? getFileUrl(data.invoiceLogoUrl || data.companyLogoUrl) : Promise.resolve('')
          ]);

          initialProfileData = {
            ...initialProfileData,
            ...data,
            companyName: data.companyName || DEFAULT_COMPANY_NAME,
            companyLogoUrl: resComp || data.companyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
            invoiceLogoUrl: resInv || data.invoiceLogoUrl || data.companyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
            pwaIcon144Url: res144,
            pwaIcon192Url: res192,
            pwaIcon512Url: res512,
            pwaIconMaskableUrl: resMask,
            pwaScreenshotUrl: resScreen,
            sidebarLogoWidth: data.sidebarLogoWidth || 64,
            sidebarLogoHeight: data.sidebarLogoHeight || 64,
            invoiceLogoWidth: data.invoiceLogoWidth || 180,
            invoiceLogoHeight: data.invoiceLogoHeight || 48,
          };
        }
        form.reset(initialProfileData);
        setCompanyLogoUrl(initialProfileData.companyLogoUrl);
        setInvoiceLogoUrl(initialProfileData.invoiceLogoUrl);
        setFaviconUrl(initialProfileData.faviconUrl);
        setPwa192Url(initialProfileData.pwaIcon192Url);
        setPwa512Url(initialProfileData.pwaIcon512Url);
        setPwa144Url(initialProfileData.pwaIcon144Url);
        setPwaMaskableUrl(initialProfileData.pwaIconMaskableUrl);
        setPwaScreenshotUrl(initialProfileData.pwaScreenshotUrl);
      } catch (error) {
        console.error("Error loading company profile:", error);
        Swal.fire("Error", "Could not load company profile. Using defaults.", "error");
      } finally {
        setIsLoadingData(false);
      }
    };

    if (!authLoading && authUser) fetchCompanyData();
    else if (!authLoading) setIsLoadingData(false);
  }, [form, contextCompanyName, contextCompanyLogoUrl, authLoading, authUser]);

  const [activeStorage, setActiveStorage] = useState<{ name: string; provider: string } | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);

  useEffect(() => {
    async function fetchActiveStorage() {
      try {
        const config = await getActiveStorageConfig();
        if (config) {
          setActiveStorage({ name: config.name, provider: config.provider });
        } else {
          setActiveStorage({ name: 'Default Firebase', provider: 'firebase' });
        }
      } catch (err) {
        console.error("Error fetching active storage:", err);
      } finally {
        setIsLoadingStorage(false);
      }
    }
    fetchActiveStorage();
  }, []);

  const onFileSelect = async (
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
    return await uploadFile(file, storagePath);
  };


  async function onSubmit(data: FinancialSettingsFormValues) {
    setIsSubmitting(true);

    let newCompanyLogoUrl = companyLogoUrl;
    let newInvoiceLogoUrl = invoiceLogoUrl;
    let newFaviconUrl = faviconUrl;
    let newPwa192Url = pwa192Url;
    let newPwa512Url = pwa512Url;
    let newPwa144Url = pwa144Url;
    let newPwaMaskableUrl = pwaMaskableUrl;
    let newPwaScreenshotUrl = pwaScreenshotUrl;

    try {
      if (companyLogoSelectedFile) {
        newCompanyLogoUrl = await handleLogoUpload(companyLogoSelectedFile, 'companyLogos/main_logo.png');
      } else if (data.companyLogoUrl) {
        newCompanyLogoUrl = data.companyLogoUrl;
      }

      if (invoiceLogoSelectedFile) {
        newInvoiceLogoUrl = await handleLogoUpload(invoiceLogoSelectedFile, 'companyLogos/invoice_logo.png');
      } else if (data.invoiceLogoUrl) {
        newInvoiceLogoUrl = data.invoiceLogoUrl;
      }

      if (faviconSelectedFile) {
        newFaviconUrl = await handleLogoUpload(faviconSelectedFile, 'companyLogos/favicon.ico');
      } else if (data.faviconUrl) {
        newFaviconUrl = data.faviconUrl;
      }

      if (pwa192SelectedFile) {
        newPwa192Url = await handleLogoUpload(pwa192SelectedFile, 'companyLogos/pwa-icon-192x192.png');
      } else if (data.pwaIcon192Url) {
        newPwa192Url = data.pwaIcon192Url;
      }

      if (pwa512SelectedFile) {
        newPwa512Url = await handleLogoUpload(pwa512SelectedFile, 'companyLogos/pwa-icon-512x512.png');
      } else if (data.pwaIcon512Url) {
        newPwa512Url = data.pwaIcon512Url;
      }

      if (pwaScreenshotSelectedFile) {
        newPwaScreenshotUrl = await handleLogoUpload(pwaScreenshotSelectedFile, 'companyLogos/pwa-screenshot-desktop.png');
      } else if (data.pwaScreenshotUrl) {
        newPwaScreenshotUrl = data.pwaScreenshotUrl;
      }

      if (pwa144SelectedFile) {
        newPwa144Url = await handleLogoUpload(pwa144SelectedFile, 'companyLogos/pwa-icon-144x144.png');
      } else if (data.pwaIcon144Url) {
        newPwa144Url = data.pwaIcon144Url;
      }

      if (pwaMaskableSelectedFile) {
        newPwaMaskableUrl = await handleLogoUpload(pwaMaskableSelectedFile, 'companyLogos/pwa-icon-maskable.png');
      } else if (data.pwaIconMaskableUrl) {
        newPwaMaskableUrl = data.pwaIconMaskableUrl;
      }

      const dataToSave: FinancialSettingsProfile = {
        ...data,
        companyLogoUrl: newCompanyLogoUrl,
        invoiceLogoUrl: newInvoiceLogoUrl,
        faviconUrl: newFaviconUrl,
        pwaIcon192Url: newPwa192Url,
        pwaIcon512Url: newPwa512Url,
        pwaIcon144Url: newPwa144Url,
        pwaIconMaskableUrl: newPwaMaskableUrl,
        pwaScreenshotUrl: newPwaScreenshotUrl,
        pwaAppName: data.pwaAppName,
        pwaShortName: data.pwaShortName,
        pwaDescription: data.pwaDescription,
        sidebarLogoWidth: data.sidebarLogoWidth ? Number(data.sidebarLogoWidth) : undefined,
        sidebarLogoHeight: data.sidebarLogoHeight ? Number(data.sidebarLogoHeight) : undefined,
        invoiceLogoWidth: data.invoiceLogoWidth ? Number(data.invoiceLogoWidth) : undefined,
        invoiceLogoHeight: data.invoiceLogoHeight ? Number(data.invoiceLogoHeight) : undefined,
        operationStartDate: data.operationStartDate || null,
        timezone: data.timezone || 'Asia/Dhaka',
        updatedAt: serverTimestamp(),
      };

      // Ensure appVersion is handled by environment variables, remove from save object
      if ('appVersion' in dataToSave) {
        delete (dataToSave as any).appVersion;
      }

      Object.keys(dataToSave).forEach(key => {
        const typedKey = key as keyof FinancialSettingsProfile;
        if (dataToSave[typedKey] === undefined) {
          delete dataToSave[typedKey];
        }
      });

      const profileDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, COMPANY_PROFILE_DOC_ID);
      await setDoc(profileDocRef, dataToSave, { merge: true });

      updateCompanyProfile({
        companyName: data.companyName,
        companyLogoUrl: newCompanyLogoUrl,
        invoiceLogoUrl: newInvoiceLogoUrl,
        hideCompanyLogo: data.hideCompanyLogo,
        hideCompanyName: data.hideCompanyName,
      });
      setCompanyLogoUrl(newCompanyLogoUrl);
      setInvoiceLogoUrl(newInvoiceLogoUrl);
      setFaviconUrl(newFaviconUrl);
      setPwa192Url(newPwa192Url);
      setPwa512Url(newPwa512Url);
      setPwa144Url(newPwa144Url);
      setPwaMaskableUrl(newPwaMaskableUrl);
      setPwaScreenshotUrl(newPwaScreenshotUrl);
      setCompanyLogoSelectedFile(null);
      setInvoiceLogoSelectedFile(null);
      setFaviconSelectedFile(null);
      setPwa192SelectedFile(null);
      setPwa512SelectedFile(null);
      setPwa144SelectedFile(null);
      setPwaMaskableSelectedFile(null);
      setPwaScreenshotSelectedFile(null);

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
    setCropping: React.Dispatch<React.SetStateAction<boolean>>,
    skipCrop: boolean = false
  ) => {
    if (!selectedFileParam) {
      Swal.fire("Error", "Please select an image first.", "error");
      return;
    }

    if (!skipCrop && (!completedCrop || !imgRefParam.current)) {
      Swal.fire("Error", "Could not process image crop. Please select and crop an image, or use 'Add without Crop'.", "error");
      return;
    }

    setIsUploading(true);
    try {
      let finalFile: File;
      let tempUrl: string;

      if (skipCrop) {
        finalFile = selectedFileParam;
        tempUrl = URL.createObjectURL(selectedFileParam);
      } else {
        const croppedImageBlob = await getCroppedImg(
          imgRefParam.current!,
          completedCrop!,
          selectedFileParam.name
        );
        if (!croppedImageBlob) {
          throw new Error("Failed to create cropped image blob.");
        }
        finalFile = croppedImageBlob;
        tempUrl = URL.createObjectURL(croppedImageBlob);
      }

      setUrl(tempUrl);
      setFile(finalFile);
      setCropping(false);

      Swal.fire({
        title: skipCrop ? "Logo Added" : "Logo Staged",
        text: "Your logo is ready. Click 'Save All Changes' at the bottom to apply it permanently.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      console.error("Error handling crop and upload:", err);
      Swal.fire("Upload Failed", `Failed to prepare image: ${err.message}`, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const sidebarWidth = form.watch('sidebarLogoWidth') || 64;
  const sidebarHeight = form.watch('sidebarLogoHeight') || 64;
  
  const invoiceWidth = form.watch('invoiceLogoWidth') || 180;
  const invoiceHeight = form.watch('invoiceLogoHeight') || 48;

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Section 1: General Information */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-xl">General Information</CardTitle>
              <CardDescription>Basic details about your company structure and contact points.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6">
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl><Input placeholder="Your company's name" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                  <FormDescription>Appears on all official documents.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="contactPerson" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl><Input placeholder="Primary contact name" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="emailId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl><Input type="email" placeholder="contact@company.com" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="cellNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl><Input type="tel" placeholder="e.g., +1 234 567 890" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="appVersion" render={({ field }) => (
                <FormItem>
                  <FormLabel>App Version</FormLabel>
                  <FormControl><Input placeholder="e.g., v1.1" {...field} value={field.value || ""} disabled={true} /></FormControl>
                  <FormDescription className="text-xs font-semibold text-blue-600">
                    Managed via environment variables (.env). Manual editing is disabled.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Section 2: legal & Address */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-xl">Location & Legal Identity</CardTitle>
              <CardDescription>Manage your registered address and tax identification.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Registered Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder={DEFAULT_ADDRESS} className="min-h-[120px] resize-none" {...field} value={field.value || ""} disabled={isReadOnly} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="binNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>BIN Number</FormLabel>
                    <FormControl><Input placeholder="Business ID No." {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tinNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>TIN Number</FormLabel>
                    <FormControl><Input placeholder="Tax ID No." {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="operationStartDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Company Operation Start</FormLabel>
                  <FormControl>
                    <DatePickerInput
                      field={field}
                      placeholder="Select operation start date"
                      disabled={isReadOnly}
                      fromYear={1980}
                      toYear={new Date().getFullYear() + 5}
                    />
                  </FormControl>
                  <FormDescription>The official date when company operations began.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="timezone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Time Zone</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select time zone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Asia/Dhaka">Bangladesh - Dhaka (UTC+6)</SelectItem>
                      <SelectItem value="Asia/Kolkata">India - Kolkata (UTC+5:30)</SelectItem>
                      <SelectItem value="Asia/Karachi">Pakistan - Karachi (UTC+5)</SelectItem>
                      <SelectItem value="Asia/Dubai">UAE - Dubai (UTC+4)</SelectItem>
                      <SelectItem value="Europe/London">UK - London (UTC+0/+1)</SelectItem>
                      <SelectItem value="Europe/Paris">France - Paris (UTC+1/+2)</SelectItem>
                      <SelectItem value="America/New_York">USA - New York (UTC-5/-4)</SelectItem>
                      <SelectItem value="America/Chicago">USA - Chicago (UTC-6/-5)</SelectItem>
                      <SelectItem value="America/Los_Angeles">USA - Los Angeles (UTC-8/-7)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Japan - Tokyo (UTC+9)</SelectItem>
                      <SelectItem value="Asia/Shanghai">China - Shanghai (UTC+8)</SelectItem>
                      <SelectItem value="Asia/Singapore">Singapore (UTC+8)</SelectItem>
                      <SelectItem value="Australia/Sydney">Australia - Sydney (UTC+10/+11)</SelectItem>
                      <SelectItem value="UTC">UTC (GMT+0)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">
                    This timezone will be used for scheduling notifications and cron jobs. Note: Vercel cron schedules use UTC time.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>
        </div>

        {/* Section 3: Branding & Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Branding & Documents</CardTitle>
            <CardDescription>Customize how your company appears in the app and on generated invoices.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">

            {/* Logo Layout Container */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

              {/* Sidebar Logo Section */}
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 h-full flex flex-col">
                <div className="flex flex-col gap-6 flex-grow">
                  <div>
                    <Label className="text-base font-semibold">Sidebar Logo (64*64) px</Label>
                    <p className="text-sm text-muted-foreground">Main navigation sidebar icon.</p>
                    <FormField control={form.control} name="hideCompanyLogo" render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 mt-2">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="hideCompanyLogo" disabled={isReadOnly} /></FormControl>
                        <FormLabel htmlFor="hideCompanyLogo" className="text-xs font-normal cursor-pointer">Hide in sidebar</FormLabel>
                      </FormItem>
                    )} />
                    <div className="flex gap-2 items-center mt-2">
                      <FormField control={form.control} name="sidebarLogoWidth" render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Width (px)</FormLabel>
                          <FormControl><Input type="number" placeholder="64" className="h-8 text-xs" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="sidebarLogoHeight" render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Height (px)</FormLabel>
                          <FormControl><Input type="number" placeholder="64" className="h-8 text-xs" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="w-full space-y-4">
                    <div className="flex flex-col gap-4">
                      <div 
                        className="shrink-0 overflow-hidden bg-white flex items-center justify-center self-center md:self-start relative rounded-sm border"
                        style={{ 
                          width: sidebarWidth ? `${sidebarWidth}px` : '64px', 
                          height: sidebarHeight ? `${sidebarHeight}px` : '64px',
                          maxWidth: '100%',
                        }}
                      >
                        {companyLogoUrl ?
                          <Image src={companyLogoUrl} alt="Company Logo" fill className="object-contain" />
                          : <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        }
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Input type="file" accept="image/png, image/jpeg" className="h-9 text-xs" onChange={(e) => onFileSelect(e, setCompanyLogoSrc, setCompanyLogoSelectedFile, setIsCompanyLogoCropping)} disabled={isReadOnly} />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => setShowCompanyLogoUrl(!showCompanyLogoUrl)}
                            title="Toggle External URL"
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        {showCompanyLogoUrl && (
                          <FormField control={form.control} name="companyLogoUrl" render={({ field }) => (
                            <FormItem>
                              <FormControl><Input placeholder="External URL..." className="h-9 text-xs" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice Logo Section */}
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 h-full flex flex-col">
                <div className="flex flex-col gap-6 flex-grow">
                  <div>
                    <Label className="text-base font-semibold">Invoice Logo</Label>
                    <p className="text-sm text-muted-foreground">Used on documents (Invoices, Payslips).</p>
                    <div className="flex flex-col gap-1 mt-2">
                      <FormField control={form.control} name="hideInvoiceLogo" render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="hideInvoiceLogo" disabled={isReadOnly} /></FormControl>
                          <FormLabel htmlFor="hideInvoiceLogo" className="text-xs font-normal cursor-pointer">Hide logo on docs</FormLabel>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="hideCompanyName" render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="hideCompanyName" disabled={isReadOnly} /></FormControl>
                          <FormLabel htmlFor="hideCompanyName" className="text-xs font-normal cursor-pointer">Hide company name on docs</FormLabel>
                        </FormItem>
                      )} />
                      <div className="flex gap-2 items-center mt-2">
                        <FormField control={form.control} name="invoiceLogoWidth" render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs">Width (px)</FormLabel>
                            <FormControl><Input type="number" placeholder="180" className="h-8 text-xs" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="invoiceLogoHeight" render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs">Height (px)</FormLabel>
                            <FormControl><Input type="number" placeholder="48" className="h-8 text-xs" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  </div>

                  <div className="w-full space-y-4">
                    <div className="flex flex-col gap-4">
                      <div 
                        className="shrink-0 overflow-hidden bg-white flex items-center justify-center self-center md:self-start relative rounded-sm border"
                        style={{ 
                          width: invoiceWidth ? `${invoiceWidth}px` : '180px', 
                          height: invoiceHeight ? `${invoiceHeight}px` : '48px',
                          maxWidth: '100%',
                        }}
                      >
                        {invoiceLogoUrl ?
                          <Image src={invoiceLogoUrl} alt="Invoice Logo" fill className="object-contain" />
                          : <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        }
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Input type="file" accept="image/png, image/jpeg" className="h-9 text-xs" onChange={(e) => onFileSelect(e, setInvoiceLogoSrc, setInvoiceLogoSelectedFile, setIsInvoiceLogoCropping)} disabled={isReadOnly} />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => setShowInvoiceLogoUrl(!showInvoiceLogoUrl)}
                            title="Toggle External URL"
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        {showInvoiceLogoUrl && (
                          <FormField control={form.control} name="invoiceLogoUrl" render={({ field }) => (
                            <FormItem>
                              <FormControl><Input placeholder="External URL..." className="h-9 text-xs" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Favicon Section */}
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 h-full flex flex-col">
                <div className="flex flex-col gap-6 flex-grow">
                  <div>
                    <Label className="text-base font-semibold">Favicon (Browser)</Label>
                    <p className="text-sm text-muted-foreground">Tab icon (48x48px rec.)</p>
                  </div>

                  <div className="w-full space-y-4">
                    <div className="flex flex-col gap-4">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden bg-transparent flex items-center justify-center self-center md:self-start">
                        {faviconUrl ?
                          <Image src={faviconUrl} alt="Favicon" fill className="object-contain" />
                          : <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        }
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Input type="file" accept="image/x-icon, image/png, image/jpeg" className="h-9 text-xs" onChange={(e) => onFileSelect(e, setFaviconSrc, setFaviconSelectedFile, setIsFaviconCropping)} disabled={isReadOnly} />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => setShowFaviconUrl(!showFaviconUrl)}
                            title="Toggle External URL"
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        {showFaviconUrl && (
                          <FormField control={form.control} name="faviconUrl" render={({ field }) => (
                            <FormItem>
                              <FormControl><Input placeholder="External URL..." className="h-9 text-xs" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </CardContent>
        </Card>

        {/* Section 4: PWA Settings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl">PWA Settings</CardTitle>
              <CardDescription>Configure how your application looks when installed as a Progressive Web App.</CardDescription>
            </div>
            {!isLoadingStorage && activeStorage && (
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active Storage</span>
                <Badge variant={activeStorage.provider === 'firebase' ? "secondary" : "default"} className="font-mono text-[10px]">
                  {activeStorage.name} {activeStorage.provider !== 'firebase' && "(CDN)"}
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="pwaAppName" render={({ field }) => (
                <FormItem>
                  <FormLabel>App Name</FormLabel>
                  <FormControl><Input placeholder="Full application name" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                  <FormDescription className="text-xs">Used as the primary name for the installed app.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="pwaShortName" render={({ field }) => (
                <FormItem>
                  <FormLabel>App Short Name</FormLabel>
                  <FormControl><Input placeholder="Short version of name" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                  <FormDescription className="text-xs">Used when space is limited (e.g., home screen icon labels).</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="pwaDescription" render={({ field }) => (
              <FormItem>
                <FormLabel>App Description</FormLabel>
                <FormControl><Textarea placeholder="Describe your web app..." className="min-h-[80px] resize-none" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                <FormDescription className="text-xs">Summary of your application's purpose.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <Separator />

            {/* PWA Icons/Assets Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 pt-4">
              {/* Icon 144 Section */}
              <div className="flex flex-col gap-4">
                <Label className="text-sm font-semibold">Icon (144x144)</Label>
                <div className="h-20 w-20 shrink-0 overflow-hidden bg-transparent flex items-center justify-center self-center md:self-start relative">
                  {pwa144Url ?
                    <Image src={pwa144Url} alt="PWA 144" fill className="object-contain" />
                    : <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  }
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input type="file" accept="image/png" className="h-9 text-xs" onChange={(e) => onFileSelect(e, setPwa144Src, setPwa144SelectedFile, setIsPwa144Cropping)} disabled={isReadOnly} />
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowPwa144Url(!showPwa144Url)} title="Toggle External URL"><LinkIcon className="h-4 w-4" /></Button>
                  </div>
                  {showPwa144Url && (
                    <FormField control={form.control} name="pwaIcon144Url" render={({ field }) => (
                      <FormItem>
                        <FormControl><Input placeholder="Icon 144 URL..." className="h-9 text-xs" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
              </div>

              {/* Icon 192 Section */}
              <div className="flex flex-col gap-4">
                <Label className="text-sm font-semibold">Icon (192x192)</Label>
                <div className="h-20 w-20 shrink-0 overflow-hidden bg-transparent flex items-center justify-center self-center md:self-start relative">
                  {pwa192Url ?
                    <Image src={pwa192Url} alt="PWA 192" fill className="object-contain" />
                    : <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  }
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input type="file" accept="image/png" className="h-9 text-xs" onChange={(e) => onFileSelect(e, setPwa192Src, setPwa192SelectedFile, setIsPwa192Cropping)} disabled={isReadOnly} />
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowPwa192Url(!showPwa192Url)} title="Toggle External URL"><LinkIcon className="h-4 w-4" /></Button>
                  </div>
                  {showPwa192Url && (
                    <FormField control={form.control} name="pwaIcon192Url" render={({ field }) => (
                      <FormItem>
                        <FormControl><Input placeholder="Icon 192 URL..." className="h-9 text-xs" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
              </div>

              {/* Icon 512 Section */}
              <div className="flex flex-col gap-4">
                <Label className="text-sm font-semibold">Icon (512x512)</Label>
                <div className="h-20 w-20 shrink-0 overflow-hidden bg-transparent flex items-center justify-center self-center md:self-start relative">
                  {pwa512Url ?
                    <Image src={pwa512Url} alt="PWA 512" fill className="object-contain" />
                    : <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  }
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input type="file" accept="image/png" className="h-9 text-xs" onChange={(e) => onFileSelect(e, setPwa512Src, setPwa512SelectedFile, setIsPwa512Cropping)} disabled={isReadOnly} />
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowPwa512Url(!showPwa512Url)} title="Toggle External URL"><LinkIcon className="h-4 w-4" /></Button>
                  </div>
                  {showPwa512Url && (
                    <FormField control={form.control} name="pwaIcon512Url" render={({ field }) => (
                      <FormItem>
                        <FormControl><Input placeholder="Icon 512 URL..." className="h-9 text-xs" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
              </div>

              {/* Maskable Icon Section */}
              <div className="flex flex-col gap-4">
                <Label className="text-sm font-semibold">Maskable Icon</Label>
                <div className="h-20 w-20 shrink-0 overflow-hidden bg-transparent flex items-center justify-center self-center md:self-start relative">
                  {pwaMaskableUrl ?
                    <Image src={pwaMaskableUrl} alt="PWA Maskable" fill className="object-contain" />
                    : <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  }
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input type="file" accept="image/png" className="h-9 text-xs" onChange={(e) => onFileSelect(e, setPwaMaskableSrc, setPwaMaskableSelectedFile, setIsPwaMaskableCropping)} disabled={isReadOnly} />
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowPwaMaskableUrl(!showPwaMaskableUrl)} title="Toggle External URL"><LinkIcon className="h-4 w-4" /></Button>
                  </div>
                  {showPwaMaskableUrl && (
                    <FormField control={form.control} name="pwaIconMaskableUrl" render={({ field }) => (
                      <FormItem>
                        <FormControl><Input placeholder="Maskable URL..." className="h-9 text-xs" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
              </div>

              {/* Screenshot Section */}
              <div className="flex flex-col gap-4">
                <Label className="text-sm font-semibold">Screenshot</Label>
                <div className="h-20 w-32 shrink-0 overflow-hidden bg-transparent flex items-center justify-center self-center md:self-start relative">
                  {pwaScreenshotUrl ?
                    <Image src={pwaScreenshotUrl} alt="PWA Screenshot" fill className="object-contain" />
                    : <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  }
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input type="file" accept="image/png, image/jpeg" className="h-9 text-xs" onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const file = e.target.files[0];
                        setPwaScreenshotSelectedFile(file);
                        setPwaScreenshotUrl(URL.createObjectURL(file));
                      }
                    }} disabled={isReadOnly} />
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowPwaScreenshotUrl(!showPwaScreenshotUrl)} title="Toggle External URL"><LinkIcon className="h-4 w-4" /></Button>
                  </div>
                  {showPwaScreenshotUrl && (
                    <FormField control={form.control} name="pwaScreenshotUrl" render={({ field }) => (
                      <FormItem>
                        <FormControl><Input placeholder="Screenshot URL..." className="h-9 text-xs" {...field} value={field.value || ""} disabled={isReadOnly} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button type="submit" size="lg" className="w-full md:w-auto min-w-[150px]" disabled={isSubmitting || isLoadingData || isReadOnly}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save All Changes</>}
          </Button>
        </div>
      </form>

      {/* Company Logo Cropping Dialog */}
      <Dialog open={isCompanyLogoCropping} onOpenChange={setIsCompanyLogoCropping}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Crop Company Logo (Sidebar)</DialogTitle></DialogHeader>
          {companyLogoSrc && (
            <ReactCrop crop={companyLogoCrop} onChange={(_, c) => setCompanyLogoCrop(c)} onComplete={(c) => setCompanyLogoCompletedCrop(c)} aspect={sidebarWidth / sidebarHeight} minWidth={100}>
              <img ref={companyLogoImgRef} src={companyLogoSrc} alt="Crop preview" onLoad={(e) => onImageLoad(e, sidebarWidth / sidebarHeight, setCompanyLogoCrop)} style={{ maxHeight: '70vh' }} />
            </ReactCrop>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleCropAndUpload(companyLogoImgRef, companyLogoCompletedCrop, companyLogoSelectedFile, setCompanyLogoSelectedFile, (url) => setCompanyLogoUrl(url), setIsCompanyLogoCropping, true)}>
                Add without Crop
              </Button>
              <Button onClick={() => handleCropAndUpload(companyLogoImgRef, companyLogoCompletedCrop, companyLogoSelectedFile, setCompanyLogoSelectedFile, (url) => setCompanyLogoUrl(url), setIsCompanyLogoCropping)}>
                <CropIcon className="mr-2 h-4 w-4" />Crop & Set
              </Button>
            </div>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Logo Cropping Dialog */}
      <Dialog open={isInvoiceLogoCropping} onOpenChange={setIsInvoiceLogoCropping}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Crop Invoice Logo</DialogTitle></DialogHeader>
          {invoiceLogoSrc && (
            <ReactCrop crop={invoiceLogoCrop} onChange={(_, c) => setInvoiceLogoCrop(c)} onComplete={(c) => setInvoiceLogoCompletedCrop(c)} aspect={invoiceWidth / invoiceHeight}>
              <img ref={invoiceLogoImgRef} src={invoiceLogoSrc} alt="Crop preview" onLoad={(e) => onImageLoad(e, invoiceWidth / invoiceHeight, setInvoiceLogoCrop)} style={{ maxHeight: '70vh' }} />
            </ReactCrop>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleCropAndUpload(invoiceLogoImgRef, invoiceLogoCompletedCrop, invoiceLogoSelectedFile, setInvoiceLogoSelectedFile, setInvoiceLogoUrl, setIsInvoiceLogoCropping, true)} disabled={isUploading}>
                Add without Crop
              </Button>
              <Button onClick={() => handleCropAndUpload(invoiceLogoImgRef, invoiceLogoCompletedCrop, invoiceLogoSelectedFile, setInvoiceLogoSelectedFile, setInvoiceLogoUrl, setIsInvoiceLogoCropping)} disabled={isUploading || !invoiceLogoCompletedCrop?.width}>
                {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : <><CropIcon className="mr-2 h-4 w-4" />Crop & Set</>}
              </Button>
            </div>
            <DialogClose asChild><Button variant="outline" disabled={isUploading}>Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Favicon Cropping Dialog */}
      <Dialog open={isFaviconCropping} onOpenChange={setIsFaviconCropping}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Crop Favicon</DialogTitle></DialogHeader>
          {faviconSrc && (
            <ReactCrop crop={faviconCrop} onChange={(_, c) => setFaviconCrop(c)} onComplete={(c) => setFaviconCompletedCrop(c)} aspect={1} minWidth={48}>
              <img ref={faviconImgRef} src={faviconSrc} alt="Crop preview" onLoad={(e) => onImageLoad(e, 1, setFaviconCrop)} style={{ maxHeight: '70vh' }} />
            </ReactCrop>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleCropAndUpload(faviconImgRef, faviconCompletedCrop, faviconSelectedFile, setFaviconSelectedFile, (url) => setFaviconUrl(url), setIsFaviconCropping, true)}>
                Add without Crop
              </Button>
              <Button onClick={() => handleCropAndUpload(faviconImgRef, faviconCompletedCrop, faviconSelectedFile, setFaviconSelectedFile, (url) => setFaviconUrl(url), setIsFaviconCropping)}>
                <CropIcon className="mr-2 h-4 w-4" />Crop & Set
              </Button>
            </div>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* PWA 192 Cropping Dialog */}
      <Dialog open={isPwa192Cropping} onOpenChange={setIsPwa192Cropping}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Crop App Icon (192x192)</DialogTitle></DialogHeader>
          {pwa192Src && (
            <ReactCrop crop={pwa192Crop} onChange={(_, c) => setPwa192Crop(c)} onComplete={(c) => setPwa192CompletedCrop(c)} aspect={1}>
              <img ref={pwa192ImgRef} src={pwa192Src} alt="Crop preview" onLoad={(e) => onImageLoad(e, 1, setPwa192Crop)} style={{ maxHeight: '70vh' }} />
            </ReactCrop>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleCropAndUpload(pwa192ImgRef, pwa192CompletedCrop, pwa192SelectedFile, setPwa192SelectedFile, (url) => setPwa192Url(url), setIsPwa192Cropping, true)}>
                Add without Crop
              </Button>
              <Button onClick={() => handleCropAndUpload(pwa192ImgRef, pwa192CompletedCrop, pwa192SelectedFile, setPwa192SelectedFile, (url) => setPwa192Url(url), setIsPwa192Cropping)}>
                <CropIcon className="mr-2 h-4 w-4" />Crop & Set
              </Button>
            </div>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PWA 512 Cropping Dialog */}
      <Dialog open={isPwa512Cropping} onOpenChange={setIsPwa512Cropping}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Crop App Icon (512x512)</DialogTitle></DialogHeader>
          {pwa512Src && (
            <ReactCrop crop={pwa512Crop} onChange={(_, c) => setPwa512Crop(c)} onComplete={(c) => setPwa512CompletedCrop(c)} aspect={1}>
              <img ref={pwa512ImgRef} src={pwa512Src} alt="Crop preview" onLoad={(e) => onImageLoad(e, 1, setPwa512Crop)} style={{ maxHeight: '70vh' }} />
            </ReactCrop>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleCropAndUpload(pwa512ImgRef, pwa512CompletedCrop, pwa512SelectedFile, setPwa512SelectedFile, (url) => setPwa512Url(url), setIsPwa512Cropping, true)}>
                Add without Crop
              </Button>
              <Button onClick={() => handleCropAndUpload(pwa512ImgRef, pwa512CompletedCrop, pwa512SelectedFile, setPwa512SelectedFile, (url) => setPwa512Url(url), setIsPwa512Cropping)}>
                <CropIcon className="mr-2 h-4 w-4" />Crop & Set
              </Button>
            </div>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* PWA 144 Cropping Dialog */}
      <Dialog open={isPwa144Cropping} onOpenChange={setIsPwa144Cropping}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Crop App Icon (144x144)</DialogTitle></DialogHeader>
          {pwa144Src && (
            <ReactCrop crop={pwa144Crop} onChange={(_, c) => setPwa144Crop(c)} onComplete={(c) => setPwa144CompletedCrop(c)} aspect={1}>
              <img ref={pwa144ImgRef} src={pwa144Src} alt="Crop preview" onLoad={(e) => onImageLoad(e, 1, setPwa144Crop)} style={{ maxHeight: '70vh' }} />
            </ReactCrop>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleCropAndUpload(pwa144ImgRef, pwa144CompletedCrop, pwa144SelectedFile, setPwa144SelectedFile, (url) => setPwa144Url(url), setIsPwa144Cropping, true)}>
                Add without Crop
              </Button>
              <Button onClick={() => handleCropAndUpload(pwa144ImgRef, pwa144CompletedCrop, pwa144SelectedFile, setPwa144SelectedFile, (url) => setPwa144Url(url), setIsPwa144Cropping)}>
                <CropIcon className="mr-2 h-4 w-4" />Crop & Set
              </Button>
            </div>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PWA Maskable Cropping Dialog */}
      <Dialog open={isPwaMaskableCropping} onOpenChange={setIsPwaMaskableCropping}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Crop Maskable Icon (192x192)</DialogTitle></DialogHeader>
          {pwaMaskableSrc && (
            <ReactCrop crop={pwaMaskableCrop} onChange={(_, c) => setPwaMaskableCrop(c)} onComplete={(c) => setPwaMaskableCompletedCrop(c)} aspect={1}>
              <img ref={pwaMaskableImgRef} src={pwaMaskableSrc} alt="Crop preview" onLoad={(e) => onImageLoad(e, 1, setPwaMaskableCrop)} style={{ maxHeight: '70vh' }} />
            </ReactCrop>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleCropAndUpload(pwaMaskableImgRef, pwaMaskableCompletedCrop, pwaMaskableSelectedFile, setPwaMaskableSelectedFile, (url) => setPwaMaskableUrl(url), setIsPwaMaskableCropping, true)}>
                Add without Crop
              </Button>
              <Button onClick={() => handleCropAndUpload(pwaMaskableImgRef, pwaMaskableCompletedCrop, pwaMaskableSelectedFile, setPwaMaskableSelectedFile, (url) => setPwaMaskableUrl(url), setIsPwaMaskableCropping)}>
                <CropIcon className="mr-2 h-4 w-4" />Crop & Set
              </Button>
            </div>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
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

