"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package, Printer, Filter, XCircle, Tag, Layers, Briefcase } from 'lucide-react';
import Swal from 'sweetalert2';
import type { ItemDocument, ItemCategoryDocument, ItemSectionDocument } from '@/types';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ALL_CATEGORIES_VALUE = "__ALL_CATEGORIES__";
const ALL_SECTIONS_VALUE = "__ALL_SECTIONS__";
const ALL_STOCK_LEVELS_VALUE = "__ALL_STOCK_LEVELS__";

export default function StockReportsPage() {
    const [allItems, setAllItems] = useState<ItemDocument[]>([]);
    const [categories, setCategories] = useState<ItemCategoryDocument[]>([]);
    const [sections, setSections] = useState<ItemSectionDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [filterCategory, setFilterCategory] = useState<string>('');
    const [filterSection, setFilterSection] = useState<string>('');
    const [filterBrand, setFilterBrand] = useState('');
    const [filterSearch, setFilterSearch] = useState('');
    const [filterStockLevel, setFilterStockLevel] = useState<string>('');

    const filteredItems = useMemo(() => {
        let filtered = [...allItems];
        if (filterCategory) filtered = filtered.filter(item => item.category === filterCategory);
        if (filterSection) filtered = filtered.filter(item => item.itemSection === filterSection);
        if (filterBrand) filtered = filtered.filter(item => item.brandName?.toLowerCase().includes(filterBrand.toLowerCase()));
        if (filterSearch) {
            const search = filterSearch.toLowerCase();
            filtered = filtered.filter(item =>
                item.itemName?.toLowerCase().includes(search) ||
                item.itemCode?.toLowerCase().includes(search)
            );
        }
        if (filterStockLevel) {
            if (filterStockLevel === 'low') {
                filtered = filtered.filter(item => (item.currentQuantity || 0) <= (item.warningQuantity || 0));
            } else if (filterStockLevel === 'out') {
                filtered = filtered.filter(item => (item.currentQuantity || 0) <= 0);
            } else if (filterStockLevel === 'healthy') {
                filtered = filtered.filter(item => (item.currentQuantity || 0) > (item.warningQuantity || 0));
            }
        }
        return filtered;
    }, [allItems, filterCategory, filterSection, filterBrand, filterSearch, filterStockLevel]);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            setFetchError(null);
            try {
                const itemsQuery = query(collection(firestore, "items"), orderBy("itemName"));
                const categoriesQuery = query(collection(firestore, "item_categories"), orderBy("name"));
                const sectionsQuery = query(collection(firestore, "item_sections"), orderBy("name"));

                const [itemsSnapshot, categoriesSnapshot, sectionsSnapshot] = await Promise.all([
                    getDocs(itemsQuery), getDocs(categoriesQuery), getDocs(sectionsQuery)
                ]);

                setAllItems(itemsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ItemDocument)));
                setCategories(categoriesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ItemCategoryDocument)));
                setSections(sectionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ItemSectionDocument)));

            } catch (error: any) {
                const msg = `Could not fetch data for reports. Error: ${error.message}`;
                setFetchError(msg);
                Swal.fire("Fetch Error", msg, "error");
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const clearFilters = () => {
        setFilterCategory('');
        setFilterSection('');
        setFilterBrand('');
        setFilterSearch('');
        setFilterStockLevel('');
    };

    const handlePrint = () => {
        if (filteredItems.length === 0) {
            Swal.fire("No Data", "There are no stock items matching the current filters to print.", "info");
            return;
        }
        const reportData = {
            items: filteredItems,
            filters: {
                category: filterCategory || 'All',
                section: filterSection || 'All',
                brand: filterBrand || 'All',
                search: filterSearch || 'All',
                stockLevel: filterStockLevel || 'All'
            },
            generatedAt: new Date().toISOString()
        };

        localStorage.setItem('stockReportData', JSON.stringify(reportData));
        window.open(`/dashboard/inventory/stock-reports/print`, '_blank');
    };

    return (
        <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
            <Card className="shadow-xl">
                <CardHeader className="noprint">
                    <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                        <Package className="h-7 w-7 text-primary" />
                        Stock Reports
                    </CardTitle>
                    <CardDescription>Generate and download inventory stock reports with advanced filters.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Card className="mb-6 shadow-md p-4 noprint">
                        <CardHeader className="p-2 pb-4">
                            <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
                                <div className="space-y-1">
                                    <Label>Search Item</Label>
                                    <Input placeholder="Name or Code..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="flex items-center"><Briefcase className="mr-1 h-4 w-4 text-muted-foreground" />Category</Label>
                                    <Select value={filterCategory || ALL_CATEGORIES_VALUE} onValueChange={(v) => setFilterCategory(v === ALL_CATEGORIES_VALUE ? '' : v)}>
                                        <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_CATEGORIES_VALUE}>All Categories</SelectItem>
                                            {categories.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="flex items-center"><Layers className="mr-1 h-4 w-4 text-muted-foreground" />Section</Label>
                                    <Select value={filterSection || ALL_SECTIONS_VALUE} onValueChange={(v) => setFilterSection(v === ALL_SECTIONS_VALUE ? '' : v)}>
                                        <SelectTrigger><SelectValue placeholder="All Sections" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_SECTIONS_VALUE}>All Sections</SelectItem>
                                            {sections.map(sec => <SelectItem key={sec.id} value={sec.name}>{sec.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="flex items-center"><Tag className="mr-1 h-4 w-4 text-muted-foreground" />Brand</Label>
                                    <Input placeholder="Search Brand..." value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label>Stock Level</Label>
                                    <Select value={filterStockLevel || ALL_STOCK_LEVELS_VALUE} onValueChange={(v) => setFilterStockLevel(v === ALL_STOCK_LEVELS_VALUE ? '' : v)}>
                                        <SelectTrigger><SelectValue placeholder="All Levels" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_STOCK_LEVELS_VALUE}>All Levels</SelectItem>
                                            <SelectItem value="healthy">Healthy Stock</SelectItem>
                                            <SelectItem value="low">Low Stock</SelectItem>
                                            <SelectItem value="out">Out of Stock</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="xl:col-start-5">
                                    <Button onClick={clearFilters} variant="outline" className="w-full"><XCircle className="mr-2 h-4 w-4" /> Clear Filters</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="my-4 text-center noprint">
                        <Button onClick={handlePrint} variant="default" className="bg-primary hover:bg-primary/90">
                            <Printer className="mr-2 h-4 w-4" /> Generate Report
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
                        ) : fetchError ? (
                            <div className="text-center text-destructive p-8">{fetchError}</div>
                        ) : filteredItems.length > 0 ? (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item Name</TableHead>
                                            <TableHead>Code</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead>Brand</TableHead>
                                            <TableHead className="text-right">Quantity</TableHead>
                                            <TableHead className="text-right">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredItems.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.itemName}</TableCell>
                                                <TableCell>{item.itemCode || 'N/A'}</TableCell>
                                                <TableCell>{item.category}</TableCell>
                                                <TableCell>{item.brandName || 'N/A'}</TableCell>
                                                <TableCell className="text-right">{item.currentQuantity || 0} {item.unit || ''}</TableCell>
                                                <TableCell className="text-right">
                                                    {(item.currentQuantity || 0) <= 0 ? (
                                                        <Badge variant="destructive">Out of Stock</Badge>
                                                    ) : (item.currentQuantity || 0) <= (item.warningQuantity || 0) ? (
                                                        <Badge variant="warning" className="bg-amber-500 text-white">Low Stock</Badge>
                                                    ) : (
                                                        <Badge variant="default" className="bg-green-500">Healthy</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center p-8 text-muted-foreground">No stock items found matching your criteria.</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
