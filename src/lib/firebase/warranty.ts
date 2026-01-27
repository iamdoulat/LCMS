
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp,
    query,
    where,
    getDocs,
    orderBy,
    getDoc
} from 'firebase/firestore';
import { firestore } from './config';
import { uploadFile, deleteFile } from '../storage/storage';
import type { MachineryCatalogue, ErrorCodeRecord } from '@/types/warranty';

// --- Storage Helpers ---

/**
 * Upload a file to active storage under a specific catalogue's folder
 */
export const uploadCatalogueFile = async (
    file: File,
    category: 'thumbnails' | 'catalogues' | 'manuals' | 'videos',
    fileName?: string
): Promise<string> => {
    const timestamp = new Date().getTime();
    const cleanFileName = fileName || `${timestamp}_${file.name.replace(/\s+/g, '_')}`;
    const path = `warranty/catalogues/${category}/${cleanFileName}`;

    return await uploadFile(file, path);
};

/**
 * Delete a file from storage given its absolute URL or path
 */
export const deleteFileByUrl = async (url: string) => {
    try {
        // If it's a firebase URL, we need to extract the path for deleteFile
        // However, deleteFile in storage.ts already handles firebase via ref(storage, path)
        // If path is a full URL, ref(storage, url) works for Firebase.
        // For S3/R2, we need the relative path.

        let path = url;
        if (url.includes('firebasestorage.googleapis.com')) {
            // Firebase ref handles full URL
            await deleteFile(url);
        } else if (url.includes('cloudflarestorage.com') || url.includes('amazonaws.com') || url.includes('r2.dev')) {
            // For S3/R2, extract path from URL
            // This is a bit tricky depending on the URL structure.
            // For now, let's assume the path is the part after the domain.
            try {
                const urlObj = new URL(url);
                path = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                await deleteFile(path);
            } catch (e) {
                console.error("Failed to parse URL for deletion:", url);
                await deleteFile(url);
            }
        } else {
            // Fallback
            await deleteFile(url);
        }
    } catch (error) {
        console.error("Error deleting file from storage:", error);
    }
};

// --- Catalogue CRUD Helpers ---

/**
 * Create a new Machinery Catalogue record
 */
export const createCatalogue = async (data: Omit<MachineryCatalogue, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(firestore, 'machinery_catalogues'), {
        ...data,
        createdAt: now,
        updatedAt: now
    });
    return docRef.id;
};

/**
 * Update an existing Machinery Catalogue record
 */
export const updateCatalogue = async (id: string, data: Partial<Omit<MachineryCatalogue, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const docRef = doc(firestore, 'machinery_catalogues', id);
    await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now()
    });
};

/**
 * Delete a Machinery Catalogue record and its associated files
 */
export const deleteCatalogue = async (catalogue: MachineryCatalogue) => {
    // Delete files first
    if (catalogue.thumbnailUrl) await deleteFileByUrl(catalogue.thumbnailUrl!);
    if (catalogue.fileUrl) await deleteFileByUrl(catalogue.fileUrl!);
    if (catalogue.insManualsUrl) await deleteFileByUrl(catalogue.insManualsUrl!);
    if (catalogue.videoUrl) await deleteFileByUrl(catalogue.videoUrl!);

    // Delete record
    await deleteDoc(doc(firestore, 'machinery_catalogues', catalogue.id));
};

/**
 * Get a single catalogue by ID
 */
export const getCatalogueById = async (id: string): Promise<MachineryCatalogue | null> => {
    const docSnap = await getDoc(doc(firestore, 'machinery_catalogues', id));
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as MachineryCatalogue;
    }
    return null;
};

// --- Error Code CRUD Helpers ---

/**
 * Create a new Error Code record
 */
export const createErrorCode = async (data: Omit<ErrorCodeRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(firestore, 'error_codes'), {
        ...data,
        createdAt: now,
        updatedAt: now
    });
    return docRef.id;
};

/**
 * Update an existing Error Code record
 */
export const updateErrorCode = async (id: string, data: Partial<Omit<ErrorCodeRecord, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const docRef = doc(firestore, 'error_codes', id);
    await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now()
    });
};

/**
 * Delete an Error Code record
 */
export const deleteErrorCode = async (id: string) => {
    await deleteDoc(doc(firestore, 'error_codes', id));
};
