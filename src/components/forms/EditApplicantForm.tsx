
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, UserCog } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Customer, CustomerDocument } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const applicantSchema = z.object({
  applicantName: z.string().min(1, "Applicant name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\+?[0-9\s-()]*$/, "Invalid phone number format").optional().or(z.literal('')),
  address: z.string().min(1, "Address is required"),
  contactPerson: z.string().optional(),
  binNo: z.string().optional(),
  tinNo: z.string().optional(),
  newIrcNo: z.string().optional(),
  oldIrcNo: z.string().optional(),
});

type ApplicantEditFormValues = z.infer<typeof applicantSchema>;

interface EditApplicantFormProps {
  initialData: CustomerDocument;
  applicantId: string;
}

export function EditApplicantForm({ initialData, applicantId }: EditApplicantFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<ApplicantEditFormValues>({
    resolver: zodResolver(applicantSchema),
    // Default values are set by form.reset in useEffect
  });

  React.useEffect(() => {
    if (initialData) {
      form.reset({
        applicantName: initialData.applicantName || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        address: initialData.address || '',
        contactPerson: initialData.contactPerson || '',
        binNo: initialData.binNo || '',
        tinNo: initialData.tinNo || '',
        newIrcNo: initialData.newIrcNo || '',
        oldIrcNo: initialData.oldIrcNo || '',
      });
    }
  }, [initialData, form]);

  async function onSubmit(data: ApplicantEditFormValues) {
    setIsSubmitting(true);

    const dataToUpdate: Partial<Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>> & { updatedAt: any } = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    // Filter out undefined or empty optional fields
    (Object.keys(dataToUpdate) as Array<keyof typeof dataToUpdate>).forEach(key => {
        if (dataToUpdate[key] === undefined || dataToUpdate[key] === '') {
            delete dataToUpdate[key];
        }
    });

    try {
      const applicantDocRef = doc(firestore, "customers", applicantId);
      await updateDoc(applicantDocRef, dataToUpdate);
      Swal.fire({
        title: "Applicant Profile Updated!",
        text: `Applicant profile for ID: ${applicantId} has been successfully updated.`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
    } catch (error) {
      console.error("Error updating applicant document: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Update Failed",
        text: `Failed to update applicant profile: ${errorMessage}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="applicantName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Applicant Name*</FormLabel>
              <FormControl>
                <Input placeholder="Enter applicant's full name or company name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address*</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="applicant@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
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
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address*</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter applicant's full address" {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contactPerson"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Person</FormLabel>
              <FormControl>
                <Input placeholder="Enter name of the primary contact person" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="binNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>BIN No.</FormLabel>
                <FormControl>
                  <Input placeholder="Enter BIN number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tinNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>TIN No.</FormLabel>
                <FormControl>
                  <Input placeholder="Enter TIN number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="newIrcNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New IRC No.</FormLabel>
                <FormControl>
                  <Input placeholder="Enter New IRC number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="oldIrcNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Old IRC No.</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Old IRC number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
