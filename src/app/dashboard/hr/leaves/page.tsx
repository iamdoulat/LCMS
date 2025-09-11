
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mailbox, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Swal from 'sweetalert2';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { EmployeeDocument } from '@/types';
import { Combobox } from '@/components/ui/combobox';
import { DatePickerInput } from '@/components/ui/date-picker-input';


const leaveApplicationSchema = z.object({
  employeeId: z.string().min(1, "Employee is required."),
  leaveType: z.string().min(1, "Leave type is required."),
  fromDate: z.date({ required_error: "Start date is required." }),
  toDate: z.date({ required_error: "End date is required." }),
  reason: z.string().min(10, "Reason must be at least 10 characters long."),
}).refine(data => {
    if(data.fromDate && data.toDate) {
        return data.toDate >= data.fromDate;
    }
    return true;
}, {
    message: "End date cannot be before the start date.",
    path: ["toDate"],
});

type LeaveApplicationFormValues = z.infer<typeof leaveApplicationSchema>;


const placeholderLeaves = [
    { id: '1', employeeName: 'John Doe', employeeId: 'EMP001', leaveType: 'Annual Leave', from: '2024-08-10', to: '2024-08-15', duration: '6 days', status: 'Approved' },
    { id: '2', employeeName: 'Jane Smith', employeeId: 'EMP002', leaveType: 'Sick Leave', from: '2024-08-12', to: '2024-08-12', duration: '1 day', status: 'Approved' },
    { id: '3', employeeName: 'Peter Jones', employeeId: 'EMP003', leaveType: 'Paternity Leave', from: '2024-09-01', to: '2024-09-15', duration: '15 days', status: 'Pending' },
    { id: '4', employeeName: 'Mary Johnson', employeeId: 'EMP004', leaveType: 'Annual Leave', from: '2024-08-20', to: '2024-08-25', duration: '6 days', status: 'Rejected' },
];


export default function LeaveManagementPage() {
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const { data: employees, isLoading: isLoadingEmployees } = useFirestoreQuery<EmployeeDocument[]>(
    query(collection(firestore, "employees"), orderBy("fullName")),
    undefined,
    ['employees_for_leave']
  );

  const form = useForm<LeaveApplicationFormValues>({
    resolver: zodResolver(leaveApplicationSchema),
    defaultValues: {
      employeeId: '',
      leaveType: undefined,
      fromDate: undefined,
      toDate: undefined,
      reason: ''
    }
  });

  const onSubmit = (data: LeaveApplicationFormValues) => {
    console.log(data);
    Swal.fire({
        title: "Application Submitted!",
        text: "Your leave application has been submitted for approval.",
        icon: "success"
    });
    setIsFormOpen(false);
    form.reset();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'Approved': return 'default';
        case 'Pending': return 'secondary';
        case 'Rejected': return 'destructive';
        default: return 'outline';
    }
  }


  return (
    <div className="container mx-auto py-8">
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Mailbox className="h-6 w-6 text-primary"/>New Leave Application</DialogTitle>
                <DialogDescription>Fill out the form below to apply for leave.</DialogDescription>
            </DialogHeader>
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="employeeId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee</FormLabel>
                        <Combobox
                          options={employees?.map(emp => ({ value: emp.id, label: `${emp.fullName} (${emp.employeeCode})`})) || []}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Search Employee..."
                          selectPlaceholder={isLoadingEmployees ? "Loading..." : "Select Employee"}
                          disabled={isLoadingEmployees}
                        />
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="leaveType" render={({ field }) => (<FormItem><FormLabel>Leave Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Leave Type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Annual">Annual Leave</SelectItem><SelectItem value="Sick">Sick Leave</SelectItem><SelectItem value="Paternity">Paternity Leave</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="fromDate"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>From</FormLabel>
                                <DatePickerInput
                                    date={field.value}
                                    setDate={field.onChange}
                                />
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="toDate"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>To</FormLabel>
                                <DatePickerInput
                                    date={field.value}
                                    setDate={field.onChange}
                                    fromDate={form.getValues("fromDate")}
                                />
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <FormField control={form.control} name="reason" render={({ field }) => (<FormItem><FormLabel>Reason</FormLabel><FormControl><Textarea placeholder="Please provide a reason for your leave..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Submit Application</Button>
                    </DialogFooter>
                </form>
             </Form>
        </DialogContent>
        </Dialog>

        <Card className="shadow-xl">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                            <Mailbox className="h-7 w-7 text-primary" />
                            Leave Management
                        </CardTitle>
                        <CardDescription>Apply for leave and view current leave statuses.</CardDescription>
                    </div>
                     <Button onClick={() => setIsFormOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4"/>
                        Apply for Leave
                     </Button>
                </div>
            </CardHeader>
            <CardContent>
                <h3 className="text-lg font-semibold mb-4">Employees on Leave</h3>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee Name</TableHead>
                                <TableHead>Leave Type</TableHead>
                                <TableHead>From</TableHead>
                                <TableHead>To</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {placeholderLeaves.map(leave => (
                                <TableRow key={leave.id}>
                                    <TableCell className="font-medium">{leave.employeeName}</TableCell>
                                    <TableCell>{leave.leaveType}</TableCell>
                                    <TableCell>{leave.from}</TableCell>
                                    <TableCell>{leave.to}</TableCell>
                                    <TableCell>{leave.duration}</TableCell>
                                    <TableCell><Badge variant={getStatusBadgeVariant(leave.status)}>{leave.status}</Badge></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                         <TableCaption>This is a list of current and upcoming employee leaves.</TableCaption>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
