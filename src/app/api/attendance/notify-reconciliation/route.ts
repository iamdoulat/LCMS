
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { reconciliationId } = body;

        if (!reconciliationId) {
            return NextResponse.json({ error: 'Reconciliation ID is required' }, { status: 400 });
        }

        // 1. Fetch Reconciliation Data
        const recDoc = await admin.firestore().collection('attendance_reconciliation').doc(reconciliationId).get();
        if (!recDoc.exists) {
            return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
        }
        const recData = recDoc.data();

        // 2. Fetch Employee Data for Department (and fallback designation/name)
        let department = 'N/A';
        try {
            if (recData?.employeeId) {
                const empDoc = await admin.firestore().collection('employees').doc(recData.employeeId).get();
                if (empDoc.exists) {
                    department = empDoc.data()?.department || 'N/A';
                }
            }
        } catch (e) {
            console.error("Error fetching employee details:", e);
        }

        // 3. Fetch Users with Admin or HR roles
        // Firestore doesn't support logical OR in array-contains directly for different values easily in one query without 'in'
        // But 'in' works on exact equality. 'array-contains-any' is what we want.

        let targetEmails: string[] = [];
        let targetPhones: string[] = [];

        try {
            const usersRef = admin.firestore().collection('users');
            // We want users having 'Admin' OR 'HR' OR 'Super Admin' in their 'role' array
            const snapshot = await usersRef.where('role', 'array-contains-any', ['Admin', 'Super Admin', 'HR']).get();

            if (!snapshot.empty) {
                targetEmails = snapshot.docs
                    .map(doc => doc.data().email)
                    .filter(email => email && email.includes('@')); // Basic validation
            }
        } catch (dbError) {
            console.error("Error fetching admin/hr emails:", dbError);
            // Fallback or non-blocking? logic continues but emails won't be sent to list if fetch fails
        }

        const { sendWhatsApp, getPhonesByRole } = await import('@/lib/whatsapp/sender');
        const uniquePhones = await getPhonesByRole(['Admin', 'Super Admin', 'HR']);

        if (targetEmails.length === 0) {
            console.warn("No Admin/HR emails found to notify.");
            // We might still have phones? Check later, but normally return if no one to notify.
        }

        // Deduplicate emails
        const uniqueEmails = Array.from(new Set(targetEmails));

        // 4. Prepare Data for Template
        const templateData = {
            name: recData?.employeeName || 'Unknown Employee',
            designation: recData?.designation || 'N/A',
            department: department,
            date: recData?.attendanceDate || 'N/A', // Attendance Reconciliation Date
            apply_date: recData?.applyDate || new Date().toLocaleDateString(), // Apply Date

            // In Time
            in_time: recData?.originalInTime || 'N/A',
            reconciliation_in_time: recData?.requestedInTime || 'N/A',
            in_time_remarks: recData?.inTimeRemarks || 'N/A',

            // Out Time
            out_time: recData?.originalOutTime || 'N/A',
            reconciliation_out_time: recData?.requestedOutTime || 'N/A',
            out_time_remarks: recData?.outTimeRemarks || 'N/A',

            link: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/hr/attendance/reconciliation`,
            reconciliation_id: reconciliationId
        };

        // 3. Send Email
        if (uniqueEmails.length > 0) {
            await sendEmail({
                to: uniqueEmails,
                templateSlug: 'admin:_incoming_attendance_reconciliation_application',
                data: templateData
            });
        }

        // 5. Send WhatsApp
        if (uniquePhones.length > 0) {
            // sendWhatsApp already imported above
            for (const phone of uniquePhones) {
                await sendWhatsApp({
                    to: phone,
                    templateSlug: 'admin:_incoming_attendance_reconciliation_application',
                    data: templateData
                });
            }
        }

        return NextResponse.json({ success: true, recipients: uniqueEmails.length });

    } catch (error: any) {
        console.error("Error sending reconciliation notification:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
