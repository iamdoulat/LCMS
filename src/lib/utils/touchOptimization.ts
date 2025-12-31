/**
 * Touch optimization utilities for better mobile experience
 */

/**
 * Creates a passive touch event listener for better scroll performance
 */
export function addPassiveTouchListener(
    element: HTMLElement,
    event: 'touchstart' | 'touchmove' | 'touchend',
    handler: EventListener
) {
    element.addEventListener(event, handler, { passive: true });
    return () => element.removeEventListener(event, handler);
}

/**
 * Trigger haptic feedback (vibration) on supported devices
 */
export function triggerHaptic(duration: number = 10) {
    if ('vibrate' in navigator) {
        navigator.vibrate(duration);
    }
}

/**
 * Debounce function for touch events
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * Throttle function for scroll events
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

/**
 * Check if device supports touch
 */
export function isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Get safe area insets for notched devices
 */
export function getSafeAreaInsets() {
    return {
        top: 'env(safe-area-inset-top, 0px)',
        right: 'env(safe-area-inset-right, 0px)',
        bottom: 'env(safe-area-inset-bottom, 0px)',
        left: 'env(safe-area-inset-left, 0px)',
    };
}

/**
 * Prevent iOS bounce/overscroll on specific element
 */
export function preventIOSBounce(element: HTMLElement) {
    let startY: number;

    const touchStart = (e: TouchEvent) => {
        startY = e.touches[0].pageY;
    };

    const touchMove = (e: TouchEvent) => {
        const y = e.touches[0].pageY;
        const scrollTop = element.scrollTop;
        const scrollHeight = element.scrollHeight;
        const height = element.clientHeight;
        const isAtTop = scrollTop <= 0;
        const isAtBottom = scrollTop + height >= scrollHeight;

        if ((isAtTop && y > startY) || (isAtBottom && y < startY)) {
            e.preventDefault();
        }
    };

    element.addEventListener('touchstart', touchStart, { passive: true });
    element.addEventListener('touchmove', touchMove, { passive: false });

    return () => {
        element.removeEventListener('touchstart', touchStart);
        element.removeEventListener('touchmove', touchMove);
    };
}
