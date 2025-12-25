import { Timestamp } from 'firebase/firestore';

export type BreakStatus = 'pending' | 'approved' | 'rejected' | 'auto-approved';

export interface BreakTimeRecord {
    id?: string;
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    designation: string;
    date: string; // yyyy-MM-dd
    startTime: string; // ISO string or format? Let's use ISO for accuracy
    endTime?: string; // ISO string
    durationMinutes?: number;
    status: BreakStatus;
    isAutoApproved: boolean;
    onBreak: boolean;
    locationStart?: { latitude: number; longitude: number; address?: string };
    locationEnd?: { latitude: number; longitude: number; address?: string };
    remarks?: string;
    reviewedBy?: string;
    reviewedAt?: Timestamp;
    reviewComments?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
