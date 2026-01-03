"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Calendar as CalendarIcon, FileSpreadsheet, MoreHorizontal, FileText, FileEdit, Printer, Loader2, ListChecks, Trash2, LayoutDashboard, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { Badge } from '@/components/ui/badge';
import { AddClaimModal } from '@/components/forms/hr/AddClaimModal';
import { ClaimCategoryModal } from '@/components/forms/hr/ClaimCategoryModal';
import { ClaimSettingsForm } from '@/components/forms/hr/ClaimSettingsForm';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { generateClaimPDF } from '@/components/reports/hr/ClaimReportPDF';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import Swal from 'sweetalert2';
import type { HRClaim, HRClaimStatus, ClaimCategory, CompanyProfile, Employee } from '@/types';
import { hrClaimStatusOptions } from '@/types';

export default function ClaimManagementPage() {
    const [claims, setClaims] = useState<HRClaim[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [editingClaim, setEditingClaim] = useState<HRClaim | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

    // Fetch Company Profile
    React.useEffect(() => {
        const fetchProfile = async () => {
            try {
                const docRef = doc(firestore, 'financial_settings', 'main_settings');
                const snap = await getDoc(docRef);
                if (snap.exists()) setCompanyProfile(snap.data() as CompanyProfile);
            } catch (error) {
                console.error("Error fetching company profile", error);
            }
        };
        fetchProfile();
    }, []);
    const [categories, setCategories] = useState<ClaimCategory[]>([]);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ClaimCategory | null>(null);
    const [categorySearch, setCategorySearch] = useState('');

    React.useEffect(() => {
        const q = query(collection(firestore, 'claim_categories'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClaimCategory));
            setCategories(cats);
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        // Remove orderBy for a bit to see if missing fields are blocking snapshot
        const q = query(collection(firestore, 'hr_claims'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HRClaim));
            // Sort in memory instead
            items.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
            });
            setClaims(items);
        });
        return () => unsubscribe();
    }, []);

    const handleDeleteClaim = async (id: string, claimNo: string) => {
        Swal.fire({
            title: 'Are you sure?',
            text: `You are about to delete claim ${claimNo}. This action cannot be undone!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(firestore, 'hr_claims', id));
                    Swal.fire({
                        title: 'Deleted!',
                        text: 'Claim has been deleted.',
                        icon: 'success',
                        timer: 3000,
                        showConfirmButton: false
                    });
                } catch (error) {
                    Swal.fire({
                        title: 'Error!',
                        text: 'Failed to delete claim.',
                        icon: 'error',
                        timer: 3000,
                        showConfirmButton: false
                    });
                }
            }
        })
    };

    const handleDeleteCategory = async (id: string) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(firestore, 'claim_categories', id));
                    Swal.fire({
                        title: 'Deleted!',
                        text: 'Category has been deleted.',
                        icon: 'success',
                        timer: 3000,
                        showConfirmButton: false
                    });
                } catch (error) {
                    Swal.fire({
                        title: 'Error!',
                        text: 'Failed to delete category.',
                        icon: 'error',
                        timer: 3000,
                        showConfirmButton: false
                    });
                }
            }
        })
    };

    const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()));

    const filteredClaims = claims.filter(claim => {
        const matchesSearch =
            claim.claimNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            claim.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            claim.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;

        let matchesDate = true;
        if (dateRange?.from && dateRange?.to) {
            if (!claim.claimDate) {
                matchesDate = false;
            } else {
                const claimDate = new Date(claim.claimDate);
                // Set hours to 0 to compare just dates
                const checkDate = new Date(claimDate.getFullYear(), claimDate.getMonth(), claimDate.getDate());
                const fromDate = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate());
                const toDate = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate());

                matchesDate = checkDate >= fromDate && checkDate <= toDate;
            }
        }

        return matchesSearch && matchesStatus && matchesDate;
    });

    return (
        <div className="mx-[20px] py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text">Claim Management</h1>
                    <p className="text-muted-foreground">Manage your organization's employees monthly claims.</p>
                </div>
            </div>

            {/* Main Content Card */}
            <div>
                <div className="bg-[#5C5CFF] p-4 rounded-t-lg">
                    <h2 className="text-white font-semibold text-lg">Claim</h2>
                </div>
                <Card className="rounded-t-none border-t-0 shadow-sm bg-white">
                    <CardContent className="p-6 space-y-6">
                        {/* Filters & Actions */}
                        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
                            <div className="flex flex-col md:flex-row gap-4 flex-1">
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search"
                                        className="pl-9 bg-slate-50 border-slate-200"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            id="date"
                                            variant={"outline"}
                                            className={cn(
                                                "w-full md:w-[260px] justify-start text-left font-normal bg-slate-50 border-slate-200",
                                                !dateRange && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                                            {dateRange?.from ? (
                                                dateRange.to ? (
                                                    <>
                                                        {format(dateRange.from, "dd-MM-yyyy")} - {format(dateRange.to, "dd-MM-yyyy")}
                                                    </>
                                                ) : (
                                                    format(dateRange.from, "dd-MM-yyyy")
                                                )
                                            ) : (
                                                <span>Pick a date</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={dateRange?.from}
                                            selected={dateRange}
                                            onSelect={setDateRange}
                                            numberOfMonths={2}
                                        />
                                    </PopoverContent>
                                </Popover>

                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full md:w-[200px] bg-slate-50 border-slate-200">
                                        <SelectValue placeholder="Select Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Select Status</SelectItem>
                                        {hrClaimStatusOptions.map((status) => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button
                                className="bg-[#2B59FF] hover:bg-[#2B59FF]/90 text-white"
                                onClick={() => {
                                    setEditingClaim(null);
                                    setIsEditModalOpen(true);
                                }}
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add New
                            </Button>
                        </div>

                        {/* Table */}
                        <div className="rounded-md border bg-white">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-[40px]">
                                            <Input type="checkbox" className="h-4 w-4 translate-y-0.5" />
                                        </TableHead>
                                        <TableHead className="font-bold text-slate-700">Claim No.</TableHead>
                                        <TableHead className="font-bold text-slate-700">Employee Name</TableHead>
                                        <TableHead className="font-bold text-slate-700">Branch</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-center">Advanced<br />Date</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-center">Claim<br />Date</TableHead>
                                        <TableHead className="font-bold text-slate-700">Claim Categories</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-right">Advanced<br />Amount</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-right">Claim<br />Amount</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-right">Approved<br />Amount</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-right">Remaining<br />Amount</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-right">Sanctioned<br />Amount</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-center">Status</TableHead>
                                        <TableHead className="text-right font-bold text-slate-700">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredClaims.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={14} className="h-[400px] text-center">
                                                <div className="flex flex-col items-center justify-center text-slate-400">
                                                    <FileSpreadsheet className="h-24 w-24 text-slate-100 mb-4" />
                                                    <p className="text-lg font-medium text-slate-500">No Data Found</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredClaims.map((claim) => (
                                            <TableRow key={claim.id}>
                                                <TableCell>
                                                    <Input type="checkbox" className="h-4 w-4" />
                                                </TableCell>
                                                <TableCell className="font-medium text-blue-600">{claim.claimNo}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span>{claim.employeeName}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">{claim.employeeCode || '-'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{claim.branch || '-'}</TableCell>
                                                <TableCell className="text-center">
                                                    {claim.advancedDate ? format(new Date(claim.advancedDate), 'dd-MM-yyyy') : '-'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {format(new Date(claim.claimDate), 'dd-MM-yyyy')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {claim.claimCategories?.map((cat, idx) => (
                                                            <Badge key={idx} variant="outline" className="text-[10px] bg-orange-50 text-orange-600 border-orange-200">
                                                                {cat}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">{claim.advancedAmount || 0}</TableCell>
                                                <TableCell className="text-right font-semibold">{claim.claimAmount || 0}</TableCell>
                                                <TableCell className="text-right text-green-600 font-semibold">{claim.approvedAmount || 0}</TableCell>
                                                <TableCell className="text-right text-red-600">{claim.remainingAmount || 0}</TableCell>
                                                <TableCell className="text-right text-purple-600">{claim.sanctionedAmount || 0}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={cn(
                                                        "font-normal",
                                                        claim.status === 'Approved' ? "bg-green-100 text-green-700" :
                                                            claim.status === 'Rejected' ? "bg-red-100 text-red-700" :
                                                                "bg-blue-100 text-blue-700"
                                                    )}>
                                                        {claim.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <span className="sr-only">Open menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Action</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onSelect={(e) => {
                                                                e.preventDefault();
                                                                setEditingClaim(claim);
                                                                setTimeout(() => setIsEditModalOpen(true), 100);
                                                            }}>
                                                                <FileEdit className="mr-2 h-4 w-4" /> Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={async () => {
                                                                setIsGeneratingPdf(claim.id);
                                                                try {
                                                                    const empSnap = await getDoc(doc(firestore, 'employees', claim.employeeId));
                                                                    const empData = (empSnap.exists() ? { id: empSnap.id, ...empSnap.data() } : undefined) as Employee | undefined;
                                                                    await generateClaimPDF(claim, empData, companyProfile || undefined, false);
                                                                } finally {
                                                                    setIsGeneratingPdf(null);
                                                                }
                                                            }}>
                                                                {isGeneratingPdf === claim.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                                                Details Report
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={async () => {
                                                                setIsGeneratingPdf(claim.id);
                                                                try {
                                                                    const empSnap = await getDoc(doc(firestore, 'employees', claim.employeeId));
                                                                    const empData = (empSnap.exists() ? { id: empSnap.id, ...empSnap.data() } : undefined) as Employee | undefined;
                                                                    await generateClaimPDF(claim, empData, companyProfile || undefined, true);
                                                                } finally {
                                                                    setIsGeneratingPdf(null);
                                                                }
                                                            }}>
                                                                <Printer className="mr-2 h-4 w-4" /> Details Double Report
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600"
                                                                onClick={() => handleDeleteClaim(claim.id, claim.claimNo)}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Edit Modal (Hidden Trigger) */}
                {isEditModalOpen && (
                    <AddClaimModal
                        open={isEditModalOpen}
                        setOpen={setIsEditModalOpen}
                        editingClaim={editingClaim || undefined}
                        onSuccess={() => {
                            setEditingClaim(null);
                        }}
                    />
                )}
            </div>

            {/* Claim Categories Section */}
            <div>
                <div className="bg-[#5C5CFF] p-4 rounded-t-lg">
                    <h2 className="text-white font-semibold text-lg">Claim Category</h2>
                </div>
                <Card className="rounded-t-none border-t-0 shadow-sm bg-white">
                    <CardContent className="p-6 space-y-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search"
                                    className="pl-9 bg-slate-50 border-slate-200"
                                    value={categorySearch}
                                    onChange={(e) => setCategorySearch(e.target.value)}
                                />
                            </div>
                            <Button
                                className="bg-[#2B59FF] hover:bg-[#2B59FF]/90 text-white"
                                onClick={() => {
                                    setEditingCategory(null);
                                    setIsCategoryModalOpen(true);
                                }}
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add New
                            </Button>
                        </div>

                        <div className="rounded-md border bg-slate-50/50">
                            <Table>
                                <TableHeader className="bg-slate-100">
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-700">Category Name</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-center">Max. Limit</TableHead>
                                        <TableHead className="text-right font-bold text-slate-700">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCategories.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                                No Categories Found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredCategories.map((cat) => (
                                            <TableRow key={cat.id}>
                                                <TableCell className="font-medium">{cat.name}</TableCell>
                                                <TableCell className="text-center">{cat.maxLimit ? cat.maxLimit : 'Unlimited'}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                                            onClick={() => {
                                                                setEditingCategory(cat);
                                                                setIsCategoryModalOpen(true);
                                                            }}
                                                        >
                                                            <FileEdit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() => handleDeleteCategory(cat.id)}
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
                    </CardContent>
                </Card>
            </div>

            {/* Claim Settings Section */}
            <ClaimSettingsForm />

            <ClaimCategoryModal
                open={isCategoryModalOpen}
                onOpenChange={setIsCategoryModalOpen}
                initialData={editingCategory}
                onSuccess={() => {
                    // Real-time listener handles refresh
                }}
            />
        </div>
    );
}
