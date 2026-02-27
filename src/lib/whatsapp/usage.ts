
import { admin } from '@/lib/firebase/admin';
import { WhatsAppGatewayConfig } from '@/types/whatsapp-settings';

/**
 * Shared utility to get the usage count for a specific WhatsApp gateway
 * for the current UTC day.
 */
export async function getUsageForGateway(config: WhatsAppGatewayConfig): Promise<number> {
    const gatewayId = config.id;
    if (!gatewayId) return 0;

    let count = 0;

    // Current day boundaries in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    try {
        if (!admin.apps.length) {
            // Check if we need to initialize
            const { admin: initializedAdmin } = await import('@/lib/firebase/admin');
            if (!initializedAdmin.apps.length) throw new Error("Firebase Admin not initialized");
        }

        // Query system_logs for WhatsApp messages
        // Using a similar logic to SMTP but filtering for 'whatsapp' type
        const snapshot = await admin.firestore()
            .collection('system_logs')
            .where('createdAt', '>=', today)
            .get();

        const logsFound = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

        count = logsFound.filter(data => {
            const details = data.details || {};

            // Only count successful WhatsApp messages
            if (data.status !== 'success') return false;

            // Filter by type or action
            if (data.type !== 'whatsapp' && data.action !== 'send_whatsapp') return false;

            // Match by gateway ID
            // In sender.ts we log details.gateway: gateway.accountUniqueId
            // and relatedId: gatewayId if we can pass it
            if (data.relatedId === gatewayId || details.gatewayId === gatewayId || details.gateway === config.accountUniqueId) return true;

            return false;
        }).length;

    } catch (err) {
        console.error(`getUsageForGateway: Error for ${gatewayId}:`, err);
    }

    return count;
}
