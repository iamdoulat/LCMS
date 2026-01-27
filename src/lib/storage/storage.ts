
import { firestore, auth } from '@/lib/firebase/config';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { StorageConfiguration } from '@/types/storage';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage as firebaseStorage } from '@/lib/firebase/config';

// Simple in-memory cache for the active storage configuration
let activeConfigCache: { config: StorageConfiguration | null; timestamp: number } | null = null;
const CACHE_DURATION = 60000; // 1 minute

/**
 * Fetches the currently active storage configuration from a secure server-side API with caching
 */
export async function getActiveStorageConfig(): Promise<StorageConfiguration | null> {
    const now = Date.now();

    // Return cached config if it's still fresh
    if (activeConfigCache && (now - activeConfigCache.timestamp < CACHE_DURATION)) {
        return activeConfigCache.config;
    }

    try {
        console.log(`[STORAGE] Fetching active configuration from API...`);

        // Get auth token
        const token = await auth.currentUser?.getIdToken();
        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/storage/config', { headers });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const config = await response.json() as StorageConfiguration;

        console.log(`[STORAGE] Active config fetched via API: ${config?.name || 'None'} (${config?.provider || 'firebase'})`);

        // Update cache
        activeConfigCache = { config, timestamp: now };
        return config;
    } catch (error) {
        console.error("[STORAGE] Error fetching active storage config via API:", error);
        // If fetch fails, return cached config even if stale as a fallback
        // If No cache, will return null which defaults to firebase
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
            console.error("[STORAGE] Error getting Firebase download URL:", error);
            return fallbackUrl || '';
        }
    }

    // For S3 or R2, construct the URL using publicUrl or service-specific format
    if (config.publicUrl) {
        return `${config.publicUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    }

    if (config.provider === 'r2') {
        // R2 requires publicUrl to be configured for a readable URL.
        // If not configured, we return the path so the caller can handle it or use a default if known.
        console.warn(`[STORAGE] R2 provider used without publicUrl configured for path: ${path}`);
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
        console.log(`[STORAGE] Uploading to Firebase: ${path}`);
        const storageRef = ref(firebaseStorage, path);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    }

    console.log(`[STORAGE] Uploading to ${config.provider.toUpperCase()}: ${path} (Config: ${config.name})`);

    // For S3 and R2, we use a server-side API to handle the upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    formData.append('configId', config.id!);

    try {
        // Get auth token
        const token = await auth.currentUser?.getIdToken();
        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/storage/upload', {
            method: 'POST',
            body: formData,
            headers,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server returned ${response.status}`);
        }

        const result = await response.json();
        console.log(`[STORAGE] ${config.provider.toUpperCase()} Upload Success:`, result.url);
        return result.url;
    } catch (error: any) {
        console.error(`[STORAGE] ${config.provider.toUpperCase()} Upload Failed:`, error);
        throw new Error(`Failed to upload to ${config.name}: ${error.message}`);
    }
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
    // Get auth token
    const token = await auth.currentUser?.getIdToken();
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/storage/delete', {
        method: 'POST',
        headers,
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
