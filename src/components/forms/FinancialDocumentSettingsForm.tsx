
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
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';

// Firestore location for financial document settings
const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const FINANCIAL_SETTINGS_DOC_ID = 'main_settings';

// Local type for financial settings to be explicit
interface FinancialSettingsProfile {
  companyName?: string;
  address?: string;
  invoiceLogoUrl?: string;
  emailId?: string;
  cellNumber?: string;
  updatedAt?: any;
}

const financialSettingsSchema = z.object({
  companyName: z.string().optional(),
  address: z.string().optional(),
  invoiceLogoUrl: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : String(val).trim()),
    z.string().url({ message: "Invalid URL format for Invoice Logo" }).optional()
  ),
  emailId: z.string().email("Invalid email address").optional().or(z.literal('')),
  cellNumber: z.string().regex(/^\+?[0-9\s-()]*$/, "Invalid phone number format").optional().or(z.literal('')),
});

type FinancialSettingsFormValues = z.infer<typeof financialSettingsSchema>;

export function FinancialDocumentSettingsForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const { userRole } = useAuth();
  const isReadOnly = userRole === 'Viewer';
  
  const [currentInvoiceLogoUrlForPreview, setCurrentInvoiceLogoUrlForPreview] = React.useState<string | undefined>(undefined);

  const form = useForm<FinancialSettingsFormValues>({
    resolver: zodResolver(financialSettingsSchema),
    defaultValues: {
      companyName: '',
      address: '',
      invoiceLogoUrl: '',
      emailId: '',
      cellNumber: '',
    },
  });

  React.useEffect(() => {
    const fetchFinancialSettings = async () => {
      setIsLoadingData(true);
      try {
        const profileDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, FINANCIAL_SETTINGS_DOC_ID);
        const profileDocSnap = await getDoc(profileDocRef);
        
        if (profileDocSnap.exists()) {
          const data = profileDocSnap.data() as FinancialSettingsProfile;
          form.reset({
            companyName: data.companyName || '',
            address: data.address || '',
            invoiceLogoUrl: data.invoiceLogoUrl || '',
            emailId: data.emailId || '',
            cellNumber: data.cellNumber || '',
          });
          setCurrentInvoiceLogoUrlForPreview(data.invoiceLogoUrl);
        } else {
            console.log("No financial settings document found. Displaying empty form.");
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

  async function onSubmit(data: FinancialSettingsFormValues) {
    setIsSubmitting(true);
    
    const dataToSave: FinancialSettingsProfile = {
      companyName: data.companyName,
      address: data.address,
      invoiceLogoUrl: data.invoiceLogoUrl || undefined,
      emailId: data.emailId || undefined,
      cellNumber: data.cellNumber || undefined,
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
      
      setCurrentInvoiceLogoUrlForPreview(data.invoiceLogoUrl || undefined);

      Swal.fire({
        title: "Financial Settings Saved!",
        text: "The settings for financial documents have been successfully updated.",
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
    } catch (error) {
      console.error("Error saving financial settings: ", error);
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

  const watchedInvoiceLogoUrl = form.watch("invoiceLogoUrl");

  React.useEffect(() => {
    if (watchedInvoiceLogoUrl !== currentInvoiceLogoUrlForPreview) {
      setCurrentInvoiceLogoUrlForPreview(watchedInvoiceLogoUrl);
    }
  }, [watchedInvoiceLogoUrl, currentInvoiceLogoUrlForPreview]);

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading financial settings...</p>
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
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Enter company name for invoices/quotes" 
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
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Address</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter company address for invoices/quotes" {...field} rows={3} disabled={isReadOnly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
              <FormDescription>The logo to be used on all financial documents.</FormDescription>
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
