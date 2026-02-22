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
import { format } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { determineAttendanceFlag } from './utils';
import type {
    AttendanceReconciliation,
    CreateReconciliationData,
    ReconciliationStatus
} from '@/types/reconciliation';
import { getActivePolicyForDate } from '../attendance';
import type { AttendancePolicyDocument, EmployeeDocument, DailyAttendancePolicy } from '@/types';

const RECONCILIATION_COLLECTION = 'attendance_reconciliation';
const ATTENDANCE_COLLECTION = 'attendance';

// Create a new reconciliation request
export const createReconciliationRequest = async (data: CreateReconciliationData, userId: string) => {
    try {
        // Check if a pending request already exists for this employee and date
        const q = query(
            collection(firestore, RECONCILIATION_COLLECTION),
            where('employeeId', '==', data.employeeId),
            where('attendanceDate', '==', data.attendanceDate),
            where('status', '==', 'pending')
        );
        const existingDocs = await getDocs(q);
        if (!existingDocs.empty) {
            throw new Error('A pending reconciliation request already exists for this date.');
        }

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

// Create a new breaktime reconciliation request
export const createBreaktimeReconciliationRequest = async (
    data: {
        employeeId: string;
        employeeCode: string;
        employeeName: string;
        designation: string;
        attendanceDate: string;
        requestedBreakStartTime: string;
        requestedBreakEndTime: string;
        reason: string;
        breakId?: string;
    },
    userId: string
) => {
    try {
        // Check if a pending request already exists for this employee and date
        const q = query(
            collection(firestore, 'break_reconciliation'),
            where('employeeId', '==', data.employeeId),
            where('attendanceDate', '==', data.attendanceDate),
            where('status', '==', 'pending')
        );
        const existingDocs = await getDocs(q);
        if (!existingDocs.empty) {
            throw new Error('A pending break reconciliation request already exists for this date.');
        }

        const docRef = await addDoc(collection(firestore, 'break_reconciliation'), {
            ...data,
            employeeCode: data.employeeCode || 'N/A',
            employeeName: data.employeeName || 'Unknown',
            designation: data.designation || 'Staff',
            status: 'pending',
            appliedBy: userId,
            appliedAt: serverTimestamp(),
            applyDate: new Date().toISOString(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error('Error creating breaktime reconciliation request:', error);
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
        // Fetch policies outside transaction for cleaner logic
        const policySnap = await getDocs(collection(firestore, 'hrm_settings', 'attendance_policies', 'items'));
        const allPolicies = policySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendancePolicyDocument));

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

                // Auto-update flag based on new in-time using the active policy
                try {
                    // Fetch employee data
                    const empRef = doc(firestore, 'employees', reconciliation.employeeId);
                    const empDoc = await transaction.get(empRef);
                    const empData = (empDoc.exists() ? empDoc.data() : {}) as EmployeeDocument;

                    // Determine active policy for the date
                    const targetDate = reconciliation.attendanceDate ? new Date(reconciliation.attendanceDate) : new Date();
                    const activePolicy = getActivePolicyForDate(empData, targetDate, allPolicies);

                    // Handle Daily Policy merging
                    let mergedPolicy = activePolicy;
                    if (activePolicy?.dailyPolicies) {
                        const dayName = format(targetDate, 'EEEE');
                        const dp = activePolicy.dailyPolicies.find((d: any) => d.day === dayName);
                        if (dp) {
                            mergedPolicy = {
                                ...activePolicy,
                                ...dp,
                                inTime: dp.inTime || activePolicy.inTime,
                                delayBuffer: (dp.delayBuffer !== undefined && dp.delayBuffer !== 0)
                                    ? dp.delayBuffer
                                    : activePolicy.delayBuffer
                            } as any;
                        }
                    }

                    attendanceUpdates.flag = determineAttendanceFlag(attendanceUpdates.inTime, mergedPolicy || undefined);
                } catch (err) {
                    console.error("Error determining flag in reconciliation:", err);
                    attendanceUpdates.flag = determineAttendanceFlag(attendanceUpdates.inTime);
                }
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
                    // Use format with local offset to avoid timezone shifts between client and server
                    // Splitting T00:00:00 to ensure we start at local midnight
                    isoDate = format(new Date(`${datePart}T00:00:00`), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
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


// Bulk delete reconciliation requests
export const bulkDeleteReconciliations = async (ids: string[]) => {
    const batch = writeBatch(firestore);

    ids.forEach(id => {
        const docRef = doc(firestore, RECONCILIATION_COLLECTION, id);
        batch.delete(docRef);
    });

    await batch.commit();
};
