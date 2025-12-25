
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import type { AdvanceSalaryFormValues, EmployeeDocument } from '@/types';
import { AdvanceSalarySchema, advanceSalaryPaymentMethodOptions } from '@/types';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/forms/common';
import { Loader2, Save, User, Calendar, DollarSign, MessageSquare } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/context/AuthContext';
import { Textarea } from '@/components/ui/textarea';

interface AddAdvanceSalaryFormProps {
  onFormSubmit: () => void;
}

const PLACEHOLDER_EMPLOYEE_VALUE = "__ADD_ADVANCE_SALARY_EMPLOYEE__";

export function AddAdvanceSalaryForm({ onFormSubmit }: AddAdvanceSalaryFormProps) {
  const { user, userRole } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [employeeOptions, setEmployeeOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = React.useState(true);
  const [isUserRestricted, setIsUserRestricted] = React.useState(false);


  const form = useForm<AdvanceSalaryFormValues>({
    resolver: zodResolver(AdvanceSalarySchema),
    defaultValues: {
      employeeId: '',
      applyDate: new Date(),
      paymentStartsFrom: new Date(),
      paymentDuration: 1,
      advanceAmount: 0,
      paymentMethod: 'Salary Deduction',
      reason: '',
    },
  });

  React.useEffect(() => {
    const fetchEmployees = async () => {
      setIsLoadingEmployees(true);
      try {
        const employeesQuery = query(collection(firestore, "employees"), orderBy("fullName"));
        const snapshot = await getDocs(employeesQuery);
        const allEmployees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmployeeDocument));

        const canViewAll = userRole?.some(role => ['Super Admin', 'Admin', 'HR'].includes(role));

        if (canViewAll) {
          setEmployeeOptions(allEmployees.map(data => ({
            value: data.id,
            label: `${data.fullName} (${data.employeeCode})`
          })));
          setIsUserRestricted(false);
        } else if (user) {
          const loggedInEmployee = allEmployees.find(emp => emp.id === user.uid || emp.email === user.email);
          if (loggedInEmployee) {
            setEmployeeOptions([{
              value: loggedInEmployee.id,
              label: `${loggedInEmployee.fullName} (${loggedInEmployee.employeeCode})`
            }]);
            form.setValue('employeeId', loggedInEmployee.id, { shouldValidate: true });
            setIsUserRestricted(true);
          } else {
            // User might not have a corresponding employee doc, show empty
            setEmployeeOptions([]);
            setIsUserRestricted(true);
          }
        }

      } catch (error) {
        Swal.fire("Error", "Could not load employees.", "error");
      } finally {
        setIsLoadingEmployees(false);
      }
    };

    if (user && userRole) {
      fetchEmployees();
    }
  }, [user, userRole, form]);


  async function onSubmit(data: AdvanceSalaryFormValues) {
    if (!user) {
      Swal.fire("Authentication Error", "You must be logged in.", "error");
      return;
    }
    setIsSubmitting(true);
    const selectedEmployee = employeeOptions.find(emp => emp.value === data.employeeId);

    const dataToSave = {
      ...data,
      employeeName: selectedEmployee?.label.split(' (')[0] || 'N/A',
      employeeCode: selectedEmployee?.label.match(/\(([^)]+)\)/)?.[1] || 'N/A',
      applyDate: format(data.applyDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      paymentStartsFrom: format(data.paymentStartsFrom, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      dueAmount: data.advanceAmount,
      status: 'Pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(firestore, "advance_salary"), dataToSave);

      // Notify Admin
      try {
        fetch('/api/notify/advance-salary', {
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
        title: "Request Submitted!",
        text: `Advance salary request for ${selectedEmployee?.label} has been submitted.`,
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
      });
      form.reset();
      onFormSubmit();
    } catch (error: any) {
      Swal.fire("Submission Failed", `Failed to submit request: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 items-end">
          <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <FormItem className="lg:col-span-1 xl:col-span-1">
                <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Employee*</FormLabel>
                {isUserRestricted ? (
                  <Input value={employeeOptions[0]?.label || 'Loading...'} readOnly disabled className="bg-muted/50" />
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
            )}
          />
          <FormField
            control={form.control}
            name="applyDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center"><Calendar className="mr-2 h-4 w-4 text-muted-foreground" />Apply Date*</FormLabel>
                <DatePickerField field={field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="paymentStartsFrom"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center"><Calendar className="mr-2 h-4 w-4 text-muted-foreground" />Payment Starts From*</FormLabel>
                <DatePickerField field={field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="advanceAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />Advance Amount*</FormLabel>
                <FormControl><Input type="number" placeholder="Enter amount in BDT" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="paymentDuration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Duration (Months)*</FormLabel>
                <FormControl><Input type="number" placeholder="e.g., 6" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="paymentMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Application Payment Method*</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {advanceSalaryPaymentMethodOptions.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />Reason*</FormLabel>
              <FormControl>
                <Textarea placeholder="Reason for advance salary request..." {...field} />
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
              <><Save className="mr-2 h-4 w-4" />Submit Request</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
