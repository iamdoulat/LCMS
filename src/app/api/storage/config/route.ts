
import { NextRequest, NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
    try {
        if (!firestore) {
            return NextResponse.json({ error: 'Firestore Admin not initialized' }, { status: 500 });
        }

        // Fetch active config
        const snapshot = await firestore.collection('storage_settings')
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return NextResponse.json({
                provider: 'firebase',
                message: 'No active storage configuration found'
            });
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        // Return ONLY non-sensitive fields
        return NextResponse.json({
            id: doc.id,
            provider: data.provider || 'firebase',
            name: data.name,
            publicUrl: data.publicUrl,
            bucketName: data.bucketName,
            region: data.region
        });

    } catch (error: any) {
        console.error("[STORAGE CONFIG API] Error:", error);
        return NextResponse.json({
            error: 'Failed to fetch storage configuration',
            provider: 'firebase' // Fallback to firebase on error
        }, { status: 500 });
    }
}
