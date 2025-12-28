"use client";

import React, { useState } from 'react';
import { X, Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface AssetRequestSheetProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AssetRequestSheet({ isOpen, onClose }: AssetRequestSheetProps) {
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [category, setCategory] = useState('');
    const [requisition, setRequisition] = useState('');

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
                            <div className="relative">
                                <div className="h-12 w-full bg-white rounded-xl border border-slate-200 flex items-center px-4 justify-between text-base font-bold text-[#0A1E60] shadow-sm">
                                    {fromDate || "Select"}
                                    <div className="h-9 w-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-[#0A1E60]">To Date<span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <div className="h-12 w-full bg-white rounded-xl border border-slate-200 flex items-center px-4 justify-between text-base font-bold text-[#0A1E60] shadow-sm">
                                    {toDate || "Select"}
                                    <div className="h-9 w-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Asset Category */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-[#0A1E60]">Asset Category<span className="text-red-500">*</span></Label>
                        <div className="relative">
                            <div className="h-14 w-full bg-slate-50/50 rounded-xl border border-slate-200 flex items-center px-4 justify-between text-sm font-semibold text-[#0A1E60] shadow-sm">
                                {category || "Select Asset Category"}
                                <ChevronDown className="h-5 w-5 text-slate-400" />
                            </div>
                        </div>
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
                    <Button className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200">
                        Submit
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
