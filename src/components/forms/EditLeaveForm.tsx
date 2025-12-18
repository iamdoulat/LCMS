
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { EmployeeDocument, LeaveApplicationDocument } from '@/types';
import { Combobox } from '@/components/ui/combobox';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Loader2, Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const leaveApplicationSchema = z.object({
  employeeId: z.string().min(1, "Employee is required."),
  leaveType: z.string().min(1, "Leave type is required."),
  fromDate: z.date({ required_error: "Start date is required." }),
  toDate: z.date({ required_error: "End date is required." }),
  reason: z.string().min(10, "Reason must be at least 10 characters long."),
  approverComment: z.string().optional(),
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

interface EditLeaveFormProps {
  initialData: LeaveApplicationDocument;
  onFormSubmit: () => void;
}

export function EditLeaveForm({ initialData, onFormSubmit }: EditLeaveFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(
    query(collection(firestore, "employees"), orderBy("fullName")),
    undefined,
    ['employees_for_leave_edit']
  );

  const form = useForm<LeaveApplicationFormValues>({
    resolver: zodResolver(leaveApplicationSchema),
    defaultValues: {
      employeeId: initialData.employeeId,
      leaveType: initialData.leaveType,
      fromDate: parseISO(initialData.fromDate),
      toDate: parseISO(initialData.toDate),
      reason: initialData.reason,
      approverComment: initialData.approverComment || '',
    }
  });

  const employeeOptions = React.useMemo(() => {
    if (!employees) return [];
    return employees.map(emp => ({ value: emp.id, label: `${emp.fullName} (${emp.employeeCode})` }));
  }, [employees]);

  const onSubmit = async (data: LeaveApplicationFormValues) => {
    if (!user) {
        Swal.fire("Authentication Error", "You must be logged in to update an application.", "error");
        return;
    }
    setIsSubmitting(true);
    
    const selectedEmployee = employeeOptions.find(e => e.value === data.employeeId);

    const dataToUpdate = {
        ...data,
        employeeName: selectedEmployee?.label || initialData.employeeName,
        fromDate: format(data.fromDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        toDate: format(data.toDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        approverComment: data.approverComment || '',
        updatedAt: serverTimestamp(),
    };

    try {
        const leaveDocRef = doc(firestore, "leave_applications", initialData.id);
        await updateDoc(leaveDocRef, dataToUpdate);
        Swal.fire({
            title: "Application Updated!",
            text: "The leave application has been updated.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
        });
        onFormSubmit();
    } catch (error: any) {
        Swal.fire("Update Failed", `There was an error updating the application: ${error.message}`, "error");
    } finally {
        setIsSubmitting(false);
    }
  };


  return (
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
                  <SelectItem value="Maternity">Maternity Leave</SelectItem>
                  <SelectItem value="Unpaid">Unpaid Leave</SelectItem>
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
        <FormField
          control={form.control}
          name="approverComment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Approver Comment</FormLabel>
              <FormControl>
                <Textarea placeholder="Add a comment (e.g., reason for rejection)..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSubmitting || isLoadingEmployees}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Updating...</>
            ) : (
              <><Save className="mr-2 h-4 w-4"/>Save Changes</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
