
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config'; // No direct auth import needed here
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { CompanyProfile } from '@/types';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label'; // Make sure Label is imported
import { useRouter } from 'next/navigation'; // Added useRouter
import { cn } from '@/lib/utils'; // Added cn
import { Building } from 'lucide-react'; // Added Building icon
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';


const COMPANY_PROFILE_COLLECTION = 'company_profile';
const COMPANY_PROFILE_DOC_ID = 'main_profile';

const companySetupSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  address: z.string().min(1, "Company address is required"),
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
  const isReadOnly = userRole === 'Viewer';
  
  const [currentLogoUrlForPreview, setCurrentLogoUrlForPreview] = React.useState<string | undefined>(contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL);
  const [currentInvoiceLogoUrlForPreview, setCurrentInvoiceLogoUrlForPreview] = React.useState<string | undefined>(undefined);

  const form = useForm<CompanySetupFormValues>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: {
      companyName: contextCompanyName || DEFAULT_COMPANY_NAME,
      address: DEFAULT_ADDRESS,
      contactPerson: '',
      cellNumber: '',
      emailId: DEFAULT_EMAIL, // Changed to use DEFAULT_EMAIL
      binNumber: '',
      tinNumber: '',
      companyLogoUrl: contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
      invoiceLogoUrl: '',
    },
  });

  React.useEffect(() => {
    const fetchCompanyData = async () => {
      setIsLoadingData(true);
      try {
        const profileDocRef = doc(firestore, COMPANY_PROFILE_COLLECTION, COMPANY_PROFILE_DOC_ID);
        const profileDocSnap = await getDoc(profileDocRef);
        
        let initialProfileData: CompanySetupFormValues = {
          companyName: contextCompanyName || DEFAULT_COMPANY_NAME,
          address: DEFAULT_ADDRESS,
          emailId: DEFAULT_EMAIL,
          companyLogoUrl: contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          invoiceLogoUrl: '',
          contactPerson: '', cellNumber: '', binNumber: '', tinNumber: '',
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
        });
        setCurrentLogoUrlForPreview(contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL);
        setCurrentInvoiceLogoUrlForPreview(undefined);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (!authLoading) { // Only fetch if auth context is not loading
      if (authUser) { // And if user is available
        fetchCompanyData();
      } else { // No authUser, likely meaning user is not logged in or auth state is still initializing.
        setIsLoadingData(false); // Stop loading animation
         form.reset({
          companyName: DEFAULT_COMPANY_NAME, address: DEFAULT_ADDRESS, emailId: DEFAULT_EMAIL,
          companyLogoUrl: DEFAULT_COMPANY_LOGO_URL,
          invoiceLogoUrl: '',
          contactPerson: '', cellNumber: '', binNumber: '', tinNumber: '',
        });
        setCurrentLogoUrlForPreview(DEFAULT_COMPANY_LOGO_URL);
        setCurrentInvoiceLogoUrlForPreview(undefined);
      }
    }
  }, [form, contextCompanyName, contextCompanyLogoUrl, authLoading, authUser]);


  async function onSubmit(data: CompanySetupFormValues) {
    setIsSubmitting(true);
    
    const dataToSave: CompanyProfile = {
      companyName: data.companyName,
      address: data.address,
      contactPerson: data.contactPerson || undefined,
      cellNumber: data.cellNumber || undefined,
      emailId: data.emailId || undefined,
      binNumber: data.binNumber || undefined,
      tinNumber: data.tinNumber || undefined,
      companyLogoUrl: data.companyLogoUrl || undefined, // Save as undefined if empty
      invoiceLogoUrl: data.invoiceLogoUrl || undefined,
      updatedAt: serverTimestamp(),
    };

    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key as keyof CompanyProfile] === undefined) {
        delete dataToSave[key as keyof CompanyProfile];
      }
    });

    try {
      const profileDocRef = doc(firestore, COMPANY_PROFILE_COLLECTION, COMPANY_PROFILE_DOC_ID);
      await setDoc(profileDocRef, dataToSave, { merge: true });
      
      updateCompanyProfile({ 
        name: data.companyName, 
        logoUrl: data.companyLogoUrl || undefined,
        invoiceLogoUrl: data.invoiceLogoUrl || undefined 
      });
      setCurrentLogoUrlForPreview(data.companyLogoUrl || undefined);
      setCurrentInvoiceLogoUrlForPreview(data.invoiceLogoUrl || undefined);

      Swal.fire({
        title: "Company Information Saved!",
        text: "Company profile has been successfully updated in Firestore.",
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
    } catch (error) {
      console.error("Error saving company profile: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save company profile: ${errorMessage}`,
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


  if (isLoadingData || authLoading) { // Check authLoading as well
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
              <FormMessage />
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
                <Textarea placeholder="Enter company's full registered address" {...field} rows={3} disabled={isReadOnly} />
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
                Enter the direct URL to your company logo. Recommended size for display: 512x512px.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
         {currentLogoUrlForPreview && currentLogoUrlForPreview.trim() !== "" && (currentLogoUrlForPreview.startsWith('http://') || currentLogoUrlForPreview.startsWith('https://')) && (
          <div className="space-y-2">
            <Label>Logo Preview (495x72)</Label>
            <Image 
              src={currentLogoUrlForPreview} 
              alt="Company Logo Preview" 
              width={495} 
              height={72} 
              className="rounded-sm border object-contain"
              onError={() => {
                console.warn("Error loading logo preview from URL:", currentLogoUrlForPreview);
              }}
              data-ai-hint="company logo"
            />
          </div>
        )}

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
         {currentInvoiceLogoUrlForPreview && currentInvoiceLogoUrlForPreview.trim() !== "" && (currentInvoiceLogoUrlForPreview.startsWith('http://') || currentInvoiceLogoUrlForPreview.startsWith('https://')) && (
          <div className="space-y-2">
            <Label>Invoice Logo Preview (495x72)</Label>
            <Image 
              src={currentInvoiceLogoUrlForPreview} 
              alt="Invoice Logo Preview" 
              width={495} 
              height={72} 
              className="rounded-sm border object-contain"
              onError={() => {
                console.warn("Error loading invoice logo preview from URL:", currentInvoiceLogoUrlForPreview);
              }}
              data-ai-hint="invoice logo"
            />
          </div>
        )}

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
        </div>

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
        
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
              Save Company Information
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

// Page component that wraps the form
export default function CompanySetupPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const isReadOnly = userRole === 'Viewer';

  React.useEffect(() => {
    if (!authLoading && userRole !== "Super Admin" && userRole !== "Admin" && !isReadOnly) {
      Swal.fire({
        title: 'Access Denied',
        text: 'You are not permitted to view/edit company settings.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
    }
  }, [userRole, authLoading, router, isReadOnly]);

  if (authLoading || (!authLoading && userRole !== "Super Admin" && userRole !== "Admin" && !isReadOnly)) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Building className="h-7 w-7 text-primary" />
            Company Setup
          </CardTitle>
          <CardDescription>
            Configure your company&apos;s core information. This data may be used across the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanySetupForm />
        </CardContent>
      </Card>
    </div>
  );
}
