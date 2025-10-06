
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mailbox, PlusCircle, Loader2, AlertTriangle, Info, Check, X, ThumbsUp, ThumbsDown, Edit, Filter, XCircle, MoreHorizontal } from 'lucide-react';
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
import { collection, onSnapshot, query, orderBy, Timestamp, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { LeaveApplicationDocument, LeaveStatus, LeaveType } from '@/types';
import { leaveStatusOptions, leaveTypeOptions } from '@/types';
import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


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
            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-8 w-24" /></TableCell>
        </TableRow>
      ))}
    </>
);


export default function LeaveManagementPage() {
  const { userRole } = useAuth();
  const router = useRouter();
  const [allLeaves, setAllLeaves] = React.useState<LeaveApplicationDocument[]>([]);
  const [displayedLeaves, setDisplayedLeaves] = React.useState<LeaveApplicationDocument[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  // Filter states
  const [filterEmployeeCode, setFilterEmployeeCode] = React.useState('');
  const [filterEmployeeName, setFilterEmployeeName] = React.useState('');
  const [filterLeaveType, setFilterLeaveType] = React.useState<LeaveType | ''>('');
  const [filterStatus, setFilterStatus] = React.useState<LeaveStatus | ''>('');


  const canApprove = userRole?.includes('Super Admin') || userRole?.includes('Admin');
  const canEdit = userRole?.some(role => ['Super Admin', 'Admin'].includes(role));

  React.useEffect(() => {
    setIsLoading(true);
    const leavesQuery = query(collection(firestore, "leave_applications"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(leavesQuery, (snapshot) => {
      const fetchedLeaves = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LeaveApplicationDocument));
      setAllLeaves(fetchedLeaves);
      setIsLoading(false);
      setFetchError(null);
    }, (error) => {
      console.error("Error fetching leave applications: ", error);
      setFetchError(`Failed to load data. Check console and ensure you have permission to read 'leave_applications'. Error: ${error.message}`);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const getEmployeeDetails = (employeeName: string) => {
    if (!employeeName) return { name: 'N/A', code: 'N/A' };
    const match = employeeName.match(/(.*) \((.*)\)/);
    if (match) {
        return { name: match[1], code: match[2] };
    }
    return { name: employeeName, code: 'N/A' };
  };

  React.useEffect(() => {
    let filtered = [...allLeaves];

    if (filterEmployeeName) {
        filtered = filtered.filter(leave => 
            getEmployeeDetails(leave.employeeName).name.toLowerCase().includes(filterEmployeeName.toLowerCase())
        );
    }
    if (filterEmployeeCode) {
        filtered = filtered.filter(leave => 
            getEmployeeDetails(leave.employeeName).code.toLowerCase().includes(filterEmployeeCode.toLowerCase())
        );
    }
    if (filterLeaveType) {
        filtered = filtered.filter(leave => leave.leaveType === filterLeaveType);
    }
    if (filterStatus) {
        filtered = filtered.filter(leave => leave.status === filterStatus);
    }

    setDisplayedLeaves(filtered);
  }, [allLeaves, filterEmployeeName, filterEmployeeCode, filterLeaveType, filterStatus]);


  const handleUpdateStatus = async (leaveId: string, newStatus: 'Approved' | 'Rejected') => {
    if (!canApprove) {
      Swal.fire("Permission Denied", "You do not have permission to perform this action.", "error");
      return;
    }

    const swalConfig: any = {
      title: `Confirm ${newStatus}`,
      text: `Are you sure you want to change the status to ${newStatus.toLowerCase()} for this leave application?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Yes, ${newStatus.toLowerCase()} it!`,
      confirmButtonColor: newStatus === 'Approved' ? 'hsl(var(--primary))' : 'hsl(var(--destructive))',
    };
    
    if (newStatus === 'Rejected') {
      swalConfig.input = 'textarea';
      swalConfig.inputLabel = 'Reason for Rejection';
      swalConfig.inputPlaceholder = 'Provide a reason...';
    }
    
    Swal.fire(swalConfig).then(async (result) => {
      if (result.isConfirmed) {
        const comment = result.value || ''; // Get comment from Swal input if it exists
        try {
          const leaveDocRef = doc(firestore, "leave_applications", leaveId);
          const updateData: { status: 'Approved' | 'Rejected'; updatedAt: any; approverComment?: string } = {
            status: newStatus,
            updatedAt: serverTimestamp(),
          };
          if (newStatus === 'Rejected' && comment) {
            updateData.approverComment = comment;
          }
          await updateDoc(leaveDocRef, updateData);
          Swal.fire('Success!', `The leave application has been ${newStatus.toLowerCase()}.`, 'success');
        } catch (error: any) {
          Swal.fire('Error!', `Could not update the status: ${error.message}`, 'error');
        }
      }
    });
  };


  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'Approved': return 'default';
        case 'Pending': return 'secondary';
        case 'Rejected': return 'destructive';
        default: return 'outline';
    }
  }

  const clearFilters = () => {
    setFilterEmployeeCode('');
    setFilterEmployeeName('');
    setFilterLeaveType('');
    setFilterStatus('');
  };


  return (
    <div className="container mx-auto py-8 px-5">
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
                <Card className="mb-6 shadow-md p-4">
                    <CardHeader className="p-2 pb-4">
                        <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
                            <div className="space-y-1">
                                <Label htmlFor="employeeCodeFilterLeave">Employee Code</Label>
                                <Input id="employeeCodeFilterLeave" placeholder="Search Code..." value={filterEmployeeCode} onChange={(e) => setFilterEmployeeCode(e.target.value)} />
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="employeeNameFilterLeave">Employee Name</Label>
                                <Input id="employeeNameFilterLeave" placeholder="Search Name..." value={filterEmployeeName} onChange={(e) => setFilterEmployeeName(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="leaveTypeFilter">Leave Type</Label>
                                <Select value={filterLeaveType} onValueChange={(value) => setFilterLeaveType(value === 'All' ? '' : value as LeaveType)}>
                                    <SelectTrigger id="leaveTypeFilter"><SelectValue placeholder="All Types" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Types</SelectItem>
                                        {leaveTypeOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="statusFilterLeave">Status</Label>
                                <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value === 'All' ? '' : value as LeaveStatus)}>
                                    <SelectTrigger id="statusFilterLeave"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Statuses</SelectItem>
                                        {leaveStatusOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="pt-6">
                                <Button onClick={clearFilters} variant="outline" className="w-full"><XCircle className="mr-2 h-4 w-4" /> Clear Filters</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <h3 className="text-lg font-semibold mb-4">Leave Application History</h3>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee Name</TableHead>
                                <TableHead>Employee Code</TableHead>
                                <TableHead>Leave Type</TableHead>
                                <TableHead>From</TableHead>
                                <TableHead>To</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Apply Reason*</TableHead>
                                <TableHead>Approver Comment</TableHead>
                                <TableHead>Status</TableHead>
                                {canApprove && <TableHead className="text-center">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <LeaveListSkeleton />
                            ) : fetchError ? (
                                <TableRow>
                                    <TableCell colSpan={canApprove ? 10 : 9} className="h-24 text-center text-destructive">
                                        <AlertTriangle className="mx-auto mb-2 h-8 w-8" />
                                        {fetchError}
                                    </TableCell>
                                </TableRow>
                            ) : displayedLeaves.length > 0 ? (
                                displayedLeaves.map(leave => {
                                    const { name, code } = getEmployeeDetails(leave.employeeName);
                                    return (
                                        <TableRow key={leave.id}>
                                            <TableCell className="font-medium">{name}</TableCell>
                                            <TableCell>{code}</TableCell>
                                            <TableCell>{leave.leaveType}</TableCell>
                                            <TableCell>{formatDisplayDate(leave.fromDate)}</TableCell>
                                            <TableCell>{formatDisplayDate(leave.toDate)}</TableCell>
                                            <TableCell>{calculateDuration(leave.fromDate, leave.toDate)}</TableCell>
                                            <TableCell className="max-w-[200px] truncate" title={leave.reason}>{leave.reason}</TableCell>
                                            <TableCell className="max-w-[200px] truncate text-muted-foreground" title={leave.approverComment}>{leave.approverComment || 'N/A'}</TableCell>
                                            <TableCell><Badge variant={getStatusBadgeVariant(leave.status)}>{leave.status}</Badge></TableCell>
                                            {canApprove && (
                                                <TableCell className="text-center">
                                                     <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <span className="sr-only">Open menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem onSelect={() => handleUpdateStatus(leave.id, 'Approved')}>
                                                                <ThumbsUp className="mr-2 h-4 w-4" />
                                                                <span>Approve</span>
                                                            </DropdownMenuItem>
                                                             <DropdownMenuItem onSelect={() => handleUpdateStatus(leave.id, 'Rejected')} className="text-destructive focus:text-destructive">
                                                                <ThumbsDown className="mr-2 h-4 w-4" />
                                                                <span>Reject</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onSelect={() => router.push(`/dashboard/hr/leaves/edit/${leave.id}`)}>
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                <span>Edit</span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={canApprove ? 10 : 9} className="h-24 text-center">
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
