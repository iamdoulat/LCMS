
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Store } from 'lucide-react'; 
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc } from 'firebase/firestore';
import type { Supplier } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FileInput } from './FileInput'; 

const supplierSchema = z.object({
  beneficiaryName: z.string().min(1, "Beneficiary name is required"),
  headOfficeAddress: z.string().min(1, "Head office address is required"),
  contactPersonName: z.string().min(1, "Contact person name is required"),
  cellNumber: z.string().min(10, "Cell number must be at least 10 digits").regex(/^\+?[0-9\s-()]*$/, "Invalid cell number format"),
  emailId: z.string().email("Invalid email address"),
  website: z.string().url("Invalid URL format").optional().or(z.literal('')),
  brandName: z.string().min(1, "Brand name is required"),
  brandLogoFile: z.instanceof(File).optional().nullable()
    .refine(file => !file || file.size <= 5 * 1024 * 1024, `Max file size is 5MB.`)
    .refine(
      file => !file || ["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.type),
      ".jpg, .jpeg, .png, .webp and .svg files are accepted."
    ),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

export function AddSupplierForm() { 
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      beneficiaryName: '',
      headOfficeAddress: '',
      contactPersonName: '',
      cellNumber: '',
      emailId: '',
      website: '',
      brandName: '',
      brandLogoFile: null,
    },
  });

  async function onSubmit(data: SupplierFormValues) {
    setIsSubmitting(true);
    const now = new Date().toISOString();
    
    // Exclude brandLogoFile from dataToSave, handle file upload separately
    const { brandLogoFile, ...restOfData } = data;

    const dataToSave: Omit<Supplier, 'id' | 'brandLogoFile' | 'brandLogoUrl'> = {
      ...restOfData,
      createdAt: now,
      updatedAt: now,
    };
    
    // Filter out undefined optional fields
    Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key as keyof typeof dataToSave] === undefined) {
            delete dataToSave[key as keyof typeof dataToSave];
        }
    });

    if (brandLogoFile) {
      console.log("Brand Logo File selected:", brandLogoFile.name, brandLogoFile.size, brandLogoFile.type);
      // TODO: Implement Firebase Storage upload for brandLogoFile here
      // After upload, get the downloadURL and add it to dataToSave as brandLogoUrl
    }

    try {
      const docRef = await addDoc(collection(firestore, "suppliers"), dataToSave);
      Swal.fire({
        title: "Beneficiary Profile Saved!",
        text: `Beneficiary data saved successfully to Firestore with ID: ${docRef.id}. Logo upload needs to be implemented.`,
        icon: "success",
        timer: 3000,
        showConfirmButton: true,
      });
      form.reset(); 
    } catch (error) {
      console.error("Error adding beneficiary document: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save beneficiary profile: ${errorMessage}`,
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
        
        <FormField
          control={form.control}
          name="brandLogoFile"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brand Logo</FormLabel>
              <FormControl>
                <FileInput
                  onFileChange={(file) => field.onChange(file)}
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                />
              </FormControl>
              <FormDescription>
                Upload the brand logo (max 5MB, JPG, PNG, WEBP, SVG).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Beneficiary...
            </>
          ) : (
            <>
              <Store className="mr-2 h-4 w-4" /> 
              Save Beneficiary Profile
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
