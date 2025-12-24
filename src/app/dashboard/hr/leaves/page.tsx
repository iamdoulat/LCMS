

"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mailbox, PlusCircle, AlertTriangle, Info, ThumbsUp, ThumbsDown, Edit, Filter, XCircle, MoreHorizontal, Trash2 } from 'lucide-react';
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
import { useSearchParams } from 'next/navigation';
import { firestore } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import type { LeaveApplicationDocument, LeaveStatus, LeaveType, EmployeeDocument } from '@/types';
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
import { Alert, AlertDescription } from '@/components/ui/alert';


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
    } catch { }
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

const ALL_LEAVE_TYPES_VALUE = "__ALL_LEAVE_TYPES__";
const ALL_STATUSES_LEAVE_VALUE = "__ALL_STATUSES_LEAVE__";

export default function LeaveManagementPage() {
    const searchParams = useSearchParams();
    const viewTeam = searchParams.get('view') === 'team';
    const { userRole, user } = useAuth();
    const router = useRouter();
    const [allLeaves, setAllLeaves] = React.useState<LeaveApplicationDocument[]>([]);
    const [displayedLeaves, setDisplayedLeaves] = React.useState<LeaveApplicationDocument[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [fetchError, setFetchError] = React.useState<string | null>(null);

    // Supervisor filtering
    const [currentEmployeeId, setCurrentEmployeeId] = React.useState<string | null>(null);
    const [supervisedEmployeeIds, setSupervisedEmployeeIds] = React.useState<string[]>([]);
    const [isSupervisor, setIsSupervisor] = React.useState(false);

    // Filter states
    const [filterEmployeeCode, setFilterEmployeeCode] = React.useState('');
    const [filterEmployeeName, setFilterEmployeeName] = React.useState('');
    const [filterLeaveType, setFilterLeaveType] = React.useState<LeaveType | ''>('');
    const [filterStatus, setFilterStatus] = React.useState<LeaveStatus | ''>('');
    const [availableLeaveTypes, setAvailableLeaveTypes] = React.useState<string[]>([]);


    const isHROrAdmin = userRole?.some(role => ['Super Admin', 'Admin', 'HR'].includes(role));
    const canApprove = isHROrAdmin || isSupervisor;

    // Fetch current employee ID and check if they are a supervisor
    React.useEffect(() => {
        const fetchCurrentEmployee = async () => {
            if (!user?.email) return;

            try {
                const q = query(collection(firestore, 'employees'), where('email', '==', user.email));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const empDoc = snapshot.docs[0];
                    const employeeId = empDoc.id;
                    setCurrentEmployeeId(employeeId);

                    // Check if this employee is a supervisor by querying for subordinates
                    // Look for employees where supervisorId matches OR where they are in supervisors array
                    const subordinatesQuery = query(
                        collection(firestore, 'employees'),
                        where('supervisorId', '==', employeeId)
                    );
                    const subordinatesSnapshot = await getDocs(subordinatesQuery);
                    const subordinateIds = subordinatesSnapshot.docs.map(doc => doc.id);

                    // Also check the new supervisors array structure
                    const allEmployeesQuery = query(collection(firestore, 'employees'));
                    const allEmployeesSnapshot = await getDocs(allEmployeesQuery);
                    allEmployeesSnapshot.docs.forEach(doc => {
                        const employee = doc.data() as EmployeeDocument;
                        if (employee.supervisors) {
                            const hasAsLeaveApprover = employee.supervisors.some(
                                sup => sup.supervisorId === employeeId && sup.isLeaveApprover
                            );
                            if (hasAsLeaveApprover && !subordinateIds.includes(doc.id)) {
                                subordinateIds.push(doc.id);
                            }
                        }
                    });

                    if (subordinateIds.length > 0) {
                        setIsSupervisor(true);
                        setSupervisedEmployeeIds(subordinateIds);
                    }
                }
            } catch (error) {
                console.error("Error fetching current employee:", error);
            }
        };

        fetchCurrentEmployee();
    }, [user]);

    // Fetch leave types from HRM settings
    React.useEffect(() => {
        const fetchLeaveTypes = async () => {
            try {
                const q = query(
                    collection(firestore, 'hrm_settings', 'leave_types', 'items'),
                    where('isActive', '==', true)
                );
                const snapshot = await getDocs(q);
                const types = snapshot.docs.map(doc => doc.data().name as string);
                types.sort((a, b) => a.localeCompare(b)); // Client-side sorting
                setAvailableLeaveTypes(types);
            } catch (error) {
                console.error("Error fetching leave types:", error);
                // Fallback to static options if fetch fails
                setAvailableLeaveTypes([...leaveTypeOptions]);
            }
        };
        fetchLeaveTypes();
    }, []);

    React.useEffect(() => {
        setIsLoading(true);

        // Build query based on role
        let leavesQuery;
        if (isHROrAdmin && (!viewTeam || !isSupervisor)) {
            // HR/Admin sees all leave applications (unless forcing team view)
            leavesQuery = query(collection(firestore, "leave_applications"), orderBy("createdAt", "desc"));
        } else if (isSupervisor && supervisedEmployeeIds.length > 0) {
            // Supervisors see only their team's leave applications
            // Firestore 'in' operator supports up to 10 values
            const chunkSize = 10;
            const chunks = [];
            for (let i = 0; i < supervisedEmployeeIds.length; i += chunkSize) {
                chunks.push(supervisedEmployeeIds.slice(i, i + chunkSize));
            }

            if (chunks.length === 1) {
                leavesQuery = query(
                    collection(firestore, "leave_applications"),
                    where("employeeId", "in", chunks[0]),
                    orderBy("createdAt", "desc")
                );
            } else {
                // If more than 10 subordinates, we'll fetch all and filter client-side
                leavesQuery = query(collection(firestore, "leave_applications"), orderBy("createdAt", "desc"));
            }
        } else {
            // Not HR/Admin and not a supervisor (or no subordinates found), show nothing
            setIsLoading(false);
            setAllLeaves([]);
            return;
        }

        const unsubscribe = onSnapshot(leavesQuery, (snapshot) => {
            let fetchedLeaves = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as LeaveApplicationDocument));

            // Client-side filter if supervisor has more than 10 subordinates
            if (((!isHROrAdmin && isSupervisor) || (isHROrAdmin && isSupervisor && viewTeam)) && supervisedEmployeeIds.length > 10) {
                fetchedLeaves = fetchedLeaves.filter(leave =>
                    supervisedEmployeeIds.includes(leave.employeeId)
                );
            }

            setAllLeaves(fetchedLeaves);
            setIsLoading(false);
            setFetchError(null);
        }, (error) => {
            console.error("Error fetching leave applications: ", error);
            setFetchError(`Failed to load data. Check console and ensure you have permission to read 'leave_applications'. Error: ${error.message}`);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [isHROrAdmin, isSupervisor, supervisedEmployeeIds]);

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

                    // Notify Employee
                    try {
                        fetch('/api/notify/leave', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'decision',
                                requestId: leaveId,
                                status: newStatus,
                                rejectionReason: newStatus === 'Rejected' ? comment : undefined
                            })
                        });
                    } catch (err) {
                        console.error("Failed to trigger decision notification", err);
                    }

                    Swal.fire('Success!', `The leave application has been ${newStatus.toLowerCase()}.`, 'success');
                } catch (error: any) {
                    Swal.fire('Error!', `Could not update the status: ${error.message}`, 'error');
                }
            }
        });
    };

    const handleDelete = (leaveId: string, employeeName: string) => {
        if (!canApprove) return;

        Swal.fire({
            title: 'Delete Application?',
            text: `Are you sure you want to delete the leave application for ${employeeName}? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'hsl(var(--destructive))',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(firestore, "leave_applications", leaveId));
                    Swal.fire('Deleted!', 'The leave application has been removed.', 'success');
                } catch (error: any) {
                    Swal.fire('Error!', `Could not delete: ${error.message}`, 'error');
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
        <div className="py-8 px-5">
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
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Apply for Leave
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {!isHROrAdmin && isSupervisor && (
                        <Alert className="mb-4">
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                You are viewing leave applications from your team members only ({supervisedEmployeeIds.length} employee{supervisedEmployeeIds.length !== 1 ? 's' : ''}).
                            </AlertDescription>
                        </Alert>
                    )}
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
                                    <Select value={filterLeaveType || ALL_LEAVE_TYPES_VALUE} onValueChange={(value) => setFilterLeaveType(value === ALL_LEAVE_TYPES_VALUE ? '' : value as LeaveType)}>
                                        <SelectTrigger id="leaveTypeFilter"><SelectValue placeholder="All Types" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_LEAVE_TYPES_VALUE}>All Types</SelectItem>
                                            {availableLeaveTypes.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="statusFilterLeave">Status</Label>
                                    <Select value={filterStatus || ALL_STATUSES_LEAVE_VALUE} onValueChange={(value) => setFilterStatus(value === ALL_STATUSES_LEAVE_VALUE ? '' : value as LeaveStatus)}>
                                        <SelectTrigger id="statusFilterLeave"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_STATUSES_LEAVE_VALUE}>All Statuses</SelectItem>
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
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onSelect={() => handleDelete(leave.id, name)}
                                                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    <span>Delete</span>
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
