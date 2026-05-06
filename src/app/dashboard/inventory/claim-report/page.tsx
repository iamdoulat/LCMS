"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
    Search,
    Calendar as CalendarIcon,
    FileDown,
    Loader2,
    FileSpreadsheet,
    Users,
    BarChart3,
    TrendingUp,
    Filter,
} from 'lucide-react';
import { format, parseISO, isValid, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { Badge } from '@/components/ui/badge';
import { collection, onSnapshot, query, getDoc, doc, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useToast } from '@/hooks/use-toast';
import type { HRClaim, CompanyProfile, Employee } from '@/types';
import { hrClaimStatusOptions } from '@/types';
import { generateClaimReportByDatePDF } from '@/components/reports/hr/ClaimReportByDatePDF';
import { StatCard } from '@/components/dashboard/StatCard';

export default function ClaimReportPage() {
    const { toast } = useToast();
    const { userRole } = useAuth();

    const [claims, setClaims] = useState<HRClaim[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Access check
    const hasAccess = userRole?.some(r => ['Super Admin', 'Admin', 'HR', 'Accounts'].includes(r));

    // Fetch Company Profile
    useEffect(() => {
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

    // Fetch Employees
    useEffect(() => {
        const q = query(collection(firestore, 'employees'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const emps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
            emps.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
            setEmployees(emps);
        });
        return () => unsubscribe();
    }, []);

    // Fetch Claims
    useEffect(() => {
        const q = query(collection(firestore, 'hr_claims'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HRClaim));
            items.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
            });
            setClaims(items);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Filtered employees for search
    const filteredEmployees = useMemo(() => {
        if (!employeeSearch.trim()) return employees;
        const term = employeeSearch.toLowerCase();
        return employees.filter(emp =>
            emp.fullName?.toLowerCase().includes(term) ||
            emp.employeeCode?.toLowerCase().includes(term)
        );
    }, [employees, employeeSearch]);

    // Selected employee
    const selectedEmployee = useMemo(() => {
        return employees.find(e => e.id === selectedEmployeeId);
    }, [employees, selectedEmployeeId]);

    // Filtered claims
    const filteredClaims = useMemo(() => {
        if (!selectedEmployeeId) return [];

        return claims.filter(claim => {
            const matchesEmployee = claim.employeeId === selectedEmployeeId;
            if (!matchesEmployee) return false;

            // Status filter
            if (statusFilter !== 'all' && claim.status !== statusFilter) return false;

            if (dateRange?.from && dateRange?.to) {
                if (!claim.claimDate) return false;

                let claimDate: Date;
                if ((claim.claimDate as any) instanceof Timestamp) {
                    claimDate = (claim.claimDate as any).toDate();
                } else if (typeof claim.claimDate === 'string') {
                    claimDate = parseISO(claim.claimDate);
                } else {
                    return false;
                }

                if (!isValid(claimDate)) return false;

                return isWithinInterval(claimDate, {
                    start: startOfDay(dateRange.from),
                    end: endOfDay(dateRange.to),
                });
            }

            return true;
        });
    }, [claims, selectedEmployeeId, dateRange, statusFilter]);

    // Stats
    const stats = useMemo(() => {
        const totalClaims = filteredClaims.length;
        const totalClaimAmount = filteredClaims.reduce((sum, c) => sum + (c.claimAmount || 0), 0);
        const totalApprovedAmount = filteredClaims.reduce((sum, c) => sum + (c.approvedAmount || 0), 0);
        const totalAdvanceAmount = filteredClaims.reduce((sum, c) => sum + (c.advancedAmount || 0), 0);
        return { totalClaims, totalClaimAmount, totalApprovedAmount, totalAdvanceAmount };
    }, [filteredClaims]);

    // Generate PDF
    const handleGeneratePDF = async () => {
        if (!selectedEmployee) {
            toast({ title: "Error", description: "Please select an employee.", variant: "destructive" });
            return;
        }
        if (!dateRange?.from || !dateRange?.to) {
            toast({ title: "Error", description: "Please select a date range.", variant: "destructive" });
            return;
        }
        if (filteredClaims.length === 0) {
            toast({ title: "Error", description: "No claims found for the selected criteria.", variant: "destructive" });
            return;
        }

        setIsGeneratingPdf(true);
        try {
            await generateClaimReportByDatePDF({
                claims: filteredClaims,
                employee: selectedEmployee,
                companyProfile: companyProfile || undefined,
                fromDate: dateRange.from,
                toDate: dateRange.to,
            });
            toast({ title: "Success!", description: "Claim report PDF generated successfully." });
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    if (!hasAccess) {
        return (
            <div className="mx-[20px] py-6 flex items-center justify-center min-h-[60vh]">
                <Card className="max-w-md w-full">
                    <CardContent className="p-10 text-center">
                        <FileSpreadsheet className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-700">Access Denied</h2>
                        <p className="text-sm text-slate-400 mt-2">
                            You do not have permission to view this page. Only Admin, HR, and Accounts roles can access Claim Reports.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="mx-[20px] py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text">
                    Claim Report
                </h1>
                <p className="text-muted-foreground">
                    Generate employee-wise claim reports by date range and export as PDF.
                </p>
            </div>

            {/* Stats Cards */}
            {selectedEmployeeId && filteredClaims.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title="Total Claims"
                        value={stats.totalClaims.toString()}
                        icon={<FileSpreadsheet />}
                        description="Matching records"
                        className="bg-blue-600"
                        valueClassName="text-2xl"
                    />
                    <StatCard
                        title="Total Claim Amount"
                        value={`BDT ${stats.totalClaimAmount.toLocaleString('en-BD', { minimumFractionDigits: 2 })}`}
                        icon={<TrendingUp />}
                        description="Sum of all claims"
                        className="bg-yellow-600"
                        valueClassName="text-2xl"
                    />
                    <StatCard
                        title="Total Approved"
                        value={`BDT ${stats.totalApprovedAmount.toLocaleString('en-BD', { minimumFractionDigits: 2 })}`}
                        icon={<BarChart3 />}
                        description="Approved amount"
                        className="bg-emerald-600"
                        valueClassName="text-2xl"
                    />
                    <StatCard
                        title="Total Advance"
                        value={`BDT ${stats.totalAdvanceAmount.toLocaleString('en-BD', { minimumFractionDigits: 2 })}`}
                        icon={<Users />}
                        description="Advance given"
                        className="bg-indigo-600"
                        valueClassName="text-2xl"
                    />
                </div>
            )}

            {/* Filter Card */}
            <div>
                <div className="bg-[#5C5CFF] p-4 rounded-t-lg">
                    <h2 className="text-white font-semibold text-lg">Generate Claim Report</h2>
                </div>
                <Card className="rounded-t-none border-t-0 shadow-sm bg-white">
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                            {/* Employee Select */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-700">
                                    <Users className="inline-block mr-1 h-4 w-4" />
                                    Select Employee
                                </Label>
                                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                                    <SelectTrigger className="bg-slate-50 border-slate-200 h-10">
                                        <SelectValue placeholder="Choose an employee..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <div className="px-2 pb-2">
                                            <Input
                                                placeholder="Search employee..."
                                                value={employeeSearch}
                                                onChange={(e) => setEmployeeSearch(e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        {filteredEmployees.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-slate-400 text-center">
                                                No employees found
                                            </div>
                                        ) : (
                                            filteredEmployees.map(emp => (
                                                <SelectItem key={emp.id} value={emp.id}>
                                                    <span className="flex items-center gap-2">
                                                        <span className="font-medium">{emp.fullName}</span>
                                                        <span className="text-xs text-slate-400 font-mono">({emp.employeeCode})</span>
                                                    </span>
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Date Range Picker */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-700">
                                    <CalendarIcon className="inline-block mr-1 h-4 w-4" />
                                    Date Range (From - To)
                                </Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal bg-slate-50 border-slate-200 h-10",
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
                                                <span>Select date range</span>
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
                            </div>

                            {/* Status Filter */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-700">
                                    <Filter className="inline-block mr-1 h-4 w-4" />
                                    Status
                                </Label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="bg-slate-50 border-slate-200 h-10">
                                        <SelectValue placeholder="All Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        {hrClaimStatusOptions.map((status) => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Generate Button */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-700 invisible">Action</Label>
                                <Button
                                    className="w-full h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-blue-600/20 transition-all duration-300"
                                    onClick={handleGeneratePDF}
                                    disabled={isGeneratingPdf || !selectedEmployeeId || !dateRange?.from || !dateRange?.to}
                                >
                                    {isGeneratingPdf ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <FileDown className="mr-2 h-4 w-4" />
                                            Generate PDF Report
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Selected Employee Info */}
                        {selectedEmployee && (
                            <div className="flex items-center gap-4 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
                                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                    {selectedEmployee.fullName?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-800">{selectedEmployee.fullName}</p>
                                    <p className="text-xs text-slate-500">
                                        {selectedEmployee.employeeCode} • {selectedEmployee.designation || 'N/A'} • {selectedEmployee.department || 'N/A'} • {selectedEmployee.branch || 'N/A'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Claims Table Preview */}
            <div>
                <div className="bg-[#5C5CFF] p-4 rounded-t-lg flex items-center justify-between">
                    <h2 className="text-white font-semibold text-lg">Claim Data Preview</h2>
                    {filteredClaims.length > 0 && (
                        <Badge className="bg-white/20 text-white border-white/30 font-semibold">
                            {filteredClaims.length} record{filteredClaims.length !== 1 ? 's' : ''}
                        </Badge>
                    )}
                </div>
                <Card className="rounded-t-none border-t-0 shadow-sm bg-white">
                    <CardContent className="p-6">
                        <div className="rounded-md border bg-white overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-700 text-center w-[60px]">#</TableHead>
                                        <TableHead className="font-bold text-slate-700">Claim ID</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-center">Claim Date</TableHead>
                                        <TableHead className="font-bold text-slate-700">Claim Categories</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-right">Adv. Amt.</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-right">Claim Amt.</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-right">Appr. Amt.</TableHead>
                                        <TableHead className="font-bold text-slate-700 text-center">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!selectedEmployeeId ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-[300px] text-center">
                                                <div className="flex flex-col items-center justify-center text-slate-400">
                                                    <Users className="h-20 w-20 text-slate-200 mb-4" />
                                                    <p className="text-lg font-medium text-slate-500">Select an Employee</p>
                                                    <p className="text-sm text-slate-400 mt-1">Choose an employee and date range to preview their claims.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredClaims.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-[300px] text-center">
                                                <div className="flex flex-col items-center justify-center text-slate-400">
                                                    <FileSpreadsheet className="h-20 w-20 text-slate-200 mb-4" />
                                                    <p className="text-lg font-medium text-slate-500">No Claims Found</p>
                                                    <p className="text-sm text-slate-400 mt-1">No claim records match the selected filters.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        <>
                                            {filteredClaims.map((claim, idx) => (
                                                <TableRow key={claim.id} className="hover:bg-slate-50/50">
                                                    <TableCell className="text-center font-mono text-xs text-slate-400">{idx + 1}</TableCell>
                                                    <TableCell className="font-medium text-blue-600">{claim.claimNo}</TableCell>
                                                    <TableCell className="text-center">
                                                        {claim.claimDate ? (() => {
                                                            try {
                                                                const d = (claim.claimDate as any) instanceof Timestamp
                                                                    ? (claim.claimDate as any).toDate()
                                                                    : parseISO(claim.claimDate);
                                                                return isValid(d) ? format(d, 'dd-MM-yyyy') : '-';
                                                            } catch { return '-'; }
                                                        })() : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {claim.claimCategories?.map((cat, cidx) => (
                                                                <Badge key={cidx} variant="outline" className="text-[10px] bg-orange-50 text-orange-600 border-orange-200">
                                                                    {cat}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">{(claim.advancedAmount || 0).toFixed(2)}</TableCell>
                                                    <TableCell className="text-right font-semibold font-mono">{(claim.claimAmount || 0).toFixed(2)}</TableCell>
                                                    <TableCell className="text-right text-green-600 font-semibold font-mono">{(claim.approvedAmount || 0).toFixed(2)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge className={cn(
                                                            "font-normal text-xs",
                                                            claim.status === 'Approved' ? "bg-green-100 text-green-700" :
                                                                claim.status === 'Rejected' ? "bg-red-100 text-red-700" :
                                                                    claim.status === 'Disbursed' ? "bg-purple-100 text-purple-700" :
                                                                        "bg-blue-100 text-blue-700"
                                                        )}>
                                                            {claim.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {/* Totals Row */}
                                            <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 font-bold border-t-2 border-blue-200">
                                                <TableCell colSpan={4} className="text-right text-blue-800 text-sm">
                                                    Total Claim Amount:
                                                </TableCell>
                                                <TableCell className="text-right text-blue-800 font-mono">
                                                    {stats.totalAdvanceAmount.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-blue-800 font-mono">
                                                    {stats.totalClaimAmount.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-blue-800 font-mono">
                                                    {stats.totalApprovedAmount.toFixed(2)}
                                                </TableCell>
                                                <TableCell></TableCell>
                                            </TableRow>
                                        </>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
