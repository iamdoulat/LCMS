
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
});

type CompanySetupFormValues = z.infer<typeof companySetupSchema>;

export function CompanySetupForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const { companyName: contextCompanyName, companyLogoUrl: contextCompanyLogoUrl, updateCompanyProfile } = useAuth();
  const [currentLogoUrlForPreview, setCurrentLogoUrlForPreview] = React.useState<string | undefined>(contextCompanyLogoUrl);

  const form = useForm<CompanySetupFormValues>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: {
      companyName: '',
      address: '',
      contactPerson: '',
      cellNumber: '',
      emailId: '',
      binNumber: '',
      tinNumber: '',
      companyLogoUrl: '',
    },
  });

  React.useEffect(() => {
    const fetchCompanyData = async () => {
      setIsLoadingData(true);
      try {
        const profileDocRef = doc(firestore, COMPANY_PROFILE_COLLECTION, COMPANY_PROFILE_DOC_ID);
        const profileDocSnap = await getDoc(profileDocRef);
        if (profileDocSnap.exists()) {
          const data = profileDocSnap.data() as CompanyProfile;
          form.reset({
            companyName: data.companyName || '',
            address: data.address || '',
            contactPerson: data.contactPerson || '',
            cellNumber: data.cellNumber || '',
            emailId: data.emailId || '',
            binNumber: data.binNumber || '',
            tinNumber: data.tinNumber || '',
            companyLogoUrl: data.companyLogoUrl || '',
          });
          setCurrentLogoUrlForPreview(data.companyLogoUrl);
          // Ensure context is updated if Firestore has more recent data than localStorage
          if (data.companyName !== contextCompanyName || data.companyLogoUrl !== contextCompanyLogoUrl) {
            updateCompanyProfile({ name: data.companyName, logoUrl: data.companyLogoUrl });
          }
        } else {
          // If no data in Firestore, rely on context (which loads from localStorage or defaults)
          form.reset({
            companyName: contextCompanyName || 'Smart Solution',
            address: 'House#50, Road#10, Sector#10, Uttara Model Town, Dhaka-1230', // Default address if not in context
            emailId: 'info@smartsolution-bd.com', // Default email if not in context
            contactPerson: '',
            cellNumber: '',
            binNumber: '',
            tinNumber: '',
            companyLogoUrl: contextCompanyLogoUrl || '',
          });
          setCurrentLogoUrlForPreview(contextCompanyLogoUrl);
        }
      } catch (error) {
        console.error("Error fetching company profile:", error);
        Swal.fire("Error", "Could not load company profile. Using default or cached values.", "error");
        // Fallback to context values if Firestore fetch fails
        form.reset({
          companyName: contextCompanyName || 'Smart Solution',
          address: 'House#50, Road#10, Sector#10, Uttara Model Town, Dhaka-1230',
          emailId: 'info@smartsolution-bd.com',
          companyLogoUrl: contextCompanyLogoUrl || '',
        });
        setCurrentLogoUrlForPreview(contextCompanyLogoUrl);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchCompanyData();
  }, [form, contextCompanyName, contextCompanyLogoUrl, updateCompanyProfile]);

  // Update preview if URL changes in form
  const watchedLogoUrlField = form.watch("companyLogoUrl");
  React.useEffect(() => {
    setCurrentLogoUrlForPreview(watchedLogoUrlField);
  }, [watchedLogoUrlField]);


  async function onSubmit(data: CompanySetupFormValues) {
    setIsSubmitting(true);
    
    const dataToSave: CompanyProfile = {
      ...data,
      companyLogoUrl: data.companyLogoUrl || undefined,
      updatedAt: serverTimestamp(),
    };

    try {
      const profileDocRef = doc(firestore, COMPANY_PROFILE_COLLECTION, COMPANY_PROFILE_DOC_ID);
      await setDoc(profileDocRef, dataToSave, { merge: true });
      
      // Update AuthContext and localStorage after successful save
      updateCompanyProfile({ name: data.companyName, logoUrl: data.companyLogoUrl || undefined });

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

  if (isLoadingData) {
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
                  // Remove direct context update from onChange, it will happen on submit
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
                <Textarea placeholder="Enter company's full registered address" {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="companyLogoUrl"
          render={({ field }) => ( // field already includes onChange, value, name, etc.
            <FormItem>
              <FormLabel>Company Logo URL</FormLabel>
              <FormControl>
                <Input 
                  type="url" 
                  placeholder="https://example.com/logo.png" 
                  {...field} // Spread field props here
                  // The onChange from field will update react-hook-form state.
                  // The local preview state is updated by the watch effect.
                />
              </FormControl>
              <FormDescription>
                Enter the direct URL to your company logo. Recommended size for display: 512x512px.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {currentLogoUrlForPreview && (
          <div className="space-y-2">
            <Label>Logo Preview (32x32)</Label>
            <Image 
              src={currentLogoUrlForPreview} 
              alt="Company Logo Preview" 
              width={32} 
              height={32} 
              className="rounded-sm border object-contain"
              onError={() => {
                // Optionally handle image load errors for the preview
                console.warn("Error loading logo preview from URL:", currentLogoUrlForPreview);
              }}
              data-ai-hint="company logo"
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
                  <Input placeholder="Enter name of the primary contact" {...field} />
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
                  <Input type="tel" placeholder="e.g., +1 123 456 7890" {...field} />
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
                <Input type="email" placeholder="contact@company.com" {...field} />
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
                  <Input placeholder="Enter Business Identification Number" {...field} />
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
                  <Input placeholder="Enter Taxpayer Identification Number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormDescription>
          This information will be used to pre-fill relevant fields in other parts of the application and for display purposes.
        </FormDescription>

        <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || isLoadingData}>
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
