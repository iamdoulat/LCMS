
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    LayoutDashboard,
    Users,
    Building,
    ShoppingCart,
    DollarSign,
    TrendingUp,
    Filter,
    XCircle,
    Calendar,
    FileText,
    Package,
    ArrowUpRight,
    TrendingDown,
    Clock,
    CheckCircle2,
    XCircle as RejectedIcon,
    Search,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    Eye,
    Edit,
    Trash2
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Swal from 'sweetalert2';
import { deleteDoc, doc } from 'firebase/firestore';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    Cell,
    PieChart,
    Pie
} from 'recharts';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { ProformaInvoiceDocument, CustomerDocument, SupplierDocument } from '@/types';
import { format, parseISO, isValid, getYear, getMonth } from 'date-fns';
import { StatCard } from '@/components/dashboard/StatCard';
import { cn } from '@/lib/utils';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import Link from 'next/link';

const ALL_YEARS = "All Years";
const ALL_MONTHS = "All Months";
const ALL_STATUS = "All Status";
const ITEMS_PER_PAGE = 10;

const currentYear = new Date().getFullYear();
const yearOptions = [ALL_YEARS, ...Array.from({ length: 11 }, (_, i) => (2020 + i).toString())];
const monthOptions = [
    ALL_MONTHS, "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
const statusOptions = [ALL_STATUS, "Pending", "Paid", "Rejected"];

export default function CommissionDashboard() {
    const [invoices, setInvoices] = useState<ProformaInvoiceDocument[]>([]);
    const [customers, setCustomers] = useState<CustomerDocument[]>([]);
    const [suppliers, setSuppliers] = useState<SupplierDocument[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedYear, setSelectedYear] = useState(currentYear.toString());
    const [selectedMonth, setSelectedMonth] = useState(ALL_MONTHS);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [selectedInvoice, setSelectedInvoice] = useState("");
    const [selectedStatus, setSelectedStatus] = useState(ALL_STATUS);
    const [oviFilter, setOviFilter] = useState("all"); // all, with_ovi, without_ovi
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [invSnap, custSnap, supSnap] = await Promise.all([
                    getDocs(query(collection(firestore, "proforma_invoices"), orderBy("piDate", "desc"))),
                    getDocs(collection(firestore, "customers")),
                    getDocs(collection(firestore, "suppliers"))
                ]);

                setInvoices(invSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProformaInvoiceDocument)));
                setCustomers(custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerDocument)));
                setSuppliers(supSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierDocument)));
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const date = parseISO(inv.piDate);
            const invYear = getYear(date).toString();
            const invMonth = format(date, "MMMM");

            const yearMatch = selectedYear === ALL_YEARS || invYear === selectedYear;
            const monthMatch = selectedMonth === ALL_MONTHS || invMonth === selectedMonth;
            const customerMatch = !selectedCustomer || inv.applicantId === selectedCustomer;
            const invoiceMatch = !selectedInvoice || inv.piNo.toLowerCase().includes(selectedInvoice.toLowerCase());
            const statusMatch = selectedStatus === ALL_STATUS || inv.status === selectedStatus || (!inv.status && selectedStatus === "Pending");
            const oviMatch = oviFilter === "all" ||
                (oviFilter === "with_ovi" && (inv.totalOVI || 0) > 0) ||
                (oviFilter === "without_ovi" && (inv.totalOVI || 0) <= 0);

            return yearMatch && monthMatch && customerMatch && invoiceMatch && statusMatch && oviMatch;
        });
    }, [invoices, selectedYear, selectedMonth, selectedCustomer, selectedInvoice, selectedStatus, oviFilter]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedYear, selectedMonth, selectedCustomer, selectedInvoice, selectedStatus, oviFilter]);

    const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
    const paginatedInvoices = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredInvoices.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredInvoices, currentPage]);

    const handlePageChange = (page: number) => setCurrentPage(page);
    const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
    const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

    const handleDeletePI = async (piId: string, piNo: string) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Do you want to delete PI ${piNo}? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(firestore, "proforma_invoices", piId));
                setInvoices(prev => prev.filter(inv => inv.id !== piId));
                Swal.fire('Deleted!', 'Invoice has been deleted.', 'success');
            } catch (error) {
                console.error("Error deleting PI:", error);
                Swal.fire('Error!', 'Failed to delete invoice.', 'error');
            }
        }
    };

    const getPageNumbers = () => {
        const pageNumbers = [];
        const maxPagesToShow = 5;
        const halfPagesToShow = Math.floor(maxPagesToShow / 2);

        if (totalPages <= maxPagesToShow + 2) {
            for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
        } else {
            pageNumbers.push(1);
            let startPage = Math.max(2, currentPage - halfPagesToShow);
            let endPage = Math.min(totalPages - 1, currentPage + halfPagesToShow);

            if (currentPage <= halfPagesToShow + 1) endPage = Math.min(totalPages - 1, maxPagesToShow);
            if (currentPage >= totalPages - halfPagesToShow) startPage = Math.max(2, totalPages - maxPagesToShow + 1);

            if (startPage > 2) pageNumbers.push("...");
            for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
            if (endPage < totalPages - 1) pageNumbers.push("...");
            pageNumbers.push(totalPages);
        }
        return pageNumbers;
    };

    const stats = useMemo(() => {
        const totalInvoiceQty = filteredInvoices.length;
        const uniqueCustomers = new Set(filteredInvoices.map(inv => inv.applicantId)).size;
        const uniqueBeneficiaries = new Set(filteredInvoices.map(inv => inv.beneficiaryId)).size;

        let totalSalesMachine = 0;
        let totalPurchasedValue = 0;
        let totalNetCommission = 0;
        let grandTotalSalesCommissionable = 0;
        let grandTotalSalesWithOvi = 0;
        let totalOviAmount = 0;

        filteredInvoices.forEach(inv => {
            totalSalesMachine += (inv.totalQty || 0);
            totalPurchasedValue += (inv.totalPurchasePrice || 0);
            totalNetCommission += (inv.grandTotalCommissionUSD || 0);
            grandTotalSalesCommissionable += (inv.grandTotalSalesPrice || 0);
            grandTotalSalesWithOvi += (inv.grandTotalSalesWithOvi || (inv.grandTotalSalesPrice + (inv.totalOVI || 0)));
            totalOviAmount += (inv.totalOVI || 0);
        });

        const avgCommPerc = totalPurchasedValue > 0 ? (totalNetCommission / totalPurchasedValue) * 100 : 0;

        return {
            totalInvoiceQty,
            uniqueCustomers,
            uniqueBeneficiaries,
            totalSalesMachine,
            totalPurchasedValue,
            totalNetCommission,
            avgCommPerc,
            grandTotalSalesCommissionable,
            grandTotalSalesWithOvi,
            totalOviAmount
        };
    }, [filteredInvoices]);

    const chartData = useMemo(() => {
        const months = monthOptions.slice(1);
        return months.map(m => {
            const monthInvoices = filteredInvoices.filter(inv => format(parseISO(inv.piDate), "MMMM") === m);
            const sales = monthInvoices.reduce((acc, inv) => acc + (inv.grandTotalSalesPrice || 0), 0);
            const commission = monthInvoices.reduce((acc, inv) => acc + (inv.grandTotalCommissionUSD || 0), 0);
            const ovi = monthInvoices.reduce((acc, inv) => acc + (inv.totalOVI || 0), 0);
            return { month: m.substring(0, 3), sales, commission, ovi };
        });
    }, [filteredInvoices]);

    const customerChartData = useMemo(() => {
        const data: Record<string, number> = {};
        filteredInvoices.forEach(inv => {
            data[inv.applicantName] = (data[inv.applicantName] || 0) + (inv.grandTotalSalesPrice || 0);
        });
        return Object.entries(data).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
    }, [filteredInvoices]);

    const clearFilters = () => {
        setSelectedYear(currentYear.toString());
        setSelectedMonth(ALL_MONTHS);
        setSelectedCustomer("");
        setSelectedInvoice("");
        setSelectedStatus(ALL_STATUS);
        setOviFilter("all");
    };

    const formatCurrency = (val: number) => `$ ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    return (
        <div className="mx-[25px] py-8 space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out">
                    Commission Management Dashboard
                </h1>
                <p className="text-muted-foreground">Detailed overview of your yearly statistics and performance.</p>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <StatCard
                    title="Total Invoice Qty"
                    value={stats.totalInvoiceQty}
                    icon={<FileText className="h-5 w-5" />}
                    className="bg-gradient-to-br from-blue-500 to-blue-600"
                    description="Filtered by selected criteria"
                />
                <StatCard
                    title="Total Customers"
                    value={stats.uniqueCustomers}
                    icon={<Users className="h-5 w-5" />}
                    className="bg-gradient-to-br from-indigo-500 to-indigo-600"
                    description="Unique applicants"
                />
                <StatCard
                    title="Total Beneficiary"
                    value={stats.uniqueBeneficiaries}
                    icon={<Building className="h-5 w-5" />}
                    className="bg-gradient-to-br from-emerald-500 to-emerald-600"
                    description="Unique suppliers"
                />
                <StatCard
                    title="Total Sales Machine"
                    value={stats.totalSalesMachine}
                    icon={<Package className="h-5 w-5" />}
                    className="bg-gradient-to-br from-purple-500 to-purple-600"
                    description="Sum of model quantities"
                />
                <StatCard
                    title="Total Purchased Value"
                    value={formatCurrency(stats.totalPurchasedValue)}
                    icon={<ShoppingCart className="h-5 w-5" />}
                    className="bg-gradient-to-br from-rose-500 to-rose-600"
                    description="Sum of purchase prices"
                />
                <StatCard
                    title="Total Net Commission"
                    value={formatCurrency(stats.totalNetCommission)}
                    icon={<DollarSign className="h-5 w-5" />}
                    className="bg-gradient-to-br from-amber-500 to-amber-600"
                    description="Net Commission USD"
                />
                <StatCard
                    title="Total Commission %"
                    value={`${stats.avgCommPerc.toFixed(2)}%`}
                    icon={<TrendingUp className="h-5 w-5" />}
                    className="bg-gradient-to-br from-cyan-500 to-cyan-600"
                    description="Based on Total Purchase"
                />
                <StatCard
                    title="Total OVI Value"
                    value={formatCurrency(stats.totalOviAmount)}
                    icon={<ArrowUpRight className="h-5 w-5" />}
                    className="bg-gradient-to-br from-teal-500 to-teal-600"
                    description="Other Value Items"
                />
                <StatCard
                    title="Grand Total Sales"
                    value={formatCurrency(stats.grandTotalSalesCommissionable)}
                    icon={<DollarSign className="h-5 w-5" />}
                    className="bg-gradient-to-br from-slate-700 to-slate-800"
                    description="Commissionable Sales"
                    valueClassName="text-2xl"
                />
                <StatCard
                    title="Grand Total Sales (With OVI)"
                    value={formatCurrency(stats.grandTotalSalesWithOvi)}
                    icon={<TrendingUp className="h-5 w-5" />}
                    className="bg-gradient-to-br from-blue-800 to-blue-900 md:col-span-2 xl:col-span-1"
                    description="Including Over Value Items"
                    valueClassName="text-2xl"
                />
            </div>

            {/* Filters Section */}
            <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-3 px-6">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-5 w-5 text-primary" /> Reports & Filters
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-blue-500" /> Year
                            </label>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="bg-background/50 h-9 text-sm">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-indigo-500" /> Month
                            </label>
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="bg-background/50 h-9 text-sm">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                <Clock className="h-3 w-3 text-amber-500" /> Status
                            </label>
                            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                <SelectTrigger className="bg-background/50 h-9 text-sm">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                <Users className="h-3 w-3 text-emerald-500" /> Customer
                            </label>
                            <Combobox
                                options={customers.map(c => ({ value: c.id!, label: c.applicantName }))}
                                value={selectedCustomer}
                                onValueChange={setSelectedCustomer}
                                selectPlaceholder="All Customers"
                                placeholder="Search Customer..."
                                emptyStateMessage="No customer found."
                                className="w-full text-sm h-9"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                <Search className="h-3 w-3 text-purple-500" /> Invoice No.
                            </label>
                            <Input
                                placeholder="Filter by PI No..."
                                value={selectedInvoice}
                                onChange={(e) => setSelectedInvoice(e.target.value)}
                                className="bg-background/50 h-9 text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                <TrendingUp className="h-3 w-3 text-teal-500" /> OVI Analysis
                            </label>
                            <div className="flex gap-2">
                                <Select value={oviFilter} onValueChange={setOviFilter}>
                                    <SelectTrigger className="h-9 text-sm bg-background/50 flex-1">
                                        <SelectValue placeholder="OVI Filter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Items</SelectItem>
                                        <SelectItem value="with_ovi">With OVI</SelectItem>
                                        <SelectItem value="without_ovi">No OVI</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={clearFilters}
                                    title="Reset Filters"
                                    className="h-9 w-9 border-rose-200 text-rose-600 hover:bg-rose-50"
                                >
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-500" /> Sales & Commission Trend
                        </CardTitle>
                        <CardDescription>Monthly visualization of sales and net commission.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px] w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                    itemStyle={{ fontSize: '12px' }}
                                />
                                <Legend />
                                <Bar dataKey="sales" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="commission" name="Commission" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-indigo-500" /> Top Customers by Sales
                        </CardTitle>
                        <CardDescription>Distribution of revenue across top clients.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px] w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={customerChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {customerChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <ArrowUpRight className="h-5 w-5 text-teal-500" /> Over Value Invoice (OVI) Analysis
                        </CardTitle>
                        <CardDescription>Monthly OVI amounts compared to basic sales.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px] w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="ovi" name="OVI Amount" stroke="#14b8a6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                                <Line type="monotone" dataKey="sales" name="Basic Sales" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Commissions Table */}
            <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-xl">Recent Commissions</CardTitle>
                    <CardDescription>Latest generated invoices and their current status.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase border-b border-border/50">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Invoice No.</th>
                                    <th className="px-4 py-3 font-semibold">Date</th>
                                    <th className="px-4 py-3 font-semibold">Customer</th>
                                    <th className="px-4 py-3 font-semibold">Beneficiary</th>
                                    <th className="px-4 py-3 font-semibold text-center">Comm. %</th>
                                    <th className="px-4 py-3 font-semibold">Sales (Comm.)</th>
                                    <th className="px-4 py-3 font-semibold">OVI</th>
                                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {paginatedInvoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-accent/30 transition-colors">
                                        <td className="px-4 py-4 font-medium">{inv.piNo}</td>
                                        <td className="px-4 py-4">{format(parseISO(inv.piDate), "MMM dd, yyyy")}</td>
                                        <td className="px-4 py-4 truncate max-w-[150px]">{inv.applicantName}</td>
                                        <td className="px-4 py-4 truncate max-w-[150px]">{inv.beneficiaryName || 'N/A'}</td>
                                        <td className="px-4 py-4 text-center font-medium">{inv.totalCommissionPercentage?.toFixed(2)}%</td>
                                        <td className="px-4 py-4">{formatCurrency(inv.grandTotalSalesPrice)}</td>
                                        <td className="px-4 py-4 text-teal-600 font-semibold">{formatCurrency(inv.totalOVI || 0)}</td>
                                        <td className="px-4 py-4">
                                            <div className="flex justify-center">
                                                <span className={cn(
                                                    "px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1",
                                                    inv.status === 'Paid' ? "bg-emerald-100 text-emerald-700" :
                                                        inv.status === 'Rejected' ? "bg-rose-100 text-rose-700" :
                                                            "bg-amber-100 text-amber-700"
                                                )}>
                                                    {inv.status === 'Paid' ? <CheckCircle2 className="h-3 w-3" /> :
                                                        inv.status === 'Rejected' ? <XCircle className="h-3 w-3" /> :
                                                            <Clock className="h-3 w-3" />}
                                                    {inv.status || 'Pending'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem asChild className="cursor-pointer">
                                                        <Link href={`/dashboard/commission-management/edit-pi/${inv.id}`}>
                                                            <Eye className="mr-2 h-4 w-4 text-blue-600" />
                                                            View Details
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild className="cursor-pointer">
                                                        <Link href={`/dashboard/commission-management/edit-pi/${inv.id}`}>
                                                            <Edit className="mr-2 h-4 w-4 text-amber-600" />
                                                            Edit PI
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                                                        onClick={() => handleDeletePI(inv.id!, inv.piNo)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredInvoices.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground">
                                No invoices found matching your filters.
                            </div>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center space-x-2 py-6 border-t border-border/50">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrevPage}
                                disabled={currentPage === 1}
                                className="h-9"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                            </Button>

                            <div className="flex items-center gap-1">
                                {getPageNumbers().map((page, index) => (
                                    typeof page === 'number' ? (
                                        <Button
                                            key={page}
                                            variant={currentPage === page ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => handlePageChange(page)}
                                            className={cn(
                                                "w-9 h-9 p-0",
                                                currentPage === page ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-accent"
                                            )}
                                        >
                                            {page}
                                        </Button>
                                    ) : (
                                        <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>
                                    )
                                ))}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages}
                                className="h-9"
                            >
                                Next <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    )}

                    <div className="mt-4 text-xs text-muted-foreground text-center">
                        {filteredInvoices.length > 0 ? (
                            <p>
                                Showing <span className="font-semibold text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{" "}
                                <span className="font-semibold text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filteredInvoices.length)}</span> of{" "}
                                <span className="font-semibold text-foreground">{filteredInvoices.length}</span> records
                            </p>
                        ) : (
                            <p>No records to display</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div >
    );
}
