
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { firestore } from '@/lib/firebase/admin'; // Use admin for server-side
import { StorageConfiguration } from '@/types/storage';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const path = formData.get('path') as string;
        const configId = formData.get('configId') as string;

        if (!file || !path || !configId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Fetch config from Firestore (Server-side)
        if (!firestore) {
            return NextResponse.json({ error: 'Firestore not initialized' }, { status: 500 });
        }
        const configDoc = await firestore.collection('storage_settings').doc(configId).get();
        if (!configDoc.exists) {
            return NextResponse.json({ error: 'Storage configuration not found' }, { status: 404 });
        }

        const config = configDoc.data() as StorageConfiguration;

        // Initialize S3 Client
        const s3Config: any = {
            region: config.region || 'auto',
            credentials: {
                accessKeyId: config.accessKeyId!,
                secretAccessKey: config.secretAccessKey!,
            },
        };

        // Cloudflare R2 Endpoint
        if (config.provider === 'r2') {
            s3Config.endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
        } else if (config.provider === 's3' && config.region === 'auto') {
            // S3 usually needs a specific region, but some providers use 'auto'
            delete s3Config.region;
        }

        const s3Client = new S3Client(s3Config);

        // Convert file to Buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadCommand = new PutObjectCommand({
            Bucket: config.bucketName!,
            Key: path,
            Body: buffer,
            ContentType: file.type,
            // ACL: 'public-read', // R2 doesn't always support this via API, depends on bucket settings
        });

        await s3Client.send(uploadCommand);

        // Construct public URL
        let publicUrl = '';
        if (config.publicUrl) {
            publicUrl = `${config.publicUrl.replace(/\/$/, '')}/${path}`;
        } else if (config.provider === 'r2') {
            // R2 doesn't have a standard public URL format without a custom domain or public bucket URL
            return NextResponse.json({
                success: true,
                url: path,
                message: 'Upload successful. Public URL not configured.'
            });
        } else {
            publicUrl = `https://${config.bucketName}.s3.${config.region}.amazonaws.com/${path}`;
        }

        return NextResponse.json({ success: true, url: publicUrl });
    } catch (error: any) {
        console.error("Server-side upload error:", error);
        return NextResponse.json({ error: error.message || 'Server upload failed' }, { status: 500 });
    }
}
