"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import type { EmployeeDocument } from '@/types';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, FileText, Filter, XCircle } from 'lucide-react';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Combobox } from '@/components/ui/combobox';
import { getCheckInOutRecords } from '@/lib/firebase/checkInOut';

const reportFilterSchema = z.object({
  employeeId: z.string().min(1, "Please select an employee."),
  dateRange: z.object({
    from: z.date({ required_error: "Start date is required." }),
    to: z.date({ required_error: "End date is required." }),
  }),
});

type ReportFilterFormValues = z.infer<typeof reportFilterSchema>;

const PLACEHOLDER_EMPLOYEE_VALUE = "__MULTI_CHECK_INOUT_REPORT_EMPLOYEE__";
const ALL_EMPLOYEES_VALUE = "ALL_EMPLOYEES";

export default function MultipleCheckInOutReportPage() {
  const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(
    query(collection(firestore, "employees"), orderBy("fullName")),
    undefined,
    ['employees_for_multi_checkinout_report']
  );

  const [isLoadingReportData, setIsLoadingReportData] = React.useState(false);

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
    const options = employees.map(emp => ({ value: emp.id, label: `${emp.fullName} (${emp.employeeCode})` }));
    return [{ value: ALL_EMPLOYEES_VALUE, label: "Select All Employees" }, ...options];
  }, [employees]);

  const handleGeneratePdf = async (data: ReportFilterFormValues) => {
    setIsLoadingReportData(true);
    try {
      const isAllEmployees = data.employeeId === ALL_EMPLOYEES_VALUE;
      const targetEmployees = isAllEmployees ? employees || [] : employees?.filter(e => e.id === data.employeeId) || [];

      if (targetEmployees.length === 0) {
        Swal.fire("Error", "No employees found to generate report.", "error");
        setIsLoadingReportData(false);
        return;
      }

      const fromDateStr = format(data.dateRange.from, "yyyy-MM-dd'T'00:00:00.000xxx");
      const toDateStr = format(data.dateRange.to, "yyyy-MM-dd'T'23:59:59.999xxx");
      
      const filters: any = {
        fromDate: fromDateStr,
        toDate: toDateStr,
      };

      if (!isAllEmployees) {
        filters.employeeId = data.employeeId;
      }

      // Fetch Multiple Check In/Out Records
      const checkInOutRecords = await getCheckInOutRecords(filters);

      const reportData = {
        employees: targetEmployees,
        records: checkInOutRecords,
        dateRange: {
          from: format(data.dateRange.from, "yyyy-MM-dd"),
          to: format(data.dateRange.to, "yyyy-MM-dd"),
        },
        isAllEmployees
      };

      localStorage.setItem('multiCheckInOutReportData', JSON.stringify(reportData));
      window.open(`/dashboard/hr/multiple-check-in-out/reports/print`, '_blank');

    } catch (error: any) {
      console.error("Report generation error:", error);
      Swal.fire("Error", `Could not generate report data: ${error.message}`, "error");
    } finally {
      setIsLoadingReportData(false);
    }
  };

  return (
    <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FileText className="h-7 w-7 text-primary" />
            Multiple Check In/Out Report
          </CardTitle>
          <CardDescription>
            Filter by employee and date range to generate a multiple check in/out report.
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
                </CardContent>
              </Card>

              <div className="flex justify-end gap-4 mt-6">
                <Button type="button" onClick={handleSubmit(handleGeneratePdf)} disabled={isLoadingEmployees || isLoadingReportData}>
                  {isLoadingReportData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Generate PDF Report
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
