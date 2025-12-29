import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    serverTimestamp,
    runTransaction,
    writeBatch,
    orderBy,
    getDoc
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { determineAttendanceFlag } from './utils';
import type {
    AttendanceReconciliation,
    CreateReconciliationData,
    ReconciliationStatus
} from '@/types/reconciliation';

const RECONCILIATION_COLLECTION = 'attendance_reconciliation';
const ATTENDANCE_COLLECTION = 'attendance';

// Create a new reconciliation request
export const createReconciliationRequest = async (data: CreateReconciliationData, userId: string) => {
    try {
        const docRef = await addDoc(collection(firestore, RECONCILIATION_COLLECTION), {
            ...data,
            status: 'pending',
            appliedBy: userId,
            appliedAt: serverTimestamp(),
            applyDate: new Date().toISOString(), // Fallback/formatted client-side usually, but storing ISO here
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error('Error creating reconciliation request:', error);
        throw error;
    }
};

// Get reconciliations for a specific employee
export const getEmployeeReconciliations = async (employeeId: string) => {
    try {
        const q = query(
            collection(firestore, RECONCILIATION_COLLECTION),
            where('employeeId', '==', employeeId)
        );

        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AttendanceReconciliation[];

        // Sort client-side to avoid index requirement
        return results.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });
    } catch (error) {
        console.error('Error fetching employee reconciliations:', error);
        throw error;
    }
};

// Get all reconciliations (for Admin/HR)
export const getAllReconciliations = async (status?: ReconciliationStatus) => {
    try {
        let q = query(
            collection(firestore, RECONCILIATION_COLLECTION)
        );

        if (status) {
            q = query(
                collection(firestore, RECONCILIATION_COLLECTION),
                where('status', '==', status)
            );
        }

        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AttendanceReconciliation[];

        // Sort client-side
        return results.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });
    } catch (error) {
        console.error('Error fetching all reconciliations:', error);
        throw error;
    }
};



// Approve a reconciliation request
export const approveReconciliation = async (
    reconciliationId: string,
    reconciliation: AttendanceReconciliation,
    reviewerId: string
) => {
    try {
        await runTransaction(firestore, async (transaction) => {
            // 1. Get the attendance document reference
            // ID format is employeeId_yyyy-MM-dd
            // Ensure we use only the date part YYYY-MM-DD
            const datePart = reconciliation.attendanceDate ? reconciliation.attendanceDate.split('T')[0] : '';
            const attendanceDocId = `${reconciliation.employeeId}_${datePart}`;
            const attendanceRef = doc(firestore, ATTENDANCE_COLLECTION, attendanceDocId);

            const attendanceDoc = await transaction.get(attendanceRef);

            // Prepare updates for attendance record
            const attendanceUpdates: any = {
                updatedAt: serverTimestamp(),
                updatedBy: reviewerId,
            };

            if (reconciliation.requestedInTime) {
                // Convert ISO to hh:mm A format if needed, or ensure it is in that format
                // The requestedInTime from reconciliation creation is usually ISO string
                try {
                    const d = new Date(reconciliation.requestedInTime);
                    if (!isNaN(d.getTime())) {
                        // Format to "hh:mm AM/PM"
                        let hours = d.getHours();
                        const minutes = d.getMinutes().toString().padStart(2, '0');
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12;
                        hours = hours ? hours : 12; // the hour '0' should be '12'
                        attendanceUpdates.inTime = `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
                    } else {
                        // Fallback or keep as is if not parseable
                        attendanceUpdates.inTime = reconciliation.requestedInTime;
                    }
                } catch (e) {
                    attendanceUpdates.inTime = reconciliation.requestedInTime;
                }

                // Auto-update flag based on new in-time (P if ≤09:10 AM, D if >09:10 AM)
                attendanceUpdates.flag = determineAttendanceFlag(attendanceUpdates.inTime);
            }
            if (reconciliation.requestedOutTime) {
                try {
                    const d = new Date(reconciliation.requestedOutTime);
                    if (!isNaN(d.getTime())) {
                        // Format to "hh:mm AM/PM"
                        let hours = d.getHours();
                        const minutes = d.getMinutes().toString().padStart(2, '0');
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12;
                        hours = hours ? hours : 12; // the hour '0' should be '12'
                        attendanceUpdates.outTime = `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
                    } else {
                        attendanceUpdates.outTime = reconciliation.requestedOutTime;
                    }
                } catch (e) {
                    attendanceUpdates.outTime = reconciliation.requestedOutTime;
                }
            }
            if (reconciliation.inTimeRemarks) {
                attendanceUpdates.inTimeRemarks = reconciliation.inTimeRemarks;
            }
            if (reconciliation.outTimeRemarks) {
                attendanceUpdates.outTimeRemarks = reconciliation.outTimeRemarks;
            }
            // If we want to capture that it was reconciled
            attendanceUpdates.isReconciled = true;
            attendanceUpdates.reconciliationId = reconciliationId;
            attendanceUpdates.approvalStatus = 'Approved';

            if (!attendanceDoc.exists()) {
                // Fetch employee data to ensure we have all necessary fields for a valid attendance record
                const empRef = doc(firestore, 'employees', reconciliation.employeeId);
                const empDoc = await transaction.get(empRef);
                const empData = empDoc.exists() ? empDoc.data() : {};

                // robustly construct ISO date from YYYY-MM-DD
                let isoDate;
                try {
                    isoDate = new Date(`${datePart}T00:00:00`).toISOString();
                } catch (e) {
                    isoDate = new Date().toISOString();
                }

                transaction.set(attendanceRef, {
                    employeeId: reconciliation.employeeId,
                    date: isoDate,
                    employeeName: reconciliation.employeeName || empData.fullName || 'Unknown Employee',
                    employeeCode: empData.employeeCode || '',
                    designation: empData.designation || '',
                    department: empData.department || '',
                    shiftId: empData.shiftId || '',
                    flag: 'P',
                    ...attendanceUpdates
                });
            } else {
                transaction.update(attendanceRef, attendanceUpdates);
            }

            // 2. Update reconciliation request status
            const reconciliationRef = doc(firestore, RECONCILIATION_COLLECTION, reconciliationId);
            transaction.update(reconciliationRef, {
                status: 'approved',
                reviewedBy: reviewerId,
                reviewedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });
    } catch (error) {
        console.error('Error approving reconciliation:', error);
        throw error;
    }
};

// Reject a reconciliation request
export const rejectReconciliation = async (id: string, reviewerId: string) => {
    try {
        const docRef = doc(firestore, RECONCILIATION_COLLECTION, id);
        await updateDoc(docRef, {
            status: 'rejected',
            reviewedBy: reviewerId,
            reviewedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Error rejecting reconciliation:', error);
        throw error;
    }
};

// Bulk approve
export const bulkApproveReconciliations = async (
    reconciliations: AttendanceReconciliation[],
    reviewerId: string
) => {
    // Process in chunks or sequentially since we use transactions
    // Promise.all might contend on resources but usually fine for small batches
    const promises = reconciliations.map(rec => approveReconciliation(rec.id, rec, reviewerId));
    await Promise.all(promises);
};

// Bulk reject
export const bulkRejectReconciliations = async (ids: string[], reviewerId: string) => {
    const batch = writeBatch(firestore);

    ids.forEach(id => {
        const docRef = doc(firestore, RECONCILIATION_COLLECTION, id);
        batch.update(docRef, {
            status: 'rejected',
            reviewedBy: reviewerId,
            reviewedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    await batch.commit();
};

// Update a reconciliation request (e.g. edit times)
export const updateReconciliation = async (id: string, data: Partial<AttendanceReconciliation>) => {
    try {
        const docRef = doc(firestore, RECONCILIATION_COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Error updating reconciliation:', error);
        throw error;
    }
};

// Delete a reconciliation request
export const deleteReconciliation = async (id: string) => {
    try {
        const docRef = doc(firestore, RECONCILIATION_COLLECTION, id);
        await import('firebase/firestore').then(({ deleteDoc }) => deleteDoc(docRef));
    } catch (error) {
        console.error('Error deleting reconciliation:', error);
        throw error;
    }
};
