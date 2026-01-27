
import { NextRequest, NextResponse } from 'next/server';
import { firestore, admin } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
    try {
        if (!firestore) {
            return NextResponse.json({ error: 'Firestore Admin not initialized' }, { status: 500 });
        }

        // Verify Authentication
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        try {
            await admin.auth().verifyIdToken(token);
        } catch (authErr) {
            console.error("[STORAGE CONFIG API] Auth Verification Failed:", authErr);
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
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
