
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mailbox, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';


const placeholderLeaves = [
    { id: '1', employeeName: 'John Doe', employeeId: 'EMP001', leaveType: 'Annual Leave', from: '2024-08-10', to: '2024-08-15', duration: '6 days', status: 'Approved' },
    { id: '2', employeeName: 'Jane Smith', employeeId: 'EMP002', leaveType: 'Sick Leave', from: '2024-08-12', to: '2024-08-12', duration: '1 day', status: 'Approved' },
    { id: '3', employeeName: 'Peter Jones', employeeId: 'EMP003', leaveType: 'Paternity Leave', from: '2024-09-01', to: '2024-09-15', duration: '15 days', status: 'Pending' },
    { id: '4', employeeName: 'Mary Johnson', employeeId: 'EMP004', leaveType: 'Annual Leave', from: '2024-08-20', to: '2024-08-25', duration: '6 days', status: 'Rejected' },
];


export default function LeaveManagementPage() {

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
                     <Button asChild>
                        <Link href="/dashboard/hr/leaves/add">
                            <PlusCircle className="mr-2 h-4 w-4"/>
                            Apply for Leave
                        </Link>
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
