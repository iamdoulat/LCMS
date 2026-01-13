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
import { OrderDocument, SupplierDocument } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';

export default function PurchaseOrdersReportsPage() {
    const [allOrders, setAllOrders] = useState<OrderDocument[]>([]);
    const [displayedOrders, setDisplayedOrders] = useState<OrderDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [supplierOptions, setSupplierOptions] = useState<ComboboxOption[]>([]);
    const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);

    // Filters
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [filterSupplierId, setFilterSupplierId] = useState('');
    const [filterOrderNo, setFilterOrderNo] = useState('');
    const [filterSalesperson, setFilterSalesperson] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Purchase Orders
                const ordersQuery = query(collection(firestore, "purchase_orders"), orderBy("createdAt", "desc"));
                const ordersSnapshot = await getDocs(ordersQuery);
                const fetchedOrders = ordersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as OrderDocument));
                setAllOrders(fetchedOrders);
                setDisplayedOrders(fetchedOrders);

                // Fetch Suppliers (Beneficiaries)
                setIsLoadingSuppliers(true);
                const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
                setSupplierOptions(
                    suppliersSnapshot.docs.map(doc => ({
                        value: doc.id,
                        label: (doc.data() as SupplierDocument).beneficiaryName || 'Unnamed Supplier'
                    }))
                );
                setIsLoadingSuppliers(false);

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
        let filtered = [...allOrders];

        if (dateRange?.from) {
            filtered = filtered.filter(order => {
                if (!order.orderDate) return false;
                const oDate = parseISO(order.orderDate);
                const start = startOfDay(dateRange.from!);
                const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from!);
                return isWithinInterval(oDate, { start, end });
            });
        }

        if (filterSupplierId) {
            filtered = filtered.filter(order => order.beneficiaryId === filterSupplierId);
        }

        if (filterOrderNo) {
            filtered = filtered.filter(order => order.id.toLowerCase().includes(filterOrderNo.toLowerCase()));
        }

        if (filterSalesperson) {
            filtered = filtered.filter(order => order.salesperson?.toLowerCase().includes(filterSalesperson.toLowerCase()));
        }

        setDisplayedOrders(filtered);
    }, [allOrders, dateRange, filterSupplierId, filterOrderNo, filterSalesperson]);


    const clearFilters = () => {
        setDateRange(undefined);
        setFilterSupplierId('');
        setFilterOrderNo('');
        setFilterSalesperson('');
    };

    // Calculations
    const totalAmount = displayedOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    const downloadPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Purchase Orders Report", 14, 20);

        const pageWidth = doc.internal.pageSize.getWidth();
        doc.setFontSize(10);
        doc.text(`Total Orders: ${displayedOrders.length}`, pageWidth - 14, 20, { align: 'right' });
        doc.text(`Total Value: ${totalAmount.toLocaleString()}`, pageWidth - 14, 26, { align: 'right' });

        doc.setFontSize(10);
        doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 14, 30);

        let yPos = 36;
        if (dateRange?.from) {
            doc.text(`Date Range: ${format(dateRange.from, 'PP')} - ${dateRange.to ? format(dateRange.to, 'PP') : format(dateRange.from, 'PP')}`, 14, yPos);
            yPos += 6;
        }
        if (filterSupplierId) {
            const supplierLabel = supplierOptions.find(s => s.value === filterSupplierId)?.label || filterSupplierId;
            doc.text(`Beneficiary: ${supplierLabel}`, 14, yPos);
            yPos += 6;
        }
        if (filterOrderNo) {
            doc.text(`Order No: ${filterOrderNo}`, 14, yPos);
            yPos += 6;
        }
        if (filterSalesperson) {
            doc.text(`Salesperson: ${filterSalesperson}`, 14, yPos);
            yPos += 6;
        }

        const tableColumn = ["Order No", "Date", "Beneficiary", "Salesperson", "Total Amount"];
        const tableRows = displayedOrders.map(order => [
            order.id,
            order.orderDate ? format(parseISO(order.orderDate), 'PP') : 'N/A',
            order.beneficiaryName || 'N/A',
            order.salesperson || 'N/A',
            Number(order.totalAmount || 0).toLocaleString()
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: yPos + 4,
        });

        doc.save(`purchase_orders_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const downloadCSV = () => {
        const headers = ["Order No,Date,Beneficiary,Salesperson,Total Amount"];
        const rows = displayedOrders.map(order => [
            `"${order.id}"`,
            `"${order.orderDate ? format(parseISO(order.orderDate), 'yyyy-MM-dd') : ''}"`,
            `"${order.beneficiaryName || ''}"`,
            `"${order.salesperson || ''}"`,
            `"${order.totalAmount || 0}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `purchase_orders_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
                        Purchase Orders Reports
                    </CardTitle>
                    <CardDescription>
                        Generate and download customized reports for purchase orders.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="space-y-2">
                            <Label>Date Range</Label>
                            <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
                        </div>
                        <div className="space-y-2">
                            <Label>Filter by Beneficiary</Label>
                            <Combobox
                                options={supplierOptions}
                                value={filterSupplierId}
                                onValueChange={setFilterSupplierId}
                                placeholder="Select Beneficiary"
                                selectPlaceholder="Search Beneficiary..."
                                emptyStateMessage="No beneficiary found."
                                disabled={isLoadingSuppliers}
                            />
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
                            <Label>Order No</Label>
                            <Input
                                placeholder="Search Order No"
                                value={filterOrderNo}
                                onChange={(e) => setFilterOrderNo(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end mb-6">
                        <Button variant="outline" onClick={clearFilters} className="text-destructive hover:bg-destructive/10">
                            <XCircle className="mr-2 h-4 w-4" /> Clear Filters
                        </Button>
                    </div>


                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-sm">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                                <p className="text-2xl font-bold text-primary">{displayedOrders.length}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-sm">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                                <p className="text-2xl font-bold text-primary"> {totalAmount.toLocaleString()}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        <Button onClick={downloadPDF} className="bg-rose-600 hover:bg-rose-700 text-white" disabled={displayedOrders.length === 0}>
                            <FileText className="mr-2 h-4 w-4" /> Download PDF
                        </Button>
                        <Button onClick={downloadCSV} className="bg-green-600 hover:bg-green-700 text-white" disabled={displayedOrders.length === 0}>
                            <Download className="mr-2 h-4 w-4" /> Download CSV
                        </Button>
                    </div>

                    {/* Table */}
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order No</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Beneficiary</TableHead>
                                    <TableHead>Salesperson</TableHead>
                                    <TableHead className="text-right">Total Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <Loader2 className="mr-2 h-6 w-6 animate-spin inline" /> Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : displayedOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No purchase orders found matching current filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    displayedOrders.slice(0, 50).map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-medium">{order.id}</TableCell>
                                            <TableCell>{order.orderDate ? format(parseISO(order.orderDate), 'PP') : 'N/A'}</TableCell>
                                            <TableCell>{order.beneficiaryName || 'N/A'}</TableCell>
                                            <TableCell>{order.salesperson || 'N/A'}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {Number(order.totalAmount || 0).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        {displayedOrders.length > 50 && (
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
