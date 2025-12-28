"use client";

import React, { useState } from 'react';
import { X, Calendar, UploadCloud, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ClaimDetailsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    category?: string;
}

export function ClaimDetailsSheet({ isOpen, onClose, category = "Transportation" }: ClaimDetailsSheetProps) {
    const [amount, setAmount] = useState('1');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [description, setDescription] = useState('');

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-slate-50 border-0 h-[90vh] sm:h-auto flex flex-col rounded-t-[2rem]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 bg-white border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {/* Back/Close button logic if preferred, or just title */}
                        <h2 className="text-lg font-bold text-slate-800">{category}</h2>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto bg-white p-5 space-y-6">
                    {/* Claim Amount */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-800">Claim Amount <span className="text-red-500">*</span></Label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="h-12 bg-white border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus-visible:ring-blue-500"
                        />
                    </div>

                    {/* Dates Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-800">From Date <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <div className="h-12 w-full bg-white rounded-xl border border-slate-200 flex items-center px-4 justify-between text-sm font-bold text-slate-800">
                                    {fromDate || "Select"}
                                    <div className="h-8 w-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-800">To Date <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <div className="h-12 w-full bg-white rounded-xl border border-slate-200 flex items-center px-4 justify-between text-sm font-bold text-slate-800">
                                    {toDate || "Select"}
                                    <div className="h-8 w-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-800">Description <span className="text-red-500">*</span></Label>
                        <Textarea
                            placeholder="Enter description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[120px] bg-white border-slate-200 rounded-xl text-sm font-medium placeholder:text-slate-300 resize-none focus-visible:ring-blue-500 p-4"
                        />
                    </div>

                    {/* Upload File */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-800">Upload File</Label>
                        <div className="h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-500">
                                <UploadCloud className="h-6 w-6" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-slate-500">Attach Your File</p>
                                <p className="text-[10px] text-slate-400">Maximum file size: 300 KB</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Button */}
                <div className="p-4 bg-white border-t border-slate-100 pb-8">
                    <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200">
                        Add
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
