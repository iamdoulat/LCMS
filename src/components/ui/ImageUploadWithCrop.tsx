"use client";

import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Upload, X, Crop as CropIcon, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper to center the crop
function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            aspect,
            mediaWidth,
            mediaHeight,
        ),
        mediaWidth,
        mediaHeight,
    )
}

interface ImageUploadWithCropProps {
    onImageCropped: (blob: Blob) => void;
    aspectRatio?: number; // default 1 (square)
    initialImageUrl?: string;
    className?: string;
}

export function ImageUploadWithCrop({
    onImageCropped,
    aspectRatio = 1,
    initialImageUrl,
    className
}: ImageUploadWithCropProps) {
    const [imgSrc, setImgSrc] = useState('');
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl || null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Clean up object URLs to avoid memory leaks
    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    // Update preview if initialImageUrl changes from parent
    useEffect(() => {
        if (initialImageUrl) {
            setPreviewUrl(initialImageUrl);
        }
    }, [initialImageUrl]);

    function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files.length > 0) {
            setCrop(undefined); // Makes crop preview update between images.
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImgSrc(reader.result?.toString() || '');
                setIsDialogOpen(true);
            });
            reader.readAsDataURL(e.target.files[0]);
        }
    }

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        if (aspectRatio) {
            const { width, height } = e.currentTarget;
            setCrop(centerAspectCrop(width, height, aspectRatio));
        }
    }

    function onCropComplete() {
        if (completedCrop && imgRef.current) {
            getCroppedImg(imgRef.current, completedCrop);
            setIsDialogOpen(false);
            // Reset input so same file can be selected again if needed
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    function getCroppedImg(image: HTMLImageElement, crop: PixelCrop) {
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        canvas.width = crop.width;
        canvas.height = crop.height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            ctx.drawImage(
                image,
                crop.x * scaleX,
                crop.y * scaleY,
                crop.width * scaleX,
                crop.height * scaleY,
                0,
                0,
                crop.width,
                crop.height,
            );

            canvas.toBlob((blob) => {
                if (!blob) {
                    console.error('Canvas is empty');
                    return;
                }
                if (previewUrl && previewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(previewUrl);
                }
                const newPreviewUrl = URL.createObjectURL(blob);
                setPreviewUrl(newPreviewUrl);
                onImageCropped(blob);
            }, 'image/jpeg');
        }
    }

    const handleRemoveImage = (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent form submission
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        // We might want to notify parent about removal, but for now parent handles upload on submit
        // Passing a null/empty blob or special signal might be needed if "removing" is a feature.
        // For this implementation, we just clear the local preview.
    };

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            <div className="flex items-center gap-4">
                {previewUrl ? (
                    <div className="relative w-32 h-32 border rounded-md overflow-hidden group">
                        <img
                            src={previewUrl}
                            alt="Product Preview"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                                onClick={handleRemoveImage}
                                className="text-white bg-red-500/80 p-1 rounded-full hover:bg-red-600 transition-colors"
                                type="button"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="w-32 h-32 border-2 border-dashed rounded-md flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
                        <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                        <span className="text-xs">No image</span>
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-fit"
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        {previewUrl ? 'Change Image' : 'Upload Image'}
                    </Button>
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                        Recommended: Square image (1:1 aspect ratio), JPG or PNG.
                    </p>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={onSelectFile}
                        className="hidden"
                        ref={fileInputRef}
                    />
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Crop Image</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 flex flex-col items-center">
                        {imgSrc && (
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={aspectRatio}
                            >
                                <img
                                    ref={imgRef}
                                    alt="Crop me"
                                    src={imgSrc}
                                    onLoad={onImageLoad}
                                    style={{ maxHeight: '60vh' }}
                                />
                            </ReactCrop>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={onCropComplete}>
                            <CropIcon className="h-4 w-4 mr-2" />
                            Confirm Crop
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
