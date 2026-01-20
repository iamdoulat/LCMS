
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
    Loader2,
    Upload,
    X,
    Image as ImageIcon,
    FileText,
    Film,
    Plus,
    Trash2,
    Save,
    AlertCircle
} from 'lucide-react';
import { uploadCatalogueFile, createCatalogue, updateCatalogue } from '@/lib/firebase/warranty';
import type { MachineryCatalogue } from '@/types/warranty';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

interface CatalogueFormProps {
    initialData?: MachineryCatalogue;
    isEdit?: boolean;
}

export function CatalogueForm({ initialData, isEdit }: CatalogueFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form States
    const [title, setTitle] = useState(initialData?.title || '');
    const [subtitle, setSubtitle] = useState(initialData?.subtitle || '');
    const [machineModels, setMachineModels] = useState<string[]>(initialData?.machineModels || ['']);
    const [brand, setBrand] = useState(initialData?.brand || '');
    const [category, setCategory] = useState(initialData?.category || '');
    const [subCategory, setSubCategory] = useState(initialData?.subCategory || '');

    // URL States (Cloudinary/YouTube)
    const [fileUrl, setFileUrl] = useState(initialData?.fileUrl || '');
    const [insManualsUrl, setInsManualsUrl] = useState(initialData?.insManualsUrl || '');
    const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl || '');

    // File States (Thumbnail only)
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

    // Preview States
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(initialData?.thumbnailUrl || null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (file: File | null) => void, previewSetter?: (url: string | null) => void) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setter(file);
            if (previewSetter) {
                const reader = new FileReader();
                reader.onloadend = () => previewSetter(reader.result as string);
                reader.readAsDataURL(file);
            }
        }
    };

    const handleModelChange = (index: number, value: string) => {
        const newModels = [...machineModels];
        newModels[index] = value;
        setMachineModels(newModels);
    };

    const addModelField = () => {
        setMachineModels([...machineModels, '']);
    };

    const removeModelField = (index: number) => {
        if (machineModels.length > 1) {
            const newModels = machineModels.filter((_, i) => i !== index);
            setMachineModels(newModels);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const filteredModels = machineModels.filter(m => m.trim() !== '');

        if (!title || filteredModels.length === 0 || !brand || !fileUrl) {
            Swal.fire("Error", "Title, at least one Machine Model, Brand, and Catalogue URL are required", "error");
            return;
        }

        if (!isEdit && !thumbnailFile && !initialData?.thumbnailUrl) {
            Swal.fire("Error", "Thumbnail image is required for new entries", "error");
            return;
        }

        setIsSubmitting(true);

        try {
            let thumbnailUrl = initialData?.thumbnailUrl || '';

            // Only upload Thumbnail if a new file is selected
            if (thumbnailFile) {
                thumbnailUrl = await uploadCatalogueFile(thumbnailFile, 'thumbnails');
            }

            const catalogueData = {
                title,
                subtitle,
                machineModels: filteredModels,
                brand,
                category,
                subCategory,
                thumbnailUrl,
                fileUrl, // Provided via URL input
                insManualsUrl, // Provided via URL input
                videoUrl // Provided via URL input
            };

            if (isEdit && initialData) {
                await updateCatalogue(initialData.id, catalogueData);
                Swal.fire("Success", "Catalogue updated successfully", "success");
            } else {
                await createCatalogue(catalogueData);
                Swal.fire("Success", "Catalogue created successfully", "success");
            }

            const isMobile = window.location.pathname.includes('/mobile/');
            router.push(isMobile ? '/mobile/service/catalogues' : '/dashboard/warranty-management/machinery-catalogues');
            router.refresh();

        } catch (error: any) {
            console.error("Error saving catalogue:", error);
            Swal.fire("Error", error.message || "Failed to save catalogue", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-sm font-semibold">Catalogue Title *</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. SN-800 Series Technical Guide"
                                className="h-12 border-slate-200 focus:ring-primary rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="subtitle" className="text-sm font-semibold">Subtitle / Description</Label>
                            <Input
                                id="subtitle"
                                value={subtitle}
                                onChange={(e) => setSubtitle(e.target.value)}
                                placeholder="e.g. Complete technical specifications and parts list"
                                className="h-12 border-slate-200 focus:ring-primary rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">Machine Models *</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addModelField}
                                className="h-8 px-2 text-[10px] font-bold border-primary text-primary hover:bg-primary/5 rounded-lg"
                            >
                                <Plus className="mr-1 h-3 w-3" /> Add Model
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {machineModels.map((model, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        value={model}
                                        onChange={(e) => handleModelChange(index, e.target.value)}
                                        placeholder={`e.g. SN-800 ${index + 1}`}
                                        className="h-11 border-slate-200 focus:ring-primary rounded-xl"
                                    />
                                    {machineModels.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeModelField(index)}
                                            className="h-11 w-11 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 border border-slate-100"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="brand" className="text-sm font-semibold">Brand *</Label>
                        <Input
                            id="brand"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            placeholder="e.g. Brother"
                            className="h-12 border-slate-200 focus:ring-primary rounded-xl"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="category" className="text-sm font-semibold">Category</Label>
                            <Input
                                id="category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="e.g. Sewing Machine"
                                className="h-12 border-slate-200 focus:ring-primary rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="subCategory" className="text-sm font-semibold">Sub Category</Label>
                            <Input
                                id="subCategory"
                                value={subCategory}
                                onChange={(e) => setSubCategory(e.target.value)}
                                placeholder="e.g. Industrial"
                                className="h-12 border-slate-200 focus:ring-primary rounded-xl"
                            />
                        </div>
                    </div>
                </div>

                {/* File Uploads */}
                <div className="space-y-6">
                    {/* Thumbnail */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Thumbnail (100x150) *</Label>
                        <div className="flex items-start gap-4">
                            <div className="w-[100px] h-[150px] bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group">
                                {thumbnailPreview ? (
                                    <img src={thumbnailPreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="h-8 w-8 text-slate-400" />
                                )}
                                <div
                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                    onClick={() => document.getElementById('thumbnail-upload')?.click()}
                                >
                                    <Upload className="h-6 w-6 text-white" />
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <input
                                    type="file"
                                    id="thumbnail-upload"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(e, setThumbnailFile, setThumbnailPreview)}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => document.getElementById('thumbnail-upload')?.click()}
                                    className="w-full h-10 text-xs border-dashed"
                                >
                                    <Upload className="mr-2 h-4 w-4" /> Change Image
                                </Button>
                                <p className="text-[10px] text-slate-500 italic">Preferred size: 100 x 150 pixels for best appearance.</p>
                            </div>
                        </div>
                    </div>

                    {/* Other Files (URL Inputs) */}
                    <div className="grid grid-cols-1 gap-4">
                        {/* Catalogue URL */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <Label htmlFor="fileUrl" className="text-xs font-bold uppercase tracking-wider text-slate-500">Catalogue (Cloudinary URL) *</Label>
                                {initialData?.fileUrl && <span className="text-[10px] text-emerald-600 font-bold">Existing Link Found</span>}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <Input
                                        id="fileUrl"
                                        type="url"
                                        value={fileUrl}
                                        onChange={(e) => setFileUrl(e.target.value)}
                                        placeholder="https://res.cloudinary.com/.../catalogue.pdf"
                                        className="h-10 text-xs border-slate-200 focus:ring-primary rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Instruction Manuals URL */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <Label htmlFor="insManualsUrl" className="text-xs font-bold uppercase tracking-wider text-slate-500">Manuals (Cloudinary URL)</Label>
                                {initialData?.insManualsUrl && <span className="text-[10px] text-emerald-600 font-bold">Existing Link Found</span>}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <Input
                                        id="insManualsUrl"
                                        type="url"
                                        value={insManualsUrl}
                                        onChange={(e) => setInsManualsUrl(e.target.value)}
                                        placeholder="https://res.cloudinary.com/.../manual.pdf"
                                        className="h-10 text-xs border-slate-200 focus:ring-primary rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Video URL */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <Label htmlFor="videoUrl" className="text-xs font-bold uppercase tracking-wider text-slate-500">Technical Video (YouTube URL)</Label>
                                {initialData?.videoUrl && <span className="text-[10px] text-emerald-600 font-bold">Existing Link Found</span>}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                                    <Film className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <Input
                                        id="videoUrl"
                                        type="url"
                                        value={videoUrl}
                                        onChange={(e) => setVideoUrl(e.target.value)}
                                        placeholder="https://www.youtube.com/watch?v=..."
                                        className="h-10 text-xs border-slate-200 focus:ring-primary rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-4 pt-8 border-t">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                    className="h-12 px-8 rounded-xl"
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-12 px-10 rounded-xl bg-primary hover:bg-primary/90 shadow-lg transition-all active:scale-95"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            {isEdit ? 'Updating...' : 'Creating...'}
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-5 w-5" />
                            {isEdit ? 'Update Catalogue' : 'Save Catalogue'}
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}
