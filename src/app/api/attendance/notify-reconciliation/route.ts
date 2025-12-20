
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            employeeName,
            attendanceDate,
            reason, // mapped to remarks
            reconciliationId
        } = body;

        // 1. Fetch Users with Admin or HR roles
        // Firestore doesn't support logical OR in array-contains directly for different values easily in one query without 'in'
        // But 'in' works on exact equality. 'array-contains-any' is what we want.

        let targetEmails: string[] = [];

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

        if (targetEmails.length === 0) {
            console.warn("No Admin/HR emails found to notify.");
            return NextResponse.json({ message: 'No recipients found, but request logged.' });
        }

        // Deduplicate emails
        const uniqueEmails = Array.from(new Set(targetEmails));

        // 2. Prepare Data for Template
        const templateData = {
            name: employeeName, // Template uses {{name}} for employee name? Or {{employee_name}}? 
            // Based on user request/check, usually it's {{name}} of employee in the subject or body.
            // Let's pass both to be safe if possible, or mapping.
            // The command output showed '{{name}}'.
            employee_name: employeeName,
            date: attendanceDate,
            reason: reason || 'No remarks provided',
            link: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/hr/attendance/reconciliation`, // Link to admin page
            reconciliation_id: reconciliationId
        };

        // 3. Send Email
        await sendEmail({
            to: uniqueEmails,
            templateSlug: 'admin:_incoming_attendance_reconciliation_application',
            data: templateData
        });

        return NextResponse.json({ success: true, recipients: uniqueEmails.length });

    } catch (error: any) {
        console.error("Error sending reconciliation notification:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
