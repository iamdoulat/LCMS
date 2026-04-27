// Firebase helper functions for Multiple Check In/Out

import { collection, addDoc, getDocs, query, where, orderBy, Timestamp, limit } from 'firebase/firestore';
import { firestore } from './config';
import { uploadFile } from '../storage/storage';
import type { MultipleCheckInOutRecord, CheckInOutType, MultipleCheckInOutLocation } from '@/types/checkInOut';
import type { MultipleCheckInOutConfiguration } from '@/types';

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
            timeout: 4000, // Reduced from 8s for faster fallback
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
            timeout: 3000, // Reduced from 5s for faster fallback
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
            timeout: 3000, // Reduced from 5s for faster fallback
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
 * Reverse geocode coordinates to address using BigDataCloud (Fast/Free) with Nominatim fallback
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); 

        // Try BigDataCloud first (fastest, no CORS issues, no rate limit blocking)
        const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            if (data && (data.locality || data.city || data.principalSubdivision)) {
                const parts = [data.locality, data.city, data.principalSubdivision, data.countryName].filter(Boolean);
                return parts.join(', ') || `Coords: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            }
        }
        
        // Fallback to OSM Nominatim if BigDataCloud fails or doesn't have detailed data
        const osmResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
        );
        const osmData = await osmResponse.json();
        return osmData.display_name || `Coords: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        
    } catch (error) {
        console.error('Reverse geocoding failed:', error);
        return `Coords: ${lat.toFixed(6)}, ${lng.toFixed(6)}`; // Return coords instead of 'Address unavailable'
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
    },
    customTimestamp?: string
): Promise<string> => {
    const now = Timestamp.now();
    const record: Omit<MultipleCheckInOutRecord, 'id'> = {
        employeeId,
        employeeName,
        companyName,
        type,
        timestamp: customTimestamp || new Date().toISOString(),
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

    // Server-side date filtering instead of client-side
    if (filters?.fromDate) {
        q = query(q, where('timestamp', '>=', new Date(filters.fromDate).toISOString()));
    }
    if (filters?.toDate) {
        q = query(q, where('timestamp', '<=', new Date(filters.toDate).toISOString()));
    }

    // Cap results to prevent unbounded reads
    q = query(q, limit(200));

    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    })) as MultipleCheckInOutRecord[];

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

/**
 * Check if the employee has any active (un-closed) check-in records.
 * This handles multiple check-ins if allowed by the configuration.
 */
export const hasActiveCheckIn = async (employeeId: string, config?: MultipleCheckInOutConfiguration): Promise<boolean> => {
    try {
        // Fetch last 10 records for this employee to see if any are still "active"
        const q = query(
            collection(firestore, 'multiple_check_inout'),
            where('employeeId', '==', employeeId),
            orderBy('timestamp', 'desc'),
            limit(10)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return false;
        
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MultipleCheckInOutRecord));
        const now = new Date().getTime();
        
        // Determine dynamic expiry window based on configuration
        let maxHours = 12; // Default fallback
        if (config) {
            if (config.isMaxHourLimitEnabled) {
                maxHours = config.maxHourLimitOfCheckOut || 12;
            } else {
                // If limit is disabled, we use a very large window (e.g. 1 month) 
                // to ensure old records still block clock-out until manually cleared
                maxHours = 24 * 30; 
            }
        }

        // Look for any "Check In" that doesn't have a newer "Check Out" for the same company
        const activeCheckIn = records.find(r => {
            if (r.type !== 'Check In') return false;
            
            const hasMatchingCheckOut = records.some(out => 
                out.type === 'Check Out' && 
                out.companyName === r.companyName && 
                new Date(out.timestamp).getTime() > new Date(r.timestamp).getTime()
            );

            // Check if it's within the auto-done/expiry window
            const checkInTime = new Date(r.timestamp).getTime();
            const isExpired = (now - checkInTime) > (maxHours * 60 * 60 * 1000);

            return !hasMatchingCheckOut && !isExpired;
        });

        return !!activeCheckIn;
    } catch (error) {
        console.error('Error in hasActiveCheckIn:', error);
        // Throw the error so the calling component can decide how to handle it
        throw error;
    }
};
