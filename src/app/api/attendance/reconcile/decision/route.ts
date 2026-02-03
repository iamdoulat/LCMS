import { NextRequest, NextResponse } from 'next/server';
import { admin, firestore as adminDb } from '@/lib/firebase/admin';
import { determineAttendanceFlag } from '@/lib/firebase/utils';
import { format } from 'date-fns';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    const db = adminDb;
    if (!db) {
        return NextResponse.json({ error: 'Server configuration error (Firestore)' }, { status: 500 });
    }

    try {
        // 1. Authenticate Request
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        // admin is guaranteed safely initialized in admin.ts usually, but admin.auth might throw if not
        const decodedToken = await admin.auth().verifyIdToken(token);
        const reviewerId = decodedToken.uid;

        // 2. Parse Body
        const body = await req.json();
        const { reconciliationId, action, type } = body; // action: 'approve' | 'reject', type: 'attendance' | 'break'

        if (!reconciliationId || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        const collectionName = type === 'breaktime' ? 'break_reconciliation' : 'attendance_reconciliation';
        const reconRef = db.collection(collectionName).doc(reconciliationId);

        // 3. Execute Transaction
        await db.runTransaction(async (transaction) => {
            const reconDoc = await transaction.get(reconRef);
            if (!reconDoc.exists) {
                throw new Error('Reconciliation request not found');
            }
            const reconData = reconDoc.data();
            if (!reconData) throw new Error('No data');

            // Handle Rejection
            if (action === 'reject') {
                transaction.update(reconRef, {
                    status: 'rejected',
                    reviewedBy: reviewerId,
                    reviewedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                return;
            }

            // Handle Approval
            if (action === 'approve') {
                if (type === 'breaktime') {
                    // Breaktime logic (simple status update for now as per original code)
                    // Ideally this should update a separate Breaks collection, but original code just updated status
                    transaction.update(reconRef, {
                        status: 'approved',
                        reviewedBy: reviewerId,
                        reviewedAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                } else {
                    // Attendance Logic
                    const employeeId = reconData.employeeId;
                    const datePart = reconData.attendanceDate ? reconData.attendanceDate.split('T')[0] : '';
                    if (!datePart) throw new Error("Invalid attendance date in request");

                    const attendanceDocId = `${employeeId}_${datePart}`;
                    const attendanceRef = db.collection('attendance').doc(attendanceDocId);
                    const attendanceDoc = await transaction.get(attendanceRef);

                    // Prepare updates
                    const updates: any = {
                        updatedAt: FieldValue.serverTimestamp(),
                        updatedBy: reviewerId,
                        isReconciled: true,
                        reconciliationId: reconciliationId,
                        approvalStatus: 'Approved'
                    };

                    // Process Times
                    if (reconData.requestedInTime) {
                        // Simplify time processing assuming client sends valid ISO or string.
                        // Admin SDK doesn't have the same helper, so we reimplement strict logic or trust input
                        // We will trust input but try to ensure format if it looks like ISO
                        let inTime = reconData.requestedInTime;
                        try {
                            const d = new Date(inTime);
                            if (!isNaN(d.getTime()) && inTime.includes('T')) {
                                // Format to 12h
                                let hours = d.getHours();
                                const minutes = d.getMinutes().toString().padStart(2, '0');
                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                hours = hours % 12 || 12;
                                inTime = `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
                            }
                        } catch (e) { }

                        updates.inTime = inTime;
                        // Determine flag
                        updates.flag = determineAttendanceFlag(inTime);
                    }

                    if (reconData.requestedOutTime) {
                        let outTime = reconData.requestedOutTime;
                        try {
                            const d = new Date(outTime);
                            if (!isNaN(d.getTime()) && outTime.includes('T')) {
                                let hours = d.getHours();
                                const minutes = d.getMinutes().toString().padStart(2, '0');
                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                hours = hours % 12 || 12;
                                outTime = `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
                            }
                        } catch (e) { }
                        updates.outTime = outTime;
                    }

                    if (reconData.inTimeRemarks) updates.inTimeRemarks = reconData.inTimeRemarks;
                    if (reconData.outTimeRemarks) updates.outTimeRemarks = reconData.outTimeRemarks;


                    if (!attendanceDoc.exists) {
                        // Need employee data to create new
                        const empDoc = await transaction.get(db.collection('employees').doc(employeeId));
                        const empData = empDoc.exists ? empDoc.data() : {};

                        // Create ISO date
                        const isoDate = new Date(`${datePart}T00:00:00`).toISOString();

                        transaction.set(attendanceRef, {
                            employeeId,
                            date: isoDate,
                            employeeName: reconData.employeeName || empData?.fullName || 'Unknown',
                            employeeCode: empData?.employeeCode || '',
                            designation: empData?.designation || '',
                            department: empData?.department || '',
                            shiftId: empData?.shiftId || '',
                            flag: 'P', // Default
                            ...updates
                        });
                    } else {
                        transaction.update(attendanceRef, updates);
                    }

                    // Update Recon Request
                    transaction.update(reconRef, {
                        status: 'approved',
                        reviewedBy: reviewerId,
                        reviewedAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                }
            }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
