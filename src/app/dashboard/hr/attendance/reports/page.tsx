"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import type { EmployeeDocument, AttendanceDocument, HolidayDocument, LeaveApplicationDocument } from '@/types';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { cn } from '@/lib/utils';
import { format, isValid, parseISO, eachDayOfInterval, differenceInMinutes, getDay, isWithinInterval } from 'date-fns';


import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, CalendarDays as CalendarIcon, FileDown, FileText, Filter, XCircle, ChevronDown } from 'lucide-react';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Combobox } from '@/components/ui/combobox';

const reportFilterSchema = z.object({
  employeeId: z.string().min(1, "Please select an employee."),
  dateRange: z.object({
    from: z.date({ required_error: "Start date is required." }),
    to: z.date({ required_error: "End date is required." }),
  }),
});

type ReportFilterFormValues = z.infer<typeof reportFilterSchema>;

const PLACEHOLDER_EMPLOYEE_VALUE = "__ATTENDANCE_REPORT_EMPLOYEE__";

const escapeCsvCell = (cellData: any): string => {
  if (cellData === null || cellData === undefined) {
    return '';
  }
  const stringData = String(cellData);
  if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
    return `"${stringData.replace(/"/g, '""')}"`;
  }
  return stringData;
};

const formatDisplayDateForExport = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'dd-MM-yyyy') : 'Invalid Date';
  } catch (e) {
    return 'N/A';
  }
};

const formatTimeForExport = (timeString?: string) => {
  // Time is already formatted as "hh:mm AM/PM" in the database
  // No need to parse or reformat, just return as-is
  return timeString || '';
};

const parse12HourTime = (timeString: string, dateString: string): Date | null => {
  if (!timeString) return null;

  try {
    // Parse time in format "hh:mm AM/PM"
    const timeMatch = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!timeMatch) return null;

    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3].toUpperCase();

    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    // Create date object
    const date = parseISO(dateString);
    date.setHours(hours, minutes, 0, 0);

    return date;
  } catch {
    return null;
  }
};

const formatDurationForExport = (minutes: number) => {
  if (isNaN(minutes)) return '00:00';
  const isNegative = minutes < 0;
  const absMinutes = Math.abs(minutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  return `${isNegative ? '-' : ''}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};


export default function AttendanceReportPage() {
  const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(
    query(collection(firestore, "employees"), orderBy("fullName")),
    undefined,
    ['employees_for_attendance_report']
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
    return employees.map(emp => ({ value: emp.id, label: `${emp.fullName} (${emp.employeeCode})` }));
  }, [employees]);

  const handleGeneratePdf = async (data: ReportFilterFormValues) => {
    setIsLoadingReportData(true);
    try {
      const attendanceQuery = query(
        collection(firestore, "attendance"),
        where("employeeId", "==", data.employeeId),
        where("date", ">=", format(data.dateRange.from, "yyyy-MM-dd'T'00:00:00.000xxx")),
        where("date", "<=", format(data.dateRange.to, "yyyy-MM-dd'T'23:59:59.999xxx"))
      );
      const leavesQuery = query(
        collection(firestore, "leave_applications"),
        where("employeeId", "==", data.employeeId),
        where("status", "==", "Approved")
      );
      const holidaysQuery = query(collection(firestore, "holidays"));
      const breaksQuery = query(
        collection(firestore, "break_time"),
        where("employeeId", "==", data.employeeId)
      );

      const [attendanceSnapshot, leavesSnapshot, holidaysSnapshot, breaksSnapshot] = await Promise.all([
        getDocs(attendanceQuery),
        getDocs(leavesQuery),
        getDocs(holidaysQuery),
        getDocs(breaksQuery)
      ]);

      const reportData = {
        employee: employees?.find(e => e.id === data.employeeId),
        dateRange: {
          from: format(data.dateRange.from, "yyyy-MM-dd"),
          to: format(data.dateRange.to, "yyyy-MM-dd"),
        },
        attendance: attendanceSnapshot.docs.map(d => d.data() as AttendanceDocument),
        leaves: leavesSnapshot.docs.map(d => d.data() as LeaveApplicationDocument),
        holidays: holidaysSnapshot.docs.map(d => d.data() as HolidayDocument),
        breaks: breaksSnapshot.docs
          .map(d => d.data() as any)
          .filter((b: any) => b.date >= format(data.dateRange.from, "yyyy-MM-dd") && b.date <= format(data.dateRange.to, "yyyy-MM-dd")),
      };

      localStorage.setItem('jobCardReportData', JSON.stringify(reportData));
      window.open(`/dashboard/hr/attendance/reports/print`, '_blank');

    } catch (error: any) {
      Swal.fire("Error", `Could not generate report data: ${error.message}`, "error");
    } finally {
      setIsLoadingReportData(false);
    }
  };


  const handleExportToExcel = async (data: ReportFilterFormValues) => {
    setIsLoadingReportData(true);
    try {
      const attendanceQuery = query(
        collection(firestore, "attendance"),
        where("employeeId", "==", data.employeeId),
        where("date", ">=", format(data.dateRange.from, "yyyy-MM-dd'T'00:00:00.000xxx")),
        where("date", "<=", format(data.dateRange.to, "yyyy-MM-dd'T'23:59:59.999xxx"))
      );
      const leavesQuery = query(
        collection(firestore, "leave_applications"),
        where("employeeId", "==", data.employeeId),
        where("status", "==", "Approved")
      );
      const holidaysQuery = query(collection(firestore, "holidays"));
      const breaksQuery = query(
        collection(firestore, "break_time"),
        where("employeeId", "==", data.employeeId)
      );

      const [attendanceSnapshot, leavesSnapshot, holidaysSnapshot, breaksSnapshot] = await Promise.all([
        getDocs(attendanceQuery),
        getDocs(leavesQuery),
        getDocs(holidaysQuery),
        getDocs(breaksQuery)
      ]);

      const employee = employees?.find(e => e.id === data.employeeId);
      const attendance = attendanceSnapshot.docs.map(d => d.data() as AttendanceDocument);
      const leaves = leavesSnapshot.docs.map(d => d.data() as LeaveApplicationDocument);
      const holidays = holidaysSnapshot.docs.map(d => d.data() as HolidayDocument);
      const breaks = breaksSnapshot.docs
        .map(d => d.data() as any)
        .filter((b: any) => b.date >= format(data.dateRange.from, "yyyy-MM-dd") && b.date <= format(data.dateRange.to, "yyyy-MM-dd"));

      const days = eachDayOfInterval({ start: data.dateRange.from, end: data.dateRange.to });

      // CSV Header for Employee Info
      const empHeaders = ["Employee Code", "Employee Name", "Join Date", "Designation", "Branch", "Division", "Department", "Job Status"];
      const empData = [
        escapeCsvCell(employee?.employeeCode),
        escapeCsvCell(employee?.fullName),
        escapeCsvCell(formatDisplayDateForExport(employee?.joinedDate)),
        escapeCsvCell(employee?.designation),
        escapeCsvCell(employee?.branch),
        escapeCsvCell(employee?.division),
        escapeCsvCell(employee?.department),
        escapeCsvCell(employee?.status),
      ];

      // CSV Header for Attendance Table
      const tableHeaders = ["Attendance Date", "Status", "Expected Duty (Hour)", "In Time", "Out Time", "Break Time (Hour)", "Actual Duty (Hour)", "Extra/Less Duty (Hour)", "Remarks"];

      let csvContent = empHeaders.join(",") + "\n" + empData.join(",") + "\n\n" + tableHeaders.join(",") + "\n";

      let presentCount = 0;
      let absentCount = 0;
      let delayCount = 0;
      let leaveCount = 0;
      let weekendCount = 0;
      let holidayCount = 0;
      let totalActualDutyMinutes = 0;
      const expectedDutyHour = 9;

      days.forEach(day => {
        const dayOfWeek = getDay(day);
        const formattedDate = format(day, 'yyyy-MM-dd');
        let status = 'A';
        let inTime = '';
        let outTime = '';
        let remarks = '';
        let actualDutyMinutes = 0;


        const attendanceRecord = attendance.find((a: AttendanceDocument) => format(parseISO(a.date), 'yyyy-MM-dd') === formattedDate);
        const leaveRecord = leaves.find((l: LeaveApplicationDocument) => isWithinInterval(day, { start: parseISO(l.fromDate), end: parseISO(l.toDate) }));
        const holidayRecord = holidays.find((h: HolidayDocument) => isWithinInterval(day, { start: parseISO(h.fromDate), end: parseISO(h.toDate || h.fromDate) }));

        if (dayOfWeek === 5) {
          status = 'W';
          weekendCount++;
        } else if (holidayRecord) {
          status = 'H';
          holidayCount++;
          remarks = holidayRecord.name;
        } else if (leaveRecord) {
          status = 'L';
          leaveCount++;
        } else if (attendanceRecord) {
          status = attendanceRecord.flag;
          inTime = attendanceRecord.inTime || '';
          outTime = attendanceRecord.outTime || '';
          remarks = [attendanceRecord.inTimeRemarks, attendanceRecord.outTimeRemarks].filter(Boolean).join('; ');
        }

        if (status === 'P' || status === 'D') {
          presentCount++;
          if (inTime) {
            const inTimeDate = parse12HourTime(inTime, formattedDate);
            const expectedInTimeDate = parseISO(`${formattedDate}T09:00:00`);
            if (inTimeDate && inTimeDate > expectedInTimeDate) {
              delayCount++;
              status = 'D'; // Mark as delayed
            }
          }
          if (inTime && outTime) {
            const inTimeDate = parse12HourTime(inTime, formattedDate);
            const outTimeDate = parse12HourTime(outTime, formattedDate);
            if (inTimeDate && outTimeDate && outTimeDate > inTimeDate) {
              const totalMins = differenceInMinutes(outTimeDate, inTimeDate);

              // Fetch actual break for this day
              const dayBreaks = breaks.filter((b: any) => b.date === formattedDate);
              const actualBreakMins = dayBreaks.reduce((sum: number, b: any) => sum + (b.durationMinutes || 0), 0);
              // Deduct only break time exceeding 60 minutes from total duration
              const excessBreakMins = Math.max(0, actualBreakMins - 60);
              actualDutyMinutes = Math.max(0, totalMins - excessBreakMins);
              totalActualDutyMinutes += actualDutyMinutes;
            }
          }
        } else if (status === 'A') {
          absentCount++;
        }

        const extraLessMinutes = actualDutyMinutes > 0 ? actualDutyMinutes - (expectedDutyHour * 60) : 0;

        const dayBreaks = breaks.filter((b: any) => b.date === formattedDate);
        const actualBreakMins = dayBreaks.reduce((sum: number, b: any) => sum + (b.durationMinutes || 0), 0);
        const breakTimeStr = formatDurationForExport(actualBreakMins);

        const row = [
          format(day, 'dd-MM-yyyy (EEE)'),
          status,
          (status === 'P' || status === 'D') ? formatDurationForExport(expectedDutyHour * 60) : '-',
          formatTimeForExport(inTime),
          formatTimeForExport(outTime),
          (status === 'P' || status === 'D') ? breakTimeStr : '00:00',
          actualDutyMinutes > 0 ? formatDurationForExport(actualDutyMinutes) : '-',
          actualDutyMinutes > 0 ? formatDurationForExport(extraLessMinutes) : '-',
          remarks
        ];
        csvContent += row.map(escapeCsvCell).join(",") + "\n";
      });

      // Summary Section
      const expectedTotalHours = presentCount * expectedDutyHour;
      csvContent += "\n\n" + "Summary\n";
      const summaryHeaders = ["Metric", "Value"];
      const summaryData = [
        ["Present", presentCount],
        ["Absent", absentCount],
        ["Delay", delayCount],
        ["Leave", leaveCount],
        ["Weekend", weekendCount],
        ["Holiday", holidayCount],
        ["Expected Duty Hour", formatDurationForExport(expectedTotalHours * 60)],
        ["Actual Duty Hour", formatDurationForExport(totalActualDutyMinutes)],
        ["Total Days (Available in office)", `${days.length} (${presentCount})`],
        ["Extra/Less Duty Hours", formatDurationForExport(totalActualDutyMinutes - (expectedTotalHours * 60))],
      ];
      csvContent += summaryHeaders.join(",") + "\n";
      csvContent += summaryData.map(row => row.map(escapeCsvCell).join(",")).join("\n");


      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `Job_Card_${employee?.employeeCode}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error: any) {
      Swal.fire("Error", `Could not export data: ${error.message}`, "error");
    } finally {
      setIsLoadingReportData(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-5">
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
                <Button type="button" onClick={handleSubmit(handleGeneratePdf)} disabled={isLoadingEmployees || isLoadingReportData}>
                  {isLoadingReportData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  PDF Report
                </Button>
                <Button type="button" onClick={handleSubmit(handleExportToExcel)} disabled={isLoadingEmployees || isLoadingReportData} className="bg-green-600 hover:bg-green-700">
                  {isLoadingReportData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                  Export to Excel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
