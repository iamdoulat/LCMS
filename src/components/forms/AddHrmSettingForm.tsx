
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import type { HrmSettingFormValues } from '@/types';
import { HrmSettingSchema } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save } from 'lucide-react';
import { DatePickerField } from './DatePickerField';

interface AddHrmSettingFormProps {
  onFormSubmit: () => void;
}

export function AddHrmSettingForm({ onFormSubmit }: AddHrmSettingFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<HrmSettingFormValues>({
    resolver: zodResolver(HrmSettingSchema),
    defaultValues: {
      branch: '',
      department: '',
      unit: '',
    },
  });

  async function onSubmit(data: HrmSettingFormValues) {
    setIsSubmitting(true);
    const dataToSave = {
      ...data,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, "hrm_settings"), dataToSave);
      Swal.fire({
        title: "Setting Created!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      form.reset();
      onFormSubmit(); // Close the dialog
    } catch (error: any) {
      Swal.fire("Save Failed", `Failed to create setting: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        
        <FormField control={form.control} name="branch" render={({ field }) => (
          <FormItem>
            <FormLabel>Branch*</FormLabel>
            <FormControl><Input placeholder="e.g., Head Office" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="department" render={({ field }) => (
          <FormItem>
            <FormLabel>Department*</FormLabel>
            <FormControl><Input placeholder="e.g., Sales" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="unit" render={({ field }) => (
          <FormItem>
            <FormLabel>Unit*</FormLabel>
            <FormControl><Input placeholder="e.g., Unit-A" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        
        <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
                <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
                </>
            ) : (
                <>
                <Save className="mr-2 h-4 w-4" />
                Save Setting
                </>
            )}
            </Button>
        </div>
      </form>
    </Form>
  );
}
