
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
    Loader2,
    Save,
    FileCode,
    Wrench,
    AlertCircle,
    Settings,
    Tag,
    Hash,
    Link as LinkIcon
} from 'lucide-react';
import { createErrorCode, updateErrorCode } from '@/lib/firebase/warranty';
import type { ErrorCodeRecord } from '@/types/warranty';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

interface ErrorCodeFormProps {
    initialData?: ErrorCodeRecord;
    isEdit?: boolean;
}

export function ErrorCodeForm({ initialData, isEdit }: ErrorCodeFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form States
    const [errorCode, setErrorCode] = useState(initialData?.errorCode || '');
    const [machineModel, setMachineModel] = useState(initialData?.machineModel || '');
    const [brand, setBrand] = useState(initialData?.brand || '');
    const [category, setCategory] = useState(initialData?.category || '');
    const [problem, setProblem] = useState(initialData?.problem || '');
    const [solution, setSolution] = useState(initialData?.solution || '');
    const [fileUrl, setFileUrl] = useState(initialData?.fileUrl || '');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!errorCode || !machineModel || !brand || !problem || !solution) {
            Swal.fire("Error", "All fields except Category and File URL are required", "error");
            return;
        }

        setIsSubmitting(true);

        try {
            const recordData = {
                errorCode,
                machineModel,
                brand,
                category,
                problem,
                solution,
                fileUrl
            };

            if (isEdit && initialData) {
                await updateErrorCode(initialData.id, recordData);
                Swal.fire("Success", "Error code updated successfully", "success");
            } else {
                await createErrorCode(recordData);
                Swal.fire("Success", "Error code created successfully", "success");
            }

            const isMobile = window.location.pathname.includes('/mobile/');
            router.push(isMobile ? '/mobile/service/error-codes' : '/dashboard/warranty-management/error-codes');
            router.refresh();

        } catch (error: any) {
            console.error("Error saving error code:", error);
            Swal.fire("Error", error.message || "Failed to save error code", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Identification Info */}
                <div className="space-y-6">
                    <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Hash className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Identification</h3>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="errorCode" className="text-sm font-semibold">Error Code *</Label>
                            <Input
                                id="errorCode"
                                value={errorCode}
                                onChange={(e) => setErrorCode(e.target.value)}
                                placeholder="e.g. E-01"
                                className="h-12 border-slate-200 focus:ring-primary rounded-xl bg-white"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="brand" className="text-sm font-semibold">Brand *</Label>
                                <Input
                                    id="brand"
                                    value={brand}
                                    onChange={(e) => setBrand(e.target.value)}
                                    placeholder="e.g. Brother"
                                    className="h-12 border-slate-200 focus:ring-primary rounded-xl bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="machineModel" className="text-sm font-semibold">Machine Model *</Label>
                                <Input
                                    id="machineModel"
                                    value={machineModel}
                                    onChange={(e) => setMachineModel(e.target.value)}
                                    placeholder="e.g. SN-800"
                                    className="h-12 border-slate-200 focus:ring-primary rounded-xl bg-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="category" className="text-sm font-semibold">Category (Optional)</Label>
                            <Input
                                id="category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="e.g. Motor Error"
                                className="h-12 border-slate-200 focus:ring-primary rounded-xl bg-white"
                            />
                        </div>
                    </div>

                    {/* Technical Guide */}
                    <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <LinkIcon className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Technical Guide</h3>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fileUrl" className="text-sm font-semibold">Guide URL (Cloudinary Repo)</Label>
                            <Input
                                id="fileUrl"
                                type="url"
                                value={fileUrl}
                                onChange={(e) => setFileUrl(e.target.value)}
                                placeholder="https://res.cloudinary.com/..."
                                className="h-12 border-slate-200 focus:ring-primary rounded-xl bg-white text-xs"
                            />
                            <p className="text-[10px] text-slate-500 italic px-1">Link to a detailed PDF or image documentation for this error.</p>
                        </div>
                    </div>
                </div>

                {/* Content Info */}
                <div className="space-y-6">
                    <div className="bg-rose-50/30 p-6 rounded-3xl border border-rose-100/50 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-rose-500" />
                            <h3 className="text-sm font-bold text-rose-700 uppercase tracking-wider">Problem Details *</h3>
                        </div>
                        <div className="space-y-2">
                            <Textarea
                                id="problem"
                                value={problem}
                                onChange={(e) => setProblem(e.target.value)}
                                placeholder="Describe the symptoms and root cause..."
                                className="min-h-[120px] border-rose-200/50 focus:ring-rose-500 rounded-2xl bg-white resize-none"
                            />
                        </div>
                    </div>

                    <div className="bg-emerald-50/30 p-6 rounded-3xl border border-emerald-100/50 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Wrench className="h-4 w-4 text-emerald-500" />
                            <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wider">Suggested Solution *</h3>
                        </div>
                        <div className="space-y-2">
                            <Textarea
                                id="solution"
                                value={solution}
                                onChange={(e) => setSolution(e.target.value)}
                                placeholder="Step-by-step instructions to resolve the error..."
                                className="min-h-[170px] border-emerald-200/50 focus:ring-emerald-500 rounded-2xl bg-white resize-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-4 pt-8 border-t border-slate-100">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                    className="h-12 px-8 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-12 px-10 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            {isEdit ? 'Updating...' : 'Creating...'}
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-5 w-5" />
                            {isEdit ? 'Update Error Code' : 'Save Error Code'}
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}
