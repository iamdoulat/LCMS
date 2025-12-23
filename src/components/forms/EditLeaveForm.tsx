
"use client";

import { cn } from '@/lib/utils';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, getDoc, getDocs, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';

import type { EmployeeDocument, LeaveApplicationDocument, LeaveGroupDocument, LeaveTypeDefinition } from '@/types';
import { Combobox } from '@/components/ui/combobox';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Loader2, Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO, startOfYear, endOfYear, max, min, differenceInCalendarDays } from 'date-fns';
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
  if (data.fromDate && data.toDate) {
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

  // Fetch all Leave Types (for fallback)
  const { data: allLeaveTypes } = useFirestoreQuery<LeaveTypeDefinition[]>(
    query(collection(firestore, "hrm_settings", "leave_types", "items"), where('isActive', '==', true)),
    undefined,
    ['all_leave_types_edit']
  );

  // Leave Policy State
  const [leaveGroup, setLeaveGroup] = React.useState<LeaveGroupDocument | null>(null);
  const [balanceInfo, setBalanceInfo] = React.useState<{ name: string; allowed: number; used: number; balance: number } | null>(null);
  const [existingLeaves, setExistingLeaves] = React.useState<LeaveApplicationDocument[]>([]);

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

  // Fetch Leave Group and Existing Leaves
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
        const groupRef = doc(firestore, 'hrm_settings', 'leave_groups', 'items', employee.leaveGroupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
          setLeaveGroup({ id: groupSnap.id, ...groupSnap.data() } as LeaveGroupDocument);
        }

        const leavesQuery = query(collection(firestore, 'leave_applications'), where('employeeId', '==', employeeId));
        const leavesSnap = await getDocs(leavesQuery);
        setExistingLeaves(leavesSnap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveApplicationDocument)));
      } catch (error) {
        console.error("Error fetching policy data:", error);
      }
    };
    fetchPolicyData();
    const subscription = form.watch((value, { name }) => {
      if (name === 'employeeId') {
        fetchPolicyData();
      }
    });
    return () => subscription.unsubscribe();
  }, [form, employees]);

  // Calculate Balance
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
        if (l.id === initialData.id) return; // Exclude current application being edited

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

      // If the current application is ALREADY approved, we should treat the NEW requested dates as the "used" amount for this record.
      // The logic here calculates "Balance before this request".
      // Then we compare (Balance - New Request) >= 0.

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
    calculateBalance();
    return () => subscription.unsubscribe();
  }, [form, leaveGroup, existingLeaves, initialData.id]);

  const onSubmit = async (data: LeaveApplicationFormValues) => {
    if (!user) {
      Swal.fire("Authentication Error", "You must be logged in to update an application.", "error");
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
        timer: 1000,
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
                  {leaveGroup ? (
                    leaveGroup.policies.map(policy => (
                      <SelectItem key={policy.leaveTypeId} value={policy.leaveTypeName}>
                        {policy.leaveTypeName}
                      </SelectItem>
                    ))
                  ) : (
                    allLeaveTypes?.map(type => (
                      <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
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
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" />Save Changes</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
