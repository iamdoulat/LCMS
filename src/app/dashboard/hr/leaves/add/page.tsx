
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { EmployeeDocument } from '@/types';
import { Combobox } from '@/components/ui/combobox';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Mailbox, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
  FormField,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const leaveApplicationSchema = z.object({
  employeeId: z.string().min(1, "Employee is required."),
  leaveType: z.string().min(1, "Leave type is required."),
  fromDate: z.date({ required_error: "Start date is required." }),
  toDate: z.date({ required_error: "End date is required." }),
  reason: z.string().min(10, "Reason must be at least 10 characters long."),
}).refine(data => {
    if(data.fromDate && data.toDate) {
        return data.toDate >= data.fromDate;
    }
    return true;
}, {
    message: "End date cannot be before the start date.",
    path: ["toDate"],
});

type LeaveApplicationFormValues = z.infer<typeof leaveApplicationSchema>;


export default function AddLeavePage() {
  const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(
    query(collection(firestore, "employees"), orderBy("fullName")),
    undefined,
    ['employees_for_leave']
  );

  const form = useForm<LeaveApplicationFormValues>({
    resolver: zodResolver(leaveApplicationSchema),
    defaultValues: {
      employeeId: '',
      leaveType: undefined,
      fromDate: undefined,
      toDate: undefined,
      reason: ''
    }
  });

  React.useEffect(() => {
    form.reset({
      ...form.getValues(),
      fromDate: new Date(),
      toDate: new Date(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (data: LeaveApplicationFormValues) => {
    console.log(data);
    Swal.fire({
        title: "Application Submitted!",
        text: "Your leave application has been submitted for approval.",
        icon: "success"
    });
    form.reset();
  };

  const employeeOptions = React.useMemo(() => {
    if (!employees) return [];
    return employees.map(emp => ({ value: emp.id, label: `${emp.fullName} (${emp.employeeCode})` }));
  }, [employees]);


  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/hr/leaves" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Leave Management
          </Button>
        </Link>
      </div>
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Mailbox className="h-7 w-7 text-primary"/>New Leave Application
          </CardTitle>
          <CardDescription>
            Fill out the form below to apply for leave.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee*</FormLabel>
                  <Combobox
                    options={employeeOptions}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Search Employee..."
                    selectPlaceholder={isLoadingEmployees ? "Loading..." : "Select Employee"}
                    disabled={isLoadingEmployees}
                  />
                  <FormMessage />
                </FormItem>
              )} />
              <FormField
                control={form.control}
                name="leaveType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leave Type*</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Leave Type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Annual">Annual Leave</SelectItem>
                        <SelectItem value="Sick">Sick Leave</SelectItem>
                        <SelectItem value="Paternity">Paternity Leave</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fromDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From*</FormLabel>
                      <DatePickerInput field={field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="toDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To*</FormLabel>
                      <DatePickerInput field={field} fromDate={form.getValues("fromDate")} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason*</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Please provide a reason for your leave..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end pt-4">
                <Button type="submit">Submit Application</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
