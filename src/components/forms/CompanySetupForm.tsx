
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { CompanyProfile } from '@/types';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const COMPANY_PROFILE_DOC_ID = 'main_settings';

interface FinancialSettingsProfile {
  companyName?: string;
  address?: string;
  invoiceLogoUrl?: string;
  emailId?: string;
  cellNumber?: string;
  hideCompanyName?: boolean;
  updatedAt?: any;
}


const companySetupSchema = z.object({
  companyName: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  cellNumber: z.string().regex(/^\+?[0-9\s-()]*$/, "Invalid phone number format").optional().or(z.literal('')),
  emailId: z.string().email("Invalid email address").optional().or(z.literal('')),
  binNumber: z.string().optional(),
  tinNumber: z.string().optional(),
  companyLogoUrl: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : String(val).trim()),
    z.string().url({ message: "Invalid URL format for Company Logo" }).optional()
  ),
  invoiceLogoUrl: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : String(val).trim()),
    z.string().url({ message: "Invalid URL format for Invoice Logo" }).optional()
  ),
  hideCompanyName: z.boolean().optional().default(false),
});

type CompanySetupFormValues = z.infer<typeof companySetupSchema>;

const DEFAULT_COMPANY_NAME = 'Smart Solution';
const DEFAULT_ADDRESS = 'House#50, Road#10, Sector#10, Uttara Model Town, Dhaka-1230';
const DEFAULT_EMAIL = 'info@smartsolution-bd.com';
const DEFAULT_COMPANY_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";


export function CompanySetupForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const { user: authUser, loading: authLoading, companyName: contextCompanyName, companyLogoUrl: contextCompanyLogoUrl, updateCompanyProfile, userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  
  const [currentLogoUrlForPreview, setCurrentLogoUrlForPreview] = React.useState<string | undefined>(contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL);
  const [currentInvoiceLogoUrlForPreview, setCurrentInvoiceLogoUrlForPreview] = React.useState<string | undefined>(undefined);

  const form = useForm<CompanySetupFormValues>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: {
      companyName: contextCompanyName || DEFAULT_COMPANY_NAME,
      address: DEFAULT_ADDRESS,
      contactPerson: '',
      cellNumber: '',
      emailId: DEFAULT_EMAIL,
      binNumber: '',
      tinNumber: '',
      companyLogoUrl: contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
      invoiceLogoUrl: '',
      hideCompanyName: false,
    },
  });

  React.useEffect(() => {
    const fetchCompanyData = async () => {
      setIsLoadingData(true);
      try {
        const profileDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, COMPANY_PROFILE_DOC_ID);
        const profileDocSnap = await getDoc(profileDocRef);
        
        let initialProfileData: CompanySetupFormValues = {
          companyName: contextCompanyName || DEFAULT_COMPANY_NAME,
          address: DEFAULT_ADDRESS,
          emailId: DEFAULT_EMAIL,
          companyLogoUrl: contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          invoiceLogoUrl: '',
          contactPerson: '', cellNumber: '', binNumber: '', tinNumber: '',
          hideCompanyName: false,
        };

        if (profileDocSnap.exists()) {
          const data = profileDocSnap.data() as CompanyProfile;
          initialProfileData = {
            companyName: data.companyName || DEFAULT_COMPANY_NAME,
            address: data.address || DEFAULT_ADDRESS,
            contactPerson: data.contactPerson || '',
            cellNumber: data.cellNumber || '',
            emailId: data.emailId || DEFAULT_EMAIL,
            binNumber: data.binNumber || '',
            tinNumber: data.tinNumber || '',
            companyLogoUrl: data.companyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
            invoiceLogoUrl: data.invoiceLogoUrl || '',
            hideCompanyName: data.hideCompanyName ?? false,
          };
        }
        form.reset(initialProfileData);
        setCurrentLogoUrlForPreview(initialProfileData.companyLogoUrl);
        setCurrentInvoiceLogoUrlForPreview(initialProfileData.invoiceLogoUrl);
      } catch (error) {
        console.error("CompanySetupForm: Error fetching company profile:", error);
        Swal.fire("Error", "Could not load company profile. Using defaults.", "error");
        form.reset({
          companyName: contextCompanyName || DEFAULT_COMPANY_NAME,
          address: DEFAULT_ADDRESS, emailId: DEFAULT_EMAIL,
          companyLogoUrl: contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          invoiceLogoUrl: '',
          contactPerson: '', cellNumber: '', binNumber: '', tinNumber: '',
          hideCompanyName: false,
        });
        setCurrentLogoUrlForPreview(contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL);
        setCurrentInvoiceLogoUrlForPreview(undefined);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (!authLoading) { 
      if (authUser) { 
        fetchCompanyData();
      } else { 
        setIsLoadingData(false); 
         form.reset({
          companyName: DEFAULT_COMPANY_NAME, address: DEFAULT_ADDRESS, emailId: DEFAULT_EMAIL,
          companyLogoUrl: DEFAULT_COMPANY_LOGO_URL,
          invoiceLogoUrl: '',
          contactPerson: '', cellNumber: '', binNumber: '', tinNumber: '',
          hideCompanyName: false,
        });
        setCurrentLogoUrlForPreview(DEFAULT_COMPANY_LOGO_URL);
        setCurrentInvoiceLogoUrlForPreview(undefined);
      }
    }
  }, [form, contextCompanyName, contextCompanyLogoUrl, authLoading, authUser]);


  async function onSubmit(data: CompanySetupFormValues) {
    setIsSubmitting(true);
    
    const dataToSave: FinancialSettingsProfile = {
      companyName: data.companyName,
      address: data.address,
      invoiceLogoUrl: data.invoiceLogoUrl || undefined,
      emailId: data.emailId || undefined,
      cellNumber: data.cellNumber || undefined,
      hideCompanyName: data.hideCompanyName,
      updatedAt: serverTimestamp(),
    };
    
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key as keyof FinancialSettingsProfile] === undefined) {
        delete dataToSave[key as keyof FinancialSettingsProfile];
      }
    });

    try {
      const profileDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, FINANCIAL_SETTINGS_DOC_ID);
      await setDoc(profileDocRef, dataToSave, { merge: true });
      
      updateCompanyProfile({ 
        companyName: data.companyName, 
        companyLogoUrl: data.companyLogoUrl || undefined,
        invoiceLogoUrl: data.invoiceLogoUrl || undefined 
      });
      setCurrentLogoUrlForPreview(data.companyLogoUrl || undefined);
      setCurrentInvoiceLogoUrlForPreview(data.invoiceLogoUrl || undefined);

      Swal.fire({
        title: "Layout Settings Saved!",
        text: "The settings for financial documents have been successfully updated.",
        icon: "success",
        timer: 2500,
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

  const watchedLogoUrl = form.watch("companyLogoUrl");
  const watchedInvoiceLogoUrl = form.watch("invoiceLogoUrl");

  React.useEffect(() => {
    if (watchedLogoUrl !== currentLogoUrlForPreview) {
      setCurrentLogoUrlForPreview(watchedLogoUrl);
    }
  }, [watchedLogoUrl, currentLogoUrlForPreview]);

  React.useEffect(() => {
    if (watchedInvoiceLogoUrl !== currentInvoiceLogoUrlForPreview) {
      setCurrentInvoiceLogoUrlForPreview(watchedInvoiceLogoUrl);
    }
  }, [watchedInvoiceLogoUrl, currentInvoiceLogoUrlForPreview]);


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
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name*</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your company's official name" 
                      {...field}
                      disabled={isReadOnly}
                    />
                  </FormControl>
                  <FormDescription>This name will appear on all financial documents.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="hideCompanyName"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-card">
                    <FormControl>
                        <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="hideCompanyName"
                        disabled={isReadOnly}
                        />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel htmlFor="hideCompanyName" className="text-sm font-medium hover:cursor-pointer">
                        Hide Company Name on Documents
                        </FormLabel>
                        <FormDescription className="text-xs">
                        If checked, the company name will not be printed on quotes, invoices, or orders.
                        </FormDescription>
                    </div>
                    </FormItem>
                )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Address*</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter company address for documents" {...field} rows={3} disabled={isReadOnly} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="emailId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email ID</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="contact@company.com" {...field} value={field.value || ""} disabled={isReadOnly} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cellNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cell Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="e.g., +1 123 456 7890" {...field} value={field.value || ""} disabled={isReadOnly} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="invoiceLogoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Logo URL</FormLabel>
                  <FormControl>
                    <Input 
                      type="url" 
                      placeholder="https://example.com/invoice-logo.png" 
                      {...field} 
                      value={field.value || ""} 
                      disabled={isReadOnly}
                    />
                  </FormControl>
                  <FormDescription>
                    A specific logo for invoices. If blank, the main company logo will be used.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {currentInvoiceLogoUrlForPreview && (currentInvoiceLogoUrlForPreview.startsWith('http://') || currentInvoiceLogoUrlForPreview.startsWith('https://')) && (
              <div className="space-y-2">
                <Label>Invoice Logo Preview</Label>
                <Image 
                  src={currentInvoiceLogoUrlForPreview} 
                  alt="Invoice Logo Preview" 
                  width={200} 
                  height={40} 
                  className="rounded-sm border object-contain bg-slate-200 p-2"
                  onError={() => console.warn("Error loading logo preview from URL")}
                  data-ai-hint="invoice logo"
                />
              </div>
            )}
          </div>
        </div>
        
         <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="contactPerson"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Person</FormLabel>
                <FormControl>
                  <Input placeholder="Enter name of the primary contact" {...field} value={field.value || ""} disabled={isReadOnly} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="binNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>BIN No.</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Business Identification Number" {...field} value={field.value || ""} disabled={isReadOnly} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tinNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>TIN No.</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Taxpayer Identification Number" {...field} value={field.value || ""} disabled={isReadOnly} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="companyLogoUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Logo URL</FormLabel>
                <FormControl>
                  <Input 
                    type="url" 
                    placeholder="https://example.com/logo.png" 
                    {...field} 
                    value={field.value || ""} 
                    disabled={isReadOnly}
                  />
                </FormControl>
                <FormDescription>
                  Enter the direct URL to your company logo. This will be used in the sidebar header.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {currentLogoUrlForPreview && currentLogoUrlForPreview.trim() !== "" && (currentLogoUrlForPreview.startsWith('http://') || currentLogoUrlForPreview.startsWith('https://')) && (
          <div className="space-y-2">
            <Label>Company Logo Preview (for Sidebar)</Label>
            <Image 
              src={currentLogoUrlForPreview} 
              alt="Company Logo Preview" 
              width={32} 
              height={32} 
              className="rounded-sm border object-contain"
              onError={() => {
                console.warn("Error loading logo preview from URL:", currentLogoUrlForPreview);
              }}
              data-ai-hint="company logo"
            />
          </div>
        )}

        <Separator />
        
        <FormDescription>
          This information will be used to pre-fill relevant fields in other parts of the application and for display purposes.
        </FormDescription>

        <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || isLoadingData || isReadOnly}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Layout Settings
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
