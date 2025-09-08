
"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, PlusCircle, Trash2, Loader2, Info, AlertTriangle, Edit, MoreHorizontal, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { firestore } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import type { HrmSettingDocument, DesignationDocument, BranchDocument, DepartmentDocument, UnitDocument } from '@/types';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO, isValid } from 'date-fns';
import { AddDesignationForm } from '@/components/forms/AddDesignationForm';
import { EditDesignationForm } from '@/components/forms/EditDesignationForm';
import { AddBranchForm } from '@/components/forms/AddBranchForm';
import { EditBranchForm } from '@/components/forms/EditBranchForm';
import { AddDepartmentForm } from '@/components/forms/AddDepartmentForm';
import { EditDepartmentForm } from '@/components/forms/EditDepartmentForm';
import { AddUnitForm } from '@/components/forms/AddUnitForm';
import { EditUnitForm } from '@/components/forms/EditUnitForm';

const formatDisplayDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = parseISO(dateString);
        return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
    } catch (e) {
        return 'N/A';
    }
};

export default function HrmSettingsPage() {
    const { userRole } = useAuth();
    const isReadOnly = userRole?.includes('Viewer');

    const [designations, setDesignations] = React.useState<DesignationDocument[]>([]);
    const [branches, setBranches] = React.useState<BranchDocument[]>([]);
    const [departments, setDepartments] = React.useState<DepartmentDocument[]>([]);
    const [units, setUnits] = React.useState<UnitDocument[]>([]);

    const [isLoading, setIsLoading] = React.useState(true);
    const [fetchError, setFetchError] = React.useState<string | null>(null);

    const [isAddDesignationDialogOpen, setIsAddDesignationDialogOpen] = React.useState(false);
    const [isAddBranchDialogOpen, setIsAddBranchDialogOpen] = React.useState(false);
    const [isAddDepartmentDialogOpen, setIsAddDepartmentDialogOpen] = React.useState(false);
    const [isAddUnitDialogOpen, setIsAddUnitDialogOpen] = React.useState(false);

    const [editingDesignation, setEditingDesignation] = React.useState<DesignationDocument | null>(null);
    const [isEditDesignationDialogOpen, setIsEditDesignationDialogOpen] = React.useState(false);
    
    const [editingBranch, setEditingBranch] = React.useState<BranchDocument | null>(null);
    const [isEditBranchDialogOpen, setIsEditBranchDialogOpen] = React.useState(false);

    const [editingDepartment, setEditingDepartment] = React.useState<DepartmentDocument | null>(null);
    const [isEditDepartmentDialogOpen, setIsEditDepartmentDialogOpen] = React.useState(false);

    const [editingUnit, setEditingUnit] = React.useState<UnitDocument | null>(null);
    const [isEditUnitDialogOpen, setIsEditUnitDialogOpen] = React.useState(false);

    React.useEffect(() => {
        const createSubscription = (collectionName: string, setData: React.Dispatch<any>, setError: React.Dispatch<React.SetStateAction<string | null>>) => {
            const q = query(collection(firestore, collectionName), orderBy("name", "asc"));
            return onSnapshot(q, (snapshot) => {
                setData(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
            }, (error) => {
                console.error(`Error fetching ${collectionName}:`, error);
                setError(`Could not load ${collectionName}. Check permissions and console.`);
            });
        };

        const unsubDesignations = createSubscription('designations', setDesignations, setFetchError);
        const unsubBranches = createSubscription('branches', setBranches, setFetchError);
        const unsubDepartments = createSubscription('departments', setDepartments, setFetchError);
        const unsubUnits = createSubscription('units', setUnits, setFetchError);

        Promise.all([
          new Promise(resolve => onSnapshot(query(collection(firestore, "designations")), () => resolve(true), () => resolve(false))),
          new Promise(resolve => onSnapshot(query(collection(firestore, "branches")), () => resolve(true), () => resolve(false))),
          new Promise(resolve => onSnapshot(query(collection(firestore, "departments")), () => resolve(true), () => resolve(false))),
          new Promise(resolve => onSnapshot(query(collection(firestore, "units")), () => resolve(true), () => resolve(false))),
        ]).then(() => setIsLoading(false));

        return () => {
            unsubDesignations();
            unsubBranches();
            unsubDepartments();
            unsubUnits();
        };
    }, []);

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
      data: any[],
      onAddClick: () => void,
      onEditClick: (item: any) => void,
      collectionName: string
    ) => (
      <Card>
          <CardHeader className="flex flex-row items-center justify-between">
              <div>
                  <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary"/>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
              </div>
              <Button size="sm" disabled={isReadOnly} onClick={onAddClick}><PlusCircle className="mr-2 h-4 w-4"/>Add New</Button>
          </CardHeader>
          <CardContent>
              {isLoading ? <div className="flex justify-center p-4"><Loader2 className="animate-spin"/></div> :
               fetchError ? <div className="text-destructive text-center p-4">{fetchError}</div> :
               data.length === 0 ? <div className="text-muted-foreground text-center p-4">No data found.</div> :
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
        <div className="py-8">
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
                    <Dialog open={isAddBranchDialogOpen} onOpenChange={setIsAddBranchDialogOpen}>
                        <DialogTrigger asChild>{renderTableSection("Branches", "Manage company branches.", branches, () => setIsAddBranchDialogOpen(true), (item) => handleEdit(item, setEditingBranch, setIsEditBranchDialogOpen), "branches")}</DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add New Branch</DialogTitle>
                                <DialogDescription>Create a new company branch.</DialogDescription>
                            </DialogHeader>
                            <AddBranchForm onFormSubmit={() => setIsAddBranchDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>

                     <Dialog open={isAddDepartmentDialogOpen} onOpenChange={setIsAddDepartmentDialogOpen}>
                         <DialogTrigger asChild>{renderTableSection("Departments", "Manage company departments.", departments, () => setIsAddDepartmentDialogOpen(true), (item) => handleEdit(item, setEditingDepartment, setIsEditDepartmentDialogOpen), "departments")}</DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add New Department</DialogTitle>
                                <DialogDescription>Create a new company department.</DialogDescription>
                            </DialogHeader>
                            <AddDepartmentForm onFormSubmit={() => setIsAddDepartmentDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>
                    
                     <Dialog open={isAddUnitDialogOpen} onOpenChange={setIsAddUnitDialogOpen}>
                        <DialogTrigger asChild>{renderTableSection("Units", "Manage organizational units.", units, () => setIsAddUnitDialogOpen(true), (item) => handleEdit(item, setEditingUnit, setIsEditUnitDialogOpen), "units")}</DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add New Unit</DialogTitle>
                                <DialogDescription>Create a new organizational unit.</DialogDescription>
                            </DialogHeader>
                            <AddUnitForm onFormSubmit={() => setIsAddUnitDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isAddDesignationDialogOpen} onOpenChange={setIsAddDesignationDialogOpen}>
                         <DialogTrigger asChild>{renderTableSection("Designations", "Manage employee job designations.", designations, () => setIsAddDesignationDialogOpen(true), (item) => handleEdit(item, setEditingDesignation, setIsEditDesignationDialogOpen), "designations")}</DialogTrigger>
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
