"use client";

import React, { useState } from 'react';
import { uploadFile } from '@/lib/storage/storage';
import { compressImage } from '@/lib/utils/image-compression';
import { Loader2, X, Calendar, UploadCloud, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ClaimDetail } from '@/types';
import Swal from 'sweetalert2';
import { format } from 'date-fns';

interface ClaimDetailsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (detail: ClaimDetail) => void;
    category: { id: string, name: string } | null;
    initialData?: ClaimDetail | null;
}

export function ClaimDetailsSheet({ isOpen, onClose, onSave, category, initialData }: ClaimDetailsSheetProps) {
    const [amount, setAmount] = useState<number | string>('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [description, setDescription] = useState('');
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    React.useEffect(() => {
        if (isOpen && initialData) {
            setAmount(initialData.amount);
            setFromDate(initialData.fromDate);
            setToDate(initialData.toDate);
            setDescription(initialData.description || '');
            // We don't populate attachmentFile here since it's a File object, 
            // but the URL remains in initialData.attachmentUrl
        } else if (isOpen && !initialData) {
            setAmount('');
            setFromDate('');
            setToDate('');
            setDescription('');
            setAttachmentFile(null);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-slate-50 border-0 h-[90vh] sm:h-auto flex flex-col rounded-t-[2rem]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 bg-white border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-800">{category?.name || 'Claim Details'}</h2>
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
                            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                            className="h-12 bg-white border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus-visible:ring-blue-500"
                        />
                    </div>

                    {/* Dates Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-800">From Date <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <div className="h-12 w-full bg-white rounded-xl border border-slate-200 px-4 flex items-center text-xs font-bold text-slate-800 pointer-events-none whitespace-nowrap overflow-hidden">
                                    {fromDate ? format(new Date(fromDate), 'dd, MMM yyyy') : 'Select'}
                                </div>
                                <Input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-800">To Date <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <div className="h-12 w-full bg-white rounded-xl border border-slate-200 px-4 flex items-center text-xs font-bold text-slate-800 pointer-events-none whitespace-nowrap overflow-hidden">
                                    {toDate ? format(new Date(toDate), 'dd, MMM yyyy') : 'Select'}
                                </div>
                                <Input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-800">Description</Label>
                        <Textarea
                            placeholder="Enter description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[120px] bg-white border-slate-200 rounded-xl text-sm font-medium placeholder:text-slate-300 resize-none focus-visible:ring-blue-500 p-4"
                        />
                    </div>

                    {/* Upload File */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-slate-800">Upload File</Label>
                            {initialData?.attachmentUrl && (
                                <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    onClick={() => window.open(initialData.attachmentUrl, '_blank')}
                                    className="text-blue-600 text-[10px] font-bold h-auto p-0 flex items-center gap-1"
                                >
                                    <Eye className="h-3 w-3" />
                                    View Current Attachment
                                </Button>
                            )}
                        </div>
                        <div className="relative">
                            <Input
                                type="file"
                                onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                                className="hidden"
                                id="mobile-file-upload"
                            />
                            <label
                                htmlFor="mobile-file-upload"
                                className="h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                            >
                                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-500">
                                    <UploadCloud className="h-6 w-6" />
                                </div>
                                <div className="text-center px-4">
                                    <p className="text-sm font-bold text-slate-500 truncate max-w-[200px]">
                                        {attachmentFile ? attachmentFile.name : "Attach Your File"}
                                    </p>
                                    <p className="text-[10px] text-slate-400">Maximum file size: 5 MB</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer Button */}
                <div className="p-4 bg-white border-t border-slate-100 pb-8">
                    <Button
                        onClick={async () => {
                            if (!category || !amount || !fromDate || !toDate) {
                                return;
                            }
                            setIsUploading(true);
                            try {
                                let downloadUrl = '';
                                if (attachmentFile) {
                                    const path = `claim-attachments/${Date.now()}_${attachmentFile.name}`;
                                    
                                    // Compress image "regulation make low"
                                    let fileToUpload: File | Blob = attachmentFile;
                                    if (attachmentFile.type.startsWith('image/')) {
                                        try {
                                            fileToUpload = await compressImage(attachmentFile, 1200, 1200, 0.6);
                                            console.log(`[COMPRESSION] Original: ${attachmentFile.size} bytes, Compressed: ${fileToUpload.size} bytes`);
                                        } catch (compErr) {
                                            console.error("[COMPRESSION] Failed, using original:", compErr);
                                        }
                                    }
                                    
                                    downloadUrl = await uploadFile(fileToUpload as File, path);
                                }

                                onSave({
                                    ...initialData,
                                    id: initialData?.id || crypto.randomUUID(),
                                    categoryId: category.id,
                                    categoryName: category.name,
                                    amount: Number(amount) || 0,
                                    fromDate: fromDate,
                                    toDate: toDate,
                                    description: description,
                                    attachmentUrl: downloadUrl || initialData?.attachmentUrl || ''
                                });

                                // Show Toast
                                Swal.fire({
                                    title: initialData ? "Updated!" : "Added!",
                                    text: initialData ? "Item updated." : "Item added to claim list.",
                                    icon: "success",
                                    toast: true,
                                    position: 'top-end',
                                    showConfirmButton: false,
                                    timer: 2000,
                                    timerProgressBar: true,
                                });

                                // Reset and close
                                setAmount('');
                                setFromDate('');
                                setToDate('');
                                setDescription('');
                                setAttachmentFile(null);
                                onClose();
                            } catch (error) {
                                console.error("Error saving detail", error);
                                Swal.fire({
                                    title: "Error",
                                    text: "Failed to upload attachment.",
                                    icon: "error",
                                    toast: true,
                                    position: 'top-end',
                                    showConfirmButton: false,
                                    timer: 3000,
                                });
                            } finally {
                                setIsUploading(false);
                            }
                        }}
                        disabled={isUploading || !amount || !fromDate || !toDate}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200"
                    >
                        {isUploading ? <Loader2 className="animate-spin h-5 w-5" /> : initialData ? "Update Item" : "Add Item"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
