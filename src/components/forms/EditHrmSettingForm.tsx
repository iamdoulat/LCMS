
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { format, parseISO, isValid } from 'date-fns';
import type { HrmSettingFormValues, HrmSettingDocument } from '@/types';
import { HrmSettingSchema } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save } from 'lucide-react';
import { DatePickerField } from './DatePickerField';

interface EditHrmSettingFormProps {
  initialData: HrmSettingDocument;
  onFormSubmit: () => void;
}

export function EditHrmSettingForm({ initialData, onFormSubmit }: EditHrmSettingFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<HrmSettingFormValues>({
    resolver: zodResolver(HrmSettingSchema),
    defaultValues: {
        ...initialData,
        effectiveDate: initialData.effectiveDate && isValid(parseISO(initialData.effectiveDate)) 
                         ? parseISO(initialData.effectiveDate) 
                         : new Date(),
    },
  });

  async function onSubmit(data: HrmSettingFormValues) {
    setIsSubmitting(true);
    const dataToUpdate = {
      ...data,
      effectiveDate: format(data.effectiveDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      updatedAt: serverTimestamp(),
    };

    try {
      const settingDocRef = doc(firestore, "hrm_settings", initialData.id);
      await updateDoc(settingDocRef, dataToUpdate);
      Swal.fire({
        title: "Setting Updated!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      onFormSubmit(); // Close the dialog
    } catch (error: any) {
      Swal.fire("Update Failed", `Failed to update setting: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <FormField control={form.control} name="division" render={({ field }) => (
          <FormItem>
            <FormLabel>Division*</FormLabel>
            <FormControl><Input placeholder="e.g., Corporate" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
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
        <FormField control={form.control} name="effectiveDate" render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Effective Date*</FormLabel>
            <DatePickerField field={field} />
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
                Save Changes
                </>
            )}
            </Button>
        </div>
      </form>
    </Form>
  );
}
