import Image, { ImageProps } from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
    src: string;
    alt: string;
    fallbackSrc?: string;
    showPlaceholder?: boolean;
    placeholderClassName?: string;
}

/**
 * Optimized Image component with WebP support and lazy loading
 * Automatically uses Next.js Image optimization
 */
export function OptimizedImage({
    src,
    alt,
    fallbackSrc = '/placeholder.png',
    showPlaceholder = true,
    placeholderClassName,
    className,
    priority = false,
    loading = 'lazy',
    ...props
}: OptimizedImageProps) {
    const [error, setError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const imageSrc = error ? fallbackSrc : src;

    return (
        <div className={cn('relative overflow-hidden', className)}>
            {isLoading && showPlaceholder && (
                <div
                    className={cn(
                        'absolute inset-0 bg-slate-200 animate-pulse',
                        placeholderClassName
                    )}
                />
            )}
            <Image
                src={imageSrc}
                alt={alt}
                {...props}
                loading={priority ? undefined : loading}
                priority={priority}
                onLoadingComplete={() => setIsLoading(false)}
                onError={() => {
                    setError(true);
                    setIsLoading(false);
                }}
                quality={85}
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
                className={cn(
                    'transition-opacity duration-300',
                    isLoading ? 'opacity-0' : 'opacity-100'
                )}
            />
        </div>
    );
}

/**
 * Avatar component with lazy loading and fallback
 */
export function OptimizedAvatar({
    src,
    alt,
    size = 40,
    className,
}: {
    src?: string;
    alt: string;
    size?: number;
    className?: string;
}) {
    return (
        <OptimizedImage
            src={src || '/default-avatar.png'}
            alt={alt}
            width={size}
            height={size}
            className={cn('rounded-full', className)}
            placeholderClassName="rounded-full"
        />
    );
}
