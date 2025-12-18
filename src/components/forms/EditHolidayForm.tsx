

"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { HolidayFormValues, HolidayDocument } from '@/types';
import { HolidaySchema, holidayTypeOptions } from '@/types';
import { format, parseISO } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from './DatePickerField';
import { Loader2, Save } from 'lucide-react';
import { Textarea } from '../ui/textarea';

interface EditHolidayFormProps {
  initialData: HolidayDocument;
  onFormSubmit: () => void;
}

export function EditHolidayForm({ initialData, onFormSubmit }: EditHolidayFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<HolidayFormValues>({
    resolver: zodResolver(HolidaySchema),
    defaultValues: {
        name: initialData.name,
        fromDate: parseISO(initialData.fromDate),
        toDate: initialData.toDate ? parseISO(initialData.toDate) : undefined,
        type: initialData.type,
        message: initialData.message || '',
    },
  });

  async function onSubmit(data: HolidayFormValues) {
    setIsSubmitting(true);
    const dataToUpdate = {
      ...data,
      fromDate: format(data.fromDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      toDate: data.toDate ? format(data.toDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      message: data.message || undefined,
      updatedAt: serverTimestamp(),
    };
    
    // Ensure undefined fields are handled correctly for Firestore
    if (!dataToUpdate.toDate) {
      delete (dataToUpdate as any).toDate;
    }
    if (!dataToUpdate.message) {
      delete (dataToUpdate as any).message;
    }

    try {
      const holidayDocRef = doc(firestore, "holidays", initialData.id);
      await updateDoc(holidayDocRef, dataToUpdate);
      Swal.fire({
        title: "Holiday Updated!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      onFormSubmit(); // Callback to navigate after success
    } catch (error: any) {
      Swal.fire("Update Failed", `Failed to update holiday: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Holiday Name*</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Victory Day" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="fromDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>From*</FormLabel>
                <DatePickerField field={field} placeholder="Select start date" />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="toDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>To (Optional)</FormLabel>
                <DatePickerField
                  field={field}
                  placeholder="Select end date"
                  fromDate={form.watch('fromDate')}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type*</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {holidayTypeOptions.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter a message for the holiday announcement" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
