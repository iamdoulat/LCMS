"use client";

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FileDown, FileText } from 'lucide-react';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, where, orderBy, Timestamp } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import type { ItemDocument, ItemCategoryDocument, ItemSectionDocument } from '@/types';

interface InventoryReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type ReportType = 'current_stock' | 'low_stock';

export function InventoryReportDialog({ open, onOpenChange }: InventoryReportDialogProps) {
    const { companyLogoUrl, companyName } = useAuth();
    const [reportType, setReportType] = React.useState<ReportType>('current_stock');
    const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
    const [selectedSection, setSelectedSection] = React.useState<string>('all');
    const [selectedBrand, setSelectedBrand] = React.useState<string>('all');
    const [isGenerating, setIsGenerating] = React.useState(false);

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
            // Fallback to canvas method if fetch fails (e.g. strict CORS but image loadable)
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.src = url;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject('Canvas context not available');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = (e) => reject(e);
            });
        }
    };

    // Fetch filter options
    const { data: categories } = useFirestoreQuery<ItemCategoryDocument[]>(query(collection(firestore, 'item_categories')), undefined, ['item_categories']);
    const { data: sections } = useFirestoreQuery<ItemSectionDocument[]>(query(collection(firestore, 'item_sections')), undefined, ['item_sections']);

    // We'll fetch brands dynamically from items effectively, or if there is a brands collection. 
    // Assuming brands are free text on items for now based on EditItemForm, but let's see if we can get a list.
    // For now, let's keep Brand filter as a text input or skip if not critical, but user asked for "Brand wise".
    // Let's use a text input for Brand for now as getting unique brands from all items is expensive client-side without aggregation.
    const [brandFilter, setBrandFilter] = React.useState('');

    const fetchReportData = async () => {
        let q = query(collection(firestore, 'items'));

        // Note: detailed filtering often requires composite indexes in Firestore. 
        // We will do client-side filtering for flexibility unless dataset is huge.

        const snapshot = await getDocs(q);
        let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ItemDocument));

        // Client-side filtering
        items = items.filter(item => {
            // Report Type Filter
            if (reportType === 'low_stock') {
                const current = item.currentQuantity || 0;
                const warning = item.warningQuantity || 0;
                if (current > warning) return false;
            }

            // Category Filter
            if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

            // Section Filter
            if (selectedSection !== 'all' && item.itemSection !== selectedSection) return false;

            // Brand Filter (Case insensitive partial match)
            if (brandFilter && !item.brandName?.toLowerCase().includes(brandFilter.toLowerCase())) return false;

            return true;
        });

        return items;
    };

    const generatePDF = async () => {
        setIsGenerating(true);
        try {
            const items = await fetchReportData();
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // Add Logo if available
            if (companyLogoUrl) {
                try {
                    const logoData = await getDataUrl(companyLogoUrl);
                    // Add image at top right: x = pageWidth - 50 (approx width) - 14 (margin), y = 10
                    doc.addImage(logoData, 'PNG', pageWidth - 40, 10, 25, 25);
                } catch (error) {
                    console.warn("Could not add logo to PDF:", error);
                }
            }

            // Title
            doc.setFontSize(18);
            doc.text(companyName || 'Inventory Report', 14, 22);

            doc.setFontSize(14);
            doc.text('Inventory Report', 14, 30);

            doc.setFontSize(10);
            doc.text(`Type: ${reportType === 'current_stock' ? 'Current Stock' : 'Low Stock'}`, 14, 38);
            doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 44);

            const tableData = items.map(item => [
                item.itemName,
                item.itemCode || '-',
                item.brandName || '-',
                item.category,
                item.currentQuantity || 0,
                item.unit || 'pcs',
                item.location || '-'
            ]);

            autoTable(doc, {
                startY: 50,
                head: [['Item Name', 'Code', 'Brand', 'Category', 'Qty', 'Unit', 'Location']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [66, 66, 66] },
            });

            doc.save(`inventory-report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const generateCSV = async () => {
        setIsGenerating(true);
        try {
            const items = await fetchReportData();

            const headers = ['Item Name', 'Item Code', 'Brand', 'Category', 'Section', 'Current Quantity', 'Unit', 'Sales Price', 'Purchase Price', 'Location', 'Warehouse'];
            const csvContent = [
                headers.join(','),
                ...items.map(item => [
                    `"${item.itemName.replace(/"/g, '""')}"`,
                    `"${item.itemCode || ''}"`,
                    `"${item.brandName || ''}"`,
                    `"${item.category || ''}"`,
                    `"${item.itemSection || ''}"`,
                    item.currentQuantity || 0,
                    `"${item.unit || ''}"`,
                    item.salesPrice || 0,
                    item.purchasePrice || 0,
                    `"${item.location || ''}"`,
                    `"${item.warehouseName || ''}"`
                ].join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `inventory-report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Error generating CSV:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Generate Inventory Report</DialogTitle>
                    <DialogDescription>
                        Select filters to generate a customized inventory report.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Report Type</Label>
                        <div className="col-span-3">
                            <Select value={reportType} onValueChange={(v: ReportType) => setReportType(v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="current_stock">Current Stock</SelectItem>
                                    <SelectItem value="low_stock">Low Stock Alerts</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Category</Label>
                        <div className="col-span-3">
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories?.map(cat => (
                                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Section</Label>
                        <div className="col-span-3">
                            <Select value={selectedSection} onValueChange={setSelectedSection}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Sections" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sections</SelectItem>
                                    {sections?.map(sec => (
                                        <SelectItem key={sec.id} value={sec.name}>{sec.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Brand (Search)</Label>
                        <div className="col-span-3">
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Filter by brand name..."
                                value={brandFilter}
                                onChange={(e) => setBrandFilter(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex gap-2 sm:justify-end">
                    <Button variant="outline" onClick={() => generateCSV()} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        Export CSV
                    </Button>
                    <Button onClick={() => generatePDF()} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                        Download PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
