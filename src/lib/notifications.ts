import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';

/**
 * Resolves a UID from an employee ID.
 * Most mobile apps use UID as the primary identifier in the 'users' collection for FCM tokens.
 */
export async function getUidFromEmployeeId(employeeId: string): Promise<string | null> {
    try {
        const empDoc = await getDoc(doc(firestore, 'employees', employeeId));
        if (empDoc.exists()) {
            const data = empDoc.data();
            return data.uid || employeeId;
        }
        return employeeId;
    } catch (e) {
        console.error('Error resolving UID:', e);
        return employeeId;
    }
}

interface NotificationOptions {
    title: string;
    body: string;
    userIds?: string[];
    targetRoles?: string[];
    url?: string;
    badgeCount?: number;
}

/**
 * Sends a push notification via the app's internal API.
 */
export async function sendPushNotification(options: NotificationOptions) {
    try {
        const response = await fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options),
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Failed to send push notification:', error);
        return { error };
    }
}
