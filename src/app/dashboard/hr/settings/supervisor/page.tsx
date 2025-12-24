"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Users, Search, Save, Loader2, MoreHorizontal, FileEdit, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { EmployeeDocument } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Swal from 'sweetalert2';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from 'next/navigation';


import { SupervisorManagementModal } from '@/components/dashboard/SupervisorManagementModal';
import { SupervisorConfig } from '@/types';
import { UserCog } from 'lucide-react';


export default function SupervisorSetupPage() {
    const { data: employees, isLoading, refetch } = useFirestoreQuery<EmployeeDocument[]>(query(collection(firestore, 'employees'), orderBy("employeeCode", "asc")), undefined, ['employees_supervisor_setup']);
    const [searchQuery, setSearchQuery] = useState('');
    const router = useRouter();

    const [selectedEmployeeForModal, setSelectedEmployeeForModal] = useState<EmployeeDocument | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);


    const filteredEmployees = React.useMemo(() => {
        if (!employees) return [];
        const searchLower = searchQuery.toLowerCase();
        return employees.filter(emp =>
            (emp.fullName?.toLowerCase() || '').includes(searchLower) ||
            (emp.employeeCode?.toLowerCase() || '').includes(searchLower) ||
            (emp.designation?.toLowerCase() || '').includes(searchLower)
        );
    }, [employees, searchQuery]);

    const handleDeleteEmployee = async (employeeId: string, employeeName?: string) => {
        Swal.fire({
            title: 'Are you absolutely sure?',
            text: `This action will permanently delete the employee "${employeeName || employeeId}". This cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'hsl(var(--destructive))',
            confirmButtonText: 'Yes, delete it!',
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(firestore, "employees", employeeId));
                    refetch();
                    Swal.fire('Deleted!', 'The employee has been removed.', 'success');
                } catch (error: any) {
                    Swal.fire("Error", `Could not delete employee: ${error.message}`, "error");
                }
            }
        });
    };

    const handleSaveSupervisors = async (employeeId: string, supervisors: SupervisorConfig[]) => {
        try {
            // Determine primary (legacy) supervisor and leave approver
            const directSupervisor = supervisors.find(s => s.isDirectSupervisor);
            const leaveApprover = supervisors.find(s => s.isLeaveApprover); // Or finding first one?

            // What if multiple leave approvers?
            // For legacy field 'leaveApproverId', we pick the first one marked as such, or fallback to direct supervisor.
            const primaryLeaveApproverId = leaveApprover?.supervisorId || (directSupervisor?.isLeaveApprover ? directSupervisor.supervisorId : null);

            const updateData: any = {
                supervisors: supervisors,
                supervisorId: directSupervisor ? directSupervisor.supervisorId : null,
                leaveApproverId: primaryLeaveApproverId, // Legacy support
                updatedAt: serverTimestamp()
            };

            await updateDoc(doc(firestore, 'employees', employeeId), updateData);

            Swal.fire({
                title: 'Saved',
                text: 'Supervisors updated successfully',
                icon: 'success',
                timer: 1000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
            refetch(); // Refresh to show updates

        } catch (error: any) {
            console.error("Error saving supervisors:", error);
            Swal.fire('Error', `Failed to update: ${error.message}`, 'error');
            throw error; // Rethrow so modal knows it failed
        }
    };

    const openSupervisorModal = (employee: EmployeeDocument) => {
        setSelectedEmployeeForModal(employee);
        setIsModalOpen(true);
    };

    return (
        <div className="container mx-auto py-8 px-5">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard/hr/settings">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
                        <Users className="h-8 w-8" />
                        Supervisor Setup
                    </h1>
                    <p className="text-muted-foreground">Assign direct supervisors to employees.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Employee List</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search employees..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Supervisor Overview</TableHead>
                                    <TableHead className="w-[150px] text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8">
                                            <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredEmployees && filteredEmployees.length > 0 ? (
                                    filteredEmployees.map((employee) => {
                                        // Display Logic
                                        const directSupId = employee.supervisorId; // Legacy or from array sync
                                        const directSup = employees?.find(e => e.id === directSupId);
                                        const count = employee.supervisors?.length || (employee.supervisorId ? 1 : 0);

                                        return (
                                            <TableRow key={employee.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={employee.photoURL} alt={employee.fullName} />
                                                            <AvatarFallback>{employee.fullName?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div>{employee.fullName}</div>
                                                            <div className="text-xs text-muted-foreground">{employee.employeeCode}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{employee.designation}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        {directSup ? (
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <span className="font-semibold text-primary">Direct:</span>
                                                                {directSup.fullName}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm italic">No Direct Supervisor</span>
                                                        )}
                                                        {count > 1 && (
                                                            <span className="text-xs text-muted-foreground">+ {count - 1} other(s)</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => openSupervisorModal(employee)}
                                                            className="h-8 gap-2"
                                                        >
                                                            <UserCog className="h-4 w-4" />
                                                            Manage
                                                        </Button>

                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <span className="sr-only">Open menu</span>
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/hr/employees/edit/${employee.id}`)}>
                                                                    <FileEdit className="mr-2 h-4 w-4" />
                                                                    <span>Edit Employee</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => handleDeleteEmployee(employee.id, employee.fullName)}
                                                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    <span>Delete Employee</span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                            No employees found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <SupervisorManagementModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                employee={selectedEmployeeForModal}
                allEmployees={employees || []}
                onSave={handleSaveSupervisors}
            />
        </div>
    );
}
