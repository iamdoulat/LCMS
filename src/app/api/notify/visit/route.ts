
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, requestId, status, rejectionReason } = body;

        if (!requestId || !type) {
            return NextResponse.json({ error: 'Request ID and Type are required' }, { status: 400 });
        }

        // 1. Fetch Visit Data
        const doc = await admin.firestore().collection('visit_applications').doc(requestId).get();
        if (!doc.exists) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }
        const data = doc.data();

        // 2. Fetch Employee Data
        let employeeEmail = '';
        let employeeName = data?.employeeName || 'Employee';
        if (data?.employeeId) {
            const empDoc = await admin.firestore().collection('employees').doc(data.employeeId).get();
            if (empDoc.exists) {
                const empData = empDoc.data();
                employeeEmail = empData?.email;
                if (!employeeName && empData?.name) employeeName = empData.name;
            }
        }

        // 3. Handle Notification
        if (type === 'new_request') {
            // Notify Admin/HR
            const adminsSnapshot = await admin.firestore().collection('users')
                .where('role', 'in', ['admin', 'hr', 'super_admin'])
                .get();

            const adminEmails = adminsSnapshot.docs
                .map(doc => doc.data().email)
                .filter(email => email);

            if (adminEmails.length > 0) {
                await sendEmail({
                    to: adminEmails,
                    templateSlug: 'admin_new_visit_application',
                    data: {
                        employee_name: employeeName,
                        customer_name: data?.customerName || 'N/A',
                        location: data?.location || 'N/A',
                        visit_date_start: data?.fromDate || data?.visitDate || 'N/A',
                        visit_date_end: data?.toDate || data?.visitDate || 'N/A',
                        reason: data?.reason || 'N/A',
                        link: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/hr/visit-applications`
                    }
                });
            }
            return NextResponse.json({ success: true, notified: 'admins' });

        } else if (type === 'decision') {
            // Notify Employee
            if (!employeeEmail) {
                return NextResponse.json({ message: 'Employee email not found' });
            }

            let templateSlug = '';
            if (status === 'Approved') templateSlug = 'employee_visit_application_approved';
            else if (status === 'Rejected') templateSlug = 'employee_visit_application_rejected';
            else return NextResponse.json({ message: 'Status requires no email.' });

            await sendEmail({
                to: employeeEmail,
                templateSlug: templateSlug,
                data: {
                    employee_name: employeeName,
                    customer_name: data?.customerName || 'N/A',
                    visit_date_start: data?.fromDate || data?.visitDate || 'N/A',
                    visit_date_end: data?.toDate || data?.visitDate || 'N/A',
                    rejection_reason: rejectionReason || data?.rejectionReason || 'No reason provided'
                }
            });
            return NextResponse.json({ success: true, notified: 'employee' });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    } catch (error: any) {
        console.error("Error sending visit notification:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
