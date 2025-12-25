import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';

/**
 * POST /api/firestore/import
 * Imports Firestore data from a JSON object.
 */
export async function POST(request: NextRequest) {
    try {
        const backup = await request.json();
        const db = admin.firestore();

        if (!backup || typeof backup !== 'object') {
            return NextResponse.json({ error: 'Invalid backup data' }, { status: 400 });
        }

        // Iterate through collections
        for (const [collectionId, docs] of Object.entries(backup)) {
            if (typeof docs !== 'object' || docs === null) continue;

            // Iterate through documents
            for (const [docId, data] of Object.entries(docs)) {
                if (typeof data !== 'object' || data === null) continue;

                // Write document to Firestore
                await db.collection(collectionId).doc(docId).set(data);
            }
        }

        return NextResponse.json({ message: 'Data imported successfully' });
    } catch (error: any) {
        console.error('Firestore Import Error:', error);
        return NextResponse.json(
            { error: 'Failed to import Firestore data', details: error.message },
            { status: 500 }
        );
    }
}
