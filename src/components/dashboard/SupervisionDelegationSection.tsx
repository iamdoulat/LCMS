"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, doc, setDoc, serverTimestamp, deleteDoc, getDocs, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { EmployeeDocument, SupervisionDelegation } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Save, Trash2, UserPlus, ShieldAlert } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { clearSupervisorCache } from '@/hooks/useSupervisorCheck';

export function SupervisionDelegationSection() {
    const { user } = useAuth();
    const { data: employees, isLoading: isEmployeesLoading } = useFirestoreQuery<EmployeeDocument[]>(
        query(collection(firestore, 'employees'), orderBy("fullName", "asc")),
        undefined,
        ['employees_for_delegation']
    );

    const { data: delegations, isLoading: isDelegationsLoading, refetch: refetchDelegations } = useFirestoreQuery<SupervisionDelegation[]>(
        query(collection(firestore, 'supervision_delegations')),
        undefined,
        ['supervision_delegations_list']
    );

    const [selectedDelegatorId, setSelectedDelegatorId] = useState<string>('');
    const [selectedDelegateId, setSelectedDelegateId] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    // Filter supervisors: Anyone who has subordinates or the supervisor role
    // For simplicity, we can show all employees but highlight those who are already supervisors
    // Or just show everyone as the user requested "all list of Supervisor" (implying filtering)
    const supervisors = React.useMemo(() => {
        if (!employees) return [];
        return employees.filter(emp => 
            emp.supervisorId || 
            (emp.supervisors && emp.supervisors.length > 0) || 
            (emp.role && emp.role.includes('Supervisor'))
        );
    }, [employees]);

    const handleSaveDelegation = async () => {
        if (!selectedDelegatorId || !selectedDelegateId) {
            Swal.fire('Error', 'Please select both delegator and delegate', 'error');
            return;
        }

        if (selectedDelegatorId === selectedDelegateId) {
            Swal.fire('Error', 'Delegator and Delegate cannot be the same person', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const delegator = employees?.find(e => e.id === selectedDelegatorId);
            const delegate = employees?.find(e => e.id === selectedDelegateId);

            if (!delegator || !delegate) throw new Error("Employee not found");

            const delegationId = `${selectedDelegatorId}_${selectedDelegateId}`;
            const newDelegation: Partial<SupervisionDelegation> = {
                delegatorId: selectedDelegatorId,
                delegatorName: delegator.fullName,
                delegateId: selectedDelegateId,
                delegateName: delegate.fullName,
                status: 'active',
                assignedAt: serverTimestamp(),
                assignedBy: user?.email || 'System'
            };

            await setDoc(doc(firestore, 'supervision_delegations', delegationId), newDelegation);
            
            clearSupervisorCache();

            Swal.fire({
                title: 'Success',
                text: 'Supervision power delegated successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });

            setSelectedDelegatorId('');
            setSelectedDelegateId('');
            refetchDelegations();
        } catch (error: any) {
            console.error("Error saving delegation:", error);
            Swal.fire('Error', `Failed to save delegation: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteDelegation = async (delegationId: string) => {
        const result = await Swal.fire({
            title: 'Remove Delegation?',
            text: "This will restore the original supervisor's powers.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, remove it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(firestore, 'supervision_delegations', delegationId));
                clearSupervisorCache();
                Swal.fire('Removed!', 'Delegation has been removed.', 'success');
                refetchDelegations();
            } catch (error: any) {
                Swal.fire('Error', `Failed to remove: ${error.message}`, 'error');
            }
        }
    };

    return (
        <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                    <ShieldAlert className="h-6 w-6 text-primary" />
                    Supervision Delegation
                </CardTitle>
                <CardDescription>
                    Delegate all supervision power from one employee to another. 
                    The delegator's power will be hidden while the delegation is active.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Delegator Column */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Select Supervisor (Delegator)</label>
                        <Select value={selectedDelegatorId} onValueChange={setSelectedDelegatorId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Supervisor" />
                            </SelectTrigger>
                            <SelectContent>
                                {supervisors.map((emp) => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={emp.photoURL} />
                                                <AvatarFallback>{emp.fullName?.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                            </Avatar>
                                            <span>{emp.fullName} ({emp.employeeCode})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Delegate Column */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Select Employee (Delegate)</label>
                        <Select value={selectedDelegateId} onValueChange={setSelectedDelegateId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Delegate" />
                            </SelectTrigger>
                            <SelectContent>
                                {employees?.map((emp) => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                         <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={emp.photoURL} />
                                                <AvatarFallback>{emp.fullName?.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                            </Avatar>
                                            <span>{emp.fullName} ({emp.employeeCode})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex justify-end mb-8">
                    <Button 
                        onClick={handleSaveDelegation} 
                        disabled={isSaving || !selectedDelegatorId || !selectedDelegateId}
                        className="gap-2"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Delegation
                    </Button>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Active Delegations</h3>
                    <div className="rounded-md border bg-background">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Delegator (Powers from)</TableHead>
                                    <TableHead>Delegate (Powers to)</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Assigned On</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isDelegationsLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-4">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : delegations && delegations.length > 0 ? (
                                    delegations.map((del) => (
                                        <TableRow key={del.id || `${del.delegatorId}_${del.delegateId}`}>
                                            <TableCell className="font-medium">{del.delegatorName}</TableCell>
                                            <TableCell>{del.delegateName}</TableCell>
                                            <TableCell>
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                    {del.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {del.assignedAt?.toDate ? del.assignedAt.toDate().toLocaleDateString() : 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => handleDeleteDelegation(del.id || `${del.delegatorId}_${del.delegateId}`)}
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground italic">
                                            No active delegations found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
