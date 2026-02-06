import Swal from 'sweetalert2';
import type { SweetAlertOptions } from 'sweetalert2';

/**
 * Global SweetAlert wrapper with auto-close functionality
 * All error and warning alerts will auto-close after 5 seconds
 * Success alerts will auto-close after 1.5 seconds (existing behavior)
 *
 * Usage: Replace `Swal.fire(...)` with `showAlert(...)`
 */
export const showAlert = (options: SweetAlertOptions | string, text?: string, icon?: 'success' | 'error' | 'warning' | 'info' | 'question') => {
    // Handle shorthand: showAlert('Title', 'Text', 'error')
    if (typeof options === 'string') {
        const title = options;
        const finalOptions: SweetAlertOptions = {
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
    const finalOptions: SweetAlertOptions = {
        ...options,
        customClass: {
            ...options.customClass,
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
