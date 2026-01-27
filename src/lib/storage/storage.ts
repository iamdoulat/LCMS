
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { StorageConfiguration } from '@/types/storage';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage as firebaseStorage } from '@/lib/firebase/config';

// Simple in-memory cache for the active storage configuration
let activeConfigCache: { config: StorageConfiguration | null; timestamp: number } | null = null;
const CACHE_DURATION = 60000; // 1 minute

/**
 * Fetches the currently active storage configuration from Firestore with caching
 */
export async function getActiveStorageConfig(): Promise<StorageConfiguration | null> {
    const now = Date.now();

    // Return cached config if it's still fresh
    if (activeConfigCache && (now - activeConfigCache.timestamp < CACHE_DURATION)) {
        return activeConfigCache.config;
    }

    try {
        const q = query(
            collection(firestore, 'storage_settings'),
            where('isActive', '==', true),
            limit(1)
        );
        const snapshot = await getDocs(q);

        const config = snapshot.empty ? null : {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data()
        } as StorageConfiguration;

        // Update cache
        activeConfigCache = { config, timestamp: now };
        return config;
    } catch (error) {
        console.error("Error fetching active storage config:", error);
        // If fetch fails, return cached config even if stale as a fallback
        return activeConfigCache?.config || null;
    }
}

/**
 * Resolves the public URL for a given storage path based on the active provider
 */
export async function getFileUrl(path: string, fallbackUrl?: string): Promise<string> {
    if (!path) return fallbackUrl || '';

    // If it's already a full URL (http/https), return it
    if (path.startsWith('http')) return path;

    const config = await getActiveStorageConfig();

    // Default to Firebase if no config or firebase is active
    if (!config || config.provider === 'firebase') {
        try {
            const storageRef = ref(firebaseStorage, path);
            return await getDownloadURL(storageRef);
        } catch (error) {
            console.error("Error getting Firebase download URL:", error);
            return fallbackUrl || '';
        }
    }

    // For S3 or R2, construct the URL using publicUrl or service-specific format
    if (config.publicUrl) {
        return `${config.publicUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    }

    if (config.provider === 'r2') {
        // R2 requires publicUrl to be configured for a readable URL
        return fallbackUrl || path;
    }

    // Default S3 public URL format
    return `https://${config.bucketName}.s3.${config.region}.amazonaws.com/${path.replace(/^\//, '')}`;
}

/**
 * Universal upload function that handles different providers
 */
export async function uploadFile(file: File, path: string): Promise<string> {
    const config = await getActiveStorageConfig();

    // Default to Firebase if no config or firebase is explicitly active
    if (!config || config.provider === 'firebase') {
        const storageRef = ref(firebaseStorage, path);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    }

    // For S3 and R2, we use a server-side API to handle the upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    formData.append('configId', config.id!);

    const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file to external storage');
    }

    const result = await response.json();
    return result.url;
}

/**
 * Universal delete function that handles different providers
 */
export async function deleteFile(path: string): Promise<void> {
    const config = await getActiveStorageConfig();

    // Default to Firebase if no config or firebase is explicitly active
    if (!config || config.provider === 'firebase') {
        const { deleteObject } = await import('firebase/storage');
        const storageRef = ref(firebaseStorage, path);
        try {
            await deleteObject(storageRef);
        } catch (error: any) {
            if (error.code !== 'storage/object-not-found') {
                throw error;
            }
        }
        return;
    }

    // For S3 and R2, we use a server-side API to handle the deletion
    const response = await fetch('/api/storage/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            path,
            configId: config.id,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete file from external storage');
    }
}
