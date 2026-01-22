"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CalendarIcon } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, getDocs, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { AssetDistributionDocument, AssetDocument, EmployeeDocument, AssetCategoryDocument } from '@/types';
import { useAuth } from '@/context/AuthContext';
import Swal from 'sweetalert2';
import { assetDistributionStatusOptions } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { sendPushNotification } from '@/lib/notifications';

interface AssetDistributionModalProps {
    isOpen: boolean;
    onClose: () => void;
    distributionToEdit?: AssetDistributionDocument | null;
    onSuccess: () => void;
    variant?: 'distribution' | 'requisition';
}

export function AssetDistributionModal({ isOpen, onClose, distributionToEdit, onSuccess, variant = 'distribution' }: AssetDistributionModalProps) {
    const { user, firestoreUser } = useAuth(); // Get current user for requisition
    const [assetId, setAssetId] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [status, setStatus] = useState<string>('Pending For Acknowledgement');

    const [category, setCategory] = useState(''); // New for requisition
    const [details, setDetails] = useState(''); // New for requisition (reason)

    const [assets, setAssets] = useState<AssetDocument[]>([]);
    const [employees, setEmployees] = useState<EmployeeDocument[]>([]);
    const [assetCategories, setAssetCategories] = useState<AssetCategoryDocument[]>([]); // categories
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Fetch available assets and employees (and categories if requisition)
    useEffect(() => {
        if (isOpen) {
            const fetchData = async () => {
                setIsLoadingData(true);
                try {
                    // Fetch Categories if in requisition mode
                    if (variant === 'requisition') {
                        const catQuery = query(collection(firestore, "asset_categories"), orderBy("name", "asc"));
                        const catSnap = await getDocs(catQuery);
                        setAssetCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AssetCategoryDocument)));

                        // Fetch Current User's Employee Data
                        if (user?.email) {
                            const empQuery = query(collection(firestore, "employees"), where("email", "==", user.email));
                            const empSnap = await getDocs(empQuery);
                            if (!empSnap.empty) {
                                const empData = { id: empSnap.docs[0].id, ...empSnap.docs[0].data() } as EmployeeDocument;
                                setEmployees([empData]); // Store in employees state for reuse or separate state? 
                                // Actually better to have a separate state or just use employees[0] since we hide the selector
                            }
                        }
                    }

                    // Fetch Assets
                    // For requisition: Filter by category if selected, or fetch all active
                    // For distribution: Fetch all available

                    let assetsQuery;
                    if (variant === 'requisition' && category) {
                        assetsQuery = query(collection(firestore, "assets"), where("categoryName", "==", category));
                    } else {
                        assetsQuery = query(collection(firestore, "assets"), orderBy("title", "asc"));
                    }

                    const assetsSnapshot = await getDocs(assetsQuery);
                    let fetchedAssets = assetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AssetDocument));

                    if (variant === 'requisition') {
                        // In requisition, we prefer "Available" assets but user can request specific one? 
                        // Usually specific request implies available one.
                        fetchedAssets = fetchedAssets.filter(a => a.status === 'Available');
                    } else {
                        // Distribution logic
                        if (!distributionToEdit) {
                            fetchedAssets = fetchedAssets.filter(a => a.status === 'Available');
                        } else {
                            fetchedAssets = fetchedAssets.filter(a => a.status === 'Available' || a.id === distributionToEdit.assetId);
                        }
                    }
                    setAssets(fetchedAssets);

                    // Fetch Employees (Only for distribution)
                    if (variant === 'distribution') {
                        const employeesQuery = query(collection(firestore, "employees"), orderBy("fullName", "asc"));
                        const employeesSnapshot = await getDocs(employeesQuery);
                        const fetchedEmployees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmployeeDocument));
                        setEmployees(fetchedEmployees);
                    }

                } catch (error) {
                    console.error("Failed to fetch data", error);
                } finally {
                    setIsLoadingData(false);
                }
            };
            fetchData();
        }
    }, [isOpen, distributionToEdit, variant, category, user?.email]);

    useEffect(() => {
        if (isOpen) {
            if (distributionToEdit) {
                setAssetId(distributionToEdit.assetId);
                setEmployeeId(distributionToEdit.employeeId);
                setStartDate(distributionToEdit.startDate ? new Date(distributionToEdit.startDate) : undefined);
                setEndDate(distributionToEdit.endDate ? new Date(distributionToEdit.endDate) : undefined);
                setStatus(distributionToEdit.status);
            } else {
                // Reset form
                setAssetId('');
                setEmployeeId('');
                setStartDate(undefined);
                setEndDate(undefined);
                setStatus('Pending For Acknowledgement');
                setCategory('');
                setDetails('');
            }
        }
    }, [isOpen, distributionToEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (variant === 'distribution') {
            if (!assetId) return Swal.fire('Error', 'Asset is required.', 'error');
            if (!employeeId) return Swal.fire('Error', 'Employee is required.', 'error');
        } else {
            // Requisition
            if (!category) return Swal.fire('Error', 'Category is required.', 'error');
            if (!startDate) return Swal.fire('Error', 'Start Date is required.', 'error');
            if (!details) return Swal.fire('Error', 'Requisition Reason is required.', 'error');
        }

        if (!startDate) return Swal.fire('Error', 'Start Date is required.', 'error');

        try {
            setIsSubmitting(true);
            const formattedStartDate = format(startDate, 'yyyy-MM-dd');
            const formattedEndDate = endDate ? format(endDate, 'yyyy-MM-dd') : null;

            if (variant === 'requisition') {
                // --- REQUISITION SUBMISSION ---
                if (!user) {
                    throw new Error("User not authenticated");
                }

                const selectedCategory = assetCategories.find(c => c.name === category);
                // Asset is optional in requisition
                const preferredAsset = assetId ? assets.find(a => a.id === assetId) : null;

                // Prioritize fetched employee data (from employees[0] set in useEffect) over firestoreUser
                const fetchedEmployee = employees.length > 0 ? employees[0] : null;

                // Safe access helpers
                const getEmpCode = (emp: any) => emp?.employeeCode || emp?.employeeId || emp?.code || (firestoreUser as any)?.employeeId || 'N/A';
                const getEmpDesignation = (emp: any) => emp?.designation || emp?.jobTitle || (firestoreUser as any)?.designation || 'N/A';
                const getEmpJobStatus = (emp: any) => emp?.jobStatus || (firestoreUser as any)?.jobStatus || 'Active';
                const getEmpPhoto = (emp: any) => emp?.photoURL || emp?.profilePicture || (firestoreUser as any)?.photoUrl || user.photoURL || '';
                const getEmpName = (emp: any) => emp?.fullName || emp?.name || (firestoreUser as any)?.displayName || user.displayName || 'Unknown';

                const employeeCode = fetchedEmployee ? getEmpCode(fetchedEmployee) : getEmpCode(null);
                const employeeName = fetchedEmployee ? getEmpName(fetchedEmployee) : getEmpName(null);
                const designation = fetchedEmployee ? getEmpDesignation(fetchedEmployee) : getEmpDesignation(null);
                const jobStat = fetchedEmployee ? getEmpJobStatus(fetchedEmployee) : getEmpJobStatus(null);
                const photo = fetchedEmployee ? getEmpPhoto(fetchedEmployee) : getEmpPhoto(null);

                const formattedEmployeeName = employeeCode !== 'N/A' ? `${employeeName} (${employeeCode})` : employeeName;

                await addDoc(collection(firestore, "asset_requisitions"), {
                    employeeId: user.uid, // Auth UID is consistent anchor
                    employeeCode: employeeCode,
                    employeeName: formattedEmployeeName,
                    employeePhotoUrl: photo,
                    employeeDesignation: designation,
                    jobStatus: jobStat,
                    assetCategoryName: category,
                    assetCategoryId: selectedCategory?.id || '',
                    preferredAssetId: preferredAsset?.id || null,
                    preferredAssetName: preferredAsset?.title || null,
                    details: details,
                    fromDate: formattedStartDate,
                    toDate: formattedEndDate, // Use the end date from standard form if filled
                    status: 'Pending',
                    createdAt: serverTimestamp(),
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Requisition submitted successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });

            } else {
                // --- DISTRIBUTION SUBMISSION ---
                const selectedAsset = assets.find(a => a.id === assetId);
                const selectedEmployee = employees.find(e => e.id === employeeId);

                const distributionData = {
                    employeeId,
                    employeeCode: (selectedEmployee as any)?.employeeCode || (selectedEmployee as any)?.employeeId || (selectedEmployee as any)?.code || 'N/A',
                    employeeName: selectedEmployee?.fullName || 'Unknown Employee',
                    employeeDesignation: selectedEmployee?.designation || '',
                    employeePhotoUrl: selectedEmployee?.photoURL || '',
                    startDate: formattedStartDate,
                    endDate: formattedEndDate,
                    status,
                    updatedAt: serverTimestamp(),
                };

                if (distributionToEdit) {
                    await updateDoc(doc(firestore, 'asset_distributions', distributionToEdit.id), distributionData);
                    if (status === 'Returned') {
                        await updateDoc(doc(firestore, 'assets', assetId), { status: 'Available' });
                    } else {
                        await updateDoc(doc(firestore, 'assets', assetId), { status: 'Assigned' });
                    }
                    Swal.fire({
                        icon: 'success',
                        title: 'Updated',
                        text: 'Distribution updated successfully.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                } else {
                    await addDoc(collection(firestore, 'asset_distributions'), {
                        ...distributionData,
                        createdAt: serverTimestamp(),
                    });

                    // Push Notification for new assignment
                    sendPushNotification({
                        title: "Asset Assigned",
                        body: `An asset "${selectedAsset?.title || 'Unknown'}" has been assigned to you.`,
                        userIds: [employeeId],
                        url: '/mobile/dashboard'
                    });

                    await updateDoc(doc(firestore, 'assets', assetId), { status: 'Assigned' });
                    Swal.fire({
                        icon: 'success',
                        title: 'Assigned',
                        text: 'Asset assigned successfully.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                }
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Error saving:", error);
            Swal.fire('Error', error.message || "Failed to save.", 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>
                        {variant === 'requisition'
                            ? 'Asset Request'
                            : (distributionToEdit ? 'Edit Asset Distribution' : 'Add Asset Distribution')}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">

                    {variant === 'requisition' && (
                        <div className="space-y-2 col-span-2 md:col-span-1">
                            <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
                            <Select value={category} onValueChange={(val) => {
                                setCategory(val);
                                setAssetId(''); // Reset asset when category changes
                            }}>
                                <SelectTrigger id="category">
                                    <SelectValue placeholder={isLoadingData ? "Loading..." : "Select Category"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {assetCategories.map(cat => (
                                        <SelectItem key={cat.id} value={cat.name}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2 col-span-2 md:col-span-1">
                        <Label htmlFor="asset">{variant === 'requisition' ? 'Asset (Optional)' : 'Asset'} {variant === 'distribution' && <span className="text-destructive">*</span>}</Label>
                        <Select value={assetId} onValueChange={setAssetId} disabled={!!distributionToEdit || (variant === 'requisition' && !category)}>
                            <SelectTrigger id="asset">
                                <SelectValue placeholder={isLoadingData ? "Loading..." : (variant === 'requisition' && !category ? "Select Category First" : "Select Asset")} />
                            </SelectTrigger>
                            <SelectContent>
                                {variant === 'requisition' && assets.length === 0 && category && (
                                    <SelectItem value="none" disabled>No available assets</SelectItem>
                                )}
                                {assets.map(asset => (
                                    <SelectItem key={asset.id} value={asset.id!}>
                                        {asset.title} ({asset.code})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {variant === 'distribution' && (
                        <div className="space-y-2 col-span-2 md:col-span-1">
                            <Label htmlFor="employee">Assign To <span className="text-destructive">*</span></Label>
                            <Select value={employeeId} onValueChange={setEmployeeId}>
                                <SelectTrigger id="employee">
                                    <SelectValue placeholder="Select Employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id!}>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={emp.photoURL} />
                                                    <AvatarFallback>{emp.fullName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                {emp.fullName}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2 flex flex-col pt-1">
                        <Label className="mb-2">Start Date <span className="text-destructive">*</span></Label>
                        <Input
                            type="date"
                            value={startDate ? format(startDate, "yyyy-MM-dd") : ''}
                            onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                            max={format(new Date(), "yyyy-MM-dd")}
                        />
                    </div>

                    <div className="space-y-2 flex flex-col pt-1">
                        <Label className="mb-2">End Date {variant === 'requisition' && '(Optional)'}</Label>
                        <Input
                            type="date"
                            value={endDate ? format(endDate, "yyyy-MM-dd") : ''}
                            onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                            min={startDate ? format(startDate, "yyyy-MM-dd") : undefined}
                        />
                    </div>

                    {variant === 'requisition' && (
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="details">Requisition Reason <span className="text-destructive">*</span></Label>
                            <Textarea
                                id="details"
                                value={details}
                                onChange={e => setDetails(e.target.value)}
                                placeholder="Please describe why you need this asset..."
                                className="min-h-[100px]"
                            />
                        </div>
                    )}

                    {variant === 'distribution' && distributionToEdit && (
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="status">Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger id="status">
                                    <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {assetDistributionStatusOptions.map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="bg-purple-50 text-purple-600 border-none hover:bg-purple-100">
                        Cancel
                    </Button>
                    <Button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {variant === 'requisition' ? 'Submit Request' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
