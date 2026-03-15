

"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { HolidayFormValues } from '@/types';
import { HolidaySchema, holidayTypeOptions } from '@/types';
import { format } from 'date-fns';
import moment from 'moment-timezone';
import { getCompanyTimezone } from '@/lib/settings/company';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/forms/common';
import { Loader2, Save } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface AddHolidayFormProps {
  onFormSubmit: () => void;
}

export function AddHolidayForm({ onFormSubmit }: AddHolidayFormProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<HolidayFormValues>({
    resolver: zodResolver(HolidaySchema),
    defaultValues: {
      name: '',
      fromDate: new Date(),
      toDate: undefined,
      type: 'Public Holiday',
      message: '',
      announcementDate: undefined,
    },
  });

  async function onSubmit(data: HolidayFormValues, forceImmediate?: boolean) {
    setIsSubmitting(true);

    // Normalize announcementDate to company timezone
    let announcementDateIso = undefined;
    if (data.announcementDate) {
      const tz = await getCompanyTimezone();
      // Interpret the selected date/time as being in the company's timezone
      const localDateTimeStr = format(data.announcementDate, "yyyy-MM-dd HH:mm:ss");
      announcementDateIso = moment.tz(localDateTimeStr, tz).toISOString();
    }

    const dataToSave = {
      ...data,
      fromDate: format(data.fromDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      toDate: data.toDate ? format(data.toDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      message: data.message || undefined,
      announcementDate: announcementDateIso,
      createdAt: serverTimestamp(),
    };

    // Remove toDate if it's undefined
    if (!dataToSave.toDate) {
      delete (dataToSave as any).toDate;
    }
    if (!dataToSave.message) {
      delete (dataToSave as any).message;
    }
    if (!dataToSave.announcementDate) {
      delete (dataToSave as any).announcementDate;
    }

    try {
      const docRef = await addDoc(collection(firestore, "holidays"), dataToSave);

      // Trigger Email Notifications asynchronously
      // Trigger Email Notifications asynchronously only if no announcement date or it's now/past OR forced
      const shouldNotifyImmediately = forceImmediate || !data.announcementDate || new Date(data.announcementDate) <= new Date();

      if (shouldNotifyImmediately) {
        fetch('/api/notify/holiday', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            holidayId: docRef.id,
            holidayData: {
              title: data.name,
              fromDate: format(data.fromDate, 'PPPP'),
              originalFromDate: format(data.fromDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
              toDate: data.toDate ? format(data.toDate, 'PPPP') : undefined,
              originalToDate: data.toDate ? format(data.toDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
              type: data.type,
              description: data.message || '',
              forceSend: forceImmediate
            }
          }),
        }).catch(err => console.error("Holiday Notification Error:", err));
      }

      // Invalidate holiday queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['mobile_holidays_page'] });

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
      <form onSubmit={form.handleSubmit((values) => onSubmit(values, false))} className="space-y-4 py-4">
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
          name="announcementDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Announcement Date & Time (For Notifications)</FormLabel>
              <DatePickerField
                field={field}
                placeholder="Select date and time"
                showTimeSelect={true}
              />
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
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={async () => {
              const result = await Swal.fire({
                title: "Send Immediately?",
                text: "Are you sure you want to send the notification now? This will set the announcement date to the current time.",
                icon: "question",
                showCancelButton: true,
                confirmButtonColor: "hsl(var(--primary))",
                cancelButtonColor: "#d33",
                confirmButtonText: "Yes, Send Now",
              });

              if (result.isConfirmed) {
                form.setValue('announcementDate', new Date());
                form.handleSubmit((values) => onSubmit(values, true))();
              }
            }}
            className="border-primary text-primary hover:bg-primary hover:text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                Send Now
              </>
            )}
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={async () => {
              const announcementDate = form.getValues('announcementDate');
              if (!announcementDate) {
                Swal.fire({
                  title: "Announcement Date Required",
                  text: "Please select an announcement date and time to schedule the notification, or click 'Send Now' to notify employees immediately.",
                  icon: "warning",
                });
                return;
              }
              form.handleSubmit((values) => onSubmit(values, false))();
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Send Schedule
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
