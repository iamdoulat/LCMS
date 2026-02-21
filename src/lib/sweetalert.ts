import Swal from 'sweetalert2';
import type { SweetAlertOptions } from 'sweetalert2';

/**
 * Global SweetAlert wrapper with auto-close functionality
 * All error and warning alerts will auto-close after 5 seconds
 * Success alerts will auto-close after 1.5 seconds (existing behavior)
 * 
 * Includes fixes for Radix UI conflict:
 * - heightAuto: false (prevents layout shifts in Next.js)
 * - didOpen: ensuring accessibility compatibility
 * - didClose: restoring body state if blocked
 */
export const showAlert = (options: SweetAlertOptions | string, text?: string, icon?: 'success' | 'error' | 'warning' | 'info' | 'question') => {
    const radixConflictFixes: SweetAlertOptions = {
        heightAuto: false,
        didOpen: () => {
            // Fix for radix-ui + sweetalert aria-hidden conflict
            // SweetAlert2 adds aria-hidden="true" to all children of body
            // We need to remove it from Radix portals/poppers OR any element containing focus
            const activeEl = document.activeElement;
            const portals = document.querySelectorAll('[data-radix-portal], [data-radix-popper-content-wrapper], [aria-hidden="true"]');

            portals.forEach(portal => {
                if (portal.contains(activeEl) || portal.hasAttribute('data-radix-portal') || portal.hasAttribute('data-radix-popper-content-wrapper')) {
                    portal.removeAttribute('aria-hidden');
                    portal.removeAttribute('data-aria-hidden');
                }
            });

            // Ensure the SweetAlert container itself is accessible
            const container = Swal.getContainer();
            if (container) {
                container.removeAttribute('aria-hidden');
            }
        },
        didClose: () => {
            // Restore interaction and scroll
            // This is a more aggressive restoration to fix the "freeze"
            setTimeout(() => {
                const body = document.body;

                // Always ensure pointer-events are restored
                body.style.pointerEvents = 'auto';

                // If no more modals are open, restore overflow
                const hasOtherDialogs = !!document.querySelector('[role="dialog"]:not(.swal2-modal)');
                const hasSwal = !!document.querySelector('.swal2-container');

                if (!hasOtherDialogs && !hasSwal) {
                    body.style.overflow = '';
                    body.style.paddingRight = '';

                    // Cleanup any leftover aria-hidden from Swal's aggressive hiding
                    const hiddenElements = document.querySelectorAll('[data-aria-hidden]');
                    hiddenElements.forEach(el => {
                        el.removeAttribute('aria-hidden');
                        el.removeAttribute('data-aria-hidden');
                    });
                }
            }, 150); // Slightly longer timeout to allow transitions to finish
        }
    };

    // Handle shorthand: showAlert('Title', 'Text', 'error')
    if (typeof options === 'string') {
        const title = options;
        const finalOptions: SweetAlertOptions = {
            ...radixConflictFixes,
            title,
            text,
            icon,
            customClass: { container: 'z-[9999]' }
        };

        // Auto-close for error and warning
        if (icon === 'error' || icon === 'warning') {
            finalOptions.timer = 5000;
            finalOptions.showConfirmButton = false;
            finalOptions.timerProgressBar = true;
        }
        // Auto-close for success (shorter time)
        else if (icon === 'success') {
            finalOptions.timer = finalOptions.timer || 1500;
            finalOptions.showConfirmButton = false;
            finalOptions.timerProgressBar = true;
        }

        return Swal.fire(finalOptions);
    }

    // Handle object options: showAlert({ title: 'Test', ... })
    const finalOptions: any = {
        ...radixConflictFixes,
        ...(options as any),
        customClass: {
            ...((options as any).customClass || {}),
            container: 'z-[9999]'
        }
    };

    // Auto-close for error and warning if not explicitly set
    if ((options.icon === 'error' || options.icon === 'warning') && !options.timer) {
        finalOptions.timer = 5000;
        finalOptions.showConfirmButton = finalOptions.showConfirmButton ?? false;
        finalOptions.timerProgressBar = true;
    }
    // Auto-close for success if not explicitly set
    else if (options.icon === 'success' && !options.timer && options.showConfirmButton !== true) {
        finalOptions.timer = finalOptions.timer || 1500;
        finalOptions.showConfirmButton = false;
        finalOptions.timerProgressBar = true;
    }

    return Swal.fire(finalOptions);
};

// Export Swal for cases that need the original API
export { Swal };
export default showAlert;
