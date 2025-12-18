import { Timestamp } from 'firebase/firestore';
import { AttendanceFlag } from './index';

export type ReconciliationStatus = 'pending' | 'approved' | 'rejected';

export interface AttendanceReconciliation {
    id: string;
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    designation: string;
    attendanceDate: string; // yyyy-MM-dd format

    // Original values (from attendance record)
    originalInTime?: string;
    originalOutTime?: string;
    originalFlag?: AttendanceFlag;

    // Requested corrections
    requestedInTime?: string;
    requestedOutTime?: string;
    inTimeRemarks?: string;
    outTimeRemarks?: string;

    shift?: string;
    status: ReconciliationStatus;

    appliedBy: string;
    appliedAt: Timestamp;
    applyDate: string; // Formatted for display

    reviewedBy?: string;
    reviewedAt?: Timestamp;
    reviewComments?: string;

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface CreateReconciliationData {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    designation: string;
    attendanceDate: string;
    originalInTime?: string;
    originalOutTime?: string;
    originalFlag?: AttendanceFlag;
    requestedInTime?: string;
    requestedOutTime?: string;
    inTimeRemarks?: string;
    outTimeRemarks?: string;
    shift?: string;
}

export interface UpdateReconciliationData {
    requestedInTime?: string;
    requestedOutTime?: string;
    inTimeRemarks?: string;
    outTimeRemarks?: string;
}
