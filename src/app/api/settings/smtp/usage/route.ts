import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { Resend } from 'resend';
import { SmtpConfiguration } from '@/types/email-settings';

export async function GET(
    request: NextRequest,
    { params }: { params: { configId: string } }
) {
    try {
        const { searchParams } = new URL(request.url);
        const configId = searchParams.get('id');

        if (!configId) {
            return NextResponse.json({ error: 'Config ID is required' }, { status: 400 });
        }

        // Initialize Admin SDK
        if (!admin.apps.length) {
            throw new Error('Firebase Admin SDK not initialized');
        }

        const docRef = admin.firestore().collection('smtp_settings').doc(configId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
        }

        const config = { id: doc.id, ...doc.data() } as SmtpConfiguration;

        // Use shared utility for counting
        const { getUsageForConfig } = await import('@/lib/email/usage');
        const count = await getUsageForConfig(config);

        return NextResponse.json({
            count,
            debug: {
                configId,
                today: new Date().toISOString(),
                configProvider: config.serviceProvider
            }
        });

    } catch (error: any) {
        console.error('Usage API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
