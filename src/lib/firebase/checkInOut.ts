// Firebase helper functions for Multiple Check In/Out

import { collection, addDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore, storage } from './config';
import type { MultipleCheckInOutRecord, CheckInOutType, MultipleCheckInOutLocation } from '@/types/checkInOut';

/**
 * Get current geolocation
 */
export const getCurrentLocation = (options?: PositionOptions & { forceRefresh?: boolean }): Promise<MultipleCheckInOutLocation> => {
    const defaultOptions: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 20000, // 20 seconds for first try
        maximumAge: options?.forceRefresh ? 0 : 60000, // 60 seconds cache unless forced
        ...options
    };

    const fetchLocation = (): Promise<MultipleCheckInOutLocation> => {
        return new Promise((resolve, reject) => {
            if (typeof window !== 'undefined' && !navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            const success = (position: GeolocationPosition) => {
                const location: MultipleCheckInOutLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                resolve(location);
            };

            const errorCallback = (error: GeolocationPositionError) => {
                // If high accuracy failed, try once with low accuracy (faster)
                if (defaultOptions.enableHighAccuracy &&
                    (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE)) {
                    console.warn('High accuracy geolocation failed, retrying with low accuracy...');
                    navigator.geolocation.getCurrentPosition(
                        success,
                        (err) => {
                            let msg = err.message;
                            if (err.code === err.PERMISSION_DENIED) msg = "Location permission denied. Please allow location access in your browser settings.";
                            if (err.code === err.TIMEOUT) msg = "Location request timed out. High-rise buildings or weak signal can cause this. Please try again.";
                            if (err.code === err.POSITION_UNAVAILABLE) msg = "Location information is unavailable on this device right now.";
                            reject(new Error(msg));
                        },
                        { ...defaultOptions, enableHighAccuracy: false, timeout: 15000 }
                    );
                } else {
                    let msg = error.message;
                    if (error.code === error.PERMISSION_DENIED) msg = "Location permission denied. Please allow location access in your browser settings.";
                    reject(new Error(msg));
                }
            };

            navigator.geolocation.getCurrentPosition(success, errorCallback, defaultOptions);
        });
    };

    // Safety timeout to prevent indefinite hanging
    const safetyTimeout = new Promise<never>((_, reject) => {
        const timeoutMs = (defaultOptions.timeout || 25000) + 20000; // Total allowable time
        setTimeout(() => reject(new Error('Location request timed out. Please ensure GPS is on and try again.')), timeoutMs);
    });

    return Promise.race([fetchLocation(), safetyTimeout]);
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
