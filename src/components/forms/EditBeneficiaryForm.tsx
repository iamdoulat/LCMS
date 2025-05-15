
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Store } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Supplier, SupplierDocument } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
// FileInput might be added later if logo re-upload is implemented
// import { FileInput } from './FileInput';

// Schema largely mirrors AddSupplierForm, but logo handling is simplified for edit
const beneficiarySchema = z.object({
  beneficiaryName: z.string().min(1, "Beneficiary name is required"),
  headOfficeAddress: z.string().min(1, "Head office address is required"),
  contactPersonName: z.string().min(1, "Contact person name is required"),
  cellNumber: z.string().min(10, "Cell number must be at least 10 digits").regex(/^\+?[0-9\s-()]*$/, "Invalid cell number format"),
  emailId: z.string().email("Invalid email address"),
  website: z.string().url("Invalid URL format").optional().or(z.literal('')),
  brandName: z.string().min(1, "Brand name is required"),
  // brandLogoFile: z.instanceof(File).optional().nullable() // Omitted for now to simplify edit
});

type BeneficiaryEditFormValues = z.infer<typeof beneficiarySchema>;

interface EditBeneficiaryFormProps {
  initialData: SupplierDocument;
  beneficiaryId: string;
}

export function EditBeneficiaryForm({ initialData, beneficiaryId }: EditBeneficiaryFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<BeneficiaryEditFormValues>({
    resolver: zodResolver(beneficiarySchema),
    // Default values are set by form.reset in useEffect
  });

  React.useEffect(() => {
    if (initialData) {
      form.reset({
        beneficiaryName: initialData.beneficiaryName || '',
        headOfficeAddress: initialData.headOfficeAddress || '',
        contactPersonName: initialData.contactPersonName || '',
        cellNumber: initialData.cellNumber || '',
        emailId: initialData.emailId || '',
        website: initialData.website || '',
        brandName: initialData.brandName || '',
      });
    }
  }, [initialData, form]);

  async function onSubmit(data: BeneficiaryEditFormValues) {
    setIsSubmitting(true);

    const dataToUpdate: Partial<Omit<Supplier, 'id' | 'brandLogoFile' | 'brandLogoUrl' | 'createdAt' | 'updatedAt'>> & { updatedAt: any } = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    // Filter out undefined or empty optional fields so they are not stored in Firestore
    (Object.keys(dataToUpdate) as Array<keyof typeof dataToUpdate>).forEach(key => {
        if (dataToUpdate[key] === undefined || dataToUpdate[key] === '') {
            delete dataToUpdate[key];
        }
    });

    try {
      const beneficiaryDocRef = doc(firestore, "suppliers", beneficiaryId);
      await updateDoc(beneficiaryDocRef, dataToUpdate);
      Swal.fire({
        title: "Beneficiary Profile Updated!",
        text: `Beneficiary profile for ID: ${beneficiaryId} has been successfully updated.`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
    } catch (error) {
      console.error("Error updating beneficiary document: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Update Failed",
        text: `Failed to update beneficiary profile: ${errorMessage}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="beneficiaryName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Beneficiary Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter beneficiary's official name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="brandName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Brand Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter brand name (if different)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="headOfficeAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Head Office Address*</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter full head office address" {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="contactPersonName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Person Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter main contact's full name" {...field} />
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
                <FormLabel>Cell Number*</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="e.g., +1 123 456 7890" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="emailId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email ID*</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="contact@beneficiary.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website URL</FormLabel>
                <FormControl>
                  <Input type="url" placeholder="https://www.beneficiary.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {/* File input for logo is omitted here for edit simplicity. 
            If needed, it would require more complex logic for:
            - Displaying current logo
            - Handling new logo upload (replacing or adding)
            - Deleting old logo from storage if replaced
        */}
        {initialData.brandLogoUrl && (
            <FormItem>
                <FormLabel>Current Brand Logo</FormLabel>
                <div className="mt-2">
                    <img 
                        src={initialData.brandLogoUrl} 
                        alt={initialData.brandName || 'Brand Logo'} 
                        className="h-20 w-auto rounded-md border object-contain" 
                        data-ai-hint="brand logo"
                    />
                </div>
                <FormDescription>Logo re-upload is not implemented in this form version.</FormDescription>
            </FormItem>
        )}


        <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
