"use client";

import React, { useState, useMemo } from 'react';
import { X, Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, addDoc, where, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { AssetCategoryDocument, AssetDocument } from '@/types';
import Swal from 'sweetalert2';

interface AssetRequestSheetProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AssetRequestSheet({ isOpen, onClose }: AssetRequestSheetProps) {
    const { user, firestoreUser } = useAuth();
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [category, setCategory] = useState('');
    const [selectedAssetId, setSelectedAssetId] = useState('');
    const [requisition, setRequisition] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch categories
    const { data: categories } = useFirestoreQuery<AssetCategoryDocument[]>(
        query(collection(firestore, "asset_categories"), orderBy("createdAt", "desc")),
        undefined,
        ['asset_categories']
    );

    // Fetch available assets for selected category
    const selectedCategoryId = categories?.find(c => c.name === category)?.id;
    const { data: assetsInCategory } = useFirestoreQuery<AssetDocument[]>(
        query(
            collection(firestore, "assets"),
            where("categoryName", "==", category || 'dummy')
        ),
        undefined,
        [`assets_by_category_${category}`],
        !!category
    );

    // Filter for available assets client-side to avoid composite index requirement
    const availableAssets = useMemo(() => {
        const filtered = assetsInCategory?.filter(asset => asset.status === 'Available') || [];
        return filtered;
    }, [assetsInCategory]);

    const handleSubmit = async () => {
        if (!user || !fromDate || !category || !requisition) {
            // Simple validation
            return;
        }


        setIsSubmitting(true);
        try {

            const selectedCategory = categories?.find(c => c.name === category);
            const preferredAsset = availableAssets?.find(a => a.id === selectedAssetId);

            const employeeCode = user.uid || 'N/A';
            const employeeName = firestoreUser?.displayName || user.displayName || 'Unknown';
            const formattedEmployeeName = employeeCode !== 'N/A' ? `${employeeName} (${employeeCode})` : employeeName;

            const docRef = await addDoc(collection(firestore, "asset_requisitions"), {
                employeeId: user.uid,
                employeeCode: employeeCode,
                employeeName: formattedEmployeeName,
                employeePhotoUrl: firestoreUser?.photoURL || user.photoURL || '',
                employeeDesignation: 'N/A',
                jobStatus: 'Active',
                assetCategoryName: category,
                assetCategoryId: selectedCategory?.id || '',
                preferredAssetId: preferredAsset?.id || null,
                preferredAssetName: preferredAsset?.title || null,
                details: requisition,
                fromDate: fromDate,
                toDate: toDate,
                status: 'Pending',
                createdAt: serverTimestamp(),
            });

            Swal.fire({
                icon: 'success',
                title: 'Request Submitted',
                text: 'Your asset request has been submitted successfully.',
                timer: 2000,
                showConfirmButton: false
            });

            onClose();
            // Reset form
            setFromDate('');
            setToDate('');
            setCategory('');
            setSelectedAssetId('');
            setRequisition('');
        } catch (error) {
            console.error("Error submitting request:", error);
            Swal.fire({
                icon: 'error',
                title: 'Submission Failed',
                text: 'Failed to submit your request. Please try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-slate-50 border-0 h-[85vh] sm:h-auto flex flex-col rounded-t-[2rem]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 bg-white border-b border-slate-50 flex-shrink-0">
                    <h2 className="text-xl font-bold text-[#0A1E60] tracking-tight">Asset Request</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-300"
                    >
                        <X className="h-6 w-6" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto bg-white px-6 py-4 space-y-6">
                    {/* Dates Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-[#0A1E60]">From Date<span className="text-red-500">*</span></Label>
                            <Input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="h-12 w-full bg-white rounded-xl border border-slate-200 text-base font-bold text-[#0A1E60] shadow-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-[#0A1E60]">To Date (Optional)</Label>
                            <Input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="h-12 w-full bg-white rounded-xl border border-slate-200 text-base font-bold text-[#0A1E60] shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Asset Category */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-[#0A1E60]">Asset Category<span className="text-red-500">*</span></Label>
                        <Select value={category} onValueChange={(val) => {
                            setCategory(val);
                            setSelectedAssetId(''); // Reset available asset when category changes
                        }}>
                            <SelectTrigger className="h-14 w-full bg-slate-50/50 rounded-xl border border-slate-200 text-sm font-semibold text-[#0A1E60] shadow-sm">
                                <SelectValue placeholder="Select Asset Category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories?.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Available Assets (Optional) */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-[#0A1E60]">Available Assets (Optional)</Label>
                        <Select
                            value={selectedAssetId}
                            onValueChange={setSelectedAssetId}
                            disabled={!category}
                        >
                            <SelectTrigger className="h-12 w-full bg-slate-50/50 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 shadow-sm disabled:opacity-50">
                                <SelectValue placeholder={!category ? "Select Category First" : "Select Specific Asset"} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableAssets && availableAssets.length > 0 ? (
                                    availableAssets.map((asset) => (
                                        <SelectItem key={asset.id} value={asset.id || 'unknown'}>
                                            {asset.title} {asset.code ? `[${asset.code}]` : ''}
                                        </SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="none" disabled className="text-xs text-slate-400 justify-center">
                                        {category ? "No available assets in this category" : "Select a category to view assets"}
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Requisition */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-[#0A1E60]">Requisition<span className="text-red-500">*</span></Label>
                        <Textarea
                            value={requisition}
                            onChange={(e) => setRequisition(e.target.value)}
                            className="min-h-[120px] bg-slate-50/30 border-slate-200 rounded-xl text-sm font-medium placeholder:text-slate-300 resize-none focus-visible:ring-blue-500 p-4 shadow-sm"
                        />
                    </div>
                </div>

                {/* Footer Button */}
                <div className="p-6 bg-white border-t border-slate-50 pb-8">
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
