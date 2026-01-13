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
import { QuoteDocument, CustomerDocument } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';

export default function QuotationsReportsPage() {
    const [allQuotes, setAllQuotes] = useState<QuoteDocument[]>([]);
    const [displayedQuotes, setDisplayedQuotes] = useState<QuoteDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [customerOptions, setCustomerOptions] = useState<ComboboxOption[]>([]);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);

    // Filters
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [filterCustomerId, setFilterCustomerId] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterQuoteNo, setFilterQuoteNo] = useState('');
    const [filterSalesperson, setFilterSalesperson] = useState('');

    const statusOptions = ["Draft", "Sent", "Accepted", "Rejected", "Expired"]; // Assuming these based on typical quote statuses, adjust if needed from types

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Quotes
                const quotesQuery = query(collection(firestore, "quotes"), orderBy("createdAt", "desc"));
                const quotesSnapshot = await getDocs(quotesQuery);
                const fetchedQuotes = quotesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as QuoteDocument));
                setAllQuotes(fetchedQuotes);
                setDisplayedQuotes(fetchedQuotes);

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
        let filtered = [...allQuotes];

        if (dateRange?.from) {
            filtered = filtered.filter(quote => {
                if (!quote.quoteDate) return false;
                const qDate = parseISO(quote.quoteDate);
                const start = startOfDay(dateRange.from!);
                const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from!);
                return isWithinInterval(qDate, { start, end });
            });
        }

        if (filterCustomerId) {
            filtered = filtered.filter(quote => quote.customerId === filterCustomerId);
        }

        if (filterStatus && filterStatus !== 'All') {
            filtered = filtered.filter(quote => quote.status === filterStatus);
        }

        if (filterQuoteNo) {
            filtered = filtered.filter(quote => quote.id.toLowerCase().includes(filterQuoteNo.toLowerCase()));
        }

        if (filterSalesperson) {
            filtered = filtered.filter(quote => quote.salesperson?.toLowerCase().includes(filterSalesperson.toLowerCase()));
        }

        setDisplayedQuotes(filtered);
    }, [allQuotes, dateRange, filterCustomerId, filterStatus, filterQuoteNo, filterSalesperson]);


    const clearFilters = () => {
        setDateRange(undefined);
        setFilterCustomerId('');
        setFilterStatus('All');
        setFilterQuoteNo('');
        setFilterSalesperson('');
    };

    // Calculations
    const totalSales = displayedQuotes.reduce((sum, quote) => sum + (quote.totalAmount || 0), 0);
    const acceptedSales = displayedQuotes
        .filter(quote => quote.status === 'Accepted')
        .reduce((sum, quote) => sum + (quote.totalAmount || 0), 0);

    const downloadPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Quotations Report", 14, 20);

        doc.setFontSize(10);
        doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 14, 30);

        if (dateRange?.from) {
            doc.text(`Date Range: ${format(dateRange.from, 'PP')} - ${dateRange.to ? format(dateRange.to, 'PP') : format(dateRange.from, 'PP')}`, 14, 35);
        }

        doc.text(`Total Quotes: ${displayedQuotes.length}`, 14, 45);
        doc.text(`Total Value: ${totalSales.toLocaleString()}`, 14, 50);

        const tableColumn = ["Quote No", "Date", "Customer", "Salesperson", "Status", "Amount"];
        const tableRows = displayedQuotes.map(quote => [
            quote.id,
            quote.quoteDate ? format(parseISO(quote.quoteDate), 'PP') : 'N/A',
            quote.customerName || 'N/A',
            quote.salesperson || 'N/A',
            quote.status || 'N/A',
            Number(quote.totalAmount || 0).toLocaleString()
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 55,
        });

        doc.save(`quotations_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const downloadCSV = () => {
        const headers = ["Quote No,Date,Customer,Salesperson,Status,Amount"];
        const rows = displayedQuotes.map(quote => [
            `"${quote.id}"`,
            `"${quote.quoteDate ? format(parseISO(quote.quoteDate), 'yyyy-MM-dd') : ''}"`,
            `"${quote.customerName || ''}"`,
            `"${quote.salesperson || ''}"`,
            `"${quote.status || ''}"`,
            `"${quote.totalAmount || 0}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `quotations_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
                        Quotations Reports
                    </CardTitle>
                    <CardDescription>
                        Generate and download customized reports for quotations.
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
                                    {statusOptions.map(status => (
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
                            <Label>Quote No</Label>
                            <Input
                                placeholder="Search Quote No"
                                value={filterQuoteNo}
                                onChange={(e) => setFilterQuoteNo(e.target.value)}
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
                                <p className="text-sm font-medium text-muted-foreground">Total Quotes</p>
                                <p className="text-2xl font-bold text-primary">{displayedQuotes.length}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-sm">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                                <p className="text-2xl font-bold text-green-600"> {totalSales.toLocaleString()}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-sm">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm font-medium text-muted-foreground">Accepted Value</p>
                                <p className="text-2xl font-bold text-blue-600"> {acceptedSales.toLocaleString()}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        <Button onClick={downloadPDF} className="bg-rose-600 hover:bg-rose-700 text-white" disabled={displayedQuotes.length === 0}>
                            <FileText className="mr-2 h-4 w-4" /> Download PDF
                        </Button>
                        <Button onClick={downloadCSV} className="bg-green-600 hover:bg-green-700 text-white" disabled={displayedQuotes.length === 0}>
                            <Download className="mr-2 h-4 w-4" /> Download CSV
                        </Button>
                    </div>

                    {/* Table */}
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Quote No</TableHead>
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
                                ) : displayedQuotes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No quotations found matching current filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    displayedQuotes.slice(0, 50).map((quote) => (
                                        <TableRow key={quote.id}>
                                            <TableCell className="font-medium">{quote.id}</TableCell>
                                            <TableCell>{quote.quoteDate ? format(parseISO(quote.quoteDate), 'PP') : 'N/A'}</TableCell>
                                            <TableCell>{quote.customerName || 'N/A'}</TableCell>
                                            <TableCell>{quote.salesperson || 'N/A'}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold border
                                                    ${quote.status === 'Accepted' ? 'bg-green-100 text-green-800 border-green-200' :
                                                        quote.status === 'Rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                                                            quote.status === 'Sent' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                                'bg-gray-100 text-gray-800 border-gray-200'}
                                                `}>
                                                    {quote.status || 'Draft'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {Number(quote.totalAmount || 0).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        {displayedQuotes.length > 50 && (
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
