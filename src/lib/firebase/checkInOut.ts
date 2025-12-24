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

    const stage1Options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: options?.forceRefresh ? 0 : 30000,
        ...options
    };

    const stage2Options: PositionOptions = {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: options?.forceRefresh ? 0 : 60000,
        ...options
    };

    const stage3Options: PositionOptions = {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 600000, // 10 minutes old
        ...options
    };

    const getPos = (opts: PositionOptions): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, opts);
            // Add internal safety timeout for this promise as well
            setTimeout(() => reject(new Error('Internal Timeout')), opts.timeout! + 2000);
        });
    };

    const mapPos = (pos: GeolocationPosition): MultipleCheckInOutLocation => ({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy
    });

    try {
        // Stage 1: High Accuracy
        options?.onProgress?.('Attempting precise GPS location (Stage 1)...');
        console.log('Location Capture Stage 1: Attempting GPS...');
        const pos1 = await getPos(stage1Options);
        console.log('Location Capture: GPS Success');
        return mapPos(pos1);
    } catch (err1: any) {
        if (err1.code === 1) { // PERMISSION_DENIED
            throw new Error("Location permission denied. Please allow access in browser settings.");
        }

        console.warn('Location Capture Stage 1 failed, starting Stage 2 (Low Accuracy)...', err1.message);

        try {
            // Stage 2: Low Accuracy Fallback
            options?.onProgress?.('GPS slow, trying Wi-Fi/Cellular (Stage 2)...');
            const pos2 = await getPos(stage2Options);
            console.log('Location Capture: Low Accuracy Success');
            return mapPos(pos2);
        } catch (err2: any) {
            console.warn('Location Capture Stage 2 failed, starting Stage 3 (Cached)...', err2.message);

            try {
                // Stage 3: Last Known / Cached Position
                options?.onProgress?.('Getting last known position (Stage 3)...');
                const pos3 = await getPos(stage3Options);
                console.log('Location Capture: Cached Position Success');
                return mapPos(pos3);
            } catch (err3: any) {
                console.error('All location capture stages failed.');
                let msg = "Could not capture location. ";
                if (err1.code === 3 || err2.code === 3) { // TIMEOUT
                    msg += "The request timed out. Please ensure GPS is enabled and you have a clear view of the sky.";
                } else if (err1.code === 2 || err2.code === 2) { // POSITION_UNAVAILABLE
                    msg += "Location provider not available. Check your device settings.";
                } else {
                    msg += "Please ensure GPS/Location service is enabled on your device.";
                }
                throw new Error(msg);
            }
        }
    }
};

/**
 * Reverse geocode coordinates to address using Nominatim (OpenStreetMap)
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
        );
        const data = await response.json();
        return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
        console.error('Reverse geocoding failed:', error);
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
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
