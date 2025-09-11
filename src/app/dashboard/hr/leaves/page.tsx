
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mailbox, PlusCircle, Loader2, AlertTriangle, Info } from 'lucide-react';
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
import { firestore } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import type { LeaveApplicationDocument } from '@/types';
import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const formatDisplayDate = (dateString: string): string => {
    try {
        const date = parseISO(dateString);
        return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
    } catch {
        return 'Invalid Date';
    }
};

const calculateDuration = (from: string, to: string): string => {
    try {
        const fromDate = parseISO(from);
        const toDate = parseISO(to);
        if (isValid(fromDate) && isValid(toDate)) {
            const days = differenceInCalendarDays(toDate, fromDate) + 1;
            return `${days} day${days > 1 ? 's' : ''}`;
        }
    } catch {}
    return 'N/A';
};


const LeaveListSkeleton = () => (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
        </TableRow>
      ))}
    </>
);


export default function LeaveManagementPage() {
  const [leaves, setLeaves] = React.useState<LeaveApplicationDocument[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsLoading(true);
    const leavesQuery = query(collection(firestore, "leave_applications"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(leavesQuery, (snapshot) => {
      const fetchedLeaves = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LeaveApplicationDocument));
      setLeaves(fetchedLeaves);
      setIsLoading(false);
      setFetchError(null);
    }, (error) => {
      console.error("Error fetching leave applications: ", error);
      setFetchError(`Failed to load data. Check console and ensure you have permission to read 'leave_applications'. Error: ${error.message}`);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);


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
                <h3 className="text-lg font-semibold mb-4">Leave Application History</h3>
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
                            {isLoading ? (
                                <LeaveListSkeleton />
                            ) : fetchError ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-destructive">
                                        <AlertTriangle className="mx-auto mb-2 h-8 w-8" />
                                        {fetchError}
                                    </TableCell>
                                </TableRow>
                            ) : leaves.length > 0 ? (
                                leaves.map(leave => (
                                    <TableRow key={leave.id}>
                                        <TableCell className="font-medium">{leave.employeeName}</TableCell>
                                        <TableCell>{leave.leaveType}</TableCell>
                                        <TableCell>{formatDisplayDate(leave.fromDate)}</TableCell>
                                        <TableCell>{formatDisplayDate(leave.toDate)}</TableCell>
                                        <TableCell>{calculateDuration(leave.fromDate, leave.toDate)}</TableCell>
                                        <TableCell><Badge variant={getStatusBadgeVariant(leave.status)}>{leave.status}</Badge></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <Info className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                                        No leave applications have been submitted yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                         <TableCaption>This is a list of all submitted leave applications.</TableCaption>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
