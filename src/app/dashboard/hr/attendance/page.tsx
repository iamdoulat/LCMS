
"use client";

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import type { EmployeeDocument, BranchDocument, UnitDocument, DepartmentDocument, AttendanceDocument, AttendanceFlag, HolidayDocument, LeaveApplicationDocument } from '@/types';
import { attendanceFlagOptions } from '@/types';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { cn } from '@/lib/utils';
import { format, isValid, eachDayOfInterval, startOfDay, endOfDay, parseISO, differenceInMinutes, parse, getDay, isWithinInterval as isWithinDateInterval } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Search, CalendarDays as CalendarIcon, Clock, MessageSquare, Minus, Plus, PlusCircle, Trash2, Calendar, Filter, XCircle, Save } from 'lucide-react';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';


const ALL_BRANCHES_VALUE = "__ALL_BRANCHES_ATTENDANCE__";
const ALL_UNITS_VALUE = "__ALL_UNITS_ATTENDANCE__";
const ALL_DEPTS_VALUE = "__ALL_DEPTS_ATTENDANCE__";

const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

const attendanceDaySchema = z.object({
  flag: z.enum(attendanceFlagOptions),
  inTime: z.string().optional(),
  inTimeRemarks: z.string().optional(),
  outTime: z.string().optional(),
  outTimeRemarks: z.string().optional(),
});
type AttendanceDayFormValues = z.infer<typeof attendanceDaySchema>;

const AttendanceDayRow = ({
  employee,
  date,
  initialData,
  onRecordUpdate,
  holidays,
  leaves,
}: {
  employee: EmployeeDocument;
  date: Date;
  initialData?: AttendanceDocument;
  onRecordUpdate: () => void;
  holidays: HolidayDocument[];
  leaves: LeaveApplicationDocument[];
}) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [workingHours, setWorkingHours] = React.useState<string | null>(null);

  const getDefaultFlag = React.useCallback((): AttendanceFlag => {
    // If there is existing data, its flag is the default.
    if (initialData?.flag) {
        return initialData.flag;
    }

    const dayOfWeek = getDay(date);
    if (dayOfWeek === 5) return 'W'; // Friday is Weekend

    const isHoliday = holidays.some(h => 
        isWithinDateInterval(date, { start: parseISO(h.fromDate), end: parseISO(h.toDate || h.fromDate) })
    );
    if (isHoliday) return 'H';

    const isOnLeave = leaves.some(l => 
        l.employeeId === employee.id &&
        isWithinDateInterval(date, { start: parseISO(l.fromDate), end: parseISO(l.toDate) }) &&
        l.status === 'Approved'
    );
    if (isOnLeave) return 'L';
    
    // The final fallback is 'Absent'
    return 'A'; 
  }, [date, holidays, leaves, initialData, employee.id]);

  const form = useForm<AttendanceDayFormValues>({
    resolver: zodResolver(attendanceDaySchema),
    defaultValues: {
      flag: 'A', // Default to A, will be overridden by useEffect
      inTime: '09:00',
      inTimeRemarks: '',
      outTime: '18:00',
      outTimeRemarks: '',
    },
  });
  
  React.useEffect(() => {
    // This effect now correctly initializes or resets the form based on incoming data.
    const defaultFlag = getDefaultFlag();
    form.reset({
      flag: initialData?.flag || defaultFlag,
      inTime: initialData?.inTime || '09:00',
      inTimeRemarks: initialData?.inTimeRemarks || '',
      outTime: initialData?.outTime || '18:00',
      outTimeRemarks: initialData?.outTimeRemarks || '',
    });
  }, [initialData, getDefaultFlag, form]);


  const { watch, control, handleSubmit, setValue } = form;
  const inTime = watch('inTime');
  const outTime = watch('outTime');
  const flag = watch('flag');
  
  React.useEffect(() => {
    // This logic now only applies when there's NO initial data for the day
    // and the flag is in its default 'A' state.
    if (!initialData && form.getValues('flag') === 'A') {
        if(inTime) {
            try {
                const [hours, minutes] = inTime.split(':').map(Number);
                if ((hours > 9 || (hours === 9 && minutes > 10))) {
                    setValue('flag', 'D');
                } else {
                    setValue('flag', 'P');
                }
            } catch {}
        }
    }
  }, [inTime, form, setValue, initialData]);

  React.useEffect(() => {
    if (flag !== 'P' && flag !== 'D') {
      setWorkingHours(null);
      return;
    }
    if (!inTime || !outTime) {
      setWorkingHours("Invalid Time");
      return;
    }
    try {
      const inDate = parse(inTime, 'HH:mm', new Date());
      const outDate = parse(outTime, 'HH:mm', new Date());
      if (isValid(inDate) && isValid(outDate) && outDate >= inDate) {
        const diffMins = differenceInMinutes(outDate, inDate);
        const hours = Math.floor(diffMins / 60);
        const minutes = diffMins % 60;
        setWorkingHours(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      } else {
        setWorkingHours("0:00");
      }
    } catch {
      setWorkingHours("Error");
    }
  }, [inTime, outTime, flag]);

  const onSave = async (data: AttendanceDayFormValues) => {
    if (!user) {
        Swal.fire("Not Authenticated", "You must be logged in to save attendance.", "error");
        return;
    }
    setIsSubmitting(true);
    
    const formattedDate = format(date, 'yyyy-MM-dd');
    const docId = `${employee.id}_${formattedDate}`;

    const dataToSave: Partial<AttendanceDocument> = {
        employeeId: employee.id,
        employeeName: `${employee.fullName} (${employee.employeeCode})`,
        date: format(date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        flag: data.flag,
        workingHours: workingHours,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
    };
    
    if (data.flag === 'P' || data.flag === 'D') {
        dataToSave.inTime = data.inTime;
        dataToSave.inTimeRemarks = data.inTimeRemarks;
        dataToSave.outTime = data.outTime;
        dataToSave.outTimeRemarks = data.outTimeRemarks;
    }

    try {
        await setDoc(doc(firestore, "attendance", docId), dataToSave, { merge: true });
        Swal.fire({ title: "Saved!", icon: "success", timer: 1000, showConfirmButton: false });
        onRecordUpdate();
    } catch (e) {
        console.error("Error saving attendance:", e);
        Swal.fire("Error", "Could not save the record.", "error");
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const onDelete = async () => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    const docId = `${employee.id}_${formattedDate}`;
    
    Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
        if(result.isConfirmed) {
            try {
                await deleteDoc(doc(firestore, "attendance", docId));
                Swal.fire('Deleted!', 'The record has been deleted.', 'success');
                onRecordUpdate();
            } catch (e) {
                console.error("Error deleting attendance:", e);
                Swal.fire("Error", "Could not delete the record.", "error");
            }
        }
    });
  };

  return (
    <TableRow>
      <TableCell>{format(date, 'EEE, dd/MM/yy')}</TableCell>
      <TableCell>
        <Controller
          control={control}
          name="flag"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger className="w-20 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {attendanceFlagOptions.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        />
      </TableCell>
      <TableCell>
        <Controller control={control} name="inTime" render={({ field }) => <Input type="time" {...field} className="h-9" disabled={flag !== 'P' && flag !== 'D'} />} />
      </TableCell>
      <TableCell>
        <Controller control={control} name="inTimeRemarks" render={({ field }) => <Input placeholder="Enter remarks" {...field} className="h-9" disabled={flag !== 'P' && flag !== 'D'} />} />
      </TableCell>
      <TableCell>
        <Controller control={control} name="outTime" render={({ field }) => <Input type="time" {...field} className="h-9" disabled={flag !== 'P' && flag !== 'D'} />} />
      </TableCell>
      <TableCell>
        <Controller control={control} name="outTimeRemarks" render={({ field }) => <Input placeholder="Enter remarks" {...field} className="h-9" disabled={flag !== 'P' && flag !== 'D'} />} />
      </TableCell>
      <TableCell>{(flag === 'P' || flag === 'D') ? workingHours : 'N/A'}</TableCell>
       <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
            <Button type="button" variant="ghost" size="icon" onClick={handleSubmit(onSave)} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onDelete} disabled={isSubmitting}>
                <Trash2 className="h-4 w-4 text-destructive"/>
            </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};


const EmployeeAttendanceRow = ({ 
    employee, 
    dateRange, 
    attendanceRecords,
    holidays,
    leaves,
    onRecordUpdate
}: { 
    employee: EmployeeDocument, 
    dateRange: DateRange | undefined, 
    attendanceRecords: AttendanceDocument[],
    holidays: HolidayDocument[],
    leaves: LeaveApplicationDocument[],
    onRecordUpdate: () => void;
}) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    
    const datesToDisplay = React.useMemo(() => {
        const from = dateRange?.from;
        const to = dateRange?.to || from;

        if (from && to && isValid(from) && isValid(to) && to >= from) {
            try {
              return eachDayOfInterval({ start: from, end: to });
            } catch (error) {
                console.error("Error creating date interval:", error);
                return [startOfDay(new Date())];
            }
        }
        return [startOfDay(new Date())];
    }, [dateRange]);
    
    return (
        <Card className="mb-2">
            <Accordion type="single" collapsible onValueChange={(value) => setIsExpanded(!!value)}>
                <AccordionItem value={`item-${employee.id}`} className="border-b-0">
                    <AccordionTrigger className="p-4 hover:no-underline">
                        <div className="flex items-center gap-4 w-full">
                            <Avatar>
                                <AvatarImage src={employee.photoURL} alt={employee.fullName} />
                                <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                                <div>
                                    <p className="font-semibold">{employee.fullName}</p>
                                    <p className="text-sm text-muted-foreground">{employee.employeeCode}</p>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    <p>{employee.designation}</p>
                                    <p>{employee.branch || 'N/A'}</p>
                                </div>
                            </div>
                            {isExpanded ? <Minus className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                       <div className="p-4 bg-muted/50 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Attendance Date</TableHead>
                                        <TableHead>Flag</TableHead>
                                        <TableHead>In Time</TableHead>
                                        <TableHead>In Time Remarks</TableHead>
                                        <TableHead>Out Time &amp; Date</TableHead>
                                        <TableHead>Out Time Remarks</TableHead>
                                        <TableHead>Working Hour</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {datesToDisplay.map(date => {
                                        const formattedDateKey = format(date, 'yyyy-MM-dd');
                                        const attendanceData = attendanceRecords.find(rec => {
                                            if (!rec.date) return false;
                                            try {
                                                const recordDate = format(parseISO(rec.date), 'yyyy-MM-dd');
                                                return recordDate === formattedDateKey;
                                            } catch {
                                                return false;
                                            }
                                        });

                                        return (
                                            <AttendanceDayRow
                                                key={date.toISOString()}
                                                employee={employee}
                                                date={date}
                                                initialData={attendanceData}
                                                onRecordUpdate={onRecordUpdate}
                                                holidays={holidays}
                                                leaves={leaves}
                                            />
                                        );
                                    })}
                                </TableBody>
                            </Table>
                       </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    );
};

export default function DailyAttendancePage() {
    const router = useRouter();
    const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(
        query(collection(firestore, "employees"), orderBy("fullName")), 
        undefined, 
        ['employees_for_attendance']
    );
    const { data: branches, isLoading: isLoadingBranches } = useFirestoreQuery<BranchDocument[]>(
        query(collection(firestore, "branches")), 
        undefined, 
        ['branches']
    );
    const { data: units, isLoading: isLoadingUnits } = useFirestoreQuery<UnitDocument[]>(
        query(collection(firestore, "units")), 
        undefined, 
        ['units']
    );
    const { data: departments, isLoading: isLoadingDepts } = useFirestoreQuery<DepartmentDocument[]>(
        query(collection(firestore, "departments")), 
        undefined, 
        ['departments']
    );
     const { data: holidays, isLoading: isLoadingHolidays } = useFirestoreQuery<HolidayDocument[]>(
        query(collection(firestore, "holidays")), 
        undefined, 
        ['holidays']
    );
    const { data: leaves, isLoading: isLoadingLeaves } = useFirestoreQuery<LeaveApplicationDocument[]>(
        query(collection(firestore, "leave_applications"), where("status", "==", "Approved")), 
        undefined, 
        ['approved_leaves']
    );

    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedBranch, setSelectedBranch] = React.useState('');
    const [selectedUnit, setSelectedUnit] = React.useState('');
    const [selectedDept, setSelectedDept] = React.useState('');
    
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });

    const [allAttendance, setAllAttendance] = React.useState<AttendanceDocument[]>([]);
    const [isLoadingAttendance, setIsLoadingAttendance] = React.useState(true);

    const refetchAttendance = React.useCallback(async () => {
        setIsLoadingAttendance(true);
        if (!dateRange?.from) {
            setAllAttendance([]);
            setIsLoadingAttendance(false);
            return;
        }
        
        const fromDate = format(startOfDay(dateRange.from), "yyyy-MM-dd'T'00:00:00.000xxx");
        const toDate = format(endOfDay(dateRange.to || dateRange.from), "yyyy-MM-dd'T'23:59:59.999xxx");
        
        const attendanceQuery = query(
            collection(firestore, "attendance"),
            where('date', '>=', fromDate),
            where('date', '<=', toDate)
        );

        const unsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
            const fetchedAttendance = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceDocument));
            setAllAttendance(fetchedAttendance);
            setIsLoadingAttendance(false);
        }, (error) => {
            console.error("Error fetching attendance:", error);
            setIsLoadingAttendance(false);
        });

        return unsubscribe;
    }, [dateRange]);
    
    React.useEffect(() => {
        const unsubscribePromise = refetchAttendance();
        return () => {
            unsubscribePromise.then(unsub => unsub && unsub());
        };
    }, [refetchAttendance]);


    const filteredEmployees = React.useMemo(() => {
        if (!employees) return [];
        return employees.filter(emp => 
            (emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || emp.employeeCode.includes(searchTerm)) &&
            (!selectedBranch || emp.branch === selectedBranch) &&
            (!selectedUnit || emp.unit === selectedUnit) &&
            (!selectedDept || emp.department === selectedDept)
        );
    }, [employees, searchTerm, selectedBranch, selectedUnit, selectedDept]);
    
    const attendanceByEmployee = React.useMemo(() => {
        const map = new Map<string, AttendanceDocument[]>();
        if (allAttendance) {
            allAttendance.forEach(att => {
                const employeeId = att.employeeId;
                if (!map.has(employeeId)) {
                    map.set(employeeId, []);
                }
                map.get(employeeId)!.push(att);
            });
        }
        return map;
    }, [allAttendance]);

    const isLoading = isLoadingEmployees || isLoadingBranches || isLoadingUnits || isLoadingDepts || isLoadingAttendance || isLoadingHolidays || isLoadingLeaves;

    return (
        <div className="container mx-auto py-8">
            <Card className="shadow-xl">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                                <Calendar className="h-7 w-7 text-primary" /> Daily Attendance
                            </CardTitle>
                            <CardDescription>
                                Manage and view daily attendance records for employees.
                            </CardDescription>
                        </div>
                         <div className="flex gap-2">
                             <Link href="/dashboard/hr/attendance/add" passHref>
                                <Button>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Record
                                </Button>
                            </Link>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                   <Card className="mb-6 shadow-md p-4">
                        <CardHeader className="p-2 pb-4">
                            <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-end">
                                <div className="space-y-1">
                                    <Label htmlFor='search-term-employee-attendance'>Employee Name or Code</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"/>
                                        <Input id="search-term-employee-attendance" placeholder="Search..." className="pl-10 h-10 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label>Date Range</Label>
                                    <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="h-10"/>
                                </div>
                                <div className="space-y-1">
                                    <Label>Branch</Label>
                                    <Select value={selectedBranch} onValueChange={(value) => setSelectedBranch(value === ALL_BRANCHES_VALUE ? '' : value)}>
                                        <SelectTrigger className="h-10"><SelectValue placeholder="Select Branch"/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_BRANCHES_VALUE}>All Branches</SelectItem>
                                            {branches?.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label>Unit</Label>
                                    <Select value={selectedUnit} onValueChange={(value) => setSelectedUnit(value === ALL_UNITS_VALUE ? '' : value)}>
                                        <SelectTrigger className="h-10"><SelectValue placeholder="Select Unit"/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_UNITS_VALUE}>All Units</SelectItem>
                                            {units?.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label>Department</Label>
                                    <Select value={selectedDept} onValueChange={(value) => setSelectedDept(value === ALL_DEPTS_VALUE ? '' : value)}>
                                        <SelectTrigger className="h-10"><SelectValue placeholder="Select Department"/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_DEPTS_VALUE}>All Departments</SelectItem>
                                            {departments?.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                    ) : (
                        <div className="space-y-2">
                           {filteredEmployees.length === 0 ? (
                               <div className="text-center py-8 text-muted-foreground">
                                   No employees found matching your criteria.
                               </div>
                           ) : (
                               filteredEmployees.map(emp => (
                                    <EmployeeAttendanceRow 
                                        key={emp.id} 
                                        employee={emp} 
                                        dateRange={dateRange}
                                        attendanceRecords={attendanceByEmployee.get(emp.id) || []}
                                        holidays={holidays || []}
                                        leaves={leaves || []}
                                        onRecordUpdate={refetchAttendance}
                                    />
                               ))
                           )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

    