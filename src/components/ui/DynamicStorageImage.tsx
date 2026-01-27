
"use client";

import React, { useState, useEffect } from 'react';
import { getFileUrl } from '@/lib/storage/storage';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface DynamicStorageImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    path?: string;
    fallbackUrl?: string;
    showSkeleton?: boolean;
}

export const DynamicStorageImage: React.FC<DynamicStorageImageProps> = ({
    path,
    fallbackUrl,
    showSkeleton = true,
    className,
    alt = "Storage Image",
    ...props
}) => {
    const [src, setSrc] = useState<string>(fallbackUrl || '');
    const [loading, setLoading] = useState<boolean>(!!path);
    const [error, setError] = useState<boolean>(false);

    useEffect(() => {
        const resolveUrl = async () => {
            if (!path) {
                setSrc(fallbackUrl || '');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const url = await getFileUrl(path, fallbackUrl);
                setSrc(url);
                setError(false);
            } catch (err) {
                console.error("Error resolving storage image URL:", err);
                setError(true);
                setSrc(fallbackUrl || '');
            } finally {
                setLoading(false);
            }
        };

        resolveUrl();
    }, [path, fallbackUrl]);

    if (loading && showSkeleton) {
        return <Skeleton className={cn("w-full h-full", className)} />;
    }

    if (!src && !loading) {
        return null; // Or some placeholder icon
    }

    return (
        <img
            src={src}
            alt={alt}
            className={cn(loading ? "opacity-0" : "opacity-100 transition-opacity duration-300", className)}
            onError={() => {
                setError(true);
                if (fallbackUrl && src !== fallbackUrl) {
                    setSrc(fallbackUrl);
                }
            }}
            {...props}
        />
    );
};
