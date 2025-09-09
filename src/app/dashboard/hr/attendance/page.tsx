
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker'; // Assuming this component exists
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Search, Save, CalendarDays as CalendarIcon, Clock, MessageSquare, Minus, Plus } from 'lucide-react';
import type { EmployeeDocument, BranchDocument, UnitDocument, DepartmentDocument, AttendanceFlag } from '@/types';
import { attendanceFlagOptions } from '@/types';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { format, differenceInMinutes, parse, isValid } from 'date-fns';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';


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


const EmployeeAttendanceRow = ({ employee }: { employee: EmployeeDocument }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [workingHours, setWorkingHours] = React.useState("0:0");

    const form = useForm<AttendanceFormValues>({
        resolver: zodResolver(AttendanceSchema),
        defaultValues: {
            flag: 'P',
            inTime: '09:00',
            outTime: '18:00',
            inTimeRemarks: '',
            outTimeRemarks: ''
        },
    });

    const { watch, control, handleSubmit } = form;
    const inTime = watch('inTime');
    const outTime = watch('outTime');
    
    React.useEffect(() => {
        if (inTime && outTime) {
            try {
                const inDate = parse(inTime, 'HH:mm', new Date());
                const outDate = parse(outTime, 'HH:mm', new Date());
                if(isValid(inDate) && isValid(outDate) && outDate > inDate) {
                    const diffMins = differenceInMinutes(outDate, inDate);
                    const hours = Math.floor(diffMins / 60);
                    const minutes = diffMins % 60;
                    setWorkingHours(`${hours}:${minutes.toString().padStart(2, '0')}`);
                } else {
                    setWorkingHours("0:0");
                }
            } catch {
                setWorkingHours("0:0");
            }
        }
    }, [inTime, outTime]);

    const onSubmit = (data: AttendanceFormValues) => {
        console.log({ employeeId: employee.id, ...data });
        // Here you would typically save the data to Firestore
        // For now, we just log it.
        Swal.fire("Saved", "Attendance recorded for " + employee.fullName, "success");
    };

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
                            <div className="text-sm text-muted-foreground text-left">
                                <p>{employee.designation}</p>
                                <p>{employee.branch}</p>
                            </div>
                            {isExpanded ? <Minus className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="p-4 bg-muted/50">
                           <Form {...form}>
                             <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-muted-foreground">
                                                <th className="p-2">Attendance Date</th>
                                                <th className="p-2">Flag</th>
                                                <th className="p-2">In Time</th>
                                                <th className="p-2">In Time Remarks</th>
                                                <th className="p-2">Out Time & Date</th>
                                                <th className="p-2">Out Time Remarks</th>
                                                <th className="p-2">Working Hour</th>
                                                <th className="p-2">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="p-2">{format(new Date(), 'E, dd-MM-yyyy')}</td>
                                                <td className="p-2">
                                                    <FormField control={control} name="flag" render={({ field }) => (
                                                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <SelectTrigger className="w-[80px] h-9"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {attendanceFlagOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                                            </SelectContent>
                                                         </Select>
                                                    )}/>
                                                </td>
                                                <td className="p-2">
                                                     <FormField control={control} name="inTime" render={({ field }) => (
                                                        <div className="relative">
                                                            <Input type="time" {...field} className="h-9 w-[130px]"/>
                                                            <Clock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                                        </div>
                                                     )}/>
                                                </td>
                                                <td className="p-2">
                                                     <FormField control={control} name="inTimeRemarks" render={({ field }) => (
                                                        <Input placeholder="Enter remarks" {...field} className="h-9"/>
                                                     )}/>
                                                </td>
                                                <td className="p-2">
                                                     <FormField control={control} name="outTime" render={({ field }) => (
                                                        <div className="relative">
                                                            <Input type="time" {...field} className="h-9 w-[130px]"/>
                                                            <Clock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                                        </div>
                                                     )}/>
                                                </td>
                                                <td className="p-2">
                                                     <FormField control={control} name="outTimeRemarks" render={({ field }) => (
                                                        <Input placeholder="Enter remarks" {...field} className="h-9"/>
                                                     )}/>
                                                </td>
                                                <td className="p-2">{workingHours}</td>
                                                <td className="p-2">
                                                    <Button type="submit" size="icon" className="h-8 w-8"><Save className="h-4 w-4"/></Button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                             </form>
                           </Form>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    )
};


export default function DailyAttendancePage() {
    const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(query(collection(firestore, "employees"), orderBy("fullName")), undefined, ['employees']);
    const { data: branches, isLoading: isLoadingBranches } = useFirestoreQuery<BranchDocument[]>(query(collection(firestore, "branches")), undefined, ['branches']);
    const { data: units, isLoading: isLoadingUnits } = useFirestoreQuery<UnitDocument[]>(query(collection(firestore, "units")), undefined, ['units']);
    const { data: departments, isLoading: isLoadingDepts } = useFirestoreQuery<DepartmentDocument[]>(query(collection(firestore, "departments")), undefined, ['departments']);
    
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedBranch, setSelectedBranch] = React.useState('');
    const [selectedUnit, setSelectedUnit] = React.useState('');
    const [selectedDept, setSelectedDept] = React.useState('');
    
    const filteredEmployees = React.useMemo(() => {
        if (!employees) return [];
        return employees.filter(emp => 
            (emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || emp.employeeCode.includes(searchTerm)) &&
            (!selectedBranch || emp.branch === selectedBranch) &&
            (!selectedUnit || emp.unit === selectedUnit) &&
            (!selectedDept || emp.department === selectedDept)
        );
    }, [employees, searchTerm, selectedBranch, selectedUnit, selectedDept]);
    
    const isLoading = isLoadingEmployees || isLoadingBranches || isLoadingUnits || isLoadingDepts;

    return (
        <div className="container mx-auto py-8">
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                        <CalendarIcon className="h-7 w-7 text-primary" /> Daily Attendance
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="p-4 mb-6 rounded-lg border bg-card shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="relative lg:col-span-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"/>
                                <Input placeholder="Employee name or code" className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                           <DatePickerWithRange className="h-10"/>
                            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                                <SelectTrigger><SelectValue placeholder="Select Branch"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All Branches</SelectItem>
                                    {branches?.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                                <SelectTrigger><SelectValue placeholder="Select Unit"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All Units</SelectItem>
                                    {units?.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={selectedDept} onValueChange={setSelectedDept}>
                                <SelectTrigger><SelectValue placeholder="Select Department"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All Departments</SelectItem>
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
                                <EmployeeAttendanceRow key={emp.id} employee={emp} />
                           ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// Assuming DatePickerWithRange exists in ui components, if not it needs to be created.
// For now, I'm importing it, but it might need a placeholder implementation.
// Let's create a placeholder for it if it does not exist.
namespace React {
    export interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
      // extends React's HTMLAttributes
      className?: string;
    }
}
const DatePickerWithRange = ({ className }: { className?: string }) => {
    const [date, setDate] = React.useState<any>(null);
    return (
        <div className={cn("grid gap-2", className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal h-10",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "LLL dd, y")} -{" "}
                                    {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
```