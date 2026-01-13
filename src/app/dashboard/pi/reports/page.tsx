"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { BarChart3, Download, FileText, Loader2, XCircle } from 'lucide-react';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { InvoiceDocument, CustomerDocument, InvoiceStatus, invoiceStatusOptions } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';

export default function PiReportsPage() {
    const [allInvoices, setAllInvoices] = useState<InvoiceDocument[]>([]);
    const [displayedInvoices, setDisplayedInvoices] = useState<InvoiceDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [customerOptions, setCustomerOptions] = useState<ComboboxOption[]>([]);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);

    // Filters
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [filterCustomerId, setFilterCustomerId] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterInvoiceNo, setFilterInvoiceNo] = useState('');
    const [filterSalesperson, setFilterSalesperson] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Invoices
                const invoicesQuery = query(collection(firestore, "invoices"), orderBy("createdAt", "desc"));
                const invoicesSnapshot = await getDocs(invoicesQuery);
                const fetchedInvoices = invoicesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as InvoiceDocument));
                setAllInvoices(fetchedInvoices);
                setDisplayedInvoices(fetchedInvoices);

                // Fetch Customers
                setIsLoadingCustomers(true);
                const customersSnapshot = await getDocs(collection(firestore, "customers"));
                setCustomerOptions(
                    customersSnapshot.docs.map(doc => ({
                        value: doc.id,
                        label: (doc.data() as CustomerDocument).applicantName || 'Unnamed Customer'
                    }))
                );
                setIsLoadingCustomers(false);

            } catch (error: any) {
                console.error("Error fetching data:", error);
                Swal.fire("Error", "Failed to fetch data. Please try again.", "error");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // Filter Logic
    useEffect(() => {
        let filtered = [...allInvoices];

        if (dateRange?.from) {
            filtered = filtered.filter(inv => {
                if (!inv.invoiceDate) return false;
                const invDate = parseISO(inv.invoiceDate);
                const start = startOfDay(dateRange.from!);
                const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from!);
                return isWithinInterval(invDate, { start, end });
            });
        }

        if (filterCustomerId) {
            filtered = filtered.filter(inv => inv.customerId === filterCustomerId);
        }

        if (filterStatus && filterStatus !== 'All') {
            filtered = filtered.filter(inv => inv.status === filterStatus);
        }

        if (filterInvoiceNo) {
            filtered = filtered.filter(inv => inv.id.toLowerCase().includes(filterInvoiceNo.toLowerCase()));
        }

        if (filterSalesperson) {
            filtered = filtered.filter(inv => inv.salesperson?.toLowerCase().includes(filterSalesperson.toLowerCase()));
        }

        setDisplayedInvoices(filtered);
    }, [allInvoices, dateRange, filterCustomerId, filterStatus, filterInvoiceNo, filterSalesperson]);


    const clearFilters = () => {
        setDateRange(undefined);
        setFilterCustomerId('');
        setFilterStatus('All');
        setFilterInvoiceNo('');
        setFilterSalesperson('');
    };

    // Calculations
    const totalSales = displayedInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const paidSales = displayedInvoices
        .filter(inv => inv.status === 'Paid')
        .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    const downloadPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("PI Report", 14, 20);

        doc.setFontSize(10);
        doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 14, 30);

        if (dateRange?.from) {
            doc.text(`Date Range: ${format(dateRange.from, 'PP')} - ${dateRange.to ? format(dateRange.to, 'PP') : format(dateRange.from, 'PP')}`, 14, 35);
        }

        doc.text(`Total PIs: ${displayedInvoices.length}`, 14, 45);
        doc.text(`Total Value: ${totalSales.toLocaleString()}`, 14, 50);

        const tableColumn = ["PI No", "Date", "Customer", "Salesperson", "Status", "Amount"];
        const tableRows = displayedInvoices.map(inv => [
            inv.id,
            inv.invoiceDate ? format(parseISO(inv.invoiceDate), 'PP') : 'N/A',
            inv.customerName || 'N/A',
            inv.salesperson || 'N/A',
            inv.status || 'N/A',
            Number(inv.totalAmount || 0).toLocaleString()
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 55,
        });

        doc.save(`pi_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const downloadCSV = () => {
        const headers = ["PI No,Date,Customer,Salesperson,Status,Amount"];
        const rows = displayedInvoices.map(inv => [
            `"${inv.id}"`,
            `"${inv.invoiceDate ? format(parseISO(inv.invoiceDate), 'yyyy-MM-dd') : ''}"`,
            `"${inv.customerName || ''}"`,
            `"${inv.salesperson || ''}"`,
            `"${inv.status || ''}"`,
            `"${inv.totalAmount || 0}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `pi_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="w-full p-4 md:p-6 space-y-6">
            <Card className="shadow-lg border-l-4 border-l-primary">
                <CardHeader>
                    <CardTitle className="flex items-center text-2xl">
                        <BarChart3 className="mr-2 h-6 w-6 text-primary" />
                        PI Reports
                    </CardTitle>
                    <CardDescription>
                        Generate and download customized reports for Proforma Invoices.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                        <div className="space-y-2">
                            <Label>Date Range</Label>
                            <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
                        </div>
                        <div className="space-y-2">
                            <Label>Filter by Customer</Label>
                            <Combobox
                                options={customerOptions}
                                value={filterCustomerId}
                                onValueChange={setFilterCustomerId}
                                placeholder="Select Customer"
                                selectPlaceholder="Search Customer..."
                                emptyStateMessage="No customer found."
                                disabled={isLoadingCustomers}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Filter by Status</Label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All">All Statuses</SelectItem>
                                    {invoiceStatusOptions.map(status => (
                                        <SelectItem key={status} value={status}>{status}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Filter by Salesperson</Label>
                            <Input
                                placeholder="Search Salesperson"
                                value={filterSalesperson}
                                onChange={(e) => setFilterSalesperson(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>PI No</Label>
                            <Input
                                placeholder="Search PI No"
                                value={filterInvoiceNo}
                                onChange={(e) => setFilterInvoiceNo(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end mb-6">
                        <Button variant="outline" onClick={clearFilters} className="text-destructive hover:bg-destructive/10">
                            <XCircle className="mr-2 h-4 w-4" /> Clear Filters
                        </Button>
                    </div>


                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-sm">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm font-medium text-muted-foreground">Total PIs</p>
                                <p className="text-2xl font-bold text-primary">{displayedInvoices.length}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-sm">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                                <p className="text-2xl font-bold text-primary"> {totalSales.toLocaleString()}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-sm">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm font-medium text-muted-foreground">Paid Value</p>
                                <p className="text-2xl font-bold text-green-600"> {paidSales.toLocaleString()}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        <Button onClick={downloadPDF} className="bg-rose-600 hover:bg-rose-700 text-white" disabled={displayedInvoices.length === 0}>
                            <FileText className="mr-2 h-4 w-4" /> Download PDF
                        </Button>
                        <Button onClick={downloadCSV} className="bg-green-600 hover:bg-green-700 text-white" disabled={displayedInvoices.length === 0}>
                            <Download className="mr-2 h-4 w-4" /> Download CSV
                        </Button>
                    </div>

                    {/* Table */}
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>PI No</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Salesperson</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <Loader2 className="mr-2 h-6 w-6 animate-spin inline" /> Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : displayedInvoices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No proforma invoices found matching current filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    displayedInvoices.slice(0, 50).map((inv) => (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-medium">{inv.id}</TableCell>
                                            <TableCell>{inv.invoiceDate ? format(parseISO(inv.invoiceDate), 'PP') : 'N/A'}</TableCell>
                                            <TableCell>{inv.customerName || 'N/A'}</TableCell>
                                            <TableCell>{inv.salesperson || 'N/A'}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                                    ${inv.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                                        inv.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                                                            inv.status === 'Draft' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'}
                                                `}>
                                                    {inv.status || 'N/A'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {Number(inv.totalAmount || 0).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        {displayedInvoices.length > 50 && (
                            <div className="p-4 text-center text-sm text-muted-foreground border-t">
                                Showing top 50 results. Download report for full details.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
