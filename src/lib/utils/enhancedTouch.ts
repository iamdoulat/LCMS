/**
 * Enhanced touch utilities with haptic feedback
 */

import { triggerHaptic } from './touchOptimization';

/**
 * Add haptic feedback to button/action elements
 */
export function addHapticFeedback(element: HTMLElement, intensity: 'light' | 'medium' | 'strong' = 'medium') {
    const durations = {
        light: 5,
        medium: 10,
        strong: 20
    };

    const handler = () => {
        triggerHaptic(durations[intensity]);
    };

    element.addEventListener('click', handler);
    element.addEventListener('touchstart', handler, { passive: true });

    return () => {
        element.removeEventListener('click', handler);
        element.removeEventListener('touchstart', handler);
    };
}

/**
 * Enhanced swipe gesture detector with haptic feedback
 */
export class SwipeGestureDetector {
    private startX = 0;
    private startY = 0;
    private startTime = 0;
    private element: HTMLElement;
    private threshold: number;
    private minVelocity: number;

    constructor(
        element: HTMLElement,
        options: {
            threshold?: number;
            minVelocity?: number;
            onSwipeLeft?: () => void;
            onSwipeRight?: () => void;
            onSwipeUp?: () => void;
            onSwipeDown?: () => void;
            hapticFeedback?: boolean;
        } = {}
    ) {
        this.element = element;
        this.threshold = options.threshold || 50;
        this.minVelocity = options.minVelocity || 0.3;

        const handleTouchStart = (e: TouchEvent) => {
            this.startX = e.touches[0].clientX;
            this.startY = e.touches[0].clientY;
            this.startTime = Date.now();
        };

        const handleTouchEnd = (e: TouchEvent) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const deltaX = endX - this.startX;
            const deltaY = endY - this.startY;
            const deltaTime = Date.now() - this.startTime;

            const velocityX = Math.abs(deltaX) / deltaTime;
            const velocityY = Math.abs(deltaY) / deltaTime;

            // Determine swipe direction
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (Math.abs(deltaX) > this.threshold && velocityX > this.minVelocity) {
                    if (options.hapticFeedback !== false) {
                        triggerHaptic(10);
                    }

                    if (deltaX > 0 && options.onSwipeRight) {
                        options.onSwipeRight();
                    } else if (deltaX < 0 && options.onSwipeLeft) {
                        options.onSwipeLeft();
                    }
                }
            } else {
                // Vertical swipe
                if (Math.abs(deltaY) > this.threshold && velocityY > this.minVelocity) {
                    if (options.hapticFeedback !== false) {
                        triggerHaptic(10);
                    }

                    if (deltaY > 0 && options.onSwipeDown) {
                        options.onSwipeDown();
                    } else if (deltaY < 0 && options.onSwipeUp) {
                        options.onSwipeUp();
                    }
                }
            }
        };

        this.element.addEventListener('touchstart', handleTouchStart, { passive: true });
        this.element.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
}

/**
 * Add touch ripple effect to an element
 */
export function addTouchRipple(element: HTMLElement, color: string = 'rgba(255, 255, 255, 0.5)') {
    element.style.position = 'relative';
    element.style.overflow = 'hidden';

    const handler = (e: MouseEvent | TouchEvent) => {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();

        const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

        const size = Math.max(rect.width, rect.height);

        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x - size / 2}px`;
        ripple.style.top = `${y - size / 2}px`;
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.background = color;
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'ripple 0.6s ease-out';
        ripple.style.pointerEvents = 'none';

        element.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    };

    element.addEventListener('click', handler);
    element.addEventListener('touchstart', handler as EventListener, { passive: true });

    // Add ripple animation to document
    if (!document.getElementById('ripple-animation')) {
        const style = document.createElement('style');
        style.id = 'ripple-animation';
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    return () => {
        element.removeEventListener('click', handler);
        element.removeEventListener('touchstart', handler as EventListener);
    };
}
