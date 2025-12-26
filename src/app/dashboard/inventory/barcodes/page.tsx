"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { QrCode, Barcode as BarcodeIcon, Package, Tag, Warehouse, Layers, Printer } from 'lucide-react';
import { BarcodePreview } from '@/components/inventory/BarcodePreview';
import type {
    BarcodeType,
    BarcodeGenerationMode,
    BarcodeLabelSize,
    BarcodeLabel,
    ItemDocument
} from '@/types';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';

export default function BarcodesPage() {
    // Configuration State
    const [codeType, setCodeType] = useState<BarcodeType>('qrcode');
    const [generationMode, setGenerationMode] = useState<BarcodeGenerationMode>('item');
    const [labelSize, setLabelSize] = useState<BarcodeLabelSize>('small');
    const [showName, setShowName] = useState(true);
    const [showCode, setShowCode] = useState(true);
    const [showPrice, setShowPrice] = useState(true);

    // Data State
    const [allItems, setAllItems] = useState<ItemDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [generatedLabels, setGeneratedLabels] = useState<BarcodeLabel[]>([]);

    // Fetch items from Firestore
    useEffect(() => {
        const fetchItems = async () => {
            setIsLoading(true);
            try {
                const itemsQuery = query(collection(firestore, 'items'), orderBy('createdAt', 'desc'));
                const snapshot = await getDocs(itemsQuery);
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ItemDocument));
                setAllItems(items);
            } catch (error) {
                console.error('Error fetching items:', error);
                Swal.fire('Error', 'Failed to fetch items from database', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchItems();
    }, []);

    // Get unique values for different modes
    const uniqueBrands = useMemo(() => {
        const brands = new Set(allItems.map(item => item.brandName).filter(Boolean));
        return Array.from(brands).sort();
    }, [allItems]);

    const uniqueWarehouses = useMemo(() => {
        const warehouses = new Set(allItems.map(item => item.warehouseName).filter(Boolean));
        return Array.from(warehouses).sort();
    }, [allItems]);

    const uniqueCategories = useMemo(() => {
        const categories = new Set(allItems.map(item => item.category).filter(Boolean));
        return Array.from(categories).sort();
    }, [allItems]);

    const uniqueSections = useMemo(() => {
        const sections = new Set(allItems.map(item => item.itemSection).filter(Boolean));
        return Array.from(sections).sort();
    }, [allItems]);

    // Get filterable options based on generation mode
    const filterOptions = useMemo(() => {
        switch (generationMode) {
            case 'brand':
                return uniqueBrands.map(brand => ({ id: brand as string, label: brand as string }));
            case 'warehouse':
                return uniqueWarehouses.map(wh => ({ id: wh as string, label: wh as string }));
            case 'category':
                return uniqueCategories.map(cat => ({ id: cat as string, label: cat as string }));
            case 'section':
                return uniqueSections.map(sec => ({ id: sec as string, label: sec as string }));
            case 'item':
            default:
                return allItems
                    .filter(item =>
                        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.itemCode?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(item => ({
                        id: item.id as string,
                        label: `${item.itemName} ${item.itemCode ? `(${item.itemCode})` : ''}`
                    }));
        }
    }, [generationMode, allItems, uniqueBrands, uniqueWarehouses, uniqueCategories, uniqueSections, searchTerm]);

    // Handle selection toggle
    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    // Generate labels based on selection
    const handleGenerateLabels = () => {
        if (selectedIds.length === 0) {
            Swal.fire('No Selection', 'Please select at least one item/filter to generate labels', 'warning');
            return;
        }

        const itemsToGenerate: ItemDocument[] = [];

        switch (generationMode) {
            case 'item':
                itemsToGenerate.push(...allItems.filter(item => selectedIds.includes(item.id)));
                break;
            case 'brand':
                itemsToGenerate.push(...allItems.filter(item => item.brandName && selectedIds.includes(item.brandName)));
                break;
            case 'warehouse':
                itemsToGenerate.push(...allItems.filter(item => item.warehouseName && selectedIds.includes(item.warehouseName)));
                break;
            case 'category':
                itemsToGenerate.push(...allItems.filter(item => item.category && selectedIds.includes(item.category)));
                break;
            case 'section':
                itemsToGenerate.push(...allItems.filter(item => item.itemSection && selectedIds.includes(item.itemSection)));
                break;
        }

        const labels: BarcodeLabel[] = itemsToGenerate.map(item => ({
            id: item.id,
            itemName: item.itemName,
            itemCode: item.itemCode || item.id,
            price: item.salesPrice,
            currency: item.currency || 'BDT',
            qrData: JSON.stringify({
                code: item.itemCode || item.id,
                name: item.itemName,
                price: item.salesPrice,
                currency: item.currency || 'BDT',
            }),
        }));

        setGeneratedLabels(labels);
        Swal.fire({
            title: 'Labels Generated!',
            text: `${labels.length} label(s) ready to print`,
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
        });
    };

    // Remove a label from generated list
    const handleRemoveLabel = (id: string) => {
        setGeneratedLabels(prev => prev.filter(label => label.id !== id));
    };

    // Reset all settings
    const handleReset = () => {
        setSelectedIds([]);
        setGeneratedLabels([]);
        setSearchTerm('');
    };

    return (
        <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
            <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          .barcode-label {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          @page {
            size: A4;
            margin: 5mm;
          }
        }
      `}</style>

            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl lg:text-3xl">
                        <QrCode className="h-7 w-7 text-primary" />
                        Barcode/QR Code Generator
                    </CardTitle>
                    <CardDescription>
                        Generate barcodes or QR codes for inventory items with customizable labels
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Configuration Section */}
                    <div className="no-print space-y-6">
                        {/* Code Type & Generation Mode */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Code Type */}
                            <div className="space-y-3">
                                <Label className="text-base font-semibold">Code Type</Label>
                                <RadioGroup value={codeType} onValueChange={(v) => setCodeType(v as BarcodeType)}>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="barcode" id="barcode" />
                                        <Label htmlFor="barcode" className="flex items-center gap-2 cursor-pointer">
                                            <BarcodeIcon className="h-4 w-4" />
                                            Barcode (1D)
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="qrcode" id="qrcode" />
                                        <Label htmlFor="qrcode" className="flex items-center gap-2 cursor-pointer">
                                            <QrCode className="h-4 w-4" />
                                            QR Code (2D)
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {/* Generation Mode */}
                            <div className="space-y-3">
                                <Label className="text-base font-semibold">Generation Mode</Label>
                                <RadioGroup value={generationMode} onValueChange={(v) => {
                                    setGenerationMode(v as BarcodeGenerationMode);
                                    setSelectedIds([]);
                                    setSearchTerm('');
                                }}>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="item" id="item" />
                                        <Label htmlFor="item" className="flex items-center gap-2 cursor-pointer">
                                            <Package className="h-4 w-4" />
                                            Item-wise
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="brand" id="brand" />
                                        <Label htmlFor="brand" className="flex items-center gap-2 cursor-pointer">
                                            <Tag className="h-4 w-4" />
                                            Brand-wise
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="warehouse" id="warehouse" />
                                        <Label htmlFor="warehouse" className="flex items-center gap-2 cursor-pointer">
                                            <Warehouse className="h-4 w-4" />
                                            Warehouse-wise
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="category" id="category" />
                                        <Label htmlFor="category" className="flex items-center gap-2 cursor-pointer">
                                            <Layers className="h-4 w-4" />
                                            Category-wise
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="section" id="section" />
                                        <Label htmlFor="section" className="flex items-center gap-2 cursor-pointer">
                                            <Layers className="h-4 w-4" />
                                            Section-wise
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>

                        {/* Selection Area */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">
                                    Select {generationMode === 'item' ? 'Items' : generationMode.charAt(0).toUpperCase() + generationMode.slice(1) + 's'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {generationMode === 'item' && (
                                    <Input
                                        placeholder="Search items by name or code..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                )}

                                <div className="max-h-64 overflow-y-auto space-y-2 border rounded-md p-4">
                                    {isLoading ? (
                                        <p className="text-muted-foreground text-center">Loading...</p>
                                    ) : filterOptions.length === 0 ? (
                                        <p className="text-muted-foreground text-center">No items found</p>
                                    ) : (
                                        filterOptions.map(option => (
                                            <div key={option.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={option.id}
                                                    checked={selectedIds.includes(option.id)}
                                                    onCheckedChange={() => toggleSelection(option.id)}
                                                />
                                                <Label htmlFor={option.id} className="cursor-pointer flex-1">
                                                    {option.label}
                                                </Label>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="text-sm text-muted-foreground">
                                    Selected: {selectedIds.length} {generationMode === 'item' ? 'item' : generationMode}(s)
                                </div>
                            </CardContent>
                        </Card>

                        {/* Label Options */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Label Options</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Display Options */}
                                    <div className="space-y-3">
                                        <Label className="text-sm font-semibold">Display</Label>
                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="showName"
                                                    checked={showName}
                                                    onCheckedChange={(checked) => setShowName(!!checked)}
                                                />
                                                <Label htmlFor="showName" className="cursor-pointer">
                                                    Show Item Name
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="showCode"
                                                    checked={showCode}
                                                    onCheckedChange={(checked) => setShowCode(!!checked)}
                                                />
                                                <Label htmlFor="showCode" className="cursor-pointer">
                                                    Show Item Code
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="showPrice"
                                                    checked={showPrice}
                                                    onCheckedChange={(checked) => setShowPrice(!!checked)}
                                                />
                                                <Label htmlFor="showPrice" className="cursor-pointer">
                                                    Show Price
                                                </Label>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Label Size */}
                                    <div className="space-y-3">
                                        <Label className="text-sm font-semibold">Label Size</Label>
                                        <RadioGroup value={labelSize} onValueChange={(v) => setLabelSize(v as BarcodeLabelSize)}>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="small" id="small" />
                                                <Label htmlFor="small" className="cursor-pointer">
                                                    Small (40mm × 20mm)
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="medium" id="medium" />
                                                <Label htmlFor="medium" className="cursor-pointer">
                                                    Medium (50mm × 25mm)
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="large" id="large" />
                                                <Label htmlFor="large" className="cursor-pointer">
                                                    Large (60mm × 30mm)
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <Button
                                onClick={handleGenerateLabels}
                                size="lg"
                                className="flex-1"
                                disabled={selectedIds.length === 0}
                            >
                                <Printer className="mr-2 h-5 w-5" />
                                Generate Labels
                            </Button>
                            <Button
                                onClick={handleReset}
                                variant="outline"
                                size="lg"
                            >
                                Reset
                            </Button>
                        </div>
                    </div>

                    {/* Preview Section */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4 no-print">Preview</h3>
                        <BarcodePreview
                            labels={generatedLabels}
                            type={codeType}
                            size={labelSize}
                            showPrice={showPrice}
                            showName={showName}
                            showCode={showCode}
                            onRemoveLabel={handleRemoveLabel}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
