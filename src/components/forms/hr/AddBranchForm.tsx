"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { BranchFormValues } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const LocationMap = dynamic(() => import('@/components/ui/LocationMap'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-muted animate-pulse rounded-md flex items-center justify-center">Loading Map...</div>
});

const BranchSchema = z.object({
  name: z.string().min(2, "Branch name must be at least 2 characters long."),
  currency: z.string({ required_error: "Please select a currency." }).min(1, "Please select a currency."),
  timezone: z.string({ required_error: "Please select a time zone." }).min(1, "Please select a time zone."),
  isHeadOffice: z.boolean().default(false),
  remoteAttendanceAllowed: z.boolean().default(false),
  requireRemoteAttendanceApproval: z.boolean().default(false),
  allowRadius: z.number().optional(),
  address: z.string().optional(),
  willNotifySupervisorInTime: z.boolean().default(false),
  willNotifySupervisorOutTime: z.boolean().default(false),
  notifyAllRemoteAttendances: z.boolean().default(false),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

interface AddBranchFormProps {
  onFormSubmit: () => void;
}

export function AddBranchForm({ onFormSubmit }: AddBranchFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(BranchSchema),
    defaultValues: {
      name: '',
      currency: '',
      timezone: '',
      isHeadOffice: false,
      remoteAttendanceAllowed: false,
      requireRemoteAttendanceApproval: false,
      allowRadius: 50,
      address: '',
      willNotifySupervisorInTime: false,
      willNotifySupervisorOutTime: false,
      notifyAllRemoteAttendances: false,
      latitude: undefined,
      longitude: undefined,
    },
  });

  async function onSubmit(data: BranchFormValues) {
    setIsSubmitting(true);
    const dataToSave = {
      name: data.name,
      currency: data.currency,
      timezone: data.timezone,
      isHeadOffice: data.isHeadOffice,
      remoteAttendanceAllowed: data.remoteAttendanceAllowed || false,
      requireRemoteAttendanceApproval: data.requireRemoteAttendanceApproval || false,
      allowRadius: data.allowRadius || 50,
      address: data.address || '',
      willNotifySupervisorInTime: data.willNotifySupervisorInTime || false,
      willNotifySupervisorOutTime: data.willNotifySupervisorOutTime || false,
      notifyAllRemoteAttendances: data.notifyAllRemoteAttendances || false,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, "branches"), dataToSave);
      Swal.fire({
        title: "Branch Created!",
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
        customClass: {
          popup: 'rounded-xl',
        }
      });
      form.reset();
      onFormSubmit();
    } catch (error: any) {
      Swal.fire("Save Failed", `Failed to create branch: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground/80 font-medium text-xs uppercase tracking-wide">Branch Name <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="Dhaka" {...field} className="focus-visible:ring-primary/20" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground/80 font-medium text-xs uppercase tracking-wide">Currency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="focus:ring-primary/20">
                      <SelectValue placeholder="Select Currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="BDT">Bangladeshi Taka (BDT)</SelectItem>
                    <SelectItem value="USD">US Dollar (USD)</SelectItem>
                    <SelectItem value="EUR">Euro (EUR)</SelectItem>
                    <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                    <SelectItem value="INR">Indian Rupee (INR)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80 font-medium text-xs uppercase tracking-wide">Time Zone <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="focus:ring-primary/20">
                    <SelectValue placeholder="Select time zone" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Asia/Dhaka">Central Asia Standard Time (+06:00)</SelectItem>
                  <SelectItem value="UTC">UTC (GMT+0)</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time (US & Canada) (-05:00)</SelectItem>
                  <SelectItem value="Europe/London">London (GMT+0 / BST+1)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-wrap gap-4 pt-1">
          <FormField
            control={form.control}
            name="isHeadOffice"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-medium cursor-pointer text-sm">Is Head Office</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="remoteAttendanceAllowed"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-medium cursor-pointer text-sm">Remote Attendance Allowed</FormLabel>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="requireRemoteAttendanceApproval"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="font-medium cursor-pointer text-sm">Remote Attendance Approval Required</FormLabel>
            </FormItem>
          )}
        />

        <div className="space-y-4 border rounded-md p-3 bg-muted/20">
          <h4 className="text-sm font-medium">Supervisor Notifications</h4>
          <div className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="willNotifySupervisorInTime"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-medium cursor-pointer text-sm">Notify on Remote In-Time</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="willNotifySupervisorOutTime"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-medium cursor-pointer text-sm">Notify on Remote Out-Time</FormLabel>
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="allowRadius"
          render={({ field }) => (
            <FormItem className="relative">
              <div className="flex items-center border rounded-md overflow-hidden bg-background focus-within:ring-2 focus-within:ring-primary/20">
                <span className="px-3 text-sm font-medium text-muted-foreground bg-muted h-9 flex items-center min-w-[120px]">Radius In Meter <span className="text-destructive ml-1">*</span></span>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={e => field.onChange(e.target.valueAsNumber)}
                    className="border-0 focus-visible:ring-0 rounded-none text-right pr-4 font-semibold"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notifyAllRemoteAttendances"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="font-medium cursor-pointer text-sm">Notify all remote attendances</FormLabel>
            </FormItem>
          )}
        />


        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80 font-medium text-xs uppercase tracking-wide">Branch Location</FormLabel>
              <FormControl>
                <Input placeholder="Enter Full Address" {...field} className="focus-visible:ring-primary/20" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Please point your branch location</h4>
          <LocationMap
            latitude={form.watch('latitude')}
            longitude={form.watch('longitude')}
            radius={form.watch('allowRadius')}
            onLocationSelect={(lat, lng) => {
              form.setValue('latitude', lat);
              form.setValue('longitude', lng);
            }}
            onAddressFound={(address) => {
              form.setValue('address', address);
            }}
          />
        </div>

        <div className="flex justify-end pt-4 gap-3 sticky bottom-0 bg-background pb-2">
          <Button type="button" variant="outline" onClick={onFormSubmit} className="bg-secondary/20 hover:bg-secondary/40 border-0 text-foreground w-24">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 w-24">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
