
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, PlusCircle, Trash2, Edit, MoreHorizontal, Building, Loader2, Users, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, deleteDoc, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { AttendanceReconciliationSchema, type AttendanceReconciliationConfiguration, type MultipleCheckInOutConfiguration } from '@/types';
import type { DesignationDocument, BranchDocument, DepartmentDocument, UnitDocument, DivisionDocument } from '@/types';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { AddDesignationForm } from '@/components/forms/AddDesignationForm';
import { EditDesignationForm } from '@/components/forms/EditDesignationForm';
import { AddDepartmentForm } from '@/components/forms/AddDepartmentForm';
import { EditDepartmentForm } from '@/components/forms/EditDepartmentForm';
import { AddUnitForm } from '@/components/forms/AddUnitForm';
import { EditUnitForm } from '@/components/forms/EditUnitForm';
import { AddDivisionForm } from '@/components/forms/AddDivisionForm';
import { EditDivisionForm } from '@/components/forms/EditDivisionForm';
import { AddLeaveTypeForm } from '@/components/forms/AddLeaveTypeForm';
import { EditLeaveTypeForm } from '@/components/forms/EditLeaveTypeForm';
import { AddLeaveGroupForm } from '@/components/forms/AddLeaveGroupForm';
import { EditLeaveGroupForm } from '@/components/forms/EditLeaveGroupForm';
import type { LeaveTypeDefinition, LeaveGroupDocument } from '@/types';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { Skeleton } from '@/components/ui/skeleton';
import { BranchListTable } from '@/components/dashboard/hr/BranchListTable';


const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right w-[50px]">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
                {Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);


export default function HrmSettingsPage() {
    const { userRole } = useAuth();
    const isReadOnly = userRole?.includes('Viewer');

    const { data: designations, isLoading: isLoadingDesignations } = useFirestoreQuery<DesignationDocument[]>(query(collection(firestore, 'designations'), orderBy("name", "asc")), undefined, ['designations']);
    const { data: branches, isLoading: isLoadingBranches } = useFirestoreQuery<BranchDocument[]>(query(collection(firestore, 'branches'), orderBy("name", "asc")), undefined, ['branches']);
    const { data: departments, isLoading: isLoadingDepts } = useFirestoreQuery<DepartmentDocument[]>(query(collection(firestore, 'departments'), orderBy("name", "asc")), undefined, ['departments']);
    const { data: units, isLoading: isLoadingUnits } = useFirestoreQuery<UnitDocument[]>(query(collection(firestore, 'units'), orderBy("name", "asc")), undefined, ['units']);
    const { data: divisions, isLoading: isLoadingDivisions } = useFirestoreQuery<DivisionDocument[]>(query(collection(firestore, 'divisions'), orderBy("name", "asc")), undefined, ['divisions']);

    const [isAddDivisionDialogOpen, setIsAddDivisionDialogOpen] = React.useState(false);
    const [isAddDepartmentDialogOpen, setIsAddDepartmentDialogOpen] = React.useState(false);
    const [isAddUnitDialogOpen, setIsAddUnitDialogOpen] = React.useState(false);
    const [isAddDesignationDialogOpen, setIsAddDesignationDialogOpen] = React.useState(false);

    const [editingDivision, setEditingDivision] = React.useState<DivisionDocument | null>(null);
    const [isEditDivisionDialogOpen, setIsEditDivisionDialogOpen] = React.useState(false);

    const [editingDepartment, setEditingDepartment] = React.useState<DepartmentDocument | null>(null);
    const [isEditDepartmentDialogOpen, setIsEditDepartmentDialogOpen] = React.useState(false);

    const [editingUnit, setEditingUnit] = React.useState<UnitDocument | null>(null);
    const [isEditUnitDialogOpen, setIsEditUnitDialogOpen] = React.useState(false);

    const [editingDesignation, setEditingDesignation] = React.useState<DesignationDocument | null>(null);
    const [isEditDesignationDialogOpen, setIsEditDesignationDialogOpen] = React.useState(false);

    // Leave Types State
    const { data: leaveTypes, isLoading: isLoadingLeaveTypes } = useFirestoreQuery<LeaveTypeDefinition[]>(query(collection(firestore, 'hrm_settings', 'leave_types', 'items'), orderBy("name", "asc")), undefined, ['leave_types']);
    const [isAddLeaveTypeDialogOpen, setIsAddLeaveTypeDialogOpen] = React.useState(false);
    const [editingLeaveType, setEditingLeaveType] = React.useState<LeaveTypeDefinition | null>(null);
    const [isEditLeaveTypeDialogOpen, setIsEditLeaveTypeDialogOpen] = React.useState(false);

    // Leave Groups State
    const { data: leaveGroups, isLoading: isLoadingLeaveGroups } = useFirestoreQuery<LeaveGroupDocument[]>(query(collection(firestore, 'hrm_settings', 'leave_groups', 'items'), orderBy("groupName", "asc")), undefined, ['leave_groups']);
    const [isAddLeaveGroupDialogOpen, setIsAddLeaveGroupDialogOpen] = React.useState(false);
    const [editingLeaveGroup, setEditingLeaveGroup] = React.useState<LeaveGroupDocument | null>(null);
    const [isEditLeaveGroupDialogOpen, setIsEditLeaveGroupDialogOpen] = React.useState(false);

    // Attendance Reconciliation Configuration State
    const [reconConfig, setReconConfig] = React.useState<AttendanceReconciliationConfiguration>({
        limitType: 'days',
        maxDaysLimit: 30,
        maxDateOfCurrentMonth: 2,
    });
    const [isSavingRecon, setIsSavingRecon] = React.useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(firestore, 'hrm_settings', 'attendance_reconciliation'), (docSnap) => {
            if (docSnap.exists()) {
                setReconConfig(docSnap.data() as AttendanceReconciliationConfiguration);
            }
        });
        return () => unsub();
    }, []);

    // Multi Check In/Out Configuration State
    const [multiCheckConfig, setMultiCheckConfig] = React.useState<MultipleCheckInOutConfiguration>({
        isCompanyNameMandatory: true,
        isCheckInImageMandatory: true,
        isCheckOutImageMandatory: true,
        isMultipleCheckInAllowedWithoutCheckOut: false,
        isMultipleCheckOutAllowedAgainstSingleCheckIn: false,
        maxHourLimitOfCheckOut: 24,
    });
    const [isSavingMultiCheck, setIsSavingMultiCheck] = React.useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(firestore, 'hrm_settings', 'multi_check_in_out'), (docSnap) => {
            if (docSnap.exists()) {
                setMultiCheckConfig(docSnap.data() as MultipleCheckInOutConfiguration);
            }
        });
        return () => unsub();
    }, []);

    const handleSaveMultiCheck = async () => {
        if (isReadOnly) return;
        setIsSavingMultiCheck(true);
        try {
            const dataToSave = {
                ...multiCheckConfig,
                updatedAt: serverTimestamp(),
            };
            await setDoc(doc(firestore, 'hrm_settings', 'multi_check_in_out'), dataToSave, { merge: true });
            Swal.fire({
                title: 'Saved',
                text: 'Multiple Check In/Out Configuration updated.',
                icon: 'success',
                timer: 1000,
                showConfirmButton: false
            });
        } catch (error: any) {
            Swal.fire('Error', `Failed to save: ${error.message}`, 'error');
        } finally {
            setIsSavingMultiCheck(false);
        }
    };

    const handleSaveRecon = async () => {
        if (isReadOnly) return;
        setIsSavingRecon(true);
        try {
            const dataToSave = {
                ...reconConfig,
                updatedAt: serverTimestamp(),
            };
            await setDoc(doc(firestore, 'hrm_settings', 'attendance_reconciliation'), dataToSave, { merge: true });
            Swal.fire({
                title: 'Saved',
                text: 'Attendance Reconciliation Configuration updated.',
                icon: 'success',
                timer: 1000,
                showConfirmButton: false
            });
        } catch (error: any) {
            Swal.fire('Error', `Failed to save: ${error.message}`, 'error');
        } finally {
            setIsSavingRecon(false);
        }
    };


    const handleEdit = (item: any, setEditingItem: React.Dispatch<any>, setIsEditDialogOpen: React.Dispatch<any>) => {
        setEditingItem(item);
        setIsEditDialogOpen(true);
    };

    const handleDelete = async (collectionName: string, docId: string, docName: string) => {
        if (isReadOnly) return;
        Swal.fire({
            title: `Delete '${docName}'?`,
            text: "This will permanently delete the item.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'hsl(var(--destructive))',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(firestore, collectionName, docId));
                    Swal.fire({
                        title: 'Deleted!',
                        text: `'${docName}' has been removed.`,
                        icon: 'success',
                        timer: 1000,
                        showConfirmButton: false
                    });
                } catch (error: any) {
                    Swal.fire('Error!', `Could not delete item: ${error.message}`, 'error');
                }
            }
        });
    };

    const handleDeleteDesignation = async (id: string) => {
        handleDelete('designations', id, 'Designation');
    };

    const handleDeleteLeaveType = async (id: string) => {
        handleDelete('hrm_settings/leave_types/items', id, 'Leave Type');
    };

    const handleDeleteLeaveGroup = async (id: string) => {
        handleDelete('hrm_settings/leave_groups/items', id, 'Leave Group');
    };

    const renderTableSection = (
        title: string,
        description: string,
        data: any[] | undefined,
        isLoading: boolean,
        onAddClick: () => void,
        onEditClick: (item: any) => void,
        collectionName: string,
        className?: string
    ) => (
        <Card className={className}>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary" />{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
                <Button size="sm" disabled={isReadOnly} onClick={onAddClick}><PlusCircle className="mr-2 h-4 w-4" />Add New</Button>
            </CardHeader>
            <CardContent>
                {isLoading ? <DataTableSkeleton /> :
                    !data || data.length === 0 ? <div className="text-muted-foreground text-center p-4">No data found.</div> :
                        (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right w-[50px]">Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {data.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell>{item.name}</TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => onEditClick(item)} disabled={isReadOnly}><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleDelete(collectionName, item.id, item.name)} className="text-destructive focus:text-destructive" disabled={isReadOnly}><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
            </CardContent>
        </Card>
    );

    return (
        <div className="container mx-auto py-8 px-5">
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                        <Settings className="h-7 w-7 text-primary" />
                        HRM And Payroll Settings
                    </CardTitle>
                    <CardDescription>
                        Manage core settings for the Human Resource Management module.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Attendance Reconciliation Configuration Section */}
                    <Card className="md:col-span-2 shadow-lg border-2 border-primary/10">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Settings className="h-5 w-5 text-primary" />
                                Attendance Reconciliation Configuration
                            </CardTitle>
                            <CardDescription>
                                Configure limits for attendance reconciliation requests.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <RadioGroup
                                value={reconConfig.limitType}
                                onValueChange={(val: 'days' | 'month') => setReconConfig(prev => ({ ...prev, limitType: val }))}
                                className="flex gap-4"
                                disabled={isReadOnly}
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="days" id="limit-days" />
                                    <Label htmlFor="limit-days" className="cursor-pointer">Limit for previous days</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="month" id="limit-month" />
                                    <Label htmlFor="limit-month" className="cursor-pointer">Limit for previous month</Label>
                                </div>
                            </RadioGroup>

                            <div className="grid grid-cols-1 md:grid-cols-1 gap-6 pt-2">
                                {reconConfig.limitType === 'days' ? (
                                    <div className="space-y-2 group">
                                        <Label className="text-sm font-semibold group-hover:text-primary transition-colors">Maximum Days Limit of Previous Attendance Reconciliation</Label>
                                        <Input
                                            type="number"
                                            value={reconConfig.maxDaysLimit}
                                            onChange={(e) => setReconConfig(prev => ({ ...prev, maxDaysLimit: parseInt(e.target.value) || 0 }))}
                                            placeholder="e.g. 30"
                                            disabled={isReadOnly}
                                            className="focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-2 group">
                                        <Label className="text-sm font-semibold group-hover:text-primary transition-colors">Maximum date of current month to apply for previous month's reconciliation</Label>
                                        <Input
                                            type="number"
                                            value={reconConfig.maxDateOfCurrentMonth}
                                            onChange={(e) => setReconConfig(prev => ({ ...prev, maxDateOfCurrentMonth: parseInt(e.target.value) || 0 }))}
                                            placeholder="e.g. 2"
                                            disabled={isReadOnly}
                                            className="focus:ring-2 focus:ring-primary/20"
                                            min={1}
                                            max={31}
                                        />
                                    </div>
                                )}

                                <div className="space-y-2 group">
                                    <Label className="text-sm font-semibold group-hover:text-primary transition-colors">Maximum Monthly Attendance Reconciliation Limit for an Employee</Label>
                                    <Input
                                        type="number"
                                        value={reconConfig.maxMonthlyLimitPerEmployee || ''}
                                        onChange={(e) => setReconConfig(prev => ({ ...prev, maxMonthlyLimitPerEmployee: e.target.value ? parseInt(e.target.value) : undefined }))}
                                        placeholder="No limit"
                                        disabled={isReadOnly}
                                        className="focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button
                                    onClick={handleSaveRecon}
                                    disabled={isSavingRecon || isReadOnly}
                                    className="px-8 shadow-md hover:shadow-lg active:scale-95 transition-all"
                                >
                                    {isSavingRecon ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                                    ) : (
                                        'Save'
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Multiple Check In / Check Out Configuration Section */}
                    <Card className="md:col-span-2 shadow-lg border-2 border-primary/10">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Settings className="h-5 w-5 text-primary" />
                                Multiple Check In / Check Out Configuration
                            </CardTitle>
                            <CardDescription>
                                Configure behavior and requirements for Multiple Check In/Out visits.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-3">
                                        <Checkbox
                                            id="isCompanyNameMandatory"
                                            checked={multiCheckConfig.isCompanyNameMandatory}
                                            onCheckedChange={(checked) => setMultiCheckConfig(prev => ({ ...prev, isCompanyNameMandatory: !!checked }))}
                                            disabled={isReadOnly}
                                        />
                                        <Label htmlFor="isCompanyNameMandatory" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                            Is visited company name mandatory
                                        </Label>
                                    </div>

                                    <div className="flex items-center space-x-3">
                                        <Checkbox
                                            id="isCheckInImageMandatory"
                                            checked={multiCheckConfig.isCheckInImageMandatory}
                                            onCheckedChange={(checked) => setMultiCheckConfig(prev => ({ ...prev, isCheckInImageMandatory: !!checked }))}
                                            disabled={isReadOnly}
                                        />
                                        <Label htmlFor="isCheckInImageMandatory" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                            Is check in image mandatory
                                        </Label>
                                    </div>

                                    <div className="flex items-center space-x-3">
                                        <Checkbox
                                            id="isMultipleCheckInAllowedWithoutCheckOut"
                                            checked={multiCheckConfig.isMultipleCheckInAllowedWithoutCheckOut}
                                            onCheckedChange={(checked) => setMultiCheckConfig(prev => ({ ...prev, isMultipleCheckInAllowedWithoutCheckOut: !!checked }))}
                                            disabled={isReadOnly}
                                        />
                                        <Label htmlFor="isMultipleCheckInAllowedWithoutCheckOut" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                            Is multiple check in allowed without providing check out
                                        </Label>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-[18px] h-[18px]" /> {/* Spacer to align with left col if needed, though they align fine */}
                                    </div>

                                    <div className="flex items-center space-x-3">
                                        <Checkbox
                                            id="isCheckOutImageMandatory"
                                            checked={multiCheckConfig.isCheckOutImageMandatory}
                                            onCheckedChange={(checked) => setMultiCheckConfig(prev => ({ ...prev, isCheckOutImageMandatory: !!checked }))}
                                            disabled={isReadOnly}
                                        />
                                        <Label htmlFor="isCheckOutImageMandatory" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                            Is check out image mandatory
                                        </Label>
                                    </div>

                                    <div className="flex items-center space-x-3">
                                        <Checkbox
                                            id="isMultipleCheckOutAllowedAgainstSingleCheckIn"
                                            checked={multiCheckConfig.isMultipleCheckOutAllowedAgainstSingleCheckIn}
                                            onCheckedChange={(checked) => setMultiCheckConfig(prev => ({ ...prev, isMultipleCheckOutAllowedAgainstSingleCheckIn: !!checked }))}
                                            disabled={isReadOnly}
                                        />
                                        <Label htmlFor="isMultipleCheckOutAllowedAgainstSingleCheckIn" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                            Is multiple check out allowed against single check in
                                        </Label>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 space-y-2 group">
                                <Label className="text-sm font-semibold group-hover:text-primary transition-colors">Max Hour Limit of Check Out from Check In</Label>
                                <Input
                                    type="number"
                                    value={multiCheckConfig.maxHourLimitOfCheckOut}
                                    onChange={(e) => setMultiCheckConfig(prev => ({ ...prev, maxHourLimitOfCheckOut: parseInt(e.target.value) || 0 }))}
                                    placeholder="e.g. 24"
                                    disabled={isReadOnly}
                                    className="focus:ring-2 focus:ring-primary/20 max-w-[200px]"
                                />
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button
                                    onClick={handleSaveMultiCheck}
                                    disabled={isSavingMultiCheck || isReadOnly}
                                    className="px-8 shadow-md hover:shadow-lg active:scale-95 transition-all"
                                >
                                    {isSavingMultiCheck ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                                    ) : (
                                        'Save'
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Branches Section */}
                    <Card className="md:col-span-2 shadow-lg border-t-4 border-t-primary">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary" />Branches</CardTitle>
                            <CardDescription>Manage your company branches and office locations.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <BranchListTable
                                data={branches || []}
                                isLoading={isLoadingBranches}
                                onDelete={(id: string, name: string) => handleDelete('branches', id, name)}
                                userRole={userRole?.[0]}
                            />
                        </CardContent>
                    </Card>

                    {/* Hotspot Setup Section */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                Hotspot Setup
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center">
                                <div className="text-2xl font-bold">Manage</div>
                                <Button asChild size="sm" variant="outline">
                                    <Link href="/dashboard/hr/settings/hotspots">Open</Link>
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Configure geofenced hotspots</p>
                        </CardContent>
                    </Card>

                    <Dialog open={isAddDepartmentDialogOpen} onOpenChange={setIsAddDepartmentDialogOpen}>
                        {renderTableSection("Departments", "Manage company departments.", departments, isLoadingDepts, () => setIsAddDepartmentDialogOpen(true), (item) => handleEdit(item, setEditingDepartment, setIsEditDepartmentDialogOpen), "departments")}
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add New Department</DialogTitle>
                                <DialogDescription>Create a new company department.</DialogDescription>
                            </DialogHeader>
                            <AddDepartmentForm onFormSubmit={() => setIsAddDepartmentDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>

                    {/* Supervisor Setup Section */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                Supervisor Setup
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center">
                                <div className="text-2xl font-bold">Manage</div>
                                <Button asChild size="sm" variant="outline">
                                    <Link href="/dashboard/hr/settings/supervisor">Open</Link>
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Assign supervisors to employees</p>
                        </CardContent>
                    </Card>

                    {/* Device Change Requests Section */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Smartphone className="h-4 w-4 text-muted-foreground" />
                                Device Change Requests
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center">
                                <div className="text-2xl font-bold">Manage</div>
                                <Button asChild size="sm" variant="outline">
                                    <Link href="/dashboard/hr/device-change-requests">Open</Link>
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Review and approve employee device changes</p>
                        </CardContent>
                    </Card>

                    {/* Designations Section */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary" />Designations</CardTitle>
                                <CardDescription>Manage employee job designations.</CardDescription>
                            </div>
                            <Button size="sm" disabled={isReadOnly} onClick={() => setIsAddDesignationDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />Add New</Button>
                        </CardHeader>
                        <CardContent>
                            {isLoadingDesignations ? <DataTableSkeleton /> :
                                !designations || designations.length === 0 ? <div className="text-muted-foreground text-center p-4">No data found.</div> :
                                    (
                                        <div className="rounded-md border">
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right w-[50px]">Actions</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {designations.map(item => (
                                                        <TableRow key={item.id}>
                                                            <TableCell>{item.name}</TableCell>
                                                            <TableCell className="text-right">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                        <DropdownMenuItem onClick={() => handleEdit(item, setEditingDesignation, setIsEditDesignationDialogOpen)} disabled={isReadOnly}><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem onClick={() => handleDeleteDesignation(item.id)} className="text-destructive focus:text-destructive" disabled={isReadOnly}><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                        </CardContent>
                    </Card>

                    {/* Leave Types Section */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary" />Leave Types</CardTitle>
                                <CardDescription>Manage types of leaves available</CardDescription>
                            </div>
                            <Button size="sm" disabled={isReadOnly} onClick={() => setIsAddLeaveTypeDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />Add New</Button>
                        </CardHeader>
                        <CardContent>
                            {isLoadingLeaveTypes ? <DataTableSkeleton /> :
                                !leaveTypes || leaveTypes.length === 0 ? <div className="text-muted-foreground text-center p-4">No data found.</div> :
                                    (
                                        <div className="rounded-md border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead>Code</TableHead>
                                                        <TableHead>Active</TableHead>
                                                        <TableHead className="text-right w-[50px]">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {leaveTypes.map(item => (
                                                        <TableRow key={item.id}>
                                                            <TableCell>{item.name}</TableCell>
                                                            <TableCell>{item.code}</TableCell>
                                                            <TableCell>{item.isActive ? 'Yes' : 'No'}</TableCell>
                                                            <TableCell className="text-right">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                        <DropdownMenuItem onClick={() => handleEdit(item, setEditingLeaveType, setIsEditLeaveTypeDialogOpen)} disabled={isReadOnly}><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem onClick={() => handleDeleteLeaveType(item.id)} className="text-destructive focus:text-destructive" disabled={isReadOnly}><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                        </CardContent>
                    </Card>

                    {/* Leave Groups Section */}
                    <Card className="md:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary" />Leave Groups</CardTitle>
                                <CardDescription>Manage leave policies via groups</CardDescription>
                            </div>
                            <Button size="sm" disabled={isReadOnly} onClick={() => setIsAddLeaveGroupDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />Add New</Button>
                        </CardHeader>
                        <CardContent>
                            {isLoadingLeaveGroups ? <DataTableSkeleton /> :
                                !leaveGroups || leaveGroups.length === 0 ? <div className="text-muted-foreground text-center p-4">No data found.</div> :
                                    (
                                        <div className="rounded-md border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Group Name</TableHead>
                                                        <TableHead>Policies Count</TableHead>
                                                        <TableHead>Active</TableHead>
                                                        <TableHead className="text-right w-[50px]">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {leaveGroups.map(item => (
                                                        <TableRow key={item.id}>
                                                            <TableCell>{item.groupName}</TableCell>
                                                            <TableCell>{item.policies?.length || 0}</TableCell>
                                                            <TableCell>{item.isActive ? 'Yes' : 'No'}</TableCell>
                                                            <TableCell className="text-right">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                        <DropdownMenuItem onClick={() => handleEdit(item, setEditingLeaveGroup, setIsEditLeaveGroupDialogOpen)} disabled={isReadOnly}><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem onClick={() => handleDeleteLeaveGroup(item.id)} className="text-destructive focus:text-destructive" disabled={isReadOnly}><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                        </CardContent>
                    </Card>

                    <Dialog open={isAddDivisionDialogOpen} onOpenChange={setIsAddDivisionDialogOpen}>
                        {renderTableSection("Divisions", "Manage company divisions.", divisions, isLoadingDivisions, () => setIsAddDivisionDialogOpen(true), (item) => handleEdit(item, setEditingDivision, setIsEditDivisionDialogOpen), "divisions")}
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add New Division</DialogTitle>
                                <DialogDescription>Create a new company division.</DialogDescription>
                            </DialogHeader>
                            <AddDivisionForm onFormSubmit={() => setIsAddDivisionDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isAddUnitDialogOpen} onOpenChange={setIsAddUnitDialogOpen}>
                        {renderTableSection("Units", "Manage organizational units.", units, isLoadingUnits, () => setIsAddUnitDialogOpen(true), (item) => handleEdit(item, setEditingUnit, setIsEditUnitDialogOpen), "units")}
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add New Unit</DialogTitle>
                                <DialogDescription>Create a new organizational unit.</DialogDescription>
                            </DialogHeader>
                            <AddUnitForm onFormSubmit={() => setIsAddUnitDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>

            {editingDivision && (
                <Dialog open={isEditDivisionDialogOpen} onOpenChange={setIsEditDivisionDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit Division</DialogTitle>
                            <DialogDescription>Update the details for this division.</DialogDescription>
                        </DialogHeader>
                        <EditDivisionForm
                            initialData={editingDivision}
                            onFormSubmit={() => setIsEditDivisionDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}



            {editingDepartment && (
                <Dialog open={isEditDepartmentDialogOpen} onOpenChange={setIsEditDepartmentDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit Department</DialogTitle>
                            <DialogDescription>Update the details for this department.</DialogDescription>
                        </DialogHeader>
                        <EditDepartmentForm
                            initialData={editingDepartment}
                            onFormSubmit={() => setIsEditDepartmentDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}

            {editingUnit && (
                <Dialog open={isEditUnitDialogOpen} onOpenChange={setIsEditUnitDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit Unit</DialogTitle>
                            <DialogDescription>Update the details for this unit.</DialogDescription>
                        </DialogHeader>
                        <EditUnitForm
                            initialData={editingUnit}
                            onFormSubmit={() => setIsEditUnitDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}

            {/* Designations Dialogs */}
            <Dialog open={isAddDesignationDialogOpen} onOpenChange={setIsAddDesignationDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New Designation</DialogTitle>
                        <DialogDescription>Create a new job designation.</DialogDescription>
                    </DialogHeader>
                    <AddDesignationForm onFormSubmit={() => setIsAddDesignationDialogOpen(false)} />
                </DialogContent>
            </Dialog>

            {editingDesignation && (
                <Dialog open={isEditDesignationDialogOpen} onOpenChange={setIsEditDesignationDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit Designation</DialogTitle>
                            <DialogDescription>Update designation details</DialogDescription>
                        </DialogHeader>
                        <EditDesignationForm initialData={editingDesignation} onFormSubmit={() => { setIsEditDesignationDialogOpen(false); setEditingDesignation(null); }} />
                    </DialogContent>
                </Dialog>
            )}

            {/* Leave Types Dialogs */}
            <Dialog open={isAddLeaveTypeDialogOpen} onOpenChange={setIsAddLeaveTypeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Leave Type</DialogTitle>
                        <DialogDescription>Create a new leave type definition</DialogDescription>
                    </DialogHeader>
                    <AddLeaveTypeForm onSuccess={() => setIsAddLeaveTypeDialogOpen(false)} />
                </DialogContent>
            </Dialog>

            <Dialog open={isEditLeaveTypeDialogOpen} onOpenChange={setIsEditLeaveTypeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Leave Type</DialogTitle>
                        <DialogDescription>Update leave type details</DialogDescription>
                    </DialogHeader>
                    {editingLeaveType && (
                        <EditLeaveTypeForm leaveType={editingLeaveType} onSuccess={() => { setIsEditLeaveTypeDialogOpen(false); setEditingLeaveType(null); }} />
                    )}
                </DialogContent>
            </Dialog>

            {/* Leave Groups Dialogs */}
            <Dialog open={isAddLeaveGroupDialogOpen} onOpenChange={setIsAddLeaveGroupDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add Leave Group</DialogTitle>
                        <DialogDescription>Create a new leave group with policies</DialogDescription>
                    </DialogHeader>
                    <AddLeaveGroupForm onSuccess={() => setIsAddLeaveGroupDialogOpen(false)} />
                </DialogContent>
            </Dialog>

            <Dialog open={isEditLeaveGroupDialogOpen} onOpenChange={setIsEditLeaveGroupDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Leave Group</DialogTitle>
                        <DialogDescription>Update leave group policies</DialogDescription>
                    </DialogHeader>
                    {editingLeaveGroup && (
                        <EditLeaveGroupForm leaveGroup={editingLeaveGroup} onSuccess={() => { setIsEditLeaveGroupDialogOpen(false); setEditingLeaveGroup(null); }} />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
