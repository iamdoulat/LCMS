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
            const attendanceDocId = `${reconciliation.employeeId}_${reconciliation.attendanceDate}`;
            const attendanceRef = doc(firestore, ATTENDANCE_COLLECTION, attendanceDocId);

            const attendanceDoc = await transaction.get(attendanceRef);

            // Prepare updates for attendance record
            const attendanceUpdates: any = {
                updatedAt: serverTimestamp(),
                updatedBy: reviewerId,
            };

            if (reconciliation.requestedInTime) {
                attendanceUpdates.inTime = reconciliation.requestedInTime;
                // Auto-update flag based on new in-time (P if ≤09:10 AM, D if >09:10 AM)
                attendanceUpdates.flag = determineAttendanceFlag(reconciliation.requestedInTime);
            }
            if (reconciliation.requestedOutTime) {
                attendanceUpdates.outTime = reconciliation.requestedOutTime;
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

            if (!attendanceDoc.exists()) {
                // If allowance for creating missing attendance via reconciliation exists
                // construct full object. For now assuming record exists or we create basic shell.
                // Let's set basic fields if creating new.
                const fallbackDate = new Date(`${reconciliation.attendanceDate}T00:00:00`);
                const isoDate = !isNaN(fallbackDate.getTime()) ? fallbackDate.toISOString() : new Date().toISOString();

                transaction.set(attendanceRef, {
                    employeeId: reconciliation.employeeId,
                    date: isoDate,
                    employeeName: reconciliation.employeeName, // Assuming present
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
