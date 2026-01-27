
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { firestore, admin } from '@/lib/firebase/admin'; // Use admin for server-side
import { StorageConfiguration } from '@/types/storage';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const path = formData.get('path') as string;
        const configId = formData.get('configId') as string;

        // Verify Authentication
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
        }

        const tokenToken = authHeader.split('Bearer ')[1];
        let authUser;
        try {
            authUser = await admin.auth().verifyIdToken(tokenToken);
        } catch (authErr) {
            console.error("[UPLOAD API] Auth Verification Failed:", authErr);
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        if (!file || !path || !configId) {
            return NextResponse.json({ error: 'Missing required fields: file, path, or configId' }, { status: 400 });
        }

        console.log(`[UPLOAD API] Starting upload by user: ${authUser.email} for path: ${path} using config: ${configId}`);

        // Fetch config from Firestore (Server-side)
        if (!firestore) {
            console.error('[UPLOAD API] Firestore Admin not initialized');
            return NextResponse.json({ error: 'Firestore not initialized' }, { status: 500 });
        }

        const configDoc = await firestore.collection('storage_settings').doc(configId).get();
        if (!configDoc.exists) {
            console.error(`[UPLOAD API] Storage config not found: ${configId}`);
            return NextResponse.json({ error: 'Storage configuration not found' }, { status: 404 });
        }

        const config = configDoc.data() as StorageConfiguration;
        console.log(`[UPLOAD API] Provider: ${config.provider}, Bucket: ${config.bucketName}`);

        // Initialize S3 Client
        const s3Config: any = {
            region: config.region || 'auto',
            credentials: {
                accessKeyId: config.accessKeyId!,
                secretAccessKey: config.secretAccessKey!,
            },
            forcePathStyle: true, // Recommended for R2 and some S3-compatible providers
        };

        // Cloudflare R2 Endpoint
        if (config.provider === 'r2') {
            if (!config.accountId) {
                console.error('[UPLOAD API] R2 Account ID is missing');
                return NextResponse.json({ error: 'R2 Account ID is missing from configuration' }, { status: 400 });
            }
            s3Config.endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
        } else if (config.provider === 's3' && config.region === 'auto') {
            // S3 usually needs a specific region, but some providers use 'auto'
            delete s3Config.region;
        }

        const s3Client = new S3Client(s3Config);

        // Convert file to Buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        console.log(`[UPLOAD API] Uploading ${buffer.length} bytes to ${config.provider}...`);

        const uploadCommand = new PutObjectCommand({
            Bucket: config.bucketName!,
            Key: path,
            Body: buffer,
            ContentType: file.type,
            // ACL: 'public-read', // R2 doesn't always support this via API, depends on bucket settings
        });

        await s3Client.send(uploadCommand);
        console.log(`[UPLOAD API] Successfully uploaded to ${config.provider}: ${path}`);

        // Construct public URL
        let publicUrl = '';
        if (config.publicUrl) {
            publicUrl = `${config.publicUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
        } else if (config.provider === 'r2') {
            // R2 doesn't have a standard public URL format without a custom domain or public bucket URL
            publicUrl = path; // Return path as fallback
            console.warn('[UPLOAD API] R2 upload successful but no publicUrl configured');
        } else {
            // Default S3 public URL format
            publicUrl = `https://${config.bucketName}.s3.${config.region}.amazonaws.com/${path.replace(/^\//, '')}`;
        }

        return NextResponse.json({
            success: true,
            url: publicUrl,
            message: 'Upload successful'
        });
    } catch (error: any) {
        console.error("[UPLOAD API] Server-side upload error:", error);
        return NextResponse.json({
            error: error.message || 'Server upload failed',
            details: error.name || 'UnknownError'
        }, { status: 500 });
    }
}
