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
import { Loader2, Paperclip, CalendarIcon } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, getDocs, deleteDoc, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { uploadFile } from '@/lib/storage/storage';
import type { AssetDocument, AssetCategoryDocument, EmployeeDocument } from '@/types';
import { assetStatusOptions } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface AssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    assetToEdit?: AssetDocument | null;
    onSuccess: () => void;
}

export function AssetModal({ isOpen, onClose, assetToEdit, onSuccess }: AssetModalProps) {
    const [title, setTitle] = useState('');
    const [supplier, setSupplier] = useState('');
    const [code, setCode] = useState('');
    const [manufacturer, setManufacturer] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [price, setPrice] = useState(0);
    const [serialNumber, setSerialNumber] = useState('');
    const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(undefined);
    const [modelNumber, setModelNumber] = useState('');
    const [warrantyPeriod, setWarrantyPeriod] = useState('');
    const [status, setStatus] = useState<string>('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
    const [assignedTo, setAssignedTo] = useState<string>('');

    const [categories, setCategories] = useState<AssetCategoryDocument[]>([]);
    const [employees, setEmployees] = useState<EmployeeDocument[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

    // Fetch categories and employees when modal opens
    useEffect(() => {
        if (isOpen) {
            const fetchData = async () => {
                setIsLoadingCategories(true);
                setIsLoadingEmployees(true);
                try {
                    // Fetch Categories
                    const catQuery = query(collection(firestore, "asset_categories"), orderBy("name", "asc"));
                    const catSnapshot = await getDocs(catQuery);
                    setCategories(catSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AssetCategoryDocument)));

                    // Fetch Employees
                    const empQuery = query(collection(firestore, "employees"), orderBy("fullName", "asc"));
                    const empSnapshot = await getDocs(empQuery);
                    setEmployees(empSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmployeeDocument)));
                } catch (error) {
                    console.error("Failed to fetch data", error);
                } finally {
                    setIsLoadingCategories(false);
                    setIsLoadingEmployees(false);
                }
            };
            fetchData();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            if (assetToEdit) {
                setTitle(assetToEdit.title);
                setSupplier(assetToEdit.supplier || '');
                setCode(assetToEdit.code);
                setManufacturer(assetToEdit.manufacturer || '');
                setCategoryId(assetToEdit.categoryId);
                setPrice(assetToEdit.price);
                setSerialNumber(assetToEdit.serialNumber || '');
                setPurchaseDate(assetToEdit.purchaseDate ? new Date(assetToEdit.purchaseDate) : undefined);
                setModelNumber(assetToEdit.modelNumber || '');
                setWarrantyPeriod(assetToEdit.warrantyPeriod || '');
                setStatus(assetToEdit.status);
                setDescription(assetToEdit.description || '');
                setExistingImageUrl(assetToEdit.documentUrl || null);
                setAssignedTo(assetToEdit.assignedTo || ''); // Initialize assignedTo if it exists on asset
                setFile(null);
            } else {
                // Reset form
                setTitle('');
                setSupplier('');
                setCode('');
                setManufacturer('');
                setCategoryId('');
                setPrice(0);
                setSerialNumber('');
                setPurchaseDate(undefined);
                setModelNumber('');
                setWarrantyPeriod('');
                setStatus('');
                setDescription('');
                setFile(null);
                setExistingImageUrl(null);
                setAssignedTo('');
            }
        }
    }, [isOpen, assetToEdit]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title) return toast({ title: "Error", description: "Title is required.", variant: "destructive" });
        if (!code) return toast({ title: "Error", description: "Code is required.", variant: "destructive" });
        if (!categoryId) return toast({ title: "Error", description: "Asset Category is required.", variant: "destructive" });
        if (!price && price !== 0) return toast({ title: "Error", description: "Price is required.", variant: "destructive" });
        if (!status) return toast({ title: "Error", description: "Status is required.", variant: "destructive" });

        try {
            setIsSubmitting(true);
            let downloadUrl = existingImageUrl;

            if (file) {
                const path = `assets/${Date.now()}_${file.name}`;
                downloadUrl = await uploadFile(file, path);
            }

            const selectedCategory = categories.find(c => c.id === categoryId);
            const categoryName = selectedCategory ? selectedCategory.name : 'Unknown';
            let formattedDate = null;
            if (purchaseDate) {
                try {
                    if (!isNaN(purchaseDate.getTime())) {
                        formattedDate = format(purchaseDate, 'yyyy-MM-dd');
                    }
                } catch (e) {
                    console.error("Invalid purchase date", e);
                }
            }

            const assetData = {
                title,
                supplier,
                code,
                manufacturer,
                categoryId,
                categoryName,
                price: Number(price),
                serialNumber,
                purchaseDate: formattedDate,
                modelNumber,
                warrantyPeriod,
                status,
                description,
                assignedTo: status === 'Assigned' ? assignedTo : null, // Store active assignment ID
                ...(downloadUrl && { documentUrl: downloadUrl }),
                updatedAt: serverTimestamp(),
            };

            let assetDocRef;
            if (assetToEdit) {
                assetDocRef = doc(firestore, 'assets', assetToEdit.id);
                await updateDoc(assetDocRef, assetData);

                // If status changed to Available, remove any active distributions
                if (status === 'Available' && assetToEdit.status !== 'Available') {
                    const distQuery = query(
                        collection(firestore, "asset_distributions"),
                        where("assetId", "==", assetToEdit.id),
                        where("status", "in", ["Occupied", "Pending For Acknowledgement"])
                    );
                    const distSnap = await getDocs(distQuery);
                    const deletePromises = distSnap.docs.map(d => deleteDoc(doc(firestore, "asset_distributions", d.id)));
                    await Promise.all(deletePromises);
                }

                toast({ title: "Success", description: "Asset updated successfully." });
            } else {
                const docRef = await addDoc(collection(firestore, 'assets'), {
                    ...assetData,
                    createdAt: serverTimestamp(),
                });
                assetDocRef = docRef;
                toast({ title: "Success", description: "Asset created successfully." });
            }

            // If status is 'Assigned' and we have an assignee, create distribution record
            if (status === 'Assigned' && assignedTo) {
                const employee = employees.find(e => e.id === assignedTo);
                if (employee && assetDocRef) {
                    // Check if a distribution record already exists? Maybe later.
                    // For now, create a new one.
                    await addDoc(collection(firestore, "asset_distributions"), {
                        assetId: assetToEdit ? assetToEdit.id : assetDocRef.id,
                        assetName: title,
                        employeeId: employee.id,
                        employeeCode: employee.employeeCode || 'N/A',
                        employeeName: employee.fullName,
                        employeePhotoUrl: employee.photoURL || '',
                        employeeDesignation: employee.designation || '',
                        startDate: new Date().toISOString(), // Use current date as assignment date
                        status: 'Occupied',
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                }
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Error saving asset:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to save asset.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[900px] overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>{assetToEdit ? 'Edit Asset' : 'New Asset'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="py-4 grid grid-cols-1 md:grid-cols-3 gap-4">

                    <div className="space-y-2">
                        <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                        <Input id="title" placeholder="Enter Title" value={title} onChange={e => setTitle(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="supplier">Supplier</Label>
                        <Input id="supplier" placeholder="Enter Supplier" value={supplier} onChange={e => setSupplier(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="code">Code <span className="text-destructive">*</span></Label>
                        <Input id="code" placeholder="Enter Code" value={code} onChange={e => setCode(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="manufacturer">Manufacturer</Label>
                        <Input id="manufacturer" placeholder="Enter Manufacturer" value={manufacturer} onChange={e => setManufacturer(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Asset Category <span className="text-destructive">*</span></Label>
                        <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger id="category">
                                <SelectValue placeholder={isLoadingCategories ? "Loading..." : "Select Asset Category"} />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id!}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="price">Price <span className="text-destructive">*</span></Label>
                        <Input id="price" type="number" placeholder="Enter Price" value={price} onChange={e => setPrice(Number(e.target.value))} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="serialNumber">Serial Number</Label>
                        <Input id="serialNumber" placeholder="Enter Serial Number" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} />
                    </div>

                    <div className="space-y-2 flex flex-col pt-1">
                        <Label className="mb-2">Purchase Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !purchaseDate && "text-muted-foreground")}>
                                    {purchaseDate ? format(purchaseDate, "PPP") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={purchaseDate} onSelect={setPurchaseDate} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="modelNumber">Model Number</Label>
                        <Input id="modelNumber" placeholder="Enter Model Number" value={modelNumber} onChange={e => setModelNumber(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="warrantyPeriod">Warranty Period</Label>
                        <Input id="warrantyPeriod" placeholder="Enter Warranty Period" value={warrantyPeriod} onChange={e => setWarrantyPeriod(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">Status <span className="text-destructive">*</span></Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger id="status">
                                <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {assetStatusOptions.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {status === 'Assigned' && (
                        <div className="space-y-2">
                            <Label htmlFor="assignedTo">Assign To Employee <span className="text-destructive">*</span></Label>
                            <Select value={assignedTo} onValueChange={setAssignedTo}>
                                <SelectTrigger id="assignedTo">
                                    <SelectValue placeholder={isLoadingEmployees ? "Loading..." : "Select Employee"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id!}>{emp.fullName} ({emp.employeeCode})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="col-span-1 md:col-span-3 space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" placeholder="Enter Description" value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    <div className="col-span-1 md:col-span-3 space-y-2">
                        <Label htmlFor="file">Attachment</Label>
                        <Input id="file" type="file" onChange={handleFileChange} />
                        {existingImageUrl && !file && (
                            <div className="text-sm text-muted-foreground mt-1">
                                Current file: <a href={existingImageUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">View</a>
                            </div>
                        )}
                    </div>

                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="bg-purple-50 text-purple-600 border-none hover:bg-purple-100">
                        Cancel
                    </Button>
                    <Button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
