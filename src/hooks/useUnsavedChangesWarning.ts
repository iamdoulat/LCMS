import { useEffect } from 'react';

/**
 * A hook that warns the user if they try to leave the page with unsaved changes.
 * 
 * @param isDirty - A boolean indicating if the form has unsaved changes.
 * @param isSubmitting - A boolean indicating if the form is currently submitting.
 * @param message - The message to display in the confirmation dialog.
 */
export function useUnsavedChangesWarning(
    isDirty: boolean,
    isSubmitting: boolean,
    message: string = "You have unsaved changes. Are you sure you want to leave?"
) {
    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (isDirty && !isSubmitting) {
                event.preventDefault();
                event.returnValue = '';
            }
        };

        const handlePopState = (event: PopStateEvent) => {
            if (isDirty && !isSubmitting) {
                const confirmed = window.confirm(message);
                if (!confirmed) {
                    window.history.pushState(null, '', window.location.href);
                } else {
                    // Remove listener to prevent loop and go back
                    window.removeEventListener('popstate', handlePopState);
                    window.history.back();
                }
            }
        };

        if (isDirty && !isSubmitting) {
            // Push state to allow "forward" to "current" logic for back button interception if needed
            // But cleaner approach is just listening. However, for popstate to fire on initial back, 
            // we often need a state pushed.
            // window.history.pushState(null, '', window.location.href); 
            // NOTE: Pushing state on every render with isDirty can be problematic.
            // Better to push once when becoming dirty.

            // Re-evaluating the pushState logic from previous successful implementation:
            window.history.pushState(null, '', window.location.href);

            window.addEventListener('beforeunload', handleBeforeUnload);
            window.addEventListener('popstate', handlePopState);
        }

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [isDirty, isSubmitting, message]);
}
