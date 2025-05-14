
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UploadCloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FileInput } from './FileInput'; // Assuming FileInput is in the same directory
import { useToast } from '@/hooks/use-toast';

const supplierSchema = z.object({
  supplierName: z.string().min(1, "Supplier name is required"),
  headOfficeAddress: z.string().min(1, "Head office address is required"),
  contactPersonName: z.string().min(1, "Contact person name is required"),
  cellNumber: z.string().min(10, "Cell number must be at least 10 digits").regex(/^\+?[0-9\s-()]*$/, "Invalid cell number format"),
  emailId: z.string().email("Invalid email address"),
  website: z.string().url("Invalid URL format").optional().or(z.literal('')),
  brandName: z.string().min(1, "Brand name is required"),
  brandLogo: z.instanceof(File).optional().nullable()
    .refine(file => !file || file.size <= 5 * 1024 * 1024, `Max file size is 5MB.`)
    .refine(
      file => !file || ["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.type),
      ".jpg, .jpeg, .png, .webp and .svg files are accepted."
    ),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

export function AddSupplierForm() {
  const { toast } = useToast();
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      supplierName: '',
      headOfficeAddress: '',
      contactPersonName: '',
      cellNumber: '',
      emailId: '',
      website: '',
      brandName: '',
      brandLogo: null,
    },
  });

  async function onSubmit(data: SupplierFormValues) {
    console.log("Supplier Form Data:", data);
    // Placeholder for actual submission (e.g., to Firebase Firestore and Storage)
    // Example: const logoUrl = data.brandLogo ? await uploadFileToFirebaseStorage(data.brandLogo) : null;
    // await saveSupplierToFirestore({ ...data, brandLogoUrl: logoUrl });

    toast({
      title: "Supplier Profile Submitted (Simulated)",
      description: "Supplier data logged to console. Implement backend submission.",
      variant: "default",
    });
    // form.reset(); // Optionally reset form
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="supplierName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter supplier's official name" {...field} />
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
                  <Input type="email" placeholder="contact@supplier.com" {...field} />
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
                  <Input type="url" placeholder="https://www.supplier.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="brandLogo"
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

        <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Supplier...
            </>
          ) : (
            <>
              <UploadCloud className="mr-2 h-4 w-4" />
              Save Supplier Profile
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
