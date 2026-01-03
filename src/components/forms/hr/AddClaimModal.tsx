"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Swal from 'sweetalert2';
import { firestore, storage } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DatePickerField } from '@/components/forms/common/DatePickerField';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2, Paperclip, FileText, FileEdit, Save } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { HRClaim, HRClaimStatus, ClaimDetail } from '@/types';
import { hrClaimStatusOptions } from '@/types';
import { format } from 'date-fns';

interface AddClaimModalProps {
    trigger?: React.ReactNode;
    onSuccess?: () => void;
    editingClaim?: HRClaim;
    open?: boolean;
    setOpen?: (open: boolean) => void;
    defaultEmployeeId?: string;
    defaultEmployeeName?: string;
}

// Sub-form schema
const claimDetailSchema = z.object({
    categoryId: z.string().min(1, "Category is required"),
    categoryName: z.string().optional(), // Make optional to prevent validation block
    amount: z.coerce.number().min(1, "Amount must be positive"),
    fromDate: z.string({ required_error: "From Date is required" }),
    toDate: z.string({ required_error: "To Date is required" }),
    description: z.string().optional(),
    approvedAmount: z.coerce.number().optional(),
});

type ClaimDetailFormValues = z.infer<typeof claimDetailSchema>;

// Main form schema
const claimFormSchema = z.object({
    employeeId: z.string().min(1, "Employee is required"),
    employeeName: z.string(),
    advancedAmount: z.coerce.number().optional(),
    advancedDate: z.string().nullable().optional().or(z.literal('')),
    claimDate: z.string({ required_error: "Claim Date is required" }),
    description: z.string().optional(),
    status: z.enum(hrClaimStatusOptions).default("Claimed"), // Default to Claimed

    // Added editable fields
    sanctionedAmount: z.coerce.number().optional(),
    branch: z.string().optional(),
});

type ClaimFormValues = z.infer<typeof claimFormSchema>;

export function AddClaimModal({ trigger, onSuccess, editingClaim, open: externalOpen, setOpen: setExternalOpen, defaultEmployeeId, defaultEmployeeName }: AddClaimModalProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = externalOpen !== undefined ? externalOpen : internalOpen;
    const setOpen = setExternalOpen !== undefined ? setExternalOpen : setInternalOpen;
    const { user, userRole } = useAuth();
    const [employees, setEmployees] = useState<{ id: string, name: string, branch: string, employeeCode: string }[]>([]);
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [details, setDetails] = useState<ClaimDetail[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // File Upload State
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [editingDetailId, setEditingDetailId] = useState<string | null>(null);

    // Forms
    const form = useForm<ClaimFormValues>({
        resolver: zodResolver(claimFormSchema),
        defaultValues: {
            status: "Claimed",
            advancedAmount: 0,
            sanctionedAmount: 0,
        }
    });

    // Reset form and loads details when editingClaim changes
    useEffect(() => {
        if (open && editingClaim) {
            form.reset({
                employeeId: editingClaim.employeeId,
                employeeName: editingClaim.employeeName,
                advancedAmount: editingClaim.advancedAmount || 0,
                advancedDate: editingClaim.advancedDate || '',
                claimDate: editingClaim.claimDate,
                description: editingClaim.description,
                status: editingClaim.status,
                sanctionedAmount: editingClaim.sanctionedAmount || 0,
                branch: editingClaim.branch || '',
            });

            // First check if details exist in the document object
            if (editingClaim.details && editingClaim.details.length > 0) {
                setDetails(editingClaim.details);
            } else {
                // Fallback: We need to fetch details for this claim from sub-collection
                const fetchDetails = async () => {
                    try {
                        const detailsRef = collection(firestore, 'hr_claims', editingClaim.id, 'details');
                        const detailsSnap = await getDocs(detailsRef);
                        const detailsList = detailsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClaimDetail));
                        if (detailsList.length > 0) {
                            setDetails(detailsList);
                        }
                    } catch (error) {
                        console.error("Error fetching claim details:", error);
                    }
                };
                fetchDetails();
            }
        } else if (open && !editingClaim) {
            form.reset({
                status: "Claimed",
                advancedAmount: 0,
                sanctionedAmount: 0,
                employeeId: defaultEmployeeId || '',
                employeeName: defaultEmployeeName || '',
            });
            setDetails([]);
        }
    }, [open, editingClaim, form, defaultEmployeeId, defaultEmployeeName]);

    const detailForm = useForm<ClaimDetailFormValues>({
        resolver: zodResolver(claimDetailSchema),
        defaultValues: {
            amount: 0,
        }
    });

    // Fetch Data (Employees & Categories)
    useEffect(() => {
        if (open) {
            const fetchInitialData = async () => {
                const isAdmin = userRole?.some(r => ['Super Admin', 'Admin', 'HR'].includes(r));

                // Fetch Employees (Only for Admin/HR)
                if (isAdmin) {
                    try {
                        const usersRef = collection(firestore, 'users');
                        const usersSnap = await getDocs(usersRef);
                        const empList = usersSnap.docs.map(doc => {
                            const data = doc.data();
                            return {
                                id: doc.id,
                                name: data.name || data.displayName || data.email || 'Unknown User',
                                branch: data.branch || '',
                                employeeCode: data.employeeCode || ''
                            };
                        });
                        empList.sort((a, b) => a.name.localeCompare(b.name));
                        setEmployees(empList);
                    } catch (error) {
                        console.error("Error fetching users:", error);
                    }
                } else if (defaultEmployeeId) {
                    // For non-admins, just add themselves to the list if we have the data
                    setEmployees([{
                        id: defaultEmployeeId,
                        name: defaultEmployeeName || 'Me',
                        branch: '',
                        employeeCode: ''
                    }]);
                }

                // Fetch Categories (For everyone)
                try {
                    const catsRef = collection(firestore, 'claim_categories');
                    const catsSnap = await getDocs(query(catsRef, orderBy('name')));
                    const catList = catsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
                    setCategories(catList);
                } catch (error) {
                    console.error("Error fetching categories:", error);
                }
            };
            fetchInitialData();
        }
    }, [open, userRole, defaultEmployeeId, defaultEmployeeName]);

    // Sync employee name when ID changes
    const selectedEmployeeId = form.watch('employeeId');
    useEffect(() => {
        if (selectedEmployeeId) {
            const emp = employees.find(e => e.id === selectedEmployeeId);
            if (emp) {
                form.setValue('employeeName', emp.name);
                // Auto-fill branch if available
                if (emp.branch && !form.getValues('branch')) {
                    form.setValue('branch', emp.branch);
                }
            }
        }
    }, [selectedEmployeeId, employees, form]);

    // Sync category name when ID changes
    const selectedCategoryId = detailForm.watch('categoryId');
    useEffect(() => {
        if (selectedCategoryId) {
            const cat = categories.find(c => c.id === selectedCategoryId);
            if (cat) {
                detailForm.setValue('categoryName', cat.name);
            }
        }
    }, [selectedCategoryId, categories, detailForm]);

    const handleEditDetail = (detail: ClaimDetail) => {
        setEditingDetailId(detail.id);
        detailForm.reset({
            categoryId: detail.categoryId,
            categoryName: detail.categoryName,
            amount: detail.amount,
            fromDate: detail.fromDate,
            toDate: detail.toDate,
            approvedAmount: detail.approvedAmount,
            description: detail.description,
        });
        // Scroll to sub-form if needed
    };

    const handleAddDetail = async (data: ClaimDetailFormValues) => {
        try {
            let downloadUrl = '';

            // If we're editing and have an existing attachment, keep it unless a new one is selected
            const existingDetail = editingDetailId ? details.find(d => d.id === editingDetailId) : null;
            downloadUrl = existingDetail?.attachmentUrl || '';

            if (attachmentFile) {
                setIsUploading(true);
                const storageRef = ref(storage, `claim-attachments/${Date.now()}_${attachmentFile.name}`);
                const snapshot = await uploadBytes(storageRef, attachmentFile);
                downloadUrl = await getDownloadURL(snapshot.ref);
                setIsUploading(false);
            }

            const detailData: ClaimDetail = {
                id: editingDetailId || crypto.randomUUID(),
                categoryId: data.categoryId,
                categoryName: categories.find(c => c.id === data.categoryId)?.name || 'Unknown',
                amount: data.amount,
                fromDate: data.fromDate,
                toDate: data.toDate,
                approvedAmount: data.approvedAmount || 0,
                description: data.description,
                attachmentUrl: downloadUrl
            };

            if (editingDetailId) {
                setDetails(prev => prev.map(d => d.id === editingDetailId ? detailData : d));
                setEditingDetailId(null);
                Swal.fire({
                    icon: 'success',
                    title: 'Detail Updated',
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                setDetails(prev => [...prev, detailData]);
            }

            // Reset sub-form
            detailForm.reset({
                amount: 0,
                description: '',
                approvedAmount: 0,
                fromDate: '',
                toDate: '',
                categoryId: '',
            });
            setAttachmentFile(null);

        } catch (error) {
            console.error("Error adding/updating detail", error);
            setIsUploading(false);
            Swal.fire({
                title: "Error",
                text: "Failed to save claim detail",
                icon: "error",
                timer: 3000,
                showConfirmButton: false
            });
        }
    };

    const calculateTotal = () => details.reduce((sum, item) => sum + item.amount, 0);

    const onSubmit = async (data: ClaimFormValues) => {
        if (details.length === 0) {
            Swal.fire({
                title: "Warning",
                text: "Please add at least one claim detail.",
                icon: "warning",
                timer: 3000,
                showConfirmButton: false
            });
            return;
        }

        setIsSubmitting(true);
        try {
            // Generate Claim No if not editing
            const selectedEmp = employees.find(e => e.id === data.employeeId);
            const empCode = selectedEmp?.employeeCode || '0000';
            const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 digit number
            const claimNo = editingClaim?.claimNo || `CLM-${empCode}/${randomNum}`;

            const claimData = {
                userId: data.employeeId,
                employeeId: data.employeeId,
                employeeName: employees.find(e => e.id === data.employeeId)?.name || 'Unknown',
                employeeCode: employees.find(e => e.id === data.employeeId)?.employeeCode || editingClaim?.employeeCode || '',
                branch: data.branch || employees.find(e => e.id === data.employeeId)?.branch || editingClaim?.branch || '',
                claimNo,
                claimDate: data.claimDate,
                advancedDate: data.advancedDate || null,
                advancedAmount: data.advancedAmount || 0,
                description: data.description || '',
                status: data.status,
                approvedAmount: details.reduce((sum, d) => sum + (d.approvedAmount || 0), 0),
                sanctionedAmount: data.sanctionedAmount || 0,
                claimAmount: calculateTotal(),
                remainingAmount: calculateTotal() - details.reduce((sum, d) => sum + (d.approvedAmount || 0), 0),
                claimCategories: Array.from(new Set(details.map(d => d.categoryName || 'Unknown'))),
                categoryName: details.length > 0 ? details[0].categoryName : '',
                details: details,
                updatedAt: serverTimestamp(),
            };

            if (editingClaim) {
                await updateDoc(doc(firestore, 'hr_claims', editingClaim.id), claimData);
                Swal.fire({
                    title: "Success",
                    text: "Claim updated successfully!",
                    icon: "success",
                    timer: 3000,
                    showConfirmButton: false
                });
            } else {
                await addDoc(collection(firestore, 'hr_claims'), {
                    ...claimData,
                    createdAt: serverTimestamp(),
                });
                Swal.fire({
                    title: "Success",
                    text: "Claim added successfully!",
                    icon: "success",
                    timer: 3000,
                    showConfirmButton: false
                });
            }

            setOpen(false);
            form.reset();
            setDetails([]);
            onSuccess?.();

        } catch (error) {
            console.error("Error saving claim", error);
            Swal.fire("Error", "Failed to save claim.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && (
                <DialogTrigger asChild>
                    {trigger}
                </DialogTrigger>
            )}
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-full">
                <DialogHeader>
                    <DialogTitle>{editingClaim ? 'Edit Claim' : 'New Claim'}</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        {/* Top Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="employeeId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Employee*</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Employee" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {employees.map(emp => (
                                                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="branch"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-red-500 font-bold">Branch Address:</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                placeholder="Branch address will appear here..."
                                                className="border-red-200 focus:border-red-400"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="advancedAmount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Advanced Amount</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="advancedDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Advanced Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex flex-col gap-2">
                                <FormLabel>Total Claim Amount</FormLabel>
                                <Input disabled value={calculateTotal()} className="bg-slate-50" />
                            </div>

                            <FormField
                                control={form.control}
                                name="claimDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Claim Date*</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex flex-col gap-2">
                                <FormLabel>Total Approved Amount</FormLabel>
                                <Input
                                    disabled
                                    value={details.reduce((sum, d) => sum + (d.approvedAmount || 0), 0)}
                                    className="bg-slate-50"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="sanctionedAmount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Disbursed / Sanctioned Amount</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} placeholder="0" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} placeholder="Enter description..." className="resize-none" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Claim Status</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex flex-wrap gap-4"
                                        >
                                            {hrClaimStatusOptions.map((st) => (
                                                <FormItem key={st} className="flex items-center space-x-2 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value={st} />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">{st}</FormLabel>
                                                </FormItem>
                                            ))}
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Separator / Sub-form Header */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h3 className="font-medium mb-4">Claim Details</h3>

                            {/* Detail Form Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                {/* Category Select */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Claim Category*</label>
                                    <Select
                                        value={detailForm.watch('categoryId')}
                                        onValueChange={(val) => detailForm.setValue('categoryId', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map(cat => (
                                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {detailForm.formState.errors.categoryId && <div className="text-destructive text-sm">{detailForm.formState.errors.categoryId.message}</div>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Claim Amount*</label>
                                    <Input
                                        type="number"
                                        {...detailForm.register('amount')}
                                    />
                                    {detailForm.formState.errors.amount && <div className="text-destructive text-sm">{detailForm.formState.errors.amount.message}</div>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Approved Amount</label>
                                    <Input
                                        type="number"
                                        {...detailForm.register('approvedAmount')}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">From Date*</label>
                                    <Input
                                        type="date"
                                        value={detailForm.watch('fromDate') || ''}
                                        onChange={(e) => detailForm.setValue('fromDate', e.target.value)}
                                    />
                                    {detailForm.formState.errors.fromDate && <div className="text-destructive text-sm">{detailForm.formState.errors.fromDate.message}</div>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">To Date*</label>
                                    <Input
                                        type="date"
                                        value={detailForm.watch('toDate') || ''}
                                        onChange={(e) => detailForm.setValue('toDate', e.target.value)}
                                    />
                                    {detailForm.formState.errors.toDate && <div className="text-destructive text-sm">{detailForm.formState.errors.toDate.message}</div>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Description</label>
                                    <Textarea
                                        {...detailForm.register('description')}
                                        placeholder="Details..."
                                        className="h-10 resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row items-end gap-4">
                                <div className="flex-1 w-full space-y-2">
                                    <label className="text-sm font-medium">Attachments</label>
                                    <Input type="file" onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)} />
                                </div>
                                <div className="flex gap-2">
                                    {editingDetailId && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setEditingDetailId(null);
                                                detailForm.reset({
                                                    amount: 0,
                                                    description: '',
                                                    approvedAmount: 0,
                                                    fromDate: '',
                                                    toDate: '',
                                                    categoryId: '',
                                                });
                                            }}
                                            className="min-w-[100px]"
                                        >
                                            Cancel
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        onClick={detailForm.handleSubmit(handleAddDetail, (errors) => {
                                            console.log("Sub-form validation errors:", errors);
                                            Swal.fire({
                                                icon: 'error',
                                                title: 'Validation Error',
                                                text: 'Please fill all required fields in Claim Details correctly.',
                                                toast: true,
                                                position: 'top-end',
                                                timer: 3000,
                                                showConfirmButton: false
                                            });
                                        })}
                                        disabled={isUploading}
                                        className={cn(
                                            "min-w-[120px]",
                                            editingDetailId ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"
                                        )}
                                    >
                                        {isUploading ? <Loader2 className="animate-spin h-4 w-4" /> : (editingDetailId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />)}
                                        {editingDetailId ? "Update Now" : "Add Now"}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Details Table */}
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Claim Category</TableHead>
                                        <TableHead className="text-right">Claim Amount</TableHead>
                                        <TableHead>From Date</TableHead>
                                        <TableHead>To Date</TableHead>
                                        <TableHead className="text-right">Approved Amount</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Attachments</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {details.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                                No Data Found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        details.map((detail, index) => (
                                            <TableRow key={detail.id} className={cn(editingDetailId === detail.id && "bg-orange-50")}>
                                                <TableCell className="font-medium text-orange-500">{detail.categoryName}</TableCell>
                                                <TableCell className="text-right">{detail.amount}</TableCell>
                                                <TableCell>{detail.fromDate ? format(new Date(detail.fromDate), 'dd-MM-yyyy') : 'N/A'}</TableCell>
                                                <TableCell>{detail.toDate ? format(new Date(detail.toDate), 'dd-MM-yyyy') : 'N/A'}</TableCell>
                                                <TableCell className="text-right">{detail.approvedAmount || 0}</TableCell>
                                                <TableCell className="max-w-[150px] truncate">{detail.description || '-'}</TableCell>
                                                <TableCell>
                                                    {detail.attachmentUrl ? (
                                                        <a href={detail.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                            onClick={() => handleEditDetail(detail)}
                                                            title="Edit Detail"
                                                        >
                                                            <FileEdit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => setDetails(prev => prev.filter(d => d.id !== detail.id))}
                                                            title="Delete Detail"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => {
                                    const errors = form.formState.errors;
                                    if (Object.keys(errors).length > 0) {
                                        console.log("Main form validation errors:", errors);
                                        const errorFields = Object.keys(errors).map(key => key).join(", ");
                                        Swal.fire({
                                            icon: 'error',
                                            title: 'Check Required Fields',
                                            text: `Please check the following fields: ${errorFields}`,
                                            toast: true,
                                            position: 'top-end',
                                            timer: 4000,
                                            showConfirmButton: false
                                        });
                                    }
                                }}
                            >
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save
                            </Button>
                        </div>

                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
