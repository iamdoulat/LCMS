
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where } from 'firebase/firestore';
import type { VisitApplicationFormValues, EmployeeDocument, VisitApplicationDocument } from '@/types';
import { VisitApplicationSchema } from '@/types';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, Save, User, Calendar, MessageSquare, Info } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/context/AuthContext';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

interface AddVisitApplicationFormProps {
  onFormSubmit: () => void;
}

const PLACEHOLDER_EMPLOYEE_VALUE = "__ADD_VISIT_APP_EMPLOYEE__";

export function AddVisitApplicationForm({ onFormSubmit }: AddVisitApplicationFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [employeeOptions, setEmployeeOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = React.useState(true);
  const [dayCount, setDayCount] = React.useState<number>(1);


  const form = useForm<VisitApplicationFormValues>({
    resolver: zodResolver(VisitApplicationSchema),
    defaultValues: {
      employeeId: '',
      fromDate: new Date(),
      toDate: new Date(),
      remarks: '',
    },
  });

  const { watch } = form;
  const fromDate = watch('fromDate');
  const toDate = watch('toDate');

  React.useEffect(() => {
    if (fromDate && toDate && toDate >= fromDate) {
      const diff = differenceInCalendarDays(toDate, fromDate) + 1;
      setDayCount(diff);
    } else {
      setDayCount(0);
    }
  }, [fromDate, toDate]);

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

  async function onSubmit(data: VisitApplicationFormValues) {
    if (!user) {
      Swal.fire("Authentication Error", "You must be logged in.", "error");
      return;
    }
    setIsSubmitting(true);
    const selectedEmployee = employeeOptions.find(emp => emp.value === data.employeeId);
    
    const dataToSave: Omit<VisitApplicationDocument, 'id'> = {
      employeeId: data.employeeId,
      employeeName: selectedEmployee?.label.split(' (')[0] || 'N/A',
      employeeCode: selectedEmployee?.label.match(/\(([^)]+)\)/)?.[1] || 'N/A',
      applyDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      fromDate: format(data.fromDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      toDate: format(data.toDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      day: dayCount,
      remarks: data.remarks,
      status: 'Pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, "visit_applications"), dataToSave);
      Swal.fire({
        title: "Application Submitted!",
        text: `Visit application for ${selectedEmployee?.label} has been submitted.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      form.reset();
      onFormSubmit();
    } catch (error: any) {
      Swal.fire("Submission Failed", `Failed to submit application: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 items-end">
            <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
                <FormItem className="lg:col-span-1 xl:col-span-1">
                <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Employee*</FormLabel>
                <Combobox
                    options={employeeOptions}
                    value={field.value || PLACEHOLDER_EMPLOYEE_VALUE}
                    onValueChange={(value) => field.onChange(value === PLACEHOLDER_EMPLOYEE_VALUE ? '' : value)}
                    placeholder="Search Employee by Code or Name"
                    selectPlaceholder={isLoadingEmployees ? "Loading..." : "Select Employee by Code or Name"}
                    disabled={isLoadingEmployees}
                />
                <FormMessage />
                </FormItem>
            )}
            />
            <FormItem className="md:col-span-1">
              <FormLabel>Visit Status</FormLabel>
              <div className="flex items-center h-10 px-3 border rounded-md bg-muted/50">
                <Badge variant="secondary" className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse"></span>
                  Pending
                </Badge>
              </div>
          </FormItem>
          <FormField
            control={form.control}
            name="fromDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center"><Calendar className="mr-2 h-4 w-4 text-muted-foreground" />From Date*</FormLabel>
                <DatePickerField field={field} placeholder="dd-mm-yyyy hh:mm a" showTimeSelect/>
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
                <DatePickerField field={field} fromDate={form.getValues("fromDate")} placeholder="dd-mm-yyyy hh:mm a" showTimeSelect/>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem>
              <FormLabel>Day Count</FormLabel>
              <Input value={`${dayCount} Day(s)`} readOnly disabled className="bg-muted/50 h-10 cursor-not-allowed"/>
          </FormItem>
        </div>
        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />Visit Purpose*</FormLabel>
              <FormControl>
                <Textarea placeholder="Type here" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Apply Date: {format(new Date(), 'PPP')}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onFormSubmit}>
                Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoadingEmployees}>
                {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Submitting...</>
                ) : (
                <><Save className="mr-2 h-4 w-4"/>Save</>
                )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
