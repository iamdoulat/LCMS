
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp, getDocs, collection, query, orderBy } from 'firebase/firestore';
import type { AdvanceSalaryFormValues, EmployeeDocument, AdvanceSalaryDocument, AdvanceSalaryStatus } from '@/types';
import { AdvanceSalarySchema, advanceSalaryStatusOptions, advanceSalaryPaymentMethodOptions } from '@/types';
import { format, parseISO } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from './DatePickerField';
import { Loader2, Save, User, Calendar, DollarSign, MessageSquare } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/context/AuthContext';
import { Textarea } from '../ui/textarea';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { Separator } from '@/components/ui/separator';

const editAdvanceSalarySchema = AdvanceSalarySchema.extend({
  status: z.enum(advanceSalaryStatusOptions, { required_error: "Status is required." }),
  approverComment: z.string().optional(),
});

type EditAdvanceSalaryFormValues = z.infer<typeof editAdvanceSalarySchema>;


interface EditAdvanceSalaryFormProps {
  initialData: AdvanceSalaryDocument;
}

export function EditAdvanceSalaryForm({ initialData }: EditAdvanceSalaryFormProps) {
  const { user, userRole } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(
    query(collection(firestore, "employees"), orderBy("fullName")),
    undefined,
    ['employees_for_advance_salary_edit']
  );

  const form = useForm<EditAdvanceSalaryFormValues>({
    resolver: zodResolver(editAdvanceSalarySchema),
    defaultValues: {
      ...initialData,
      applyDate: parseISO(initialData.applyDate),
      paymentStartsFrom: parseISO(initialData.paymentStartsFrom),
      status: initialData.status,
      approverComment: initialData.approverComment || '',
    },
  });

  const employeeOptions = React.useMemo(() => {
    if (!employees) return [];
    return employees.map(emp => ({ value: emp.id, label: `${emp.fullName} (${emp.employeeCode})` }));
  }, [employees]);

  async function onSubmit(data: EditAdvanceSalaryFormValues) {
    if (!user) {
      Swal.fire("Authentication Error", "You must be logged in.", "error");
      return;
    }

    const canApprove = userRole?.some(role => ['Super Admin', 'Admin', 'HR'].includes(role));
    if (!canApprove) {
      Swal.fire("Permission Denied", "You do not have permission to approve or reject this request.", "error");
      return;
    }

    setIsSubmitting(true);
    const selectedEmployee = employeeOptions.find(emp => emp.value === data.employeeId);

    const dataToUpdate = {
      ...data,
      employeeName: selectedEmployee?.label.split(' (')[0] || initialData.employeeName,
      employeeCode: selectedEmployee?.label.match(/\(([^)]+)\)/)?.[1] || initialData.employeeCode,
      applyDate: format(data.applyDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      paymentStartsFrom: format(data.paymentStartsFrom, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      dueAmount: data.advanceAmount, // This might need more complex logic if partial payments are possible
      updatedAt: serverTimestamp(),
      approverComment: data.approverComment || '',
    };

    // Remove fields that should not be updated
    delete (dataToUpdate as any).createdAt;

    try {
      const docRef = doc(firestore, "advance_salary", initialData.id);
      await updateDoc(docRef, dataToUpdate);

      // Notify Employee on Decision
      if (data.status === 'Approved' || data.status === 'Rejected') {
        try {
          fetch('/api/notify/advance-salary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'decision',
              requestId: initialData.id,
              status: data.status,
              rejectionReason: data.approverComment
            })
          });
        } catch (err) {
          console.error("Failed to trigger decision notification", err);
        }
      }

      Swal.fire({
        title: "Record Updated!",
        text: `Advance salary request for ${selectedEmployee?.label} has been updated.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error: any) {
      Swal.fire("Update Failed", `Failed to update request: ${error.message}`, "error");
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

        <Separator />
        <h3 className="text-lg font-semibold">Approval Section</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {advanceSalaryStatusOptions.map(opt => (
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
            name="approverComment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Approver Comment</FormLabel>
                <FormControl>
                  <Textarea placeholder="Add a comment for approval or rejection..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSubmitting || isLoadingEmployees}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" />Save Changes</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
