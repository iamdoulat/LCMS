
"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, PlusCircle, Trash2, Loader2, Info, AlertTriangle, Edit, MoreHorizontal, Building, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
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
import type { HrmSettingDocument, DesignationDocument } from '@/types';
import Swal from 'sweetalert2';
import { AddHrmSettingForm } from '@/components/forms/AddHrmSettingForm';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO, isValid } from 'date-fns';
import { AddDesignationForm } from '@/components/forms/AddDesignationForm';

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

    const [settings, setSettings] = React.useState<HrmSettingDocument[]>([]);
    const [designations, setDesignations] = React.useState<DesignationDocument[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [fetchError, setFetchError] = React.useState<string | null>(null);
    const [isAddUnitDialogOpen, setIsAddUnitDialogOpen] = React.useState(false);
    const [isAddDesignationDialogOpen, setIsAddDesignationDialogOpen] = React.useState(false);

    React.useEffect(() => {
        const settingsQuery = query(collection(firestore, "hrm_settings"), orderBy("effectiveDate", "desc"));
        const desigQuery = query(collection(firestore, "designations"), orderBy("name", "asc"));

        const unsubSettings = onSnapshot(settingsQuery, (snapshot) => {
            setSettings(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as HrmSettingDocument)));
            if (!isLoading) setIsLoading(false);
        }, (error) => {
            console.error("Error fetching HRM settings:", error);
            setFetchError("Could not load unit settings. Check permissions and console.");
            setIsLoading(false);
        });

        const unsubDesignations = onSnapshot(desigQuery, (snapshot) => {
            setDesignations(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as DesignationDocument)));
             if (!isLoading) setIsLoading(false);
        }, (error) => {
            console.error("Error fetching designations:", error);
            setFetchError("Could not load designations. Check permissions and console.");
            setIsLoading(false);
        });
        
        Promise.all([new Promise(resolve => setTimeout(resolve, 500))]).then(() => {
           if (isLoading) setIsLoading(false);
        });


        return () => {
            unsubSettings();
            unsubDesignations();
        };
    }, [isLoading]);

    const handleDelete = async (collectionName: string, docId: string, docName: string) => {
        if (isReadOnly) return;
        Swal.fire({
            title: `Delete '${docName}'?`,
            text: "This will permanently delete the setting.",
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

    return (
        <div className="container mx-auto py-8">
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
                <CardContent className="space-y-8">
                    <Dialog open={isAddUnitDialogOpen} onOpenChange={setIsAddUnitDialogOpen}>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary"/>Division, Unit, Department Setup</CardTitle>
                                    <CardDescription>Manage organizational units.</CardDescription>
                                </div>
                                <DialogTrigger asChild>
                                    <Button size="sm" disabled={isReadOnly}><PlusCircle className="mr-2 h-4 w-4"/>Add New Unit</Button>
                                </DialogTrigger>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? <div className="flex justify-center p-4"><Loader2 className="animate-spin"/></div> :
                                 fetchError ? <div className="text-destructive text-center p-4">{fetchError}</div> :
                                 settings.length === 0 ? <div className="text-muted-foreground text-center p-4">No unit settings found.</div> :
                                (
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Division</TableHead>
                                                    <TableHead>Branch</TableHead>
                                                    <TableHead>Department</TableHead>
                                                    <TableHead>Unit</TableHead>
                                                    <TableHead>Effective Date</TableHead>
                                                    <TableHead className="text-right w-[50px]">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {settings.map(setting => (
                                                    <TableRow key={setting.id}>
                                                        <TableCell>{setting.division}</TableCell>
                                                        <TableCell>{setting.branch}</TableCell>
                                                        <TableCell>{setting.department}</TableCell>
                                                        <TableCell>{setting.unit}</TableCell>
                                                        <TableCell>{formatDisplayDate(setting.effectiveDate)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" disabled={isReadOnly} onClick={() => handleDelete('hrm_settings', setting.id, setting.division)}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add New Organizational Unit</DialogTitle>
                                <DialogDescription>Create a new combination of division, branch, department, and unit.</DialogDescription>
                            </DialogHeader>
                            <AddHrmSettingForm onFormSubmit={() => setIsAddUnitDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isAddDesignationDialogOpen} onOpenChange={setIsAddDesignationDialogOpen}>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary"/>Designation Setup</CardTitle>
                                    <CardDescription>Manage employee job designations.</CardDescription>
                                </div>
                                <DialogTrigger asChild>
                                    <Button size="sm" disabled={isReadOnly}><PlusCircle className="mr-2 h-4 w-4"/>Add Designation</Button>
                                </DialogTrigger>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? <div className="flex justify-center p-4"><Loader2 className="animate-spin"/></div> :
                                 fetchError ? <div className="text-destructive text-center p-4">{fetchError}</div> :
                                 designations.length === 0 ? <div className="text-muted-foreground text-center p-4">No designations found.</div> :
                                (
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Designation Name</TableHead>
                                                    <TableHead className="text-right w-[50px]">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {designations.map(desig => (
                                                    <TableRow key={desig.id}>
                                                        <TableCell className="font-medium">{desig.name}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" disabled={isReadOnly} onClick={() => handleDelete('designations', desig.id, desig.name)}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
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
        </div>
    );
}
