
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Fetch logs sorted by latest
        // Limit to 200 for performance
        const snapshot = await admin.firestore().collection('system_logs')
            .orderBy('createdAt', 'desc')
            .limit(200)
            .get();

        const logs = snapshot.docs.map(doc => {
            const data = doc.data();
            // Convert Timestamp to ISO string
            let createdAt = null;
            if (data.createdAt && data.createdAt.toDate) {
                createdAt = data.createdAt.toDate().toISOString();
            } else if (data.createdAt && typeof data.createdAt === 'string') {
                createdAt = data.createdAt; // Already string
            }

            return {
                id: doc.id,
                ...data,
                createdAt
            };
        });

        return NextResponse.json({ success: true, logs });
    } catch (error: any) {
        console.error("Error API fetching logs:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
