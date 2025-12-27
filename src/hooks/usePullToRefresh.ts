import { useEffect, useRef } from 'react';

export const usePullToRefresh = (onRefresh: () => Promise<void> | void) => {
    const startY = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const isRefreshing = useRef(false);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleTouchStart = (e: TouchEvent) => {
            if (container.scrollTop === 0) {
                startY.current = e.touches[0].clientY;
            }
        };

        const handleTouchEnd = async (e: TouchEvent) => {
            if (container.scrollTop === 0 && !isRefreshing.current) {
                const endY = e.changedTouches[0].clientY;
                const distance = endY - startY.current; // Pull down distance

                // Threshold to trigger refresh (e.g., 100px)
                if (distance > 100) {
                    isRefreshing.current = true;
                    try {
                        await onRefresh();
                    } finally {
                        isRefreshing.current = false;
                    }
                }
            }
        };

        container.addEventListener('touchstart', handleTouchStart);
        container.addEventListener('touchend', handleTouchEnd);

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [onRefresh]);

    return containerRef;
};
