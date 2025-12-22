
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import type { VisitApplicationFormValues, EmployeeDocument, VisitApplicationDocument, VisitStatus } from '@/types';
import { VisitApplicationSchema, visitStatusOptions } from '@/types';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Loader2, Save, User, Calendar, MessageSquare, Info } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/context/AuthContext';
import { Textarea } from '../ui/textarea';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

interface EditVisitApplicationFormProps {
  initialData: VisitApplicationDocument;
}

const PLACEHOLDER_EMPLOYEE_VALUE = "__EDIT_VISIT_APP_EMPLOYEE__";

export function EditVisitApplicationForm({ initialData }: EditVisitApplicationFormProps) {
  const { user, userRole } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(
    query(collection(firestore, "employees"), orderBy("fullName")),
    undefined,
    ['employees_for_visit_edit']
  );

  const canApprove = userRole?.some(role => ['Super Admin', 'Admin', 'HR'].includes(role));

  const form = useForm<VisitApplicationFormValues>({
    resolver: zodResolver(VisitApplicationSchema),
    defaultValues: {
      ...initialData,
      fromDate: parseISO(initialData.fromDate),
      toDate: parseISO(initialData.toDate),
      customerName: initialData.customerName || '',
      location: initialData.location || '',
      approverComment: initialData.approverComment || '',
    },
  });

  const { watch } = form;
  const fromDate = watch('fromDate');
  const toDate = watch('toDate');
  const [dayCount, setDayCount] = React.useState<number>(initialData.day || 0);

  React.useEffect(() => {
    if (fromDate && toDate && toDate >= fromDate) {
      const diff = differenceInCalendarDays(toDate, fromDate) + 1;
      setDayCount(diff);
    } else {
      setDayCount(0);
    }
  }, [fromDate, toDate]);

  const employeeOptions = React.useMemo(() => {
    if (!employees) return [];
    return employees.map(emp => ({ value: emp.id, label: `${emp.fullName} (${emp.employeeCode})` }));
  }, [employees]);

  async function onSubmit(data: VisitApplicationFormValues) {
    if (!user) {
      Swal.fire("Authentication Error", "You must be logged in to update.", "error");
      return;
    }

    if (data.status !== 'Pending' && !canApprove) {
      Swal.fire("Permission Denied", "You do not have permission to approve or reject this request.", "error");
      return;
    }

    setIsSubmitting(true);
    const selectedEmployee = employeeOptions.find(emp => emp.value === data.employeeId);

    const dataToUpdate = {
      ...data,
      employeeName: selectedEmployee?.label.split(' (')[0] || initialData.employeeName,
      employeeCode: selectedEmployee?.label.match(/\(([^)]+)\)/)?.[1] || initialData.employeeCode,
      fromDate: format(data.fromDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      toDate: format(data.toDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      customerName: data.customerName,
      location: data.location,
      day: dayCount,
      approverComment: data.approverComment || '',
      updatedAt: serverTimestamp(),
    };

    delete (dataToUpdate as any).createdAt;

    try {
      const docRef = doc(firestore, "visit_applications", initialData.id);
      await updateDoc(docRef, dataToUpdate);

      // Notify Employee on Decision
      if (data.status === 'Approved' || data.status === 'Rejected') {
        try {
          fetch('/api/notify/visit', {
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
        title: "Application Updated!",
        text: `Visit application for ${selectedEmployee?.label} has been updated.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error: any) {
      Swal.fire("Update Failed", `There was an error updating the application: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
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
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Visit Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {visitStatusOptions.map(opt => (
                      <SelectItem key={opt} value={opt} disabled={!canApprove && opt !== 'Pending'}>{opt}</SelectItem>
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
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center"><Calendar className="mr-2 h-4 w-4 text-muted-foreground" />From Date*</FormLabel>
                <DatePickerInput field={field} showTimeSelect />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="toDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center"><Calendar className="mr-2 h-4 w-4 text-muted-foreground" />End Date*</FormLabel>
                <DatePickerInput field={field} fromDate={form.getValues("fromDate")} showTimeSelect />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem>
            <FormLabel>Day Count</FormLabel>
            <Input value={`${dayCount} Day(s)`} readOnly disabled className="bg-muted/50 h-10 cursor-not-allowed" />
          </FormItem>
          <FormField
            control={form.control}
            name="customerName"
            render={({ field }) => (
              <FormItem className="lg:col-span-1 xl:col-span-1">
                <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Customer Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Customer Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem className="lg:col-span-1 xl:col-span-1">
                <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Location*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Location" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />Visit Purpose*</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe the purpose of the visit..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {canApprove && (
          <>
            <Separator />
            <h3 className="text-lg font-semibold">Approval Section</h3>
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
          </>
        )}
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSubmitting || isLoadingEmployees}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Changes...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" />Save Changes</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
