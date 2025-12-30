
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { LeaveApplicationDocument, EmployeeDocument, BranchDocument, DepartmentDocument, HolidayDocument, LeaveType } from '@/types';
import { leaveTypeOptions } from '@/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, parseISO, addMonths, subMonths, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Cake, Calendar as CalendarIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';

const ALL_BRANCHES = '__ALL_BRANCHES_LEAVE_CALENDAR__';
const ALL_DEPTS = '__ALL_DEPTS_LEAVE_CALENDAR__';
const ALL_LEAVE_TYPES = '__ALL_LEAVE_TYPES_LEAVE_CALENDAR__';

interface DayWithLeaves {
  date: Date;
  isToday: boolean;
  holiday: HolidayDocument | null;
  isWeekend: boolean;
  leaves: (LeaveApplicationDocument & { employee?: EmployeeDocument })[];
  birthdays: EmployeeDocument[];
}

const getInitials = (name?: string) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

interface LeaveCalendarProps {
  birthdays?: EmployeeDocument[];
}

export function LeaveCalendar({ birthdays = [] }: LeaveCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [filterBranch, setFilterBranch] = React.useState(ALL_BRANCHES);
  const [filterDept, setFilterDept] = React.useState(ALL_DEPTS);
  const [filterLeaveType, setFilterLeaveType] = React.useState<LeaveType | '' | typeof ALL_LEAVE_TYPES>(ALL_LEAVE_TYPES);

  const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(
    query(collection(firestore, 'employees'), where('status', '!=', 'Terminated')),
    undefined,
    ['employees_for_leave_calendar']
  );
  const { data: leaves, isLoading: isLoadingLeaves } = useFirestoreQuery<LeaveApplicationDocument[]>(collection(firestore, 'leave_applications'), undefined, ['leaves_for_leave_calendar']);
  const { data: branches, isLoading: isLoadingBranches } = useFirestoreQuery<BranchDocument[]>(collection(firestore, 'branches'), undefined, ['branches_for_leave_calendar']);
  const { data: departments, isLoading: isLoadingDepts } = useFirestoreQuery<DepartmentDocument[]>(collection(firestore, 'departments'), undefined, ['departments_for_leave_calendar']);
  const { data: holidays, isLoading: isLoadingHolidays } = useFirestoreQuery<HolidayDocument[]>(collection(firestore, 'holidays'), undefined, ['holidays_for_leave_calendar']);

  const isLoading = isLoadingEmployees || isLoadingLeaves || isLoadingBranches || isLoadingDepts || isLoadingHolidays;

  const monthData = React.useMemo(() => {
    if (isLoading) return [];

    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    const filteredEmployees = employees?.filter(emp => {
      const branchMatch = filterBranch === ALL_BRANCHES || emp.branch === filterBranch;
      const deptMatch = filterDept === ALL_DEPTS || emp.department === filterDept;
      return branchMatch && deptMatch;
    }) || [];

    const filteredEmployeeIds = new Set(filteredEmployees.map(e => e.id));

    return days.map(day => {
      const dayLeaves = leaves?.filter(leave => {
        const fromDate = parseISO(leave.fromDate);
        const toDate = parseISO(leave.toDate);
        const leaveTypeMatch = filterLeaveType === ALL_LEAVE_TYPES || leave.leaveType === filterLeaveType;
        return filteredEmployeeIds.has(leave.employeeId) && isWithinInterval(day, { start: fromDate, end: toDate }) && leaveTypeMatch;
      }).map(leave => ({
        ...leave,
        employee: employees?.find(e => e.id === leave.employeeId)
      }));

      const dayBirthdays = filteredEmployees.filter(emp => {
        if (!emp.dateOfBirth) return false;
        try {
          const dob = parseISO(emp.dateOfBirth);
          return format(dob, 'MM-dd') === format(day, 'MM-dd');
        } catch { return false; }
      });

      const holiday = holidays?.find(h => isWithinInterval(day, { start: parseISO(h.fromDate), end: parseISO(h.toDate || h.fromDate) })) || null;
      const isWeekend = day.getDay() === 5; // Friday

      return {
        date: day,
        isToday: isToday(day),
        holiday: holiday,
        isWeekend: isWeekend,
        leaves: dayLeaves || [],
        birthdays: dayBirthdays,
      };
    });
  }, [currentMonth, employees, leaves, holidays, filterBranch, filterDept, filterLeaveType, isLoading, birthdays]);

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <CalendarIcon className="h-6 w-6 text-primary" />
            Leave Calendar
          </CardTitle>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={filterLeaveType} onValueChange={(val) => setFilterLeaveType(val as any)}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Leave Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LEAVE_TYPES}>All Leave Types</SelectItem>
                {leaveTypeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_BRANCHES}>All Branches</SelectItem>
                {branches?.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DEPTS}>All Departments</SelectItem>
                {departments?.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-4">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-xl font-semibold">{format(currentMonth, 'MMMM yyyy')}</div>
          <Button variant="outline" size="icon" onClick={goToNextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto w-full max-w-full">
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg border overflow-hidden min-w-[600px] sm:min-w-0">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} className="text-center font-medium text-xs sm:text-sm py-2 bg-muted/50 text-muted-foreground">{day}</div>
            ))}
            {monthData.map(dayInfo => (
              <div
                key={dayInfo.date.toString()}
                className={cn(
                  "relative bg-card p-1.5 min-h-[100px] h-auto flex flex-col transition-colors",
                  dayInfo.isToday && "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 border-2 z-10",
                  dayInfo.holiday && "bg-rose-50/70 dark:bg-rose-900/10 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/20"
                )}
                onClick={() => {
                  if (dayInfo.holiday) {
                    Swal.fire({
                      title: dayInfo.holiday.name,
                      text: `${dayInfo.holiday.type} announcement.`,
                      icon: 'info',
                      confirmButtonColor: 'hsl(var(--primary))'
                    });
                  }
                }}
              >
                <div className="flex justify-between items-start">
                  <time dateTime={format(dayInfo.date, 'yyyy-MM-dd')} className={cn("text-xs font-semibold", dayInfo.isToday && "text-blue-600 dark:text-blue-400 font-bold")}>
                    {format(dayInfo.date, 'd')}
                  </time>
                  <div className="flex gap-1 items-center">
                    {dayInfo.holiday && <span className="text-[10px] bg-rose-500 text-white px-1 rounded font-bold">H</span>}
                    {dayInfo.isToday && <span className="text-[10px] bg-blue-500 text-white px-1 rounded font-bold">TODAY</span>}
                  </div>
                </div>
                <div className="flex-grow mt-1 space-y-1">
                  {dayInfo.birthdays.map(emp => (
                    <TooltipProvider key={emp.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 cursor-pointer bg-pink-100 dark:bg-pink-900/50 p-1 rounded">
                            <Cake className="h-4 w-4 text-pink-500 flex-shrink-0" />
                            <span className="hidden sm:inline text-xs truncate font-medium text-pink-700 dark:text-pink-300">{emp.fullName}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">{emp.fullName}'s Birthday!</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                  {dayInfo.leaves.map(leave => (
                    <TooltipProvider key={leave.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 cursor-pointer">
                            <Avatar className="h-8 w-8 flex-shrink-0 relative">
                              <AvatarImage src={leave.employee?.photoURL} alt={leave.employee?.fullName} />
                              <AvatarFallback className="text-xs font-semibold">{getInitials(leave.employee?.fullName)}</AvatarFallback>
                              <div className={cn(
                                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
                                leave.status === 'Approved' ? 'bg-emerald-500' : 'bg-amber-500'
                              )} />
                            </Avatar>
                            <span className="hidden sm:inline text-xs truncate text-muted-foreground">{leave.employee?.fullName}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">{leave.employee?.fullName}</p>
                          <p>Type: {leave.leaveType}</p>
                          <p>Reason: {leave.reason}</p>
                          <p>Status: <span className={leave.status === 'Approved' ? 'text-green-500' : 'text-yellow-500'}>{leave.status}</span></p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-4 flex-wrap gap-y-2">
          <div className="flex items-center"><span className="h-3 w-3 rounded-full bg-emerald-500 mr-2"></span>Approved</div>
          <div className="flex items-center"><span className="h-3 w-3 rounded-full bg-amber-500 mr-2"></span>Pending</div>
          <div className="flex items-center"><span className="h-3 w-3 rounded-full bg-blue-500 mr-2"></span>Today</div>
          <div className="flex items-center"><span className="h-3 w-3 rounded-full bg-gray-400 mr-2"></span>Holiday</div>
          <div className="flex items-center"><Cake className="h-4 w-4 text-pink-500 mr-1" />Birthday</div>
        </div>
      </CardContent>
    </Card>
  )
}
