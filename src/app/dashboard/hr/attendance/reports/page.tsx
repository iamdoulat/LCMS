"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import type { EmployeeDocument } from '@/types';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { cn } from '@/lib/utils';
import { format, isValid } from 'date-fns';
import type { DateRange } from 'react-day-picker';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, User, Search, CalendarDays as CalendarIcon, FileDown, FileText, Filter, XCircle, ChevronDown } from 'lucide-react';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/context/AuthContext';
import { Label } from '@/components/ui/label';

const reportFilterSchema = z.object({
  employeeId: z.string().min(1, "Please select an employee."),
  dateRange: z.object({
    from: z.date({ required_error: "Start date is required." }),
    to: z.date({ required_error: "End date is required." }),
  }),
});

type ReportFilterFormValues = z.infer<typeof reportFilterSchema>;

const PLACEHOLDER_EMPLOYEE_VALUE = "__ATTENDANCE_REPORT_EMPLOYEE__";

export default function AttendanceReportPage() {
  const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(
    query(collection(firestore, "employees"), orderBy("fullName")),
    undefined,
    ['employees_for_attendance_report']
  );

  const form = useForm<ReportFilterFormValues>({
    resolver: zodResolver(reportFilterSchema),
    defaultValues: {
      employeeId: '',
      dateRange: {
        from: new Date(),
        to: new Date(),
      }
    },
  });
  
  const { control, handleSubmit, reset } = form;

  const employeeOptions = React.useMemo(() => {
    if (!employees) return [];
    return employees.map(emp => ({ value: emp.id, label: `${emp.fullName} (${emp.employeeCode})` }));
  }, [employees]);

  const handleGeneratePdf = (data: ReportFilterFormValues) => {
    Swal.fire({
      title: "Feature Not Implemented",
      text: "PDF report generation will be available in a future update.",
      icon: "info",
    });
  };

  const handleExportToExcel = (data: ReportFilterFormValues) => {
    Swal.fire({
      title: "Feature Not Implemented",
      text: "Excel export functionality will be available in a future update.",
      icon: "info",
    });
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <CalendarIcon className="h-7 w-7 text-primary" />
            Employee Job Card Report
          </CardTitle>
          <CardDescription>
            Filter by employee and date range to generate an attendance report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-6">
              <Card className="shadow-md p-4">
                <CardHeader className="p-2 pb-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter By</CardTitle>
                    <Button type="button" variant="outline" onClick={() => reset()}>
                      <XCircle className="mr-2 h-4 w-4" /> Reset
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <FormField
                      control={control}
                      name="employeeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Employee</FormLabel>
                          <Combobox
                            options={employeeOptions}
                            value={field.value || PLACEHOLDER_EMPLOYEE_VALUE}
                            onValueChange={(value) => field.onChange(value === PLACEHOLDER_EMPLOYEE_VALUE ? '' : value)}
                            placeholder="Search employee..."
                            selectPlaceholder={isLoadingEmployees ? "Loading..." : "Select Employee"}
                            disabled={isLoadingEmployees}
                          />
                           <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={control}
                      name="dateRange"
                      render={({ field }) => (
                        <FormItem>
                            <FormLabel>Date*</FormLabel>
                            <DatePickerWithRange
                                date={field.value}
                                onDateChange={field.onChange}
                            />
                            <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                   <Button variant="outline" disabled>
                    <ChevronDown className="mr-2 h-4 w-4" /> Advanced Filter
                  </Button>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-4 mt-6">
                <Button type="button" onClick={handleSubmit(handleGeneratePdf)} disabled={isLoadingEmployees}>
                  <FileText className="mr-2 h-4 w-4" /> PDF Report
                </Button>
                <Button type="button" onClick={handleSubmit(handleExportToExcel)} disabled={isLoadingEmployees} className="bg-green-600 hover:bg-green-700">
                  <FileDown className="mr-2 h-4 w-4" /> Export to Excel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
