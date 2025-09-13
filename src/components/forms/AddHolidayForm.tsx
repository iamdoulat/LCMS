
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { HolidayFormValues } from '@/types';
import { HolidaySchema, holidayTypeOptions } from '@/types';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from './DatePickerField';
import { Loader2, Save } from 'lucide-react';

interface AddHolidayFormProps {
  onFormSubmit: () => void;
}

export function AddHolidayForm({ onFormSubmit }: AddHolidayFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<HolidayFormValues>({
    resolver: zodResolver(HolidaySchema),
    defaultValues: {
      name: '',
      date: new Date(),
      type: 'Public Holiday',
    },
  });

  async function onSubmit(data: HolidayFormValues) {
    setIsSubmitting(true);
    const dataToSave = {
      ...data,
      date: format(data.date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, "holidays"), dataToSave);
      Swal.fire({
        title: "Holiday Added!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      form.reset();
      onFormSubmit();
    } catch (error: any) {
      Swal.fire("Save Failed", `Failed to add holiday: ${error.message}`, "error");
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
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date*</FormLabel>
              <DatePickerField field={field} placeholder="Select holiday date" />
              <FormMessage />
            </FormItem>
          )}
        />
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
                Save Holiday
                </>
            )}
            </Button>
        </div>
      </form>
    </Form>
  );
}
