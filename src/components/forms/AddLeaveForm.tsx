
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { EmployeeDocument, LeaveApplicationDocument } from '@/types';
import { Combobox } from '@/components/ui/combobox';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Mailbox, ArrowLeft, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { z } from 'zod';
import { leaveTypeOptions } from '@/types';


const leaveApplicationSchema = z.object({
  employeeId: z.string().min(1, "Employee is required."),
  leaveType: z.enum(leaveTypeOptions, { required_error: "Leave type is required." }),
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

interface AddLeaveFormProps {
  onFormSubmit: () => void;
}

const PLACEHOLDER_EMPLOYEE_VALUE = "__ADD_LEAVE_EMPLOYEE__";


export function AddLeaveForm({ onFormSubmit }: AddLeaveFormProps) {
  const { user, userRole } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [employeeOptions, setEmployeeOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = React.useState(true);
  const [isUserRestricted, setIsUserRestricted] = React.useState(false);
  
  const { data: employees } = useFirestoreQuery<EmployeeDocument[]>(
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
    // Set default dates on the client side to prevent hydration mismatch
    form.reset({
      ...form.getValues(),
      fromDate: new Date(),
      toDate: new Date(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (employees && user && userRole) {
      const canViewAll = userRole.some(role => ['Super Admin', 'Admin', 'HR'].includes(role));
      
      if (canViewAll) {
         setEmployeeOptions(employees.map(emp => ({
          value: emp.id,
          label: `${emp.fullName} (${emp.employeeCode})`
        })));
        setIsUserRestricted(false);
      } else {
        const loggedInEmployee = employees.find(emp => emp.id === user.uid || emp.email === user.email);
        if (loggedInEmployee) {
           setEmployeeOptions([{
              value: loggedInEmployee.id,
              label: `${loggedInEmployee.fullName} (${loggedInEmployee.employeeCode})`
           }]);
           form.setValue('employeeId', loggedInEmployee.id, { shouldValidate: true });
           setIsUserRestricted(true);
        } else {
          setEmployeeOptions([]);
          setIsUserRestricted(true);
        }
      }
      setIsLoadingEmployees(false);
    }
  }, [employees, user, userRole, form]);


  const onSubmit = async (data: LeaveApplicationFormValues) => {
    if (!user) {
        Swal.fire("Authentication Error", "You must be logged in to submit an application.", "error");
        return;
    }
    setIsSubmitting(true);
    
    const selectedEmployee = employeeOptions.find(e => e.value === data.employeeId);

    const dataToSave = {
        ...data,
        employeeName: selectedEmployee?.label.split(' (')[0] || 'N/A', // Denormalize for easier display
        fromDate: format(data.fromDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        toDate: format(data.toDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        status: 'Pending',
        appliedBy: user.displayName || user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    try {
        await addDoc(collection(firestore, "leave_applications"), dataToSave);
        Swal.fire({
            title: "Application Submitted!",
            text: "Your leave application has been submitted for approval.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
        });
        form.reset();
        onFormSubmit();
    } catch (error: any) {
        Swal.fire("Submission Failed", `There was an error submitting your application: ${error.message}`, "error");
    } finally {
        setIsSubmitting(false);
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
            <FormItem className="lg:col-span-1">
                <FormLabel>Employee*</FormLabel>
                {isUserRestricted ? (
                    <Input value={employeeOptions[0]?.label || "Loading..."} readOnly disabled className="bg-muted/50" />
                ) : (
                    <Combobox
                    options={employeeOptions}
                    value={field.value || PLACEHOLDER_EMPLOYEE_VALUE}
                    onValueChange={(value) => field.onChange(value === PLACEHOLDER_EMPLOYEE_VALUE ? '' : value)}
                    placeholder="Search Employee..."
                    selectPlaceholder={isLoadingEmployees ? "Loading..." : "Select Employee"}
                    disabled={isLoadingEmployees}
                    />
                )}
                <FormMessage />
            </FormItem>
            )} />

            <FormField
            control={form.control}
            name="leaveType"
            render={({ field }) => (
                <FormItem className="lg:col-span-1">
                <FormLabel>Leave Type*</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Leave Type" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {leaveTypeOptions.map(option => (
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
            name="fromDate"
            render={({ field }) => (
                <FormItem className="lg:col-span-1">
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
                <FormItem className="lg:col-span-1">
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
          <Button type="submit" disabled={isSubmitting || isLoadingEmployees}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Submitting...</>
            ) : (
              <><Save className="mr-2 h-4 w-4"/>Submit Application</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
