
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserPlus } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc } from 'firebase/firestore';
import type { Customer } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const customerSchema = z.object({
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

type CustomerFormValues = z.infer<typeof customerSchema>;

export function AddCustomerForm() { 
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      applicantName: '',
      email: '',
      phone: '',
      address: '',
      contactPerson: '',
      binNo: '',
      tinNo: '',
      newIrcNo: '',
      oldIrcNo: '',
    },
  });

  async function onSubmit(data: CustomerFormValues) {
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const dataToSave: Omit<Customer, 'id'> = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    // Filter out undefined optional fields
    Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key as keyof typeof dataToSave] === undefined) {
            delete dataToSave[key as keyof typeof dataToSave];
        }
    });

    try {
      const docRef = await addDoc(collection(firestore, "customers"), dataToSave);
      Swal.fire({
        title: "Applicant Profile Saved!",
        text: `Applicant data saved successfully to Firestore with ID: ${docRef.id}`,
        icon: "success",
        timer: 3000,
        showConfirmButton: true,
      });
      form.reset(); 
    } catch (error) {
      console.error("Error adding applicant document: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save applicant profile: ${errorMessage}`,
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
              Saving Applicant...
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              Save Applicant Profile
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
