
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Search, Save, CalendarDays as CalendarIcon, Clock, MessageSquare, Minus, Plus, Upload, PlusCircle, Trash2, Calendar, Filter, Image as ImageIcon } from 'lucide-react';
import type { EmployeeDocument, BranchDocument, UnitDocument, DepartmentDocument, Attendance, AttendanceDocument, AttendanceFlag } from '@/types';
import { attendanceFlagOptions } from '@/types';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, getDocs, doc, setDoc, serverTimestamp, deleteDoc, writeBatch, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { format, differenceInMinutes, parse, isValid, eachDayOfInterval, startOfDay, endOfDay, subMonths, parseISO } from 'date-fns';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import Swal from 'sweetalert2';
import type { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DatePickerField } from '@/components/forms/DatePickerField';

const ALL_BRANCHES_VALUE = "__ALL_BRANCHES_ATTENDANCE__";
const ALL_UNITS_VALUE = "__ALL_UNITS_ATTENDANCE__";
const ALL_DEPTS_VALUE = "__ALL_DEPTS_ATTENDANCE__";

const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

const AttendanceSchema = z.object({
    flag: z.enum(attendanceFlagOptions),
    inTime: z.string().optional(),
    inTimeRemarks: z.string().optional(),
    outTime: z.string().optional(),
    outTimeRemarks: z.string().optional(),
    enableInTime: z.boolean().optional(),
    enableOutTime: z.boolean().optional(),
});
type AttendanceFormValues = z.infer<typeof AttendanceSchema>;

const DailyAttendanceDataRow = ({ 
    employee, 
    attendanceDate, 
    initialData, 
    onRecordChange 
}: { 
    employee: EmployeeDocument, 
    attendanceDate: Date, 
    initialData?: AttendanceDocument | null, 
    onRecordChange: () => void 
}) => {
    const [workingHours, setWorkingHours] = React.useState<string | null>(null);

    const form = useForm<AttendanceFormValues>({
        resolver: zodResolver(AttendanceSchema),
        defaultValues: {
            flag: 'P',
            inTime: '09:00',
            outTime: '18:00',
            inTimeRemarks: '',
            outTimeRemarks: '',
            enableInTime: true,
            enableOutTime: true,
        },
    });
    
    React.useEffect(() => {
        const resetForm = (data: AttendanceDocument | null | undefined) => {
            form.reset({
                flag: data?.flag || 'P',
                inTime: data?.inTime || '09:00',
                outTime: data?.outTime || '18:00',
                inTimeRemarks: data?.inTimeRemarks || '',
                outTimeRemarks: data?.outTimeRemarks || '',
                enableInTime: data?.enableInTime ?? (data?.flag === 'P' ? true : false),
                enableOutTime: data?.enableOutTime ?? (data?.flag === 'P' ? true : false),
            });
        };
        resetForm(initialData);
    }, [initialData, form]);

    const { watch, control, handleSubmit } = form;
    const inTime = watch('inTime');
    const outTime = watch('outTime');
    const flag = watch('flag');
    const enableInTime = watch('enableInTime');
    const enableOutTime = watch('enableOutTime');
    
    React.useEffect(() => {
        if (flag !== 'P' || !enableInTime || !enableOutTime || !inTime || !outTime) {
            setWorkingHours(null);
            return;
        }

        try {
            const inDate = parse(inTime, 'HH:mm', new Date());
            const outDate = parse(outTime, 'HH:mm', new Date());
            if(isValid(inDate) && isValid(outDate) && outDate >= inDate) {
                const diffMins = differenceInMinutes(outDate, inDate);
                const hours = Math.floor(diffMins / 60);
                const minutes = diffMins % 60;
                setWorkingHours(`${hours}:${minutes.toString().padStart(2, '0')}`);
            } else {
                setWorkingHours("0:00");
            }
        } catch {
            setWorkingHours("Error");
        }
    }, [inTime, outTime, flag, enableInTime, enableOutTime]);

    const onSubmit = async (data: AttendanceFormValues) => {
        const formattedDate = format(attendanceDate, 'yyyy-MM-dd');
        const docId = `${employee.id}_${formattedDate}`;

        const dataToSave: Record<string, any> = {
            ...data,
            employeeId: employee.id,
            employeeName: employee.fullName,
            date: formattedDate,
            workingHours: (data.flag === 'P' && data.enableInTime && data.enableOutTime) ? workingHours : null,
            updatedAt: serverTimestamp(),
        };

        if(!initialData?.createdAt) {
            dataToSave.createdAt = serverTimestamp();
        }

        if (data.flag !== 'P' || !data.enableInTime) {
          delete dataToSave.inTime;
          delete dataToSave.inTimeRemarks;
        }
        if (data.flag !== 'P' || !data.enableOutTime) {
            delete dataToSave.outTime;
            delete dataToSave.outTimeRemarks;
        }
         if (data.flag !== 'P' || !data.enableInTime || !data.enableOutTime) {
            delete dataToSave.workingHours;
        }

        try {
            await setDoc(doc(firestore, "attendance", docId), dataToSave, { merge: true });
            Swal.fire({
                title: "Saved", 
                text: `Attendance updated for ${employee.fullName} on ${format(attendanceDate, 'MM/dd/yyyy')}`,
                icon: "success",
                timer: 1500,
                showConfirmButton: false,
            });
            onRecordChange();
        } catch (error: any) {
             Swal.fire("Error", `Failed to save attendance: ${error.message}`, "error");
        }
    };
    
    const handleDelete = async () => {
        const formattedDate = format(attendanceDate, 'yyyy-MM-dd');
        const docId = `${employee.id}_${formattedDate}`;
        
        Swal.fire({
            title: 'Are you sure?',
            text: `This will delete the attendance record for ${employee.fullName} on ${format(attendanceDate, 'MM/dd/yyyy')}.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!',
            confirmButtonColor: 'hsl(var(--destructive))',
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(firestore, "attendance", docId));
                    Swal.fire('Deleted!', 'The record has been removed.', 'success');
                    onRecordChange();
                } catch (error: any) {
                    Swal.fire('Error', `Failed to delete record: ${error.message}`, 'error');
                }
            }
        });
    };

    return (
        <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)}>
                <TableRow>
                    <TableCell className="font-semibold text-sm whitespace-nowrap">
                        {format(attendanceDate, 'EEE, MM/dd/yyyy')}
                    </TableCell>
                    <TableCell>
                        <FormField control={control} name="flag" render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="w-[80px] h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {attendanceFlagOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                </SelectContent>
                                </Select>
                        )}/>
                    </TableCell>
                    {flag === 'P' ? (
                        <>
                        <TableCell>
                            <div className='flex items-center gap-2'>
                            {enableInTime && (
                                <FormField control={control} name="inTime" render={({ field }) => (
                                <div className="relative">
                                    <Input type="text" placeholder='09:00' {...field} className="h-9 w-[120px]"/>
                                    <Clock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                </div>
                                )}/>
                            )}
                            </div>
                        </TableCell>
                        <TableCell>
                            {enableInTime && (
                                <FormField control={control} name="inTimeRemarks" render={({ field }) => (
                                <Input placeholder="Enter remarks" {...field} className="h-9"/>
                                )}/>
                            )}
                        </TableCell>
                        <TableCell>
                            <div className='flex items-center gap-2'>
                            {enableOutTime && (
                                <FormField control={control} name="outTime" render={({ field }) => (
                                <div className="relative">
                                    <Input type="text" placeholder='18:00' {...field} className="h-9 w-[120px] bg-sky-100 dark:bg-sky-900/40"/>
                                    <Clock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                </div>
                                )}/>
                            )}
                            </div>
                        </TableCell>
                        <TableCell>
                            {enableOutTime && (
                                <FormField control={control} name="outTimeRemarks" render={({ field }) => (
                                <Input placeholder="Enter remarks" {...field} className="h-9"/>
                                )}/>
                            )}
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary">
                            {enableInTime && enableOutTime ? workingHours : '-'}
                        </TableCell>
                        </>
                    ) : (
                        <TableCell colSpan={5} className="text-center text-muted-foreground">Not applicable</TableCell>
                    )}
                    <TableCell className="flex gap-2">
                        <Button type="submit" size="icon" className="h-8 w-8"><Save className="h-4 w-4"/></Button>
                        {initialData && (
                            <Button type="button" variant="destructive" size="icon" className="h-8 w-8" onClick={handleDelete}>
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                        )}
                    </TableCell>
                </TableRow>
            </form>
        </Form>
    );
};

const EmployeeAttendanceRow = ({ 
    employee, 
    dateRange, 
    attendanceRecords, 
    onRecordChange 
}: { 
    employee: EmployeeDocument, 
    dateRange: DateRange | undefined, 
    attendanceRecords: AttendanceDocument[], 
    onRecordChange: () => void 
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
                                <AvatarImage src={employee.photoURL} alt={employee.fullName} data-ai-hint="employee photo" />
                                <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left">
                                <p className="font-semibold">{employee.fullName}</p>
                                <p className="text-sm text-muted-foreground">{employee.employeeCode}</p>
                            </div>
                            <div className="text-sm text-muted-foreground text-left">
                                <p>{employee.designation}</p>
                                <p>{employee.branch}</p>
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
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {datesToDisplay.map(date => {
                                        const formattedDate = format(date, 'yyyy-MM-dd');
                                        const attendanceData = attendanceRecords.find(rec => rec.date === formattedDate && rec.employeeId === employee.id);
                                        return (
                                            <DailyAttendanceDataRow
                                                key={date.toISOString()}
                                                employee={employee}
                                                attendanceDate={date}
                                                initialData={attendanceData}
                                                onRecordChange={onRecordChange}
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
        ['employees']
    );
    const { data: branches, isLoading: isLoadingBranches } = useFirestoreQuery<BranchDocument[]>(
        query(collection(firestore, "branches")), 
        undefined, 
        ['branches']    );
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

        const fileInputRef = React.useRef<HTMLInputElement>(null);
        const [searchTerm, setSearchTerm] = React.useState('');
        const [selectedBranch, setSelectedBranch] = React.useState('');
        const [selectedUnit, setSelectedUnit] = React.useState('');
        const [selectedDept, setSelectedDept] = React.useState('');
        
        const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
            from: new Date(),
            to: new Date(),
        });

        const attendanceQuery = React.useMemo(() => {
            if (!dateRange?.from || !dateRange?.to) {
                return null;
            }
            const fromDate = format(dateRange.from, 'yyyy-MM-dd');
            const toDate = format(dateRange.to, 'yyyy-MM-dd');
            return query(
                collection(firestore, "attendance"),
                where('date', '>=', fromDate),
                where('date', '<=', toDate),
            );
        }, [dateRange]);

        const { data: allAttendance, isLoading: isLoadingAttendance, refetch: refetchAttendance } = useFirestoreQuery<AttendanceDocument[]>(
            attendanceQuery!,
            (snapshot) => {
                return snapshot.docs.map(doc => {
                    const data = doc.data();
                    const formattedDate = format(parseISO(data.date), 'yyyy-MM-dd');
                    return {
                        id: doc.id,
                        ...data,
                        date: formattedDate
                    } as AttendanceDocument;
                });
            }, 
            ['attendance', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
            {
                enabled: !!attendanceQuery, // Only run if query is not null
            }
        );
    
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
    
        const isLoading = isLoadingEmployees || isLoadingBranches || isLoadingUnits || isLoadingDepts || isLoadingAttendance;
    
        const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.type !== "text/csv") {
                Swal.fire("Invalid File Type", "Please upload a .csv file.", "error");
                if (fileInputRef.current) fileInputRef.current.value = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target?.result as string;
                if (!text) {
                    Swal.fire("Error Reading File", "Could not read file content.", "error");
                    return;
                }

                const rows = text.split(/\r\n|\n/).filter(row => row.trim() !== '');
                const header = rows[0]?.split(',').map(h => h.trim());
                const requiredHeaders = ['employeeCode', 'date', 'flag', 'inTime', 'outTime'];
                if (!header || !requiredHeaders.every(h => header.includes(h))) {
                    Swal.fire("Invalid CSV Header", `CSV must contain the following headers: ${requiredHeaders.join(', ')}`, "error");
                    return;
                }

                const employeeMap = new Map(employees?.map(emp => [emp.employeeCode, emp.id]));
                const dataRows = rows.slice(1);
                const batch = writeBatch(firestore);
                let validRecordsCount = 0;
                const errors: string[] = [];

                dataRows.forEach((row, index) => {
                    const values = row.split(',');
                    const rowData: { [key: string]: string } = {};
                    header.forEach((h, i) => {
                        rowData[h] = values[i]?.trim();
                    });

                    const employeeId = employeeMap.get(rowData.employeeCode);
                    if (!employeeId) {
                        errors.push(`Row ${index + 2}: Employee with code "${rowData.employeeCode}" not found.`);
                        return;
                    }
                    
                    const dateStr = rowData.date.replace(/\//g, '-');
                    const parsedDate = parseISO(dateStr);


                    if (!rowData.date || !isValid(parsedDate)) {
                        errors.push(`Row ${index + 2}: Invalid date format for "${rowData.date}". Use YYYY-MM-DD format.`);
                        return;
                    }
                    
                    const formattedDate = format(parsedDate, 'yyyy-MM-dd');
                    const docId = `${employeeId}_${formattedDate}`;
                    const docRef = doc(firestore, "attendance", docId);
                    
                    const attendanceData: Partial<Attendance> = {
                        employeeId: employeeId,
                        date: formattedDate,
                        flag: rowData.flag as AttendanceFlag || 'P',
                        updatedAt: serverTimestamp(),
                    };

                    if (attendanceData.flag === 'P') {
                        attendanceData.inTime = rowData.inTime || '09:00';
                        attendanceData.outTime = rowData.outTime || '18:00';
                        attendanceData.inTimeRemarks = rowData.inTimeRemarks || '';
                        attendanceData.outTimeRemarks = rowData.outTimeRemarks || '';
                    }

                    batch.set(docRef, attendanceData, { merge: true });
                    validRecordsCount++;
                });

                if (errors.length > 0) {
                    Swal.fire({
                        title: "CSV Import Errors",
                        html: `<div class="text-left max-h-48 overflow-y-auto">${errors.join('<br>')}</div>`,
                        icon: "error"
                    });
                }
                
                if (validRecordsCount > 0) {
                    try {
                        await batch.commit();
                        Swal.fire("Import Successful", `${validRecordsCount} attendance records have been successfully imported/updated.`, "success");
                        refetchAttendance(); // Refresh data on the page
                    } catch (error: any) {
                        Swal.fire("Firestore Error", `An error occurred while saving to the database: ${error.message}`, "error");
                    }
                } else if (errors.length === 0) {
                     Swal.fire("No Data", "No valid attendance records found to import.", "info");
                }
            };
            reader.readAsText(file);
             if (fileInputRef.current) fileInputRef.current.value = "";
        };
    
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
                                <input
                                    type="file"
                                    accept=".csv"
                                    ref={fileInputRef}
                                    onChange={handleImportCsv}
                                    className="hidden"
                                    id="csv-import-input-attendance"
                                />
                                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                                    <Upload className="mr-2 h-4 w-4" /> Import CSV
                                </Button>
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                    <div className="space-y-1 md:col-span-2 lg:col-span-1">
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
                                    <div className="space-y-1 lg:ml-8">
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
                                            onRecordChange={refetchAttendance}
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

    