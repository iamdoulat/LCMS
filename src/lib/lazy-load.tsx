// Utility to create lazy-loaded components with loading fallback
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

interface LazyLoadOptions {
    loading?: () => JSX.Element;
    ssr?: boolean;
}

/**
 * Creates a lazy-loaded component with a default loading spinner
 * @param importFn - Dynamic import function
 * @param options - Loading component and SSR options
 */
export function createLazyComponent<T extends React.ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    options: LazyLoadOptions = {}
) {
    const {
        loading = () => (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ),
        ssr = false,
    } = options;

    return dynamic(importFn, {
        loading,
        ssr,
    });
}

/**
 * Default loading component for lazy-loaded pages
 */
export const PageLoader = () => (
    <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
);

/**
 * Compact loading component for smaller components
 */
export const CompactLoader = () => (
    <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
);
