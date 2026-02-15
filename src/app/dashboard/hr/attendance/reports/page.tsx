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
const ALL_EMPLOYEES_VALUE = "ALL_EMPLOYEES";

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

      // Fetch common data (holidays)
      const holidaysQuery = query(collection(firestore, "holidays"));
      const holidaysSnapshot = await getDocs(holidaysQuery);
      const holidays = holidaysSnapshot.docs.map(d => d.data() as HolidayDocument);

      const reportDataList = [];

      // Determine date range filters
      const fromDateStr = format(data.dateRange.from, "yyyy-MM-dd'T'00:00:00.000xxx");
      const toDateStr = format(data.dateRange.to, "yyyy-MM-dd'T'23:59:59.999xxx");
      const fromDateSimple = format(data.dateRange.from, "yyyy-MM-dd");
      const toDateSimple = format(data.dateRange.to, "yyyy-MM-dd");

      // For all employees, we fetch ALL attendance/leaves/breaks in range and then filter in memory to avoid N queries
      // Note: If dataset is huge, this might need batching or cloud functions. Assuming manageable size for now.
      // Optimization: Fetch all attendance for the date range, then filter by employee.

      let allAttendance: AttendanceDocument[] = [];
      let allLeaves: LeaveApplicationDocument[] = [];
      let allBreaks: any[] = [];

      if (isAllEmployees) {
        const attendanceQuery = query(
          collection(firestore, "attendance"),
          where("date", ">=", fromDateStr),
          where("date", "<=", toDateStr)
        );
        const leavesQuery = query(
          collection(firestore, "leave_applications"),
          where("status", "==", "Approved"),
          // Can't easily filter by date range overlap in one query without complex logic or multiple queries
          // So we might fetch active leaves or approved leaves and filter in memory if "All" is selected
          // To be safe and avoid fetching ALL history, let's fetch approved leaves. 
          // Optimization: Just fetch all approved leaves. It might be large but likely cached or manageable.
          // Better: Fetch approved leaves where toDate >= fromDate. 
          where("toDate", ">=", fromDateSimple)
        );
        const breaksQuery = query(
          collection(firestore, "break_time"),
          where("date", ">=", fromDateSimple),
          where("date", "<=", toDateSimple)
        );

        const [attSnap, leavesSnap, breaksSnap] = await Promise.all([
          getDocs(attendanceQuery),
          getDocs(leavesQuery),
          getDocs(breaksQuery)
        ]);

        allAttendance = attSnap.docs.map(d => d.data() as AttendanceDocument);
        allLeaves = leavesSnap.docs.map(d => d.data() as LeaveApplicationDocument);
        allBreaks = breaksSnap.docs.map(d => d.data() as any);
      } else {
        // Single employee fetch (optimized as before)
        const attendanceQuery = query(
          collection(firestore, "attendance"),
          where("employeeId", "==", data.employeeId),
          where("date", ">=", fromDateStr),
          where("date", "<=", toDateStr)
        );
        const leavesQuery = query(
          collection(firestore, "leave_applications"),
          where("employeeId", "==", data.employeeId),
          where("status", "==", "Approved")
        );
        const breaksQuery = query(
          collection(firestore, "break_time"),
          where("employeeId", "==", data.employeeId)
        );

        const [attSnap, leavesSnap, breaksSnap] = await Promise.all([
          getDocs(attendanceQuery),
          getDocs(leavesQuery),
          getDocs(breaksQuery)
        ]);

        allAttendance = attSnap.docs.map(d => d.data() as AttendanceDocument);
        allLeaves = leavesSnap.docs.map(d => d.data() as LeaveApplicationDocument);
        allBreaks = breaksSnap.docs.map(d => d.data() as any);
      }


      for (const employee of targetEmployees) {
        const employeeAttendance = allAttendance.filter(a => a.employeeId === employee.id);
        const employeeLeaves = allLeaves.filter(l => l.employeeId === employee.id);
        // Filter leaves for date overlap again to be precise
        const employeeLeavesInRange = employeeLeaves.filter(l => {
          const lStart = parseISO(l.fromDate);
          const lEnd = parseISO(l.toDate);
          const rStart = data.dateRange.from;
          const rEnd = data.dateRange.to;
          return (lStart <= rEnd && lEnd >= rStart);
        });

        const employeeBreaks = allBreaks
          .filter(b => b.employeeId === employee.id && b.date >= fromDateSimple && b.date <= toDateSimple);

        reportDataList.push({
          employee: employee,
          dateRange: {
            from: fromDateSimple,
            to: toDateSimple,
          },
          attendance: employeeAttendance,
          leaves: employeeLeavesInRange,
          holidays: holidays,
          breaks: employeeBreaks,
        });
      }

      localStorage.setItem('jobCardReportData', JSON.stringify(isAllEmployees ? reportDataList : reportDataList[0]));

      // If single employee, existing behavior. If multiple, print page needs to handle array.
      window.open(`/dashboard/hr/attendance/reports/print?mode=${isAllEmployees ? 'bulk' : 'single'}`, '_blank');

    } catch (error: any) {
      console.error("Report generation error:", error);
      Swal.fire("Error", `Could not generate report data: ${error.message}`, "error");
    } finally {
      setIsLoadingReportData(false);
    }
  };


  const handleExportToExcel = async (data: ReportFilterFormValues) => {
    setIsLoadingReportData(true);
    try {
      const isAllEmployees = data.employeeId === ALL_EMPLOYEES_VALUE;
      const targetEmployees = isAllEmployees ? employees || [] : employees?.filter(e => e.id === data.employeeId) || [];

      if (targetEmployees.length === 0) {
        Swal.fire("Error", "No employees found to export.", "error");
        setIsLoadingReportData(false);
        return;
      }

      // Fetch common data (holidays)
      const holidaysQuery = query(collection(firestore, "holidays"));
      const holidaysSnapshot = await getDocs(holidaysQuery);
      const holidays = holidaysSnapshot.docs.map(d => d.data() as HolidayDocument);

      // Determine date range filters
      const fromDateStr = format(data.dateRange.from, "yyyy-MM-dd'T'00:00:00.000xxx");
      const toDateStr = format(data.dateRange.to, "yyyy-MM-dd'T'23:59:59.999xxx");
      const fromDateSimple = format(data.dateRange.from, "yyyy-MM-dd");
      const toDateSimple = format(data.dateRange.to, "yyyy-MM-dd");

      let allAttendance: AttendanceDocument[] = [];
      let allLeaves: LeaveApplicationDocument[] = [];
      let allBreaks: any[] = [];

      if (isAllEmployees) {
        const attendanceQuery = query(
          collection(firestore, "attendance"),
          where("date", ">=", fromDateStr),
          where("date", "<=", toDateStr)
        );
        const leavesQuery = query(
          collection(firestore, "leave_applications"),
          where("status", "==", "Approved"),
          where("toDate", ">=", fromDateSimple)
        );
        const breaksQuery = query(
          collection(firestore, "break_time"),
          where("date", ">=", fromDateSimple),
          where("date", "<=", toDateSimple)
        );

        const [attSnap, leavesSnap, breaksSnap] = await Promise.all([
          getDocs(attendanceQuery),
          getDocs(leavesQuery),
          getDocs(breaksQuery)
        ]);

        allAttendance = attSnap.docs.map(d => d.data() as AttendanceDocument);
        allLeaves = leavesSnap.docs.map(d => d.data() as LeaveApplicationDocument);
        allBreaks = breaksSnap.docs.map(d => d.data() as any);
      } else {
        const attendanceQuery = query(
          collection(firestore, "attendance"),
          where("employeeId", "==", data.employeeId),
          where("date", ">=", fromDateStr),
          where("date", "<=", toDateStr)
        );
        const leavesQuery = query(
          collection(firestore, "leave_applications"),
          where("employeeId", "==", data.employeeId),
          where("status", "==", "Approved")
        );
        const breaksQuery = query(
          collection(firestore, "break_time"),
          where("employeeId", "==", data.employeeId)
        );

        const [attSnap, leavesSnap, breaksSnap] = await Promise.all([
          getDocs(attendanceQuery),
          getDocs(leavesQuery),
          getDocs(breaksQuery)
        ]);

        allAttendance = attSnap.docs.map(d => d.data() as AttendanceDocument);
        allLeaves = leavesSnap.docs.map(d => d.data() as LeaveApplicationDocument);
        allBreaks = breaksSnap.docs.map(d => d.data() as any);
      }

      const days = eachDayOfInterval({ start: data.dateRange.from, end: data.dateRange.to });
      let csvContent = "";

      // Headers (only once at the top? Or repeated? Ideally repeated for readability if concatenated, but usually one header is best for machine reading. 
      // However, the requirement is "job card report", usually implies printable layout. 
      // But standard Excel export usually implies a data table. 
      // The previous implementation created a human-readable laid out CSV with summary at bottom. 
      // For bulk, let's stack them separated by blank lines.

      for (const employee of targetEmployees) {
        const employeeAttendance = allAttendance.filter(a => a.employeeId === employee.id);
        const employeeLeaves = allLeaves.filter(l => l.employeeId === employee.id);
        const employeeBreaks = allBreaks.filter(b => b.employeeId === employee.id && b.date >= fromDateSimple && b.date <= toDateSimple);


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

        csvContent += empHeaders.join(",") + "\n" + empData.join(",") + "\n\n" + tableHeaders.join(",") + "\n";

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


          const attendanceRecord = employeeAttendance.find((a: AttendanceDocument) => format(parseISO(a.date), 'yyyy-MM-dd') === formattedDate);
          const leaveRecord = employeeLeaves.find((l: LeaveApplicationDocument) => isWithinInterval(day, { start: parseISO(l.fromDate), end: parseISO(l.toDate) }));
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
                const dayBreaks = employeeBreaks.filter((b: any) => b.date === formattedDate);
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

          const dayBreaks = employeeBreaks.filter((b: any) => b.date === formattedDate);
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
        csvContent += "\n" + "Summary\n";
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

        // Add a separator between employees
        csvContent += "\n" + "=".repeat(20) + "\n\n";
      }


      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const filename = isAllEmployees
        ? `Job_Card_All_Employees_${format(new Date(), 'yyyy-MM-dd')}.csv`
        : `Job_Card_${targetEmployees[0]?.employeeCode}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error: any) {
      console.error("Export error:", error);
      Swal.fire("Error", `Could not export data: ${error.message}`, "error");
    } finally {
      setIsLoadingReportData(false);
    }
  };

  return (
    <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
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
