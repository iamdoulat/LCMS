"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    BarChart3,
    Filter,
    XCircle,
    Calendar,
    Users,
    Search,
    Printer,
    FileSpreadsheet,
    Loader2,
    Clock,
    CheckCircle2,
    XCircle as RejectedIcon,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { ProformaInvoiceDocument, CustomerDocument } from '@/types';
import { format, parseISO, isValid, getYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { useAuth } from '@/context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export default function CommissionReportPage() {
    const { companyName, companyLogoUrl, address, invoiceLogoUrl } = useAuth();
    const [invoices, setInvoices] = useState<ProformaInvoiceDocument[]>([]);
    const [customers, setCustomers] = useState<CustomerDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    // Filters
    const [selectedYear, setSelectedYear] = useState(currentYear.toString());
    const [selectedMonth, setSelectedMonth] = useState(ALL_MONTHS);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [selectedInvoice, setSelectedInvoice] = useState("");
    const [selectedStatus, setSelectedStatus] = useState(ALL_STATUS);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [invSnap, custSnap] = await Promise.all([
                    getDocs(query(collection(firestore, "proforma_invoices"), orderBy("piDate", "desc"))),
                    getDocs(collection(firestore, "customers"))
                ]);

                setInvoices(invSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProformaInvoiceDocument)));
                setCustomers(custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerDocument)));
            } catch (error) {
                console.error("Error fetching report data:", error);
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

            return yearMatch && monthMatch && customerMatch && invoiceMatch && statusMatch;
        });
    }, [invoices, selectedYear, selectedMonth, selectedCustomer, selectedInvoice, selectedStatus]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedYear, selectedMonth, selectedCustomer, selectedInvoice, selectedStatus]);

    const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
    const paginatedInvoices = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredInvoices.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredInvoices, currentPage]);

    const handlePageChange = (page: number) => setCurrentPage(page);
    const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
    const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

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

    const clearFilters = () => {
        setSelectedYear(currentYear.toString());
        setSelectedMonth(ALL_MONTHS);
        setSelectedCustomer("");
        setSelectedInvoice("");
        setSelectedStatus(ALL_STATUS);
    };

    const formatCurrency = (val: number) => `$ ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const getDataUrl = async (url: string): Promise<string> => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Error fetching image for PDF:", error);
            return "";
        }
    };

    const handleExportPDF = async () => {
        setIsGenerating(true);
        try {
            const doc = new jsPDF('l', 'mm', 'a4'); // landscape
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 10; // Reduced margin from 14 to 10

            // Header Section
            let textX = margin;
            const logoToUse = invoiceLogoUrl || companyLogoUrl;

            if (logoToUse) {
                try {
                    const logoData = await getDataUrl(logoToUse);
                    if (logoData) {
                        doc.addImage(logoData, 'PNG', margin, 8, 22, 22);
                        textX = margin + 26;
                    }
                } catch (error) {
                    console.warn("Could not add logo to PDF:", error);
                }
            }

            // Company Info (Left Aligned)
            doc.setFontSize(22);
            doc.setTextColor(40, 40, 40);
            doc.text(companyName || 'NextSew', textX, 16);

            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            if (address) {
                const splitAddress = doc.splitTextToSize(address, 130);
                doc.text(splitAddress, textX, 22);
            }

            // Report Header (Right Aligned)
            doc.setFontSize(18);
            doc.setTextColor(40, 40, 40);
            doc.text('Commission Management Report', pageWidth - margin, 16, { align: 'right' });

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, pageWidth - margin, 24, { align: 'right' });

            // Filtering Options (Right Aligned)
            const customerName = selectedCustomer ? customers.find(c => c.id === selectedCustomer)?.applicantName || 'Selected Customer' : 'All Customers';
            const filterText = `Filters: Year: ${selectedYear}, Month: ${selectedMonth}, Status: ${selectedStatus}, Customer: ${customerName}`;
            doc.setFontSize(9);
            doc.text(filterText, pageWidth - margin, 30, { align: 'right' });

            // Divider Line
            doc.setDrawColor(220, 220, 220);
            doc.line(margin, 35, pageWidth - margin, 35);

            autoTable(doc, {
                startY: 40, // Brought table closer to header
                head: [['Invoice No.', 'Date', 'Customer', 'Comm. %', 'Sales', 'OVI', 'Total with OVI', 'Commission', 'Status']],
                body: filteredInvoices.map(inv => [
                    inv.piNo,
                    format(parseISO(inv.piDate), "MMM dd, yyyy"),
                    inv.applicantName,
                    `${inv.totalCommissionPercentage?.toFixed(2)}%`,
                    formatCurrency(inv.grandTotalSalesPrice),
                    formatCurrency(inv.totalOVI || 0),
                    formatCurrency(inv.grandTotalSalesWithOvi || 0),
                    formatCurrency(inv.grandTotalCommissionUSD || 0),
                    inv.status || 'Pending'
                ]),
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], halign: 'center' },
                columnStyles: {
                    3: { halign: 'center' },
                    4: { halign: 'right' },
                    5: { halign: 'right' },
                    6: { halign: 'right' },
                    7: { halign: 'right' },
                    8: { halign: 'center' }
                },
                alternateRowStyles: { fillColor: [245, 247, 250] },
                margin: { top: 40, left: margin, right: margin },
                styles: { fontSize: 9 }
            });

            doc.save(`commission-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExportCSV = () => {
        const headers = ["Invoice No.", "Date", "Customer", "Comm. %", "Sales Price", "OVI Amount", "Total with OVI", "Commission USD", "Status"];
        const rows = filteredInvoices.map(inv => [
            `"${inv.piNo}"`,
            `"${format(parseISO(inv.piDate), "yyyy-MM-dd")}"`,
            `"${inv.applicantName.replace(/"/g, '""')}"`,
            `"${inv.totalCommissionPercentage?.toFixed(2)}%"`,
            inv.grandTotalSalesPrice,
            inv.totalOVI || 0,
            inv.grandTotalSalesWithOvi || 0,
            inv.grandTotalCommissionUSD || 0,
            `"${inv.status || 'Pending'}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `commission_report_${format(new Date(), 'yyyy_MM_dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="mx-[25px] py-8 space-y-8 animate-in fade-in duration-500">
            <div>
                <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                    <BarChart3 className="h-7 w-7 text-primary" /> Commission Reports
                </CardTitle>
                <p className="text-muted-foreground mt-1">Generate and export detailed commission reports with customized filters.</p>
            </div>

            <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-5 w-5 text-primary" /> Report Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-blue-500" /> Year
                            </label>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="bg-background/50 h-10">
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
                                <SelectTrigger className="bg-background/50 h-10">
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
                                <SelectTrigger className="bg-background/50 h-10">
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
                                className="w-full"
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
                                className="bg-background/50 h-10"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-border/50">
                        <Button
                            onClick={clearFilters}
                            variant="outline"
                            className="bg-background/50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                        >
                            <XCircle className="mr-2 h-4 w-4" /> Reset Filters
                        </Button>
                        <div className="ml-auto flex gap-3">
                            <Button
                                onClick={handleExportCSV}
                                variant="outline"
                                className="border-green-600 text-green-600 hover:bg-green-50"
                                disabled={loading || filteredInvoices.length === 0}
                            >
                                <FileSpreadsheet className="mr-2 h-4 w-4" /> Export CSV
                            </Button>
                            <Button
                                onClick={handleExportPDF}
                                className="bg-primary hover:bg-primary/90"
                                disabled={loading || filteredInvoices.length === 0 || isGenerating}
                            >
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                                Download PDF
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="bg-muted/30">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-xl">Report Results</CardTitle>
                            <CardDescription>Found {filteredInvoices.length} matching records.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Invoice No.</th>
                                    <th className="px-6 py-4 font-semibold">Date</th>
                                    <th className="px-6 py-4 font-semibold">Customer</th>
                                    <th className="px-6 py-4 font-semibold text-center">Comm. %</th>
                                    <th className="px-6 py-4 font-semibold">Sales</th>
                                    <th className="px-6 py-4 font-semibold">OVI</th>
                                    <th className="px-6 py-4 font-semibold">Total with OVI</th>
                                    <th className="px-6 py-4 font-semibold">Commission</th>
                                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-10 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-muted-foreground">Loading invoice data...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedInvoices.length > 0 ? (
                                    paginatedInvoices.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-4 font-medium">{inv.piNo}</td>
                                            <td className="px-6 py-4 text-muted-foreground">{format(parseISO(inv.piDate), "MMM dd, yyyy")}</td>
                                            <td className="px-6 py-4 font-medium">{inv.applicantName}</td>
                                            <td className="px-6 py-4 text-center font-bold text-blue-600">{inv.totalCommissionPercentage?.toFixed(2)}%</td>
                                            <td className="px-6 py-4">{formatCurrency(inv.grandTotalSalesPrice)}</td>
                                            <td className="px-6 py-4 text-teal-600">{formatCurrency(inv.totalOVI || 0)}</td>
                                            <td className="px-6 py-4 font-bold text-indigo-600">{formatCurrency(inv.grandTotalSalesWithOvi || 0)}</td>
                                            <td className="px-6 py-4 text-emerald-600 font-semibold">{formatCurrency(inv.grandTotalCommissionUSD || 0)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    <span className={cn(
                                                        "px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5",
                                                        inv.status === 'Paid' ? "bg-emerald-100 text-emerald-700" :
                                                            inv.status === 'Rejected' ? "bg-rose-100 text-rose-700" :
                                                                "bg-amber-100 text-amber-700"
                                                    )}>
                                                        {inv.status === 'Paid' ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                                                            inv.status === 'Rejected' ? <RejectedIcon className="h-3.5 w-3.5" /> :
                                                                <Clock className="h-3.5 w-3.5" />}
                                                        {inv.status || 'Pending'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground italic">
                                            No records found matching your filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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

                    <div className="px-6 py-4 bg-muted/20 text-xs text-muted-foreground text-center border-t border-border/50">
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
        </div>
    );
}
