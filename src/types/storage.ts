
export type StorageProviderType = 'firebase' | 's3' | 'r2';

export interface StorageConfiguration {
    id?: string;
    name: string;
    provider: StorageProviderType;
    isActive: boolean;

    // Firebase Specific (Optional if using project defaults)
    firebaseBucket?: string;

    // S3 / R2 Common Fields
    bucketName?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicUrl?: string; // Optional custom domain/CDN URL

    // R2 Specific
    accountId?: string; // Cloudflare Account ID

    createdAt?: any;
    updatedAt?: any;
}
