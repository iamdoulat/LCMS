"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Paperclip, X } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { firestore, storage } from '@/lib/firebase/config';
import type { AssetCategoryDocument } from '@/types';
import Swal from 'sweetalert2';

interface AssetCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryToEdit?: AssetCategoryDocument | null;
    onSuccess: () => void;
}

export function AssetCategoryModal({ isOpen, onClose, categoryToEdit, onSuccess }: AssetCategoryModalProps) {
    const [name, setName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (categoryToEdit) {
                setName(categoryToEdit.name);
                setExistingImageUrl(categoryToEdit.documentUrl || null);
                setFile(null);
            } else {
                setName('');
                setFile(null);
                setExistingImageUrl(null);
            }
        }
    }, [isOpen, categoryToEdit]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Category Name is required.',
                timer: 3000,
                showConfirmButton: false
            });
            return;
        }

        if (!categoryToEdit && !file) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Document Attachment is required for new categories.',
                timer: 3000,
                showConfirmButton: false
            });
            return;
        }

        try {
            setIsSubmitting(true);
            let downloadUrl = existingImageUrl;

            if (file) {
                console.log('Uploading file to storage...');
                const fileRef = ref(storage, `asset-categories/${Date.now()}_${file.name}`);
                await uploadBytes(fileRef, file);
                downloadUrl = await getDownloadURL(fileRef);
                console.log('File uploaded successfully:', downloadUrl);
            }

            if (categoryToEdit) {
                // Update
                console.log('Updating category:', categoryToEdit.id);
                const categoryRef = doc(firestore, 'asset_categories', categoryToEdit.id);
                await updateDoc(categoryRef, {
                    name: name.trim(),
                    ...(downloadUrl && { documentUrl: downloadUrl }),
                    updatedAt: serverTimestamp(),
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Asset Category updated successfully.',
                    timer: 3000,
                    showConfirmButton: false
                });
            } else {
                // Create
                console.log('Creating new category...');
                await addDoc(collection(firestore, 'asset_categories'), {
                    name: name.trim(),
                    documentUrl: downloadUrl || '',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Asset Category created successfully.',
                    timer: 3000,
                    showConfirmButton: false
                });
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Error saving asset category:", error);
            console.error("Error details:", {
                code: error.code,
                message: error.message,
                stack: error.stack
            });

            let errorMessage = 'Failed to save asset category.';

            // Check for specific Firebase errors
            if (error.code === 'permission-denied') {
                errorMessage = 'Permission denied. Please check Firestore and Storage security rules.';
            } else if (error.code === 'storage/unauthorized') {
                errorMessage = 'Storage permission denied. Please check Storage security rules.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMessage,
                timer: 3000,
                showConfirmButton: false
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{categoryToEdit ? 'Edit Asset Category' : 'Add Asset Category'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="categoryName" className="text-right">
                            Category Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="categoryName"
                            placeholder="Enter Category Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="documentAttachment">
                            Document Attachment {categoryToEdit ? '' : <span className="text-destructive">*</span>}
                        </Label>
                        <div className="relative">
                            <Input
                                id="documentAttachment"
                                type="file"
                                className="pl-10 cursor-pointer"
                                onChange={handleFileChange}
                                accept="image/*,.pdf"
                                disabled={isSubmitting}
                            />
                        </div>
                        {existingImageUrl && !file && (
                            <div className="text-sm text-muted-foreground mt-1">
                                Current file: <a href={existingImageUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">View</a>
                            </div>
                        )}
                    </div>
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="bg-purple-50 text-purple-600 border-none hover:bg-purple-100">
                        Cancel
                    </Button>
                    <Button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
