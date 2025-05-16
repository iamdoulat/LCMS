
"use client";

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, UploadCloud } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext'; // Import useAuth

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FileInput } from './FileInput'; 

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/svg+xml"];

const companySetupSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  address: z.string().min(1, "Company address is required"),
  contactPerson: z.string().optional(),
  cellNumber: z.string().regex(/^\+?[0-9\s-()]*$/, "Invalid phone number format").optional().or(z.literal('')),
  emailId: z.string().email("Invalid email address").optional().or(z.literal('')),
  binNumber: z.string().optional(),
  tinNumber: z.string().optional(),
  companyLogo: z.instanceof(File).optional().nullable()
    .refine(file => !file || file.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      file => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Only .jpg, .jpeg, .png, .webp and .svg files are accepted."
    ),
});

type CompanySetupFormValues = z.infer<typeof companySetupSchema>;

export function CompanySetupForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { companyName: currentCompanyName, updateCompanyName } = useAuth(); // Get updateCompanyName from context

  const form = useForm<CompanySetupFormValues>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: {
      companyName: currentCompanyName || 'Smart Solution', // Initialize with context or default
      address: 'House#50, Road#10, Sector#10, Uttara Model Town, Dhaka-1230',
      contactPerson: '',
      cellNumber: '',
      emailId: 'info@smartsolution-bd.com',
      binNumber: '',
      tinNumber: '',
      companyLogo: null,
    },
  });

  // Effect to update form if companyName changes in context (e.g. from localStorage on initial load)
  React.useEffect(() => {
    form.setValue('companyName', currentCompanyName || 'Smart Solution');
  }, [currentCompanyName, form]);


  async function onSubmit(data: CompanySetupFormValues) {
    setIsSubmitting(true);
    console.log("Company Setup Form Data:", data);
    if (data.companyLogo) {
      console.log("Company Logo details:", {
        name: data.companyLogo.name,
        type: data.companyLogo.type,
        size: data.companyLogo.size,
      });
      // TODO: Implement logo upload to Firebase Storage and get URL
      // For now, we won't update the logo URL in context from here
    }

    // Update company name in context and localStorage
    if (data.companyName) {
      updateCompanyName(data.companyName);
    }

    // Placeholder for actual submission to a backend/Firebase
    await new Promise(resolve => setTimeout(resolve, 1500)); 

    Swal.fire({
      title: "Company Information Saved (Simulated)",
      text: "Company data logged to console. Name updated in sidebar. Implement backend submission to save permanently.",
      icon: "success",
      timer: 3000,
      showConfirmButton: true,
    });
    setIsSubmitting(false);
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
                  onChange={(e) => {
                    field.onChange(e); // Propagate change to react-hook-form
                    updateCompanyName(e.target.value); // Update context immediately
                  }}
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
          name="companyLogo"
          render={({ field }) => ( // field here is from Controller, specifically field.onChange for FileInput
            <FormItem>
              <FormLabel>Company Logo</FormLabel>
              <FormControl>
                <FileInput
                  onFileChange={(file) => field.onChange(file)} // Pass file to RHF
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                />
              </FormControl>
              <FormDescription>
                Upload your company logo. Recommended size: 512x512px. Max 5MB. (JPG, PNG, WEBP, SVG)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />


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
          This information will be used to pre-fill relevant fields in other parts of the application.
        </FormDescription>

        <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
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
