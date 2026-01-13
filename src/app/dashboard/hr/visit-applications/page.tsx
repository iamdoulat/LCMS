
"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, AlertTriangle, Info, Edit, Trash2, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { firestore } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { VisitApplicationDocument, VisitStatus } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const formatDisplayDate = (dateString: string): string => {
    try {
        const date = parseISO(dateString);
        return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
    } catch {
        return 'Invalid Date';
    }
};

const getStatusBadgeVariant = (status: VisitStatus) => {
    switch (status) {
        case 'Approved': return 'default';
        case 'Pending': return 'secondary';
        case 'Rejected': return 'destructive';
        default: return 'outline';
    }
};

export default function VisitApplicationListPage() {
    const { user, userRole } = useAuth();
    const { isSupervisor, supervisedEmployeeIds } = useSupervisorCheck(user?.email);
    const isHROrAdmin = userRole?.some(role => ['Super Admin', 'Admin', 'HR'].includes(role));
    const router = useRouter();
    const [applications, setApplications] = React.useState<VisitApplicationDocument[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [fetchError, setFetchError] = React.useState<string | null>(null);
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 10;

    const isReadOnly = userRole?.includes('Viewer');

    React.useEffect(() => {
        const applicationsQuery = query(collection(firestore, "visit_applications"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(applicationsQuery, (snapshot) => {
            const fetchedApplications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as VisitApplicationDocument));
            setApplications(fetchedApplications);
            setIsLoading(false);
            setFetchError(null);
        }, (error) => {
            console.error("Error fetching visit applications: ", error);
            setFetchError(`Failed to load data. Error: ${error.message}`);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const filteredApplications = React.useMemo(() => {
        if (isHROrAdmin) return applications;
        if (isSupervisor) {
            return applications.filter(app => supervisedEmployeeIds.includes(app.employeeId));
        }
        return [];
    }, [applications, isHROrAdmin, isSupervisor, supervisedEmployeeIds]);

    // Reset page when data changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [filteredApplications.length]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentApplications = filteredApplications.slice(indexOfFirstItem, indexOfLastItem);

    const nextPage = () => {
        if (currentPage < totalPages) setCurrentPage(curr => curr + 1);
    };

    const prevPage = () => {
        if (currentPage > 1) setCurrentPage(curr => curr - 1);
    };


    const handleDelete = async (id: string, employeeName: string) => {
        if (isReadOnly) return;
        Swal.fire({
            title: 'Are you sure?',
            text: `This will permanently delete the visit application for ${employeeName}.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'hsl(var(--destructive))',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(firestore, "visit_applications", id));
                    Swal.fire('Deleted!', 'The application has been deleted.', 'success');
                } catch (e: any) {
                    Swal.fire('Error!', `Could not delete the application: ${e.message}`, 'error');
                }
            }
        });
    };

    const handleEdit = (id: string) => {
        router.push(`/dashboard/hr/visit-applications/edit/${id}`);
    };

    return (
        <div className="py-8 px-5">
            <Card className="shadow-xl">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                                Visit Applications
                            </CardTitle>
                            <CardDescription>View and manage employee visit applications.</CardDescription>
                        </div>
                        <Button asChild disabled={isReadOnly}>
                            <Link href="/dashboard/hr/visit-applications/add">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Apply for Visit
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {!isHROrAdmin && isSupervisor && (
                        <Alert className="mb-4">
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                You are viewing visit applications from your team members only.
                            </AlertDescription>
                        </Alert>
                    )}
                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : fetchError ? (
                        <div className="text-destructive-foreground bg-destructive/10 p-4 rounded-md text-center">
                            <AlertTriangle className="mx-auto mb-2 h-8 w-8" />
                            <p className="font-semibold">Error Loading Applications</p>
                            <p className="text-sm">{fetchError}</p>
                        </div>
                    ) : filteredApplications.length === 0 ? (
                        <div className="text-muted-foreground text-center py-10">
                            <Info className="mx-auto mb-2 h-10 w-10" />
                            <p className="font-semibold">No Visit Applications Found</p>
                            <p className="text-sm">Click "Apply for Visit" to get started.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>Employee Name</TableHead>
                                        <TableHead>From</TableHead>
                                        <TableHead>To</TableHead>
                                        <TableHead>Days</TableHead>
                                        <TableHead>Remarks</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Approver Comments</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentApplications.map((app, index) => (
                                        <TableRow key={app.id}>
                                            <TableCell>{indexOfFirstItem + index + 1}</TableCell>

                                            <TableCell className="font-medium">{app.employeeName}</TableCell>
                                            <TableCell>{formatDisplayDate(app.fromDate)}</TableCell>
                                            <TableCell>{formatDisplayDate(app.toDate)}</TableCell>
                                            <TableCell>{app.day}</TableCell>
                                            <TableCell className="max-w-xs truncate" title={app.remarks}>{app.remarks}</TableCell>
                                            <TableCell><Badge variant={getStatusBadgeVariant(app.status)}>{app.status}</Badge></TableCell>
                                            <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={app.approverComment}>{app.approverComment || 'N/A'}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isReadOnly}>
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleEdit(app.id)}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            <span>Edit/Approve</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(app.id, app.employeeName)}
                                                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                            disabled={isReadOnly}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            <span>Delete</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {!isLoading && filteredApplications.length > itemsPerPage && (
                        <div className="flex flex-col md:grid md:grid-cols-3 items-center gap-4 py-4 px-2 border-t mt-4">
                            <div className="text-sm text-muted-foreground text-center md:text-left order-2 md:order-1">
                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredApplications.length)} of {filteredApplications.length} entries
                            </div>
                            <div className="flex items-center justify-center gap-2 order-1 md:order-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={prevPage}
                                    disabled={currentPage === 1}
                                    className="h-9"
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Previous
                                </Button>
                                <div className="flex items-center gap-1 min-w-[5rem] justify-center text-sm font-medium">
                                    Page {currentPage} of {totalPages}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={nextPage}
                                    disabled={currentPage === totalPages}
                                    className="h-9"
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                            <div className="hidden md:block md:order-3" />
                        </div>
                    )}
                </CardContent>

            </Card>
        </div>
    );
}
