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
import { DatePickerField } from './DatePickerField';
import { Loader2, Save, User, Calendar, DollarSign, MessageSquare } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/context/AuthContext';
import { Textarea } from '../ui/textarea';

interface AddAdvanceSalaryFormProps {
  onFormSubmit: () => void;
}

const PLACEHOLDER_EMPLOYEE_VALUE = "__ADD_ADVANCE_SALARY_EMPLOYEE__";

export function AddAdvanceSalaryForm({ onFormSubmit }: AddAdvanceSalaryFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [employeeOptions, setEmployeeOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = React.useState(true);

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
        setEmployeeOptions(
          snapshot.docs.map(doc => {
            const data = doc.data() as EmployeeDocument;
            return {
              value: doc.id,
              label: `${data.fullName} (${data.employeeCode})`
            };
          })
        );
      } catch (error) {
        Swal.fire("Error", "Could not load employees.", "error");
      } finally {
        setIsLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, []);

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
      await addDoc(collection(firestore, "advance_salary"), dataToSave);
      Swal.fire({
        title: "Request Submitted!",
        text: `Advance salary request for ${selectedEmployee?.label} has been submitted.`,
        icon: "success",
        timer: 2000,
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
        <FormField
          control={form.control}
          name="employeeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Employee*</FormLabel>
              <Combobox
                options={employeeOptions}
                value={field.value || PLACEHOLDER_EMPLOYEE_VALUE}
                onValueChange={(value) => field.onChange(value === PLACEHOLDER_EMPLOYEE_VALUE ? '' : value)}
                placeholder="Search Employee..."
                selectPlaceholder={isLoadingEmployees ? "Loading..." : "Select Employee"}
                disabled={isLoadingEmployees}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Submitting...</>
            ) : (
              <><Save className="mr-2 h-4 w-4"/>Submit Request</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
