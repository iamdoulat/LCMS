import { admin } from '@/lib/firebase/admin';

interface PushOptions {
    title: string;
    body: string;
    userIds?: string[];
    targetRoles?: string[];
    url?: string;
    badgeCount?: number;
}

/**
 * Shared server-side service to send FCM push notifications.
 * This can be used in API routes and cron jobs.
 */
export async function sendServerPushNotification(options: PushOptions) {
    const { title, body, userIds, targetRoles, url, badgeCount } = options;
    const db = admin.firestore();
    const tokens: string[] = [];

    try {
        // 1. Fetch tokens by target roles
        if (targetRoles && Array.isArray(targetRoles) && targetRoles.length > 0) {
            const usersSnap = await db.collection('users')
                .where('role', 'array-contains-any', targetRoles)
                .get();
            usersSnap.forEach(doc => {
                const data = doc.data();
                if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                    tokens.push(...data.fcmTokens);
                }
            });
        }

        // 2. Fetch tokens by specific user IDs (UIDs)
        if (userIds && Array.isArray(userIds) && userIds.length > 0) {
            // Firestore 'in' query supports up to 30 values
            const chunks = [];
            for (let i = 0; i < userIds.length; i += 30) {
                chunks.push(userIds.slice(i, i + 30));
            }

            for (const chunk of chunks) {
                const usersSnap = await db.collection('users')
                    .where('uid', 'in', chunk)
                    .get();
                usersSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                        tokens.push(...data.fcmTokens);
                    }
                });
            }
        }

        const uniqueTokens = [...new Set(tokens)];

        if (uniqueTokens.length === 0) {
            await db.collection('push_notifications').add({
                title,
                body,
                targetRoles: targetRoles || null,
                userIds: userIds || null,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                successCount: 0,
                failureCount: 0,
                totalTokens: 0,
                createdBy: 'system',
                status: 'no_targets'
            });
            return { success: true, message: 'No devices found' };
        }

        // 3. Send Multicast Message
        const message = {
            notification: { title, body },
            data: {
                badgeCount: badgeCount ? String(badgeCount) : '1',
                url: url || '/mobile/dashboard'
            },
            tokens: uniqueTokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        // 4. Save to History
        await db.collection('push_notifications').add({
            title,
            body,
            targetRoles: targetRoles || null,
            userIds: userIds || null,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            successCount: response.successCount,
            failureCount: response.failureCount,
            totalTokens: uniqueTokens.length,
            createdBy: 'system',
            status: 'sent'
        });

        return {
            success: true,
            successCount: response.successCount,
            failureCount: response.failureCount
        };

    } catch (error: any) {
        console.error('Error in sendServerPushNotification:', error);
        return { success: false, error: error.message };
    }
}
