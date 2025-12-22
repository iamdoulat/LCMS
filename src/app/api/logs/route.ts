
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Get total count
        const totalSnapshot = await admin.firestore().collection('system_logs').count().get();
        const total = totalSnapshot.data().count;

        // Fetch logs with pagination
        const snapshot = await admin.firestore().collection('system_logs')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .offset(offset)
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

        return NextResponse.json({ success: true, logs, total });
    } catch (error: any) {
        console.error("Error API fetching logs:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const db = admin.firestore();
        const logsRef = db.collection('system_logs');

        // Fetch all logs in batches and delete
        const batchSize = 500;
        let deletedCount = 0;

        const deleteInBatches = async () => {
            const snapshot = await logsRef.limit(batchSize).get();

            if (snapshot.empty) {
                return;
            }

            const batch = db.batch();
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            deletedCount += snapshot.size;

            // Recursively delete next batch
            if (snapshot.size === batchSize) {
                await deleteInBatches();
            }
        };

        await deleteInBatches();

        return NextResponse.json({
            success: true,
            message: `Deleted ${deletedCount} logs successfully`
        });
    } catch (error: any) {
        console.error("Error deleting logs:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
