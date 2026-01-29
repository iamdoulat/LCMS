"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, Package, MapPin, Loader2, ImageIcon, ScanLine, Filter, X, Clock, Building2, MoreVertical, Eye, EyeOff, Warehouse, RefreshCw, Edit, Plus } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { collection, query, orderBy, getDocs, limit, startAfter } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import type { ItemDocument } from '@/types';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export default function MobileInventoryPage() {
    const router = useRouter();
    const { userRole } = useAuth();
    const [items, setItems] = useState<ItemDocument[]>([]);
    const [filteredItems, setFilteredItems] = useState<ItemDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'All Items' | 'Low Stock' | 'Managed'>('All Items');
    const [visiblePriceItems, setVisiblePriceItems] = useState<Record<string, boolean>>({});
    const [visibleCount, setVisibleCount] = useState(10);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        name: '',
        code: '',
        brand: '',
        supplier: ''
    });

    const togglePriceVisibility = (itemId: string) => {
        setVisiblePriceItems(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
    };

    const clearFilters = () => {
        setFilters({ name: '', code: '', brand: '', supplier: '' });
        setSearchQuery('');
    };

    useEffect(() => {
        const fetchItems = async () => {
            setIsLoading(true);
            try {
                const itemsRef = collection(firestore, 'items');
                const q = query(itemsRef, orderBy('createdAt', 'desc'));
                const snapshot = await getDocs(q);

                const fetchedItems = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as ItemDocument));

                setItems(fetchedItems);
            } catch (error) {
                console.error("Error fetching items:", error);
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        };

        fetchItems();
    }, [isRefreshing]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setVisibleCount(10); // Reset pagination
    };

    const handleLoadMore = () => {
        setIsLoadingMore(true);
        // Simulate a small delay for better UX/realism
        setTimeout(() => {
            setVisibleCount(prev => prev + 10);
            setIsLoadingMore(false);
        }, 800);
    };

    // Apply filters based on tab, search, and specific filters
    const applyFiltersAndSearch = (itemsList: ItemDocument[], search: string, tab: string, activeFilters: typeof filters) => {
        let filtered = [...itemsList];

        // Apply tab filter
        if (tab === 'Low Stock') {
            filtered = filtered.filter(item => {
                if (!item.manageStock) return false;
                const current = item.currentQuantity || 0;
                const warning = item.warningQuantity || 0;
                return current <= warning;
            });
        } else if (tab === 'Managed') {
            filtered = filtered.filter(item => item.manageStock === true);
        }

        // Apply search
        if (search.trim()) {
            const queryLower = search.toLowerCase();
            filtered = filtered.filter(item =>
                item.itemName.toLowerCase().includes(queryLower) ||
                item.itemCode?.toLowerCase().includes(queryLower) ||
                item.brandName?.toLowerCase().includes(queryLower)
            );
        }

        // Apply specific filters
        if (activeFilters.name) {
            filtered = filtered.filter(item => item.itemName.toLowerCase().includes(activeFilters.name.toLowerCase()));
        }
        if (activeFilters.code) {
            filtered = filtered.filter(item => item.itemCode?.toLowerCase().includes(activeFilters.code.toLowerCase()));
        }
        if (activeFilters.brand) {
            filtered = filtered.filter(item => item.brandName?.toLowerCase().includes(activeFilters.brand.toLowerCase()));
        }
        if (activeFilters.supplier) {
            filtered = filtered.filter(item => item.supplierName?.toLowerCase().includes(activeFilters.supplier.toLowerCase()));
        }

        setFilteredItems(filtered);
    };

    // Search Logic
    useEffect(() => {
        applyFiltersAndSearch(items, searchQuery, activeTab, filters);
    }, [searchQuery, activeTab, items, filters]);

    const formatCurrency = (value?: number) => {
        if (value === undefined || value === null) return 'N/A';
        return `BDT ${value.toLocaleString()}.00`;
    };

    const getStockStatus = (item: ItemDocument) => {
        if (!item.manageStock) return null;
        const current = item.currentQuantity || 0;
        const warning = item.warningQuantity || 0;

        if (current === 0) {
            return { label: 'Out of Stock', color: 'bg-red-50 text-red-600 border-red-200' };
        } else if (current <= warning) {
            return { label: 'Low Stock', color: 'bg-orange-50 text-orange-600 border-orange-200' };
        } else if (item.manageStock) {
            return { label: 'Managed', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
        }
        return null;
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60]">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-4 pb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white">Inventory</h1>

                    <div className="flex items-center gap-3">
                        {/* Refresh Button */}
                        <button
                            onClick={handleRefresh}
                            className={cn(
                                "p-2 rounded-full transition-all shadow-[0_0_15px_rgba(59,130,246,0.6)] bg-[#1a2b6d] text-white hover:bg-white/10",
                                isRefreshing && "animate-spin"
                            )}
                        >
                            <RefreshCw className="h-5 w-5" />
                        </button>

                        {/* Filter Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={cn(
                                "p-2 rounded-full transition-all shadow-[0_0_15px_rgba(59,130,246,0.6)]", // App color outer shadow (glow)
                                showFilters ? "bg-white text-blue-600" : "bg-[#1a2b6d] text-white hover:bg-white/10"
                            )}
                        >
                            <Filter className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content with Rounded Top */}
            <div className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col">
                {/* Tabs */}
                <div className="px-4 pt-4 pb-3 bg-slate-50 sticky top-0 z-10">
                    <div className="flex gap-2">
                        {(['All Items', 'Low Stock', 'Managed'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap",
                                    activeTab === tab
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="px-4 pb-3 bg-slate-50 sticky top-[60px] z-10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search items, code, brand..."
                            className="pl-9 bg-white border-slate-200 focus-visible:ring-blue-500 rounded-xl"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                            >
                                <X className="h-4 w-4 text-slate-400" />
                            </button>
                        )}
                    </div>

                    {/* Filter Options Panel */}
                    {showFilters && (
                        <div className="mt-3 bg-white rounded-xl p-4 border border-slate-200 shadow-sm animate-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 mb-3 text-blue-600">
                                <Filter className="h-4 w-4" />
                                <span className="text-sm font-semibold">Filter Options</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-slate-500 uppercase">Item Name</label>
                                    <Input
                                        placeholder="Search by Item Name..."
                                        className="h-8 text-xs bg-slate-50"
                                        value={filters.name}
                                        onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-slate-500 uppercase">Item Code/SKU</label>
                                    <Input
                                        placeholder="Search by Item Code..."
                                        className="h-8 text-xs bg-slate-50"
                                        value={filters.code}
                                        onChange={(e) => setFilters(prev => ({ ...prev, code: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-slate-500 uppercase">Brand Name</label>
                                    <Input
                                        placeholder="Search by Brand Name..."
                                        className="h-8 text-xs bg-slate-50"
                                        value={filters.brand}
                                        onChange={(e) => setFilters(prev => ({ ...prev, brand: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-slate-500 uppercase">Supplier Name</label>
                                    <Input
                                        placeholder="Search by Supplier..."
                                        className="h-8 text-xs bg-slate-50"
                                        value={filters.supplier}
                                        onChange={(e) => setFilters(prev => ({ ...prev, supplier: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={clearFilters}
                                className="w-full mt-4 h-8 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 gap-2"
                            >
                                <X className="h-3 w-3" />
                                Clear Filters
                            </Button>
                        </div>
                    )}

                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 pb-8">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                            <span className="text-sm">Loading inventory...</span>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Package className="h-12 w-12 mb-3 opacity-20" />
                            <h3 className="text-base font-semibold text-slate-600">No items found</h3>
                            <p className="text-xs text-center px-8 mt-1">
                                {searchQuery ? 'Try adjusting your search' : 'No items match the current filter'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3 pb-20"> {/* Add padding bottom for Load More button space */}
                            {filteredItems.slice(0, visibleCount).map((item) => {
                                const stockStatus = getStockStatus(item);

                                return (
                                    <Card key={item.id} className="bg-white border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] overflow-hidden hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.15)] transition-shadow">
                                        <div className="p-4">
                                            <div className="flex gap-3">
                                                {/* Icon/Image */}
                                                <div className="h-16 w-16 bg-slate-100 rounded-xl flex-shrink-0 overflow-hidden border border-slate-200 flex items-center justify-center">
                                                    {item.photoURL || item.imageUrl ? (
                                                        <img
                                                            src={item.photoURL || item.imageUrl}
                                                            alt={item.itemName}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <Package className="h-8 w-8 text-slate-400" />
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <h3 className="font-bold text-blue-600 text-sm leading-tight">
                                                            {item.itemName}
                                                        </h3>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className="w-8 h-8 rounded-full bg-white shadow-[0_0_10px_rgba(59,130,246,0.2)] hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] border border-blue-50 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shrink-0">
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                                                {userRole?.some(role => ['Super Admin', 'Admin', 'Accountant'].includes(role)) && (
                                                                    <DropdownMenuItem
                                                                        onClick={() => router.push(`/mobile/inventory/edit/${item.id}`)}
                                                                        className="flex items-center gap-2 text-slate-600 cursor-pointer"
                                                                    >
                                                                        <Edit className="h-4 w-4" />
                                                                        <span>Edit</span>
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>

                                                    {/* Item Code & Company - Single Line */}
                                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-0.5">
                                                        {item.itemCode && (
                                                            <>
                                                                <span className="font-medium">Item Code:</span>
                                                                <span>{item.itemCode}</span>
                                                            </>
                                                        )}
                                                        {item.itemCode && item.brandName && <span>•</span>}
                                                        {item.brandName && <span>{item.brandName}</span>}
                                                    </div>

                                                    {/* Supplier with building icon */}
                                                    {item.supplierName && (
                                                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-3">
                                                            <Building2 className="h-3 w-3 text-blue-500" />
                                                            <span>{item.supplierName}</span>
                                                        </div>
                                                    )}

                                                    {/* Pricing & Country of Origin - Two Column Layout */}
                                                    <div className="flex items-start justify-between gap-3">
                                                        {/* Two Column Grid for Pricing and Country */}
                                                        <div className="grid grid-cols-2 gap-4 flex-1">
                                                            {/* Column 1: Pricing */}
                                                            <div className="space-y-0.5">
                                                                <div className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide mb-1">
                                                                    Pricing
                                                                </div>
                                                                <div className="text-[11px] text-slate-700 font-medium">
                                                                    <span className="font-medium">Sell:</span> {formatCurrency(item.salesPrice)}
                                                                </div>
                                                                <div className="text-[11px] text-slate-600 flex items-center gap-1">
                                                                    <span className="font-medium">Buy:</span>
                                                                    <span>
                                                                        {visiblePriceItems[item.id]
                                                                            ? formatCurrency(item.purchasePrice)
                                                                            : '******'}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => togglePriceVisibility(item.id)}
                                                                        className="ml-0.5 text-slate-400 hover:text-slate-600"
                                                                    >
                                                                        {visiblePriceItems[item.id]
                                                                            ? <EyeOff className="h-3 w-3 text-amber-500" />
                                                                            : <Eye className="h-3 w-3 text-amber-500" />}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Column 2: Country of Origin */}
                                                            <div className="space-y-0.5">
                                                                <div className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide mb-1">
                                                                    Origin
                                                                </div>
                                                                <div className="text-[11px] text-slate-700 font-medium">
                                                                    {item.countryOfOrigin || 'N/A'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right: Status & Location */}
                                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                            {/* Status Badge */}
                                                            {item.manageStock ? (
                                                                <Badge
                                                                    className={cn(
                                                                        "text-[10px] font-bold px-2.5 py-0.5 border rounded-full whitespace-nowrap",
                                                                        stockStatus?.color || "bg-emerald-50 text-emerald-600 border-emerald-200"
                                                                    )}
                                                                >
                                                                    {stockStatus?.label || 'Managed'}: {item.currentQuantity || 0}
                                                                </Badge>
                                                            ) : (
                                                                stockStatus && (
                                                                    <Badge
                                                                        className={cn(
                                                                            "text-[10px] font-bold px-2.5 py-0.5 border rounded-full",
                                                                            stockStatus.color
                                                                        )}
                                                                    >
                                                                        {stockStatus.label}
                                                                    </Badge>
                                                                )
                                                            )}

                                                            {/* Location */}
                                                            {item.location && (
                                                                <div className="flex items-center gap-1 text-slate-500">
                                                                    <MapPin className="h-3 w-3 text-rose-500" />
                                                                    <span className="text-[11px] font-medium">
                                                                        {item.location}
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {/* Warehouse */}
                                                            {item.warehouseName && (
                                                                <div className="flex items-center gap-1 text-slate-500">
                                                                    <Warehouse className="h-3 w-3 text-indigo-500" />
                                                                    <span className="text-[11px] font-medium">
                                                                        {item.warehouseName}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}

                            {/* Load More Button */}
                            {visibleCount < filteredItems.length && (
                                <div className="mt-6 mb-8 text-center">
                                    <Button
                                        onClick={handleLoadMore}
                                        variant="outline"
                                        disabled={isLoadingMore}
                                        className="bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100 hover:text-blue-700 min-w-[150px] shadow-[0_4px_12px_rgba(59,130,246,0.15)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.25)] font-medium"
                                    >
                                        {isLoadingMore ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Loading...</span>
                                            </div>
                                        ) : (
                                            <span>Load More</span>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div >
            {/* Floating Action Button */}
            {userRole?.some(role => ['Super Admin', 'Admin', 'Accountant'].includes(role)) && (
                <button
                    onClick={() => router.push('/mobile/inventory/add')}
                    className="fixed right-6 bottom-24 w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-blue-400 hover:scale-110 active:scale-95 transition-all z-50"
                >
                    <Plus className="h-8 w-8 text-white" />
                </button>
            )}
        </div>
    );
}
