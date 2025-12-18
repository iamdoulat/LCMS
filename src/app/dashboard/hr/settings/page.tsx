
"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, PlusCircle, Trash2, Edit, MoreHorizontal, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import type { DesignationDocument, BranchDocument, DepartmentDocument, UnitDocument, DivisionDocument } from '@/types';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { AddDesignationForm } from '@/components/forms/AddDesignationForm';
import { EditDesignationForm } from '@/components/forms/EditDesignationForm';
import { AddBranchForm } from '@/components/forms/AddBranchForm';
import { EditBranchForm } from '@/components/forms/EditBranchForm';
import { AddDepartmentForm } from '@/components/forms/AddDepartmentForm';
import { EditDepartmentForm } from '@/components/forms/EditDepartmentForm';
import { AddUnitForm } from '@/components/forms/AddUnitForm';
import { EditUnitForm } from '@/components/forms/EditUnitForm';
import { AddDivisionForm } from '@/components/forms/AddDivisionForm';
import { EditDivisionForm } from '@/components/forms/EditDivisionForm';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { Skeleton } from '@/components/ui/skeleton';


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
    const [isAddBranchDialogOpen, setIsAddBranchDialogOpen] = React.useState(false);
    const [isAddDepartmentDialogOpen, setIsAddDepartmentDialogOpen] = React.useState(false);
    const [isAddUnitDialogOpen, setIsAddUnitDialogOpen] = React.useState(false);
    const [isAddDesignationDialogOpen, setIsAddDesignationDialogOpen] = React.useState(false);

    const [editingDivision, setEditingDivision] = React.useState<DivisionDocument | null>(null);
    const [isEditDivisionDialogOpen, setIsEditDivisionDialogOpen] = React.useState(false);
    
    const [editingBranch, setEditingBranch] = React.useState<BranchDocument | null>(null);
    const [isEditBranchDialogOpen, setIsEditBranchDialogOpen] = React.useState(false);

    const [editingDepartment, setEditingDepartment] = React.useState<DepartmentDocument | null>(null);
    const [isEditDepartmentDialogOpen, setIsEditDepartmentDialogOpen] = React.useState(false);

    const [editingUnit, setEditingUnit] = React.useState<UnitDocument | null>(null);
    const [isEditUnitDialogOpen, setIsEditUnitDialogOpen] = React.useState(false);

    const [editingDesignation, setEditingDesignation] = React.useState<DesignationDocument | null>(null);
    const [isEditDesignationDialogOpen, setIsEditDesignationDialogOpen] = React.useState(false);


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
                    Swal.fire('Deleted!', `'${docName}' has been removed.`, 'success');
                } catch (error: any) {
                    Swal.fire('Error!', `Could not delete item: ${error.message}`, 'error');
                }
            }
        });
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
                  <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary"/>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
              </div>
              <Button size="sm" disabled={isReadOnly} onClick={onAddClick}><PlusCircle className="mr-2 h-4 w-4"/>Add New</Button>
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
                    <Dialog open={isAddDivisionDialogOpen} onOpenChange={setIsAddDivisionDialogOpen}>
                        {renderTableSection("Divisions", "Manage company divisions.", divisions, isLoadingDivisions, () => setIsAddDivisionDialogOpen(true), (item) => handleEdit(item, setEditingDivision, setIsEditDivisionDialogOpen), "divisions", "md:col-span-2")}
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add New Division</DialogTitle>
                                <DialogDescription>Create a new company division.</DialogDescription>
                            </DialogHeader>
                            <AddDivisionForm onFormSubmit={() => setIsAddDivisionDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>
                    
                    <Dialog open={isAddBranchDialogOpen} onOpenChange={setIsAddBranchDialogOpen}>
                        {renderTableSection("Branches", "Manage company branches.", branches, isLoadingBranches, () => setIsAddBranchDialogOpen(true), (item) => handleEdit(item, setEditingBranch, setIsEditBranchDialogOpen), "branches")}
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add New Branch</DialogTitle>
                                <DialogDescription>Create a new company branch.</DialogDescription>
                            </DialogHeader>
                            <AddBranchForm onFormSubmit={() => setIsAddBranchDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>

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

                    <Dialog open={isAddDesignationDialogOpen} onOpenChange={setIsAddDesignationDialogOpen}>
                         {renderTableSection("Designations", "Manage employee job designations.", designations, isLoadingDesignations, () => setIsAddDesignationDialogOpen(true), (item) => handleEdit(item, setEditingDesignation, setIsEditDesignationDialogOpen), "designations")}
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add New Designation</DialogTitle>
                                <DialogDescription>Create a new job designation.</DialogDescription>
                            </DialogHeader>
                            <AddDesignationForm onFormSubmit={() => setIsAddDesignationDialogOpen(false)} />
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
            
            {editingBranch && (
                <Dialog open={isEditBranchDialogOpen} onOpenChange={setIsEditBranchDialogOpen}>
                                          <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit Branch</DialogTitle>
                            <DialogDescription>Update the details for this branch.</DialogDescription>
                        </DialogHeader>
                        <EditBranchForm 
                          initialData={editingBranch} 
                          onFormSubmit={() => setIsEditBranchDialogOpen(false)} 
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

             {editingDesignation && (
                <Dialog open={isEditDesignationDialogOpen} onOpenChange={setIsEditDesignationDialogOpen}>
                     <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit Designation</DialogTitle>
                            <DialogDescription>Update the name for this designation.</DialogDescription>
                        </DialogHeader>
                        <EditDesignationForm
                          initialData={editingDesignation}
                          onFormSubmit={() => setIsEditDesignationDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
