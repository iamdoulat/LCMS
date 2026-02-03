
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { format } from 'date-fns';


// Helper to format time to AM/PM
const formatTimeToAMPM = (isoString?: string): string => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString;
        return format(date, 'hh:mm a');
    } catch (e) {
        return isoString;
    }
};

// Helper to format date to readable format
const formatDateReadable = (dateStr?: string): string => {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return format(date, 'EEEE, MMMM d, yyyy');
    } catch (e) {
        return dateStr;
    }
};

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

        // 2. Fetch Employee Email & Phone & Department
        let employeeEmail = '';
        let employeePhone = '';
        let employeeDept = '';
        if (recData?.employeeId) {
            const empDoc = await admin.firestore().collection('employees').doc(recData.employeeId).get();
            if (empDoc.exists) {
                const d = empDoc.data();
                employeeEmail = d?.email;
                employeePhone = d?.phone; // Get phone
                employeeDept = d?.department;
            }
        }

        if (!employeeEmail) {
            console.warn(`No email found for employee ID: ${recData?.employeeId}`);
            // We can still try WA if phone exists, but let's stick to existing flow structure
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
            date: formatDateReadable(recData?.attendanceDate),
            rejection_reason: rejectionReason || recData?.reviewComments || 'No reason provided', // For rejected template

            // Added variables per user request
            department: employeeDept || 'N/A',
            attendance_date: formatDateReadable(recData?.attendanceDate),
            reconciliation_in_time: formatTimeToAMPM(recData?.requestedInTime),
            in_time_remarks: recData?.inTimeRemarks || 'N/A',
            reconciliation_out_time: formatTimeToAMPM(recData?.requestedOutTime),
            out_time_remarks: recData?.outTimeRemarks || 'N/A',

            // Standard details if needed in approved template too
            designation: recData?.designation || 'N/A',
            link: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/account-details`, // Link to check status
        };

        // 4. Send Email
        if (employeeEmail) {
            await sendEmail({
                to: employeeEmail,
                templateSlug: templateSlug,
                data: templateData
            });
        }

        // 5. Send WhatsApp
        if (employeePhone) {
            const { sendWhatsApp } = await import('@/lib/whatsapp/sender');
            await sendWhatsApp({
                to: employeePhone,
                templateSlug: templateSlug,
                data: templateData
            });
        }

        return NextResponse.json({ success: true, recipient: employeeEmail });

    } catch (error: any) {
        console.error("Error sending decision notification:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
