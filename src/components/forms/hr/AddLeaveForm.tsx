
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, addDoc, serverTimestamp, doc, getDoc, getDocs, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';

import type { EmployeeDocument, LeaveApplicationDocument, LeaveGroupDocument, LeaveTypeDefinition } from '@/types';
import { Combobox } from '@/components/ui/combobox';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Mailbox, ArrowLeft, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO, startOfYear, endOfYear, max, min, differenceInCalendarDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { z } from 'zod';
import { leaveTypeOptions } from '@/types';


const leaveApplicationSchema = z.object({
  employeeId: z.string().min(1, "Employee is required."),
  leaveType: z.string().min(1, "Leave type is required."),
  fromDate: z.date({ required_error: "Start date is required." }),
  toDate: z.date({ required_error: "End date is required." }),
  reason: z.string().min(10, "Reason must be at least 10 characters long."),
}).refine(data => {
  if (data.fromDate && data.toDate) {
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

  // Leave Policy State
  const [leaveGroup, setLeaveGroup] = React.useState<LeaveGroupDocument | null>(null);
  const [balanceInfo, setBalanceInfo] = React.useState<{ name: string; allowed: number; used: number; balance: number } | null>(null);
  const [existingLeaves, setExistingLeaves] = React.useState<LeaveApplicationDocument[]>([]);

  const { data: employees } = useFirestoreQuery<EmployeeDocument[]>(
    query(collection(firestore, "employees"), orderBy("fullName")),
    undefined,
    ['employees_for_leave']
  );

  // Fetch all Leave Types (for fallback)
  const { data: allLeaveTypes } = useFirestoreQuery<LeaveTypeDefinition[]>(
    query(collection(firestore, "hrm_settings", "leave_types", "items"), where('isActive', '==', true)),
    undefined,
    ['all_leave_types']
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

  // Fetch Leave Group and Existing Leaves when Employee Changes
  React.useEffect(() => {
    const fetchPolicyData = async () => {
      const employeeId = form.getValues('employeeId');
      if (!employeeId || !employees) return;

      const employee = employees.find(e => e.id === employeeId);
      if (!employee?.leaveGroupId) {
        setLeaveGroup(null);
        setExistingLeaves([]);
        return;
      }

      try {
        // Fetch Leave Group
        const groupRef = doc(firestore, 'hrm_settings', 'leave_groups', 'items', employee.leaveGroupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
          setLeaveGroup({ id: groupSnap.id, ...groupSnap.data() } as LeaveGroupDocument);
        }

        // Fetch Approved Leaves for Balance Calculation
        const leavesQuery = query(
          collection(firestore, 'leave_applications'),
          where('employeeId', '==', employeeId)
          // Ideally filter by status 'Approved' here, but filtering client side is fine for now
        );
        const leavesSnap = await getDocs(leavesQuery);
        setExistingLeaves(leavesSnap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveApplicationDocument)));

      } catch (error) {
        console.error("Error fetching policy data:", error);
      }
    };

    fetchPolicyData();
    // Subscribe to employeeId changes
    const subscription = form.watch((value, { name }) => {
      if (name === 'employeeId') {
        fetchPolicyData();
      }
    });
    return () => subscription.unsubscribe();
  }, [form, employees]);

  // Calculate Balance when Type or Dates Change
  React.useEffect(() => {
    const calculateBalance = () => {
      const { leaveType, fromDate, toDate } = form.getValues();
      if (!leaveGroup || !leaveType) {
        setBalanceInfo(null);
        return;
      }

      const policy = leaveGroup.policies.find(p => p.leaveTypeName === leaveType);
      if (!policy) {
        setBalanceInfo(null);
        return;
      }

      const currentYear = new Date().getFullYear();
      const startOfCurrentYear = startOfYear(new Date());
      const endOfCurrentYear = endOfYear(new Date());

      let usedDays = 0;
      existingLeaves.forEach(l => {
        if (l.status === 'Approved' && l.leaveType === leaveType) {
          const leaveStart = parseISO(l.fromDate);
          const leaveEnd = parseISO(l.toDate);

          const overlapStart = max([leaveStart, startOfCurrentYear]);
          const overlapEnd = min([leaveEnd, endOfCurrentYear]);

          if (overlapEnd >= overlapStart) {
            usedDays += differenceInCalendarDays(overlapEnd, overlapStart) + 1;
          }
        }
      });

      setBalanceInfo({
        name: policy.leaveTypeName,
        allowed: policy.allowedBalance,
        used: usedDays,
        balance: policy.allowedBalance - usedDays
      });
    };

    const subscription = form.watch((value, { name }) => {
      if (name === 'leaveType' || name === 'fromDate' || name === 'toDate') {
        calculateBalance();
      }
    });
    // Initial calculation
    calculateBalance();
    return () => subscription.unsubscribe();
  }, [form, leaveGroup, existingLeaves]);



  const onSubmit = async (data: LeaveApplicationFormValues) => {
    if (!user) {
      Swal.fire("Authentication Error", "You must be logged in to submit an application.", "error");
      return;
    }
    setIsSubmitting(true);

    const selectedEmployee = employeeOptions.find(e => e.value === data.employeeId);

    // Validate Balance
    if (leaveGroup && balanceInfo) {
      if (data.fromDate && data.toDate) {
        const daysRequested = differenceInCalendarDays(data.toDate, data.fromDate) + 1;
        const policy = leaveGroup.policies.find(p => p.leaveTypeName === data.leaveType);

        if (policy && !policy.negativeBalance && daysRequested > balanceInfo.balance) {
          Swal.fire({
            title: "Insufficient Balance",
            text: `You have ${balanceInfo.balance} days remaining for ${data.leaveType}, but you requested ${daysRequested} days.`,
            icon: "error"
          });
          setIsSubmitting(false);
          return;
        }
      }
    }

    const dataToSave = {
      ...data,
      employeeName: selectedEmployee?.label.split(' (')[0] || 'N/A', // Denormalize for easier display
      employeeCode: selectedEmployee?.label.match(/\((.*?)\)/)?.[1] || 'N/A', // Explicitly save code
      fromDate: format(data.fromDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      toDate: format(data.toDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      status: 'Pending',
      appliedBy: user.displayName || user.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(firestore, "leave_applications"), dataToSave);

      // Notify Admin
      try {
        fetch('/api/notify/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_request',
            requestId: docRef.id
          })
        });
      } catch (err) {
        console.error("Failed to trigger admin notification", err);
      }

      Swal.fire({
        title: "Application Submitted!",
        text: "Your leave application has been submitted for approval.",
        icon: "success",
        timer: 1000,
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
                    {leaveGroup ? (
                      leaveGroup.policies.map(policy => (
                        <SelectItem key={policy.leaveTypeId} value={policy.leaveTypeName}>
                          {policy.leaveTypeName}
                        </SelectItem>
                      ))
                    ) : (
                      allLeaveTypes?.map(option => (
                        <SelectItem key={option.id} value={option.name}>{option.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {balanceInfo && (
                  <div className={cn("text-xs mt-1", balanceInfo.balance > 0 ? "text-green-600" : "text-red-500")}>
                    Available Balance: {balanceInfo.balance} days
                  </div>
                )}
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
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" />Submit Application</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
