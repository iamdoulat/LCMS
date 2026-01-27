// Firebase helper functions for Multiple Check In/Out

import { collection, addDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { firestore } from './config';
import { uploadFile } from '../storage/storage';
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

    const onProgress = options?.onProgress || (() => { });

    const getPosition = (opts: PositionOptions): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, opts);
        });
    };

    // Stage 1: Try High Accuracy (GPS)
    try {
        onProgress('Searching for GPS signal...');
        const pos = await getPosition({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: options?.forceRefresh ? 0 : 30000,
            ...options
        });
        return {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
        };
    } catch (err: any) {
        console.warn('GPS Stage failed, moving to Stage 2:', err.message);
    }

    // Stage 2: Try Low Accuracy (Network/Cellular)
    try {
        onProgress('GPS weak. Trying network location...');
        const pos = await getPosition({
            enableHighAccuracy: false,
            timeout: 7000,
            maximumAge: 60000, // 1 min old OK
            ...options
        });
        return {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
        };
    } catch (err: any) {
        console.warn('Network Stage failed, moving to Stage 3:', err.message);
    }

    // Stage 3: Try Last Known Position (Cached)
    try {
        onProgress('Network weak. Fetching last known location...');
        const pos = await getPosition({
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000, // 5 min old OK
            ...options
        });
        return {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
        };
    } catch (err: any) {
        onProgress('Location capture failed.');
        let msg = "Could not capture location. ";
        if (err.code === 1) {
            msg = "Location permission denied. Please allow access in browser settings.";
        } else {
            msg += "Please ensure GPS/Location service is enabled and you have a clear view of the sky or a stable network connection.";
        }
        throw new Error(msg);
    }
};

/**
 * Reverse geocode coordinates to address using Nominatim (OpenStreetMap)
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'LCMSAttendanceApp/1.0'
                },
                signal: controller.signal
            }
        );
        clearTimeout(timeoutId);
        const data = await response.json();
        return data.display_name || `Coords: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
        console.error('Reverse geocoding failed:', error);
        return `Location captured (Address unavailable)`;
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
    const path = `check_inout_images/${employeeId}/${fileName}`;

    return await uploadFile(file, path);
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
