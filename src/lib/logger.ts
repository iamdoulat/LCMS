
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type LogType = 'whatsapp' | 'email' | 'telegram' | 'user_activity' | 'system' | 'error';
export type LogStatus = 'success' | 'failed' | 'pending' | 'warning';

export interface LogEntry {
    type: LogType;
    action: string;
    status: LogStatus;
    message: string;
    details?: any;
    userId?: string; // ID of the user performing the action or 'system'
    recipient?: string; // Phone number or Email
    relatedId?: string; // ID of related document (e.g., leave request ID)
}

export const logActivity = async (entry: LogEntry) => {
    try {
        const logData = {
            ...entry,
            createdAt: serverTimestamp(),
            // Ensure details is an object if possible, or stringify if needed for safety, 
            // but Firestore handles JSON objects well unless they have custom types.
            details: entry.details || {}
        };

        if (typeof window === 'undefined') {
            // Server-side
            const { admin } = await import('@/lib/firebase/admin');
            await admin.firestore().collection('system_logs').add({
                ...logData,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Client-side
            await addDoc(collection(firestore, 'system_logs'), logData);
        }
    } catch (error) {
        console.error("Failed to write system log:", error);
        // We don't throw here to avoid breaking the main flow just because logging failed
    }
};
