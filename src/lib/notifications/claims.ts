import type { HRClaim } from '@/types';

/**
 * Public wrapper that detects environment.
 * If running in browser, calls API route.
 * If running on server, executes logic directly via dynamic import 
 * of the server-only module to prevent client-side bundling errors.
 */
export async function sendClaimStatusNotifications(claim: HRClaim) {
    if (typeof window === 'undefined') {
        // We are on server, dynamically import the server-only logic
        try {
            const { sendClaimStatusNotificationsInternal } = await import('./claims_server');
            return sendClaimStatusNotificationsInternal(claim);
        } catch (serverErr) {
            console.error('Error in sendClaimStatusNotifications (Server-side dynamic import):', serverErr);
            return;
        }
    }

    // We are on client, call API
    try {
        const response = await fetch('/api/notifications/claims', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(claim),
        });
        if (!response.ok) {
            const err = await response.json();
            console.error('Failed to trigger claim notification via API:', err);
        }
    } catch (error) {
        console.error('Error triggering claim notification API:', error);
    }
}
