import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';

/**
 * GET /api/firestore/export
 * Exports all Firestore collections to a JSON object.
 */
export async function GET(request: NextRequest) {
    try {
        const db = admin.firestore();
        const collections = await db.listCollections();
        const backup: Record<string, any> = {};

        for (const collection of collections) {
            const collectionId = collection.id;
            const snapshot = await collection.get();
            const docs: Record<string, any> = {};

            snapshot.forEach((doc) => {
                docs[doc.id] = doc.data();
            });

            backup[collectionId] = docs;
        }

        return NextResponse.json(backup);
    } catch (error: any) {
        console.error('Firestore Export Error:', error);
        return NextResponse.json(
            { error: 'Failed to export Firestore data', details: error.message },
            { status: 500 }
        );
    }
}
