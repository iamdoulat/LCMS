
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { reconciliationId, status, rejectionReason } = body;

        if (!reconciliationId || !status) {
            return NextResponse.json({ error: 'Reconciliation ID and Status are required' }, { status: 400 });
        }

        // 1. Fetch Reconciliation Data
        const recDoc = await admin.firestore().collection('attendance_reconciliation').doc(reconciliationId).get();
        if (!recDoc.exists) {
            return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
        }
        const recData = recDoc.data();

        // 2. Fetch Employee Email
        let employeeEmail = '';
        if (recData?.employeeId) {
            const empDoc = await admin.firestore().collection('employees').doc(recData.employeeId).get();
            if (empDoc.exists) {
                employeeEmail = empDoc.data()?.email;
            }
        }

        if (!employeeEmail) {
            console.warn(`No email found for employee ID: ${recData?.employeeId}`);
            return NextResponse.json({ message: 'Employee email not found, cannot send notification.' });
        }

        // 3. Determine Template and Variables
        let templateSlug = '';
        if (status === 'approved') {
            templateSlug = 'your_attendance_reconciliation_application_approved';
        } else if (status === 'rejected') {
            templateSlug = 'your_attendance_reconciliation_application_rejected';
        } else {
            return NextResponse.json({ message: 'Status requires no email notification.' });
        }

        const templateData = {
            name: recData?.employeeName || 'Employee', // Common variable
            employee_name: recData?.employeeName || 'Employee',
            date: recData?.attendanceDate || 'N/A',
            rejection_reason: rejectionReason || recData?.reviewComments || 'No reason provided', // For rejected template

            // Standard details if needed in approved template too
            designation: recData?.designation || 'N/A',
            link: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/account-details`, // Link to check status
        };

        // 4. Send Email
        await sendEmail({
            to: employeeEmail,
            templateSlug: templateSlug,
            data: templateData
        });

        return NextResponse.json({ success: true, recipient: employeeEmail });

    } catch (error: any) {
        console.error("Error sending decision notification:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
