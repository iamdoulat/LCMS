
import { NextRequest, NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/admin';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

export async function POST(request: NextRequest) {
    try {
        const { path, configId } = await request.json();

        if (!path || !configId) {
            return NextResponse.json({ error: 'Missing path or configId' }, { status: 400 });
        }

        // Fetch the configuration from Firestore using Admin SDK
        if (!firestore) {
            return NextResponse.json({ error: 'Firestore Admin not initialized' }, { status: 500 });
        }

        const configDoc = await firestore.collection('storage_settings').doc(configId).get();
        if (!configDoc.exists) {
            return NextResponse.json({ error: 'Storage configuration not found' }, { status: 404 });
        }

        const config = configDoc.data();
        if (!config) {
            return NextResponse.json({ error: 'Invalid configuration' }, { status: 400 });
        }

        if (config.provider === 's3' || config.provider === 'r2') {
            const s3Client = new S3Client({
                region: config.region || 'auto',
                endpoint: config.provider === 'r2' ? `https://${config.accountId}.r2.cloudflarestorage.com` : undefined,
                credentials: {
                    accessKeyId: config.accessKeyId,
                    secretAccessKey: config.secretAccessKey,
                },
            });

            await s3Client.send(new DeleteObjectCommand({
                Bucket: config.bucketName,
                Key: path,
            }));

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unsupported provider for server-side deletion' }, { status: 400 });
    } catch (error: any) {
        console.error('Server-side deletion error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
