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

                    // Helper for strict GMT+6 formatting
                    const formatToBDTime = (isoString: string): string => {
                        try {
                            const date = new Date(isoString);
                            if (isNaN(date.getTime())) return isoString; // Fallback

                            // Check if it's already "hh:mm AM/PM" format (rudimentary check)
                            if (isoString.match(/\d{1,2}:\d{2}\s*(AM|PM)/i)) return isoString;

                            return new Intl.DateTimeFormat('en-US', {
                                timeZone: 'Asia/Dhaka',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                            }).format(date);
                        } catch (e) {
                            return isoString;
                        }
                    };

                    // Process Times
                    if (reconData.requestedInTime) {
                        const bdTime = formatToBDTime(reconData.requestedInTime);
                        updates.inTime = reconData.requestedInTime;

                        // Calculate flag using BD time and policy
                        try {
                            const policySnap = await transaction.get(db.collection('hrm_settings').doc('attendance_policies').collection('items'));
                            const allPolicies: any[] = [];
                            policySnap.forEach(doc => allPolicies.push({ id: doc.id, ...doc.data() }));

                            const empDoc = await transaction.get(db.collection('employees').doc(employeeId));
                            const empData = empDoc.exists ? empDoc.data() : {};

                            // Re-implement getActivePolicyForDate logic for admin context or import it
                            // Since it's self-contained logic, let's see if we can import
                            const targetDateStr = datePart;
                            const history = (empData as any).policyHistory || [];

                            let activePolicy = null;
                            if (history.length === 0) {
                                const policy = allPolicies.find(p => p.id === (empData as any).attendancePolicyId);
                                if (policy) {
                                    try {
                                        const policyEffectiveDate = format(new Date(policy.effectiveFrom), 'yyyy-MM-dd');
                                        if (policyEffectiveDate <= targetDateStr) {
                                            activePolicy = policy;
                                        }
                                    } catch (err) {
                                        activePolicy = policy;
                                    }
                                }
                            } else {
                                const sortedHistory = [...history].sort((a: any, b: any) => b.effectiveFrom.localeCompare(a.effectiveFrom));
                                const validAssignment = sortedHistory.find((h: any) => {
                                    try {
                                        const assignmentEffectiveDate = format(new Date(h.effectiveFrom), 'yyyy-MM-dd');
                                        if (assignmentEffectiveDate > targetDateStr) return false;

                                        const policy = allPolicies.find(p => p.id === h.policyId);
                                        if (!policy) return false;

                                        const policyEffectiveDate = format(new Date(policy.effectiveFrom), 'yyyy-MM-dd');
                                        return policyEffectiveDate <= targetDateStr;
                                    } catch (err) {
                                        return false;
                                    }
                                });

                                if (validAssignment) {
                                    activePolicy = allPolicies.find(p => p.id === validAssignment.policyId) || null;
                                } else {
                                    const firstAssignment = sortedHistory[sortedHistory.length - 1];
                                    activePolicy = allPolicies.find(p => p.id === (firstAssignment?.policyId || (empData as any).attendancePolicyId)) || null;
                                }
                            }

                            // Handle Daily Policy merging
                            let mergedPolicy = activePolicy;
                            if (activePolicy?.dailyPolicies) {
                                const dayName = format(new Date(reconData.attendanceDate), 'EEEE');
                                const dp = activePolicy.dailyPolicies.find((d: any) => d.day === dayName);
                                if (dp) {
                                    mergedPolicy = {
                                        ...activePolicy,
                                        ...dp,
                                        inTime: dp.inTime || activePolicy.inTime,
                                        delayBuffer: (dp.delayBuffer !== undefined && dp.delayBuffer !== 0)
                                            ? dp.delayBuffer
                                            : activePolicy.delayBuffer
                                    };
                                }
                            }

                            updates.flag = determineAttendanceFlag(bdTime, mergedPolicy || undefined);
                        } catch (err) {
                            console.error("Error determining flag in API:", err);
                            updates.flag = determineAttendanceFlag(bdTime);
                        }
                    }

                    if (reconData.requestedOutTime) {
                        // updates.outTime = formatToBDTime(reconData.requestedOutTime); // OLD
                        updates.outTime = reconData.requestedOutTime; // NEW: Save ISO string
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
