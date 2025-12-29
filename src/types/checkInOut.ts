// Multiple Check In/Out Types

import type { Timestamp } from 'firebase/firestore';

export const checkInOutTypeOptions = ['Check In', 'Check Out'] as const;
export type CheckInOutType = typeof checkInOutTypeOptions[number];

export interface MultipleCheckInOutLocation {
    latitude: number;
    longitude: number;
    address?: string;
    accuracy?: number;
}

export interface MultipleCheckInOutRecord {
    id: string;
    employeeId: string;
    employeeName: string;
    companyName: string;
    type: CheckInOutType;
    timestamp: string; // ISO format
    location: MultipleCheckInOutLocation;
    imageURL: string; // Firebase Storage URL
    remarks: string;
    status?: 'Approved' | 'Pending' | 'Rejected';
    approvalStatus?: 'Approved' | 'Pending' | 'Rejected';
    distanceFromBranch?: number; // Optional: Store distance for audit
    isInsideGeofence?: boolean; // Optional: Store validation result
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface MultipleCheckInOutFormData {
    employeeId?: string; // Optional for user's own check-in
    companyName: string;
    type: CheckInOutType;
    imageFile: File | null;
    remarks: string;
}
