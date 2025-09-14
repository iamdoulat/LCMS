
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Search, Save, CalendarDays as CalendarIcon, Clock, MessageSquare, Minus, Plus, Upload, PlusCircle, Trash2 } from 'lucide-react';
import type { EmployeeDocument, BranchDocument, UnitDocument, DepartmentDocument, Attendance, AttendanceDocument } from '@/types';
import { attendanceFlagOptions } from '@/types';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, getDocs, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { format, differenceInMinutes, parse, isValid, eachDayOfInterval, startOfDay, endOfDay, subMonths } from 'date-fns';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import Swal from 'sweetalert2';
import type { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

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
});
type AttendanceFormValues = z.infer<typeof AttendanceSchema>;

const DailyAttendanceDataRow = ({ employee, attendanceDate, initialData, onRecordChange }: { employee: EmployeeDocument, attendanceDate: Date, initialData?: Attendance | null, onRecordChange: () => void }) => {
    const [workingHours, setWorkingHours] = React.useState<string | null>(null);

    const form = useForm<AttendanceFormValues>({
        resolver: zodResolver(AttendanceSchema),
        defaultValues: {
            flag: initialData?.flag || 'P',
            inTime: initialData?.inTime || '09:00',
            outTime: initialData?.outTime || '18:00',
            inTimeRemarks: initialData?.inTimeRemarks || '',
            outTimeRemarks: initialData?.outTimeRemarks || ''
        },
    });
    
    React.useEffect(() => {
        form.reset({
            flag: initialData?.flag || 'P',
            inTime: initialData?.inTime || '09:00',
            outTime: initialData?.outTime || '18:00',
            inTimeRemarks: initialData?.inTimeRemarks || '',
            outTimeRemarks: initialData?.outTimeRemarks || ''
        });
    }, [initialData, form]);

    const { watch, control, handleSubmit } = form;
    const inTime = watch('inTime');
    const outTime = watch('outTime');
    const flag = watch('flag');
    
    React.useEffect(() => {
        if (flag !== 'P' || !inTime || !outTime) {
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
                setWorkingHours("Invalid");
            }
        } catch {
            setWorkingHours("Error");
        }
    }, [inTime, outTime, flag]);

    const onSubmit = async (data: AttendanceFormValues) => {
        const formattedDate = format(attendanceDate, 'yyyy-MM-dd');
        const docId = `${employee.id}_${formattedDate}`;

        const dataToSave: Record<string, any> = {
            ...data,
            employeeId: employee.id,
            date: formattedDate,
            workingHours: workingHours,
            updatedAt: serverTimestamp(),
            createdAt: initialData?.createdAt || serverTimestamp(),
        };

        if (data.flag !== 'P') {
            delete dataToSave.inTime;
            delete dataToSave.outTime;
            delete dataToSave.workingHours;
        }

        try {
            await setDoc(doc(firestore, "attendance", docId), dataToSave, { merge: true });
            Swal.fire("Saved", `Attendance updated for ${employee.fullName} on ${format(attendanceDate, 'PPP')}`, "success");
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
            text: `This will delete the attendance record for ${employee.fullName} on ${format(attendanceDate, 'PPP')}.`,
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
                    <TableCell>{format(attendanceDate, 'EEE, dd-MM-yyyy')}</TableCell>
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
                    <TableCell>
                            <FormField control={control} name="inTime" render={({ field }) => (
                            <div className="relative">
                                <Input type="time" {...field} className="h-9 w-[120px]"/>
                                <Clock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                            </div>
                            )}/>
                    </TableCell>
                    <TableCell>
                            <FormField control={control} name="inTimeRemarks" render={({ field }) => (
                            <Input placeholder="Enter remarks" {...field} className="h-9"/>
                            )}/>
                    </TableCell>
                    <TableCell>
                            <FormField control={control} name="outTime" render={({ field }) => (
                             <div className="relative">
                                <Input type="time" {...field} className="h-9 w-[120px]"/>
                                <Clock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                            </div>
                            )}/>
                    </TableCell>
                    <TableCell>
                            <FormField control={control} name="outTimeRemarks" render={({ field }) => (
                            <Input placeholder="Enter remarks" {...field} className="h-9"/>
                            )}/>
                    </TableCell>
                    <TableCell>{workingHours}</TableCell>
                    <TableCell className="flex gap-2">
                        <Button type="submit" size="icon" className="h-8 w-8"><Save className="h-4 w-4"/></Button>
                        <Button type="button" variant="destructive" size="icon" className="h-8 w-8" onClick={handleDelete}><Trash2 className="h-4 w-4"/></Button>
                    </TableCell>
                </TableRow>
            </form>
        </Form>
    );
};

const EmployeeAttendanceRow = ({ employee, dateRange, attendanceRecords, onRecordChange }: { employee: EmployeeDocument, dateRange: DateRange | undefined, attendanceRecords: AttendanceDocument[], onRecordChange: () => void }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const datesToDisplay = React.useMemo(() => {
        const from = dateRange?.from;
        const to = dateRange?.to || from;

        if (from && to && isValid(from) && isValid(to) && to >= from) {
            try {
              return eachDayOfInterval({ start: from, end: to });
            } catch (error) {
                console.error("Error creating date interval:", error);
                return [startOfDay(new Date())]; // Fallback
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
                                <AvatarImage src={employee.photoURL} alt={employee.fullName} data-ai-hint="employee photo"/>
                                <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left">
                                <p className="font-semibold">{employee.fullName}</p>
                                <p className="text-sm text-muted-foreground">{employee.employeeCode}</p>
                            </div>
                            <div className="text-sm text-muted-foreground text-left hidden md:block">
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
                                        <TableHead className="p-2">Attendance Date</TableHead>
                                        <TableHead className="p-2">Flag</TableHead>
                                        <TableHead className="p-2">In Time</TableHead>
                                        <TableHead className="p-2">In Time Remarks</TableHead>
                                        <TableHead className="p-2">Out Time</TableHead>
                                        <TableHead className="p-2">Out Time Remarks</TableHead>
                                        <TableHead className="p-2">Working Hour</TableHead>
                                        <TableHead className="p-2">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {datesToDisplay.map(date => {
                                        const dateString = format(date, 'yyyy-MM-dd');
                                        const record = attendanceRecords.find(r => r.date === dateString);
                                        return <DailyAttendanceDataRow key={date.toISOString()} employee={employee} attendanceDate={date} initialData={record} onRecordChange={onRecordChange} />;
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
    const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(query(collection(firestore, "employees"), orderBy("fullName")), undefined, ['employees']);
    const { data: branches, isLoading: isLoadingBranches } = useFirestoreQuery<BranchDocument[]>(query(collection(firestore, "branches")), undefined, ['branches']);
    const { data: units, isLoading: isLoadingUnits } = useFirestoreQuery<UnitDocument[]>(query(collection(firestore, "units")), undefined, ['units']);
    const { data: departments, isLoading: isLoadingDepts } = useFirestoreQuery<DepartmentDocument[]>(query(collection(firestore, "departments")), undefined, ['departments']);
    const { data: allAttendance, isLoading: isLoadingAttendance, refetch: refetchAttendance } = useFirestoreQuery<AttendanceDocument[]>(query(collection(firestore, "attendance")), undefined, ['attendance']);
    
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedBranch, setSelectedBranch] = React.useState('');
    const [selectedUnit, setSelectedUnit] = React.useState('');
    const [selectedDept, setSelectedDept] = React.useState('');
    
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);

    React.useEffect(() => {
        // Set default date range on the client side to avoid hydration mismatch
        setDateRange({
            from: subMonths(new Date(), 1),
            to: new Date(),
        });
    }, []);
    
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
                if (!map.has(att.employeeId)) {
                    map.set(att.employeeId, []);
                }
                map.get(att.employeeId)!.push(att);
            });
        }
        return map;
    }, [allAttendance]);

    const isLoading = isLoadingEmployees || isLoadingBranches || isLoadingUnits || isLoadingDepts || isLoadingAttendance;

    const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
          return;
        }
        if (file.type !== "text/csv") {
          Swal.fire("Invalid File Type", "Please upload a .csv file.", "error");
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) {
                Swal.fire("Error Reading File", "Could not read file content.", "error");
                return;
            }
            console.log("CSV Content:", text);
            Swal.fire(
                "Import Started",
                "CSV file is being processed. (Note: This is a placeholder; data is not yet saved to the database).",
                "info"
            );
        };
        reader.onerror = () => {
          Swal.fire("File Read Error", "Error reading the selected file.", "error");
          if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsText(file);
    };

    return (
        <div className="container mx-auto py-8">
            <Card className="shadow-xl">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                                <CalendarIcon className="h-7 w-7 text-primary" /> Daily Attendance
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
                    <div className="p-4 mb-6 rounded-lg border bg-card shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="relative lg:col-span-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"/>
                                <Input placeholder="Employee name or code" className="pl-10 h-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                           <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="h-10"/>
                            <Select value={selectedBranch} onValueChange={(value) => setSelectedBranch(value === ALL_BRANCHES_VALUE ? '' : value)}>
                                <SelectTrigger className="h-10"><SelectValue placeholder="Select Branch"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_BRANCHES_VALUE}>All Branches</SelectItem>
                                    {branches?.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={selectedUnit} onValueChange={(value) => setSelectedUnit(value === ALL_UNITS_VALUE ? '' : value)}>
                                <SelectTrigger className="h-10"><SelectValue placeholder="Select Unit"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_UNITS_VALUE}>All Units</SelectItem>
                                    {units?.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={selectedDept} onValueChange={(value) => setSelectedDept(value === ALL_DEPTS_VALUE ? '' : value)}>
                                <SelectTrigger className="h-10"><SelectValue placeholder="Select Department"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_DEPTS_VALUE}>All Departments</SelectItem>
                                    {departments?.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                    ) : (
                        <div className="space-y-2">
                           {filteredEmployees.map(emp => (
                                <EmployeeAttendanceRow 
                                    key={emp.id} 
                                    employee={emp} 
                                    dateRange={dateRange}
                                    attendanceRecords={attendanceByEmployee.get(emp.id) || []}
                                    onRecordChange={refetchAttendance}
                                />
                           ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
