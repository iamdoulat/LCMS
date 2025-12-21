
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

        // 1. Fetch Leave Request Data
        const doc = await admin.firestore().collection('leave_applications').doc(requestId).get();
        if (!doc.exists) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }
        const data = doc.data();

        // 2. Fetch Employee Data
        let employeeEmail = '';
        let employeeName = data?.employeeName || 'Employee';
        // Some systems store full object, some just ID. 
        if (data?.employeeId) {
            const empDoc = await admin.firestore().collection('employees').doc(data.employeeId).get();
            if (empDoc.exists) {
                const empData = empDoc.data();
                employeeEmail = empData?.email;
                if (!employeeName && empData?.fullName) employeeName = empData.fullName;
                else if (!employeeName && empData?.name) employeeName = empData.name;
            }
        }

        // Calculate total days if missing
        let totalDays = data?.totalDays;
        if (!totalDays && data?.fromDate && data?.toDate) {
            try {
                const start = new Date(data.fromDate);
                const end = new Date(data.toDate);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            } catch (e) {
                totalDays = 0;
            }
        }

        // 3. Handle Notification
        if (type === 'new_request') {
            // Notify Admin/HR
            const adminsSnapshot = await admin.firestore().collection('users')
                .where('role', 'array-contains-any', ['Admin', 'HR', 'Super Admin'])
                .get();

            const adminEmails = adminsSnapshot.docs
                .map(doc => doc.data().email)
                .filter(email => email);

            if (adminEmails.length > 0) {
                await sendEmail({
                    to: adminEmails,
                    templateSlug: 'admin_new_leave_application',
                    data: {
                        employee_name: employeeName,
                        leave_type: data?.leaveType || 'N/A',
                        start_date: data?.fromDate || 'N/A',
                        end_date: data?.toDate || 'N/A',
                        days: totalDays?.toString() || '0',
                        reason: data?.reason || 'N/A',
                        link: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/hr/leaves`
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
            if (status === 'Approved') templateSlug = 'employee_leave_application_approved';
            else if (status === 'Rejected') templateSlug = 'employee_leave_application_rejected';
            else return NextResponse.json({ message: 'Status requires no email.' });

            await sendEmail({
                to: employeeEmail,
                templateSlug: templateSlug,
                data: {
                    employee_name: employeeName,
                    leave_type: data?.leaveType || 'N/A',
                    start_date: data?.fromDate || 'N/A',
                    end_date: data?.toDate || 'N/A',
                    rejection_reason: rejectionReason || data?.rejectionReason || 'No reason provided'
                }
            });
            return NextResponse.json({ success: true, notified: 'employee' });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    } catch (error: any) {
        console.error("Error sending leave notification:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
