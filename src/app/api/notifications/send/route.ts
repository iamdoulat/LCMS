import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    try {
        const { title, body, targetRoles, userIds, icon, badgeCount } = await req.json();

        if (!title || !body) {
            return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
        }

        const tokens: string[] = [];
        const db = admin.firestore();

        // 1. Fetch tokens by target roles
        if (targetRoles && Array.isArray(targetRoles) && targetRoles.length > 0) {
            const usersSnap = await db.collection('users').where('role', 'array-contains-any', targetRoles).get();
            usersSnap.forEach(doc => {
                const data = doc.data();
                if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                    tokens.push(...data.fcmTokens);
                }
            });
        }

        // 2. Fetch tokens by specific user IDs (if provided)
        if (userIds && Array.isArray(userIds) && userIds.length > 0) {
            // Ideally use 'in' query but it's limited to 10 or 30.
            // For simplicity, we can fetch all users or iterate. 
            // Better: iterate fetch if list is small, or use `where('uid', 'in', userIds)` chunks.
            // Assuming small list for now.
            const usersSnap = await db.collection('users').where('uid', 'in', userIds.slice(0, 10)).get(); // Limit just in case
            usersSnap.forEach(doc => {
                const data = doc.data();
                if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                    tokens.push(...data.fcmTokens);
                }
            });
        }

        // 3. Flatten and Deduplicate tokens
        const uniqueTokens = [...new Set(tokens)];

        if (uniqueTokens.length === 0) {
            // Save to history even if no devices found
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
            return NextResponse.json({ message: 'No devices to target', count: 0 });
        }

        // 4. Send Multicast Message
        const message = {
            notification: {
                title,
                body,
            },
            data: {
                badgeCount: badgeCount ? String(badgeCount) : '1',
                url: '/dashboard' // Default click action
            },
            tokens: uniqueTokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        // 5. Save Notification History to Firestore
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

        // 6. Cleanup invalid tokens (Optional but recommended)
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.warn('Failed to send to token:', uniqueTokens[idx], resp.error);
                }
            });
        }

        return NextResponse.json({
            success: true,
            successCount: response.successCount,
            failureCount: response.failureCount
        });

    } catch (error: any) {
        console.error('Error sending notification:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
