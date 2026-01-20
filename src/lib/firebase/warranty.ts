
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
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { firestore, storage } from './config';
import type { MachineryCatalogue, ErrorCodeRecord } from '@/types/warranty';

// --- Storage Helpers ---

/**
 * Upload a file to Firebase Storage under a specific catalogue's folder
 */
export const uploadCatalogueFile = async (
    file: File,
    category: 'thumbnails' | 'catalogues' | 'manuals' | 'videos',
    fileName?: string
): Promise<string> => {
    const timestamp = new Date().getTime();
    const cleanFileName = fileName || `${timestamp}_${file.name.replace(/\s+/g, '_')}`;
    const storageRef = ref(storage, `warranty/catalogues/${category}/${cleanFileName}`);

    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
};

/**
 * Delete a file from Firebase Storage given its absolute URL
 */
export const deleteFileByUrl = async (url: string) => {
    try {
        const fileRef = ref(storage, url);
        await deleteObject(fileRef);
    } catch (error) {
        console.error("Error deleting file from storage:", error);
        // We don't throw here to avoid blocking record deletion if the file is already gone
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
    const isFirebaseUrl = (url?: string) => url?.includes('firebasestorage.googleapis.com');

    // Delete files first (only if they are stored in Firebase)
    if (isFirebaseUrl(catalogue.thumbnailUrl)) await deleteFileByUrl(catalogue.thumbnailUrl!);
    if (isFirebaseUrl(catalogue.fileUrl)) await deleteFileByUrl(catalogue.fileUrl!);
    if (isFirebaseUrl(catalogue.insManualsUrl)) await deleteFileByUrl(catalogue.insManualsUrl!);
    if (isFirebaseUrl(catalogue.videoUrl)) await deleteFileByUrl(catalogue.videoUrl!);

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
