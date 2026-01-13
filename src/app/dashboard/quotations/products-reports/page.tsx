"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Download, FileText, Loader2, XCircle } from 'lucide-react';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns'; // Only for PDF report date
import { ItemDocument } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';

export default function ProductsListReportsPage() {
    const [allItems, setAllItems] = useState<ItemDocument[]>([]);
    const [displayedItems, setDisplayedItems] = useState<ItemDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filterName, setFilterName] = useState('');
    const [filterBrand, setFilterBrand] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('');
    const [filterItemCode, setFilterItemCode] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Items
                const itemsQuery = query(collection(firestore, "quote_items"), orderBy("createdAt", "desc"));
                const itemsSnapshot = await getDocs(itemsQuery);
                const fetchedItems = itemsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as ItemDocument));
                setAllItems(fetchedItems);
                setDisplayedItems(fetchedItems);
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
        let filtered = [...allItems];

        if (filterName) {
            filtered = filtered.filter(item => item.itemName?.toLowerCase().includes(filterName.toLowerCase()));
        }

        if (filterBrand) {
            filtered = filtered.filter(item => item.brandName?.toLowerCase().includes(filterBrand.toLowerCase()));
        }

        if (filterSupplier) {
            filtered = filtered.filter(item => item.supplierName?.toLowerCase().includes(filterSupplier.toLowerCase()));
        }

        if (filterItemCode) {
            filtered = filtered.filter(item => item.itemCode?.toLowerCase().includes(filterItemCode.toLowerCase()));
        }

        setDisplayedItems(filtered);
    }, [allItems, filterName, filterBrand, filterSupplier, filterItemCode]);


    const clearFilters = () => {
        setFilterName('');
        setFilterBrand('');
        setFilterSupplier('');
        setFilterItemCode('');
    };

    // Calculations
    const totalItems = displayedItems.length;
    // We could calculate average price or something, but simple count is enough for generic report.
    const averagePrice = totalItems > 0
        ? displayedItems.reduce((sum, item) => sum + (item.salesPrice || 0), 0) / totalItems
        : 0;

    const downloadPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Products List Report", 14, 20);

        doc.setFontSize(10);
        doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 14, 30);

        doc.text(`Total Items: ${totalItems}`, 14, 40);
        doc.text(`Average Listed Price: ${averagePrice.toLocaleString()}`, 14, 45);

        const tableColumn = ["Model No", "Item Code", "Brand", "Supplier", "Unit", "Price"];
        const tableRows = displayedItems.map(item => [
            item.itemName || 'N/A',
            item.itemCode || 'N/A',
            item.brandName || 'N/A',
            item.supplierName || 'N/A',
            item.unit || 'N/A',
            Number(item.salesPrice || 0).toLocaleString()
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 55,
        });

        doc.save(`products_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const downloadCSV = () => {
        const headers = ["Model No,Item Code,Brand,Supplier,Unit,Price"];
        const rows = displayedItems.map(item => [
            `"${item.itemName || ''}"`,
            `"${item.itemCode || ''}"`,
            `"${item.brandName || ''}"`,
            `"${item.supplierName || ''}"`,
            `"${item.unit || ''}"`,
            `"${item.salesPrice || 0}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `products_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
                        Products List Reports
                    </CardTitle>
                    <CardDescription>
                        Generate and download reports for your product catalog.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="space-y-2">
                            <Label>Model Number</Label>
                            <Input
                                placeholder="Search Model"
                                value={filterName}
                                onChange={(e) => setFilterName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Item Code</Label>
                            <Input
                                placeholder="Search Code"
                                value={filterItemCode}
                                onChange={(e) => setFilterItemCode(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Brand</Label>
                            <Input
                                placeholder="Search Brand"
                                value={filterBrand}
                                onChange={(e) => setFilterBrand(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Supplier</Label>
                            <Input
                                placeholder="Search Supplier"
                                value={filterSupplier}
                                onChange={(e) => setFilterSupplier(e.target.value)}
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
                                <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                                <p className="text-2xl font-bold text-primary">{totalItems}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-sm">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm font-medium text-muted-foreground">Avg. Sales Price</p>
                                <p className="text-2xl font-bold text-primary">{averagePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
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
                                    <TableHead>Model No</TableHead>
                                    <TableHead>Item Code</TableHead>
                                    <TableHead>Brand</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead className="text-right">Sales Price</TableHead>
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
                                            <TableCell className="font-medium">{item.itemName || 'N/A'}</TableCell>
                                            <TableCell>{item.itemCode || 'N/A'}</TableCell>
                                            <TableCell>{item.brandName || 'N/A'}</TableCell>
                                            <TableCell>{item.supplierName || 'N/A'}</TableCell>
                                            <TableCell>{item.unit || 'N/A'}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {Number(item.salesPrice || 0).toLocaleString()}
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
