// Firebase helper functions for Multiple Check In/Out

import { collection, addDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore, storage } from './config';
import type { MultipleCheckInOutRecord, CheckInOutType, MultipleCheckInOutLocation } from '@/types/checkInOut';

/**
 * Get current geolocation with a 3-stage robust fallback strategy:
 * 1. High Accuracy (GPS) - 20s
 * 2. Low Accuracy (Cellular/Wi-Fi) - 15s
 * 3. Last Known Position (Cached) - 10s
 */
export const getCurrentLocation = async (options?: PositionOptions & {
    forceRefresh?: boolean;
    onProgress?: (msg: string) => void;
}): Promise<MultipleCheckInOutLocation> => {
    if (typeof window !== 'undefined' && !navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
    }

    const posOptions: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: options?.forceRefresh ? 0 : 30000,
        ...options
    };

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                });
            },
            (err) => {
                let msg = "Could not capture location. ";
                if (err.code === 1) {
                    msg = "Location permission denied. Please allow access in browser settings.";
                } else if (err.code === 3) {
                    msg += "The request timed out. Please ensure GPS is enabled.";
                } else if (err.code === 2) {
                    msg += "Location provider not available. Check your device settings.";
                } else {
                    msg += "Please ensure GPS/Location service is enabled on your device.";
                }
                reject(new Error(msg));
            },
            posOptions
        );
    });
};

/**
 * Reverse geocode coordinates to address using Nominatim (OpenStreetMap)
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'NextsewAttendanceApp/1.0'
                }
            }
        );
        const data = await response.json();
        return data.display_name || `Coords: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
        console.error('Reverse geocoding failed:', error);
        return `Coords: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
};

/**
 * Upload check-in/out image to Firebase Storage
 */
export const uploadCheckInOutImage = async (
    file: File,
    employeeId: string,
    type: CheckInOutType
): Promise<string> => {
    const timestamp = new Date().getTime();
    const fileName = `${timestamp}_${type.replace(' ', '_')}.jpg`;
    const storageRef = ref(storage, `check_inout_images/${employeeId}/${fileName}`);

    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

/**
 * Create a new check-in/out record
 */
export const createCheckInOutRecord = async (
    employeeId: string,
    employeeName: string,
    companyName: string,
    type: CheckInOutType,
    location: MultipleCheckInOutLocation,
    imageURL: string,
    remarks: string,
    additionalData?: {
        status?: 'Approved' | 'Pending' | 'Rejected';
        approvalStatus?: 'Approved' | 'Pending' | 'Rejected';
        distanceFromBranch?: number;
        isInsideGeofence?: boolean;
    }
): Promise<string> => {
    const now = Timestamp.now();
    const record: Omit<MultipleCheckInOutRecord, 'id'> = {
        employeeId,
        employeeName,
        companyName,
        type,
        timestamp: new Date().toISOString(),
        location,
        imageURL,
        remarks,
        ...additionalData,
        createdAt: now,
        updatedAt: now,
    };

    const docRef = await addDoc(collection(firestore, 'multiple_check_inout'), record);
    return docRef.id;
};

/**
 * Get check-in/out records with filters
 */
export const getCheckInOutRecords = async (filters?: {
    employeeId?: string;
    fromDate?: string;
    toDate?: string;
    type?: CheckInOutType;
}): Promise<MultipleCheckInOutRecord[]> => {
    let q = query(collection(firestore, 'multiple_check_inout'), orderBy('timestamp', 'desc'));

    if (filters?.employeeId) {
        q = query(q, where('employeeId', '==', filters.employeeId));
    }

    if (filters?.type) {
        q = query(q, where('type', '==', filters.type));
    }

    const snapshot = await getDocs(q);
    let records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    })) as MultipleCheckInOutRecord[];

    // Client-side date filtering
    if (filters?.fromDate || filters?.toDate) {
        records = records.filter(record => {
            const recordDate = new Date(record.timestamp);
            if (filters.fromDate && recordDate < new Date(filters.fromDate)) return false;
            if (filters.toDate && recordDate > new Date(filters.toDate)) return false;
            return true;
        });
    }

    return records;
};

/**
 * Update check-in/out record status
 */
export const updateCheckInOutStatus = async (
    id: string,
    status: 'Approved' | 'Rejected',
    reviewerId: string
) => {
    try {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        const docRef = doc(firestore, 'multiple_check_inout', id);

        await updateDoc(docRef, {
            status,
            reviewedBy: reviewerId,
            reviewedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Error updating check-in/out status:', error);
        throw error;
    }
};
