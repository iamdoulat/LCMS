
import { admin } from '@/lib/firebase/admin';
import { Resend } from 'resend';
import { SmtpConfiguration } from '@/types/email-settings';

/**
 * Shared utility to get the usage count for a specific SMTP configuration
 * for the current UTC day.
 */
export async function getUsageForConfig(config: SmtpConfiguration): Promise<number> {
    const configId = config.id;
    if (!configId) return 0;

    let count = 0;

    // Current day boundaries in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // 1. If Resend API, try fetching from Resend directly first (if possible)
    if (config.serviceProvider === 'resend_api') {
        const apiKey = config.resendApiKey || process.env.RESEND_API_KEY;
        if (apiKey) {
            try {
                const resend = new Resend(apiKey);
                const { data, error } = await resend.emails.list();
                if (!error && data && data.data) {
                    count = data.data.filter(email => {
                        const emailDate = new Date(email.created_at);
                        return emailDate >= today && emailDate < tomorrow;
                    }).length;
                }
            } catch (err) {
                // Fail silently and fall back to logs
                console.error(`getUsageForConfig: Resend API Error for ${configId}:`, err);
            }
        }
    }

    // 2. Supplement or use Local Logs (system_logs)
    try {
        if (!admin.apps.length) {
            // Check if we need to initialize (usually handled at app level, but defensive here)
            const { admin: initializedAdmin } = await import('@/lib/firebase/admin');
            if (!initializedAdmin.apps.length) throw new Error("Firebase Admin not initialized");
        }

        const snapshot = await admin.firestore()
            .collection('system_logs')
            .where('createdAt', '>=', today)
            .get();

        const logsFound = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

        const localCount = logsFound.filter(data => {
            const details = data.details || {};

            // Only count successful emails
            if (data.status !== 'success') return false;

            // Allow both 'email' type and 'send_email' action
            if (data.type !== 'email' && data.action !== 'send_email') return false;

            // Match by ID primarily
            if (data.relatedId === configId || details.configId === configId) return true;

            // Fallback for older/missing ID logs
            if (config.serviceProvider === 'resend_api') {
                return details.provider === 'resend_api';
            } else if (config.serviceProvider === 'smtp') {
                return details.provider === 'smtp' && (details.host === config.host || details.host?.includes(config.host));
            }
            return false;
        }).length;

        // Take the maximum of Resend API vs Local Logs
        count = Math.max(count, localCount);

    } catch (err) {
        console.error(`getUsageForConfig: Local Log Error for ${configId}:`, err);
    }

    return count;
}
