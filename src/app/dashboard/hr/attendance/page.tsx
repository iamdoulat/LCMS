
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Search, CalendarDays as CalendarIcon, Clock, MessageSquare, Minus, Plus, Upload, PlusCircle, Trash2, Calendar, Filter, Image as ImageIcon, XCircle } from 'lucide-react';
import type { EmployeeDocument, BranchDocument, UnitDocument, DepartmentDocument, AttendanceDocument, AttendanceFlag } from '@/types';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { format, isValid, eachDayOfInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import Swal from 'sweetalert2';
import type { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';

const ALL_BRANCHES_VALUE = "__ALL_BRANCHES_ATTENDANCE__";
const ALL_UNITS_VALUE = "__ALL_UNITS_ATTENDANCE__";
const ALL_DEPTS_VALUE = "__ALL_DEPTS_ATTENDANCE__";

const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

const EmployeeAttendanceRow = ({ 
    employee, 
    dateRange, 
    attendanceRecords 
}: { 
    employee: EmployeeDocument, 
    dateRange: DateRange | undefined, 
    attendanceRecords: AttendanceDocument[]
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
                            <div className="flex-1 text-left grid grid-cols-1 sm:grid-cols-3 gap-x-4">
                                <div className="sm:col-span-1">
                                    <p className="font-semibold">{employee.fullName}</p>
                                    <p className="text-sm text-muted-foreground">{employee.employeeCode}</p>
                                </div>
                                <div className="text-sm text-muted-foreground sm:col-span-2">
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
                                        <TableHead>Date</TableHead>
                                        <TableHead>Flag</TableHead>
                                        <TableHead>In Time</TableHead>
                                        <TableHead>In Remarks</TableHead>
                                        <TableHead>Out Time</TableHead>
                                        <TableHead>Out Remarks</TableHead>
                                        <TableHead>Working Hour</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {datesToDisplay.map(date => {
                                        const formattedDate = format(date, 'yyyy-MM-dd');
                                        const attendanceData = attendanceRecords.find(rec => {
                                            if (!rec.date) return false;
                                            try {
                                                const recordDate = format(parseISO(rec.date), 'yyyy-MM-dd');
                                                return recordDate === formattedDate;
                                            } catch {
                                                return false;
                                            }
                                        });

                                        return (
                                            <TableRow key={date.toISOString()}>
                                                <TableCell>{format(date, 'EEE, dd/MM/yy')}</TableCell>
                                                <TableCell>{attendanceData?.flag || '-'}</TableCell>
                                                <TableCell>{attendanceData?.inTime || '-'}</TableCell>
                                                <TableCell>{attendanceData?.inTimeRemarks || '-'}</TableCell>
                                                <TableCell>{attendanceData?.outTime || '-'}</TableCell>
                                                <TableCell>{attendanceData?.outTimeRemarks || '-'}</TableCell>
                                                <TableCell>{attendanceData?.workingHours || '-'}</TableCell>
                                            </TableRow>
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

    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedBranch, setSelectedBranch] = React.useState('');
    const [selectedUnit, setSelectedUnit] = React.useState('');
    const [selectedDept, setSelectedDept] = React.useState('');
    
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });

    const attendanceQuery = React.useMemo(() => {
        if (!dateRange?.from) return null;
        const fromDate = format(startOfDay(dateRange.from), "yyyy-MM-dd'T'00:00:00.000'Z'");
        const toDate = format(endOfDay(dateRange.to || dateRange.from), "yyyy-MM-dd'T'23:59:59.999'Z'");
        
        return query(
            collection(firestore, "attendance"),
            where('date', '>=', fromDate),
            where('date', '<=', toDate),
        );
    }, [dateRange]);

    const { data: allAttendance, isLoading: isLoadingAttendance, refetch: refetchAttendance } = useFirestoreQuery<AttendanceDocument[]>(
        attendanceQuery!,
        undefined,
        ['attendance', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
        {
            enabled: !!attendanceQuery,
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                <div className="space-y-1 md:col-span-2 lg:col-span-1">
                                    <Label htmlFor='search-term-employee-attendance'>Employee Name or Code</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"/>
                                        <Input id="search-term-employee-attendance" placeholder="Search..." className="pl-10 h-10 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-1 lg:ml-8">
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
