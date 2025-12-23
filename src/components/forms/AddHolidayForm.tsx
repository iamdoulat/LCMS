

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
import { Textarea } from '../ui/textarea';

interface AddHolidayFormProps {
  onFormSubmit: () => void;
}

export function AddHolidayForm({ onFormSubmit }: AddHolidayFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<HolidayFormValues>({
    resolver: zodResolver(HolidaySchema),
    defaultValues: {
      name: '',
      fromDate: new Date(),
      toDate: undefined,
      type: 'Public Holiday',
      message: '',
    },
  });

  async function onSubmit(data: HolidayFormValues) {
    setIsSubmitting(true);
    const dataToSave = {
      ...data,
      fromDate: format(data.fromDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      toDate: data.toDate ? format(data.toDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      message: data.message || undefined,
      createdAt: serverTimestamp(),
    };

    // Remove toDate if it's undefined
    if (!dataToSave.toDate) {
      delete (dataToSave as any).toDate;
    }
    if (!dataToSave.message) {
      delete (dataToSave as any).message;
    }

    try {
      const docRef = await addDoc(collection(firestore, "holidays"), dataToSave);

      // Trigger Email Notifications asynchronously
      fetch('/api/notify/holiday', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          holidayId: docRef.id,
          holidayData: {
            title: data.name,
            fromDate: data.fromDate.toISOString(),
            toDate: data.toDate ? data.toDate.toISOString() : undefined,
            type: data.type,
            description: data.message || '',
          }
        }),
      }).catch(err => console.error("Holiday Notification Error:", err));

      Swal.fire({
        title: "Holiday Added!",
        text: "Announcement emails are being sent to all employees.",
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
      });
      form.reset();
      onFormSubmit(); // Callback to navigate after success
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
                Save Holiday
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
