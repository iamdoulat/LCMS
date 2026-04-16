"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/StatCard';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Calendar as CalendarIcon, FileSpreadsheet, MoreHorizontal, FileText, FileEdit, Printer, Loader2, ListChecks, Trash2, LayoutDashboard, Settings, Wallet, CreditCard, CheckCircle, AlertCircle, TrendingUp, CheckCircle2, Banknote, AlertTriangle, CalendarDays } from 'lucide-react';
import { format, startOfMonth, isSameMonth, isSameYear, parseISO, isValid, getYear } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { getDynamicYearRange } from '@/lib/date-utils';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import type { HRClaim, HRClaimStatus, ClaimCategory, CompanyProfile, Employee } from '@/types';
import { hrClaimStatusOptions } from '@/types';

const formatCurrency = (value?: number) => {
    if (typeof value !== 'number' || isNaN(value)) return 'BDT 0';
    return `BDT ${value.toLocaleString()}`;
};

export default function ClaimManagementPage() {
    const { toast } = useToast();
    const { userRole, user, operationStartDate } = useAuth();
    const [claims, setClaims] = useState<HRClaim[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
    const ALL_YEARS_VALUE = "__ALL_YEARS_CLAIM__";
    const [editingClaim, setEditingClaim] = useState<HRClaim | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [pageSize, setPageSize] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);

    const dynamicYears = React.useMemo(() => {
        return getDynamicYearRange(operationStartDate);
    }, [operationStartDate]);

    const yearOptions = React.useMemo(() => {
        return [ALL_YEARS_VALUE, ...dynamicYears];
    }, [dynamicYears]);

    // Confirmation Dialog State
    const [confirmDelete, setConfirmDelete] = useState<{
        open: boolean;
        type: 'claim' | 'category';
        id: string;
        title: string;
        description: string;
    }>({
        open: false,
        type: 'claim',
        id: '',
        title: '',
        description: ''
    });

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


    const stats = React.useMemo(() => {
        const now = new Date();
        const refDate = filterYear && filterYear !== ALL_YEARS_VALUE 
            ? new Date(parseInt(filterYear), now.getMonth(), now.getDate()) 
            : now;
        
        let yearClaimed = 0;
        let monthClaimed = 0;
        let yearApproved = 0;
        let monthApproved = 0;
        let yearDisbursed = 0;
        let monthDisbursed = 0;
        let yearDue = 0;
        let monthDue = 0;

        // Use ALL claims for the targeted year stats, but respect the year filter
        claims.forEach(c => {
            if (!c.claimDate) return;

            // Robust date parsing
            let claimDate: Date;
            if ((c.claimDate as any) instanceof Timestamp) {
                claimDate = (c.claimDate as any).toDate();
            } else if (typeof c.claimDate === 'string') {
                claimDate = parseISO(c.claimDate);
            } else {
                return;
            }

            if (!isValid(claimDate)) return;

            const isCurrentMatch = filterYear === ALL_YEARS_VALUE 
                ? true 
                : getYear(claimDate) === parseInt(filterYear);

            if (isCurrentMatch) {
                yearClaimed += c.claimAmount || 0;
                yearApproved += c.approvedAmount || 0;
                yearDisbursed += c.sanctionedAmount || 0;
                yearDue += Math.max(0, (c.approvedAmount || 0) - (c.sanctionedAmount || 0));

                // Only show monthly breakdown if the filtered year is the current year
                // OR if "All Years" is selected, show this month's data
                if (isSameMonth(claimDate, now)) {
                    monthClaimed += c.claimAmount || 0;
                    monthApproved += c.approvedAmount || 0;
                    monthDisbursed += c.sanctionedAmount || 0;
                    monthDue += Math.max(0, (c.approvedAmount || 0) - (c.sanctionedAmount || 0));
                }
            }
        });
        
        return {
            thisYearClaimed: yearClaimed,
            thisMonthClaimed: monthClaimed,
            thisYearApproved: yearApproved,
            thisMonthApproved: monthApproved,
            thisYearDisbursed: yearDisbursed,
            thisMonthDisbursed: monthDisbursed,
            thisYearDue: yearDue,
            thisMonthDue: monthDue,
        };
    }, [claims, filterYear]);

    const handleDeleteClaim = (id: string, claimNo: string) => {
        setConfirmDelete({
            open: true,
            type: 'claim',
            id,
            title: 'Are you sure?',
            description: `You are about to delete claim ${claimNo}. This action cannot be undone!`
        });
    };

    const handleDeleteCategory = (id: string, name: string) => {
        setConfirmDelete({
            open: true,
            type: 'category',
            id,
            title: 'Are you sure?',
            description: `You are about to delete category "${name}". You won't be able to revert this!`
        });
    };

    const handleConfirmDelete = async () => {
        const { id, type } = confirmDelete;
        try {
            if (id === 'bulk') {
                const bulkCollection = type === 'claim' ? 'hr_claims' : 'claim_categories';
                await Promise.all(selectedIds.map(selectedId => 
                    deleteDoc(doc(firestore, bulkCollection, selectedId))
                ));
                setSelectedIds([]);
            } else {
                const collectionName = type === 'claim' ? 'hr_claims' : 'claim_categories';
                await deleteDoc(doc(firestore, collectionName, id));
            }
            
            toast({
                title: "Deleted!",
                description: `${type === 'claim' ? 'Claim' : 'Category'} has been deleted successfully.`,
            });
        } catch (error) {
            console.error(`Error deleting ${type}:`, error);
            toast({
                title: "Error!",
                description: `Failed to delete ${type}.`,
                variant: "destructive"
            });
        } finally {
            setConfirmDelete(prev => ({ ...prev, open: false }));
        }
    };

    const handleBulkDelete = () => {
        if (selectedIds.length === 0) return;
        setConfirmDelete({
            open: true,
            type: 'claim',
            id: 'bulk',
            title: 'Are you sure?',
            description: `You are about to delete ${selectedIds.length} selected claims. This action cannot be undone!`
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredClaims.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredClaims.map(c => c.id));
        }
    };

    const toggleSelectRow = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
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

        const matchesYear = filterYear === ALL_YEARS_VALUE || (() => {
            if (!claim.claimDate) return false;
            try {
                const claimDate = (claim.claimDate as any) instanceof Timestamp ? (claim.claimDate as any).toDate() : parseISO(claim.claimDate);
                return isValid(claimDate) && getYear(claimDate) === parseInt(filterYear);
            } catch { return false; }
        })();

        return matchesSearch && matchesStatus && matchesDate && matchesYear;
    });

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, dateRange, statusFilter, pageSize]);

    const totalPages = Math.ceil(filteredClaims.length / pageSize);
    const paginatedClaims = filteredClaims.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div className="mx-[20px] py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text">Claim Management</h1>
                    <p className="text-muted-foreground">Manage your organization's employees monthly claims.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="yearFilter" className="text-sm font-semibold text-slate-600 whitespace-nowrap hidden sm:inline-flex items-center">
                        <CalendarDays className="mr-1 h-4 w-4" /> Year:
                    </Label>
                    <Select value={filterYear} onValueChange={setFilterYear}>
                        <SelectTrigger id="yearFilter" className="w-[130px] h-10 bg-white border-slate-200 shadow-sm">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {yearOptions.map(year => (
                                <SelectItem key={year} value={year}>
                                    {year === ALL_YEARS_VALUE ? "All Years" : year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title={`Total Claimed Amount (${filterYear === ALL_YEARS_VALUE ? 'All' : filterYear})`}
                    value={`BDT ${stats.thisYearClaimed.toLocaleString('en-BD', { minimumFractionDigits: 2 })}`}
                    icon={<TrendingUp />}
                    description={`This Month: BDT ${stats.thisMonthClaimed.toLocaleString('en-BD', { minimumFractionDigits: 2 })}`}
                    className="bg-yellow-600"
                    valueClassName="text-2xl"
                />
                <StatCard
                    title={`Total Approved Amount (${filterYear === ALL_YEARS_VALUE ? 'All' : filterYear})`}
                    value={`BDT ${stats.thisYearApproved.toLocaleString('en-BD', { minimumFractionDigits: 2 })}`}
                    icon={<CheckCircle2 className="h-6 w-6" />}
                    description={`This Month: BDT ${stats.thisMonthApproved.toLocaleString('en-BD', { minimumFractionDigits: 2 })}`}
                    className="bg-emerald-600"
                    valueClassName="text-2xl"
                />
                <StatCard
                    title={`Total Disbursed Amount (${filterYear === ALL_YEARS_VALUE ? 'All' : filterYear})`}
                    value={`BDT ${stats.thisYearDisbursed.toLocaleString('en-BD', { minimumFractionDigits: 2 })}`}
                    icon={<Banknote />}
                    description={`This Month: BDT ${stats.thisMonthDisbursed.toLocaleString('en-BD', { minimumFractionDigits: 2 })}`}
                    className="bg-indigo-600"
                    valueClassName="text-2xl"
                />
                <StatCard
                    title={`Total Due Amount (${filterYear === ALL_YEARS_VALUE ? 'All' : filterYear})`}
                    value={`BDT ${stats.thisYearDue.toLocaleString('en-BD', { minimumFractionDigits: 2 })}`}
                    icon={<AlertTriangle className="h-6 w-6" />}
                    description={`This Month: BDT ${stats.thisMonthDue.toLocaleString('en-BD', { minimumFractionDigits: 2 })}`}
                    className="bg-red-600"
                    valueClassName="text-2xl"
                />
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

                            <div className="flex items-center gap-3">
                                {selectedIds.length > 0 && (
                                    <Button
                                        variant="outline"
                                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                        onClick={handleBulkDelete}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete ALL
                                    </Button>
                                )}
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
                        </div>

                        {/* Table */}
                        <div className="rounded-md border bg-white">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-[40px]">
                                            <Input
                                                type="checkbox"
                                                className="h-4 w-4 translate-y-0.5 cursor-pointer"
                                                checked={filteredClaims.length > 0 && selectedIds.length === filteredClaims.length}
                                                onChange={toggleSelectAll}
                                            />
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
                                        paginatedClaims.map((claim) => (
                                            <TableRow key={claim.id} className={cn(selectedIds.includes(claim.id) && "bg-blue-50/50")}>
                                                <TableCell>
                                                    <Input
                                                        type="checkbox"
                                                        className="h-4 w-4 cursor-pointer"
                                                        checked={selectedIds.includes(claim.id)}
                                                        onChange={() => toggleSelectRow(claim.id)}
                                                    />
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
                                                <TableCell className="text-right text-red-600">{(claim.approvedAmount || 0) - (claim.sanctionedAmount || 0)}</TableCell>
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
                                                            <DropdownMenuItem onSelect={() => {
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

                        {/* Pagination Controls */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span>Show</span>
                                <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(Number(val))}>
                                    <SelectTrigger className="h-8 w-[70px] bg-slate-50 border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[20, 50, 100, 200, 500].map(size => (
                                            <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span>entries</span>
                                <span className="ml-4">
                                    Showing {filteredClaims.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredClaims.length)} of {filteredClaims.length} entries
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-3"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </Button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum = totalPages <= 5 ? i + 1 : (currentPage <= 3 ? i + 1 : (currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i));
                                        if (pageNum < 1 || pageNum > totalPages) return null;
                                        
                                        return (
                                            <Button
                                                key={pageNum}
                                                variant={currentPage === pageNum ? "default" : "outline"}
                                                size="sm"
                                                className={cn("h-8 w-8 p-0", currentPage === pageNum ? "bg-[#2B59FF] text-white" : "")}
                                                onClick={() => setCurrentPage(pageNum)}
                                            >
                                                {pageNum}
                                            </Button>
                                        );
                                    })}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-3"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Edit Modal (Hidden Trigger) */}
                <AddClaimModal
                    open={isEditModalOpen}
                    setOpen={setIsEditModalOpen}
                    editingClaim={editingClaim || undefined}
                    onSuccess={() => {
                        setEditingClaim(null);
                    }}
                />
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
                                                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
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

            <ConfirmDialog
                isOpen={confirmDelete.open}
                onOpenChange={(open) => setConfirmDelete(prev => ({ ...prev, open }))}
                title={confirmDelete.title}
                description={confirmDelete.description}
                onConfirm={handleConfirmDelete}
                variant="destructive"
            />
        </div>
    );
}
