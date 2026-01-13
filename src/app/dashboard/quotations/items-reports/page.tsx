"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface FlatQuoteItem {
    id: string;
    quoteId: string;
    quoteDate?: string;
    customerId: string;
    customerName: string;
    itemName: string;
    qty: number;
    unitPrice: number;
    total: number;
}

export default function QuoteItemsReportsPage() {
    const [allFlatItems, setAllFlatItems] = useState<FlatQuoteItem[]>([]);
    const [displayedItems, setDisplayedItems] = useState<FlatQuoteItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [customerOptions, setCustomerOptions] = useState<ComboboxOption[]>([]);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);

    // Filters
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [filterCustomerId, setFilterCustomerId] = useState('');
    const [filterItemName, setFilterItemName] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Quotes
                const quotesQuery = query(collection(firestore, "quotes"), orderBy("createdAt", "desc"));
                const quotesSnapshot = await getDocs(quotesQuery);

                const flatItems: FlatQuoteItem[] = [];

                quotesSnapshot.docs.forEach(doc => {
                    const quote = doc.data() as QuoteDocument;
                    if (quote.lineItems && Array.isArray(quote.lineItems)) {
                        quote.lineItems.forEach((item, index) => {
                            flatItems.push({
                                id: `${doc.id}-${index}`,
                                quoteId: doc.id,
                                quoteDate: quote.quoteDate,
                                customerId: quote.customerId || '',
                                customerName: quote.customerName || 'N/A',
                                itemName: item.itemName || 'N/A',
                                qty: item.qty || 0,
                                unitPrice: item.unitPrice || 0,
                                total: (item.qty || 0) * (item.unitPrice || 0)
                            });
                        });
                    }
                });

                setAllFlatItems(flatItems);
                setDisplayedItems(flatItems);

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
        let filtered = [...allFlatItems];

        if (dateRange?.from) {
            filtered = filtered.filter(item => {
                if (!item.quoteDate) return false;
                const qDate = parseISO(item.quoteDate);
                const start = startOfDay(dateRange.from!);
                const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from!);
                return isWithinInterval(qDate, { start, end });
            });
        }

        if (filterCustomerId) {
            filtered = filtered.filter(item => item.customerId === filterCustomerId);
        }

        if (filterItemName) {
            filtered = filtered.filter(item => item.itemName.toLowerCase().includes(filterItemName.toLowerCase()));
        }

        setDisplayedItems(filtered);
    }, [allFlatItems, dateRange, filterCustomerId, filterItemName]);


    const clearFilters = () => {
        setDateRange(undefined);
        setFilterCustomerId('');
        setFilterItemName('');
    };

    // Calculations
    const totalQty = displayedItems.reduce((sum, item) => sum + item.qty, 0);
    const totalValue = displayedItems.reduce((sum, item) => sum + item.total, 0);

    const downloadPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Quote Items Report", 14, 20);

        doc.setFontSize(10);
        doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 14, 30);

        if (dateRange?.from) {
            doc.text(`Date Range: ${format(dateRange.from, 'PP')} - ${dateRange.to ? format(dateRange.to, 'PP') : format(dateRange.from, 'PP')}`, 14, 35);
        }

        doc.text(`Total Items: ${displayedItems.length}`, 14, 45);
        doc.text(`Total Qty: ${totalQty}`, 14, 50);
        doc.text(`Total Value: ${totalValue.toLocaleString()}`, 14, 55);

        const tableColumn = ["Quote No", "Date", "Customer", "Item", "Qty", "Price", "Total"];
        const tableRows = displayedItems.map(item => [
            item.quoteId,
            item.quoteDate ? format(parseISO(item.quoteDate), 'PP') : 'N/A',
            item.customerName,
            item.itemName,
            item.qty.toString(),
            item.unitPrice.toLocaleString(),
            item.total.toLocaleString()
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 60,
        });

        doc.save(`quote_items_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const downloadCSV = () => {
        const headers = ["Quote No,Date,Customer,Item,Qty,Price,Total"];
        const rows = displayedItems.map(item => [
            `"${item.quoteId}"`,
            `"${item.quoteDate ? format(parseISO(item.quoteDate), 'yyyy-MM-dd') : ''}"`,
            `"${item.customerName || ''}"`,
            `"${item.itemName || ''}"`,
            `"${item.qty}"`,
            `"${item.unitPrice}"`,
            `"${item.total}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `quote_items_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
                        Quote Items Reports
                    </CardTitle>
                    <CardDescription>
                        Generate and download reports for individual items in quotations.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
                            <Label>Filter by Item Name</Label>
                            <Input
                                placeholder="Search Item Name"
                                value={filterItemName}
                                onChange={(e) => setFilterItemName(e.target.value)}
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
                                <p className="text-sm font-medium text-muted-foreground">Total Items (Rows)</p>
                                <p className="text-2xl font-bold text-primary">{displayedItems.length}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-sm">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm font-medium text-muted-foreground">Total Qty</p>
                                <p className="text-2xl font-bold text-primary">{totalQty}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-sm">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                                <p className="text-2xl font-bold text-primary"> {totalValue.toLocaleString()}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        <Button onClick={downloadPDF} className="bg-rose-600 hover:bg-rose-700 text-white" disabled={displayedItems.length === 0}>
                            <FileText className="mr-2 h-4 w-4" /> Download PDF
                        </Button>
                        <Button onClick={downloadCSV} className="bg-green-600 hover:bg-green-700 text-white" disabled={displayedItems.length === 0}>
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
                                    <TableHead>Item</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <Loader2 className="mr-2 h-6 w-6 animate-spin inline" /> Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : displayedItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No items found matching current filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    displayedItems.slice(0, 50).map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.quoteId}</TableCell>
                                            <TableCell>{item.quoteDate ? format(parseISO(item.quoteDate), 'PP') : 'N/A'}</TableCell>
                                            <TableCell>{item.customerName || 'N/A'}</TableCell>
                                            <TableCell>{item.itemName || 'N/A'}</TableCell>
                                            <TableCell>{item.qty}</TableCell>
                                            <TableCell className="font-medium">
                                                {item.total.toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        {displayedItems.length > 50 && (
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
